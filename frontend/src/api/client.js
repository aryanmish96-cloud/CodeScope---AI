import axios from 'axios'

// Dev: Vite proxies /api → http://127.0.0.1:8000. Production: set VITE_API_URL to full API root, e.g. https://api.example.com/api
const BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE,
  timeout: 120_000, // 2 min for repo cloning
  headers: { 'Content-Type': 'application/json' },
})

if (import.meta.env.DEV) {
  api.interceptors.request.use((config) => {
    const path = `${config.baseURL || ''}${config.url || ''}`
    const payload = config.data ?? config.params
    console.log(`[api] ${(config.method || 'get').toUpperCase()} ${path}`, payload ?? '')
    return config
  })
}

/** Clone + analyze a repository. Returns tree, graph, architecture, stats */
export const analyzeRepo = (repoUrl) =>
  api.post('/analyze', { repo_url: repoUrl }).then((r) => r.data)

/** Get AI summary for a session (uses repo data stored server-side for that session) */
export const summarizeRepo = (sessionId) =>
  api.post('/summarize', { session_id: sessionId }).then((r) => r.data)

/** Explain a single file */
export const explainFile = (sessionId, filePath, eli5 = false) =>
  api.post('/explain-file', { session_id: sessionId, file_path: filePath, eli5 }).then((r) => r.data)

/** Chat with the repo AI */
export const chatWithRepo = (sessionId, question, history = []) =>
  api.post('/chat', { session_id: sessionId, question, history }).then((r) => r.data)

/** Generate a professional README */
export const generateReadme = (sessionId) =>
  api.post('/generate-readme', { session_id: sessionId }).then((r) => r.data)

/** Get AI deep architecture analysis */
export const analyzeArchitecture = (sessionId) =>
  api.post('/analyze-architecture', { session_id: sessionId }).then((r) => r.data)

/** Get AI-predicted execution flow */
export const simulateExecution = (sessionId, filePath) =>
  api.post('/simulate-execution', { session_id: sessionId, file_path: filePath }).then((r) => r.data)

/** Get raw file content */
export const getFileContent = (sessionId, filePath) =>
  api.get('/file-content', { params: { session_id: sessionId, file_path: filePath } }).then((r) => r.data)

export default api
