import { useEffect, useMemo, useState } from 'react'
import type { AssetRecord, FigureCapture, KnowledgeItem, Paper, SelectionContext } from '../types'
import { buildExplainPrompt } from '../features/ai/prompt-builder'
import { copyText, openExternal } from '../shared/native-bridge'
import { Icon } from './Icon'
import { KnowledgeCard } from './KnowledgeCard'

type PanelTab = 'AI' | 'Notes' | 'Knowledge'

interface RightPanelProps {
  paper?: Paper
  selection: SelectionContext | null
  translatedText: string
  translationProvider: string
  knowledgeItems: KnowledgeItem[]
  assets: AssetRecord[]
  pendingFigure: FigureCapture | null
  note: string
  onNoteChange: (value: string) => void
  onTranslate: () => void
  onExplain: () => void
  onSaveKnowledge: () => void
  onSaveFigure: () => void
  onCopyFigurePrompt: () => void
  onOpenItem: (item: KnowledgeItem) => void
  onDeleteItem: (id: string) => void
  onPreviewAsset: (asset: AssetRecord) => void
  onUpdateKnowledgeNote: (id: string, value: string) => void
  onKnowledgeView: () => void
}

export function RightPanel({ paper, selection, translatedText, translationProvider, knowledgeItems, assets, pendingFigure, note, onNoteChange, onTranslate, onExplain: _onExplain, onSaveKnowledge, onSaveFigure, onCopyFigurePrompt, onOpenItem, onDeleteItem, onPreviewAsset, onUpdateKnowledgeNote, onKnowledgeView }: RightPanelProps) {
  const [tab, setTab] = useState<PanelTab>('AI')
  const [copied, setCopied] = useState(false)
  const [prompt, setPrompt] = useState('')
  const currentItems = useMemo(() => knowledgeItems.filter((item) => item.paperId === paper?.id).slice(0, 4), [knowledgeItems, paper?.id])

  useEffect(() => {
    if (!selection || !paper) return
    setPrompt(buildExplainPrompt(paper, selection, translatedText))
  }, [paper, selection, translatedText])

  const copyPrompt = async () => {
    if (!prompt) return
    await copyText(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const useChatGPT = () => {
    // Keep this synchronous so popup blockers and the native macOS bridge see
    // the original button click as the user gesture.
    openExternal('https://chatgpt.com')
    void copyPrompt()
  }

  return (
    <aside className="right-panel">
      <div className="panel-tabs" role="tablist">
        {(['AI', 'Notes', 'Knowledge'] as PanelTab[]).map((name) => <button key={name} className={`panel-tab ${tab === name ? 'active' : ''}`} onClick={() => setTab(name)} role="tab">{name}</button>)}
      </div>

      {tab === 'AI' && <div className="panel-content ai-panel">
        <div className="panel-section-head"><div><span className="panel-eyebrow">TRANSLATION</span><h2>{selection ? 'Selected text' : 'Ready to translate'}</h2></div><button className="text-link" onClick={useChatGPT}><Icon name="message" size={14} /> Use ChatGPT</button></div>
        {pendingFigure && <div className="figure-capture-panel"><div className="figure-capture-preview"><img src={pendingFigure.dataUrl} alt="Captured figure area" /><div><span className="panel-eyebrow">FIGURE CAPTURE</span><strong>Page {pendingFigure.pageNumber}</strong><span className="figure-save-destination">保存后进入本机 Knowledge，可完整预览、备注或下载。</span></div></div><div className="figure-capture-actions"><button className="outline-button" onClick={() => { onSaveFigure(); setTab('Knowledge') }}><Icon name="bookmark" size={14} /> Save Figure</button><button className="outline-button" onClick={onCopyFigurePrompt}><Icon name="copy" size={14} /> Copy prompt</button></div></div>}
        {!selection && !pendingFigure && <div className="empty-ai"><Icon name="languages" size={26} /><p>Select a sentence in the paper to translate or explain it.</p><span>The selection menu keeps your source page and context attached.</span></div>}
        {selection && <>
          <div className="selected-quote">“{selection.text}”<span>Page {selection.pageNumber}</span></div>
          <div className="translation-box">
            <div className="translation-head"><span>English</span><Icon name="arrowRight" size={14} /><span>简体中文</span></div>
            <p>{translatedText || '点击 Translate 获取译文'}</p>
            {translatedText && <small>{translationProvider}</small>}
          </div>
          <div className="ai-actions"><button className="outline-button" onClick={onTranslate}><Icon name="languages" size={15} /> {translatedText ? '重新翻译' : 'Translate'}</button><button className="outline-button" onClick={onSaveKnowledge}><Icon name="bookmark" size={15} /> Save as Knowledge</button></div>
          <div className="prompt-preview"><div className="prompt-preview-head"><span>Prompt preview</span><button className="icon-button subtle" onClick={copyPrompt} aria-label="Copy prompt">{copied ? <Icon name="check" size={15} /> : <Icon name="copy" size={15} />}</button></div><pre>{prompt || '等待选择文本…'}</pre><button className="chatgpt-button" onClick={useChatGPT}><Icon name="externalLink" size={15} /> Copy prompt and open ChatGPT</button></div>
        </>}
      </div>}

      {tab === 'Notes' && <div className="panel-content notes-panel">
        <div className="panel-section-head"><div><span className="panel-eyebrow">READING NOTES</span><h2>{selection ? 'Selected text' : paper?.journal || 'Current paper'}</h2></div><Icon name="save" size={16} className="muted-icon" /></div>
        {selection && <div className="selected-note-context">“{selection.text}”<span>Page {selection.pageNumber} · 这条备注会和选中文本一起保存</span></div>}
        <textarea className="notes-editor" value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder={selection ? '为这段选中文本添加备注…' : '记录这篇论文的关键疑问、实验逻辑或下一步…'} />
        <div className="notes-hint"><Icon name="check" size={14} /> 自动保存到本机</div>
      </div>}

      {tab === 'Knowledge' && <div className="panel-content knowledge-panel">
        <div className="panel-section-head"><div><span className="panel-eyebrow">SAVED FROM THIS PAPER</span><h2>Knowledge</h2></div><button className="text-link" onClick={onKnowledgeView}>See all <Icon name="arrowRight" size={14} /></button></div>
        <div className="knowledge-stack">{currentItems.length ? currentItems.map((item) => <KnowledgeCard key={item.id} item={item} paper={paper} asset={assets.find((asset) => asset.id === item.assetId)} compact onOpen={onOpenItem} onDelete={onDeleteItem} onPreviewAsset={onPreviewAsset} />) : <div className="empty-ai"><Icon name="bookmark" size={24} /><p>No saved items yet.</p></div>}</div>
        <button className="open-pdf-button" onClick={() => onOpenItem(currentItems[0])} disabled={!currentItems.length}><Icon name="bookOpen" size={15} /> Open in PDF</button>
      </div>}
    </aside>
  )
}
