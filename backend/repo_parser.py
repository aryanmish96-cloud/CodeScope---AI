"""
repo_parser.py – Clone and parse a GitHub repository into a structured tree + file map.
"""

import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any

import git

import git
import tempfile
from pathlib import Path
from typing import Any

# ── exceptions ────────────────────────────────────────────────────────────────
class RepoTooLargeError(Exception):
    """Raised when repository exceeds safety limits (files or lines)."""
    pass


# ── constants ──────────────────────────────────────────────────────────────────
MAX_REPO_FILES = 8000       # Guard against Render's 512MB RAM
MAX_TOTAL_LINES = 1000000    # Guard against CPU/RAM spikes
SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv", "env",
    ".env", "dist", "build", ".next", ".nuxt", "coverage", ".cache",
    "vendor", "target", ".gradle", ".idea", ".vscode", "eggs", ".eggs",
    "*.egg-info", ".mypy_cache", ".pytest_cache", ".ruff_cache",
}
SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".mp4", ".mp3", ".wav", ".pdf", ".zip", ".tar", ".gz",
    ".woff", ".woff2", ".ttf", ".eot", ".lock",
}
TEXT_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rs",
    ".cpp", ".c", ".h", ".cs", ".rb", ".php", ".swift", ".kt",
    ".html", ".css", ".scss", ".sass", ".less",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".env",
    ".md", ".txt", ".sh", ".bash", ".zsh", ".dockerfile", ".sql",
    ".graphql", ".proto", ".xml", ".vue", ".svelte",
}


# ── helpers ─────────────────────────────────────────────────────────────────────
def _is_text_file(path: Path) -> bool:
    return path.suffix.lower() in TEXT_EXTENSIONS


def _count_lines(path: Path) -> int:
    try:
        return sum(1 for _ in path.open("r", encoding="utf-8", errors="ignore"))
    except Exception:
        return 0


def _read_file(path: Path, max_chars: int = 15_000) -> str:
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
        return content[:max_chars]
    except Exception:
        return ""


# ── import extraction ────────────────────────────────────────────────────────────
_IMPORT_PATTERNS = {
    ".py": re.compile(
        r"^(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+))", re.MULTILINE
    ),
    ".js": re.compile(
        r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))""",
        re.MULTILINE,
    ),
    ".jsx": re.compile(
        r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))""",
        re.MULTILINE,
    ),
    ".ts": re.compile(
        r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))""",
        re.MULTILINE,
    ),
    ".tsx": re.compile(
        r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))""",
        re.MULTILINE,
    ),
}


def _extract_imports(path: Path, content: str) -> list[str]:
    pattern = _IMPORT_PATTERNS.get(path.suffix.lower())
    if not pattern:
        return []
    imports = []
    for match in pattern.finditer(content):
        for group in match.groups():
            if group:
                imports.append(group.strip())
    return imports


# ── tree builder ─────────────────────────────────────────────────────────────────
def _build_tree(root: Path, rel_root: Path) -> dict[str, Any]:
    """Recursively build a VS-Code-style file tree."""
    name = root.name
    relative = str(root.relative_to(rel_root)).replace("\\", "/")

    if root.is_dir():
        # skip unwanted directories
        if name in SKIP_DIRS or name.endswith(".egg-info"):
            return None
        children = []
        for child in sorted(root.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
            node = _build_tree(child, rel_root)
            if node:
                children.append(node)
        return {
            "id": relative or "root",
            "name": name,
            "type": "folder",
            "children": children,
            "path": relative,
        }
    else:
        if root.suffix.lower() in SKIP_EXTENSIONS:
            return None
        return {
            "id": relative,
            "name": name,
            "type": "file",
            "extension": root.suffix.lower().lstrip("."),
            "lines": _count_lines(root) if _is_text_file(root) else 0,
            "path": relative,
            "children": [],
        }


# ── main parser ───────────────────────────────────────────────────────────────────
def parse_repository(repo_url: str) -> dict[str, Any]:
    """
    Clone repo, parse structure, extract file contents + imports.
    Returns a rich data payload for the frontend.
    """
    tmp_dir = tempfile.mkdtemp(prefix="codescope_")
    try:
        # strip .git suffix for cleanliness
        clean_url = repo_url.rstrip("/")
        if not clean_url.endswith(".git"):
            clean_url += ".git"

        repo = git.Repo.clone_from(clean_url, tmp_dir, depth=1, env={"GIT_TERMINAL_PROMPT": "0"})
        root_path = Path(tmp_dir)

        # Build file tree
        tree = _build_tree(root_path, root_path)
        tree["name"] = clean_url.split("/")[-1].replace(".git", "")

        # Gather all text files
        files_map: dict[str, dict] = {}
        all_imports: dict[str, list[str]] = {}
        total_lines = 0
        file_count = 0

        for fpath in root_path.rglob("*"):
            if not fpath.is_file():
                continue
            if fpath.suffix.lower() in SKIP_EXTENSIONS:
                continue
            # skip hidden/ignored dirs
            skip = False
            for part in fpath.relative_to(root_path).parts:
                if part in SKIP_DIRS or part.endswith(".egg-info"):
                    skip = True
                    break
            if skip:
                continue

            rel = str(fpath.relative_to(root_path)).replace("\\", "/")
            content = _read_file(fpath) if _is_text_file(fpath) else ""
            lines = _count_lines(fpath) if _is_text_file(fpath) else 0

            # Safety check: files and lines
            if file_count >= MAX_REPO_FILES:
                raise RepoTooLargeError(
                    f"Repository too large: exceeded limit of {MAX_REPO_FILES} files. "
                    "Try a smaller repository."
                )
            if total_lines + lines > MAX_TOTAL_LINES:
                raise RepoTooLargeError(
                    f"Repository too large: exceeded limit of {MAX_TOTAL_LINES} lines. "
                    "Try a smaller repository."
                )

            imports = _extract_imports(fpath, content)

            files_map[rel] = {
                "path": rel,
                "name": fpath.name,
                "extension": fpath.suffix.lower().lstrip("."),
                "lines": lines,
                "content": content,
                "imports": imports,
            }
            all_imports[rel] = imports
            total_lines += lines
            file_count += 1

        # Git metadata
        try:
            commits = list(repo.iter_commits(max_count=10))
            git_meta = {
                "branch": repo.active_branch.name,
                "last_commit": commits[0].message.strip() if commits else "",
                "contributor_count": len(set(c.author.email for c in commits)),
                "recent_commits": [
                    {
                        "sha": c.hexsha[:7],
                        "message": c.message.strip()[:80],
                        "author": c.author.name,
                        "date": c.committed_datetime.isoformat(),
                    }
                    for c in commits[:5]
                ],
            }
        except Exception:
            git_meta = {}

        return {
            "tree": tree,
            "files": files_map,
            "imports": all_imports,
            "stats": {
                "file_count": file_count,
                "total_lines": total_lines,
                "repo_name": tree["name"],
            },
            "git": git_meta,
        }

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
