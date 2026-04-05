"""
ai_engine.py – Groq integration for CodeScope AI.
Handles: file explanation, repo summary, ELI5, chat, README generation, risk radar.
"""

from __future__ import annotations

import os
import re
import time
import json
from typing import Any

from groq import Groq

_client: Groq | None = None

def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set in environment")
        _client = Groq(api_key=api_key)
    return _client

MODEL_NAME = "llama-3.1-8b-instant"

# ── confidence heuristic ────────────────────────────────────────────────────────
def _confidence(had_content: bool) -> int:
    """Return a 0-100 confidence score based on success."""
    return 85 if had_content else 30

# ── file explanation ────────────────────────────────────────────────────────────
def explain_file(
    path: str,
    content: str,
    *,
    eli5: bool = False,
    tech_stack: list[str] | None = None,
) -> dict[str, Any]:
    client = _get_client()
    tech_hint = f"Tech stack context: {', '.join(tech_stack)}." if tech_stack else ""

    if eli5:
        style = "Explain this code like I'm 10 years old. Use simple words, fun analogies, and avoid jargon."
    else:
        style = "Explain this code clearly to a senior developer. Be concise and precise."

    system = "You are a helpful assistant that outputs JSON."
    prompt = f"""{style}

File: {path}
{tech_hint}

```
{content[:8000]}
```

Respond with a JSON object with these exact keys:
 {{
   "summary": "2-3 sentence overview of what this file does",
   "key_functions": [
     {{ "name": "functionName", "description": "concise description" }}
   ],
   "logic_flow": "step-by-step description of the main logic flow",
   "role_in_project": "what role does this file play in the overall project",
   "complexity_notes": "notable complexity, patterns, or anti-patterns",
   "security_flags": ["any potential security issues found, empty list if none"]
 }}
"""
    t0 = time.time()
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            max_tokens=1536,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
    except Exception as e:
        print(f"Groq Explain Error: {e}")
        data = {"summary": f"Failed to analyze code: {str(e)}", "key_functions": [], "logic_flow": "", "role_in_project": "", "complexity_notes": "", "security_flags": []}

    elapsed = time.time() - t0
    data["confidence"] = _confidence(bool(data.get("summary")))
    data["latency_ms"] = int(elapsed * 1000)
    return data

# ── repo 60-second summary ────────────────────────────────────────────────────────
def summarize_repo(
    repo_url: str,
    repo_name: str,
    tech_stack: list[str],
    file_count: int,
    total_lines: int,
    important_files: list[dict],
    project_type: str,
    sample_contents: dict[str, str],
) -> dict[str, Any]:
    client = _get_client()

    samples_text = ""
    for path, content in list(sample_contents.items())[:4]:
        samples_text += f"\n### {path}\n```\n{content[:1500]}\n```\n"

    system = "You are a helpful assistant that outputs JSON."
    prompt = f"""You are analyzing the GitHub repository: {repo_name}
URL: {repo_url}

Project type: {project_type}
Tech stack: {', '.join(tech_stack) or 'Unknown'}
Files: {file_count} | Total lines: {total_lines:,}
Most important files: {', '.join(f['path'] for f in important_files[:5])}

Sample file contents:{samples_text}

Provide a comprehensive repository analysis as JSON:
{{
  "elevator_pitch": "One punchy sentence describing what this repo does",
  "detailed_summary": "3-4 sentence summary of the project purpose, architecture, and usage",
  "sixty_second_explanation": "A 60-second verbal explanation a developer could give to a non-technical stakeholder",
  "strengths": ["list of 3-5 architectural or code strengths"],
  "weaknesses": ["list of 2-3 potential issues or areas for improvement"],
  "use_cases": ["2-3 real-world use cases for this project"],
  "getting_started": "One paragraph on how to get started with this codebase",
  "complexity_assessment": "low | medium | high",
  "maintainability_score": 0-10
}}"""

    t0 = time.time()
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            max_tokens=1536,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
    except Exception as e:
        print(f"Groq Summarize Error: {e}")
        data = {"elevator_pitch": f"Failed to analyze repo logic: {str(e)}", "detailed_summary": "", "sixty_second_explanation": ""}

    elapsed = time.time() - t0
    data["confidence"] = _confidence(True)
    data["latency_ms"] = int(elapsed * 1000)
    return data

# ── chat with repo ────────────────────────────────────────────────────────────────
def chat_with_repo(
    question: str,
    repo_context: dict[str, Any],
    conversation_history: list[dict],
) -> dict[str, Any]:
    client = _get_client()

    paths = repo_context.get("file_paths_sample") or []
    paths_block = "\n".join(paths[:120]) if paths else "(file list unavailable)"
    important = repo_context.get("important_files") or []
    important_paths = ", ".join(
        f["path"] for f in important[:12] if isinstance(f, dict) and f.get("path")
    )

    system = f"""You are an expert codebase assistant.

Your task:
1. Answer the user's question clearly and point to concrete code locations when possible.
2. List the most relevant repository files (use EXACT paths from the lists below).
3. For logic/behavior questions, you MUST add "highlights": precise 1-based line ranges (inclusive) showing where that logic lives so the UI can jump there.

Return STRICT JSON only:
{{
  "answer": "Clear explanation referencing the highlighted code when applicable",
  "relevant_files": ["path/from/repo/root.py", "other.js"],
  "reason": "One short sentence on why these files matter",
  "highlights": [
    {{ "file": "path/from/repo/root.py", "lines": [start_line, end_line] }}
  ]
}}

Rules for "highlights":
* "lines" is always exactly two integers: [start_line, end_line] inclusive (1-based line numbers in the file).
* Prefer a tight range (often 5–40 lines) around the key logic, not the whole file.
* When the question is about how something works, include at least one highlight if any file path matches the lists below.
* Use paths that appear verbatim in "Known paths" or "Important files" when possible.

Repository: {repo_context.get('repo_name', 'Unknown')}
Tech stack: {', '.join(repo_context.get('tech_stack', []))}
Important files: {important_paths or '—'}

Known paths (substring match allowed; prefer these exact strings):
{paths_block}
"""

    messages = [{"role": "system", "content": system}]
    
    for turn in conversation_history[-6:]:
        role = "assistant" if turn.get("role") == "assistant" else "user"
        content = turn.get("content")
        if not content:
            continue
        messages.append({"role": role, "content": str(content)})
        
    messages.append({"role": "user", "content": question})

    t0 = time.time()
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=1536,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
        answer = data.get("answer", "")
        relevant_files = data.get("relevant_files", [])
        reason = data.get("reason", "")
        highlights = data.get("highlights", [])
    except Exception as e:
        print(f"Groq Chat Error: {e}")
        answer = f"Error communicating with AI: {str(e)}"
        relevant_files = []
        reason = ""
        highlights = []
        
    elapsed = time.time() - t0

    return {
        "answer": answer,
        "relevant_files": relevant_files,
        "reason": reason,
        "highlights": highlights,
        "confidence": _confidence(True),
        "latency_ms": int(elapsed * 1000),
    }

# ── README generator ──────────────────────────────────────────────────────────────
def generate_readme(
    repo_name: str,
    tech_stack: list[str],
    project_type: str,
    summary: str,
    important_files: list[dict],
    architecture_flow: list[dict],
) -> dict[str, Any]:
    client = _get_client()

    flow_str = " → ".join(s["label"] for s in architecture_flow)

    prompt = f"""Generate a professional, impressive GitHub README.md for this project:

Repository: {repo_name}
Type: {project_type}
Stack: {', '.join(tech_stack)}
Summary: {summary}
Architecture: {flow_str}
Key files: {', '.join(f['path'] for f in important_files[:5])}

Include:
- Eye-catching header with badges
- Clear project description
- Feature list with emojis
- Installation instructions (generic based on detected stack)
- Usage examples
- Architecture section
- Contributing section
- License section

Make it look like a top GitHub project. Use proper markdown formatting."""

    t0 = time.time()
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1536,
        )
        readme = response.choices[0].message.content or ""
    except Exception as e:
        readme = f"# Error generating README\n{str(e)}"
    elapsed = time.time() - t0

    return {
        "readme": readme,
        "latency_ms": int(elapsed * 1000),
    }


# ── Execution Simulator ────────────────────────────────────────────────────────
def simulate_execution(
    path: str,
    content: str,
    tech_stack: list[str] | None = None,
) -> dict[str, Any]:
    """
    AI-predicted execution flow simulator.
    Returns a sequence of steps showing how this code would typically run.
    """
    client = _get_client()
    tech_hint = f"Tech stack: {', '.join(tech_stack)}." if tech_stack else ""

    system = "You are a senior systems architect. You output JSON only."
    prompt = f"""Predict the step-by-step execution flow of this file: {path}
{tech_hint}

```
{content[:8000]}
```

Provide a high-fidelity sequence of logical steps of how this code executes (at runtime).
Focus on: triggers, data flow, validations, transformations, and final outputs.

Return output in STRICT JSON format:
{{
  "steps": [
    {{ "id": 1, "label": "Short Action (3-5 words)", "description": "Detailed explanation of what happens here", "icon": "emoji" }},
    ...
  ],
  "trigger": "What triggers this file (e.g., HTTP Request, Cron, Import)",
  "data_objects": ["main data objects involved"]
}}

IMPORTANT:
* Maximum 6-8 steps
* Icons should be tech-relevant emojis
* Make descriptions punchy and technical
"""

    t0 = time.time()
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            max_tokens=1536,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
    except Exception as e:
        print(f"Groq Simulation Error: {e}")
        data = {
            "steps": [{"id": 1, "label": "Analysis Failed", "description": str(e), "icon": "❌"}],
            "trigger": "Error",
            "data_objects": []
        }

    elapsed = time.time() - t0
    data["latency_ms"] = int(elapsed * 1000)
    data["confidence"] = _confidence(bool(data.get("steps")))
    return data


# ── AI Architecture Analysis ─────────────────────────────────────────────────────
def analyze_architecture(
    repo_name: str,
    files: dict[str, dict],
    tech_stack: list[str],
    project_type: str,
) -> dict[str, Any]:
    """
    AI-powered deep architecture analysis using the expert software architect prompt.
    Returns structured JSON with frontend, backend, database, APIs, and architecture flow.
    """
    client = _get_client()

    # Collect file paths
    file_list = list(files.keys())[:200]
    file_list_str = "\n".join(file_list)

    # Collect code snippets from key files
    key_extensions = {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rs", ".yaml", ".yml", ".json", ".toml"}
    snippets = []
    char_budget = 3000
    for path, data in files.items():
        ext = "." + path.rsplit(".", 1)[-1] if "." in path else ""
        if ext.lower() in key_extensions and data.get("content", "").strip():
            snippet = data["content"][:800]
            snippets.append(f"### {path}\n```\n{snippet}\n```")
            char_budget -= len(snippet)
            if char_budget <= 0:
                break

    code_snippets_str = "\n\n".join(snippets) if snippets else "No code snippets available."

    system = "You are an expert software architect. You output JSON only."
    prompt = f"""Analyze the following project files and code snippets.

Your task:

1. Identify the system architecture

2. Detect:
   * Frontend technology
   * Backend framework
   * Database (if any)
   * APIs / services

3. Classify components into:
   * Frontend
   * Backend
   * Database
   * Utilities / Config

4. Provide output in STRICT JSON format:

{{
  "frontend": "...",
  "backend": "...",
  "database": "...",
  "apis": ["..."],
  "mermaid_diagram": "graph TD\\n  A[Frontend] --> B[Backend]\\n  B --> C[(Database)]",
  "explanation": "Short explanation of how the system works"
}}

IMPORTANT:
- The "mermaid_diagram" MUST contain ONLY raw, valid Mermaid syntax. Do not wrap it in markdown backticks inside the string. Use 'graph TD' format.
- DO NOT use unicode arrows like '—>'. Always use standard ASCII arrows like '-->'.
- Keep node labels simple strings without weird brackets or quotes if possible.
* Be accurate and do not hallucinate
* If something is not found, return "Not detected"
* Keep explanation short (3-4 lines max)

Project Files:
{file_list_str}

Code Snippets:
{code_snippets_str}
"""

    t0 = time.time()
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            max_tokens=1536,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
    except Exception as e:
        print(f"Groq Architecture Error: {e}")
        data = {
            "frontend": "Analysis failed",
            "backend": "Analysis failed",
            "database": "Not detected",
            "apis": [],
            "architecture_flow": [],
            "explanation": f"Error: {str(e)}"
        }

    elapsed = time.time() - t0
    data["confidence"] = _confidence(bool(data.get("explanation")))
    data["latency_ms"] = int(elapsed * 1000)
    return data

# ── risk radar ────────────────────────────────────────────────────────────────────
def scan_security_risks(files: dict[str, dict]) -> list[dict]:
    """
    Quick local scan for common security anti-patterns.
    No AI call – pure regex for speed.
    """
    RISK_PATTERNS = [
        (r"(?:password|secret|api_key|apikey|token)\s*=\s*['\"][^'\"]{4,}['\"]", "Hardcoded Secret", "critical"),
        (r"eval\s*\(", "eval() Usage", "high"),
        (r"exec\s*\(", "exec() Usage", "high"),
        (r"shell=True", "Shell Injection Risk", "high"),
        (r"SELECT\s+.+\s+FROM.+\+", "Potential SQL Injection", "critical"),
        (r"innerHTML\s*=", "XSS Risk via innerHTML", "high"),
        (r"document\.write\(", "XSS Risk via document.write", "medium"),
        (r"http://(?!localhost|127)", "Non-HTTPS URL", "medium"),
        (r"TODO|FIXME|HACK|XXX", "Technical Debt Marker", "low"),
        (r"console\.log\(", "Debug Console.log", "low"),
    ]

    findings = []
    for path, data in files.items():
        content = data.get("content", "")
        for pattern, label, severity in RISK_PATTERNS:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                findings.append({
                    "file": path,
                    "risk": label,
                    "severity": severity,
                    "occurrences": len(matches),
                })

    # Sort by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    findings.sort(key=lambda f: severity_order.get(f["severity"], 4))
    return findings[:30]  # cap at 30
