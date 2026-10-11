import { getPool } from "../config/database.js";
import { rerankDocuments } from "./reranker.js";
import { decomposeQuery, selectFacetAwareResults } from "./retrievalSelection.js";

// In-memory cache for tokenized document corpora to eliminate repeated database round-trips
const corpusCache = new Map();

/** Evict cached document corpus from memory (e.g. when document is deleted or re-indexed). */
export function evictKeywordCache(documentId) {
  if (!documentId) return;
  for (const key of corpusCache.keys()) {
    if (key.endsWith(`:${documentId}`)) {
      corpusCache.delete(key);
    }
  }
}


/** Preload and cache a document corpus in memory so retrieval is instantaneous. */
export async function preloadKeywordChunks(userId, documentId) {
  if (!userId || !documentId) return;
  const cacheKey = `${userId}:${documentId}`;
  if (corpusCache.has(cacheKey)) return;

  const result = await getPool().query(
    `SELECT chunk_id, content, metadata
     FROM document_chunks
     WHERE user_id=$1 AND document_id=$2`,
    [userId, documentId]
  );
  if (!result.rows.length) return;
  const tokenize = (value) => (String(value).toLowerCase().match(/[a-z0-9]+/g) || []);
  const docs = result.rows.map((row) => {
    const terms = tokenize(row.content);
    const tf = new Map();
    for (const term of terms) tf.set(term, (tf.get(term) || 0) + 1);
    return { row, terms, tf, length: terms.length };
  });
  const avgdl = docs.reduce((sum, doc) => sum + doc.length, 0) / (docs.length || 1);
  corpusCache.set(cacheKey, { docs, avgdl });
}

/** Persist chunk text and metadata for BM25 keyword retrieval. */
export async function storeKeywordChunks(userId, documentId, collectionName, chunks) {
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const chunk of chunks) {
      const chunkId = String(chunk.metadata?.chunkId || `${documentId}:${chunk.metadata?.chunkIndex ?? 0}`);
      await client.query(
        `INSERT INTO document_chunks(chunk_id, document_id, user_id, collection_name, content, metadata)
         VALUES($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT(chunk_id) DO UPDATE SET content=EXCLUDED.content, metadata=EXCLUDED.metadata, user_id=EXCLUDED.user_id, document_id=EXCLUDED.document_id, collection_name=EXCLUDED.collection_name`,
        [chunkId, documentId, userId, collectionName, chunk.pageContent, JSON.stringify(chunk.metadata || {})]
      );
    }
    await client.query("COMMIT");
    // Invalidate cached corpus so next search loads fresh chunks
    evictKeywordCache(documentId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** True BM25 lexical retrieval over the document's persisted chunk corpus. */
export async function searchBM25(query, { userId, documentId, limit = 20 }) {
  if (!userId || !documentId) return [];

  const cacheKey = `${userId}:${documentId}`;
  let corpus = corpusCache.get(cacheKey);

  const tokenize = (value) => (String(value).toLowerCase().match(/[a-z0-9]+/g) || []);

  if (!corpus) {
    const result = await getPool().query(
      `SELECT chunk_id, content, metadata
       FROM document_chunks
       WHERE user_id=$1 AND document_id=$2`,
      [userId, documentId]
    );
    if (!result.rows.length) return [];
    const docs = result.rows.map((row) => {
      const terms = tokenize(row.content);
      const tf = new Map();
      for (const term of terms) tf.set(term, (tf.get(term) || 0) + 1);
      return { row, terms, tf, length: terms.length };
    });
    const avgdl = docs.reduce((sum, doc) => sum + doc.length, 0) / (docs.length || 1);
    corpus = { docs, avgdl };
    corpusCache.set(cacheKey, corpus);
  }

  const { docs, avgdl } = corpus;
  const queryTerms = [...new Set(tokenize(query))];
  if (!docs.length || !queryTerms.length) return [];

  const k1 = 1.5;
  const b = 0.75;
  const df = new Map();
  for (const term of queryTerms) {
    df.set(term, docs.reduce((count, doc) => count + (doc.tf.has(term) ? 1 : 0), 0));
  }
  const scored = docs.map((doc) => {
    let score = 0;
    for (const term of queryTerms) {
      const freq = doc.tf.get(term) || 0;
      if (!freq) continue;
      const documentFrequency = df.get(term) || 0;
      const idf = Math.log(1 + (docs.length - documentFrequency + 0.5) / (documentFrequency + 0.5));
      const denominator = freq + k1 * (1 - b + b * doc.length / avgdl);
      score += idf * (freq * (k1 + 1)) / denominator;
    }
    return { ...doc, score };
  }).filter((doc) => doc.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);

  return scored.map(({ row, score }) => ({
    pageContent: row.content,
    metadata: { ...(row.metadata || {}), chunkId: row.chunk_id, documentId: String(documentId), retrievalMethod: "bm25", bm25Score: score },
  }));
}

function identity(chunk) {
  const m = chunk.metadata || {};
  return String(m.chunkId || `${m.documentId || "doc"}:${m.chunkIndex ?? ""}:${chunk.pageContent.slice(0, 80)}`);
}

/** Reciprocal Rank Fusion combines the independent BM25 and vector rankings. */
export function reciprocalRankFusion(vectorResults, keywordResults, { k = 60, limit = 30 } = {}) {
  const byId = new Map();
  const addRanking = (results, method) => results.forEach((chunk, index) => {
    const id = identity(chunk);
    const current = byId.get(id) || { chunk, score: 0, methods: [] };
    current.score += 1 / (k + index + 1);
    if (!current.methods.includes(method)) current.methods.push(method);
    // Prefer Qdrant's Document metadata/content when duplicate IDs are found.
    if (method === "vector") current.chunk = chunk;
    byId.set(id, current);
  });
  addRanking(vectorResults, "vector");
  addRanking(keywordResults, "bm25");
  return [...byId.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ chunk, score, methods }) => ({
      ...chunk,
      metadata: { ...(chunk.metadata || {}), rrfScore: score, retrievalMethods: methods },
    }));
}



export async function hybridRerank(query, vectorResults, keywordResults, k = 5) {
  const fusionStartedAt = performance.now();
  const rerankCandidateLimit = Number(process.env.RERANKER_CANDIDATES || 20);
  const fused = reciprocalRankFusion(vectorResults, keywordResults, { k: 60, limit: rerankCandidateLimit });
  console.info(`[Perf][Hybrid] fusion_ms=${Math.round(performance.now() - fusionStartedAt)} vector=${vectorResults.length} bm25=${keywordResults.length} fused=${fused.length}`);
  console.log(`[RRF] Vector=${vectorResults.length}, BM25=${keywordResults.length}, fused=${fused.length}`);
  if (!fused.length) {
    console.warn('[RRF] No candidates available.');
    return [];
  }

  const facets = decomposeQuery(query);
  console.log('[Query decomposition] Retrieval facets:', facets);

  // Rerank against the full question and each dynamically detected facet.
  // Evaluate facets in controlled order to avoid competing for CPU/worker threads.
  const facetRerankStartedAt = performance.now();
  const rankings = [];
  for (let facetIndex = 0; facetIndex < facets.length; facetIndex++) {
    const facet = facets[facetIndex];
    try {
      const ranking = await rerankDocuments(facet, fused, { facetIndex });
      rankings.push(ranking);
    } catch (error) {
      console.error(`[Reranker] Failed for facet "${facet}":`, error.message);
      rankings.push(fused);
    }
  }

  console.info(`[Perf][Hybrid] facet_rerank_wall_ms=${Math.round(performance.now() - facetRerankStartedAt)} facets=${facets.length} candidates_per_facet=${fused.length}`);

  const aggregationStartedAt = performance.now();
  const aggregate = new Map();
  rankings.forEach((ranking, facetIndex) => ranking.forEach((chunk, index) => {
    const id = identity(chunk);
    const entry = aggregate.get(id) || { chunk, score: 0, facetRanks: [] };
    entry.score += 1 / (60 + index + 1);
    entry.facetRanks.push({ facet: facets[facetIndex], rank: index + 1 });
    // Keep the chunk object with the strongest available reranker metadata.
    if (index === 0) entry.chunk = chunk;
    aggregate.set(id, entry);
  }));

  const combined = [...aggregate.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ chunk, score, facetRanks }) => ({
      ...chunk,
      metadata: {
        ...(chunk.metadata || {}),
        multiQueryRrfScore: score,
        facetRanks,
      },
    }));

  // Reserve the strongest result for each dynamically detected query facet, then
  // use MMR to fill remaining slots with relevant, non-redundant evidence. This
  // prevents a broad chunk from crowding out a distinct part of a multi-part query.
  const selectionStartedAt = performance.now();
  const selected = selectFacetAwareResults(rankings, combined, Math.max(1, Number(k) || 5));
  console.info(`[Perf][Hybrid] facet_selection_ms=${Math.round(performance.now() - selectionStartedAt)} selected=${selected.length}`);
  console.log('[Hybrid] Selected chunks:', selected.map((chunk) => ({
    chunkId: identity(chunk),
    page: chunk.metadata?.pageNumber ?? chunk.metadata?.page ?? chunk.metadata?.loc?.pageNumber ?? null,
    score: chunk.metadata?.rerankScore ?? null,
    multiQueryRrfScore: chunk.metadata?.multiQueryRrfScore ?? null,
    facetRanks: chunk.metadata?.facetRanks ?? [],
  })));
  console.log(`[Reranker] Selected ${selected.length} final chunks using ${facets.length} query facet(s)`);
  return selected;
}
