# ⚖️ Antigravity Legal AI
### Autonomous Agentic AI System for Legal Information, Contract Risk Extraction & Compliance

> A full-stack multi-agent legal AI platform orchestrated with **LangGraph**, **Hybrid RAG** (Dense Vector + BM25 + Reciprocal Rank Fusion), real-time **SSE streaming chat**, **contract risk scoring**, **regulatory compliance evaluation**, and **AI-powered contract drafting**, built with Express, MongoDB, and React + TanStack Start.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Multi-Agent Pipeline](#multi-agent-pipeline)
- [Hybrid RAG & Statistical Filtering](#hybrid-rag--statistical-filtering)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Frontend Pages](#frontend-pages)
- [API Endpoints](#api-endpoints)
- [Data Models](#data-models)

---

## 🌟 Overview

**Antigravity Legal AI** automates legal research, contract due diligence, regulatory compliance gap analysis, and contract drafting:

- **5-Node LangGraph `StateGraph` Pipeline**: Routes user queries through Planner → Retriever → Compliance / Analyzer → Response agents, with live reasoning chain visibility.
- **Hybrid RAG Retrieval**: Combines dense semantic vector search (`vectorstore/index.json`) with sparse BM25 keyword search (`wink-bm25-text-search`), Reciprocal Rank Fusion (RRF), query expansion, and LLM re-ranking.
- **Multi-LLM Routing with Offline Fallback**: Automatically detects available API keys (`GROQ_API_KEY` → `GEMINI_API_KEY` → `OPENAI_API_KEY`) and falls back to local rule-based heuristics and TF-IDF sparse vectors when no API keys are configured.
- **Real-Time SSE Streaming**: Streams reasoning steps, answer tokens, sources, and compliance metadata over Server-Sent Events (`/chat/stream`).
- **Multi-Language Support**: Supports English (`en`), Tamil (`ta`), and Hindi (`hi`).

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 💬 **AI Legal Chat** | Streaming multi-agent chat with expandable reasoning chain, session history, PDF/DOCX/image attachments, KB toggle, and email summary export. |
| 📄 **Document & Contract Auditor** | Upload PDF, DOCX, or TXT contracts for text extraction, vector indexing, risk scoring, clause-level findings, and suggested rewrites. |
| 🏭 **Contract Creator** | 3-step AI contract drafting wizard with clause suggestions and compliance validation. |
| 🛡️ **Compliance Checker** | Evaluate business/system profiles against regulatory frameworks (GDPR, CCPA, HIPAA, FLSA, EU AI Act, etc.) with interactive checklist tracking and history. |
| 📚 **Knowledge Base** | Upload documents or add articles, chunk and embed content into the local vector store, and test hybrid search queries. |
| 📊 **Dashboard & Alerts** | Workspace statistics, analytics charts, and an acknowledgeable regulatory alert feed. |
| 🔐 **Authentication & Roles** | JWT-based registration/login (`bcryptjs` password hashing) with `admin` / user role guards (`adminOnly` middleware for reindexing/flushing). |

---

## 🧠 System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Frontend (React 19 + Vite)                       │
│   TanStack Router / Start · TanStack Query · TailwindCSS · shadcn/ui │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ REST + SSE (http://localhost:8080)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Backend API (Node.js + Express)                    │
│   JWT Auth · Multer Uploads · PDF/DOCX Parsing · Nodemailer SMTP     │
└──────┬───────────────────────────┬───────────────────────────┬───────┘
       │                           │                           │
       ▼                           ▼                           ▼
┌──────────────┐         ┌──────────────────┐        ┌─────────────────┐
│   MongoDB    │         │  LangGraph Agent │        │  Vector Store   │
│  (Mongoose)  │         │     Pipeline     │        │ + BM25 Index    │
│ Users, Chats │         │ Planner/Retriever│        │ vectorstore/    │
│ Docs, Checks │         │ Analyzer/Respond │        │ index.json      │
└──────────────┘         └──────────────────┘        └─────────────────┘
```

---

## 🤖 Multi-Agent Pipeline

Orchestrated in [`backend/agents/workflowManager.js`](backend/agents/workflowManager.js) using `@langchain/langgraph` (`StateGraph`):

```
User Query
    │
    ▼
┌───────────────────┐
│   PLANNER Agent   │  Classifies intent (chat / analysis / compliance / drafting),
│ (plannerAgent.js) │  detects jurisdiction, language, and regulatory frameworks
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  RETRIEVER Agent  │  Executes Hybrid RAG across the Knowledge Base
│(retrieverAgent.js)│  with query expansion and jurisdiction filtering
└─────────┬─────────┘
          │
     ┌────┴──────────────────────┐
     │ (conditional edge)        │
     ▼                           ▼
┌───────────────────┐   ┌───────────────────┐
│ COMPLIANCE Agent  │   │  ANALYZER Agent   │
│(complianceAgent.js│   │ (analyzerAgent.js)│
│  Gap & severity)  │   │ (Risk & clauses)  │
└─────────┬─────────┘   └─────────┬─────────┘
          │                       │
          └───────────┬───────────┘
                      │
                      ▼
            ┌───────────────────┐
            │  RESPONSE Agent   │  Synthesizes grounded answer with conversation
            │ (responseAgent.js)│  memory (last 10 messages) + legal disclaimer
            └─────────┬─────────┘
                      │
                      ▼
                 Final Answer (streamed via SSE)
```

- **Mail Agent** (`backend/agents/mailAgent.js`) & **Mail Service** (`backend/services/mailService.js`): Sends chat summaries and regulatory alert notifications via SMTP.

---

## 🔍 Hybrid RAG & Statistical Filtering

- **Ingestion & Chunking**: Documents (`.pdf` via `pdf-parse`, `.docx` via `mammoth`, `.txt`) are parsed in `backend/utils/fileParser.js` and split into overlapping character chunks (1000-char chunks with 200-char overlap).
- **Dense Embeddings & Local Persistence**: `backend/services/vectorStoreService.js` generates embeddings (OpenAI `text-embedding-3-small`, Gemini embeddings, or local TF-IDF sparse vectors) and persists them in `vectorstore/index.json`.
- **Hybrid Search**: `backend/services/hybridSearchService.js` combines:
  1. Dense cosine similarity search
  2. Sparse BM25 keyword search (`wink-bm25-text-search`)
  3. Reciprocal Rank Fusion (RRF) & optional LLM re-ranking
- **Statistical Outlier Gate**: Filters boilerplate clauses locally using cross-attention / token-overlap scoring and dynamic Z-score thresholding before escalating high-risk anomalies to LLM analysis.

---

## 🛠️ Tech Stack

### Backend (`backend/package.json`)
- **Runtime & Framework**: Node.js (≥ 18), Express 4.19
- **Database**: MongoDB (≥ 6.0) with Mongoose 8.3
- **Agentic AI & LLMs**: `@langchain/langgraph`, `@langchain/core`, `openai` (Groq & OpenAI compatible), `@google/generative-ai`
- **Search & Parsing**: `wink-bm25-text-search`, `pdf-parse`, `mammoth`, `multer`, `node-cache`
- **Auth & Utilities**: `jsonwebtoken`, `bcryptjs`, `cors`, `dotenv`, `nodemailer`

### Frontend (`frontend/package.json`)
- **Framework**: React 19, TypeScript 5.8, Vite 7
- **Routing & State**: `@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/react-query`
- **UI & Styling**: TailwindCSS 4, shadcn/ui + Radix UI primitives, `lucide-react`, `sonner`
- **Visualization & Export**: `recharts`, `react-markdown`, `remark-gfm`, `jspdf`, `jspdf-autotable`

---

## 📁 Project Structure

```
.
├── backend/
│   ├── agents/
│   │   ├── agentState.js             # Shared LangGraph agent state
│   │   ├── analyzerAgent.js          # Contract risk scoring & clause analysis
│   │   ├── complianceAgent.js        # Regulatory compliance gap evaluation
│   │   ├── mailAgent.js              # Summary & alert email dispatch
│   │   ├── plannerAgent.js           # Intent, jurisdiction & framework detection
│   │   ├── responseAgent.js          # Multi-LLM synthesis & grounding
│   │   ├── retrieverAgent.js         # Hybrid RAG retrieval
│   │   └── workflowManager.js        # LangGraph StateGraph orchestrator
│   ├── controllers/                  # Route controllers (auth, chat, docs, etc.)
│   ├── middleware/
│   │   └── auth.js                   # JWT verification & adminOnly guard
│   ├── models/
│   │   ├── chat.js                   # ChatSession schema
│   │   ├── compliance.js             # ComplianceCheck schema
│   │   ├── document.js               # Document & analysis schema
│   │   └── user.js                   # User schema (bcrypt hashing)
│   ├── routes/                       # Express routers
│   ├── services/
│   │   ├── dbSyncService.js          # Database sync utilities
│   │   ├── hybridSearchService.js    # BM25 + Dense + RRF search
│   │   ├── mailService.js            # Nodemailer SMTP transport
│   │   └── vectorStoreService.js     # Embeddings & vectorstore/index.json
│   ├── utils/
│   │   └── fileParser.js             # PDF / DOCX / TXT extraction
│   ├── mockData.js                   # Seed/mock regulatory & template data
│   ├── server.js                     # Express entry point & MongoDB startup
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/               # AppShell, AppSidebar, shadcn/ui components
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── lib/                      # Utilities, config, error handling
│   │   ├── routes/                   # File-based TanStack routes
│   │   ├── router.tsx
│   │   ├── server.ts
│   │   └── styles.css
│   ├── vite.config.ts
│   └── package.json
├── vectorstore/
│   └── index.json                    # Persisted vector index
├── package.json                      # Root helper scripts
├── requirements.txt                  # System & dependency overview
├── PROJECT_DESCRIPTION.md            # Technical architecture & abstract
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** `>= 18.0.0`
- **npm** `>= 9.0.0`
- **MongoDB** `>= 6.0.0` running locally on `127.0.0.1:27017` (or a valid `MONGO_URI`)

### Installation

Install dependencies for root, backend, and frontend:
```bash
npm run install:all
```

---

## 🔑 Environment Variables

Configure `backend/.env`:

```env
PORT=8080
MONGO_URI=mongodb://127.0.0.1:27017/legal-ai
JWT_SECRET=your_super_secret_jwt_key_here

# AI Keys (optional — falls back to local heuristics & TF-IDF if omitted)
GROQ_API_KEY=gsk_your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
# OPENAI_API_KEY=sk_your_openai_key_here

# Optional SMTP configuration for email summaries & alerts
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your_email@gmail.com
# SMTP_PASS=your_app_password
```

---

## ▶️ Running the Application

1. **Ensure MongoDB is running** on `127.0.0.1:27017`.
2. **Start the backend server** (listens on port `8080` by default):
   ```bash
   npm run backend
   ```
3. **Start the frontend dev server** (use port `5173` so it does not conflict with the backend on port `8080`, since `@lovable.dev/vite-tanstack-config` defaults Vite to `8080`):
   ```bash
   cd frontend && npx vite dev --port 5173
   ```
4. Open **http://localhost:5173** in your browser.

### Health Check & Demo Credentials
- **Backend Health**: `GET http://localhost:8080/health`
- **Seeded Demo Account** (auto-created on startup in `backend/server.js`):
  - **Email**: `jane@firm.com`
  - **Password**: `defaultpassword123`

---

## 🖥️ Frontend Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `frontend/src/routes/index.tsx` | AI Legal Chat with SSE streaming, reasoning chain, file attachments, language & KB toggles |
| `/dashboard` | `frontend/src/routes/dashboard.tsx` | Workspace metrics, charts, and regulatory alerts feed |
| `/documents` | `frontend/src/routes/documents.tsx` | Contract upload, risk audit results, and document management |
| `/contract-creator` | `frontend/src/routes/contract-creator.tsx` | 3-step AI contract drafting, clause suggestion, and compliance validation |
| `/compliance` | `frontend/src/routes/compliance.tsx` | Regulatory compliance evaluation, history, and checklist item tracking |
| `/knowledge-base` | `frontend/src/routes/knowledge-base.tsx` | Knowledge base articles/documents upload and hybrid search |
| `/settings` | `frontend/src/routes/settings.tsx` | Account details, theme toggle, and language preferences |
| `/login` | `frontend/src/routes/login.tsx` | User sign-in |
| `/register` | `frontend/src/routes/register.tsx` | User registration |

---

## 🔌 API Endpoints

All protected endpoints expect `Authorization: Bearer <JWT_TOKEN>`.

### Health & Direct Endpoints
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Server & MongoDB connection status |
| `POST` | `/chat` | JWT | Non-streaming chat in default session |
| `POST` | `/chat/stream` | JWT | SSE streaming multi-agent chat |
| `GET` | `/history` | JWT | Default session message history |
| `POST` | `/upload` | JWT | Upload & analyze a contract (`contractFile`) |
| `POST` | `/compliance` | JWT | Evaluate compliance profile |

### Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register a new user |
| `POST` | `/api/auth/login` | Public | Authenticate and receive JWT |
| `GET` | `/api/auth/profile` | JWT | Fetch current user profile |

### Chat Sessions (`/api/chat`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/chat/sessions` | JWT | List user chat sessions |
| `POST` | `/api/chat/sessions` | JWT | Create a new chat session |
| `GET` | `/api/chat/sessions/:sessionId` | JWT | Get session details and messages |
| `POST` | `/api/chat/sessions/:sessionId/messages` | JWT | Send a message to a session |
| `POST` | `/api/chat/sessions/:sessionId/send-summary` | JWT | Email session summary via SMTP |
| `DELETE` | `/api/chat/sessions/:sessionId` | JWT | Delete a chat session |

### Documents (`/api/documents`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/documents/upload` | JWT | Upload & analyze a contract (`contractFile`) |
| `GET` | `/api/documents` | JWT | List user documents |
| `GET` | `/api/documents/:docId` | JWT | Get document details & analysis |
| `DELETE` | `/api/documents/:docId` | JWT | Delete a document |
| `POST` | `/api/documents/reindex` | Admin | Reindex all documents into the vector store |

### Contract Creator (`/api/contract-creator`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/contract-creator/generate` | JWT | Generate a contract draft |
| `POST` | `/api/contract-creator/suggest-clause` | JWT | Suggest a specific contract clause |
| `POST` | `/api/contract-creator/validate` | JWT | Validate a draft for compliance issues |

### Compliance (`/api/compliance`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/compliance/evaluate` | JWT | Run a compliance evaluation |
| `GET` | `/api/compliance/history` | JWT | List past compliance checks |
| `PUT` | `/api/compliance/checks/:checkId/items/:itemId` | JWT | Update a compliance checklist item |

### Knowledge Base (`/api/knowledge-base`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/knowledge-base` | JWT | List knowledge base articles |
| `POST` | `/api/knowledge-base` | JWT | Add a knowledge base article |
| `POST` | `/api/knowledge-base/upload` | JWT | Upload & index a KB file (`kbFile`) |
| `DELETE` | `/api/knowledge-base/:id` | JWT | Delete a KB article |
| `POST` | `/api/knowledge-base/search` | JWT | Run Hybrid RAG search |
| `POST` | `/api/knowledge-base/flush` | Admin | Flush the vector store |

### Dashboard, Alerts & Templates
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/stats` | JWT | Workspace statistics |
| `GET` | `/api/alerts` | JWT | List regulatory alerts |
| `PUT` | `/api/alerts/:id/acknowledge` | JWT | Acknowledge an alert |
| `GET` | `/api/templates` | JWT | List available legal/contract templates |

---

## 🗄️ Data Models

Defined in `backend/models/`:
- **User** (`user.js`): Name, email, bcrypt-hashed password, role (`admin` / user).
- **ChatSession** (`chat.js`): User reference, session title, messages array (sender, text, images, attachedDocs, reasoningChain, sources, timestamp).
- **Document** (`document.js`): Uploaded contract metadata, extracted text, risk analysis & findings.
- **ComplianceCheck** (`compliance.js`): Target profile, frameworks, compliance gaps, and checklist items.
