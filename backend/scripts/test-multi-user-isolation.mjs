// Multi-User Tenant Isolation Security Verification
// Asserts that User B cannot read, query, stream, or delete User A's documents.

import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function registerUser(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 201, `Failed to register ${email}: ${res.status}`);
  const data = await res.json();
  return { token: data.token, user: data.user };
}

async function uploadDoc(token, filename, content) {
  const boundary = `----Boundary${Date.now()}`;
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n${content}\r\n--${boundary}--\r\n`;

  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  assert.equal(res.status, 200, `Upload failed: status ${res.status}`);
  const data = await res.json();
  return data.document;
}

async function runSecurityAudit() {
  console.log('\n======================================================');
  console.log('🔒 Running Multi-User Tenant Isolation Security Tests');
  console.log(`   Target Server: ${BASE_URL}`);
  console.log('======================================================\n');

  const now = Date.now();
  const userAEmail = `tenant_a_${now}@security-test.local`;
  const userBEmail = `tenant_b_${now}@security-test.local`;
  const password = `TestPassword_123!_${now}`;

  // 1. Create User A and User B
  console.log('[1/7] Registering User A and User B...');
  const userA = await registerUser(userAEmail, password);
  const userB = await registerUser(userBEmail, password);
  console.log(`  ✓ User A registered: ${userA.user.id} (${userAEmail})`);
  console.log(`  ✓ User B registered: ${userB.user.id} (${userBEmail})`);

  // 2. User A uploads a private document
  console.log('\n[2/7] User A uploads confidential document...');
  const secretContent = 'Project Chimera top secret design specifications: proprietary neural core architecture 99.8% precision.';
  const docA = await uploadDoc(userA.token, 'confidential_project_chimera.txt', secretContent);
  console.log(`  ✓ User A created Document: ${docA.id} (Collection: ${docA.collectionName})`);

  // 3. Test: User B cannot see User A's document in list
  console.log('\n[3/7] Testing Document Listing Isolation (GET /api/documents)...');
  const userBDocsRes = await fetch(`${BASE_URL}/api/documents`, {
    headers: { Authorization: `Bearer ${userB.token}` },
  });
  assert.equal(userBDocsRes.status, 200);
  const userBDocs = await userBDocsRes.json();
  const leakedInList = userBDocs.some((d) => d.id === docA.id || d.collectionName === docA.collectionName);
  assert.equal(leakedInList, false, "CRITICAL: User A's document appeared in User B's document list!");
  console.log(`  ✓ User B cannot view User A's document in document list.`);

  // 4. Test: User B cannot stream/read User A's file
  console.log('\n[4/7] Testing File Read Isolation (GET /api/documents/:id/file)...');
  const userBFileRes = await fetch(`${BASE_URL}/api/documents/${docA.id}/file`, {
    headers: { Authorization: `Bearer ${userB.token}` },
  });
  assert.ok(
    [403, 404].includes(userBFileRes.status),
    `CRITICAL: User B accessed User A's document file! Status: ${userBFileRes.status}`
  );
  console.log(`  ✓ User B file read rejected with status ${userBFileRes.status}.`);

  // 5. Test: User B cannot query User A's collection via Chat
  console.log('\n[5/7] Testing Retrieval & Chat Query Isolation (POST /api/chat)...');
  const userBChatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userB.token}`,
    },
    body: JSON.stringify({
      query: 'What are the top secret specifications?',
      collectionName: docA.collectionName,
    }),
  });
  assert.equal(
    userBChatRes.status,
    403,
    `CRITICAL: User B was allowed to query User A's collection! Expected 403, got ${userBChatRes.status}`
  );
  const userBChatErr = await userBChatRes.json();
  assert.ok(userBChatErr.error.includes('Unauthorized'), 'Expected unauthorized error message');
  console.log(`  ✓ User B query rejected with 403: "${userBChatErr.error}"`);

  // 6. Test: User B cannot delete User A's document
  console.log('\n[6/7] Testing Document Deletion Isolation (DELETE /api/documents/:id)...');
  const userBDeleteRes = await fetch(`${BASE_URL}/api/documents/${docA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userB.token}` },
  });
  assert.equal(
    userBDeleteRes.status,
    404,
    `CRITICAL: User B delete attempt returned unexpected status: ${userBDeleteRes.status}`
  );

  // Verify User A's document is still intact
  const userACheckRes = await fetch(`${BASE_URL}/api/documents`, {
    headers: { Authorization: `Bearer ${userA.token}` },
  });
  const userADocs = await userACheckRes.json();
  const stillExists = userADocs.some((d) => d.id === docA.id);
  assert.equal(stillExists, true, "CRITICAL: User A's document was deleted or modified by User B's unauthorized request!");
  console.log(`  ✓ User B deletion rejected with 404; User A's document remains intact.`);

  // 7. Clean up: User A can delete their own document
  console.log('\n[7/7] Verifying legitimate deletion by User A...');
  const userADeleteRes = await fetch(`${BASE_URL}/api/documents/${docA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userA.token}` },
  });
  assert.equal(userADeleteRes.status, 200, 'Owner deletion should return 200');
  console.log(`  ✓ Document successfully deleted by owner (User A).`);

  console.log('\n======================================================');
  console.log('✅ ALL TENANT ISOLATION TESTS PASSED: 100% SECURE');
  console.log('======================================================\n');
}

runSecurityAudit().catch((err) => {
  console.error('\n❌ TENANT ISOLATION AUDIT FAILED:', err);
  process.exit(1);
});
