
import {
  AutoTokenizer,
  AutoModelForSequenceClassification,
} from "@huggingface/transformers";

let modelPromise;
let warnedFallback = false;

function getText(doc) {
  return String(doc.pageContent ?? doc.content ?? "");
}

function lexicalScore(query, text) {
  const tokenize = (value) =>
    (String(value).toLowerCase().match(/[a-z0-9]+/g) || [])
      .filter((token) => token.length > 1);

  const queryTokens = tokenize(query);
  const documentTokens = tokenize(text);

  if (!queryTokens.length || !documentTokens.length) return 0;

  const counts = new Map();

  for (const token of documentTokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const uniqueQueryTokens = new Set(queryTokens);
  let matched = 0;
  let frequency = 0;

  for (const token of uniqueQueryTokens) {
    if (counts.has(token)) {
      matched++;
      frequency += Math.min(counts.get(token), 3);
    }
  }

  const phraseBonus = String(text)
    .toLowerCase()
    .includes(String(query).toLowerCase())
    ? 2
    : 0;

  return (
    matched / uniqueQueryTokens.size +
    0.03 * frequency +
    phraseBonus
  );
}

async function getReranker() {
  if (!modelPromise) {
    const loadStartedAt = performance.now();
    modelPromise = (async () => {
      const modelId = "Xenova/ms-marco-MiniLM-L-6-v2";

      const [tokenizer, model] = await Promise.all([
        AutoTokenizer.from_pretrained(modelId),
        AutoModelForSequenceClassification.from_pretrained(
          modelId,
          { dtype: "q8" }
        ),
      ]);

      console.log(`[Perf][Reranker] model_load_ms=${Math.round(performance.now() - loadStartedAt)}`);
      console.log("[Reranker] Cross-encoder model loaded");

      return { tokenizer, model };
    })().catch((error) => {
      modelPromise = null;
      throw error;
    });
  }

  return modelPromise;
}

function lexicalFallback(query, documents, reranker) {
  return documents
    .map((doc) => ({
      ...doc,
      metadata: {
        ...(doc.metadata || {}),
        rerankScore: lexicalScore(query, getText(doc)),
        reranker,
      },
    }))
    .sort(
      (a, b) => b.metadata.rerankScore - a.metadata.rerankScore
    );
}

export async function rerankDocuments(query, documents, options = {}) {
  const callStartedAt = performance.now();
  const facetLabel = options.facetIndex == null ? "single" : String(options.facetIndex + 1);
  if (!Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  if (process.env.RERANKER_ENABLED === "false") {
    console.log("[Reranker] Disabled; using lexical ranking");
    return lexicalFallback(query, documents, "lexical");
  }

  try {
    const modelReadyStartedAt = performance.now();
    const { tokenizer, model } = await getReranker();
    const modelReadyMs = performance.now() - modelReadyStartedAt;

    const tokenizeStartedAt = performance.now();
    const queries = documents.map(() => String(query));
    const passages = documents.map((doc) => getText(doc).slice(0, 900));

    // Tokenize each query–passage pair together.
    const inputs = tokenizer(queries, {
      text_pair: passages,
      padding: true,
      truncation: true,
      max_length: 256,
    });

    const tokenizationMs = performance.now() - tokenizeStartedAt;
    const inferenceStartedAt = performance.now();
    const output = await model(inputs);
    const inferenceMs = performance.now() - inferenceStartedAt;
    const logits = output?.logits;

    if (!logits?.data) {
      throw new Error("Model did not return logits");
    }

    const values = Array.from(logits.data);
    const numberOfLabels = logits.dims?.at(-1) ?? 1;

    if (values.length !== documents.length * numberOfLabels) {
      throw new Error(
        `Unexpected logits shape: ${JSON.stringify(logits.dims)}`
      );
    }

    // MS MARCO cross-encoders commonly use a single relevance logit.
    // For a single-logit output, use that logit directly.
    // For multiple logits, require an explicitly configured positive label.
    let scores;

    if (numberOfLabels === 1) {
      scores = values;
    } else {
      const positiveLabel = Number(
        process.env.RERANKER_POSITIVE_LABEL
      );

      if (
        !Number.isInteger(positiveLabel) ||
        positiveLabel < 0 ||
        positiveLabel >= numberOfLabels
      ) {
        throw new Error(
          `Model returned ${numberOfLabels} labels. Set RERANKER_POSITIVE_LABEL to the verified relevance label index.`
        );
      }

      scores = documents.map(
        (_, index) => values[index * numberOfLabels + positiveLabel]
      );
    }

    if (!scores.every(Number.isFinite)) {
      throw new Error("Model returned non-finite relevance scores");
    }

    const ranked = documents
      .map((doc, index) => ({
        ...doc,
        metadata: {
          ...(doc.metadata || {}),
          rerankScore: scores[index],
          reranker: "ms-marco-MiniLM-L-6-v2",
        },
      }))
      .sort(
        (a, b) => b.metadata.rerankScore - a.metadata.rerankScore
      );

    console.info(`[Perf][Reranker] facet=${facetLabel} candidates=${documents.length} model_ready_ms=${Math.round(modelReadyMs)} tokenization_ms=${Math.round(tokenizationMs)} inference_ms=${Math.round(inferenceMs)} ranking_ms=${Math.round(performance.now() - inferenceStartedAt - inferenceMs)} total_ms=${Math.round(performance.now() - callStartedAt)}`);

    if (process.env.DEBUG_RERANKER === "true") {
      console.log(
        "[Reranker] Score sample:",
        ranked.slice(0, 5).map((doc) => ({
          chunkId: doc.metadata?.chunkId,
          score: doc.metadata?.rerankScore,
          page:
            doc.metadata?.pageNumber ??
            doc.metadata?.page ??
            doc.metadata?.loc?.pageNumber ??
            null,
        }))
      );
    }

    return ranked;
  } catch (error) {
    if (!warnedFallback) {
      console.error(
        "[Reranker] Model inference failed; using lexical fallback:",
        error.message
      );
      warnedFallback = true;
    }

    console.info(`[Perf][Reranker] facet=${facetLabel} fallback=true candidates=${documents.length} total_ms=${Math.round(performance.now() - callStartedAt)}`);
    return lexicalFallback(
      query,
      documents,
      "lexical-fallback"
    );
  }
}