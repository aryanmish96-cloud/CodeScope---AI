"""
graph_builder.py – Build a dependency graph from parsed repo data using NetworkX.
Returns React Flow–compatible nodes and edges.
"""

from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Any

import networkx as nx

# ── file-type → colour mapping ──────────────────────────────────────────────────
EXT_COLORS = {
    "py":    "#4B8BBE",   # Python blue
    "js":    "#F7DF1E",   # JS yellow  (dark label)
    "jsx":   "#61DAFB",   # React cyan
    "ts":    "#3178C6",   # TS blue
    "tsx":   "#61DAFB",   # React cyan
    "java":  "#ED8B00",   # Java orange
    "go":    "#00ADD8",   # Go cyan
    "rs":    "#CE422B",   # Rust red
    "cpp":   "#659AD2",   # C++ blue
    "c":     "#A8B9CC",   # C silver
    "cs":    "#239120",   # C# green
    "rb":    "#CC342D",   # Ruby red
    "php":   "#8892BF",   # PHP indigo
    "html":  "#E34F26",   # HTML orange
    "css":   "#1572B6",   # CSS blue
    "scss":  "#CD6799",   # SCSS pink
    "json":  "#888",
    "yaml":  "#888",
    "yml":   "#888",
    "md":    "#888",
    "sh":    "#4EAA25",
    "sql":   "#F29111",
    "vue":   "#42B883",
    "svelte":"#FF3E00",
}
DEFAULT_COLOR = "#6B7280"

# ── complexity scoring ─────────────────────────────────────────────────────────
def _complexity_score(file_data: dict) -> float:
    """
    Simple complexity heuristic: lines + number of imports.
    Returns 0–10 score.
    """
    lines = file_data.get("lines", 0)
    imports = len(file_data.get("imports", []))
    raw = math.log1p(lines) * 0.5 + imports * 0.3
    return min(round(raw, 1), 10.0)


# ── resolve import to file path ────────────────────────────────────────────────
def _resolve_import(importer: str, imp: str, all_paths: set[str]) -> str | None:
    """
    Try to resolve an import string to an actual file path in the repo.
    Works for relative imports (./foo, ../bar) and direct matches.
    """
    imp = imp.strip()
    # strip leading ./
    base_dir = str(Path(importer).parent).replace("\\", "/")

    candidates = []

    if imp.startswith("."):
        # relative import
        joined = str(Path(base_dir) / imp).replace("\\", "/")
        candidates = [
            joined,
            joined + ".py",
            joined + ".js",
            joined + ".jsx",
            joined + ".ts",
            joined + ".tsx",
            joined + "/index.js",
            joined + "/index.jsx",
            joined + "/index.ts",
            joined + "/index.tsx",
        ]
    else:
        # could be an internal module by name
        name = imp.split("/")[0]
        for p in all_paths:
            if Path(p).stem == name or Path(p).parent.name == name:
                candidates.append(p)

    for c in candidates:
        c = c.replace("\\", "/")
        if c in all_paths:
            return c
    return None


# ── main builder ────────────────────────────────────────────────────────────────
def build_graph(files: dict[str, dict], imports: dict[str, list[str]]) -> dict[str, Any]:
    """
    Build a NetworkX DiGraph and return React Flow nodes + edges.
    Also detects circular dependencies and computes per-node metrics.
    """
    G = nx.DiGraph()
    all_paths = set(files.keys())

    # Add nodes
    for path, data in files.items():
        score = _complexity_score(data)
        ext = data.get("extension", "")
        G.add_node(
            path,
            label=data["name"],
            extension=ext,
            lines=data.get("lines", 0),
            complexity=score,
            color=EXT_COLORS.get(ext, DEFAULT_COLOR),
        )

    # Add edges
    for importer, imp_list in imports.items():
        if importer not in G:
            continue
        for imp in imp_list:
            target = _resolve_import(importer, imp, all_paths)
            if target and target != importer:
                G.add_edge(importer, target)

    # Detect circular dependencies
    try:
        cycles = list(nx.simple_cycles(G))
    except Exception:
        cycles = []

    # Mark nodes involved in cycles
    cycle_nodes = set()
    for cycle in cycles:
        cycle_nodes.update(cycle)

    # Layout: use spring layout for positioning
    if len(G.nodes) > 0:
        pos = nx.spring_layout(G, k=3, seed=42)
    else:
        pos = {}

    SCALE = 600  # scale factor for React Flow canvas

    # Build React Flow nodes
    rf_nodes = []
    for i, (node, attrs) in enumerate(G.nodes(data=True)):
        x, y = pos.get(node, (0, 0))
        is_circular = node in cycle_nodes
        in_degree = G.in_degree(node)
        out_degree = G.out_degree(node)

        rf_nodes.append({
            "id": node,
            "type": "codeNode",
            "position": {"x": x * SCALE, "y": y * SCALE},
            "data": {
                "label": attrs.get("label", node),
                "extension": attrs.get("extension", ""),
                "lines": attrs.get("lines", 0),
                "complexity": attrs.get("complexity", 0),
                "color": attrs.get("color", DEFAULT_COLOR),
                "isCircular": is_circular,
                "inDegree": in_degree,
                "outDegree": out_degree,
                "path": node,
            },
        })

    # Build React Flow edges
    rf_edges = []
    for i, (src, dst) in enumerate(G.edges()):
        is_circular_edge = src in cycle_nodes and dst in cycle_nodes
        rf_edges.append({
            "id": f"e{i}-{src}-{dst}",
            "source": src,
            "target": dst,
            "animated": is_circular_edge,
            "style": {
                "stroke": "#EF4444" if is_circular_edge else "#6366F1",
                "strokeWidth": 1.5,
            },
            "markerEnd": {"type": "arrowclosed", "color": "#EF4444" if is_circular_edge else "#6366F1"},
        })

    # Overall metrics
    important_files = sorted(
        G.nodes(data=True),
        key=lambda n: G.in_degree(n[0]) + n[1].get("complexity", 0),
        reverse=True,
    )[:5]

    return {
        "nodes": rf_nodes,
        "edges": rf_edges,
        "metrics": {
            "total_nodes": len(rf_nodes),
            "total_edges": len(rf_edges),
            "circular_dependency_count": len(cycles),
            "circular_dependencies": [list(c) for c in cycles[:10]],
            "important_files": [
                {
                    "path": n,
                    "label": attrs.get("label", n),
                    "in_degree": G.in_degree(n),
                    "complexity": attrs.get("complexity", 0),
                }
                for n, attrs in important_files
            ],
            "avg_complexity": round(
                sum(d.get("complexity", 0) for _, d in G.nodes(data=True)) / max(len(G), 1), 2
            ),
        },
    }
