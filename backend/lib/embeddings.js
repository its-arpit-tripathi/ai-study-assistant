/**
 * Embedding provider factory.
 *
 * Groq does not offer an embeddings API (its /models endpoint lists chat,
 * audio and guard models only), so embeddings have to come from somewhere
 * else. The default here is "local": a small sentence-transformer running
 * on the server via @huggingface/transformers (ONNX runtime). It needs no
 * API key at all, so GROQ_API_KEY becomes the only LLM key the app requires.
 *
 *   EMBEDDING_PROVIDER=local   (default) Xenova/all-MiniLM-L6-v2, 384 dims
 *   EMBEDDING_PROVIDER=gemini  Google gemini-embedding-001, 3072 dims
 *                              (requires GOOGLE_API_KEY)
 *
 * Tunables for the local provider:
 *   EMBEDDING_MODEL       any feature-extraction model on the HF Hub with ONNX
 *                         weights, e.g. Xenova/bge-small-en-v1.5
 *   EMBEDDING_DTYPE       q8 (default, ~23 MB download) | fp32 | fp16
 *   EMBEDDING_BATCH_SIZE  chunks embedded per forward pass (default 8).
 *                         Memory grows with batch size; keep it small on
 *                         512 MB hosts like Render's free tier.
 */

const LOCAL_DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";
const GEMINI_DEFAULT_MODEL = "gemini-embedding-001";

export function getEmbeddingProvider() {
  return (process.env.EMBEDDING_PROVIDER || "local").trim().toLowerCase();
}

export function getEmbeddingModelName() {
  return process.env.EMBEDDING_MODEL || (getEmbeddingProvider() === "gemini" ? GEMINI_DEFAULT_MODEL : LOCAL_DEFAULT_MODEL);
}

export function embeddingInfo() {
  return { provider: getEmbeddingProvider(), model: getEmbeddingModelName() };
}

let instance = null;

/**
 * Returns a (cached) LangChain Embeddings instance for the configured provider.
 * The local pipeline is loaded lazily on first use and then reused for the
 * lifetime of the process.
 */
export async function getEmbeddings() {
  if (instance) return instance;

  const provider = getEmbeddingProvider();

  if (provider === "gemini") {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("EMBEDDING_PROVIDER=gemini requires GOOGLE_API_KEY. Either set it or remove EMBEDDING_PROVIDER to use local embeddings.");
    }
    const { GoogleGenerativeAIEmbeddings } = await import("@langchain/google-genai");
    instance = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model: getEmbeddingModelName(),
    });
    return instance;
  }

  if (provider !== "local") {
    throw new Error(`Unknown EMBEDDING_PROVIDER "${provider}". Use "local" or "gemini".`);
  }

  const { HuggingFaceTransformersEmbeddings } = await import(
    "@langchain/community/embeddings/huggingface_transformers"
  );

  const batchSize = Number.parseInt(process.env.EMBEDDING_BATCH_SIZE, 10);
  const local = new HuggingFaceTransformersEmbeddings({
    model: getEmbeddingModelName(),
    pretrainedOptions: { dtype: process.env.EMBEDDING_DTYPE || "q8" },
  });
  // Default batch size in LangChain is 512, i.e. a whole document in one
  // forward pass, which balloons memory (≈900 MB RSS for a 100-chunk PDF vs
  // ≈300 MB at batch 8) with no measurable speed difference.
  local.batchSize = Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 8;

  instance = local;
  return instance;
}

/**
 * Load the model (downloading it on first run) so the first upload does not
 * pay the cold-start cost. Safe to call without awaiting.
 */
export async function warmUpEmbeddings() {
  const { provider, model } = embeddingInfo();
  if (provider !== "local") return;
  const started = Date.now();
  const embeddings = await getEmbeddings();
  const vector = await embeddings.embedQuery("warm up");
  console.log(`🧠 Local embeddings ready: ${model} (${vector.length} dims) in ${Date.now() - started}ms`);
}
