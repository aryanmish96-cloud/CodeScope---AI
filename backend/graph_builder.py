import math
import os
from pathlib import Path
from typing import Any
from itertools import islice
import hashlib

import networkx as nx

# ── file-type → colour mapping ──────────────────────────────────────────────────
EXT_COLORS = {
    "py":    "#4B8BBE",
    "js":    "#F7DF1E",
    "jsx":   "#61DAFB",
    "ts":    "#3178C6",
    "tsx":   "#61DAFB",
    "java":  "#ED8B00",
    "go":    "#00ADD8",
    "rs":    "#CE422B",
    "cpp":   "#659AD2",
    "c":     "#A8B9CC",
    "cs":    "#239120",
    "rb":    "#CC342D",
    "php":   "#8892BF",
    "html":  "#E34F26",
    "css":   "#1572B6",
    "scss":  "#CD6799",
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
MAX_GRAPH_NODES = 2500
MAX_GRAPH_EDGES = 12000
MAX_CYCLE_SCAN_NODES = 1200

# ── complexity scoring ─────────────────────────────────────────────────────────
def _complexity_score(file_data: dict) -> float:
    lines = file_data.get("lines", 0)
    imports = len(file_data.get("imports", []))
    raw = math.log1p(lines) * 0.5 + imports * 0.3
    return min(round(raw, 1), 10.0)

# ── resolve import to file path ────────────────────────────────────────────────
def _resolve_import(importer: str, imp: str, all_paths: set[str], path_map: dict[str, str]) -> str | None:
    imp = imp.strip().replace("\\", "/")
    if not imp: return None
    
    base_dir = str(Path(importer).parent).replace("\\", "/")

    # 1. Relative imports
    if imp.startswith("."):
        # Resolve ./ or ../
        try:
            target_path = str((Path(base_dir) / imp).resolve().relative_to(Path().resolve())).replace("\\", "/")
        except Exception:
            # Fallback to simple join if resolve fails
            target_path = str(Path(base_dir) / imp).replace("\\", "/")
        
        candidates = [
            target_path,
            target_path + ".py", target_path + ".js", target_path + ".jsx", target_path + ".ts", target_path + ".tsx",
            target_path + "/index.js", target_path + "/index.jsx", target_path + "/index.ts", target_path + "/index.tsx"
        ]
        for c in candidates:
            if c in all_paths: return c
            
    # 2. Absolute / Package imports - Use path_map for O(1) lookups
    # Try the full string as a filename match
    if imp in path_map: return path_map[imp]
    
    # Try adding extensions
    for ext in [".py", ".js", ".jsx", ".ts", ".tsx"]:
        if (imp + ext) in path_map: return path_map[imp + ext]

    # Try matching the last part (e.g. 'utils' in 'my_package.utils')
    name = imp.split(".")[-1].split("/")[-1]
    if name in path_map: return path_map[name]
    
    return None

# ── main builder ────────────────────────────────────────────────────────────────
def build_graph(files: dict[str, dict], imports: dict[str, list[str]], update_status=None) -> dict[str, Any]:
    if update_status: update_status("Building dependency graph nodes...")
    G = nx.DiGraph()
    all_paths = set(files.keys())

    # For very large repos, keep graph responsive by selecting a representative subset.
    selected_paths = list(all_paths)
    graph_truncated = False
    if len(selected_paths) > MAX_GRAPH_NODES:
        graph_truncated = True
        selected_paths = sorted(
            selected_paths,
            key=lambda p: files.get(p, {}).get("lines", 0),
            reverse=True,
        )[:MAX_GRAPH_NODES]
    selected_set = set(selected_paths)
    
    # Pre-compute path map for faster lookups: basename -> full_path
    path_map = {}
    for p in selected_set:
        name = p.split("/")[-1]
        path_map[p] = p # self mapping
        path_map[name] = p
        if "." in name:
            path_map[name.rsplit(".", 1)[0]] = p

    for path in selected_paths:
        data = files[path]
        score = _complexity_score(data)
        ext = data.get("extension", "")
        G.add_node(path, label=data["name"], extension=ext, lines=data.get("lines", 0), complexity=score, color=EXT_COLORS.get(ext, DEFAULT_COLOR))

    if update_status: update_status("Connecting dependency edges...")
    edge_count = 0
    for importer, imp_list in imports.items():
        if importer not in G:
            continue
        for imp in imp_list:
            target = _resolve_import(importer, imp, selected_set, path_map)
            if target and target != importer:
                G.add_edge(importer, target)
                edge_count += 1
                if edge_count >= MAX_GRAPH_EDGES:
                    graph_truncated = True
                    break
        if edge_count >= MAX_GRAPH_EDGES:
            break

    if update_status: update_status("Detecting circular dependencies...")
    if len(G.nodes) > MAX_CYCLE_SCAN_NODES:
        cycles = []
    else:
        try:
            # Optimization: Don't materialize all cycles, cap at 20
            cycles = list(islice(nx.simple_cycles(G), 20))
        except Exception:
            cycles = []

    cycle_nodes = set()
    for cycle in cycles:
        cycle_nodes.update(cycle)

    if update_status: update_status("Calculating graph layout...")
    # Optimization: Use deterministic hash layout for large graphs.
    if len(G.nodes) > 0:
        if len(G.nodes) <= 150:
            pos = nx.spring_layout(G, k=3, seed=42, iterations=20)
        elif len(G.nodes) <= 800:
            pos = nx.random_layout(G)
        else:
            pos = {}
            for node in G.nodes():
                digest = hashlib.md5(node.encode("utf-8")).digest()
                x = (int.from_bytes(digest[:4], "big") / 2**32) * 2 - 1
                y = (int.from_bytes(digest[4:8], "big") / 2**32) * 2 - 1
                pos[node] = (x, y)
    else:
        pos = {}

    SCALE = 600
    rf_nodes = []
    for i, (node, attrs) in enumerate(G.nodes(data=True)):
        x, y = pos.get(node, (0, 0))
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
                "isCircular": node in cycle_nodes,
                "inDegree": G.in_degree(node),
                "outDegree": G.out_degree(node),
                "path": node,
            },
        })

    rf_edges = []
    for i, (src, dst) in enumerate(G.edges()):
        is_circular_edge = src in cycle_nodes and dst in cycle_nodes
        rf_edges.append({
            "id": f"e{i}-{src}-{dst}",
            "source": src,
            "target": dst,
            "animated": is_circular_edge,
            "style": {"stroke": "#EF4444" if is_circular_edge else "#6366F1", "strokeWidth": 1.5},
            "markerEnd": {"type": "arrowclosed", "color": "#EF4444" if is_circular_edge else "#6366F1"},
        })

    important_files = sorted(G.nodes(data=True), key=lambda n: G.in_degree(n[0]) + n[1].get("complexity", 0), reverse=True)[:5]

    return {
        "nodes": rf_nodes,
        "edges": rf_edges,
        "metrics": {
            "total_nodes": len(rf_nodes),
            "total_edges": len(rf_edges),
            "graph_truncated": graph_truncated,
            "circular_dependency_count": len(cycles),
            "circular_dependencies": [list(c) for c in cycles],
            "important_files": [{"path": n, "label": attrs.get("label", n), "in_degree": G.in_degree(n), "complexity": attrs.get("complexity", 0)} for n, attrs in important_files],
            "avg_complexity": round(sum(d.get("complexity", 0) for _, d in G.nodes(data=True)) / max(len(G), 1), 2),
        },
    }
