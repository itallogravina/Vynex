import { useState, useEffect, useRef } from 'react'
import type { MenuItem, VariationGroup } from '@vynex/shared'
import { Priority } from '@vynex/shared'
import { useTranslation } from '../context/I18nContext'
import '../styles/QuickOrderPopover.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

type Props = {
  item: MenuItem
  anchorEl: HTMLElement
  onAdd: (quantity: number, notes: string, priority: Priority, variations: string[]) => void
  onClose: () => void
}

export function QuickOrderPopover({ item, anchorEl, onAdd, onClose }: Props) {
  const { t } = useTranslation()
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState<Priority>(Priority.NORMAL)
  const [groups, setGroups] = useState<VariationGroup[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const popoverRef = useRef<HTMLDivElement>(null)

  // position popover near anchor
  const rect = anchorEl.getBoundingClientRect()
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(rect.bottom + 4, window.innerHeight - 320),
    left: Math.min(rect.left, window.innerWidth - 300),
    zIndex: 1000,
  }

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) && !anchorEl.contains(e.target as Node)) {
        onClose()
      }
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', esc)
    }
  }, [anchorEl, onClose])

  useEffect(() => {
    fetch(`${API_URL}/menu-items/${item.id}/variation-groups`)
      .then(r => r.ok ? r.json() : [])
      .then(setGroups)
      .catch(() => {})
  }, [item.id])

  const allRequiredSelected = groups.every(g => !g.required || selectedOptions[g.id])

  const handleAdd = () => {
    if (!allRequiredSelected) return
    onAdd(quantity, notes, priority, Object.values(selectedOptions))
  }

  return (
    <div ref={popoverRef} className="quick-order-popover" style={style}>
      <div className="qop-header">
        <span className="qop-name">{item.name}</span>
        <span className="qop-price">R$ {item.price.toFixed(2)}</span>
      </div>

      {/* Quantity */}
      <div className="qop-row">
        <span>{t('orders.quantity')}</span>
        <div className="qop-stepper">
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
          <span>{quantity}</span>
          <button onClick={() => setQuantity(q => q + 1)}>+</button>
        </div>
      </div>

      {/* Priority */}
      <div className="qop-row">
        <span>Priority</span>
        <div className="qop-priority">
          {([Priority.NORMAL, Priority.URGENT, Priority.VIP] as const).map(p => (
            <button
              key={p}
              className={`qop-prio-btn qop-prio-${p}${priority === p ? ' active' : ''}`}
              onClick={() => setPriority(p)}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Variation groups */}
      {groups.map(group => (
        <div key={group.id} className="qop-variations">
          <span className="qop-group-name">
            {group.name}{group.required && <span className="qop-required">*</span>}
          </span>
          <div className="qop-options">
            {group.options.map(opt => (
              <button
                key={opt.id}
                className={`qop-opt-btn${selectedOptions[group.id] === opt.id ? ' active' : ''}`}
                onClick={() => setSelectedOptions(prev => ({ ...prev, [group.id]: opt.id }))}
              >
                {opt.name}
                {opt.price_delta !== 0 && (
                  <span className="qop-opt-delta">
                    {opt.price_delta > 0 ? '+' : ''}{(opt.price_delta / 100).toFixed(2)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Notes */}
      <textarea
        className="qop-notes"
        placeholder={t('orders.notes')}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
      />

      <div className="qop-actions">
        <button className="qop-cancel" onClick={onClose}>{t('common.cancel')}</button>
        <button
          className="qop-add"
          onClick={handleAdd}
          disabled={!allRequiredSelected}
        >
          {t('orders.addItem')}
        </button>
      </div>
    </div>
  )
}
