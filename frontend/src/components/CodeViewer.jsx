import React, { useEffect, useState, useRef, useMemo } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { getFileContent } from '../api/client'

export default function CodeViewer({ sessionId, selectedFile, highlights }) {
  const [sourceCode, setSourceCode] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRootRef = useRef(null)
  
  useEffect(() => {
    if (!sessionId || !selectedFile?.path) return
    let isMounted = true
    const fetchCode = async () => {
      setLoading(true)
      try {
        const fileData = await getFileContent(sessionId, selectedFile.path)
        if (isMounted) setSourceCode(fileData.content || '')
      } catch (err) {
        if (isMounted) setSourceCode(`// Error loading source code for ${selectedFile.path}\n// ${err.message}`)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchCode()
    return () => { isMounted = false }
  }, [sessionId, selectedFile?.path])

  const highlightRanges = useMemo(() => (Array.isArray(highlights) ? highlights : []), [highlights])

  // Scroll first highlighted line into view (e.g. after chat → jump to logic)
  useEffect(() => {
    if (loading || !highlightRanges.length || !scrollRootRef.current) return
    const startLine = highlightRanges[0][0]
    const t = requestAnimationFrame(() => {
      const root = scrollRootRef.current
      const el = root?.querySelector(`[data-source-line="${startLine}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => cancelAnimationFrame(t)
  }, [loading, sourceCode, selectedFile?.path, highlightRanges])

  if (!selectedFile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
        <span style={{ fontSize: 40 }}>💻</span>
        <span>Select a file from Chat or Explorer to view code</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', overflow: 'hidden' }}>
      <div style={{ 
        padding: '10px 16px', background: '#252526', borderBottom: '1px solid #333', 
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 
      }}>
        <span style={{ fontSize: 13 }}>📄</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#d4d4d4', fontWeight: 600 }}>
          {selectedFile.path}
        </span>
      </div>
      
      <div ref={scrollRootRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            Loading source code...
          </div>
        ) : (
          <SyntaxHighlighter
            language={selectedFile.extension ? selectedFile.extension.replace('.', '') : 'javascript'}
            style={vscDarkPlus}
            showLineNumbers={true}
            wrapLines={true}
            customStyle={{ margin: 0, padding: 16, background: '#1e1e1e', fontSize: 13, fontFamily: 'var(--font-mono)' }}
            lineNumberStyle={{ minWidth: '3em', paddingRight: '1em', color: '#858585', textAlign: 'right' }}
            lineProps={lineNumber => {
              const style = { display: 'block', width: '100%' }
              let isHighlighted = false
              for (const range of highlightRanges) {
                if (lineNumber >= range[0] && lineNumber <= range[1]) {
                  isHighlighted = true
                  break
                }
              }
              if (isHighlighted) {
                style.backgroundColor = 'rgba(124, 58, 237, 0.4)'
                style.boxShadow = 'inset 4px 0 0px 0px #a78bfa'
                style.paddingLeft = '4px'
              }
              return {
                style,
                'data-source-line': lineNumber,
              }
            }}
          >
            {sourceCode || '// Empty file'}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  )
}
