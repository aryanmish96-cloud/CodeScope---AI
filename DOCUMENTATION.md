# CodeScope AI — Project Documentation

> Intelligent GitHub repository analyzer with dependency graphs, architecture detection, security scanning, and Groq-powered AI explanations.

---

## Project Title

**CodeScope AI** (package name: `codescope-ai`)

---

## Project Overview

CodeScope AI is a full-stack web application that helps developers **understand unfamiliar codebases quickly**. A user pastes a **public GitHub repository URL**; the system **clones and parses** the repo locally, builds a **dependency graph** and **file tree**, infers **high-level architecture** (stack, project type), runs a **lightweight security pattern scan**, and exposes everything through a **React** UI. **Large language model (LLM) features**—repo summary, per-file explanation, chat with context, README generation, execution-flow simulation, and deep architecture analysis—are powered by the **Groq API** (default model: `llama-3.1-8b-instant`).

The codebase is split into:

- **`backend/`** — FastAPI service, analysis pipeline, Groq integration  
- **`frontend/`** — Vite + React SPA, axios client, proxy to `/api`

---

## Problem Statement / Purpose

**Problem:** Onboarding onto a new repository is slow: finding entry points, understanding module relationships, and locating risky patterns takes hours of manual reading.

**Purpose:** Automate **first-pass comprehension**: structural visualization, heuristic security signals, and **natural-language Q&A** grounded in the analyzed tree and file contents—without requiring users to configure a local clone workflow themselves (beyond providing a URL).

---

## Objectives

- Clone and parse **public GitHub** repositories into a navigable **tree** and **file content map**
- Visualize **import / dependency relationships** as an interactive graph
- Detect **architecture hints** (e.g., tech stack, project type) from file metadata and content
- Provide **fast local scans** for common security anti-patterns (no LLM required)
- Offer **session-scoped AI** features so follow-up calls do not re-clone the repo
- Deliver a **modern UI** (explorer, graph, dashboard, code view, chat) suitable for demos and daily use

---

## Key Features

| Area | Feature |
|------|---------|
| **Analysis** | Clone repo, build file tree, stats, git metadata |
| **Graph** | Dependency graph with metrics (e.g., important files) via NetworkX-backed pipeline |
| **Architecture** | Heuristic detection of stack / project type |
| **Security** | Regex-based “risk radar” (secrets, `eval`, shell, SQL string concat, XSS hints, etc.) |
| **AI — Summary** | JSON structured repo overview (elevator pitch, strengths/weaknesses, etc.) |
| **AI — File** | Explain file with optional ELI5 mode; JSON output |
| **AI — Chat** | Ask questions; responses include relevant files and optional **line highlights** for the UI |
| **AI — README** | Generate markdown README from context |
| **AI — Architecture** | Deeper LLM architecture pass with Mermaid-friendly JSON |
| **AI — Simulation** | Predicted execution steps for a file |
| **UI** | Hero landing, file explorer, React Flow graph, dashboard, syntax-highlighted code viewer, chat drawer, README modal |
| **Export** | **Generate Report (PDF)** — captures dependency graph, dashboard (incl. Mermaid diagram when present), AI panel, and optional code view into a downloadable PDF (`jspdf` + `html2canvas`) |

---

## Tech Stack

### Backend

| Technology | Role |
|------------|------|
| **Python 3** | Runtime |
| **FastAPI** | HTTP API, validation (Pydantic v2), OpenAPI docs |
| **Uvicorn** | ASGI server |
| **GitPython** | Clone repositories |
| **NetworkX** | Graph construction / metrics |
| **Groq** (`groq` SDK) | Chat completions, JSON mode where used |
| **python-dotenv** | Environment configuration |
| **httpx** | HTTP client (dependency) |

### Frontend

| Technology | Role |
|------------|------|
| **React 18** | UI |
| **Vite 5** | Dev server & build |
| **Axios** | API client (`baseURL` → `/api` or `VITE_API_URL`) |
| **Framer Motion** | Animations (hero, panels) |
| **@xyflow/react** | Dependency graph canvas |
| **react-syntax-highlighter** | Code view |
| **react-hot-toast** | Notifications |
| **Mermaid** (dep) | Diagram rendering where used in UI |

---

## Project Architecture

High-level data flow:

```text
┌─────────────┐     HTTPS      ┌──────────────────┐
│   Browser   │ ──────────────►│  Vite (dev)      │
│  React SPA  │   /api/* proxy │  or static CDN   │
└──────┬──────┘                └────────┬─────────┘
       │                               │
       └──────────────► FastAPI :8000 ◄─┘
                              │
                    ┌─────────┴─────────┐
                    │  /api/analyze     │──► clone + parse (repo_parser)
                    │  session store    │     build graph (graph_builder)
                    │  in-memory dict   │     architecture (architecture)
                    └─────────┬─────────┘     risks (ai_engine.scan_security_risks)
                              │
                    ┌─────────┴─────────┐
                    │  /api/summarize   │──► Groq (summarize_repo)
                    │  /api/explain-file│──► Groq (explain_file)
                    │  /api/chat        │──► Groq (chat_with_repo) + path normalize
                    │  ...              │
                    └───────────────────┘
```

- **Session model:** After `/api/analyze`, a **`session_id`** is returned and stored server-side with parsed `files`, `graph`, `arch`, etc. Subsequent AI routes require this **`session_id`** (and file paths for file-specific routes).
- **Frontend** defaults to **`VITE_API_URL` unset** → requests go to **`/api/...`**; Vite proxies `/api` to `http://127.0.0.1:8000` (see `frontend/vite.config.js`).

---

## Folder / File Structure

```text
UDBHAV/
├── backend/
│   ├── main.py              # FastAPI app, routes under /api, session store
│   ├── ai_engine.py         # Groq client, prompts, summarize/explain/chat/README/simulate/arch
│   ├── repo_parser.py       # Git clone, tree, imports, file contents
│   ├── graph_builder.py     # Dependency graph + metrics
│   ├── architecture.py      # Heuristic architecture detection
│   ├── requirements.txt
│   ├── .env / .env.example  # Secrets (not committed with real keys)
│   └── test_*.py            # Ad-hoc / manual tests
├── frontend/
│   ├── package.json
│   ├── vite.config.js       # Dev server + /api proxy
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx            # Layout, session state, analyze flow
│       ├── index.css          # Global + hero styles
│       ├── api/
│       │   └── client.js      # Axios instance, API helpers
│       └── components/
│           ├── Hero.jsx
│           ├── FileExplorer.jsx
│           ├── DependencyGraph.jsx
│           ├── Dashboard.jsx
│           ├── AIPanel.jsx
│           ├── CodeViewer.jsx
│           ├── ChatAssistant.jsx
│           ├── ExecutionSimulator.jsx
│           ├── ReadmeModal.jsx
│           ├── MermaidGraph.jsx
│           ├── LoadingOverlay.jsx
│           └── ...
└── DOCUMENTATION.md           # This file
```

---

## Main Modules / Components

### Backend

- **`main.py`** — HTTP layer, Pydantic models, `_sessions` map, optional `_normalize_chat_output` for chat paths  
- **`repo_parser.py`** — Clone to temp dir, walk files, skip heavy dirs, extract imports per language  
- **`graph_builder.py`** — Graph nodes/edges from files + imports, importance metrics  
- **`architecture.py`** — Project type / tech stack heuristics  
- **`ai_engine.py`** — All Groq calls, JSON response formats, `scan_security_risks` (local regex)

### Frontend

- **`App.jsx`** — Orchestrates analyze → explorer view, tabs (graph / dashboard / code), chat & README modals  
- **`api/client.js`** — `analyzeRepo`, `summarizeRepo`, `explainFile`, `chatWithRepo`, etc.  
- **`Hero.jsx`** — Landing, URL validation, sample repos  
- **`DependencyGraph.jsx`** — React Flow visualization  
- **`AIPanel.jsx` / `CodeViewer.jsx` / `ChatAssistant.jsx`** — AI and code UX  

---

## Important Files and Their Purpose

| File | Purpose |
|------|---------|
| `backend/main.py` | API surface, session lifecycle, wires parsers + `ai_engine` |
| `backend/ai_engine.py` | Model ID, prompts, Groq `chat.completions`, security regex scan |
| `backend/repo_parser.py` | **Single source of truth** for cloned file map and imports |
| `frontend/src/api/client.js` | Central place for endpoint paths and axios config |
| `frontend/vite.config.js` | **`/api` → 8000** proxy for local development |
| `backend/.env` | **`GROQ_API_KEY`** (required for AI routes) |

---

## Installation

### Prerequisites

- **Python 3.10+** (recommended) with `pip`
- **Node.js 18+** and **npm**
- **Git** (used by GitPython to clone repos)
- A **Groq API key** for LLM features

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

---

## Setup Instructions

1. **Clone** this repository (or copy the project folder).
2. **Backend env:** Copy `backend/.env.example` to `backend/.env` and set:
   - `GROQ_API_KEY` — required for AI endpoints  
   - `GITHUB_TOKEN` — optional; may help with rate limits on GitHub API / clones if extended  
3. **Frontend (production builds):** If the API is not same-origin, set `VITE_API_URL` to the full API root including `/api`, e.g. `https://api.example.com/api` (see `client.js`).

---

## How to Run the Project

### Development (two terminals)

**Terminal 1 — API**

```bash
cd backend
python main.py
```

Default: **http://0.0.0.0:8000** (health: `GET http://127.0.0.1:8000/health`)

**Terminal 2 — UI**

```bash
cd frontend
npm run dev
```

Open the URL Vite prints (often **http://localhost:3000**; another port if busy). The SPA calls **`/api/...`**, which the dev server proxies to port **8000**.

### Production-style

- Build frontend: `cd frontend && npm run build`  
- Serve `frontend/dist` with any static host  
- Run backend with Uvicorn/Gunicorn behind a reverse proxy; set `VITE_API_URL` at build time to point to your public API origin  

---

## Configuration / Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | `backend/.env` | **Required** for Groq-backed routes |
| `GITHUB_TOKEN` | `backend/.env` | Optional token for GitHub operations if you extend the clone layer |
| `VITE_API_URL` | `frontend` build env | Optional; defaults to `/api` in the browser. Set to full API root (with `/api`) when the API is on another host |

Model name is defined in code (`ai_engine.py`, e.g. `llama-3.1-8b-instant`).

---

## API Endpoints

Base path for JSON APIs: **`/api`**. Health is at **`/`** root.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness; returns status and model/provider info |
| `POST` | `/api/analyze` | Body: `{ "repo_url": "https://..." }` → analysis + **`session_id`** |
| `POST` | `/api/summarize` | Body: `{ "session_id": "..." }` → AI repo summary |
| `POST` | `/api/explain-file` | Body: `{ "session_id", "file_path", "eli5"?: bool }` |
| `POST` | `/api/simulate-execution` | Body: `{ "session_id", "file_path" }` |
| `POST` | `/api/chat` | Body: `{ "session_id", "question", "history": [] }` |
| `POST` | `/api/generate-readme` | Body: `{ "session_id" }` |
| `POST` | `/api/analyze-architecture` | Body: `{ "session_id" }` → LLM architecture JSON |
| `GET` | `/api/file-content` | Query: `session_id`, `file_path` |

Interactive docs: **`/docs`** (Swagger UI) when the server is running.

---

## Workflow / Internal Working

1. **Analyze:** User submits `repo_url` → `parse_repository` clones and walks the tree → imports extracted → `build_graph` + `detect_architecture` + `scan_security_risks` → response includes `session_id` and payloads; session stored in `_sessions[session_id]`.
2. **Summarize / explain / chat:** Request includes `session_id` → server loads `files`, `graph`, `arch` from memory → Groq prompts built with truncated content and paths → JSON parsed and returned (chat highlights normalized to real paths when possible).
3. **Frontend:** After analyze, UI stores `session_id` and renders explorer + graph; AI calls pass `session_id` and paths from the tree.

---

## User Flow

1. User opens the **Hero** page and enters a **valid `https://` GitHub URL** (or picks a sample).  
2. **Loading overlay** runs while `/api/analyze` completes.  
3. User lands on **explorer + graph + dashboard**; optional **background** call to `/api/summarize`.  
4. User selects **files** → **Code** tab and **AIPanel** can call `/api/explain-file`.  
5. User opens **Chat** → `/api/chat`; answers may include **highlights** → UI jumps to **Code** view with line ranges.  
6. **README** / **architecture** actions call their respective endpoints when triggered from the dashboard or modals.

---

## Dependencies Used

### Python (`backend/requirements.txt`)

`fastapi`, `uvicorn[standard]`, `gitpython`, `networkx`, `groq`, `python-dotenv`, `aiofiles`, `python-multipart`, `httpx`, `pydantic`

### JavaScript (`frontend/package.json`)

Core: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `axios`, `framer-motion`, `@xyflow/react`, `react-syntax-highlighter`, `react-hot-toast`, `react-markdown`, `remark-gfm`, `mermaid`, `lucide-react`, `react-icons`, plus TypeScript types for React in devDependencies.

---

## Strengths

- **Clear separation:** parsing / graph / LLM in distinct modules  
- **Session cache** avoids re-cloning for each AI question  
- **Structured LLM outputs** (JSON) for predictable UI rendering  
- **Local security scan** works without AI  
- **Modern SPA** with graphs, syntax highlighting, and chat  

---

## Limitations

- **In-memory sessions** — lost on server restart; not shared across multiple workers without external store  
- **Public GitHub URLs** assumed for the default flow; private repos need auth extensions  
- **LLM accuracy** depends on model and context windows; large files are truncated in prompts  
- **CORS** is permissive (`*`) in code — tighten for production  
- **Rate limits** on Groq / GitHub apply per your account  

---

## Security and Scalability Notes

- **Secrets:** Never commit `.env`; rotate `GROQ_API_KEY` if leaked  
- **Production:** Restrict CORS, use HTTPS, put FastAPI behind a reverse proxy, add rate limiting on `/api/analyze`  
- **Scale-out:** Replace in-memory `_sessions` with **Redis** or a database + object storage for large repos; use a **job queue** for long clones  
- **Multi-instance:** Sticky sessions or shared session store required  

---

## Future Improvements

- Persistent sessions and user accounts  
- Incremental re-analysis on branch/tag select  
- Stronger secret scanning and optional SAST integration  
- Streaming LLM responses in chat  
- Caching of summaries per `(session, file)`  
- Docker Compose for one-command dev/prod  

---

## Beginner-Friendly Explanation

Imagine you join a team and receive a huge GitHub repo. **CodeScope AI** is like a smart tour guide: you give it the repo’s link, and it **downloads a copy**, **draws a map** of how files connect, **flags a few common security mistakes**, and lets you **ask questions in plain English** about the code. The **purple graph** shows dependencies; the **side panel** can explain a single file; **chat** can point you to the right file and even **highlight line numbers** so you see the important logic fast. You still need to verify everything—AI can be wrong—but you spend less time figuring out *where* to look.

---

## Final Conclusion

**CodeScope AI** is a cohesive **FastAPI + React** product for **repository intelligence**: deterministic parsing and graphs combined with **Groq-powered** explanations and chat. It is suitable as a **portfolio piece**, **internal tool prototype**, or **starting point** for a larger code-understanding platform—provided you harden deployment, session storage, and API governance for real production traffic.

---

*Documentation version: aligned with repository layout and `/api` routing. Update this file when adding routes or changing environment variables.*
