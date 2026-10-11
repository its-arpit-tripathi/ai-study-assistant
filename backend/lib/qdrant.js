/**
 * Shared helpers for talking to Qdrant and turning its low-level failures into
 * messages a user can act on.
 *
 * The most common failure in practice is not a bug at all: Qdrant Cloud
 * free-tier clusters are suspended after 1 week idle and permanently deleted
 * after 4 weeks idle. When that happens every request fails with a bare
 * "fetch failed" / ECONNRESET, which tells the user nothing.
 */

const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "CERT_HAS_EXPIRED",
]);

export class QdrantUnavailableError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = "QdrantUnavailableError";
    this.status = 503;
  }
}

export function qdrantConfigured() {
  return Boolean(process.env.QDRANT_URL && process.env.QDRANT_API_KEY);
}

export function qdrantHost() {
  try {
    return new URL(process.env.QDRANT_URL).host;
  } catch {
    return process.env.QDRANT_URL || "(QDRANT_URL not set)";
  }
}

function errorCode(error) {
  return error?.cause?.code || error?.code || error?.cause?.cause?.code || null;
}

function isNetworkFailure(error) {
  const code = errorCode(error);
  if (code && NETWORK_CODES.has(code)) return true;
  const msg = String(error?.message || "");
  return /fetch failed|Failed to parse URL|network error|socket hang up/i.test(msg);
}

/**
 * The Qdrant JS client throws ApiError with a generic message ("Bad Request")
 * and puts the real reason in error.data.status.error.
 */
export function qdrantErrorDetail(error) {
  const detail = error?.data?.status?.error;
  return typeof detail === "string" ? detail : null;
}

/**
 * Qdrant refuses a search whose query vector has a different size than the
 * collection. That happens when a document was indexed with a different
 * embedding model than the one currently configured.
 */
export function isDimensionMismatch(error) {
  const text = `${error?.message ?? ""} ${qdrantErrorDetail(error) ?? ""}`;
  return /dimension error|vector dimension|vector size/i.test(text);
}

/**
 * Convert a raw fetch / Qdrant client error into something actionable:
 * connectivity problems become QdrantUnavailableError (HTTP 503), client
 * ApiErrors get their real message, and anything else is returned unchanged
 * so real bugs still surface as-is.
 */
export function wrapQdrantError(error) {
  if (error instanceof QdrantUnavailableError) return error;

  if (!qdrantConfigured()) {
    return new QdrantUnavailableError(
      "QDRANT_URL / QDRANT_API_KEY are not set. Add them to your .env file (see .env.example).",
      error
    );
  }

  if (isNetworkFailure(error)) {
    const code = errorCode(error) || "network error";
    return new QdrantUnavailableError(
      `Cannot reach the Qdrant cluster at ${qdrantHost()} (${code}). ` +
        "Free-tier clusters are suspended after 1 week idle and deleted after 4 weeks idle. " +
        "Log in to https://cloud.qdrant.io, resume or re-create the cluster, then update " +
        "QDRANT_URL and QDRANT_API_KEY and restart the server.",
      error
    );
  }

  const status = error?.status ?? error?.response?.status;
  if (status === 401 || status === 403) {
    return new QdrantUnavailableError(
      `Qdrant rejected the API key for ${qdrantHost()} (HTTP ${status}). Check QDRANT_API_KEY.`,
      error
    );
  }

  // Surface the real reason instead of the client's generic "Bad Request".
  const detail = qdrantErrorDetail(error);
  if (detail) {
    return Object.assign(new Error(`Qdrant error: ${detail}`), { cause: error, status });
  }

  return error;
}
