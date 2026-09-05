import type { KnowledgeType, SelectionContext } from '../types'
import { Icon, type IconName } from './Icon'

interface FloatingToolbarProps {
  selection: SelectionContext
  onTranslate: () => void
  onExplain: () => void
  onSave: (type: KnowledgeType) => void
  onDismiss: () => void
}

const actions: Array<{ type: KnowledgeType; label: string; icon: IconName }> = [
  { type: 'Vocabulary', label: 'Word', icon: 'type' },
  { type: 'Writing', label: 'Writing', icon: 'highlighter' },
  { type: 'Knowledge', label: 'Knowledge', icon: 'bookmark' },
  { type: 'Method', label: 'Method', icon: 'gauge' },
  { type: 'Data', label: 'Data', icon: 'layoutList' },
  { type: 'Figure', label: 'Figure', icon: 'image' },
  { type: 'Idea', label: 'Idea', icon: 'lightbulb' },
]

export function FloatingToolbar({ selection, onTranslate, onExplain, onSave, onDismiss }: FloatingToolbarProps) {
  const left = Math.min(window.innerWidth - 340, Math.max(250, selection.rect.left - 28))
  const top = Math.max(78, selection.rect.top - 54)
  return (
    <div className="floating-selection-toolbar" style={{ left, top }} role="toolbar" aria-label="Selection actions">
      <button className="selection-action accent" onClick={onTranslate}><Icon name="languages" size={15} /> Translate</button>
      <button className="selection-action" onClick={onExplain}><Icon name="message" size={15} /> Explain</button>
      <span className="toolbar-separator" />
      {actions.map((action) => (
        <button key={action.type} className="selection-icon-action" title={`Save as ${action.type}`} onClick={() => onSave(action.type)}>
          <Icon name={action.icon} size={15} />
        </button>
      ))}
      <button className="selection-icon-action" title="Dismiss" onClick={onDismiss}><Icon name="x" size={15} /></button>
    </div>
  )
}
