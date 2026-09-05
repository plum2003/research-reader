import type { AssetRecord, KnowledgeItem, Paper } from '../types'
import { Icon } from './Icon'

const typeIcon = {
  Vocabulary: 'type',
  Writing: 'highlighter',
  Knowledge: 'bookmark',
  Method: 'gauge',
  Data: 'layoutList',
  Figure: 'image',
  Idea: 'lightbulb',
} as const

interface KnowledgeCardProps {
  item: KnowledgeItem
  paper?: Paper
  asset?: AssetRecord
  compact?: boolean
  onOpen: (item: KnowledgeItem) => void
  onDelete?: (id: string) => void
  onPreviewAsset?: (asset: AssetRecord) => void
}

export function KnowledgeCard({ item, paper, asset, compact = false, onOpen, onDelete, onPreviewAsset }: KnowledgeCardProps) {
  return (
    <article className={`knowledge-card ${compact ? 'compact' : ''}`} onClick={() => onOpen(item)}>
      <div className={`knowledge-type-icon ${item.type.toLowerCase()}`}><Icon name={typeIcon[item.type]} size={16} /></div>
      <div className="knowledge-card-body">
        <div className="knowledge-card-title">{item.title}</div>
        {asset && <button className="knowledge-thumb-button" onClick={(event) => { event.stopPropagation(); onPreviewAsset?.(asset) }} aria-label="Preview saved figure" type="button"><img className="knowledge-thumb" src={asset.dataUrl} alt="Saved figure" /></button>}
        {!compact && <p className="knowledge-card-excerpt">{item.userNote || item.sourceText}</p>}
        <div className="knowledge-card-meta">
          {item.tags.slice(0, 2).map((tag) => <span key={tag} className="tag-chip">{tag}</span>)}
          <span className="page-label">{paper?.journal || 'Paper'} · p.{item.pageNumber}</span>
        </div>
      </div>
      {onDelete && <button className="delete-card" onClick={(event) => { event.stopPropagation(); onDelete(item.id) }} aria-label="Delete item" title="Delete item"><Icon name="trash" size={15} /></button>}
    </article>
  )
}
