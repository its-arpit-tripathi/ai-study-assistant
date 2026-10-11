# Production implementation pack: phases 1–5

This pack preserves the existing NotebookLM RAG routes and adds low-risk production controls. It is a **testable production-hardening baseline**, not proof that one deployment can handle 10,000 simultaneous generations. Capacity depends on traffic shape, provider quotas, payload sizes, database plans, and deployment sizing.

## Phase 1 — Isolation and security baseline

- Existing document operations require a valid JWT.
- Registry/document operations are scoped by authenticated `user_id`.
- Each document currently has its own Qdrant collection; this provides a useful isolation boundary but creates collection-management overhead at large scale.
- Keep document IDs, collection names, and source/citation IDs server-authorized. Do not trust tenant/user IDs from browser payloads.
- `migrations/001_production_indexes.sql` adds indexes for the current per-user schema. Review and run manually; it uses `CREATE INDEX CONCURRENTLY` and must not be run inside a transaction.
- Before shared-workspace support, introduce explicit `tenants` and `tenant_memberships` and migrate every query and Qdrant filter in one reviewed change. Do not merely add `tenantId` to payloads and assume that is enforcement.

## Phase 2 — Latency controls

- Vector and BM25 retrieval now run concurrently.
- Candidate counts are configurable with `VECTOR_CANDIDATES` and `BM25_CANDIDATES`; tune only against a fixed quality benchmark.
- `lib/productionControls.js` provides a bounded per-process generation semaphore and a scoped TTL cache.
- `ANSWER_CACHE_TTL_MS=0` disables answer caching by default. To test it locally, set `ANSWER_CACHE_TTL_MS=30000`. The key includes authenticated user, document, document version, normalized query, model, and prompt version.
- Cache and semaphore are process-local. Multiple production replicas need shared Redis-compatible storage/limiting or equivalent; process-local state does not coordinate across replicas.

## Phase 3 — Ingestion and storage separation

Current upload processing is synchronous and stores PDF files on local disk. This is fine for local testing but is not production-safe for ephemeral/multi-replica cloud containers. Before enabling cloud ingestion at scale:

1. Select an object store (S3-compatible or equivalent) and store object keys in PostgreSQL, never public file URLs.
2. Add a durable queue (managed queue or PostgreSQL-backed jobs) and a separately deployed worker process.
3. Make jobs idempotent using document ID + content hash + embedding/index version.
4. Keep the existing synchronous upload path until object storage and job polling are implemented and tested together. This pack intentionally does not pretend that local disk is durable cloud storage.

## Phase 4 — Streaming and provider resilience

- Existing `/api/chat` JSON contract is unchanged.
- The current LLM path remains non-streaming because citation verification occurs after generation. A production SSE endpoint should stream a draft, then send a final verification event; strict-grounding mode should withhold final status until checks finish.
- Configure provider-specific rate limits, request timeouts, bounded concurrency, retry only transient failures, and cancel work when clients disconnect. Never retry non-idempotent requests without a deliberate policy.

## Phase 5 — Observability and load/quality testing

- Server logs include stage timing; `/api/health` reports queue/concurrency snapshot and local cache entry count without exposing secrets.
- Run `npm test` and `npm run check` first.
- Run `npm run load:test` against a test environment after setting `BASE_URL`, `AUTH_TOKEN`, and `COLLECTION_NAME`. Begin with `VUS=2 REQUESTS=10`, then increase gradually. Do not run a stress test against production without approval.
- The built-in test runner is for staged smoke/load tests, not a distributed 10,000-user capacity certification. Use a distributed load generator for that stage.
- Track p50/p95/p99 time-to-first-token and verified-completion time, retrieval recall@5, citation precision, unsupported-claim rate, error rate, provider quota usage, and cross-user isolation. Reject speed changes that worsen evidence quality beyond the agreed threshold.

## Environment variables added

```env
LLM_MAX_CONCURRENCY=8
LLM_MAX_QUEUE=100
ANSWER_CACHE_TTL_MS=0
ANSWER_CACHE_MAX_ENTRIES=300
PROMPT_VERSION=v1
VECTOR_CANDIDATES=30
BM25_CANDIDATES=30
```

Start with conservative values. Do not infer safe concurrency from the target user count alone.

## Known remaining production work

- Shared-tenant/workspace membership model and migration.
- Cloud object storage + durable asynchronous ingestion workers.
- Shared cache/rate-limit backend for multi-replica deployments.
- SSE streaming integrated with the frontend and final verification events.
- Distributed 10,000-concurrent-user load test and provider quota validation.
- Backups, deletion lifecycle, alerting, and incident/rollback runbooks.

These require deployment/provider choices and load-test results. This pack preserves current functionality while implementing the safe, locally testable subset first.
