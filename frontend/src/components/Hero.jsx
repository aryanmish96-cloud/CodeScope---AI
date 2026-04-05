import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'

const SAMPLE_REPOS = [
  'https://github.com/tiangolo/fastapi',
  'https://github.com/pallets/flask',
  'https://github.com/expressjs/express',
  'https://github.com/facebook/react',
]

const FEATURES = [
  { icon: '🌳', title: 'File Explorer', desc: 'VS Code–style tree — navigate thousands of files instantly.', accent: 'violet' },
  { icon: '🔗', title: 'Dependency Graph', desc: 'Interactive force-directed graph of imports & modules.', accent: 'blue' },
  { icon: '🧠', title: 'AI Deep Dive', desc: 'Groq-powered explanations for any file or flow you select.', accent: 'pink' },
  { icon: '⚡', title: '60s Summary', desc: 'Elevator pitch + strengths, weaknesses, and complexity.', accent: 'cyan' },
  { icon: '🛡️', title: 'Risk Radar', desc: 'Regex scan for secrets, XSS, injection patterns & debt.', accent: 'emerald' },
  { icon: '📄', title: 'README Studio', desc: 'Generate a polished README from detected architecture.', accent: 'amber' },
]

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 28 } },
}

const bentoBlock = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.055,
      delayChildren: 0.02,
    },
  },
}

const bentoItem = {
  hidden: { opacity: 0, y: 22, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 420, damping: 28 },
  },
}

export default function Hero({ onAnalyze, loading }) {
  const [url, setUrl] = useState('')
  const [focused, setFocused] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      toast.error('Enter a repository URL')
      return
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      toast.error('URL must start with https://')
      return
    }
    onAnalyze(trimmed)
  }

  return (
    <div className="hero-shell">
      <div className="hero-base" aria-hidden />
      <div className="hero-aurora" aria-hidden>
        <span className="a" />
        <span className="b" />
        <span className="c" />
      </div>
      <div className="hero-grid-lines" aria-hidden />
      <div className="hero-noise" aria-hidden />
      <div className="hero-frame" aria-hidden />

      <motion.div
        className="hero-inner"
        initial="hidden"
        animate="show"
        variants={container}
      >
        <motion.div variants={item} className="hero-badge">
          <div className="hero-badge-icon" aria-hidden>
            🔭
          </div>
          <div className="hero-badge-text">
            <div className="hero-badge-kicker">Inference</div>
            <div className="hero-badge-title">
              <span className="hero-badge-glow">Groq</span>
              {' · '}
              <span style={{ color: '#94a3b8' }}>Llama 3.1</span>
              <span style={{ color: '#64748b' }}> — instant</span>
            </div>
          </div>
        </motion.div>

        <motion.h1 variants={item} className="hero-title">
          <span className="hero-title-line1">CodeScope</span>
          <span className="hero-title-line2">
            <span className="hero-title-ai">AI</span>
          </span>
        </motion.h1>

        <motion.p variants={item} className="hero-sub">
          Paste a GitHub URL. We clone, map dependencies, scan risks, and explain the code —{' '}
          <strong style={{ color: '#cbd5e1', fontWeight: 600 }}>one flow, zero config.</strong>
        </motion.p>

        <motion.div variants={item} className="hero-pills">
          {['Live graph', 'Session-aware AI', 'Security scan'].map((label) => (
            <span key={label} className="hero-pill">
              {label}
            </span>
          ))}
        </motion.div>

        <motion.form variants={item} onSubmit={handleSubmit}>
          <div className="hero-input-outer" data-focus={focused ? 'true' : 'false'}>
            <div className="hero-input-inner">
              <span style={{ alignSelf: 'center', opacity: 0.7, flexShrink: 0 }} aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
                    fill="currentColor"
                    style={{ color: '#64748b' }}
                  />
                </svg>
              </span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="https://github.com/owner/repository"
                autoComplete="url"
                spellCheck={false}
              />
              <motion.button
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                type="submit"
                disabled={loading || !url.trim()}
                className="hero-btn-analyze"
              >
                {loading ? (
                  <span className="hero-loading-icon" aria-label="Loading">
                    ⟳
                  </span>
                ) : (
                  'Analyze →'
                )}
              </motion.button>
            </div>
          </div>
        </motion.form>

        <motion.div variants={item} className="hero-try-row">
          <span className="hero-try-label">Try</span>
          {SAMPLE_REPOS.map((repo, i) => {
            const name = repo.split('/').pop()
            return (
              <button
                key={i}
                type="button"
                className="hero-chip"
                onClick={() => {
                  setUrl(repo)
                  onAnalyze(repo)
                }}
              >
                {name}
              </button>
            )
          })}
        </motion.div>

        <motion.div className="hero-bento" variants={bentoBlock} style={{ marginTop: 8 }}>
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={bentoItem}
              className={`hero-card hero-card--${f.accent}`}
              onMouseMove={(e) => {
                const el = e.currentTarget
                const rect = el.getBoundingClientRect()
                el.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`)
                el.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`)
              }}
            >
              <div className="hero-card-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
