# 📓 NotebookLM RAG — Grounded AI Document Intelligence

A production-grade **Retrieval-Augmented Generation (RAG)** platform inspired by Google NotebookLM. Upload documents (PDFs, research papers, reports) and query them through real-time streaming conversations strictly grounded in document excerpts, backed by **claim-level citation verification**, **hybrid search**, **durable object storage**, and an **in-browser PDF page viewer**.

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Groq](https://img.shields.io/badge/Groq-Cloud%20LLM-F55036?style=flat&logoColor=white)](https://groq.com/)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20DB-DC2626?style=flat&logoColor=white)](https://qdrant.tech/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon%20DB-4169E1?style=flat&logo=postgresql&logoColor=white)](https://neon.tech/)

---

## ✨ Features & Capabilities

- **Strict Evidence Grounding** — Responses cite direct page numbers and chunk IDs; zero hallucination from outside training data.
- **Automated Claim Verification** — An asynchronous verification engine audits every generated claim against retrieved source excerpts, categorizing claims as `Supported`, `Partially Verified`, or `Issues Found`.
- **In-App PDF Evidence Viewer** — Click any citation badge (`📌 file.pdf · p. 2`) to instantly open the embedded PDF viewer jumped directly to that page.
- **Server-Sent Events (SSE) Streaming** — Real-time token streaming with live preliminary sources, draft answer updates, and completion telemetry.
- **Hybrid Search & Fusion** — Combines dense semantic vector retrieval (Qdrant) with sparse keyword retrieval (PostgreSQL BM25) using Reciprocal Rank Fusion (RRF) and Cross-Encoder reranking.
- **Durable Ingestion & Queue Worker** — S3-compatible document storage, SHA-256 idempotency deduplication, and a PostgreSQL background job queue with stalled lock reclamation.
- **Multi-Replica Production Controls** — Distributed rate-limiting, shared query caching, and semaphore concurrency limits.
- **High-Performance Presentation** — Rich Markdown rendering for tables, callout banners, cited excerpts, code blocks with copy buttons, and frame-throttled streaming.

---

## 🏗️ Architecture

```
                                  ┌──────────────────────────────┐
                                  │      React + Vite Client     │
                                  │   (Dual Theme · PDF Modal)   │
                                  └──────────────┬───────────────┘
                                                 │ HTTP / SSE Stream
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Express.js Web Server                                    │
│                                                                                        │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────────────┐  │
│  │ JWT Authentication     │  │ Distributed Rate Limit │  │ Shared Answer Cache      │  │
│  │ (bcrypt + PostgreSQL)  │  │ (PostgreSQL Coordinator)│  │ (Multi-Replica Sync)     │  │
│  └────────────────────────┘  └────────────────────────┘  └──────────────────────────┘  │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Hybrid Retrieval Pipeline                                                        │  │
│  │  1. In-process Embedding (Transformers.js all-MiniLM-L6-v2, 384-dim)             │  │
│  │  2. Qdrant Vector Retrieval (Top-30 dense candidates)                             │  │
│  │  3. PostgreSQL BM25 Search (Exact lexical term matching)                         │  │
│  │  4. Reciprocal Rank Fusion (RRF) + Cross-Encoder Reranker (Top-5 Context Chunks) │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  ┌────────────────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Groq Streaming LLM (qwen3.8-27b)       │  │ Claim Citation Verifier              │  │
│  │ (Token SSE stream + model fallbacks)   │  │ (JSON Mode assertion audit)          │  │
│  └────────────────────────────────────────┘  └──────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────────┬──────────────────────┘
                       │                                          │
                       ▼                                          ▼
     ┌──────────────────────────────────┐       ┌──────────────────────────────────┐
     │          Qdrant Cloud            │       │      PostgreSQL (Neon DB)        │
     │      (Vector Search Index)       │       │  - User Accounts & Workspaces    │
     │                                  │       │  - Document & Chunk Metadata     │
     └──────────────────────────────────┘       │  - S3 File Keys & Hash Tracking  │
                       ▲                        │  - Ingestion Job Queue           │
                       │                        │  - Shared Cache & Rate Limits    │
     ┌─────────────────┴────────────────┐       └──────────────────────────────────┘
     │   Asynchronous Ingestion Worker  │                         ▲
     │    (S3 File Retrieval + Worker)  ├─────────────────────────┘
     └──────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite, TailwindCSS | Fast single-page application with responsive dark/light mode |
| **Backend API** | Node.js (v18+), Express | REST and SSE endpoints with Helmet security and rate limiters |
| **LLM Provider** | Groq (`qwen/qwen3.8-27b`, fallbacks) | Ultra-fast inference for streaming answers and verification |
| **Vector DB** | Qdrant Cloud | Dense vector indexing and similarity search |
| **Database** | PostgreSQL (Neon serverless) | Users, metadata, BM25 keyword store, queues, shared caches |
| **Object Storage** | S3-Compatible Storage (AWS / Neon) | Durable, persistent storage for uploaded PDFs and files |
| **Embeddings** | `@xenova/transformers` (local in-process) | 384-dimensional ONNX embeddings without external API costs |

---

## 📋 Prerequisites & Accounts

Before running or deploying the application, acquire keys for the following free tiers (no credit card required):

1. **Groq API Key**: Sign up at [console.groq.com](https://console.groq.com/) and create an API key.
2. **Qdrant Cloud**: Create a free cluster at [cloud.qdrant.io](https://cloud.qdrant.io/) and copy your **Cluster URL** and **API Key**.
3. **PostgreSQL Database**: Create a free serverless PostgreSQL database at [neon.tech](https://neon.tech/) and copy your connection string (`DATABASE_URL`).
4. **S3-Compatible Object Storage**: Neon Object Storage or AWS S3 credentials (Bucket name, Region, Access Key, Secret Key).

---

## 💻 Step-by-Step Local Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/its-arpit-tripathi/ai-study-assistant.git
cd ai-study-assistant
```

### Step 2: Install Dependencies
This project uses npm workspaces. Install all root, backend, and frontend packages with:
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy the example environment configuration into `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and supply your credentials:
```env
# Port & Environment
PORT=3000
NODE_ENV=development

# Groq LLM API
GROQ_API_KEY=gsk_your_groq_api_key
GROQ_MODEL=qwen/qwen3.8-27b

# Qdrant Vector Database
QDRANT_URL=https://your-cluster-id.qdrant.tech
QDRANT_API_KEY=your_qdrant_api_key

# PostgreSQL Connection String
DATABASE_URL=postgresql://user:password@ep-xyz.aws.neon.tech/neondb?sslmode=require

# Authentication Secret (Minimum 32 random characters)
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long

# In-Process Embeddings & Search Controls
EMBEDDING_PROVIDER=local
EMBEDDING_BATCH_SIZE=8
RERANKER_ENABLED=true
CITATION_VERIFIER_ENABLED=true
CITATION_VERIFIER_TIMEOUT_MS=8000

# S3-Compatible Object Storage
AWS_ENDPOINT_URL_S3=https://your-s3-endpoint.amazonaws.com
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=notebooklm-docs
```

### Step 4: Run Database Migrations
Execute all database schemas (indexes, workspace models, durable job queues, and shared caches):
```bash
node backend/scripts/run-migration.mjs
```

### Step 5: Start Development Servers
Run the backend and frontend development servers concurrently:

**Terminal 1 (Backend API & Ingestion):**
```bash
npm run dev:backend
```
*(Runs on `http://localhost:3000`)*

**Terminal 2 (Frontend Client):**
```bash
npm run dev:frontend
```
*(Runs on `http://localhost:5173` with automated API proxying to port 3000)*

Open `http://localhost:5173` in your browser, create an account, upload a PDF, and start exploring!

---

## 🧪 Testing & Validation

The project includes an end-to-end automated testing suite:

```bash
# 1. Run unit and integration tests
npm test

# 2. Run End-to-End SSE Streaming Lifecycle Test
node backend/scripts/test-sse-streaming-e2e.mjs

# 3. Run Durable S3 Storage & Replica Concurrency Test
node backend/scripts/test-storage-and-replicas-e2e.mjs

# 4. Run Multi-User Tenant Isolation Security Test
node backend/scripts/test-multi-user-isolation.mjs
```

---

## 🌐 Step-by-Step Production Deployment

### Option A: Deploy to Render (Recommended / 1-Click Blueprints)

The repository includes a ready-to-use [`render.yaml`](file:///d:/NotebookLM_RAG-work/render.yaml) configuration:

1. **Push your code to GitHub**:
   ```bash
   git push origin main
   ```
2. **Open Render**: Go to [dashboard.render.com](https://dashboard.render.com/) and click **New +** → **Blueprint**.
3. **Connect Repository**: Select `its-arpit-tripathi/ai-study-assistant`.
4. **Environment Variables**: Fill in the required environment variables in the Render dashboard:
   - `GROQ_API_KEY`
   - `QDRANT_URL`
   - `QDRANT_API_KEY`
   - `DATABASE_URL`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_S3_BUCKET`
   - `AWS_ENDPOINT_URL_S3`
5. **Deploy**: Render will build the Vite frontend (`dist/`), start the unified Express server, and serve your app with automated HTTPS!

---

### Option B: Deploy with Docker or Standalone VPS

To deploy on any cloud VM, container service, or VPS:

1. **Build the production frontend bundle**:
   ```bash
   npm run build
   ```
   *(Compiles static assets into `frontend/dist`)*

2. **Run migrations**:
   ```bash
   node backend/scripts/run-migration.mjs
   ```

3. **Start the production server**:
   ```bash
   NODE_ENV=production PORT=80 node backend/server.js
   ```
   *Express automatically detects `frontend/dist` and serves both the compiled React frontend and the backend API on the same port.*

4. **(Optional) Run Dedicated Background Worker for High Volume**:
   ```bash
   node backend/scripts/worker.mjs
   ```

---

## 📁 Repository Structure

```
ai-study-assistant/
├── backend/
│   ├── config/
│   │   └── database.js              # PostgreSQL Neon pool configuration
│   ├── controllers/
│   │   ├── authController.js        # User registration, login & session
│   │   ├── chatController.js        # SSE streaming & non-streaming endpoints
│   │   ├── documentController.js    # Upload, warm, file-fetch & delete
│   │   └── healthController.js      # Health and telemetry metrics
│   ├── lib/
│   │   ├── citationVerifier.js      # Claim assertion parsing and grounding
│   │   ├── documentProcessor.js     # PDF/text chunking & extraction
│   │   ├── embeddings.js            # In-process Transformers.js model loader
│   │   ├── hybridSearch.js          # Vector + BM25 RRF fusion & reranker
│   │   ├── ingestionQueue.js        # PostgreSQL durable job queue
│   │   ├── ingestionWorker.js       # Background ingestion & retry engine
│   │   ├── llm.js                   # Groq streaming completion & fallbacks
│   │   ├── storage.js               # S3-compatible object storage client
│   │   └── vectorStore.js           # Qdrant client & collection management
│   ├── migrations/                  # SQL schema migrations (001 - 004)
│   ├── scripts/                     # Migration runner, worker, and E2E tests
│   └── server.js                    # Unified Express application entrypoint
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthModal.jsx        # Login & registration modal
│   │   │   ├── ChatHeader.jsx       # Navigation, status, theme toggle
│   │   │   ├── ChatInput.jsx        # Resizable query input & cancel action
│   │   │   ├── ChatMessage.jsx      # Message bubble & citation cards
│   │   │   ├── ClaimVerification.jsx# Interactive verified claim breakdown
│   │   │   ├── PdfViewerModal.jsx   # In-app PDF evidence viewer
│   │   │   ├── Sidebar.jsx          # Document manager & upload dropzone
│   │   │   └── Toast.jsx            # Top-right notification system
│   │   ├── utils/
│   │   │   ├── api.js               # Client API & SSE stream reader
│   │   │   └── markdown.jsx         # High-fidelity table & callout renderer
│   │   ├── App.jsx                  # Main chat workspace & state manager
│   │   └── index.css                # Global design system & theme tokens
│   └── vite.config.js               # Vite configuration & dev proxy
├── package.json                     # Monorepo workspaces manifest
├── render.yaml                      # Render Blueprint deployment definition
└── README.md                        # Documentation
```

---

## 🩺 Troubleshooting & Diagnostics

| Issue | Cause | Solution |
|---|---|---|
| **Header shows Vector DB Offline** | Qdrant free-tier cluster went idle (suspended after 7 days) | Log in to [cloud.qdrant.io](https://cloud.qdrant.io/) and click **Resume**. A ping to `/api/health` keeps the cluster active. |
| **Model Unavailable Warnings** | Groq decommissioned a legacy model name | The backend automatically cascades to fallback models (`qwen/qwen3.8-27b`, `openai/gpt-oss-120b`). Update `GROQ_MODEL` in `.env` to silence warnings. |
| **Database Connection Timeout** | Neon serverless database was sleeping during cold start | Retry the operation; Neon boots within 1–2 seconds. Connection pool handles reconnection automatically. |
| **Large PDF Upload Failure** | Upload exceeded max size limit | The default payload limit is 20MB. Increase limits in `backend/middlewares/uploadMiddleware.js` if necessary. |

---

## 📄 License

Distributed under the **MIT License**. Free for personal and commercial usage.
