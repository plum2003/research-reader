import type { Paper } from '../types'
import { Icon } from './Icon'

interface TopbarProps {
  paper?: Paper
  search: string
  pageNumber: number
  onSearch: (value: string) => void
  onImport: () => void
  onPageChange: (page: number) => void
  onSettings: () => void
  onTogglePanel: () => void
  rightPanelVisible: boolean
}

export function Topbar({ paper, search, pageNumber, onSearch, onImport, onPageChange, onSettings, onTogglePanel, rightPanelVisible }: TopbarProps) {
  const maxPage = paper?.pageCount || 1
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-button primary" onClick={onImport}><Icon name="import" size={16} /> Import PDF</button>
        <label className="search-box">
          <Icon name="search" size={16} />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search library" />
          <span className="shortcut">⌘K</span>
        </label>
      </div>
      <div className="current-paper-title" title={paper?.title}>{paper?.title || 'No paper selected'}</div>
      <div className="topbar-right">
        <div className="page-jumper">
          <button className="icon-button" onClick={() => onPageChange(Math.max(1, pageNumber - 1))} aria-label="Previous page"><Icon name="chevronLeft" size={17} /></button>
          <input aria-label="Page number" value={pageNumber} onChange={(event) => onPageChange(Math.min(maxPage, Math.max(1, Number(event.target.value) || 1)))} />
          <span>/ {maxPage}</span>
          <button className="icon-button" onClick={() => onPageChange(Math.min(maxPage, pageNumber + 1))} aria-label="Next page"><Icon name="chevronRight" size={17} /></button>
        </div>
        <button className={`icon-button ${rightPanelVisible ? 'active' : ''}`} onClick={onTogglePanel} aria-label={rightPanelVisible ? 'Hide inspector' : 'Show inspector'} title={rightPanelVisible ? 'Hide inspector' : 'Show inspector'}><Icon name="layoutList" size={18} /></button>
        <button className="icon-button" onClick={onSettings} aria-label="Settings" title="Settings"><Icon name="settings" size={18} /></button>
      </div>
    </header>
  )
}
