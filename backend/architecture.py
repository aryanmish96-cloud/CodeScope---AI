"""
architecture.py – Detect tech stack, architecture layers, and generate architecture overview.
"""

from __future__ import annotations
import re
from pathlib import Path
from typing import Any


# ── Tech Stack Detectors ────────────────────────────────────────────────────────
STACK_SIGNALS: list[tuple[str, str, str]] = [
    # (file_pattern, keyword_in_file | None, tech_label)
    ("package.json",    "react",        "React"),
    ("package.json",    "next",         "Next.js"),
    ("package.json",    "vue",          "Vue.js"),
    ("package.json",    "svelte",       "Svelte"),
    ("package.json",    "angular",      "Angular"),
    ("package.json",    "express",      "Express.js"),
    ("package.json",    "fastify",      "Fastify"),
    ("package.json",    "typescript",   "TypeScript"),
    ("package.json",    "tailwindcss",  "Tailwind CSS"),
    ("requirements.txt","fastapi",      "FastAPI"),
    ("requirements.txt","django",       "Django"),
    ("requirements.txt","flask",        "Flask"),
    ("requirements.txt","sqlalchemy",   "SQLAlchemy"),
    ("requirements.txt","celery",       "Celery"),
    ("requirements.txt","pytorch",      "PyTorch"),
    ("requirements.txt","tensorflow",   "TensorFlow"),
    ("requirements.txt","anthropic",    "Claude AI"),
    ("requirements.txt","openai",       "OpenAI"),
    ("pom.xml",         "spring-boot",  "Spring Boot"),
    ("pom.xml",         "hibernate",    "Hibernate"),
    ("go.mod",          None,           "Go"),
    ("Cargo.toml",      None,           "Rust"),
    ("Gemfile",         "rails",        "Ruby on Rails"),
    ("composer.json",   "laravel",      "Laravel"),
    ("pubspec.yaml",    "flutter",      "Flutter"),
    ("docker-compose",  None,           "Docker Compose"),
    ("Dockerfile",      None,           "Docker"),
    ("kubernetes",      None,           "Kubernetes"),
    (".github/workflows", None,         "GitHub Actions"),
]

DB_SIGNALS = {
    "postgres": "PostgreSQL",
    "mysql":    "MySQL",
    "sqlite":   "SQLite",
    "mongodb":  "MongoDB",
    "redis":    "Redis",
    "supabase": "Supabase",
    "prisma":   "Prisma",
    "mongoose": "MongoDB",
    "firebase": "Firebase",
    "dynamodb": "DynamoDB",
}

LAYER_PATTERNS = {
    "frontend": [
        r"src/components", r"src/pages", r"src/views", r"public/",
        r"\.jsx?$", r"\.tsx?$", r"\.vue$", r"\.svelte$",
        r"index\.html", r"App\.(jsx?|tsx?)",
    ],
    "backend": [
        r"api/", r"routes/", r"controllers/", r"middleware/",
        r"server\.(js|ts|py)$", r"main\.(py|go|rs|java)$",
        r"app\.(py|js|ts)$", r"manage\.py$",
    ],
    "database": [
        r"migrations/", r"models/", r"schema\.(sql|prisma|graphql)$",
        r"db/", r"database/", r"\.sql$",
    ],
    "tests": [
        r"test/", r"tests/", r"__tests__/", r"spec/",
        r"\.test\.(js|ts|py)$", r"\.spec\.(js|ts)$",
    ],
    "infrastructure": [
        r"\.github/", r"Dockerfile", r"docker-compose",
        r"kubernetes/", r"k8s/", r"terraform/", r"\.yaml$",
    ],
}


def _file_contains(content: str, keyword: str) -> bool:
    return keyword.lower() in content.lower()


def detect_architecture(files: dict[str, dict]) -> dict[str, Any]:
    """
    Scan all file paths and contents to detect:
    - Tech stack
    - Architecture layers
    - Database tech
    - Project type (monolith / microservices / fullstack / library)
    """
    tech_stack: list[str] = []
    layers_detected: dict[str, bool] = {
        "frontend": False,
        "backend": False,
        "database": False,
        "tests": False,
        "infrastructure": False,
    }
    databases: list[str] = []
    all_paths = list(files.keys())
    path_str = "\n".join(all_paths)

    # Detect tech stack
    for file_pattern, keyword, label in STACK_SIGNALS:
        for path, data in files.items():
            if file_pattern.lower() in path.lower():
                if keyword is None:
                    if label not in tech_stack:
                        tech_stack.append(label)
                    break
                else:
                    content = data.get("content", "")
                    if _file_contains(content, keyword):
                        if label not in tech_stack:
                            tech_stack.append(label)
                        break

    # Detect layers
    for layer, patterns in LAYER_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, path_str, re.IGNORECASE):
                layers_detected[layer] = True
                break

    # Detect databases
    all_content = " ".join(d.get("content", "")[:2000] for d in files.values())
    for keyword, db_name in DB_SIGNALS.items():
        if keyword in all_content.lower():
            if db_name not in databases:
                databases.append(db_name)

    # Determine project type
    active_layers = [l for l, v in layers_detected.items() if v]
    if layers_detected["frontend"] and layers_detected["backend"]:
        project_type = "Full-Stack Application"
    elif layers_detected["frontend"]:
        project_type = "Frontend Application"
    elif layers_detected["backend"]:
        project_type = "Backend / API Service"
    elif "Go" in tech_stack or "Rust" in tech_stack:
        project_type = "Systems / CLI Application"
    else:
        project_type = "Library / Package"

    # Build architecture flow
    flow_steps = _build_flow(layers_detected, tech_stack, databases)

    return {
        "tech_stack": tech_stack,
        "databases": databases,
        "layers": layers_detected,
        "project_type": project_type,
        "architecture_flow": flow_steps,
        "active_layers": active_layers,
    }


def _build_flow(
    layers: dict[str, bool],
    stack: list[str],
    dbs: list[str],
) -> list[dict]:
    """Build a simple request-flow diagram description."""
    steps = []
    if layers["frontend"]:
        steps.append({"label": "Client / Browser", "type": "client", "icon": "🌐"})
    if layers["backend"] or layers["infrastructure"]:
        steps.append({"label": "API Server", "type": "api", "icon": "⚙️"})
    if dbs:
        steps.append({"label": " / ".join(dbs[:2]), "type": "database", "icon": "🗄️"})
    if layers["infrastructure"]:
        steps.append({"label": "Infrastructure", "type": "infra", "icon": "☁️"})
    return steps
