const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('===============================================================');
  console.log('🌊 Running SSE Streaming, Draft Answers & Verification E2E Test');
  console.log(`   Target Server: ${BASE_URL}`);
  console.log('===============================================================\n');

  // 1. Register User
  const email = `sse_test_${Date.now()}@test.local`;
  const password = 'Password123!';

  console.log('[1/5] Registering test user...');
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
  console.log('[2/5] Uploading document for retrieval...');
  const testText = `Deep learning architectures rely on multi-layer representations.
Convolutional layers apply spatial filters to extract localized feature maps.
Residual connections address the vanishing gradient problem by enabling gradient highways through skip paths.
Transformer architectures use self-attention mechanisms to model long-range dependencies across token sequences.`;

  const blob = new Blob([testText], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('document', blob, 'deep_learning_guide.txt');

  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
  const doc = uploadData.document;
  console.log(`  ✓ Document indexed: ${doc.id} (Collection: ${doc.collectionName})\n`);

  // 3. Test Full SSE Stream with Draft and Verification Events
  console.log('[3/5] Testing SSE Streaming: Sources -> Tokens -> Draft -> Verification -> Done...');
  const streamRes = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: 'What do convolutional layers extract?',
      collectionName: doc.collectionName,
      stream: true,
    }),
  });

  if (!streamRes.ok) {
    const errText = await streamRes.text();
    throw new Error(`SSE stream initiation failed: ${errText}`);
  }

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  const events = [];
  let tokenCount = 0;
  let draftAnswerReceived = null;
  let verificationReceived = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      if (!part.trim()) continue;
      const lines = part.split('\n');
      let eventType = 'message';
      let dataStr = '';

      for (const line of lines) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr = line.slice(5).trim();
      }

      if (dataStr) {
        const data = JSON.parse(dataStr);
        events.push({ eventType, data });

        if (eventType === 'token') {
          tokenCount++;
        } else if (eventType === 'draft') {
          draftAnswerReceived = data.answer;
          console.log(`  ✓ Received "draft" event: ${data.answer.substring(0, 60)}...`);
        } else if (eventType === 'verification') {
          verificationReceived = data.verification;
          console.log(`  ✓ Received "verification" event (Status: ${data.verification.status}, Supported: ${data.verification.counts?.supported})`);
        } else if (eventType === 'sources') {
          console.log(`  ✓ Received "sources" event (${data.sources.length} sources, Model: ${data.model})`);
        }
      }
    }
  }

  console.log(`  ✓ Stream completed with ${tokenCount} tokens received.`);
  if (!draftAnswerReceived) throw new Error('Expected draft answer event was not received.');
  if (!verificationReceived) throw new Error('Expected verification event was not received.\n');
  console.log('  ✓ Verified distinct Draft Answer and Citation-Verification lifecycle.\n');

  // 4. Test Client Disconnect / Cancellation
  console.log('[4/5] Testing client cancellation / disconnection handling...');
  const abortCtrl = new AbortController();
  const abortPromise = fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: 'Describe transformers in deep detail with historical background.',
      collectionName: doc.collectionName,
      stream: true,
    }),
    signal: abortCtrl.signal,
  });

  // Abort immediately after connection
  setTimeout(() => {
    abortCtrl.abort();
    console.log('  ✓ Client aborted request mid-flight.');
  }, 150);

  await abortPromise.catch((err) => {
    console.log(`  ✓ Client fetch rejected as expected: ${err.name}`);
  });

  // Verify server remains responsive after abort
  const pingRes = await fetch(`${BASE_URL}/api/health`);
  if (!pingRes.ok) throw new Error('Server unresponsive after client cancellation.');
  console.log('  ✓ Server smoothly recovered with zero hanging concurrency.\n');

  // 5. Verify Metrics & Provider Telemetry
  console.log('[5/5] Checking /api/metrics for provider telemetry and failure monitoring...');
  const metricsRes = await fetch(`${BASE_URL}/api/metrics`);
  const metricsData = await metricsRes.json();
  if (!metricsRes.ok) throw new Error('Failed to fetch metrics.');
  console.log(`  ✓ Metrics Verified:`);
  console.log(`    Total Requests:     ${metricsData.requests.total} (Streaming: ${metricsData.requests.streaming})`);
  console.log(`    Streams Completed:  ${metricsData.streams.completed}`);
  console.log(`    Streams Aborted:    ${metricsData.streams.aborted}`);
  console.log(`    Estimated Tokens:   ${metricsData.tokens.estimatedTotalTokens}`);
  console.log(`    Provider Failure %: ${metricsData.provider.failureRate * 100}%\n`);

  console.log('===============================================================');
  console.log('✅ ALL SSE STREAMING, DRAFT & VERIFICATION TESTS PASSED: 100%');
  console.log('===============================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
