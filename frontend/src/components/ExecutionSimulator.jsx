import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { simulateExecution } from '../api/client'

export default function ExecutionSimulator({ sessionId, selectedFile }) {
  const [simulation, setSimulation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (selectedFile) {
      fetchSimulation()
    }
  }, [selectedFile])

  const fetchSimulation = async () => {
    if (!sessionId || !selectedFile) return
    setLoading(true)
    setSimulation(null)
    setError(null)
    setActiveStep(-1)
    try {
      const data = await simulateExecution(sessionId, selectedFile.path)
      setSimulation(data)
      // Auto-play animation
      setTimeout(() => {
        animateSteps(data.steps?.length || 0)
      }, 500)
    } catch (e) {
      setError('Simulation failed: ' + (e.response?.data?.detail || e.message))
    } finally {
      setLoading(false)
    }
  }

  const animateSteps = (count) => {
    let current = 0
    const interval = setInterval(() => {
      setActiveStep(current)
      current++
      if (current >= count) clearInterval(interval)
    }, 800)
  }

  if (!selectedFile) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
        <span style={{ fontSize: 32 }}>⚡</span>
        <p style={{ marginTop: 8, fontSize: 13 }}>Select a file to simulate its execution flow</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🎯</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>EXECUTION FLOW</span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchSimulation}
          disabled={loading}
          style={{
            background: 'rgba(124,58,237,0.1)',
            border: '1px solid rgba(124,58,237,0.2)',
            color: '#a78bfa',
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Simulating...' : '🔄 Re-run'}
        </motion.button>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="shimmer" style={{ height: 60, borderRadius: 12, width: '100%' }} />
          ))}
        </div>
      )}

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: 12 }}>
          {error}
        </div>
      )}

      {simulation && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', paddingLeft: 10 }}>
          {/* Vertical Line */}
          <div style={{
            position: 'absolute',
            left: 20,
            top: 20,
            bottom: 20,
            width: 2,
            background: 'linear-gradient(180deg, #7c3aed 0%, rgba(124,58,237,0.1) 100%)',
            opacity: 0.3,
          }} />

          {simulation.steps?.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{
                opacity: activeStep >= i ? 1 : 0.4,
                x: 0,
                scale: activeStep === i ? 1.02 : 1,
              }}
              style={{
                display: 'flex',
                gap: 16,
                padding: '12px 0',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Node Bullet */}
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: activeStep === i ? '#7c3aed' : 'var(--bg-card)',
                border: `2px solid ${activeStep >= i ? '#7c3aed' : 'var(--border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                flexShrink: 0,
                boxShadow: activeStep === i ? '0 0 15px rgba(124,58,237,0.5)' : 'none',
                transition: 'all 0.3s ease',
              }}>
                {step.icon || '•'}
              </div>

              {/* Content */}
              <div style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 12,
                background: activeStep === i ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${activeStep === i ? 'rgba(124,58,237,0.3)' : 'var(--border)'}`,
                transition: 'all 0.3s ease',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: activeStep === i ? '#a78bfa' : 'var(--text-primary)', marginBottom: 4 }}>
                  {step.label}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}

          {/* Data Objects Box */}
          {simulation.data_objects?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: 20,
                padding: 12,
                borderRadius: 12,
                background: 'rgba(0,0,0,0.2)',
                border: '1px dashed var(--border)',
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>MAIN DATA OBJECTS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {simulation.data_objects.map((obj, i) => (
                  <span key={i} style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(124,58,237,0.1)',
                    color: '#93c5fd',
                  }}>
                    {obj}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Trigger Banner */}
          {simulation.trigger && (
            <div style={{
              marginTop: 16,
              fontSize: 11,
              color: 'var(--text-muted)',
              textAlign: 'center',
              fontStyle: 'italic'
            }}>
              Trigger: <span style={{ color: '#6ee7b7' }}>{simulation.trigger}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
