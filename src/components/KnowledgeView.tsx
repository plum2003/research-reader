import { useMemo, useState } from 'react'
import type { AssetRecord, KnowledgeItem, KnowledgeType, Paper } from '../types'
import { Icon } from './Icon'
import { KnowledgeCard } from './KnowledgeCard'

interface KnowledgeViewProps {
  items: KnowledgeItem[]
  assets: AssetRecord[]
  papers: Paper[]
  search: string
  sidebarFilter: string
  onOpen: (item: KnowledgeItem) => void
  onDelete: (id: string) => void
  onSearch: (value: string) => void
  onClearSidebarFilter: () => void
  onPreviewAsset: (asset: AssetRecord) => void
  onExport: () => void
}

const filters: Array<'All' | KnowledgeType> = ['All', 'Vocabulary', 'Writing', 'Knowledge', 'Method', 'Data', 'Figure', 'Idea']

export function KnowledgeView({ items, assets, papers, search, sidebarFilter, onOpen, onDelete, onSearch, onClearSidebarFilter, onPreviewAsset, onExport }: KnowledgeViewProps) {
  const [filter, setFilter] = useState<'All' | KnowledgeType>('All')
  const [tag, setTag] = useState('All tags')
  const tags = ['All tags', ...Array.from(new Set(items.flatMap((item) => item.tags))).sort()]
  const filtered = useMemo(() => items.filter((item) => {
    const paper = papers.find((candidate) => candidate.id === item.paperId)
    const haystack = [item.title, item.sourceText, item.translatedText, item.userNote, item.tags.join(' '), paper?.title || ''].join(' ').toLowerCase()
    return (filter === 'All' || item.type === filter) && (tag === 'All tags' || item.tags.includes(tag)) && (!sidebarFilter || item.tags.includes(sidebarFilter) || paper?.title.toLowerCase().includes(sidebarFilter.toLowerCase())) && (!search || haystack.includes(search.toLowerCase()))
  }), [filter, items, papers, search, sidebarFilter, tag])

  return (
    <section className="knowledge-view">
      <div className="knowledge-view-header"><div><span className="panel-eyebrow">PERSONAL RESEARCH MEMORY</span><h1>Knowledge library</h1><p>每一条记录都保留原文、页码和来源论文。</p></div><div className="knowledge-view-actions"><button className="outline-button" onClick={() => document.querySelector<HTMLInputElement>('.knowledge-search input')?.focus()}><Icon name="listFilter" size={15} /> Filters</button><button className="outline-button" onClick={onExport}><Icon name="download" size={15} /> Export</button></div></div>
      <div className="knowledge-toolbar"><label className="knowledge-search"><Icon name="search" size={16} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search source text, notes, tags…" /></label><div className="type-filters">{filters.map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div><select value={tag} onChange={(event) => setTag(event.target.value)}>{tags.map((value) => <option key={value}>{value}</option>)}</select></div>
      {sidebarFilter && <div className="knowledge-filter-chip"><span>筛选：{sidebarFilter}</span><button onClick={onClearSidebarFilter}>清除</button></div>}
      <div className="knowledge-results-head"><span>{filtered.length} items</span><span>Sorted by recently saved</span></div>
      <div className="knowledge-grid">{filtered.map((item) => <KnowledgeCard key={item.id} item={item} asset={assets.find((asset) => asset.id === item.assetId)} paper={papers.find((paper) => paper.id === item.paperId)} onOpen={onOpen} onDelete={onDelete} onPreviewAsset={onPreviewAsset} />)}</div>
      {!filtered.length && <div className="empty-library"><Icon name="search" size={28} /><h2>No matching knowledge</h2><p>Try a different keyword or type filter.</p></div>}
    </section>
  )
}
