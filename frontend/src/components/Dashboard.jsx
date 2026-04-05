import { motion } from 'framer-motion'
import MermaidGraph from './MermaidGraph'

const SEVERITY_COLORS = {
  critical: { bg: '#ef444420', border: '#ef444440', text: '#fca5a5', badge: '#ef4444' },
  high:     { bg: '#f9731620', border: '#f9731640', text: '#fdba74', badge: '#f97316' },
  medium:   { bg: '#eab30820', border: '#eab30840', text: '#fde047', badge: '#eab308' },
  low:      { bg: '#6b728020', border: '#6b728040', text: '#9ca3af', badge: '#6b7280' },
}

function ArchitectureFlow({ steps }) {
  if (!steps?.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            padding: '5px 12px', borderRadius: 20,
            background: 'rgba(124,58,237,0.1)',
            border: '1px solid rgba(124,58,237,0.2)',
            fontSize: 12, color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span>{step.icon}</span>
            <span>{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>→</span>
          )}
        </div>
      ))}
    </div>
  )
}

function MetricStat({ label, value, color, icon }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="metric-card"
      style={{ textAlign: 'center' }}
    >
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </motion.div>
  )
}

export default function Dashboard({
  stats,
  architecture,
  graphMetrics,
  securityRisks,
  onGenerateReadme,
  onGenerateReport,
  reportLoading,
  aiArchitecture,
  aiArchLoading,
  onAnalyzeArchitecture,
}) {
  if (!stats || !architecture) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
        <span style={{ fontSize: 40 }}>📊</span>
        <span>Analyze a repo to see the dashboard</span>
      </div>
    )
  }

  const riskCounts = securityRisks?.reduce((acc, r) => {
    acc[r.severity] = (acc[r.severity] || 0) + 1
    return acc
  }, {}) || {}

  const complexityLabel = graphMetrics?.avg_complexity >= 6 ? 'High' : graphMetrics?.avg_complexity >= 3 ? 'Medium' : 'Low'
  const complexityColor = graphMetrics?.avg_complexity >= 6 ? '#ef4444' : graphMetrics?.avg_complexity >= 3 ? '#f97316' : '#10b981'

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: 20 }}>
      {/* Project type banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '14px 18px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(59,130,246,0.1) 100%)',
          border: '1px solid rgba(124,58,237,0.25)',
          marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PROJECT TYPE</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{architecture.project_type}</div>
        </div>
        <div style={{ fontSize: 32 }}>
          {architecture.project_type?.includes('Full') ? '🏗️' :
           architecture.project_type?.includes('Frontend') ? '🎨' :
           architecture.project_type?.includes('Backend') ? '⚙️' : '📦'}
        </div>
      </motion.div>

      {/* Key metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <MetricStat icon="📁" label="Total Files" value={stats.file_count?.toLocaleString()} color="#a78bfa" />
        <MetricStat icon="📝" label="Lines of Code" value={stats.total_lines?.toLocaleString()} color="#93c5fd" />
        <MetricStat icon="🔗" label="Dependencies" value={graphMetrics?.total_edges || 0} color="#6ee7b7" />
        <MetricStat icon="🌀" label="Complexity" value={complexityLabel} color={complexityColor} />
      </div>

      {/* Tech Stack */}
      {architecture.tech_stack?.length > 0 && (
        <div className="metric-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10 }}>🛠️ TECH STACK</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {architecture.tech_stack.map((tech, i) => (
              <motion.span
                key={i}
                whileHover={{ scale: 1.05 }}
                className="badge badge-purple"
              >
                {tech}
              </motion.span>
            ))}
          </div>
        </div>
      )}

      {/* Databases */}
      {architecture.databases?.length > 0 && (
        <div className="metric-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10 }}>🗄️ DATABASES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {architecture.databases.map((db, i) => (
              <span key={i} className="badge badge-blue">{db}</span>
            ))}
          </div>
        </div>
      )}

      {/* Architecture flow */}
      {architecture.architecture_flow?.length > 0 && (
        <div className="metric-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10 }}>🔄 STATIC ARCHITECTURE FLOW</div>
          <ArchitectureFlow steps={architecture.architecture_flow} />
        </div>
      )}

      {/* AI Deep Architecture Analysis */}
      <div className="metric-card" style={{ marginBottom: 16, border: '1px solid rgba(124,58,237,0.3)', background: 'linear-gradient(180deg, rgba(124,58,237,0.05) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🧠</span>
            <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 700, letterSpacing: '0.02em' }}>AI DEEP ARCHITECTURE MAP</div>
          </div>
          {!aiArchitecture && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAnalyzeArchitecture}
              disabled={aiArchLoading}
              className="badge badge-purple"
              style={{ padding: '6px 12px', fontSize: 10, cursor: aiArchLoading ? 'wait' : 'pointer', border: 'none', background: 'rgba(124,58,237,0.2)' }}
            >
              {aiArchLoading ? 'Analyzing...' : '✨ Run Groq AI Analysis'}
            </motion.button>
          )}
        </div>

        {aiArchitecture && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {aiArchitecture.explanation}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'rgba(59,130,246,0.08)', padding: '12px', borderRadius: 12, border: '1px solid rgba(59,130,246,0.15)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Frontend</div>
                <div style={{ fontWeight: 700, color: '#93c5fd', fontSize: 14 }}>{aiArchitecture.frontend}</div>
              </div>
              <div style={{ background: 'rgba(124,58,237,0.08)', padding: '12px', borderRadius: 12, border: '1px solid rgba(124,58,237,0.15)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Backend</div>
                <div style={{ fontWeight: 700, color: '#a78bfa', fontSize: 14 }}>{aiArchitecture.backend}</div>
              </div>
              <div style={{ background: 'rgba(16,185,129,0.08)', padding: '12px', borderRadius: 12, border: '1px solid rgba(16,185,129,0.15)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Database</div>
                <div style={{ fontWeight: 700, color: '#6ee7b7', fontSize: 14 }}>{aiArchitecture.database}</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.08)', padding: '12px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.15)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>API Layers</div>
                <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: 13 }}>
                  {aiArchitecture.apis?.length > 0 ? aiArchitecture.apis.join(', ') : 'Not detected'}
                </div>
              </div>
            </div>
            {aiArchitecture.mermaid_diagram && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 8, fontWeight: 600 }}>DIAGRAM</div>
                <MermaidGraph chart={aiArchitecture.mermaid_diagram} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Important files */}
      {graphMetrics?.important_files?.length > 0 && (
        <div className="metric-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10 }}>⭐ KEY FILES</div>
          {graphMetrics.important_files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '5px 0', borderBottom: i < graphMetrics.important_files.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                {f.path}
              </span>
              <span className="badge badge-orange" style={{ fontSize: 9, flexShrink: 0 }}>
                cx {f.complexity}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Circular dependencies */}
      {graphMetrics?.circular_dependency_count > 0 && (
        <div className="metric-card" style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.3)' }}>
          <div style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600, marginBottom: 10 }}>
            ⚠️ CIRCULAR DEPENDENCIES ({graphMetrics.circular_dependency_count})
          </div>
          {graphMetrics.circular_dependencies?.slice(0, 3).map((cycle, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '2px 0' }}>
              {cycle.join(' → ')}
            </div>
          ))}
        </div>
      )}

      {/* Security Risks */}
      {securityRisks?.length > 0 && (
        <div className="metric-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>🛡️ RISK RADAR</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {Object.entries(riskCounts).map(([sev, count]) => (
                <span key={sev} className={`badge badge-${sev === 'critical' || sev === 'high' ? 'red' : sev === 'medium' ? 'orange' : 'gray'}`} style={{ fontSize: 9 }}>
                  {count} {sev}
                </span>
              ))}
            </div>
          </div>
          {securityRisks.slice(0, 6).map((risk, i) => {
            const c = SEVERITY_COLORS[risk.severity] || SEVERITY_COLORS.low
            return (
              <div key={i} style={{
                padding: '6px 10px', borderRadius: 6, marginBottom: 6,
                background: c.bg, border: `1px solid ${c.border}`,
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.text }}>{risk.risk}</span>
                  <span style={{ fontSize: 9, color: c.badge, textTransform: 'uppercase', fontWeight: 700 }}>{risk.severity}</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {risk.file} · {risk.occurrences}×
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* PDF report + README */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        <motion.button
          whileHover={{ scale: reportLoading ? 1 : 1.02 }}
          whileTap={{ scale: reportLoading ? 1 : 0.98 }}
          onClick={onGenerateReport}
          disabled={reportLoading}
          type="button"
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(124,58,237,0.45)',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(59,130,246,0.15))',
            color: '#e2e8f0',
            fontWeight: 700,
            fontSize: 13,
            cursor: reportLoading ? 'wait' : 'pointer',
            fontFamily: 'var(--font-sans)',
            opacity: reportLoading ? 0.75 : 1,
          }}
        >
          {reportLoading ? '⏳ Building PDF…' : '📑 Generate Report (PDF)'}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onGenerateReadme}
          className="btn-primary"
          type="button"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          📄 Generate README
        </motion.button>
      </div>

      {/* Git info */}
      {stats.git?.branch && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Branch: <span style={{ color: '#a78bfa' }}>{stats.git.branch}</span>
          {stats.git.contributor_count > 0 && ` · ${stats.git.contributor_count} contributor${stats.git.contributor_count > 1 ? 's' : ''}`}
        </div>
      )}
    </div>
  )
}
