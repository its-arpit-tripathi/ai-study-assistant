import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbeddings } from "./embeddings.js";
import { wrapQdrantError, isDimensionMismatch, qdrantConfigured } from "./qdrant.js";
import { searchBM25, hybridRerank } from "./hybridSearch.js";

let client = null;
const vectorStoreCache = new Map();

/** Evict a cached vector store instance from memory. */
export function evictVectorStoreCache(collectionName) {
  if (collectionName) vectorStoreCache.delete(collectionName);
}

/** Obtain or reuse a cached QdrantVectorStore instance. */
async function getVectorStore(collectionName, embeddings) {
  let store = vectorStoreCache.get(collectionName);
  if (!store) {
    store = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      { client: getClient(), collectionName }
    );
    vectorStoreCache.set(collectionName, store);
  }
  return store;
}

/** One shared Qdrant client for the process. */
function getClient() {
  if (!client) {
    client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      // The client/server version handshake is an extra round-trip that only
      // produces a noisy "Failed to obtain server version" log when the
      // cluster is down; the real error is reported by wrapQdrantError().
      checkCompatibility: false,
    });
  }
  return client;
}

/**
 * Index document chunks into Qdrant Cloud.
 * Creates a new collection (named after the document) sized to whatever the
 * configured embedding model produces, and stores the embeddings.
 *
 * @param {Array} chunks - LangChain Document objects from the document processor
 * @param {string} collectionName - Unique collection name (derived from filename)
 * @returns {Promise<void>}
 */
export async function indexDocument(chunks, collectionName) {
  const embeddings = await getEmbeddings();

  try {
    await QdrantVectorStore.fromDocuments(chunks, embeddings, { client: getClient(), collectionName });
    evictVectorStoreCache(collectionName);
  } catch (error) {
    throw wrapQdrantError(error);
  }

  console.log(`✅ Indexed ${chunks.length} chunks into collection "${collectionName}"`);
}

/**
 * Retrieve the most relevant chunks for a user query via similarity search.
 *
 * @param {string} query - The user's natural language question
 * @param {string} collectionName - The Qdrant collection to search
 * @param {number} k - Number of top results to return (default: 4)
 * @returns {Promise<Array>} Array of relevant Document objects
 */

export async function retrieveContext(query, collectionName, k = 5, scope = {}) {
  const startTime = performance.now();
  const embeddingSetupStartedAt = performance.now();
  const embeddings = await getEmbeddings();
  console.info(`[Perf][Retrieval] embedding_model_ready_ms=${Math.round(performance.now() - embeddingSetupStartedAt)}`);


  // 1 + 2. Run vector and lexical retrieval concurrently. Vector search remains
  // mandatory; BM25 is best-effort so a temporary keyword-index failure does not
  // prevent otherwise useful answers.
  const vectorStartedAt = performance.now();
  const bm25StartedAt = performance.now();
  const vectorPromise = (async () => {
    try {
      const vectorStore = await getVectorStore(collectionName, embeddings);
      const results = await vectorStore.asRetriever({ k: Number(process.env.VECTOR_CANDIDATES || 20) }).invoke(query);
      console.log(`[Vector] Retrieved ${results.length} candidates`);
      console.info(`[Perf][Retrieval] qdrant_vector_search_ms=${Math.round(performance.now() - vectorStartedAt)}`);
      return results;
    } catch (error) {
      if (isDimensionMismatch(error)) {
        throw new Error(
          "This document was indexed with a different embedding model. " +
          "Delete it and upload it again."
        );
      }
      throw wrapQdrantError(error);
    }
  })();

  const bm25Promise = (async () => {
    try {
      const results = await searchBM25(query, {
        userId: scope.userId,
        documentId: scope.documentId,
        limit: Number(process.env.BM25_CANDIDATES || 30),
      });
      console.log(`[BM25] Retrieved ${results.length} candidates`);
      console.info(`[Perf][Retrieval] bm25_search_ms=${Math.round(performance.now() - bm25StartedAt)}`);
      return results;
    } catch (error) {
      console.error("[BM25] Search failed:", error.message);
      return [];
    }
  })();

  const [vectorResults, keywordResults] = await Promise.all([vectorPromise, bm25Promise]);

  // 3. Reciprocal Rank Fusion + reranking
  const rerankStartedAt = performance.now();
  const results = await hybridRerank(
    query,
    vectorResults,
    keywordResults,
    k
  );
  console.info(`[Perf][Retrieval] rrf_rerank_selection_ms=${Math.round(performance.now() - rerankStartedAt)}`);

  // 4. Diagnostics
  console.log(
    `[Hybrid] Vector=${vectorResults.length}, ` +
    `BM25=${keywordResults.length}, ` +
    `final=${results.length}`
  );

  console.log(
    `[Hybrid] Total retrieval time=${Math.round(performance.now() - startTime)}ms`
  );


  console.log(
    "[Hybrid] Selected chunks:",
    results.map((chunk) => ({
      chunkId: chunk.metadata?.chunkId,
      page:
        chunk.metadata?.pageNumber ??
        chunk.metadata?.page ??
        chunk.metadata?.loc?.pageNumber ??
        null,
      methods: chunk.metadata?.retrievalMethods ?? [],
      rrfScore: chunk.metadata?.rrfScore ?? null,
      rerankScore: chunk.metadata?.rerankScore ?? null,
      reranker: chunk.metadata?.reranker ?? null,
      metadataKeys: Object.keys(chunk.metadata || {}),
    }))
  );

  return results;
}


/**
 * Lightweight keep-alive / health check against Qdrant.
 *
 * Any request counts as "activity", so hitting this on a schedule (e.g. every
 * few days from an uptime monitor) resets Qdrant's free-tier inactivity timer.
 * Free clusters are suspended after 1 week idle and permanently deleted after
 * 4 weeks idle — this ping keeps the cluster from ever reaching that state.
 *
 * @returns {Promise<{ok: boolean, status: number, collections?: number, error?: string}>}
 */
export async function pingQdrant() {
  if (!qdrantConfigured()) {
    return { ok: false, status: 0, error: "QDRANT_URL / QDRANT_API_KEY not set." };
  }

  try {
    const response = await fetch(`${process.env.QDRANT_URL}/collections`, {
      headers: { "api-key": process.env.QDRANT_API_KEY },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { ok: false, status: response.status, error: `${response.status} ${response.statusText}` };
    }

    const data = await response.json();
    return {
      ok: true,
      status: response.status,
      collections: data?.result?.collections?.length ?? 0,
    };
  } catch (error) {
    return { ok: false, status: 0, error: wrapQdrantError(error).message };
  }
}

/**
 * Delete a Qdrant collection (when user removes a document).
 *
 * @param {string} collectionName - The collection to delete
 * @returns {Promise<void>}
 */
export async function deleteCollection(collectionName) {
  let response;
  try {
    response = await fetch(`${process.env.QDRANT_URL}/collections/${collectionName}`, {
      method: "DELETE",
      headers: { "api-key": process.env.QDRANT_API_KEY },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw wrapQdrantError(error);
  }

  // 404 means it is already gone — treat as success so the registry entry can
  // still be cleaned up.
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete collection "${collectionName}": ${response.status} ${response.statusText}`);
  }

  evictVectorStoreCache(collectionName);
  console.log(`🗑️ Deleted collection "${collectionName}"`);
}
