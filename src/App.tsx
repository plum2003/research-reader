import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { DEMO_PAPER_ID, demoPaper, defaultSettings, seedState } from './data'
import { buildExplainPrompt } from './features/ai/prompt-builder'
import { exportAnki, exportArchive, exportBackup, exportBibtex, exportCsv, exportJson, exportMarkdown, exportRis, exportXlsx } from './features/export/exporters'
import { providers, translateWithChunks, translationCacheKey } from './features/translation/translator'
import { deletePdfFile, loadPdfUrl, saveBackupSnapshot, savePdfFile, sha256 } from './shared/file-store'
import { copyText, openExternal, requestOpenPdf } from './shared/native-bridge'
import type { AppSettings, AssetRecord, FigureCapture, KnowledgeItem, KnowledgeType, Paper, PersistedState, SelectionContext, ViewMode } from './types'
import { FloatingToolbar } from './components/FloatingToolbar'
import { Icon } from './components/Icon'
import { KnowledgeView } from './components/KnowledgeView'
import { PdfReader } from './components/PdfReader'
import { RightPanel } from './components/RightPanel'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar } from './components/Sidebar'
import { TimelineView } from './components/TimelineView'
import { Topbar } from './components/Topbar'

const STORAGE_KEY = 'research-reader-state-v0.1'
const TRANSLATION_MIGRATION_KEY = 'research-reader-translation-online-v3'
const SAMPLE_DATA_MIGRATION_KEY = 'research-reader-sample-data-removed-v1'
const SAMPLE_COLLECTIONS = ['Kidney Aging', 'Single-cell', 'Fibrosis', 'AKI', 'Metabolism', 'Immunology', 'Methods', 'Journal Club']
const SAMPLE_TAGS = ['scRNA-seq', 'Aging', 'Kidney', 'Nephron', 'Senescence', 'Inflammation', 'Trajectory']

function loadState(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedState
    const parsed = JSON.parse(raw) as PersistedState
    const settings = { ...defaultSettings, ...parsed.settings }
    let state: PersistedState = {
      ...seedState,
      ...parsed,
      papers: Array.isArray(parsed.papers) ? parsed.papers : [],
      knowledgeItems: Array.isArray(parsed.knowledgeItems) ? parsed.knowledgeItems : [],
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      notes: parsed.notes || {},
      collections: parsed.collections || [],
      tags: parsed.tags || [],
      settings,
    }

    // Remove only the known built-in sample records once. User-imported
    // papers, notes and Knowledge items remain untouched.
    if (!window.localStorage.getItem(SAMPLE_DATA_MIGRATION_KEY)) {
      state = {
        ...state,
        papers: state.papers.filter((paper) => paper.id !== DEMO_PAPER_ID),
        knowledgeItems: state.knowledgeItems.filter((item) => item.paperId !== DEMO_PAPER_ID),
        assets: state.assets.filter((asset) => asset.paperId !== DEMO_PAPER_ID),
        notes: Object.fromEntries(Object.entries(state.notes).filter(([key]) => !key.startsWith(DEMO_PAPER_ID))),
        collections: (state.collections || []).filter((name) => !SAMPLE_COLLECTIONS.includes(name)),
        tags: (state.tags || []).filter((name) => !SAMPLE_TAGS.includes(name)),
      }
      window.localStorage.setItem(SAMPLE_DATA_MIGRATION_KEY, '1')
    }

    if (!window.localStorage.getItem(TRANSLATION_MIGRATION_KEY)) {
      if (settings.preferredProvider === 'local-demo' || settings.preferredProvider === 'baidu') settings.preferredProvider = 'mymemory'
      // This app's selection flow is English -> Simplified Chinese. Older
      // builds could persist English as the target and make a translation
      // appear unchanged.
      settings.targetLanguage = 'zh-CN'
      window.localStorage.setItem(TRANSLATION_MIGRATION_KEY, '1')
    }
    return state
  } catch {
    return seedState
  }
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeSelection(text: string) {
  return text.replace(/-\s*\n\s*/g, '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

interface NativePdfPayload {
  name: string
  base64: string
}

function fileFromBase64(payload: NativePdfPayload) {
  const binary = window.atob(payload.base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new File([bytes], payload.name, { type: 'application/pdf' })
}

function App() {
  const initial = useMemo(loadState, [])
  const [papers, setPapers] = useState<Paper[]>(initial.papers)
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>(initial.knowledgeItems)
  const [assets, setAssets] = useState<AssetRecord[]>(initial.assets || [])
  const [notes, setNotes] = useState<Record<string, string>>(initial.notes)
  const [settings, setSettings] = useState<AppSettings>(initial.settings)
  const [collections, setCollections] = useState<string[]>(initial.collections || [])
  const [tags, setTags] = useState<string[]>(initial.tags || [])
  const [currentPaperId, setCurrentPaperId] = useState(initial.papers[0]?.id || '')
  const [viewMode, setViewMode] = useState<ViewMode>('reader')
  const [rightPanelWidth, setRightPanelWidth] = useState(() => Number(window.localStorage.getItem('research-reader-right-panel-width')) || 340)
  const [rightPanelVisible, setRightPanelVisible] = useState(true)
  const [addDialog, setAddDialog] = useState<'collection' | 'tag' | null>(null)
  const [addDialogValue, setAddDialogValue] = useState('')
  const [pageNumber, setPageNumber] = useState(7)
  const [search, setSearch] = useState('')
  const [sidebarFilter, setSidebarFilter] = useState('')
  const [selection, setSelection] = useState<SelectionContext | null>(null)
  const [translatedText, setTranslatedText] = useState('')
  const [translationProvider, setTranslationProvider] = useState('')
  const [translationLoading, setTranslationLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingFigure, setPendingFigure] = useState<FigureCapture | null>(null)
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mainAreaRef = useRef<HTMLElement>(null)
  const resizeCleanupRef = useRef<(() => void) | null>(null)

  const currentPaper = papers.find((paper) => paper.id === currentPaperId) || papers[0]
  const noteKey = currentPaper
    ? selection?.paperId === currentPaper.id
      ? `${currentPaper.id}::selection::${selection.pageNumber}::${selection.text.slice(0, 80)}`
      : currentPaper.id
    : ''
  const currentNote = noteKey ? notes[noteKey] || '' : ''
  const previewAsset = previewAssetId ? assets.find((asset) => asset.id === previewAssetId) : undefined
  const previewItem = previewAsset ? knowledgeItems.find((item) => item.assetId === previewAsset.id) : undefined
  const previewPaper = previewAsset ? papers.find((paper) => paper.id === previewAsset.paperId) : undefined

  useEffect(() => {
    const persistedPapers = papers.map(({ pdfUrl: _pdfUrl, ...paper }) => paper)
    const payload: PersistedState = { papers: persistedPapers, knowledgeItems, assets, notes, settings, collections, tags }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [papers, knowledgeItems, assets, notes, settings, collections, tags])

  useEffect(() => {
    window.localStorage.setItem('research-reader-right-panel-width', String(rightPanelWidth))
  }, [rightPanelWidth])

  useEffect(() => () => resizeCleanupRef.current?.(), [])

  useEffect(() => {
    let active = true
    void Promise.all(initial.papers.map(async (paper) => {
      if (!paper.fileKey || paper.pdfUrl) return paper
      const pdfUrl = await loadPdfUrl(paper.fileKey)
      return pdfUrl ? { ...paper, pdfUrl } : paper
    })).then((restored) => {
      if (active) setPapers(restored)
    })
    return () => { active = false }
  }, [initial])

  useEffect(() => {
    if (!settings.autoBackup) return
    const lastBackup = window.localStorage.getItem('research-reader-last-auto-backup')
    const stale = !lastBackup || Date.now() - Number(lastBackup) > 24 * 60 * 60 * 1000
    if (!stale) return
    const payload: PersistedState = { papers: initial.papers, knowledgeItems: initial.knowledgeItems, assets: initial.assets || [], notes: initial.notes, settings, collections, tags }
    void saveBackupSnapshot('automatic', { ...payload, backup_created_at: new Date().toISOString() })
    window.localStorage.setItem('research-reader-last-auto-backup', String(Date.now()))
  }, [initial, settings, collections, tags])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      document.querySelector<HTMLInputElement>('.search-box input')?.focus()
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const showToast = (message: string) => setToast(message)

  const handleImportedFile = async (file: File) => {
    const url = URL.createObjectURL(file)
    const id = makeId('paper')
    await savePdfFile(id, file).catch(() => undefined)
    const newPaper: Paper = { id, title: file.name.replace(/\.pdf$/i, ''), authors: [], journal: 'Imported PDF', year: new Date().getFullYear(), doi: '', url: '', fileName: file.name, fileKey: id, pageCount: 1, pdfUrl: url, importedAt: new Date().toISOString() }
    setPapers((items) => [newPaper, ...items])
    setCurrentPaperId(id)
    setPageNumber(1)
    setViewMode('reader')
    showToast(`已导入 ${file.name}`)
  }

  useEffect(() => {
    const handleNativeFile = (event: Event) => {
      const payload = (event as CustomEvent<NativePdfPayload>).detail
      if (!payload?.name || !payload.base64) return
      void handleImportedFile(fileFromBase64(payload))
    }
    window.addEventListener('research-reader-native-file', handleNativeFile)
    return () => window.removeEventListener('research-reader-native-file', handleNativeFile)
  }, [])

  const handleDocumentLoaded = useCallback((count: number) => {
    setPapers((items) => items.map((paper) => paper.id === currentPaperId ? { ...paper, pageCount: count } : paper))
  }, [currentPaperId])

  const handleSelection = (next: SelectionContext | null) => {
    if (!next) return
    const safeText = normalizeSelection(next.text)
    if (!safeText) return
    setSelection({ ...next, paperId: currentPaper?.id || next.paperId, text: safeText })
    setTranslatedText('')
    setTranslationProvider('')
  }

  const handleTranslate = async () => {
    if (!selection) return
    if (selection.text.length > settings.maxTranslationChars) {
      showToast(`选区超过 ${settings.maxTranslationChars} 字符，请缩短后再翻译。`)
      return
    }
    const providerKey = settings.preferredProvider === 'baidu' ? 'mymemory' : settings.preferredProvider
    if (settings.preferredProvider === 'baidu') {
      setSettings((current) => ({ ...current, preferredProvider: 'mymemory' }))
      showToast('Baidu 未配置安全密钥，已切换到 MyMemory 在线翻译。')
    }
    const provider = providers[providerKey]
    const cacheKey = translationCacheKey(selection.text, 'en', settings.targetLanguage, provider.id)
    const cached = window.localStorage.getItem(`research-reader-translation:${cacheKey}`)
    if (cached) {
      const result = JSON.parse(cached) as { text: string; provider: string }
      setTranslatedText(result.text)
      setTranslationProvider(`${result.provider} · cached`)
      return
    }
    setTranslationLoading(true)
    try {
      const result = await translateWithChunks(provider, {
        text: selection.text,
        sourceLang: 'en',
        targetLang: settings.targetLanguage,
      })
      setTranslatedText(result.text)
      setTranslationProvider(`${result.provider} · ${result.latencyMs} ms`)
      window.localStorage.setItem(`research-reader-translation:${cacheKey}`, JSON.stringify(result))
    } catch (error) {
      showToast(error instanceof Error ? error.message : '翻译失败，请稍后重试。')
    } finally {
      setTranslationLoading(false)
    }
  }

  const saveKnowledge = (type: KnowledgeType = 'Knowledge') => {
    if (type === 'Figure' && pendingFigure) {
      void saveFigure()
      return
    }
    if (!selection || !currentPaper) {
      showToast('请先在正文中选择一段文字。')
      return
    }
    const shortTitle = selection.text.length > 72 ? `${selection.text.slice(0, 72)}…` : selection.text
    const titleByType: Record<KnowledgeType, string> = {
      Vocabulary: `Word: ${selection.text.split(/\s+/)[0]}`,
      Writing: shortTitle,
      Knowledge: shortTitle,
      Method: `Method note · ${shortTitle}`,
      Data: `Data note · ${shortTitle}`,
      Figure: `Figure note · ${shortTitle}`,
      Idea: `Idea · ${shortTitle}`,
    }
    const now = new Date().toISOString()
    const item: KnowledgeItem = {
      id: makeId('kn'),
      paperId: currentPaper.id,
      type,
      title: titleByType[type],
      sourceText: selection.text,
      translatedText,
      userNote: type === 'Idea' ? '在这里补充你的想法…' : '',
      pageNumber: selection.pageNumber,
      pageLabel: `Page ${selection.pageNumber}`,
      tags: [currentPaper.journal, type],
      metadata: type === 'Vocabulary' ? { lemma: selection.text.split(/\s+/)[0], mastered: false } : {},
      createdAt: now,
      updatedAt: now,
      favorite: false,
    }
    setKnowledgeItems((items) => [item, ...items])
    showToast(`已保存为 ${type}`)
  }

  const saveFigure = async () => {
    if (!pendingFigure || !currentPaper) {
      showToast('请先截取 Figure 区域。')
      return
    }
    const now = new Date().toISOString()
    const assetId = makeId('asset')
    const asset: AssetRecord = {
      id: assetId,
      relativePath: `figures/${currentPaper.id}/${assetId}.png`,
      mimeType: 'image/png',
      dataUrl: pendingFigure.dataUrl,
      sha256: await sha256(pendingFigure.dataUrl),
      paperId: currentPaper.id,
      pageNumber: pendingFigure.pageNumber,
      figureLabel: pendingFigure.caption || `Figure area · Page ${pendingFigure.pageNumber}`,
      width: pendingFigure.width,
      height: pendingFigure.height,
      createdAt: now,
    }
    const item: KnowledgeItem = {
      id: makeId('kn'),
      paperId: currentPaper.id,
      type: 'Figure',
      title: asset.figureLabel,
      sourceText: pendingFigure.context,
      translatedText: '',
      userNote: '',
      pageNumber: pendingFigure.pageNumber,
      pageLabel: `Page ${pendingFigure.pageNumber}`,
      tags: [currentPaper.journal, 'Figure'],
      metadata: { figure_label: asset.figureLabel, bbox: JSON.stringify(pendingFigure.bbox) },
      assetId,
      createdAt: now,
      updatedAt: now,
      favorite: false,
    }
    setAssets((items) => [asset, ...items])
    setKnowledgeItems((items) => [item, ...items])
    setPendingFigure(null)
    showToast('Figure 已保存到 Knowledge')
  }

  const handleFigureCapture = (capture: FigureCapture) => {
    setPendingFigure(capture)
    showToast('Figure 区域已截取，可在右侧预览并保存。')
  }

  const handleExplain = () => {
    if (!selection || !currentPaper) return
    const prompt = buildExplainPrompt(currentPaper, selection, translatedText)
    // Open first while the click is still a user gesture; the native bridge
    // sends the URL to the user's default browser on macOS.
    openExternal('https://chatgpt.com')
    void copyText(prompt).then((copied) => showToast(copied ? 'Prompt 已复制，已打开 ChatGPT' : '已打开 ChatGPT，但复制 Prompt 失败。'))
  }

  const handleOpenItem = (item: KnowledgeItem) => {
    setCurrentPaperId(item.paperId)
    setPageNumber(item.pageNumber)
    setSearch('')
    setSidebarFilter('')
    setViewMode('reader')
    showToast(`已回到 ${item.pageLabel}`)
  }

  const handleDeleteItem = (id: string) => {
    const item = knowledgeItems.find((candidate) => candidate.id === id)
    setKnowledgeItems((items) => items.filter((item) => item.id !== id))
    if (item?.assetId) setAssets((items) => items.filter((asset) => asset.id !== item.assetId))
    if (item?.assetId && item.assetId === previewAssetId) setPreviewAssetId(null)
    showToast('条目已删除')
  }

  const handleUpdateKnowledgeNote = (id: string, value: string) => {
    setKnowledgeItems((items) => items.map((item) => item.id === id ? { ...item, userNote: value, updatedAt: new Date().toISOString() } : item))
  }

  const handleDeletePaper = (paperId: string) => {
    const paper = papers.find((candidate) => candidate.id === paperId)
    if (!paper) return
    const remaining = papers.filter((candidate) => candidate.id !== paperId)
    if (paper.fileKey) void deletePdfFile(paper.fileKey)
    if (paper.pdfUrl) URL.revokeObjectURL(paper.pdfUrl)
    setPapers(remaining)
    setKnowledgeItems((items) => items.filter((item) => item.paperId !== paperId))
    setAssets((items) => items.filter((asset) => asset.paperId !== paperId))
    setNotes((items) => Object.fromEntries(Object.entries(items).filter(([key]) => key !== paperId && !key.startsWith(`${paperId}::`))))
    if (previewAsset?.paperId === paperId) setPreviewAssetId(null)
    if (currentPaperId === paperId) {
      setCurrentPaperId(remaining[0]?.id || '')
      setPageNumber(1)
      setSelection(null)
    }
    showToast(`已删除 ${paper.title}`)
  }

  const handleImport = () => {
    if (requestOpenPdf()) return
    fileInputRef.current?.click()
  }

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void handleImportedFile(file)
    event.target.value = ''
  }

  const updateNote = (value: string) => {
    if (!noteKey) return
    setNotes((items) => ({ ...items, [noteKey]: value }))
  }

  const selectPaper = (paperId: string) => {
    setCurrentPaperId(paperId)
    setPageNumber(papers.find((paper) => paper.id === paperId)?.id === demoPaper.id ? 7 : 1)
    setSelection(null)
    setTranslatedText('')
    setTranslationProvider('')
    setSearch('')
    setSidebarFilter('')
    setViewMode('reader')
  }

  const handleSettingsChange = (next: AppSettings) => setSettings(next)

  const handleSidebarFilter = (value: string) => {
    setSearch('')
    setSidebarFilter(value)
    setViewMode('knowledge')
    showToast(`已按 ${value} 筛选 Knowledge`)
  }

  const handleAddDialogSubmit = () => {
    const value = addDialogValue.trim()
    if (!addDialog || !value) return
    if (addDialog === 'collection') {
      setCollections((items) => items.includes(value) ? items : [...items, value])
      showToast(`已添加 Collection：${value}`)
    } else {
      setTags((items) => items.includes(value) ? items : [...items, value])
      showToast(`已添加 Tag：${value}`)
    }
    setAddDialog(null)
    setAddDialogValue('')
  }

  const handlePanelResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const mainArea = mainAreaRef.current
    if (!mainArea) return
    const updateWidth = (clientX: number) => {
      const bounds = mainArea.getBoundingClientRect()
      const nextWidth = Math.round(Math.min(520, Math.max(280, bounds.right - clientX)))
      setRightPanelWidth(nextWidth)
    }
    const handleMove = (moveEvent: PointerEvent) => updateWidth(moveEvent.clientX)
    const handleUp = () => {
      document.body.classList.remove('is-resizing-panel')
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      resizeCleanupRef.current = null
    }
    resizeCleanupRef.current?.()
    resizeCleanupRef.current = handleUp
    document.body.classList.add('is-resizing-panel')
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const resetPanelWidth = () => setRightPanelWidth(340)
  const adjustPanelWidth = (delta: number) => setRightPanelWidth((value) => Math.min(520, Math.max(280, value + delta)))
  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    setSearch('')
    setSidebarFilter('')
  }

  return (
    <div className="app-shell">
      <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={handleFile} />
      <Sidebar papers={papers} currentPaperId={currentPaperId} viewMode={viewMode} collections={collections} tags={tags} knowledgeItems={knowledgeItems} onViewModeChange={changeViewMode} onSelectPaper={selectPaper} onDeletePaper={handleDeletePaper} onImport={handleImport} onAddCollection={() => { setAddDialog('collection'); setAddDialogValue('') }} onAddTag={() => { setAddDialog('tag'); setAddDialogValue('') }} onFilter={handleSidebarFilter} />
      <main className="main-area" ref={mainAreaRef}>
        <Topbar paper={currentPaper} search={search} pageNumber={pageNumber} onSearch={(value) => { setSearch(value); setSidebarFilter(''); if (value) setViewMode('knowledge') }} onImport={handleImport} onPageChange={setPageNumber} onSettings={() => setSettingsOpen(true)} onTogglePanel={() => setRightPanelVisible((value) => !value)} rightPanelVisible={rightPanelVisible} />
        {viewMode === 'reader' && <div className={`workspace-grid ${rightPanelVisible ? '' : 'panel-collapsed'}`} style={{ '--right-panel-width': `${rightPanelWidth}px` } as CSSProperties}>
          {currentPaper ? <PdfReader paper={currentPaper} pageNumber={pageNumber} onPageChange={setPageNumber} onSelection={handleSelection} onDocumentLoaded={handleDocumentLoaded} onFigureCapture={handleFigureCapture} onActionMessage={showToast} onOpenSettings={() => setSettingsOpen(true)} /> : <section className="empty-reader-view"><Icon name="fileText" size={32} /><h2>还没有导入论文</h2><p>从文件夹选择一个 PDF，它会保存到本机并立即打开。</p><button className="topbar-button primary" onClick={handleImport}><Icon name="import" size={16} /> 选择 PDF</button></section>}
          {rightPanelVisible && <div className="workspace-resizer" role="separator" tabIndex={0} aria-label="Resize PDF and inspector panels" onPointerDown={handlePanelResizeStart} onDoubleClick={resetPanelWidth} onKeyDown={(event) => { if (event.key === 'ArrowLeft') adjustPanelWidth(20); if (event.key === 'ArrowRight') adjustPanelWidth(-20) }} />}
          {rightPanelVisible && <RightPanel paper={currentPaper} selection={selection} translatedText={translationLoading ? 'Translating…' : translatedText} translationProvider={translationProvider} knowledgeItems={knowledgeItems} assets={assets} pendingFigure={pendingFigure} note={currentNote} onNoteChange={updateNote} onTranslate={handleTranslate} onExplain={handleExplain} onSaveKnowledge={() => saveKnowledge('Knowledge')} onSaveFigure={saveFigure} onCopyFigurePrompt={() => { if (!pendingFigure || !currentPaper) return; const prompt = `Analyze this captured figure region from “${currentPaper.title}”, page ${pendingFigure.pageNumber}. Context: ${pendingFigure.context}`; void copyText(prompt).then((copied) => showToast(copied ? 'Figure prompt 已复制' : 'Figure prompt 复制失败')) }} onOpenItem={handleOpenItem} onDeleteItem={handleDeleteItem} onPreviewAsset={(asset) => setPreviewAssetId(asset.id)} onUpdateKnowledgeNote={handleUpdateKnowledgeNote} onKnowledgeView={() => changeViewMode('knowledge')} />}
        </div>}
        {viewMode === 'knowledge' && <KnowledgeView items={knowledgeItems} assets={assets} papers={papers} search={search} sidebarFilter={sidebarFilter} onOpen={handleOpenItem} onDelete={handleDeleteItem} onSearch={(value) => { setSearch(value); setSidebarFilter('') }} onClearSidebarFilter={() => setSidebarFilter('')} onPreviewAsset={(asset) => setPreviewAssetId(asset.id)} onExport={() => void exportArchive({ papers, knowledgeItems, assets, notes, settings }).then(() => showToast('ZIP 归档已生成')).catch(() => showToast('ZIP 导出失败，请重试'))} />}
        {viewMode === 'timeline' && <TimelineView items={knowledgeItems} papers={papers} onOpen={handleOpenItem} />}
      </main>
      {selection && viewMode === 'reader' && <FloatingToolbar selection={selection} onTranslate={handleTranslate} onExplain={handleExplain} onSave={saveKnowledge} onDismiss={() => setSelection(null)} />}
      {toast && <div className="toast"><Icon name="check" size={16} /> {toast}</div>}
      {addDialog && <div className="modal-backdrop" onMouseDown={() => setAddDialog(null)}><form className="quick-add-modal" onSubmit={(event) => { event.preventDefault(); handleAddDialogSubmit() }} onMouseDown={(event) => event.stopPropagation()}><div className="settings-head"><div><span className="panel-eyebrow">LOCAL LIBRARY</span><h2>Add {addDialog === 'collection' ? 'collection' : 'tag'}</h2></div><button type="button" className="icon-button" onClick={() => setAddDialog(null)} aria-label="Close"><Icon name="x" size={18} /></button></div><div className="quick-add-body"><label><span>Name</span><input autoFocus value={addDialogValue} onChange={(event) => setAddDialogValue(event.target.value)} placeholder={addDialog === 'collection' ? 'e.g. Retina vascular biology' : 'e.g. OIR'} /></label><div className="quick-add-actions"><button type="button" className="outline-button" onClick={() => setAddDialog(null)}>Cancel</button><button type="submit" className="topbar-button primary" disabled={!addDialogValue.trim()}>Add</button></div></div></form></div>}
      {previewAsset && <div className="modal-backdrop asset-preview-backdrop" onMouseDown={() => setPreviewAssetId(null)}><div className="asset-preview-modal" onMouseDown={(event) => event.stopPropagation()}><div className="settings-head"><div><span className="panel-eyebrow">SAVED FIGURE</span><h2>{previewAsset.figureLabel}</h2></div><button className="icon-button" onClick={() => setPreviewAssetId(null)} aria-label="Close preview"><Icon name="x" size={18} /></button></div><div className="asset-preview-body"><img className="asset-preview-image" src={previewAsset.dataUrl} alt={previewAsset.figureLabel} /><div className="asset-preview-meta"><span>{previewPaper?.title || 'Paper'} · Page {previewAsset.pageNumber}</span><span>本机 Knowledge · {previewAsset.relativePath}</span><span>{previewAsset.width} × {previewAsset.height} px</span></div><div className="asset-preview-actions"><a className="outline-button" href={previewAsset.dataUrl} download={`${previewAsset.figureLabel.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'figure'}.png`}><Icon name="download" size={15} /> 下载 PNG</a>{previewItem && <button className="outline-button" onClick={() => handleDeleteItem(previewItem.id)}><Icon name="trash" size={15} /> 删除</button>}</div>{previewItem && <label className="asset-note-field"><span>图片备注</span><textarea value={previewItem.userNote} onChange={(event) => handleUpdateKnowledgeNote(previewItem.id, event.target.value)} placeholder="为这张图添加实验逻辑、关键结果或后续问题…" /></label>}</div></div></div>}
      {settingsOpen && <SettingsModal settings={settings} onSettingsChange={handleSettingsChange} onClose={() => setSettingsOpen(false)} onExportJson={() => exportJson({ papers, knowledgeItems, assets, notes, settings })} onExportMarkdown={() => exportMarkdown({ papers, knowledgeItems, assets, notes, settings })} onExportCsv={() => exportCsv({ papers, knowledgeItems, assets, notes, settings })} onExportBibtex={() => exportBibtex({ papers, knowledgeItems, assets, notes, settings })} onExportRis={() => exportRis({ papers, knowledgeItems, assets, notes, settings })} onExportAnki={() => exportAnki({ papers, knowledgeItems, assets, notes, settings })} onExportXlsx={() => exportXlsx({ papers, knowledgeItems, assets, notes, settings })} onExportArchive={() => void exportArchive({ papers, knowledgeItems, assets, notes, settings }).then(() => showToast('ZIP 归档已生成')).catch(() => showToast('ZIP 导出失败，请重试'))} onExportBackup={() => exportBackup({ papers, knowledgeItems, assets, notes, settings })} />}
    </div>
  )
}

export default App
