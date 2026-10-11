import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { initDatabase } from '../config/database.js';
import { ingestionWorker } from '../lib/ingestionWorker.js';

await initDatabase();

const workerId = ingestionWorker.getWorkerId();
console.log(`\n🚀 Ingestion Worker replica started: [${workerId}]`);
console.log(`   Durable Queue: PostgreSQL (ingestion_jobs) with SELECT ... FOR UPDATE SKIP LOCKED`);
console.log(`   Listening for ingestion jobs...\n`);

ingestionWorker.startWorker({
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS || 1500),
  workerId,
});

process.on('SIGINT', async () => {
  console.log(`\nShutting down worker [${workerId}] gracefully...`);
  await ingestionWorker.stopWorker();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(`\nWorker [${workerId}] terminated.`);
  await ingestionWorker.stopWorker();
  process.exit(0);
});
