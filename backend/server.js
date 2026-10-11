import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load backend .env
dotenv.config({ path: path.join(__dirname, '.env') });

import { initDatabase } from './config/database.js';
import { UserModel } from './models/UserModel.js';
import apiRouter from './routes/index.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { embeddingInfo, warmUpEmbeddings } from './lib/embeddings.js';
import { getGroqModel } from './lib/llm.js';
import { pingQdrant } from './lib/vectorStore.js';
import { qdrantHost } from './lib/qdrant.js';
import { storage } from './lib/storage.js';
import { ingestionWorker } from './lib/ingestionWorker.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy hops (Render, Cloudflare, AWS, etc.)
app.set('trust proxy', 1);

// Security & Body parsing
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '100kb' }));

// Static file resolution (serves compiled React frontend from frontend/dist)
const frontendDist = path.join(__dirname, '../frontend/dist');
const localPublic = path.join(__dirname, 'public');

let staticDir = localPublic;
try {
  const stat = await fs.stat(frontendDist);
  if (stat.isDirectory()) staticDir = frontendDist;
} catch {
  // Fallback to local public if dist not yet compiled
}
app.use(express.static(staticDir));

// Mount API routes with global rate limiting
app.use('/api', apiLimiter, apiRouter);

// SPA client routing fallback (serve React index.html for non-API GET routes)
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  const indexHtml = path.join(staticDir, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) next();
  });
});

// Centralized error handling
app.use(errorHandler);

// Validate authentication configuration
UserModel.validateConfig();

// Initialize database schema and start server
await initDatabase();

// Start background ingestion worker
if (process.env.RUN_INLINE_WORKER !== 'false') {
  ingestionWorker.startWorker({
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS || 1500),
  });
}

app.listen(PORT, () => {
  const emb = embeddingInfo();
  console.log(`\n🚀 NotebookLM RAG Server running at http://localhost:${PORT}`);
  console.log(`   Architecture: MVC (Models · Views · Controllers · Routes)`);
  console.log(`   LLM:          Groq · ${getGroqModel()} ${process.env.GROQ_API_KEY ? '' : '· ⚠️  GROQ_API_KEY not set'}`);
  console.log(`   Embeddings:   ${emb.provider} · ${emb.model}`);
  console.log(`   Vector DB:    Qdrant · ${qdrantHost()}`);
  console.log(`   Object Store: ${storage.getProviderName()}`);
  console.log(`   Worker Queue: ${process.env.RUN_INLINE_WORKER !== 'false' ? 'inline background worker active' : 'external workers only'}\n`);

  pingQdrant().then((q) => {
    if (!q.ok) console.warn(`⚠️  Qdrant check failed: ${q.error}\n`);
  });
  warmUpEmbeddings().catch((err) => {
    console.warn(`⚠️  Could not load embedding model: ${err.message}`);
  });
});

export default app;
