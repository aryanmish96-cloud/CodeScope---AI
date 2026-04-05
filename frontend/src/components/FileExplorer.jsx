import { motion } from 'framer-motion'
import { useState } from 'react'

const EXT_ICONS = {
  js: '📜', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
  py: '🐍', java: '☕', go: '🐹', rs: '🦀',
  css: '🎨', scss: '🎨', html: '🌐',
  json: '📋', yaml: '📋', yml: '📋',
  md: '📖', txt: '📄', sh: '⚡',
  sql: '🗄️', dockerfile: '🐳', vue: '💚', svelte: '🧡',
  env: '🔐', gitignore: '🙈', toml: '📋',
}

const EXT_COLORS = {
  js: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#61dafb',
  py: '#4b8bbe', java: '#ed8b00', go: '#00add8', rs: '#ce422b',
  css: '#1572b6', scss: '#cd6799', html: '#e34f26',
  json: '#8bc34a', yaml: '#f29111', yml: '#f29111',
  md: '#ffffff', sql: '#f29111', vue: '#42b883', svelte: '#ff3e00',
}

function FileIcon({ ext, size = 14 }) {
  const icon = EXT_ICONS[ext] || '📄'
  return <span style={{ fontSize: size, flexShrink: 0 }}>{icon}</span>
}

function TreeNode({ node, depth = 0, onSelect, selectedPath }) {
  const [open, setOpen] = useState(depth < 2)
  const isFolder = node.type === 'folder'
  const isSelected = node.path === selectedPath

  return (
    <div>
      <div
        className={`file-tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => {
          if (isFolder) setOpen(!open)
          else onSelect(node)
        }}
      >
        {isFolder ? (
          <>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
              {open ? '▼' : '▶'}
            </span>
            <span style={{ fontSize: 14, flexShrink: 0 }}>📁</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 10, color: 'transparent', flexShrink: 0 }}>▶</span>
            <FileIcon ext={node.extension} />
          </>
        )}
        <span style={{
          fontSize: 12.5,
          color: isSelected ? '#a78bfa' : (isFolder ? 'var(--text-primary)' : 'var(--text-secondary)'),
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: isFolder ? 'inherit' : 'var(--font-mono)',
        }}>
          {node.name}
        </span>
        {!isFolder && node.lines > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)',
            flexShrink: 0, paddingLeft: 4,
          }}>
            {node.lines}L
          </span>
        )}
      </div>
      {isFolder && open && node.children?.map((child, i) => (
        <TreeNode
          key={child.id || i}
          node={child}
          depth={depth + 1}
          onSelect={onSelect}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  )
}

export default function FileExplorer({ tree, onFileSelect, selectedPath, stats }) {
  const [search, setSearch] = useState('')

  if (!tree) return (
    <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
      No repository loaded
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>🗂️</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
            {tree.name}
          </span>
        </div>
        {stats && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge badge-purple">{stats.file_count} files</span>
            <span className="badge badge-blue">{stats.total_lines?.toLocaleString()} LOC</span>
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <input
            className="input-field"
            style={{ padding: '6px 10px', fontSize: 12 }}
            placeholder="🔍  Filter files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tree */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 4px' }}>
        <TreeNode
          node={tree}
          depth={0}
          onSelect={onFileSelect}
          selectedPath={selectedPath}
        />
      </div>
    </div>
  )
}
