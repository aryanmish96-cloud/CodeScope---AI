import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'

// ── Custom Node ──────────────────────────────────────────────────────
function CodeNode({ data, selected }) {
  const getBorderColor = () => {
    if (data.isCircular) return '#ef4444'
    if (selected) return '#7c3aed'
    return 'rgba(255,255,255,0.1)'
  }

  return (
    <div style={{
      background: 'rgba(17,24,39,0.95)',
      border: `1.5px solid ${getBorderColor()}`,
      borderRadius: 10,
      padding: '8px 12px',
      minWidth: 120,
      maxWidth: 180,
      boxShadow: selected
        ? '0 0 20px rgba(124,58,237,0.5)'
        : data.isCircular
        ? '0 0 15px rgba(239,68,68,0.4)'
        : '0 4px 12px rgba(0,0,0,0.5)',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: data.color, border: 'none', width: 6, height: 6 }} />

      {/* Color stripe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 3, borderRadius: '10px 10px 0 0',
        background: data.color,
      }} />

      <div style={{ paddingTop: 4 }}>
        <div style={{
          fontSize: 11.5,
          fontFamily: 'var(--font-mono)',
          color: '#e2e8f0',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontWeight: 500,
        }}>
          {data.label}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
          <span style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 3,
            background: `${data.color}22`, color: data.color,
            fontFamily: 'var(--font-mono)',
          }}>
            .{data.extension}
          </span>
          {data.lines > 0 && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              {data.lines}L
            </span>
          )}
          {data.isCircular && (
            <span style={{ fontSize: 9, color: '#ef4444' }} title="Circular dependency">⚠️</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            ↓{data.inDegree} ↑{data.outDegree}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: data.color, border: 'none', width: 6, height: 6 }} />
    </div>
  )
}

const nodeTypes = { codeNode: CodeNode }

// ── Main Graph Component ─────────────────────────────────────────────
export default function DependencyGraph({ graphData, onNodeClick, metrics }) {
  const initialNodes = useMemo(() => graphData?.nodes || [], [graphData])
  const initialEdges = useMemo(() => graphData?.edges || [], [graphData])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const handleNodeClick = useCallback((_, node) => {
    onNodeClick?.(node.data)
  }, [onNodeClick])

  if (!graphData || nodes.length === 0) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: 12,
        color: 'var(--text-muted)',
      }}>
        <span style={{ fontSize: 40 }}>🕸️</span>
        <span style={{ fontSize: 14 }}>No graph data yet</span>
        <span style={{ fontSize: 12 }}>Analyze a repository to see the dependency graph</span>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          style: { strokeWidth: 1.5, stroke: '#6366f1' },
          markerEnd: { type: 'arrowclosed', color: '#6366f1' },
        }}
      >
        <Background color="#1f2937" gap={24} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => node.data?.color || '#6b7280'}
          maskColor="rgba(8,11,20,0.8)"
        />
      </ReactFlow>

      {/* Metrics overlay */}
      {metrics && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'absolute', top: 12, left: 12,
            display: 'flex', gap: 8, flexWrap: 'wrap',
            pointerEvents: 'none',
          }}
        >
          <div className="glass" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11 }}>
            <span style={{ color: 'var(--text-muted)' }}>Nodes </span>
            <span style={{ color: '#a78bfa', fontWeight: 600 }}>{metrics.total_nodes}</span>
          </div>
          <div className="glass" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11 }}>
            <span style={{ color: 'var(--text-muted)' }}>Edges </span>
            <span style={{ color: '#93c5fd', fontWeight: 600 }}>{metrics.total_edges}</span>
          </div>
          {metrics.circular_dependency_count > 0 && (
            <div className="glass" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11 }}>
              <span style={{ color: '#fca5a5' }}>
                ⚠️ {metrics.circular_dependency_count} circular dep{metrics.circular_dependency_count > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <div className="glass" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11 }}>
            <span style={{ color: 'var(--text-muted)' }}>Avg complexity </span>
            <span style={{ color: '#6ee7b7', fontWeight: 600 }}>{metrics.avg_complexity}</span>
          </div>
        </motion.div>
      )}

      {/* Legend */}
      <div className="glass" style={{
        position: 'absolute', bottom: 12, right: 12,
        padding: '8px 12px', borderRadius: 8, fontSize: 10,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>LEGEND</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 2, background: '#6366f1' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Dependency</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 2, background: '#ef4444', borderStyle: 'dashed' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Circular</span>
        </div>
      </div>
    </div>
  )
}
