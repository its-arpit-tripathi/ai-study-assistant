import 'dotenv/config';
import { performance } from 'perf_hooks';
import { getPool } from '../config/database.js';
import { retrieveContext } from '../lib/vectorStore.js';
import { streamAnswer } from '../lib/llm.js';
import { chatHistory } from '../lib/chatHistory.js';
import { evaluateGuardrails } from '../lib/guardrails.js';

async function runBenchmark() {
  console.log('='.repeat(70));
  console.log('🚀 RUNNING PRODUCTION RAG SYSTEM BENCHMARK FOR INTERVIEW METRICS');
  console.log('='.repeat(70));

  // 1. Fetch real document from Neon DB
  const pool = getPool();
  const docRes = await pool.query('SELECT id, name, user_id, collection_name FROM documents LIMIT 1');
  if (docRes.rows.length === 0) {
    console.error('No indexed documents found in database.');
    process.exit(1);
  }

  const doc = docRes.rows[0];
  console.log(`\n📄 Testing Document: "${doc.name}"`);
  console.log(`   Document ID: ${doc.id}`);
  console.log(`   Collection: ${doc.collection_name}`);

  const testQuestion = "What are the main objectives, methods, and key findings discussed in this paper?";
  console.log(`\n❓ Query: "${testQuestion}"`);

  // 2. Guardrails latency
  const guardStart = performance.now();
  const guardResult = evaluateGuardrails(testQuestion);
  const guardMs = (performance.now() - guardStart).toFixed(2);
  console.log(`🛡️  Input Guardrails: ${guardMs}ms (Allowed: ${guardResult.allowed})`);

  // 3. Retrieval latency (Dense + Sparse + RRF + Cross-Encoder)
  console.log('\n🔍 Executing Hybrid Retrieval (Dense k=30, BM25 k=30, Top-7)...');
  const retStart = performance.now();
  const chunks = await retrieveContext(testQuestion, doc.collection_name, 7, {
    userId: doc.user_id,
    documentId: doc.id,
  });
  const retMs = Math.round(performance.now() - retStart);
  console.log(`✅ Retrieved ${chunks.length} ranked context chunks in ${retMs}ms`);

  // Calculate approximate retrieved context size
  const totalContextChars = chunks.reduce((acc, c) => acc + (c.pageContent?.length || 0), 0);
  const estimatedContextTokens = Math.round(totalContextChars / 4);
  console.log(`   Retrieved Context Size: ${totalContextChars} chars (~${estimatedContextTokens} tokens)`);

  // 4. LLM Streaming & Token Telemetry
  console.log('\n⚡ Streaming LLM Generation with Groq (qwen/qwen3.8-27b)...');
  let firstTokenLogged = false;
  let tokenCount = 0;
  let streamedText = '';

  const streamStart = performance.now();
  let firstTokenMs = null;

  const result = await streamAnswer(
    testQuestion,
    chunks,
    (token) => {
      if (!firstTokenLogged) {
        firstTokenMs = Math.round(performance.now() - streamStart);
        firstTokenLogged = true;
      }
      tokenCount++;
      streamedText += token;
    },
    null,
    {
      onDraft: () => {},
      onVerificationProgress: () => {},
    }
  );

  const totalStreamDurationMs = Math.round(performance.now() - streamStart);

  // 5. Redis Chat History Persistence
  console.log('\n💾 Testing Upstash Redis Storage Latency...');
  const redisStart = performance.now();
  await chatHistory.saveMessage(doc.user_id, doc.id, {
    id: `bench-${Date.now()}`,
    role: 'assistant',
    content: result.answer,
    sources: result.sources,
    verification: result.verification,
    model: result.model,
    usage: result.usage,
    timestamp: new Date().toISOString(),
  });
  const redisMs = Math.round(performance.now() - redisStart);
  console.log(`✅ Upstash Redis + PostgreSQL Dual-Write: ${redisMs}ms`);

  // 6. Comprehensive Results
  console.log('\n' + '='.repeat(70));
  console.log('📊 EMPIRICAL SYSTEM BENCHMARK & INTERVIEW PARAMETERS SUMMARY');
  console.log('='.repeat(70));
  console.log(`• Model:                        ${result.model}`);
  console.log(`• Prompt / Input Tokens:        ${result.usage?.promptTokens}`);
  console.log(`• Completion / Output Tokens:   ${result.usage?.completionTokens}`);
  console.log(`• Total Tokens:                 ${result.usage?.totalTokens}`);
  console.log(`• Generation Speed:             ${result.usage?.tokensPerSec} tokens/second`);
  console.log(`• TTFT (Time To First Token):   ${result.usage?.ttftMs} ms`);
  console.log(`• Hybrid Retrieval Latency:     ${retMs} ms`);
  console.log(`• Citation Verification:        ${result.usage?.verificationMs} ms (Status: ${result.verification?.status})`);
  console.log(`• Verification Support Counts:  ${result.verification?.counts?.supported || 0} supported, ${result.verification?.counts?.uncertain || 0} uncertain, ${result.verification?.counts?.unsupported || 0} unsupported`);
  console.log(`• Upstash Redis Roundtrip:      ${redisMs} ms`);
  console.log(`• End-to-End Stream Duration:   ${totalStreamDurationMs} ms`);
  console.log('='.repeat(70));

  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
