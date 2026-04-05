import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { explainFile } from '../api/client'
import ExecutionSimulator from './ExecutionSimulator'

function ConfidenceBar({ value }) {
  const color = value >= 75 ? '#10b981' : value >= 50 ? '#f97316' : '#ef4444'
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
        <span style={{ color: 'var(--text-muted)' }}>AI Confidence</span>
        <span style={{ color, fontWeight: 600 }}>{value}%</span>
      </div>
      <div className="confidence-bar">
        <motion.div
          className="confidence-fill"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          style={{ background: `linear-gradient(90deg, ${color}, #7c3aed)` }}
        />
      </div>
    </div>
  )
}

function SecurityFlag({ flag, severity }) {
  const colors = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6b7280' }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px', borderRadius: 6,
      background: `${colors[severity]}15`,
      border: `1px solid ${colors[severity]}30`,
      fontSize: 12, marginBottom: 4,
    }}>
      <span style={{ color: colors[severity], fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>
        {severity}
      </span>
      <span style={{ color: 'var(--text-secondary)' }}>{flag}</span>
    </div>
  )
}

export default function AIPanel({ sessionId, selectedFile, techStack, repoSummary }) {
  const [explanation, setExplanation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [eli5, setEli5] = useState(false)
  const [tab, setTab] = useState('explain') // explain | summary | flow | security

  useEffect(() => {
    if (!sessionId || !selectedFile?.path) {
      setExplanation(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setExplanation(null)

    ;(async () => {
      try {
        const data = await explainFile(sessionId, selectedFile.path, eli5)
        if (!cancelled) setExplanation(data)
      } catch (e) {
        const detail = e?.response?.data?.detail
        const errMsg =
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail.map((d) => d.msg || d).join(', ')
              : e.message || 'Unknown error'
        if (!cancelled) {
          setExplanation({ summary: `Error: ${errMsg}`, key_functions: [], confidence: 0 })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionId, selectedFile?.path, eli5])

  const toggleEli5 = () => {
    setEli5((v) => !v)
  }

  return (
    <div id="report-capture-aipanel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🧠</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>AI Explanation</span>
          </div>
          {/* ELI5 Toggle */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={toggleEli5}
            style={{
              padding: '4px 10px', borderRadius: 20,
              border: `1px solid ${eli5 ? '#7c3aed' : 'var(--border)'}`,
              background: eli5 ? 'rgba(124,58,237,0.15)' : 'transparent',
              color: eli5 ? '#a78bfa' : 'var(--text-muted)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            🎈 ELI5
          </motion.button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['explain', 'flow', 'summary', 'security'].map((t) => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'explain' ? '📄 File' : t === 'flow' ? '⚡ Flow' : t === 'summary' ? '📊 Repo' : '🛡️ Risks'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <AnimatePresence mode="wait">
          {tab === 'explain' && (
            <motion.div
              key="explain"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              {!selectedFile && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
                  <span style={{ fontSize: 32 }}>👆</span>
                  <p style={{ marginTop: 8, fontSize: 13 }}>Click a file in the explorer or graph node to get AI analysis</p>
                </div>
              )}

              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[80, 60, 90, 50, 70].map((w, i) => (
                    <div key={i} className="shimmer" style={{ height: 12, borderRadius: 6, width: `${w}%` }} />
                  ))}
                </div>
              )}

              {explanation && !loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* File path */}
                  {selectedFile && (
                    <div style={{
                      padding: '6px 10px', borderRadius: 6,
                      background: 'rgba(124,58,237,0.1)',
                      border: '1px solid rgba(124,58,237,0.2)',
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      color: '#a78bfa', wordBreak: 'break-all',
                    }}>
                      {selectedFile.path}
                    </div>
                  )}

                  {/* ELI5 badge */}
                  {eli5 && <span className="badge badge-purple">🎈 ELI5 Mode</span>}

                  {/* Summary */}
                  <div className="metric-card">
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>📝 SUMMARY</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{explanation.summary}</p>
                  </div>

                  {/* Key functions */}
                  {explanation.key_functions?.length > 0 && (
                    <div className="metric-card">
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10 }}>⚡ KEY FUNCTIONS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {explanation.key_functions.map((fn, i) => (
                          <div key={i} style={{
                            padding: '10px 12px', borderRadius: 10,
                            background: 'rgba(59,130,246,0.05)',
                            border: '1px solid rgba(59,130,246,0.1)',
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                              {typeof fn === 'string' ? fn : fn.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                {typeof fn === 'string' ? '' : fn.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Logic flow */}
                  {explanation.logic_flow && (
                    <div className="metric-card">
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>🔄 LOGIC FLOW</div>
                      <div style={{
                        padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
                      }}>
                        {explanation.logic_flow}
                      </div>
                    </div>
                  )}

                  {/* Role in project */}
                  {explanation.role_in_project && (
                    <div className="metric-card">
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>🎯 ROLE IN PROJECT</div>
                      <div style={{
                        padding: 12, borderRadius: 10, background: 'linear-gradient(135deg, rgba(139,94,242,0.05) 0%, transparent 100%)',
                        border: '1px solid rgba(139,94,242,0.2)',
                        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
                      }}>
                        {explanation.role_in_project}
                      </div>
                    </div>
                  )}

                  {/* Security flags */}
                  {explanation.security_flags?.length > 0 && (
                    <div className="metric-card">
                      <div style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600, marginBottom: 8 }}>⚠️ SECURITY FLAGS</div>
                      {explanation.security_flags.map((flag, i) => (
                        <SecurityFlag key={i} flag={flag} severity="high" />
                      ))}
                    </div>
                  )}

                  {/* Confidence */}
                  {explanation.confidence !== undefined && (
                    <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)' }}>
                      <ConfidenceBar value={explanation.confidence} />
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {tab === 'flow' && (
            <motion.div
              key="flow"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <ExecutionSimulator sessionId={sessionId} selectedFile={selectedFile} />
            </motion.div>
          )}

          {tab === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              {!repoSummary ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
                  <span style={{ fontSize: 32 }}>📊</span>
                  <p style={{ marginTop: 8, fontSize: 13 }}>Repo summary loading...</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {repoSummary.elevator_pitch && (
                    <div style={{
                      padding: 14, borderRadius: 12,
                      background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(59,130,246,0.1))',
                      border: '1px solid rgba(124,58,237,0.2)',
                    }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        "{repoSummary.elevator_pitch}"
                      </p>
                    </div>
                  )}
                  {repoSummary.detailed_summary && (
                    <div className="metric-card">
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>📋 OVERVIEW</div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{repoSummary.detailed_summary}</p>
                    </div>
                  )}
                  {repoSummary.sixty_second_explanation && (
                    <div className="metric-card">
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>⏱️ 60-SECOND PITCH</div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{repoSummary.sixty_second_explanation}</p>
                    </div>
                  )}
                  {repoSummary.strengths?.length > 0 && (
                    <div className="metric-card">
                      <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 600, marginBottom: 8 }}>✅ STRENGTHS</div>
                      {repoSummary.strengths.map((s, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0' }}>
                          <span style={{ color: '#6ee7b7', marginRight: 6 }}>+</span>{s}
                        </div>
                      ))}
                    </div>
                  )}
                  {repoSummary.weaknesses?.length > 0 && (
                    <div className="metric-card">
                      <div style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600, marginBottom: 8 }}>⚠️ WEAKNESSES</div>
                      {repoSummary.weaknesses.map((w, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0' }}>
                          <span style={{ color: '#fca5a5', marginRight: 6 }}>-</span>{w}
                        </div>
                      ))}
                    </div>
                  )}
                  {repoSummary.confidence !== undefined && (
                    <ConfidenceBar value={repoSummary.confidence} />
                  )}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'security' && (
            <motion.div
              key="security"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <SecurityTab sessionId={sessionId} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function SecurityTab({ sessionId }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 30 }}>
      <span style={{ fontSize: 32 }}>🛡️</span>
      <p style={{ marginTop: 8, fontSize: 13 }}>Security risks are shown in the Dashboard tab</p>
    </div>
  )
}
