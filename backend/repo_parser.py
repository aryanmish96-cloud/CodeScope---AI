import os
import re
import shutil
import hashlib
import tempfile
import json
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

import git

# ── exceptions ────────────────────────────────────────────────────────────────
class RepoTooLargeError(Exception):
    """Raised when repository exceeds safety limits (files or lines)."""
    pass

# ── constants ──────────────────────────────────────────────────────────────────
MAX_REPO_FILES = 8000
MAX_TOTAL_LINES = 1000000
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # hard cap per file for parse safety
MAX_FILE_READ_BYTES = 512 * 1024  # read preview only for speed
MAX_FILE_CONTENT_CHARS = 20000  # content sent to UI/AI
PARSE_CACHE_VERSION = 2

SKIP_DIRS = {
    ".git", "node_modules", "dist", "build", "__pycache__", ".venv", "venv",
    "env", ".env", ".next", ".nuxt", "coverage", ".cache", "vendor", "target",
    ".gradle", ".idea", ".vscode", "eggs", ".eggs", "*.egg-info",
}

# Only parse useful extensions
PARSE_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".cpp", ".c", ".h", ".cs",
    ".go", ".rs", ".html", ".css", ".json", ".md", ".yml", ".yaml", ".sh",
}
ALWAYS_INCLUDE_FILES = {
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "poetry.lock",
    "go.mod",
    "Cargo.toml",
    "pom.xml",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Dockerfile",
}

# Cache directory for repositories
CACHE_DIR = Path(tempfile.gettempdir()) / "codescope_cache"
CACHE_DIR.mkdir(exist_ok=True)

# ── import extraction ────────────────────────────────────────────────────────────
_IMPORT_PATTERNS = {
    ".py": re.compile(r"^(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+))", re.MULTILINE),
    ".js": re.compile(r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))""", re.MULTILINE),
    ".jsx": re.compile(r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))""", re.MULTILINE),
    ".ts": re.compile(r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))""", re.MULTILINE),
    ".tsx": re.compile(r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))""", re.MULTILINE),
}

def _extract_imports(suffix: str, content: str) -> List[str]:
    pattern = _IMPORT_PATTERNS.get(suffix)
    if not pattern:
        return []
    imports = []
    for match in pattern.finditer(content):
        for group in match.groups():
            if group:
                imports.append(group.strip())
    return imports

# ── parser helpers ────────────────────────────────────────────────────────────────

def _should_skip_dir(name: str) -> bool:
    return name in SKIP_DIRS or name.endswith(".egg-info")

def _should_parse_file(name: str, suffix: str) -> bool:
    if suffix in PARSE_EXTENSIONS:
        return True
    return name in ALWAYS_INCLUDE_FILES

def _read_file_safe(path: Path) -> Tuple[str, int, bool, int]:
    """Read file preview and return (content, line_count, truncated, file_size)."""
    try:
        file_size = path.stat().st_size
        if file_size > MAX_FILE_SIZE_BYTES:
            return "", 0, True, file_size

        with path.open("rb") as f:
            raw = f.read(MAX_FILE_READ_BYTES)
            has_more = f.read(1) != b""

        content = raw.decode("utf-8", errors="ignore")
        if len(content) > MAX_FILE_CONTENT_CHARS:
            content = content[:MAX_FILE_CONTENT_CHARS]
            has_more = True

        # Count lines only in preview for speed; adequate for ranking/visualization.
        line_count = content.count("\n") + (1 if content else 0)
        return content, line_count, has_more, file_size
    except Exception:
        return "", 0, True, 0

def _traverse_and_parse(root_path: Path, stats: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Dict], Dict[str, List[str]]]:
    """Fast iterative traversal to build tree + file map."""
    files_map: Dict[str, Dict] = {}
    all_imports: Dict[str, List[str]] = {}

    root_node = {"id": "root", "name": stats["repo_name"], "type": "folder", "children": [], "path": ""}
    stack: List[Tuple[Path, Dict[str, Any]]] = [(root_path, root_node)]

    while stack:
        current_path, parent_node = stack.pop()
        try:
            with os.scandir(current_path) as it:
                entries = list(it)
        except Exception:
            continue

        for entry in entries:
            name = entry.name
            if entry.is_dir(follow_symlinks=False):
                if _should_skip_dir(name):
                    continue
                full_path = Path(entry.path)
                rel_path = str(full_path.relative_to(root_path)).replace("\\", "/")
                dir_node = {
                    "id": rel_path,
                    "name": name,
                    "type": "folder",
                    "children": [],
                    "path": rel_path,
                }
                parent_node["children"].append(dir_node)
                stack.append((full_path, dir_node))
                continue

            if not entry.is_file(follow_symlinks=False):
                continue

            suffix = Path(name).suffix.lower()
            if not _should_parse_file(name, suffix):
                continue

            full_path = Path(entry.path)
            rel_path = str(full_path.relative_to(root_path)).replace("\\", "/")
            content, lines, truncated, file_size = _read_file_safe(full_path)
            if not content and lines == 0 and file_size == 0:
                continue

            stats["file_count"] += 1
            stats["total_lines"] += lines
            if stats["file_count"] > MAX_REPO_FILES:
                raise RepoTooLargeError(f"Exceeded {MAX_REPO_FILES} files.")
            if stats["total_lines"] > MAX_TOTAL_LINES:
                raise RepoTooLargeError(f"Exceeded {MAX_TOTAL_LINES} lines.")

            imports = _extract_imports(suffix, content)
            file_data = {
                "path": rel_path,
                "name": name,
                "extension": suffix.lstrip("."),
                "lines": lines,
                "content": content,
                "imports": imports,
            }
            if truncated:
                file_data["content_truncated"] = True
                file_data["size_bytes"] = file_size

            files_map[rel_path] = file_data
            all_imports[rel_path] = imports
            parent_node["children"].append({
                "id": rel_path,
                "name": name,
                "type": "file",
                "extension": suffix.lstrip("."),
                "lines": lines,
                "path": rel_path,
                "children": [],
            })

    return root_node, files_map, all_imports

def parse_repository(repo_url: str, update_status=None) -> Dict[str, Any]:
    """
    Optimized parser: Caching, single-pass traversal, strict filtering.
    """
    clean_url = repo_url.rstrip("/")
    if not clean_url.endswith(".git"):
        clean_url += ".git"
    
    repo_name = clean_url.split("/")[-1].replace(".git", "")
    url_hash = hashlib.md5(clean_url.encode()).hexdigest()[:12]
    repo_dir = CACHE_DIR / f"{repo_name}_{url_hash}"
    parse_cache_file = repo_dir / ".codescope_parse_cache.json"
    
    try:
        if repo_dir.exists():
            if update_status: update_status("Using cached repository...")
            repo = git.Repo(repo_dir)
            # Optional: repo.remotes.origin.pull() for latest, but user asked for fast.
        else:
            if update_status: update_status("Cloning repository (shallow)...")
            try:
                repo = git.Repo.clone_from(
                    clean_url,
                    repo_dir,
                    depth=1,
                    single_branch=True,
                    no_tags=True,
                    env={"GIT_TERMINAL_PROMPT": "0"},
                    multi_options=["--filter=blob:none"],
                )
            except Exception:
                # Fallback for remotes that do not support partial clone filters.
                repo = git.Repo.clone_from(
                    clean_url,
                    repo_dir,
                    depth=1,
                    single_branch=True,
                    no_tags=True,
                    env={"GIT_TERMINAL_PROMPT": "0"},
                )

        head_sha = ""
        try:
            head_sha = repo.head.commit.hexsha
        except Exception:
            head_sha = ""

        if parse_cache_file.exists():
            try:
                cached = json.loads(parse_cache_file.read_text(encoding="utf-8"))
                if (
                    cached.get("cache_version") == PARSE_CACHE_VERSION
                    and cached.get("head_sha") == head_sha
                ):
                    if update_status:
                        update_status("Loaded parsed repository from cache...")
                    return cached["payload"]
            except Exception:
                pass

        if update_status: update_status("Parsing and building tree (single-pass)...")
        stats = {"file_count": 0, "total_lines": 0, "repo_name": repo_name}
        tree, files_map, all_imports = _traverse_and_parse(repo_dir, stats)
        
        # Git metadata
        if update_status: update_status("Extracting git metadata...")
        try:
            commits = list(repo.iter_commits(max_count=5))
            git_meta = {
                "branch": repo.active_branch.name,
                "last_commit": commits[0].message.strip() if commits else "",
                "recent_commits": [
                    {"sha": c.hexsha[:7], "message": c.message.strip()[:80], "author": c.author.name, "date": c.committed_datetime.isoformat()}
                    for c in commits
                ]
            }
        except:
            git_meta = {}

        payload = {
            "tree": tree,
            "files": files_map,
            "imports": all_imports,
            "stats": stats,
            "git": git_meta
        }
        try:
            parse_cache_file.write_text(
                json.dumps(
                    {
                        "cache_version": PARSE_CACHE_VERSION,
                        "head_sha": head_sha,
                        "payload": payload,
                    },
                    ensure_ascii=True,
                ),
                encoding="utf-8",
            )
        except Exception:
            pass
        return payload

    except Exception as e:
        # If cloning failed, clean up dir so we don't cache a broken clone
        if repo_dir.exists() and not (repo_dir / ".git").exists():
            shutil.rmtree(repo_dir, ignore_errors=True)
        raise e
