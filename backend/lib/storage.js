import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localUploadsDir = path.join(__dirname, '../uploads');

// Ensure local uploads directory exists
await fs.mkdir(localUploadsDir, { recursive: true }).catch(() => {});

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3;
  const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || (endpoint ? 'notebooklm-docs' : null);
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true' || Boolean(endpoint);

  if (bucket && accessKeyId && secretAccessKey) {
    return {
      bucket,
      accessKeyId,
      secretAccessKey,
      region,
      endpoint,
      forcePathStyle,
    };
  }
  return null;
}

/**
 * AWS Signature Version 4 Request Signer (Pure Node.js built-in)
 */
function signS3Request({ method, url, headers = {}, body = Buffer.alloc(0), config }) {
  const parsedUrl = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = crypto.createHash('sha256').update(body).digest('hex');

  const requestHeaders = {
    ...headers,
    host: parsedUrl.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };

  const signedHeaders = Object.keys(requestHeaders)
    .map((k) => k.toLowerCase())
    .sort()
    .join(';');

  const canonicalHeaders = Object.keys(requestHeaders)
    .map((k) => k.toLowerCase())
    .sort()
    .map((k) => `${k}:${String(requestHeaders[k]).trim()}\n`)
    .join('');

  const canonicalRequest = [
    method.toUpperCase(),
    parsedUrl.pathname,
    parsedUrl.search.replace(/^\?/, ''),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
  const kDate = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  requestHeaders['authorization'] = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return requestHeaders;
}

export const storage = {
  getProviderName() {
    if (getS3Config()) return 's3';
    if (process.env.STORAGE_PROVIDER === 'postgres' || process.env.DATABASE_URL) return 'postgres';
    return 'local';
  },

  /**
   * Put Object into Durable Storage (S3, PostgreSQL NeonDB, or Local disk)
   */
  async putObject({ key, userId, buffer, contentType = 'application/octet-stream' }) {
    const s3Config = getS3Config();

    if (s3Config) {
      // 1. S3 / R2 / MinIO Compatible Storage
      const baseUrl = s3Config.endpoint
        ? (s3Config.forcePathStyle ? `${s3Config.endpoint}/${s3Config.bucket}` : `${s3Config.endpoint}`)
        : `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com`;
      const safeKey = key.split('/').map(encodeURIComponent).join('/');
      const url = `${baseUrl}/${safeKey}`;

      const signedHeaders = signS3Request({
        method: 'PUT',
        url,
        headers: {
          'content-type': contentType,
        },
        body: buffer,
        config: s3Config,
      });

      const res = await fetch(url, {
        method: 'PUT',
        headers: signedHeaders,
        body: buffer,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`S3 PUT failed with status ${res.status}: ${text}`);
      }

      return { key, provider: 's3', sizeBytes: buffer.length };
    }

    if (this.getProviderName() === 'postgres') {
      // 2. PostgreSQL NeonDB Durable Object Storage
      const db = getPool();
      await db.query(
        `INSERT INTO document_objects (storage_key, user_id, data, content_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (storage_key)
         DO UPDATE SET data = EXCLUDED.data, content_type = EXCLUDED.content_type, size_bytes = EXCLUDED.size_bytes`,
        [key, userId, buffer, contentType, buffer.length]
      );

      // Also maintain local copy for fast zero-latency caching
      const localPath = path.join(localUploadsDir, path.basename(key));
      await fs.writeFile(localPath, buffer).catch(() => {});

      return { key, provider: 'postgres', sizeBytes: buffer.length };
    }

    // 3. Local Disk Storage
    const localPath = path.join(localUploadsDir, path.basename(key));
    await fs.writeFile(localPath, buffer);
    return { key, provider: 'local', sizeBytes: buffer.length };
  },

  /**
   * Get Object Buffer from Durable Storage
   */
  async getObject({ key }) {
    const s3Config = getS3Config();

    if (s3Config) {
      const baseUrl = s3Config.endpoint
        ? (s3Config.forcePathStyle ? `${s3Config.endpoint}/${s3Config.bucket}` : `${s3Config.endpoint}`)
        : `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com`;
      const safeKey = key.split('/').map(encodeURIComponent).join('/');
      const url = `${baseUrl}/${safeKey}`;

      const signedHeaders = signS3Request({
        method: 'GET',
        url,
        config: s3Config,
      });

      const res = await fetch(url, { method: 'GET', headers: signedHeaders });
      if (!res.ok) {
        throw new Error(`S3 GET failed with status ${res.status}`);
      }
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    }

    if (this.getProviderName() === 'postgres') {
      // Check local cache first for optimal speed
      const localPath = path.join(localUploadsDir, path.basename(key));
      try {
        return await fs.readFile(localPath);
      } catch {
        // Fetch from Postgres NeonDB durable object storage
        const db = getPool();
        const { rows } = await db.query(
          `SELECT data FROM document_objects WHERE storage_key = $1`,
          [key]
        );
        if (!rows[0]) throw new Error(`Object not found in PostgreSQL storage: ${key}`);
        const buf = rows[0].data;
        // Warm local cache
        await fs.writeFile(localPath, buf).catch(() => {});
        return buf;
      }
    }

    // Local Disk
    const localPath = path.join(localUploadsDir, path.basename(key));
    return await fs.readFile(localPath);
  },

  /**
   * Delete Object from Durable Storage
   */
  async deleteObject({ key }) {
    const s3Config = getS3Config();

    if (s3Config) {
      const baseUrl = s3Config.endpoint
        ? (s3Config.forcePathStyle ? `${s3Config.endpoint}/${s3Config.bucket}` : `${s3Config.endpoint}`)
        : `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com`;
      const safeKey = key.split('/').map(encodeURIComponent).join('/');
      const url = `${baseUrl}/${safeKey}`;

      const signedHeaders = signS3Request({
        method: 'DELETE',
        url,
        config: s3Config,
      });

      await fetch(url, { method: 'DELETE', headers: signedHeaders }).catch(() => {});
    }

    if (this.getProviderName() === 'postgres') {
      const db = getPool();
      await db.query(`DELETE FROM document_objects WHERE storage_key = $1`, [key]).catch(() => {});
    }

    // Clean up local disk cache as well
    const localPath = path.join(localUploadsDir, path.basename(key));
    await fs.unlink(localPath).catch(() => {});
  },

  /**
   * Check object existence and metadata
   */
  async headObject({ key }) {
    try {
      const buf = await this.getObject({ key });
      return { exists: true, size: buf.length };
    } catch {
      return { exists: false, size: 0 };
    }
  },
};
