# 📓 NotebookLM RAG — Chat with Your Documents

A full-stack **RAG (Retrieval-Augmented Generation)** application inspired by Google NotebookLM. Upload any document and have an AI-powered conversation grounded entirely in its content.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-FF6B35?style=flat&logo=data:image/svg+xml;base64,&logoColor=white)
![Hugging Face](https://img.shields.io/badge/Transformers.js-FFD21E?style=flat&logo=huggingface&logoColor=black)
![Qdrant](https://img.shields.io/badge/Qdrant-FF4F64?style=flat&logo=data:image/svg+xml;base64,&logoColor=white)

## ✨ Features

- **Document Upload** — Upload PDF or plain text files via drag-and-drop or file picker
- **Intelligent Chunking** — Documents are split using Recursive Character Text Splitting for optimal retrieval
- **Semantic Search** — Chunks are embedded and stored in Qdrant vector database for similarity search
- **Grounded Answers** — AI answers come exclusively from your document — no hallucination
- **Source References** — Every answer shows which pages/sections the information came from
- **One API key** — Groq is the only AI service you need; embeddings run locally on the server
- **Status badge** — The header badge turns red and explains why when the vector DB is unreachable
- **Premium UI** — Clean design with smooth animations, responsive on desktop and mobile

## 🏗️ Architecture

```
User Browser ──► Express.js Server
                    │
                    ├── Document Processor (PDFLoader + RecursiveCharacterTextSplitter)
                    │
                    ├── Local embeddings (Transformers.js · Xenova/all-MiniLM-L6-v2) ──► Qdrant Cloud (Vector DB)
                    │
                    └── Groq LLM (openai/gpt-oss-120b) ──► Grounded Answer
```

### RAG Pipeline

1. **Ingestion** — Upload a PDF or TXT file
2. **Chunking** — `RecursiveCharacterTextSplitter` splits the document (1000 chars, 200 overlap)
3. **Embedding** — `Xenova/all-MiniLM-L6-v2` runs on the server via ONNX Runtime and produces 384-dim vectors (no API call)
4. **Storage** — Vectors are stored in Qdrant Cloud (free tier)
5. **Retrieval** — User question is embedded and top-4 similar chunks are retrieved
6. **Generation** — Groq `openai/gpt-oss-120b` generates an answer grounded in the retrieved context

### Why local embeddings?

Groq's free tier is generous, but Groq serves **no embedding models** (its `/models` endpoint lists chat, audio and guard models only). Rather than depend on a second paid/quota-limited API just for embeddings, the app runs a small open sentence-transformer in-process:

| | Local (`Xenova/all-MiniLM-L6-v2`) | Gemini (`gemini-embedding-001`) |
|---|---|---|
| API key | none | `GOOGLE_API_KEY` |
| Dimensions | 384 | 3072 |
| Cost / quota | none | free tier, rate limited |
| Cold start | ~23 MB download on first run, then cached | none |
| Speed | ~100 chunks/sec on a laptop | network bound |

Gemini is still available as an opt-in provider (`EMBEDDING_PROVIDER=gemini`). Note that the two produce differently-sized vectors, so a document indexed with one cannot be searched with the other — delete and re-upload after switching.

## 📐 Chunking Strategy

**Recursive Character Text Splitting** was chosen for its balance of simplicity and effectiveness:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `chunkSize` | 1000 | Large enough for meaningful context, small enough for precise retrieval |
| `chunkOverlap` | 200 | 20% overlap prevents information loss at chunk boundaries |
| Separators | `["\n\n", "\n", " ", ""]` | Hierarchical — tries paragraph breaks first, then lines, then words |

This strategy preserves natural text structure (paragraphs, sentences) while ensuring consistent chunk sizes for embedding quality.

## 🛠️ Tech Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Backend | Node.js + Express.js | Free |
| LLM | Groq (`openai/gpt-oss-120b`, automatic fallback to `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`) | Free |
| Embeddings | Transformers.js + ONNX Runtime, `Xenova/all-MiniLM-L6-v2` (runs on the server) | Free, no key |
| Vector DB | Qdrant Cloud | Free |
| Frontend | Vanilla HTML/CSS/JS | Free |
| Deployment | Render | Free |

## 🚀 Setup

### Prerequisites

- Node.js 18+
- Free accounts (no credit card needed):
  - [Groq Console](https://console.groq.com) — LLM API key
  - [Qdrant Cloud](https://cloud.qdrant.io) — Vector Database cluster URL + API key

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/notebooklm-rag.git
   cd notebooklm-rag
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   > The repo ships an `.npmrc` with `legacy-peer-deps=true`. Without it a fresh install fails with `ERESOLVE` because `@langchain/community` declares optional peers whose ranges conflict with `dotenv` 17.

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Groq and Qdrant keys
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```
   On first start the embedding model (~23 MB) is downloaded and cached under `node_modules/@huggingface/transformers/.cache`. The console prints the LLM / embedding / Qdrant configuration and warns immediately if Qdrant is unreachable.

5. **Open** `http://localhost:3000` in your browser

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq API key — [console.groq.com](https://console.groq.com) |
| `QDRANT_URL` | ✅ | Qdrant Cloud cluster URL — [cloud.qdrant.io](https://cloud.qdrant.io) |
| `QDRANT_API_KEY` | ✅ | Qdrant Cloud API key |
| `GROQ_MODEL` | | Chat model (default `openai/gpt-oss-120b`). If it is retired the app falls back automatically and logs a warning. |
| `EMBEDDING_PROVIDER` | | `local` (default) or `gemini` |
| `EMBEDDING_MODEL` | | Local: any HF Hub feature-extraction model with ONNX weights, e.g. `Xenova/bge-small-en-v1.5`. Gemini: defaults to `gemini-embedding-001`. |
| `EMBEDDING_BATCH_SIZE` | | Chunks per forward pass for local embeddings (default `8`). Peak RAM scales with this: 8 ≈ 300 MB, 32 ≈ 560 MB. |
| `EMBEDDING_DTYPE` | | `q8` (default) · `fp32` · `fp16` |
| `GOOGLE_API_KEY` | only with `gemini` | Google AI Studio key — [aistudio.google.com](https://aistudio.google.com) |

## 📁 Project Structure

```
notebooklm-rag/
├── server.js              # Express server + API routes
├── lib/
│   ├── documentProcessor.js   # PDF/TXT loading + chunking
│   ├── embeddings.js          # Embedding provider (local Transformers.js by default, Gemini opt-in)
│   ├── vectorStore.js         # Qdrant indexing + retrieval
│   ├── registry.js            # Persistent document registry (stored in Qdrant)
│   ├── qdrant.js              # Qdrant error translation (suspended cluster, bad key, ...)
│   └── llm.js                 # Groq LLM with automatic model fallback
├── public/
│   ├── index.html             # Frontend UI
│   ├── styles.css             # Theme
│   └── app.js                 # Client-side logic (incl. backend health badge)
├── .env.example               # Environment variable template
├── .npmrc                     # legacy-peer-deps (needed for a clean npm install)
├── render.yaml                # Render deployment config
└── README.md
```

## 🌐 Deployment (Render)

1. Push code to GitHub
2. Go to [Render.com](https://render.com) → New Web Service
3. Connect your GitHub repo
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Add `GROQ_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY` in the Render dashboard (`render.yaml` already sets `EMBEDDING_PROVIDER=local` and `EMBEDDING_BATCH_SIZE=8`)
6. Deploy!

Notes for the free instance (512 MB RAM):

- Keep `EMBEDDING_BATCH_SIZE` at 8 or lower.
- The filesystem is ephemeral, so the embedding model is re-downloaded (~23 MB, a few seconds) after each cold start. The server warms it up at boot so the first upload isn't slow.

## 🩺 Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Header badge says **Vector DB offline**; uploads/chat return HTTP 503 `Cannot reach the Qdrant cluster ... (ECONNRESET)` | Qdrant Cloud suspended (1 week idle) or deleted (4 weeks idle) the free cluster | Log in to [cloud.qdrant.io](https://cloud.qdrant.io) and resume it, or create a new cluster and update `QDRANT_URL` / `QDRANT_API_KEY`. See the keep-alive section below. |
| Console warns `Groq model "..." is unavailable; using "..." instead` | Groq retired the configured model | Nothing breaks — the fallback is used. Set `GROQ_MODEL` to a model from [console.groq.com/docs/models](https://console.groq.com/docs/models) to silence the warning. |
| `npm install` fails with `ERESOLVE ... Conflicting peer dependency: dotenv` | Missing `.npmrc` | Make sure `.npmrc` (`legacy-peer-deps=true`) is present, or run `npm install --legacy-peer-deps`. |
| Chat returns *"indexed with a different embedding model"* | Document was embedded with another provider/model (different vector size) | Delete the document and upload it again. |
| Slow first upload | Embedding model downloading on first run | Wait for `🧠 Local embeddings ready` in the server log. |

## ⚠️ Keeping the Qdrant Free Cluster Alive

Qdrant Cloud **free-tier** clusters are reclaimed when left idle:

| Idle time | State | Recoverable? |
|-----------|-------|--------------|
| 1 week | Suspended | ✅ Reactivate from dashboard — data preserved |
| 4 weeks | Permanently deleted | ❌ Must re-create cluster + re-upload documents |

The timer is based on **inactivity**, not age — any request resets it. To prevent
the cluster from ever being suspended, this app exposes a keep-alive endpoint:

```
GET /api/health   →   { "status": "ok", "qdrant": { "ok": true, "collections": N }, "llm": {...}, "embeddings": {...} }
```

Point a free uptime monitor (e.g. [cron-job.org](https://cron-job.org),
UptimeRobot) at `https://<your-app>/api/health` every few days. Each hit pings
Qdrant and resets the inactivity clock. The endpoint returns HTTP `200` when
Qdrant is reachable and `503` when it isn't — useful for monitoring too.

> If the cluster ever does get deleted, just create a new one, update
> `QDRANT_URL` + `QDRANT_API_KEY`, and re-upload your documents.

## 📄 License

MIT


## Phase 1 — Reliability and security

This branch adds email/password authentication, signed short-lived JWTs, password hashing, PostgreSQL-backed users/notebooks/document metadata, server-generated UUID document and Qdrant collection IDs, API/auth rate limits, Helmet security headers, JSON body limits, and PDF signature checks. Qdrant continues to store document vectors.

### Required environment variables

- `DATABASE_URL`: PostgreSQL connection string (local PostgreSQL or a managed provider).
- `JWT_SECRET`: random secret of at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- Existing `GROQ_API_KEY`, `QDRANT_URL`, and `QDRANT_API_KEY`.

Copy `.env.example` to `.env`, set the values, then run `npm install` and `npm run dev`. The database schema is created automatically on first boot. New users need a password of at least 12 characters.

**Important:** this version does not automatically migrate existing anonymous/session-based document metadata from the old Qdrant `document_registry` collection. Existing vectors remain in Qdrant, but old registry entries won't appear in the new account-based UI; re-upload documents under your new account or perform a deliberate migration after assigning ownership. JWTs are stored in browser local storage for this vanilla-JS MVP; a production deployment should move to secure HttpOnly cookies and add email verification/password reset before public launch.


## Phase 2 — Hybrid Search + Reranking

- **Vector retrieval:** Qdrant returns up to 30 semantically similar chunks.
- **Keyword retrieval:** A BM25 implementation over the persisted chunk corpus finds exact terms and names; chunk text is stored in `document_chunks`.
- **Fusion:** Reciprocal Rank Fusion combines vector and keyword rankings without comparing their incompatible raw scores.
- **Reranking:** A local `Xenova/ms-marco-MiniLM-L-6-v2` cross-encoder reranks fused candidates. If the model cannot load, a lexical scoring fallback is used and logged. Set `RERANKER_ENABLED=false` to skip the model and use lexical reranking.
- **Final context:** Top 5 reranked chunks are passed to Groq.

New uploads populate both Qdrant and PostgreSQL's keyword index. Existing documents uploaded before Phase 2 remain searchable through Qdrant, but will not have BM25 matches until re-uploaded or re-indexed. The `/api/health` endpoint should report Qdrant as healthy before upload/chat testing.
