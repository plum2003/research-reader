import type { KnowledgeItem, Paper, ViewMode } from '../types'
import { Icon } from './Icon'

interface SidebarProps {
  papers: Paper[]
  currentPaperId: string
  viewMode: ViewMode
  collections: string[]
  tags: string[]
  knowledgeItems: KnowledgeItem[]
  onViewModeChange: (mode: ViewMode) => void
  onSelectPaper: (paperId: string) => void
  onDeletePaper: (paperId: string) => void
  onImport: () => void
  onAddCollection: () => void
  onAddTag: () => void
  onFilter: (value: string) => void
}

export function Sidebar({ papers, currentPaperId, viewMode, collections, tags, knowledgeItems, onViewModeChange, onSelectPaper, onDeletePaper, onImport, onAddCollection, onAddTag, onFilter }: SidebarProps) {
  const countFor = (name: string) => knowledgeItems.filter((item) => item.tags.includes(name)).length

  return (
    <aside className="sidebar">
      <div className="window-controls" aria-hidden="true">
        <span className="traffic-light red" />
        <span className="traffic-light yellow" />
        <span className="traffic-light green" />
        <span className="sidebar-brand">Research Reader</span>
      </div>

      <div className="sidebar-divider" />

      <nav className="sidebar-nav" aria-label="Primary navigation">
        <button className={`nav-section-title ${viewMode === 'reader' ? 'active' : ''}`} onClick={() => onViewModeChange('reader')}>
          <Icon name="bookOpen" size={16} />
          <span>Library</span>
          <Icon name="chevronDown" size={15} className="nav-chevron" />
        </button>
        <button className={`nav-item ${viewMode === 'reader' ? 'selected' : ''}`} onClick={() => { onViewModeChange('reader'); if (papers[0]) onSelectPaper(papers[0].id) }}>
          <Icon name="fileText" size={16} />
          <span>Papers</span>
          <span className="nav-count">{papers.length}</span>
        </button>
        <button className="nav-item" onClick={() => collections[0] ? onFilter(collections[0]) : onViewModeChange('knowledge')}>
          <Icon name="folder" size={16} />
          <span>Collections</span>
        </button>
        <button className="nav-item" onClick={() => tags[0] ? onFilter(tags[0]) : onViewModeChange('knowledge')}>
          <Icon name="tag" size={16} />
          <span>Tags</span>
        </button>
        <button className={`nav-item ${viewMode === 'knowledge' ? 'selected' : ''}`} onClick={() => onViewModeChange('knowledge')}>
          <Icon name="bookmark" size={16} />
          <span>Knowledge</span>
        </button>
        <button className={`nav-item ${viewMode === 'timeline' ? 'selected' : ''}`} onClick={() => onViewModeChange('timeline')}>
          <Icon name="clock" size={16} />
          <span>Reading log</span>
        </button>
      </nav>

      <div className="sidebar-divider" />

      <div className="paper-list" aria-label="Imported papers">
        {papers.length ? papers.map((paper) => <div className={`paper-item-row ${paper.id === currentPaperId ? 'selected' : ''}`} key={paper.id}>
          <button className="paper-item" onClick={() => onSelectPaper(paper.id)} title={paper.title}>
            <Icon name="fileText" size={14} />
            <span>{paper.title}</span>
          </button>
          <button className="paper-delete" onClick={() => onDeletePaper(paper.id)} aria-label={`Delete ${paper.title}`} title="Delete PDF"><Icon name="trash" size={13} /></button>
        </div>) : <div className="sidebar-empty">No PDFs yet</div>}
      </div>

      <div className="sidebar-group-header">
        <span>COLLECTIONS</span>
        <button className="icon-button subtle" onClick={onAddCollection} aria-label="Add collection"><Icon name="plus" size={15} /></button>
      </div>
      <div className="collection-list">
        {collections.map((collection, index) => (
          <button className="collection-item" key={collection} onClick={() => onFilter(collection)}>
            <Icon name="folder" size={15} />
            <span>{collection}</span>
            {countFor(collection) > 0 && <span className="collection-count">{countFor(collection)}</span>}
          </button>
        ))}
      </div>

      <div className="sidebar-group-header tags-heading">
        <span>TAGS</span>
        <button className="icon-button subtle" onClick={onAddTag} aria-label="Add tag"><Icon name="plus" size={15} /></button>
      </div>
      <div className="tag-list">
        {tags.map((tag) => (
          <button className="tag-item" key={tag} onClick={() => onFilter(tag)}>
            <Icon name="tag" size={14} />
            <span>{tag}</span>
            {countFor(tag) > 0 && <span className="collection-count">{countFor(tag)}</span>}
          </button>
        ))}
      </div>

      <div className="sidebar-bottom">
        <div className="storage-line"><Icon name="archive" size={16} /><span>Local Library</span></div>
        <div className="storage-meta">Local-first · browser MVP</div>
        <button className="sidebar-import" onClick={onImport}><Icon name="import" size={15} /> Import PDF</button>
      </div>
    </aside>
  )
}
