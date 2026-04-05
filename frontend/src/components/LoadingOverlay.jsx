import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

const STEPS = [
  { icon: '🔍', text: 'Cloning repository...' },
  { icon: '🌳', text: 'Parsing file structure...' },
  { icon: '🔗', text: 'Extracting dependencies...' },
  { icon: '🗺️', text: 'Building dependency graph...' },
  { icon: '🧠', text: 'Detecting architecture...' },
  { icon: '🛡️', text: 'Running security scan...' },
  { icon: '✨', text: 'Finalizing analysis...' },
]

export default function LoadingOverlay({ visible }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!visible) { setStep(0); return }
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(8, 11, 20, 0.92)',
            backdropFilter: 'blur(20px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, gap: 32,
          }}
        >
          {/* Animated logo */}
          <div style={{ position: 'relative', width: 120, height: 120 }}>
            {/* Outer ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute', inset: 0,
                border: '2px solid transparent',
                borderTopColor: '#7c3aed',
                borderRightColor: '#3b82f6',
                borderRadius: '50%',
              }}
            />
            {/* Inner ring */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute', inset: 12,
                border: '2px solid transparent',
                borderTopColor: '#06b6d4',
                borderLeftColor: '#10b981',
                borderRadius: '50%',
              }}
            />
            {/* Center icon */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36,
            }}>
              🔭
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
              <span className="gradient-text">Analyzing Repository</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              This may take 30–60 seconds for large repos
            </p>
          </div>

          {/* Steps */}
          <div style={{
            background: 'rgba(17,24,39,0.8)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '20px 32px',
            minWidth: 300, textAlign: 'center',
          }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{ fontSize: 15, color: 'var(--text-primary)' }}
              >
                <span style={{ marginRight: 10, fontSize: 20 }}>{STEPS[step].icon}</span>
                {STEPS[step].text}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 8 }}>
            {STEPS.map((_, i) => (
              <motion.div
                key={i}
                animate={{ scale: i === step ? 1.4 : 1, opacity: i <= step ? 1 : 0.3 }}
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: i <= step ? '#7c3aed' : 'var(--text-muted)',
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
