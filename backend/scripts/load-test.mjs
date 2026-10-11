#!/usr/bin/env node
/**
 * Small dependency-free authenticated API load tester.
 * Start conservatively. This is not a substitute for k6/Artillery distributed
 * testing and should not be pointed at production without explicit approval.
 */
const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const token = process.env.AUTH_TOKEN;
const collectionName = process.env.COLLECTION_NAME;
const query = process.env.QUERY || 'Summarize the main points of this document.';
const vus = Math.max(1, Math.min(1000, Number(process.env.VUS || 5)));
const requests = Math.max(vus, Number(process.env.REQUESTS || 20));
if (!token || !collectionName) {
  console.error('Set AUTH_TOKEN and COLLECTION_NAME. Optional: BASE_URL, QUERY, VUS (max 1000), REQUESTS.');
  process.exit(2);
}
const samples = [];
const errors = [];
let next = 0;
async function worker() {
  while (true) {
    const index = next++;
    if (index >= requests) return;
    const start = performance.now();
    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ query, collectionName }),
        signal: AbortSignal.timeout(Number(process.env.REQUEST_TIMEOUT_MS || 60000)),
      });
      const text = await response.text();
      const ms = performance.now() - start;
      samples.push({ ms, status: response.status });
      if (!response.ok) errors.push({ status: response.status, body: text.slice(0, 180) });
      console.log(`${index + 1}/${requests} status=${response.status} elapsed_ms=${Math.round(ms)}`);
    } catch (error) {
      errors.push({ status: 'network', body: error.message });
      samples.push({ ms: performance.now() - start, status: 0 });
    }
  }
}
const started = performance.now();
await Promise.all(Array.from({ length: Math.min(vus, requests) }, () => worker()));
const elapsed = performance.now() - started;
const sorted = samples.map((x) => x.ms).sort((a, b) => a - b);
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] || 0;
console.log('\n--- Load test summary ---');
console.log(JSON.stringify({ baseUrl, requests, vus: Math.min(vus, requests), elapsed_ms: Math.round(elapsed), throughput_rps: Number((samples.length / (elapsed / 1000)).toFixed(2)), p50_ms: Math.round(percentile(.50)), p95_ms: Math.round(percentile(.95)), p99_ms: Math.round(percentile(.99)), non2xx_or_network_errors: errors.length, errors: errors.slice(0, 10) }, null, 2));
