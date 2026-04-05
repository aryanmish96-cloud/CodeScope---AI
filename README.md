# CodeScope AI

**Intelligent GitHub repository explorer** — dependency graphs, architecture hints, security scanning, and **Groq**-powered explanations in one web app.

![Stack](https://img.shields.io/badge/API-FastAPI-009688?style=flat-square)
![UI](https://img.shields.io/badge/UI-React%20%2B%20Vite-61DAFB?style=flat-square)
![LLM](https://img.shields.io/badge/LLM-Groq-8B5CF6?style=flat-square)

## Quick start

**1. Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # set GROQ_API_KEY
python main.py
```

API: `http://127.0.0.1:8000` — [`GET /health`](http://127.0.0.1:8000/health)

**2. Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open the local URL Vite prints (e.g. `http://localhost:3000`). Requests to `/api` are proxied to the backend.

## Documentation

Full project documentation (architecture, API, setup, security, roadmap) is in **[DOCUMENTATION.md](./DOCUMENTATION.md)**.

## What it does

| | |
|--|--|
| **Analyze** | Clone a public GitHub repo, build a file tree and dependency graph |
| **Dashboard** | Stats, architecture heuristics, risk radar |
| **AI** | Repo summary, per-file explain, chat with line highlights, README generation |

---

Ensure compliance with **Groq** and **GitHub** terms of service for API and repository access.
