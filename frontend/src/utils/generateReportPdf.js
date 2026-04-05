import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

const H2C_OPTS = {
  scale: Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 2),
  useCORS: true,
  allowTaint: true,
  logging: false,
  backgroundColor: '#080b14',
}

/**
 * Tall screenshot → multiple PDF pages (negative Y offset trick).
 */
function addCanvasToPdf(pdf, canvas, marginMm = 10, imageTopMm = 10) {
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgW = pageW - 2 * marginMm
  const imgH = (canvas.height * imgW) / canvas.width
  const imgData = canvas.toDataURL('image/png', 0.92)

  const firstPageH = pageH - imageTopMm - marginMm
  const nextPageH = pageH - 2 * marginMm

  if (imgH <= firstPageH) {
    pdf.addImage(imgData, 'PNG', marginMm, imageTopMm, imgW, imgH)
    return
  }

  let heightLeft = imgH
  let position = imageTopMm
  pdf.addImage(imgData, 'PNG', marginMm, position, imgW, imgH)
  heightLeft -= firstPageH

  while (heightLeft > 0) {
    position = marginMm - (imgH - heightLeft)
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', marginMm, position, imgW, imgH)
    heightLeft -= nextPageH
  }
}

async function captureEl(el) {
  if (!el) return null
  return html2canvas(el, {
    ...H2C_OPTS,
    width: el.scrollWidth,
    height: el.scrollHeight,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  })
}

async function waitForMermaid(container, timeoutMs = 4000) {
  if (!container) return
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (container.querySelector('svg')) return
    await delay(120)
  }
}

/**
 * Build and download a PDF: cover text + dependency graph + dashboard (incl. Mermaid) + AI panel + optional code view.
 */
export async function generateCodeScopeReport({
  repoName,
  stats,
  architecture,
  graphMetrics,
  securityRisks,
  repoSummary,
  selectedFile,
  setCenterTab,
  currentTab,
}) {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const margin = 12
  let y = margin

  const safeName = (repoName || 'repository').replace(/[^\w\-./]+/g, '_').slice(0, 80)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.setTextColor(230, 230, 240)
  pdf.text('CodeScope AI — Analysis Report', margin, y)
  y += 12

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(180, 180, 200)
  pdf.text(`Repository: ${repoName || '—'}`, margin, y)
  y += 6
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, y)
  y += 10

  pdf.setFontSize(10)
  pdf.setTextColor(200, 200, 220)
  if (stats) {
    pdf.text(
      `Files: ${stats.file_count ?? '—'}   ·   Lines: ${stats.total_lines?.toLocaleString?.() ?? stats.total_lines ?? '—'}`,
      margin,
      y
    )
    y += 5
    if (stats.git?.branch) {
      pdf.text(`Branch: ${stats.git.branch}`, margin, y)
      y += 5
    }
  }
  if (architecture?.project_type) {
    pdf.text(`Project type: ${architecture.project_type}`, margin, y)
    y += 5
  }
  if (graphMetrics) {
    pdf.text(
      `Graph: ${graphMetrics.total_nodes ?? 0} nodes, ${graphMetrics.total_edges ?? 0} edges   ·   Avg complexity: ${graphMetrics.avg_complexity ?? '—'}`,
      margin,
      y
    )
    y += 5
  }
  if (securityRisks?.length) {
    pdf.setTextColor(250, 200, 120)
    pdf.text(`Security findings (sample in dashboard): ${securityRisks.length}`, margin, y)
    y += 5
  }

  y += 6
  pdf.setTextColor(160, 160, 180)
  pdf.setFontSize(9)
  const disclaimer = pdf.splitTextToSize(
    'The following pages are visual captures from this session: dependency graph, dashboard (including architecture flow and Mermaid diagram when available), AI panel, and optional code view.',
    180
  )
  pdf.text(disclaimer, margin, y)
  y += disclaimer.length * 4 + 4

  if (repoSummary?.elevator_pitch || repoSummary?.detailed_summary) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(220, 220, 240)
    pdf.text('AI repository summary (text)', margin, y)
    y += 7
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(200, 200, 215)
    const block = [repoSummary.elevator_pitch, repoSummary.detailed_summary].filter(Boolean).join('\n\n')
    const lines = pdf.splitTextToSize(block.slice(0, 4500), 180)
    for (const line of lines) {
      if (y > 275) {
        pdf.addPage()
        y = margin
      }
      pdf.text(line, margin, y)
      y += 4
    }
  }

  const prevTab = currentTab

  const sectionHeader = (title) => {
    pdf.addPage()
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.setTextColor(200, 190, 255)
    pdf.text(title, margin, 16)
  }

  // 1) Graph
  setCenterTab('graph')
  await delay(500)
  let canvas = await captureEl(document.getElementById('report-capture-graph'))
  if (canvas) {
    sectionHeader('1. Dependency graph')
    addCanvasToPdf(pdf, canvas, margin, 22)
  }

  // 2) Dashboard (scrollable — includes Mermaid when AI arch ran)
  setCenterTab('dashboard')
  await delay(500)
  await waitForMermaid(document.getElementById('report-capture-dashboard'))
  canvas = await captureEl(document.getElementById('report-capture-dashboard'))
  if (canvas) {
    sectionHeader('2. Dashboard, metrics & diagrams')
    addCanvasToPdf(pdf, canvas, margin, 22)
  }

  // 3) AI panel
  canvas = await captureEl(document.getElementById('report-capture-aipanel'))
  if (canvas) {
    sectionHeader('3. AI insight panel')
    addCanvasToPdf(pdf, canvas, margin, 22)
  }

  // 4) Code
  if (selectedFile?.path) {
    setCenterTab('code')
    await delay(450)
    canvas = await captureEl(document.getElementById('report-capture-code'))
    if (canvas) {
      sectionHeader(`4. Code — ${selectedFile.path}`)
      addCanvasToPdf(pdf, canvas, margin, 22)
    }
  }

  setCenterTab(prevTab)

  pdf.save(`CodeScope-report-${safeName}.pdf`)
}

/**
 * Export the rendered README / documentation preview (DOM subtree) as a multi-page PDF.
 */
export async function generateReadmeDocumentationPdf({ element, repoName }) {
  if (!element) {
    throw new Error('Nothing to export')
  }

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const margin = 12
  let y = margin

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.setTextColor(35, 35, 48)
  pdf.text('Repository documentation', margin, y)
  y += 10

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(100, 100, 120)
  if (repoName) {
    pdf.text(`Repository: ${repoName}`, margin, y)
    y += 6
  }
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, y)
  y += 8

  pdf.setFontSize(9)
  pdf.setTextColor(130, 130, 150)
  const note = pdf.splitTextToSize(
    'The following pages are a visual export of the full AI-generated documentation as shown in the preview (markdown rendered).',
    180
  )
  pdf.text(note, margin, y)

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  const canvas = await html2canvas(element, {
    ...H2C_OPTS,
    backgroundColor: '#0d1117',
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })

  pdf.addPage()
  addCanvasToPdf(pdf, canvas, margin, 12)

  const safeName = (repoName || 'repository').replace(/[^\w\-./]+/g, '_').slice(0, 80)
  pdf.save(`CodeScope-documentation-${safeName}.pdf`)
}
