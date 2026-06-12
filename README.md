# Antigravity Legal AI - Full-Stack Compliance Assistant

An Agentic AI-Based Legal Information and Compliance Assistance System featuring Retrieval-Augmented Generation (RAG), a local vector database pipeline, real-time contract risk scoring, and a multi-agent reasoning chain visualizer.

---

## Technical Stack
- **Frontend**: React (Vite) + Tailwind CSS + Lucide Icons
- **Backend**: Node.js + Express + Multer
- **Database**: MongoDB (Mongoose schemas)
- **Vector Index Store**: Custom local JSON file-based database (`vectorstore/`) calculating Cosine Similarity (supporting OpenAI / Gemini embeddings, with an optimized TF-IDF word vector fallback if no API keys are configured).
- **AI Engine**: Route workflows to OpenAI `gpt-4o-mini` or Google Gemini `gemini-1.5-flash` (configurable in `.env`).
- **Authentication**: JWT Authorization (Secure User/Admin roles).

---

## System Architecture

```
c:\project\legal ai\
├── frontend/                   # React (Vite) + Tailwind CSS Frontend
├── backend/                    # Node.js Express Backend
│   ├── routes/                 # REST Endpoints (Auth, Chat, Docs, Compliance)
│   ├── controllers/            # Logic controllers
│   ├── services/               # Vector Store and Sync services
│   ├── agents/                 # State Graph Multi-Agents (Planner, Retriever, etc.)
│   └── utils/                  # Utility helper models (PDF parser)
├── models/                     # MongoDB Database Schemas
├── vectorstore/                # Local Vector Store indices persistence
├── package.json                # Root coordinator scripts
└── .env                        # Server credentials config
```

---

## How to Get Started

### Prerequisites
1. **Node.js** (v18 or higher recommended)
2. **MongoDB** (A local instance listening on `127.0.0.1:27017` is required. The server connects automatically to `mongodb://127.0.0.1:27017/legal-ai`).

### Installation

1. Clone or navigate to the project directory:
   ```bash
   cd "d:\Desktop\Agentic AI project"
   ```

2. Run the root installer script to automatically download all node dependencies for the root, backend, and frontend directories:
   ```bash
   npm run install:all
   ```

3. Configure environment variables. Edit the template `.env` inside `backend/.env`:
   ```env
   PORT=8080
   MONGO_URI=mongodb://127.0.0.1:27017/legal-ai
   JWT_SECRET=antigravity_legal_ai_super_secret_token_key_2026
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```
   *(Note: The system will run perfectly in Heuristic/TF-IDF fallback mode if you leave the Gemini/OpenAI API keys blank!)*

---

## Running the Application

To run the full stack concurrently (Express server on port `8080` + Vite React frontend on port `5173`):

1. **Launch the Backend API Server**:
   In a new terminal window:
   ```bash
   npm run backend
   ```

2. **Launch the Frontend Client**:
   In another terminal window:
   ```bash
   npm run frontend
   ```

3. Open **[http://localhost:8081](http://localhost:8081)** in your browser!

---

## Verifying Features

1. **User Sign Up**: Create an account via the auth page to log in and obtain your secure JWT token.
2. **Contract Auditor**:
   - Go to the Auditor tab.
   - Upload any contract PDF/TXT file, or click **"Cloud SaaS Template"** / **"Omni Privacy Template"** to load pre-made high-risk samples.
   - Click **"Initiate Agent Audit"**.
   - Check the computed risk score out of 100, read the classified risk severities, and check the side-by-side Suggested Rewrite cards.
3. **Legal RAG Chatbot**:
   - Click the **"RAG Chat"** tab.
   - Submit queries like: *"What is the data breach notification deadline under GDPR?"* or *"Tamil: தரவு பாதுகாப்பு கொள்கைகள் என்ன?"*.
   - Click the **"🧠 AGENT REASONING CHAIN"** accordion above the answer to watch the active Planner, Retriever, Compliance, and Response agents report their logs in real-time.
   - Cites the specific documents retrieved from the vector store index.
4. **Regulatory Checklist (Tracker)**:
   - Run a compliance check for your business profile (e.g., sector: **AI**, geography: **EU**).
   - Toggle compliance items completed/pending, and watch the score dynamically recalculate and log to MongoDB.
5. **Control Panel**:
   - Save your API keys securely at runtime.
   - Admins can flush and re-index the entire RAG dataset with a single click.
