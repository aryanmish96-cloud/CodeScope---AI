"""
main.py – FastAPI application entry point for CodeScope AI backend.
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
import traceback
from typing import Any

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

# Ensure .env is loaded from the backend directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from repo_parser import parse_repository, RepoTooLargeError
from graph_builder import build_graph
from architecture import detect_architecture
from ai_engine import (
    generate_readme,
    scan_security_risks,
    analyze_architecture as ai_analyze_architecture,
    simulate_execution,
    summarize_repo,
    explain_file,
    chat_with_repo,
)

logger = logging.getLogger("codescope")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")

# ── App setup ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CodeScope AI API",
    description="Intelligent Codebase Explorer & Explainer",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Error Handlers ─────────────────────────────────────────────────────────────
@app.exception_handler(RepoTooLargeError)
async def repo_too_large_handler(request: Request, exc: RepoTooLargeError):
    return JSONResponse(
        status_code=413,  # Payload Too Large
        content={"detail": str(exc)},
    )

# All JSON API routes live under /api (matches Vite proxy and direct backend calls)
api = APIRouter(prefix="/api", tags=["codescope"])

# ── In-memory session store ──────────────────────────────────────────────────────
# Maps session_id → full analysis payload (to avoid re-cloning on every request)
_sessions: dict[str, dict[str, Any]] = {}


# ── Request / Response Models ────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    repo_url: str = Field(..., min_length=1, description="HTTPS GitHub repository URL")
    session_id: str | None = None

    @field_validator("repo_url")
    @classmethod
    def repo_url_nonempty(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("repo_url cannot be empty")
        return s


class SummarizeRequest(BaseModel):
    session_id: str = Field(..., min_length=1)

    @field_validator("session_id")
    @classmethod
    def session_id_nonempty(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("session_id is required")
        return s


class FileExplainRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    file_path: str = Field(..., min_length=1)
    eli5: bool = False

    @field_validator("session_id", "file_path")
    @classmethod
    def strip_strings(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("field cannot be empty")
        return s


class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)
    history: list[dict] = Field(default_factory=list)

    @field_validator("session_id", "question")
    @classmethod
    def chat_strip(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("field cannot be empty")
        return s


class ReadmeRequest(BaseModel):
    session_id: str = Field(..., min_length=1)

    @field_validator("session_id")
    @classmethod
    def readme_session(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("session_id is required")
        return s


# ── Health check ────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": "llama-3.1-8b-instant", "provider": "groq"}


# ── Analyze repository ────────────────────────────────────────────────────────────
@api.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """
    Clone and fully analyze a GitHub repository.
    Returns: file tree, dependency graph, architecture, stats, security risks.
    """
    repo_url = req.repo_url
    if not repo_url.startswith("http"):
        raise HTTPException(400, "Invalid repository URL — must start with http:// or https://")

    logger.info("POST /api/analyze repo_url=%s", repo_url[:120])

    try:
        # 1. Parse repository
        parsed = parse_repository(repo_url)
        files = parsed["files"]
        imports = parsed["imports"]
        stats = parsed["stats"]
        tree = parsed["tree"]
        git_meta = parsed.get("git", {})

        # 2. Build dependency graph
        graph = build_graph(files, imports)

        # 3. Detect architecture
        arch = detect_architecture(files)

        # 4. Scan security risks (fast, no AI)
        risks = scan_security_risks(files)

        # 5. session_id = repo name + timestamp hash
        session_id = hashlib.md5(f"{repo_url}{time.time()}".encode()).hexdigest()[:12]
        logger.info("Created session_id=%s for repo=%s", session_id, stats["repo_name"])

        # Store session
        _sessions[session_id] = {
            "repo_url": repo_url,
            "repo_name": stats["repo_name"],
            "files": files,
            "imports": imports,
            "stats": stats,
            "arch": arch,
            "graph": graph,
            "git": git_meta,
        }

        return {
            "session_id": session_id,
            "repo_name": stats["repo_name"],
            "tree": tree,
            "graph": graph,
            "architecture": arch,
            "stats": {
                **stats,
                "git": git_meta,
            },
            "security_risks": risks,
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Analysis failed: {str(e)}")


# ── AI Repo Summary ──────────────────────────────────────────────────────────────
@api.post("/summarize")
async def summarize(req: SummarizeRequest):
    """Get AI-powered repo summary (call after /api/analyze)."""
    logger.info("POST /api/summarize session_id=%s", req.session_id)
    session = _sessions.get(req.session_id)
    if not session:
        logger.warning("Session missing for summarize: %s (known: %d)", req.session_id, len(_sessions))
        raise HTTPException(
            404,
            "Session not found. Run /api/analyze again (sessions are in-memory and reset if the server restarts).",
        )

    files = session["files"]
    arch = session["arch"]
    graph = session["graph"]

    # Pick sample files for context
    important_paths = [f["path"] for f in graph["metrics"]["important_files"]]
    sample_contents = {
        p: files[p]["content"] for p in important_paths if p in files
    }

    try:
        result = summarize_repo(
            repo_url=session.get("repo_url", "Unknown"),
            repo_name=session["repo_name"],
            tech_stack=arch["tech_stack"],
            file_count=session["stats"]["file_count"],
            total_lines=session["stats"]["total_lines"],
            important_files=graph["metrics"]["important_files"],
            project_type=arch["project_type"],
            sample_contents=sample_contents,
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Summarization failed: {str(e)}")


# ── File Explanation ──────────────────────────────────────────────────────────────
@api.post("/explain-file")
async def explain_file_endpoint(req: FileExplainRequest):
    """Get AI explanation for a specific file."""
    logger.info("POST /api/explain-file session_id=%s path=%s", req.session_id, req.file_path)
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, "Session not found. Run /api/analyze again.")

    file_data = session["files"].get(req.file_path)
    if not file_data:
        raise HTTPException(404, f"File not found: {req.file_path}")

    content = file_data.get("content", "")
    if not content.strip():
        return {
            "summary": "This file appears to be empty or binary.",
            "key_functions": [],
            "logic_flow": "",
            "role_in_project": "Unknown",
            "complexity_notes": "",
            "security_flags": [],
            "confidence": 0,
            "latency_ms": 0,
        }

    try:
        result = explain_file(
            path=req.file_path,
            content=content,
            eli5=req.eli5,
            tech_stack=session["arch"].get("tech_stack", []),
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Explanation failed: {str(e)}")


# ── Execution Simulation ────────────────────────────────────────────────────────
@api.post("/simulate-execution")
async def simulate_execution_endpoint(req: FileExplainRequest):
    """Get AI-predicted execution flow for a specific file."""
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, "Session not found. Run /api/analyze again.")

    file_data = session["files"].get(req.file_path)
    if not file_data:
        raise HTTPException(404, f"File not found: {req.file_path}")

    content = file_data.get("content", "")
    if not content.strip():
        return {
            "steps": [],
            "trigger": "Empty file",
            "data_objects": [],
            "confidence": 0,
            "latency_ms": 0,
        }

    try:
        result = simulate_execution(
            path=req.file_path,
            content=content,
            tech_stack=session["arch"].get("tech_stack", []),
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Simulation failed: {str(e)}")


def _normalize_chat_output(session: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    """Map AI file names to real session paths and normalize highlight line ranges."""
    file_keys = list(session.get("files", {}).keys())
    key_set = set(file_keys)

    def resolve_path(raw: str | None) -> str | None:
        if not raw or not isinstance(raw, str):
            return None
        p = raw.strip().replace("\\", "/").lstrip("/")
        if p in key_set:
            return p
        if f"./{p}" in key_set:
            return f"./{p}"
        base = p.split("/")[-1]
        candidates = [k for k in file_keys if k == p or k.endswith("/" + p) or k.endswith("/" + base)]
        if len(candidates) == 1:
            return candidates[0]
        if len(candidates) > 1:
            return sorted(candidates, key=len)[0]
        return None

    rel = result.get("relevant_files") or []
    resolved_files: list[str] = []
    for f in rel:
        if not isinstance(f, str):
            continue
        rp = resolve_path(f)
        resolved_files.append(rp if rp else f)
    seen: set[str] = set()
    out_files: list[str] = []
    for p in resolved_files:
        if p not in seen:
            seen.add(p)
            out_files.append(p)
    result["relevant_files"] = out_files

    raw_hl = result.get("highlights") or []
    out_hl: list[dict[str, Any]] = []
    for item in raw_hl:
        if not isinstance(item, dict):
            continue
        raw_fp = item.get("file") or item.get("path")
        rp = resolve_path(str(raw_fp) if raw_fp else "")
        lines = item.get("lines")
        if not isinstance(lines, list):
            lines = []
        nums: list[int] = []
        for x in lines:
            if isinstance(x, int) and x > 0:
                nums.append(x)
            elif isinstance(x, float) and x > 0:
                nums.append(int(x))
            elif isinstance(x, str) and x.strip().isdigit():
                nums.append(int(x.strip()))
        if not nums:
            continue
        start, end = min(nums), max(nums)
        if rp:
            out_hl.append({"file": rp, "lines": [start, end]})
    result["highlights"] = out_hl
    return result


# ── Chat ──────────────────────────────────────────────────────────────────────────
@api.post("/chat")
async def chat(req: ChatRequest):
    """Chat with the AI about the repository."""
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, "Session not found. Run /api/analyze again.")

    graph = session.get("graph", {})
    file_paths_sample = sorted(session.get("files", {}).keys())[:150]
    repo_context = {
        "repo_name": session["repo_name"],
        "tech_stack": session["arch"].get("tech_stack", []),
        "file_count": session["stats"]["file_count"],
        "important_files": graph.get("metrics", {}).get("important_files", []),
        "file_paths_sample": file_paths_sample,
    }

    try:
        result = chat_with_repo(
            question=req.question,
            repo_context=repo_context,
            conversation_history=req.history,
        )
        return _normalize_chat_output(session, result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Chat failed: {str(e)}")


# ── README Generator ──────────────────────────────────────────────────────────────
@api.post("/generate-readme")
async def readme(req: ReadmeRequest):
    """Generate a professional README for the repository."""
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, "Session not found. Run /api/analyze again.")

    arch = session["arch"]
    graph = session["graph"]

    # We need a summary first - use a brief placeholder if not cached
    summary_text = f"A {arch['project_type']} built with {', '.join(arch['tech_stack'][:3])}"

    try:
        result = generate_readme(
            repo_name=session["repo_name"],
            tech_stack=arch["tech_stack"],
            project_type=arch["project_type"],
            summary=summary_text,
            important_files=graph["metrics"]["important_files"],
            architecture_flow=arch.get("architecture_flow", []),
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"README generation failed: {str(e)}")


# ── AI Architecture Analysis ──────────────────────────────────────────────────────
@api.post("/analyze-architecture")
async def arch_analysis(req: SummarizeRequest):
    """Get AI-powered deep architecture analysis."""
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, "Session not found. Run /api/analyze again.")

    arch = session["arch"]
    try:
        result = ai_analyze_architecture(
            repo_name=session["repo_name"],
            files=session["files"],
            tech_stack=arch["tech_stack"],
            project_type=arch["project_type"],
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Architecture analysis failed: {str(e)}")


# ── File content (raw) ────────────────────────────────────────────────────────────
@api.get("/file-content")
async def file_content(session_id: str, file_path: str):
    """Get raw file content."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found.")
    file_data = session["files"].get(file_path)
    if not file_data:
        raise HTTPException(404, "File not found.")
    return {
        "path": file_path,
        "content": file_data.get("content", ""),
        "lines": file_data.get("lines", 0),
        "extension": file_data.get("extension", ""),
    }


app.include_router(api)


# ── Static files & SPA catch-all ───────────────────────────────────────────────
# In a real Docker build, frontend/dist will be copied to backend/dist or similar.
# We prioritize the FRONTEND_DIST_PATH env var, then fallback to relative path.
dist_path = os.getenv(
    "FRONTEND_DIST_PATH", 
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
)

logger.info(f"Looking for static files in: {dist_path}")

if os.path.exists(dist_path):
    logger.info("Static files directory found. Mounting /assets and SPA catch-all.")
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # If it's an API route that somehow leaked here, let it 404
        if full_path.startswith("api/"):
             raise HTTPException(status_code=404)
        
        # Check if file exists in dist (e.g. favicon.ico)
        local_file = os.path.join(dist_path, full_path)
        if os.path.isfile(local_file):
            return FileResponse(local_file)
        
        # Otherwise serve index.html for SPA routing
        index_file = os.path.join(dist_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        
        raise HTTPException(status_code=404, detail="Static files not found")
else:
    logger.warning(f"Static files directory NOT found at: {dist_path}. SPA will not be served.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
