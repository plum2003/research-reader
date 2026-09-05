import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import html2canvas from 'html2canvas'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { FigureCapture, Paper, SelectionContext } from '../types'
import { DEMO_PAPER_ID, demoText } from '../data'
import { Icon } from './Icon'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

interface PdfReaderProps {
  paper?: Paper
  pageNumber: number
  onPageChange: (page: number) => void
  onSelection: (selection: SelectionContext | null) => void
  onDocumentLoaded: (pageCount: number) => void
  onFigureCapture: (capture: FigureCapture) => void
  onActionMessage: (message: string) => void
  onOpenSettings: () => void
}

interface CaptureBox {
  x: number
  y: number
  width: number
  height: number
}

interface TextItemPosition {
  id: string
  text: string
  left: number
  top: number
  width: number
  fontSize: number
}

function cleanSelection(text: string) {
  return text.replace(/-\s*\n\s*/g, '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

function DemoPage({ onSelection }: { onSelection: (selection: SelectionContext | null) => void }) {
  const handleMouseUp = () => {
    const selection = window.getSelection()
    const text = selection ? cleanSelection(selection.toString()) : ''
    if (!text) return
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    const rect = range?.getBoundingClientRect()
    if (!rect) return
    onSelection({
      paperId: 'paper-demo-kidney-aging',
      pageNumber: 7,
      text,
      context: demoText.slice(0, 360),
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    })
  }

  return (
    <div className="demo-paper" onMouseUp={handleMouseUp}>
      <div className="paper-running-head"><strong>Nature Medicine</strong><span>Article</span></div>
      <div className="paper-rule" />
      <div className="paper-columns">
        <div className="paper-column">
          <p>transcriptomic states that are associated with distinct cellular functions and injury responses. However, the extent to which kidney aging involves cell type–specific transcriptomic changes and how these changes relate to functional decline remain incompletely understood.</p>
          <p>Here, we present a single-cell transcriptomic atlas of 471,422 cells from kidneys of healthy donors spanning a wide age range (0–89 years). We identify major cell types and states, characterize age-associated molecular changes, and map intercellular communication networks that are rewired with age.</p>
          <h3>Results</h3>
          <h4>Single-cell landscape of the human kidney across age</h4>
          <p className="selectable-highlight">We generated snRNA-seq profiles from kidney cortex tissues of 103 donors (0–89 years old). After quality control, we obtained 471,422 cells with a median of 2,454 genes and 6,721 UMIs per cell. Unsupervised clustering identified 34 major cell populations across all donors.</p>
          <p>These included expected cell types such as podocytes, proximal tubular cells, loop of Henle cells, distal tubular cells, collecting duct cells, endothelial cells, mesangial cells, fibroblasts, immune cells, and pericytes.</p>
          <p>Cell type annotation was performed using canonical marker genes and reference datasets. The proportion of major cell types was broadly conserved across age groups, with minor shifts in the abundance of specific immune populations.</p>
        </div>
        <div className="paper-column">
          <h4>Cellular states and trajectories in aging kidney</h4>
          <p>To explore cellular heterogeneity, we performed subclustering within major cell types. In proximal tubular cells, we identified multiple states associated with metabolic activity, stress response, and fibrosis programs (Fig. 2a).</p>
          <p>Pseudotime trajectory analysis revealed a continuum from a homeostatic state to a stress-responsive state enriched in injury and inflammation genes (Fig. 2b).</p>
          <p>In endothelial cells, aging was associated with upregulation of genes involved in leukocyte adhesion and extracellular matrix remodeling. Fibroblasts showed an expansion of myofibroblast-like states with age, accompanied by increased expression of COL1A1, ACTA2, and POSTN.</p>
          <h4>Age-associated transcriptional changes</h4>
          <p>We assessed differential gene expression with age using linear models adjusted for sex and sequencing covariates. Across cell types, we identified 3,856 genes significantly associated with age (FDR &lt; 0.05).</p>
          <p>Gene ontology analysis highlighted enrichment in pathways related to extracellular matrix organization, mitochondrial function, and immune response (Fig. 3b).</p>
          <h4>Intercellular communication rewiring</h4>
          <p>Using CellChat, we inferred ligand–receptor interactions and found that aging kidneys exhibit increased signaling related to TGF-β, TNF, and complement pathways.</p>
        </div>
      </div>
      <div className="paper-footer"><span>7</span></div>
    </div>
  )
}

function PdfPage({ pdf, pageNumber, scale, onSelection, onPageCount }: { pdf: pdfjsLib.PDFDocumentProxy; pageNumber: number; scale: number; onSelection: (selection: SelectionContext | null) => void; onPageCount: (count: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: 760, height: 980 })
  const [textItems, setTextItems] = useState<TextItemPosition[]>([])

  useEffect(() => {
    let cancelled = false
    let renderTask: { promise: Promise<unknown>; cancel: () => void } | null = null

    const renderPage = async () => {
      const page = await pdf.getPage(pageNumber)
      if (cancelled) return
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return

      // A PDF page can be re-mounted while the previous scale is still
      // rendering. Only the newest render may update the canvas dimensions or
      // text layer; otherwise a stale 100% render can overwrite a fitted one.
      setViewportSize({ width: viewport.width, height: viewport.height })
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      const context = canvas.getContext('2d')
      if (!context || cancelled) return

      renderTask = page.render({ canvasContext: context, viewport })
      try {
        await renderTask.promise
      } catch {
        if (cancelled) return
        return
      }
      if (cancelled) return

      const content = await page.getTextContent()
      if (cancelled) return
      const items = content.items.filter((item): item is TextItem => 'str' in item).map((item, index) => {
        const transform = pdfjsLib.Util.transform(viewport.transform, item.transform)
        const fontSize = Math.max(7, Math.hypot(transform[0], transform[1]))
        return {
          id: `${pageNumber}-${index}`,
          text: item.str,
          left: transform[4],
          top: transform[5] - fontSize,
          width: Math.max(item.width * scale, 2),
          fontSize,
        }
      })
      if (!cancelled) setTextItems(items)
    }

    void renderPage()
    onPageCount(pdf.numPages)
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [pdf, pageNumber, scale, onPageCount])

  const handleMouseUp = () => {
    const selection = window.getSelection()
    const text = selection ? cleanSelection(selection.toString()) : ''
    if (!text) return
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    const rect = range?.getBoundingClientRect()
    if (!rect) return
    onSelection({
      paperId: 'uploaded-paper',
      pageNumber,
      text,
      context: textItems.slice(0, 8).map((item) => item.text).join(' '),
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    })
  }

  return (
    <div className="pdf-page" style={{ width: viewportSize.width, height: viewportSize.height }} onMouseUp={handleMouseUp}>
      <canvas ref={canvasRef} />
      <div className="pdf-text-layer" aria-label="Selectable PDF text">
        {textItems.map((item) => <span key={item.id} style={{ left: item.left, top: item.top, width: item.width, fontSize: item.fontSize }}>{item.text}</span>)}
      </div>
    </div>
  )
}

export function PdfReader({ paper, pageNumber, onPageChange, onSelection, onDocumentLoaded, onFigureCapture, onActionMessage, onOpenSettings }: PdfReaderProps) {
  const [scale, setScale] = useState(1.04)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [captureMode, setCaptureMode] = useState(false)
  const [captureBox, setCaptureBox] = useState<CaptureBox | null>(null)
  const [bookmarked, setBookmarked] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const pageFrameRef = useRef<HTMLDivElement>(null)
  const readerStageRef = useRef<HTMLDivElement>(null)
  const captureStartRef = useRef<{ x: number; y: number } | null>(null)
  const autoFitWidthRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    if (!paper?.pdfUrl) {
      setPdf(null)
      setLoadError('')
      return
    }
    setLoading(true)
    setLoadError('')
    pdfjsLib.getDocument(paper.pdfUrl).promise.then((document) => {
      if (cancelled) return
      setPdf(document)
      onDocumentLoaded(document.numPages)
    }).catch((error: Error) => {
      if (!cancelled) setLoadError(error.message || 'PDF 无法读取')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [paper?.pdfUrl, onDocumentLoaded])

  const activePage = useMemo(() => Math.min(Math.max(pageNumber, 1), paper?.pageCount || 1), [pageNumber, paper?.pageCount])

  useEffect(() => {
    if (!pdf || !readerStageRef.current) return
    autoFitWidthRef.current = true
    let cancelled = false
    const stage = readerStageRef.current

    const fitCurrentPage = async () => {
      const page = await pdf.getPage(activePage)
      if (cancelled || !autoFitWidthRef.current) return
      const baseWidth = page.getViewport({ scale: 1 }).width
      const availableWidth = Math.max(280, stage.clientWidth - 44)
      const nextScale = Math.min(5, Math.max(0.7, availableWidth / baseWidth))
      setScale(nextScale)
    }

    void fitCurrentPage()
    const observer = new ResizeObserver(() => {
      if (autoFitWidthRef.current) void fitCurrentPage()
    })
    observer.observe(stage)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [pdf, activePage])

  const pointFromEvent = (event: ReactMouseEvent) => {
    const frame = pageFrameRef.current
    if (!frame) return null
    const rect = frame.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    }
  }

  const updateCaptureBox = (point: { x: number; y: number }) => {
    const start = captureStartRef.current
    if (!start) return
    setCaptureBox({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    })
  }

  const handleCaptureStart = (event: ReactMouseEvent) => {
    if (!captureMode) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointFromEvent(event)
    if (!point) return
    captureStartRef.current = point
    setCaptureBox({ x: point.x, y: point.y, width: 0, height: 0 })
  }

  const handleCaptureMove = (event: ReactMouseEvent) => {
    if (!captureMode || !captureStartRef.current) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointFromEvent(event)
    if (point) updateCaptureBox(point)
  }

  const handleCaptureEnd = async (event: ReactMouseEvent) => {
    if (!captureMode || !captureStartRef.current) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointFromEvent(event)
    if (point) updateCaptureBox(point)
    const start = captureStartRef.current
    const frame = pageFrameRef.current
    const box = captureBox || (point ? { x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), width: Math.abs(point.x - start.x), height: Math.abs(point.y - start.y) } : null)
    captureStartRef.current = null
    setCaptureMode(false)
    setCaptureBox(null)
    if (!frame || !box || box.width < 12 || box.height < 12) return
    try {
      const frameRect = frame.getBoundingClientRect()
      const rendered = await html2canvas(frame, { scale: 2, useCORS: true, backgroundColor: '#ffffff', ignoreElements: (element) => element.classList.contains('figure-capture-box') })
      const ratio = rendered.width / frameRect.width
      const output = document.createElement('canvas')
      output.width = Math.max(1, Math.round(box.width * ratio))
      output.height = Math.max(1, Math.round(box.height * ratio))
      const context = output.getContext('2d')
      if (!context) return
      context.drawImage(rendered, box.x * ratio, box.y * ratio, box.width * ratio, box.height * ratio, 0, 0, output.width, output.height)
      onFigureCapture({
        dataUrl: output.toDataURL('image/png'),
        width: output.width,
        height: output.height,
        pageNumber: activePage,
        bbox: box,
        context: `Page ${activePage} area capture from ${paper?.title || 'current paper'}`,
      })
    } catch {
      setLoadError('Figure 截取失败，请重试或缩小选区。')
    }
  }

  const handleFitWidth = async () => {
    if (!pdf || !readerStageRef.current) {
      onActionMessage('演示论文使用固定版式。导入 PDF 后可使用适配宽度。')
      return
    }
    autoFitWidthRef.current = true
    const page = await pdf.getPage(activePage)
    const baseWidth = page.getViewport({ scale: 1 }).width
    const availableWidth = Math.max(280, readerStageRef.current.clientWidth - 44)
    const nextScale = Math.min(5, Math.max(0.7, availableWidth / baseWidth))
    setScale(nextScale)
    onActionMessage(`已适配阅读区宽度 · ${Math.round(nextScale * 100)}%`)
  }

  const handleSearch = () => {
    setSearchOpen((value) => !value)
    if (!searchOpen) onActionMessage('输入关键词后按 Return 搜索当前 PDF 页面。')
  }

  const submitSearch = () => {
    const query = searchQuery.trim()
    if (!query) return
    const findInPage = (window as Window & { find?: (text: string) => boolean }).find
    const found = findInPage ? findInPage(query) : false
    onActionMessage(found ? `已定位：${query}` : `当前页面未找到“${query}”。`)
  }

  return (
    <section className="reader-shell">
      <div className="reader-toolbar">
        <div className="reader-tool-group">
          <button className="reader-tool active" title="Select text" onClick={() => { window.getSelection()?.removeAllRanges(); setCaptureMode(false); onActionMessage('文本选择已启用。拖选正文即可翻译。') }}><Icon name="highlighter" size={17} /></button>
          <button className={`reader-tool ${bookmarked ? 'active' : ''}`} title={bookmarked ? 'Remove bookmark' : 'Bookmark page'} onClick={() => { setBookmarked((value) => !value); onActionMessage(bookmarked ? `已取消第 ${activePage} 页书签。` : `已标记第 ${activePage} 页。`) }}><Icon name={bookmarked ? 'bookmarkCheck' : 'bookmark'} size={17} /></button>
          <button className={`reader-tool ${captureMode ? 'active' : ''}`} title="Capture Figure area" aria-label="Figure area" onClick={() => { setCaptureMode((value) => !value); setCaptureBox(null) }}><Icon name="image" size={17} /></button>
          <button className={`reader-tool ${searchOpen ? 'active' : ''}`} title="Search in paper" onClick={handleSearch}><Icon name="search" size={17} /></button>
          {searchOpen && <input className="reader-search-input" value={searchQuery} autoFocus placeholder="Search PDF" onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitSearch() }} />}
        </div>
        <div className="reader-tool-group zoom-tools">
          <button className="reader-tool" onClick={() => { autoFitWidthRef.current = false; setScale((value) => Math.max(0.7, value - 0.1)) }} aria-label="Zoom out">−</button>
          <span>{Math.round(scale * 100)}%</span>
          <button className="reader-tool" onClick={() => { autoFitWidthRef.current = false; setScale((value) => Math.min(5, value + 0.1)) }} aria-label="Zoom in">+</button>
          <button className="reader-tool" title="Fit width" onClick={() => void handleFitWidth()}><Icon name="panelRight" size={16} /></button>
        </div>
      </div>
      <div className="reader-stage" ref={readerStageRef}>
        {loading && <div className="reader-status">Loading PDF…</div>}
        {loadError && <div className="reader-status error">{loadError}</div>}
        {(!paper?.pdfUrl && paper?.id === DEMO_PAPER_ID) && <div className="reader-page-frame" ref={pageFrameRef} onMouseDown={handleCaptureStart} onMouseMove={handleCaptureMove} onMouseUpCapture={handleCaptureEnd}><DemoPage onSelection={onSelection} />{captureBox && <div className="figure-capture-box" style={{ left: captureBox.x, top: captureBox.y, width: captureBox.width, height: captureBox.height }} />}</div>}
        {paper?.pdfUrl && pdf && <div className="reader-page-frame pdf-frame" ref={pageFrameRef} onMouseDown={handleCaptureStart} onMouseMove={handleCaptureMove} onMouseUpCapture={handleCaptureEnd}><PdfPage pdf={pdf} pageNumber={activePage} scale={scale} onSelection={onSelection} onPageCount={onDocumentLoaded} />{captureBox && <div className="figure-capture-box" style={{ left: captureBox.x, top: captureBox.y, width: captureBox.width, height: captureBox.height }} />}</div>}
        {!paper?.pdfUrl && paper?.id !== DEMO_PAPER_ID && <div className="reader-status error">当前条目没有可读取的 PDF 文件。</div>}
      </div>
      <div className="reader-footer">
        <span>Page {activePage} / {paper?.pageCount || 1}</span>
        <input type="range" min="1" max={paper?.pageCount || 1} value={activePage} onChange={(event) => onPageChange(Number(event.target.value))} />
        <div className="reader-footer-actions"><button className="footer-action" title="Reader help" onClick={() => onActionMessage('拖选英文正文可翻译；Figure 按钮可框选图区域；分隔条可调整右侧栏宽度。')}><Icon name="circleHelp" size={16} /></button><button className="footer-action" title="Fit width" onClick={() => void handleFitWidth()}><Icon name="layoutList" size={16} /></button><button className="footer-action" title="Reader settings" onClick={onOpenSettings}><Icon name="panelRight" size={16} /></button></div>
      </div>
    </section>
  )
}
