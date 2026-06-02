import { useState, useEffect, useCallback } from 'react'
import { Promotion, Category, MenuItem } from '@vynex/shared'
import { useServerUrl } from '../context/ServerUrlContext'
import { useAuthedFetch } from '../context/AuthContext'
import '../styles/PromotionsManagement.css'

type PromoForm = {
  name: string
  type: 'percentage' | 'fixed'
  value: string
  applicable_to: 'item' | 'category'
  applicable_id: string
  active_from: string
  active_to: string
  use_time_window: boolean
}

const EMPTY_FORM: PromoForm = {
  name: '',
  type: 'percentage',
  value: '',
  applicable_to: 'item',
  applicable_id: '',
  active_from: '',
  active_to: '',
  use_time_window: false,
}

export default function PromotionsManagementScreen() {
  const { serverUrl } = useServerUrl()
  const apiFetch = useAuthedFetch()

  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [opError, setOpError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editPromo, setEditPromo] = useState<Promotion | null>(null)
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setOpError(null)
    try {
      const [promoRes, catRes, miRes] = await Promise.all([
        fetch(`${serverUrl}/promotions`),
        fetch(`${serverUrl}/categories`),
        fetch(`${serverUrl}/menu-items`),
      ])
      setPromotions(await promoRes.json())
      setCategories(await catRes.json())
      setMenuItems(await miRes.json())
    } catch {
      setOpError('Failed to load promotions')
    } finally {
      setLoading(false)
    }
  }, [serverUrl])

  useEffect(() => { fetchAll() }, [fetchAll])

  const openCreate = () => {
    setEditPromo(null)
    setForm(EMPTY_FORM)
    setOpError(null)
    setShowForm(true)
  }

  const openEdit = (p: Promotion) => {
    setEditPromo(p)
    setForm({
      name: p.name,
      type: p.type,
      value: String(p.value),
      applicable_to: p.applicable_to,
      applicable_id: p.applicable_id,
      active_from: p.active_from ?? '',
      active_to: p.active_to ?? '',
      use_time_window: !!(p.active_from || p.active_to),
    })
    setOpError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditPromo(null)
  }

  const handleSave = async () => {
    const value = parseFloat(form.value)
    if (!form.name.trim()) { setOpError('Name is required'); return }
    if (isNaN(value) || value <= 0) { setOpError('Value must be > 0'); return }
    if (form.type === 'percentage' && value > 100) { setOpError('Percentage must be 0–100'); return }
    if (!form.applicable_id) { setOpError('Select an item or category'); return }
    if (form.use_time_window && (!form.active_from || !form.active_to)) {
      setOpError('Set both from and to times'); return
    }

    setSaving(true)
    setOpError(null)
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        value,
        applicable_to: form.applicable_to,
        applicable_id: form.applicable_id,
        active_from: form.use_time_window ? form.active_from : null,
        active_to: form.use_time_window ? form.active_to : null,
      }
      const url = editPromo
        ? `${serverUrl}/promotions/${editPromo.id}`
        : `${serverUrl}/promotions`
      const res = await apiFetch(url, {
        method: editPromo ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save')
      }
      closeForm()
      fetchAll()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (p: Promotion) => {
    try {
      await apiFetch(`${serverUrl}/promotions/${p.id}/toggle`, { method: 'PATCH' })
      fetchAll()
    } catch {
      setOpError('Failed to toggle promotion')
    }
  }

  const handleDelete = async (p: Promotion) => {
    if (!confirm('Delete promotion?')) return
    setDeletingId(p.id)
    try {
      await apiFetch(`${serverUrl}/promotions/${p.id}`, { method: 'DELETE' })
      fetchAll()
    } catch {
      setOpError('Failed to delete promotion')
    } finally {
      setDeletingId(null)
    }
  }

  const applicableOptions = form.applicable_to === 'item' ? menuItems : categories

  return (
    <div className="promo-mgmt">
      <div className="promo-header">
        <h2>Promoções</h2>
        <button className="btn-add-promo" onClick={openCreate}>+ Nova Promoção</button>
      </div>

      {opError && !showForm && <div className="promo-error">{opError}</div>}

      {loading ? (
        <div className="promo-empty">Carregando…</div>
      ) : promotions.length === 0 ? (
        <div className="promo-empty">Nenhuma promoção cadastrada</div>
      ) : (
        <div className="promo-table">
          <div className="promo-table-header">
            <span>Nome</span>
            <span>Desconto</span>
            <span>Aplica em</span>
            <span>Horário</span>
            <span>Status</span>
            <span></span>
          </div>
          {promotions.map(p => {
            const targetName = p.applicable_to === 'item'
              ? menuItems.find(mi => mi.id === p.applicable_id)?.name ?? p.applicable_id
              : categories.find(c => c.id === p.applicable_id)?.name ?? p.applicable_id

            return (
              <div key={p.id} className={`promo-row ${!p.enabled ? 'promo-row--disabled' : ''}`}>
                <span className="promo-name">{p.name}</span>
                <span className="promo-value">
                  {p.type === 'percentage' ? `${p.value}%` : `R$ ${p.value.toFixed(2)}`}
                </span>
                <span className="promo-target">
                  <span className={`promo-scope-badge promo-scope-badge--${p.applicable_to}`}>
                    {p.applicable_to === 'item' ? 'Item' : 'Cat.'}
                  </span>
                  {targetName}
                </span>
                <span className="promo-time">
                  {p.active_from && p.active_to ? `${p.active_from}–${p.active_to}` : 'Sempre'}
                </span>
                <span className={`promo-status ${p.enabled ? 'promo-status--on' : 'promo-status--off'}`}>
                  {p.enabled ? 'Ativa' : 'Inativa'}
                </span>
                <div className="promo-actions">
                  <button className="btn-icon" onClick={() => handleToggle(p)} title={p.enabled ? 'Desativar' : 'Ativar'}>
                    {p.enabled ? '⏸' : '▶'}
                  </button>
                  <button className="btn-icon" onClick={() => openEdit(p)} title="Editar">✏️</button>
                  <button
                    className="btn-icon btn-icon--danger"
                    onClick={() => handleDelete(p)}
                    disabled={deletingId === p.id}
                    title="Excluir"
                  >🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="promo-modal-overlay" onClick={e => e.target === e.currentTarget && closeForm()}>
          <div className="promo-modal">
            <h3>{editPromo ? 'Editar Promoção' : 'Nova Promoção'}</h3>

            {opError && <div className="promo-error">{opError}</div>}

            <label>Nome</label>
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Ex: Happy Hour Cerveja"
            />

            <label>Tipo de desconto</label>
            <div className="promo-type-row">
              {(['percentage', 'fixed'] as const).map(t => (
                <label key={t} className="promo-radio">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={form.type === t}
                    onChange={() => setForm(f => ({ ...f, type: t }))}
                  />
                  {t === 'percentage' ? 'Percentual (%)' : 'Fixo (R$)'}
                </label>
              ))}
            </div>

            <label>Valor ({form.type === 'percentage' ? '%' : 'R$'})</label>
            <input
              type="number"
              min="0.01"
              max={form.type === 'percentage' ? 100 : undefined}
              step="0.01"
              value={form.value}
              onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
              placeholder={form.type === 'percentage' ? '0–100' : '0.00'}
            />

            <label>Aplicar em</label>
            <div className="promo-type-row">
              {(['item', 'category'] as const).map(t => (
                <label key={t} className="promo-radio">
                  <input
                    type="radio"
                    name="applicable_to"
                    value={t}
                    checked={form.applicable_to === t}
                    onChange={() => setForm(f => ({ ...f, applicable_to: t, applicable_id: '' }))}
                  />
                  {t === 'item' ? 'Item específico' : 'Categoria inteira'}
                </label>
              ))}
            </div>

            <label>{form.applicable_to === 'item' ? 'Item' : 'Categoria'}</label>
            <select
              value={form.applicable_id}
              onChange={e => setForm(f => ({ ...f, applicable_id: e.target.value }))}
            >
              <option value="">Selecionar…</option>
              {applicableOptions.map((o: any) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>

            <label className="promo-checkbox-label">
              <input
                type="checkbox"
                checked={form.use_time_window}
                onChange={e => setForm(f => ({ ...f, use_time_window: e.target.checked }))}
              />
              Restringir por horário
            </label>

            {form.use_time_window && (
              <div className="promo-time-row">
                <div>
                  <label>De (HH:MM)</label>
                  <input
                    type="time"
                    value={form.active_from}
                    onChange={e => setForm(f => ({ ...f, active_from: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Até (HH:MM)</label>
                  <input
                    type="time"
                    value={form.active_to}
                    onChange={e => setForm(f => ({ ...f, active_to: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="promo-modal-actions">
              <button onClick={closeForm} disabled={saving}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
