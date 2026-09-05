import type { KnowledgeItem, Paper } from '../types'
import { Icon } from './Icon'
import { KnowledgeCard } from './KnowledgeCard'

export function TimelineView({ items, papers, onOpen }: { items: KnowledgeItem[]; papers: Paper[]; onOpen: (item: KnowledgeItem) => void }) {
  const grouped = items.reduce<Record<string, KnowledgeItem[]>>((acc, item) => {
    const date = new Date(item.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
    acc[date] = [...(acc[date] || []), item]
    return acc
  }, {})
  return <section className="timeline-view"><div className="knowledge-view-header"><div><span className="panel-eyebrow">READING LOG</span><h1>Reading timeline</h1><p>按时间回看你从论文中留下的线索。</p></div><Icon name="clock" size={22} className="muted-icon" /></div><div className="timeline-list">{Object.entries(grouped).map(([date, dateItems]) => <div className="timeline-day" key={date}><div className="timeline-date"><span className="timeline-dot" /><span>{date}</span><span className="timeline-line" /></div><div className="timeline-items">{dateItems.map((item) => <KnowledgeCard key={item.id} item={item} paper={papers.find((paper) => paper.id === item.paperId)} onOpen={onOpen} />)}</div></div>)}</div></section>
}
