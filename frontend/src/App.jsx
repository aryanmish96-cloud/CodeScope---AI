import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'react-hot-toast'

import Hero from './components/Hero'
import FileExplorer from './components/FileExplorer'
import DependencyGraph from './components/DependencyGraph'
import AIPanel from './components/AIPanel'
import Dashboard from './components/Dashboard'
import ChatAssistant from './components/ChatAssistant'
import ReadmeModal from './components/ReadmeModal'
import LoadingOverlay from './components/LoadingOverlay'
import CodeViewer from './components/CodeViewer'

import { analyzeRepo, summarizeRepo, analyzeArchitecture } from './api/client'
import { generateCodeScopeReport } from './utils/generateReportPdf'

// ── View tabs for the center panel ──────────────────────────────────
const CENTER_TABS = [
  { id: 'graph', label: '🔗 Graph' },
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'code', label: '💻 Code' },
]

export default function App() {
  const [view, setView] = useState('hero') // hero | explorer
  const [loading, setLoading] = useState(false)
  const [centerTab, setCenterTab] = useState('graph')
  const [chatOpen, setChatOpen] = useState(false)
  const [readmeOpen, setReadmeOpen] = useState(false)

  // Data state
  const [sessionId, setSessionId] = useState(null)
  const [repoName, setRepoName] = useState('')
  const [tree, setTree] = useState(null)
  const [graphData, setGraphData] = useState(null)
  const [architecture, setArchitecture] = useState(null)
  const [stats, setStats] = useState(null)
  const [securityRisks, setSecurityRisks] = useState([])
  const [repoSummary, setRepoSummary] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [highlightRanges, setHighlightRanges] = useState([])
  
  const [aiArchitecture, setAiArchitecture] = useState(null)
  const [aiArchLoading, setAiArchLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  // ── Analyze repo ──────────────────────────────────────────────────
  const handleAnalyze = useCallback(async (url) => {
    setLoading(true)
    setView('hero')

    try {
      const data = await analyzeRepo(url)
      setSessionId(data.session_id)
      setRepoName(data.repo_name)
      setTree(data.tree)
      setGraphData(data.graph)
      setArchitecture(data.architecture)
      setStats(data.stats)
      setSecurityRisks(data.security_risks || [])
      setSelectedFile(null)
      setRepoSummary(null)
      setAiArchitecture(null)
      setView('explorer')
      toast.success(`✅ ${data.repo_name} analyzed!`, { duration: 3000 })

      // Fetch AI summary in background (same session_id as /api/analyze response)
      if (import.meta.env.DEV) {
        console.log('[session] analyze success, session_id=', data.session_id)
      }
      setTimeout(() => {
        summarizeRepo(data.session_id)
          .then(setRepoSummary)
          .catch((err) => {
            console.error('[summarize]', err?.response?.status, err?.response?.data || err)
            const detail = err?.response?.data?.detail
            const msg = typeof detail === 'string' ? detail : 'AI summary failed'
            toast.error(msg, { duration: 4000 })
          })
      }, 500)
    } catch (err) {
      console.error(err)
      const msg = err?.response?.data?.detail || err.message || 'Analysis failed'
      toast.error(`❌ ${msg}`, { duration: 5000 })
      setView('hero')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── File click from explorer tree or chat ─────────────────────────
  const handleFileSelect = useCallback((file, highlights = []) => {
    setSelectedFile(file)
    setHighlightRanges(highlights)
    if (highlights.length > 0) {
      setCenterTab('code')
    }
  }, [])

  // ── Graph node click → file select ────────────────────────────────
  const handleGraphNodeClick = useCallback((nodeData) => {
    setSelectedFile({ path: nodeData.path, name: nodeData.label, extension: nodeData.extension })
  }, [])

  // ── README generator ──────────────────────────────────────────────
  const handleGenerateReadme = () => {
    if (!sessionId) return
    setReadmeOpen(true)
  }

  const handleGenerateReport = async () => {
    if (!sessionId || !stats) {
      toast.error('Analyze a repository first')
      return
    }
    setChatOpen(false)
    setReportLoading(true)
    const t = toast.loading('Building PDF — capturing graph, dashboard, AI panel…')
    try {
      await generateCodeScopeReport({
        repoName,
        stats,
        architecture,
        graphMetrics: graphData?.metrics,
        securityRisks,
        repoSummary,
        selectedFile,
        setCenterTab,
        currentTab: centerTab,
      })
      toast.success('Report downloaded', { id: t })
    } catch (err) {
      console.error(err)
      toast.error(err?.message || 'Could not generate PDF', { id: t })
    } finally {
      setReportLoading(false)
    }
  }

  // ── Deep architecture ──────────────────────────────────────────────
  const handleAnalyzeArchitecture = async () => {
    if (!sessionId) return
    setAiArchLoading(true)
    try {
      const data = await analyzeArchitecture(sessionId)
      setAiArchitecture(data)
      toast.success('Architecture analyzed by AI 🧠')
    } catch (err) {
      console.error(err)
      toast.error('AI Architecture analysis failed')
    } finally {
      setAiArchLoading(false)
    }
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
          },
        }}
      />

      <LoadingOverlay visible={loading} />

      <AnimatePresence mode="wait">
        {view === 'hero' ? (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ height: '100vh', overflow: 'auto' }}
          >
            <Hero onAnalyze={handleAnalyze} loading={loading} />
          </motion.div>
        ) : (
          <motion.div
            key="explorer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="app-layout"
          >
            {/* ── Top Header Bar ─────────────────────────────── */}
            <header className="app-header">
              {/* Logo */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setView('hero')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', borderRadius: 8,
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ fontSize: 18 }}>🔭</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  <span className="gradient-text">CodeScope</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> AI</span>
                </span>
              </motion.button>

              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

              {/* Repo name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13 }}>📦</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>
                  {repoName}
                </span>
                {architecture?.project_type && (
                  <span className="badge badge-blue" style={{ fontSize: 10 }}>{architecture.project_type}</span>
                )}
              </div>

              {/* Center tabs */}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                {CENTER_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    className={`tab-btn ${centerTab === tab.id ? 'active' : ''}`}
                    onClick={() => setCenterTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setChatOpen(!chatOpen)}
                  className="btn-ghost"
                  style={{
                    borderColor: chatOpen ? 'var(--accent-purple)' : 'var(--border)',
                    color: chatOpen ? '#a78bfa' : 'var(--text-secondary)',
                    background: chatOpen ? 'rgba(124,58,237,0.1)' : 'transparent',
                  }}
                >
                  💬 Chat
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setView('hero')}
                  className="btn-ghost"
                >
                  ← New Repo
                </motion.button>
              </div>
            </header>

            {/* ── Left Panel: File Explorer ───────────────────── */}
            <aside className="panel-left">
              <FileExplorer
                tree={tree}
                onFileSelect={handleFileSelect}
                selectedPath={selectedFile?.path}
                stats={stats}
              />
            </aside>

            {/* ── Center Panel: Graph / Dashboard ─────────────── */}
            <main className="panel-center">
              <AnimatePresence mode="wait">
                {centerTab === 'graph' ? (
                  <motion.div
                    key="graph"
                    id="report-capture-graph"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <DependencyGraph
                      graphData={graphData}
                      onNodeClick={handleGraphNodeClick}
                      metrics={graphData?.metrics}
                    />
                  </motion.div>
                ) : centerTab === 'code' ? (
                  <motion.div
                    key="code"
                    id="report-capture-code"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <CodeViewer
                      sessionId={sessionId}
                      selectedFile={selectedFile}
                      highlights={highlightRanges}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="dash"
                    id="report-capture-dashboard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ width: '100%', height: '100%', overflowY: 'auto' }}
                  >
                    <Dashboard
                      stats={stats}
                      architecture={architecture}
                      graphMetrics={graphData?.metrics}
                      securityRisks={securityRisks}
                      onGenerateReadme={handleGenerateReadme}
                      onGenerateReport={handleGenerateReport}
                      reportLoading={reportLoading}
                      aiArchitecture={aiArchitecture}
                      aiArchLoading={aiArchLoading}
                      onAnalyzeArchitecture={handleAnalyzeArchitecture}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            {/* ── Right Panel: AI Explanation ─────────────────── */}
            <aside className="panel-right">
              <AIPanel
                sessionId={sessionId}
                selectedFile={selectedFile}
                techStack={architecture?.tech_stack}
                repoSummary={repoSummary}
              />
            </aside>

            {/* ── Floating chat button ─────────────────────────── */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setChatOpen(!chatOpen)}
              className="pulse-glow"
              style={{
                position: 'fixed', bottom: 24, right: 24, width: 52, height: 52,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                border: '2px solid rgba(124,58,237,0.4)',
                color: '#fff', fontSize: 22,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 999,
              }}
            >
              {chatOpen ? '×' : '💬'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating overlays ────────────────────────────────────── */}
      <ChatAssistant
        sessionId={sessionId}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onFileClick={handleFileSelect}
      />

      {readmeOpen && sessionId && (
        <ReadmeModal
          sessionId={sessionId}
          repoName={repoName}
          open={readmeOpen}
          onClose={() => setReadmeOpen(false)}
        />
      )}
    </>
  )
}
