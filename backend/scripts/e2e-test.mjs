// End-to-End Integration Test for NotebookLM RAG
// Validates: Auth, Health, Static Serving, Document Ingestion, Retrieval, Chat Synthesis, and Deletion

import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runE2ETests() {
  console.log(`\n========================================`);
  console.log(`🚀 Starting NotebookLM RAG End-to-End Test`);
  console.log(`   Target Server: ${BASE_URL}`);
  console.log(`========================================\n`);

  // Step 1: Health Check
  console.log('[E2E 1/8] Testing GET /api/health...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  assert.equal(healthRes.status, 200, 'Health check should return status 200');
  const healthData = await healthRes.json();
  assert.equal(healthData.status, 'ok', 'Health status should be ok');
  assert.equal(healthData.qdrant?.ok, true, 'Qdrant vector database should be connected');
  console.log(`  ✓ Health OK: Qdrant connected, LLM=${healthData.llm?.model}, Embeddings=${healthData.embeddings?.model}`);

  // Step 2: Static React App Serving
  console.log('\n[E2E 2/8] Testing GET / (React App index.html)...');
  const indexRes = await fetch(`${BASE_URL}/`);
  assert.equal(indexRes.status, 200, 'Root route should return status 200');
  const indexHtml = await indexRes.text();
  assert.ok(indexHtml.includes('<div id="root">'), 'Served HTML should contain React root div');
  console.log('  ✓ React frontend successfully served by Express backend');

  // Step 3: User Registration & Authentication
  console.log('\n[E2E 3/8] Testing Authentication Flow (POST /api/auth/register)...');
  const testEmail = `e2e_user_${Date.now()}@example.com`;
  const testPassword = `SecurePassword_${Date.now()}`;

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  assert.equal(regRes.status, 201, 'Registration should return 201 Created');
  const regData = await regRes.json();
  assert.ok(regData.token, 'Registration should provide a JWT token');
  assert.equal(regData.user.email, testEmail, 'User email should match registration');
  const token = regData.token;
  console.log(`  ✓ Registered test user: ${testEmail}`);

  // Verify GET /api/auth/me
  console.log('  Verifying GET /api/auth/me with Bearer token...');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(meRes.status, 200, 'Me endpoint should return 200 with valid token');
  const meData = await meRes.json();
  assert.equal(meData.user.email, testEmail);
  console.log('  ✓ JWT verification succeeded');

  // Step 4: List Documents
  console.log('\n[E2E 4/8] Testing GET /api/documents...');
  const listRes = await fetch(`${BASE_URL}/api/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(listRes.status, 200);
  const docsList = await listRes.json();
  assert.ok(Array.isArray(docsList), 'Should return an array of documents');
  console.log(`  ✓ Initial document list retrieved (count: ${docsList.length})`);

  // Step 5: Document Upload & Indexing
  console.log('\n[E2E 5/8] Testing Document Upload (POST /api/upload)...');
  const sampleDocText = `
Quantum computing is a multidisciplinary field comprising aspects of computer science, physics, and mathematics.
It utilizes quantum mechanics principles such as superposition and entanglement to solve complex problems faster than classical computers.
Qubits are the basic unit of quantum information, analogous to classical binary bits.
Unlike classical bits which can only be 0 or 1, qubits can exist in a superposition of states simultaneously.
Quantum supremacy demonstrates that a programmable quantum device can solve a problem that no classical supercomputer can solve in any feasible amount of time.
  `.trim();

  const boundary = `----WebKitFormBoundary${Date.now()}`;
  const fileContent = `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="quantum_computing_overview.txt"\r\nContent-Type: text/plain\r\n\r\n${sampleDocText}\r\n--${boundary}--\r\n`;

  const uploadStart = performance.now();
  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${token}`,
    },
    body: fileContent,
  });

  assert.equal(uploadRes.status, 200, 'Upload should return status 200');
  const uploadData = await uploadRes.json();
  assert.equal(uploadData.success, true);
  assert.ok(uploadData.document?.id, 'Uploaded document must have an ID');
  assert.ok(uploadData.document?.chunkCount > 0, 'Document must have at least 1 indexed chunk');
  const doc = uploadData.document;
  const uploadMs = Math.round(performance.now() - uploadStart);
  console.log(`  ✓ Document "${doc.name}" processed & indexed in ${uploadMs}ms (chunks: ${doc.chunkCount})`);

  // Step 6: Pre-warm Document Cache
  console.log('\n[E2E 6/8] Testing POST /api/documents/:id/warm...');
  const warmRes = await fetch(`${BASE_URL}/api/documents/${doc.id}/warm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(warmRes.status, 200);
  const warmData = await warmRes.json();
  assert.equal(warmData.ok, true);
  console.log('  ✓ In-memory keyword corpus pre-warmed');

  // Step 7: Grounded Chat Generation & Verification
  console.log('\n[E2E 7/8] Testing Grounded Chat (POST /api/chat)...');
  const chatStart = performance.now();
  const chatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: 'What is superposition and how do qubits differ from classical bits?',
      collectionName: doc.collectionName,
    }),
  });

  assert.equal(chatRes.status, 200, 'Chat endpoint should return 200');
  const chatData = await chatRes.json();
  assert.ok(chatData.answer, 'Chat response must contain an answer');
  assert.ok(Array.isArray(chatData.sources), 'Chat response must contain sources array');
  assert.ok(chatData.sources.length > 0, 'Sources array must contain retrieved chunks');
  const chatMs = Math.round(performance.now() - chatStart);
  console.log(`  ✓ Grounded answer received in ${chatMs}ms with ${chatData.sources.length} sources`);
  console.log(`  Snippet: "${chatData.answer.slice(0, 140).replace(/\n/g, ' ')}..."`);

  // Step 8: Document Cleanup & Deletion
  console.log('\n[E2E 8/8] Testing Document Deletion (DELETE /api/documents/:id)...');
  const delRes = await fetch(`${BASE_URL}/api/documents/${doc.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(delRes.status, 200, 'Delete should return 200');
  const delData = await delRes.json();
  assert.equal(delData.success, true);
  console.log('  ✓ Document and Qdrant collection deleted successfully');

  console.log(`\n========================================`);
  console.log(`🎉 ALL 8 END-TO-END TESTS PASSED CLEANLY!`);
  console.log(`========================================\n`);
}

runE2ETests().catch((err) => {
  console.error('\n❌ End-to-End Test Failed:', err);
  process.exit(1);
});
