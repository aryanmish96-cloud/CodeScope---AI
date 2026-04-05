import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { chatWithRepo } from '../api/client'

/** Build explorer shape from repo-relative path */
function fileFromPath(path) {
  if (!path || typeof path !== 'string') return null
  const name = path.split('/').pop() || path
  const ext = name.includes('.') ? `.${name.split('.').pop()}` : ''
  return { path, name, extension: ext }
}

/** Convert chat API highlights to CodeViewer ranges [[start,end], ...] for one file */
function rangesForFilePath(highlights, filePath) {
  if (!Array.isArray(highlights) || !filePath) return []
  const out = []
  for (const h of highlights) {
    if (!h || h.file !== filePath || !Array.isArray(h.lines) || h.lines.length < 1) continue
    const nums = h.lines.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    if (!nums.length) continue
    out.push([Math.min(...nums), Math.max(...nums)])
  }
  return out
}

/** After chat response: open Code tab on best file + line ranges */
function pickChatNavigation(res) {
  const hl = res?.highlights
  if (Array.isArray(hl) && hl.length > 0 && hl[0].file) {
    const path = hl[0].file
    return { path, ranges: rangesForFilePath(hl, path) }
  }
  const rf = res?.relevant_files?.[0]
  if (typeof rf === 'string' && rf.length) {
    return { path: rf, ranges: [] }
  }
  return null
}

const QUICK_QUESTIONS = [
  '🔐 Where is the login logic?',
  '🌐 How does the API work?',
  '🗄️ How is the database connected?',
  '🧪 Are there any tests?',
  '⚡ What are the entry points?',
  '🔥 What are the most important files?',
]

export default function ChatAssistant({ sessionId, open, onClose, onFileClick }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m CodeScope AI. Ask me anything about this repository — file locations, how features work, architecture decisions, or anything else!',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (question) => {
    const q = question || input.trim()
    if (!q || loading || !sessionId) return

    const userMsg = { role: 'user', content: q }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = messages
        .slice(1)
        .map(({ role, content }) => ({ role, content: typeof content === 'string' ? content : '' }))
      const res = await chatWithRepo(sessionId, q, history)

      const nav = pickChatNavigation(res)
      if (nav?.path) {
        const file = fileFromPath(nav.path)
        if (file) onFileClick?.(file, nav.ranges)
      }

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.answer,
        relevant_files: res.relevant_files,
        reason: res.reason,
        highlights: res.highlights,
        confidence: res.confidence
      }])
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '❌ Error communicating with the server. Please check your Groq API key or try clicking "Analyze" again to refresh the session.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          style={{
            position: 'fixed', bottom: 90, right: 24, width: 380, height: 500,
            background: 'rgba(13,17,23,0.97)',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 20,
            display: 'flex', flexDirection: 'column',
            zIndex: 1000,
            boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(124,58,237,0.15)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
              }}>
                🤖
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>CodeScope AI</div>
                <div style={{ fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  Online · Groq AI
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 13px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #7c3aed, #3b82f6)'
                    : 'rgba(31,45,69,0.8)',
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}

                  {msg.role === 'assistant' && msg.relevant_files?.length > 0 && (
                    <div style={{
                      marginTop: 12,
                      padding: '10px 12px',
                      background: 'rgba(0,0,0,0.15)',
                      borderRadius: 12,
                      border: '1px solid rgba(124,58,237,0.15)'
                    }}>
                      <div style={{
                        fontSize: 9,
                        color: '#60a5fa',
                        fontWeight: 700,
                        marginBottom: 8,
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#60a5fa' }} />
                        CONTEXT PILLS
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {msg.relevant_files.map((f, idx) => (
                          <motion.button
                            key={idx}
                            whileHover={{ scale: 1.05, background: 'rgba(124,58,237,0.2)' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              const file = typeof f === 'string' ? fileFromPath(f) : null
                              if (file) onFileClick?.(file, rangesForFilePath(msg.highlights, f))
                            }}
                            style={{
                              fontSize: 10,
                              color: '#93c5fd',
                              padding: '4px 10px',
                              borderRadius: 8,
                              background: 'rgba(124,58,237,0.1)',
                              border: '1px solid rgba(124,58,237,0.2)',
                              cursor: 'pointer',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {f.split('/').pop()}
                          </motion.button>
                        ))}
                      </div>
                      {msg.reason && (
                        <div style={{
                          marginTop: 8,
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          lineHeight: 1.5,
                          fontStyle: 'italic',
                          borderTop: '1px solid rgba(255,255,255,0.05)',
                          paddingTop: 8,
                        }}>
                          {msg.reason}
                        </div>
                      )}
                    </div>
                  )}
                  {msg.confidence && (
                    <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'right' }}>
                      Confidence: {msg.confidence}%
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, background: 'rgba(31,45,69,0.8)', width: 'fit-content' }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed' }}
                  />
                ))}
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <div style={{ padding: '0 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QUICK_QUESTIONS.slice(0, 4).map((q, i) => (
                <button
                  key={i}
                  onClick={() => send(q.replace(/^[^\s]+\s/, ''))}
                  style={{
                    padding: '4px 10px', borderRadius: 20,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-secondary)', fontSize: 11,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.target.style.borderColor = '#7c3aed'; e.target.style.color = '#a78bfa' }}
                  onMouseLeave={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-secondary)' }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              className="input-field"
              style={{ padding: '8px 12px', fontSize: 13 }}
              placeholder="Ask anything about the codebase..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              disabled={!sessionId}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => send()}
              disabled={loading || !sessionId || !input.trim()}
              style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, opacity: (loading || !sessionId || !input.trim()) ? 0.4 : 1,
              }}
            >
              ↑
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
