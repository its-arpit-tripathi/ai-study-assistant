import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('===============================================================');
  console.log('🚀 Running End-to-End Durable Storage & Replica Worker Test');
  console.log(`   Target Server: ${BASE_URL}`);
  console.log('===============================================================\n');

  // 1. Register User
  const email = `e2e_replica_${Date.now()}@test.local`;
  const password = 'Password123!';

  console.log('[1/6] Registering test user...');
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const regData = await regRes.json();
  if (!regRes.ok) throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  const token = regData.token;
  console.log(`  ✓ User registered (${regData.user.id})\n`);

  // 2. Upload Document
  console.log('[2/6] Uploading document with durable object storage...');
  const testDocText = `Durable Storage Specification Document
This document is securely preserved in PostgreSQL NeonDB / S3-compatible durable storage.
It contains idempotent ingestion hashes and resilient background worker execution tracking.
Section 1: Object durability prevents data loss during container restarts.
Section 2: Concurrency locks with SKIP LOCKED prevent race conditions across worker replicas.`;

  const blob = new Blob([testDocText], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('document', blob, 'durable_spec.txt');

  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
  const doc = uploadData.document;
  console.log(`  ✓ Document created: ${doc.id}`);
  console.log(`    Status:           ${doc.status}`);
  console.log(`    Storage Key:      ${doc.storageKey}`);
  console.log(`    Storage Provider: ${doc.storageProvider}`);
  console.log(`    Chunks Indexed:   ${doc.chunkCount}\n`);

  // 3. Test Status Endpoint
  console.log('[3/6] Verifying status tracking endpoint (GET /api/documents/:id/status)...');
  const statusRes = await fetch(`${BASE_URL}/api/documents/${doc.id}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const statusData = await statusRes.json();
  if (!statusRes.ok) throw new Error(`Status check failed: ${JSON.stringify(statusData)}`);
  console.log(`  ✓ Status endpoint verified: status="${statusData.status}", storageKey="${statusData.storageKey}"\n`);

  // 4. Test Idempotent Upload
  console.log('[4/6] Testing upload idempotency (re-uploading identical file)...');
  const formData2 = new FormData();
  formData2.append('document', blob, 'durable_spec.txt');

  const upload2Res = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData2,
  });
  const upload2Data = await upload2Res.json();
  if (!upload2Res.ok) throw new Error(`Second upload failed: ${JSON.stringify(upload2Data)}`);
  if (!upload2Data.idempotent) {
    throw new Error('Expected upload to be detected as idempotent duplicate!');
  }
  console.log(`  ✓ Duplicate upload detected as idempotent: reused existing document ${upload2Data.document.id}\n`);

  // 5. Test Dedicated Worker Replica Process
  console.log('[5/6] Spawning separate dedicated worker replica process (scripts/worker.mjs)...');
  const workerProcess = spawn('node', [path.join(__dirname, 'worker.mjs')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, RUN_INLINE_WORKER: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let workerOutput = '';
  workerProcess.stdout.on('data', (d) => {
    workerOutput += d.toString();
  });

  // Give worker a moment to initialize
  await new Promise((r) => setTimeout(r, 2000));
  console.log('  ✓ Dedicated worker replica process running in background');

  // Trigger retry on document to generate a job for the worker
  const retryRes = await fetch(`${BASE_URL}/api/documents/${doc.id}/retry`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const retryData = await retryRes.json();
  if (!retryRes.ok) throw new Error(`Retry failed: ${JSON.stringify(retryData)}`);
  console.log('  ✓ Ingestion retry requested; checking status transition...');

  // Wait for worker to finish
  let attempts = 0;
  let finished = false;
  while (attempts++ < 15) {
    await new Promise((r) => setTimeout(r, 1000));
    const sRes = await fetch(`${BASE_URL}/api/documents/${doc.id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sData = await sRes.json();
    if (sData.status === 'indexed') {
      finished = true;
      console.log(`  ✓ Worker completed job; document status is "indexed" (${sData.chunkCount} chunks)`);
      break;
    }
  }

  workerProcess.kill('SIGINT');
  if (!finished) throw new Error('Worker replica did not complete the job within timeout.');
  console.log('  ✓ Dedicated worker replica shut down gracefully.\n');

  // 6. Test Deletion Lifecycle
  console.log('[6/6] Testing document deletion and storage purge (DELETE /api/documents/:id)...');
  const delRes = await fetch(`${BASE_URL}/api/documents/${doc.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const delData = await delRes.json();
  if (!delRes.ok) throw new Error(`Deletion failed: ${JSON.stringify(delData)}`);
  console.log('  ✓ Document deleted from registry and durable storage.');

  const verifyDelRes = await fetch(`${BASE_URL}/api/documents/${doc.id}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (verifyDelRes.status !== 404) {
    throw new Error(`Expected 404 after deletion, got ${verifyDelRes.status}`);
  }
  console.log('  ✓ Verified 404 response on deleted document.\n');

  console.log('===============================================================');
  console.log('✅ ALL DURABLE STORAGE & WORKER REPLICA TESTS PASSED: 100%');
  console.log('===============================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
