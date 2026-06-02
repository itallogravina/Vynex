import { useState, useEffect, useCallback } from 'react'
import { ComboBundle, MenuItem } from '@vynex/shared'
import { useServerUrl } from '../context/ServerUrlContext'
import { useAuthedFetch } from '../context/AuthContext'
import '../styles/CombosManagement.css'

type ComboForm = {
  name: string
  description: string
  bundle_price: string
}

const EMPTY_FORM: ComboForm = { name: '', description: '', bundle_price: '' }

export default function CombosManagementScreen() {
  const { serverUrl } = useServerUrl()
  const apiFetch = useAuthedFetch()

  const [combos, setCombos] = useState<ComboBundle[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [opError, setOpError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editCombo, setEditCombo] = useState<ComboBundle | null>(null)
  const [form, setForm] = useState<ComboForm>(EMPTY_FORM)
  const [formItems, setFormItems] = useState<{ menu_item_id: string; quantity: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setOpError(null)
    try {
      const [combosRes, miRes] = await Promise.all([
        fetch(`${serverUrl}/combos`),
        fetch(`${serverUrl}/menu-items`),
      ])
      setCombos(await combosRes.json())
      setMenuItems(await miRes.json())
    } catch {
      setOpError('Failed to load combos')
    } finally {
      setLoading(false)
    }
  }, [serverUrl])

  useEffect(() => { fetchAll() }, [fetchAll])

  const openCreate = () => {
    setEditCombo(null)
    setForm(EMPTY_FORM)
    setFormItems([])
    setOpError(null)
    setShowForm(true)
  }

  const openEdit = (c: ComboBundle) => {
    setEditCombo(c)
    setForm({ name: c.name, description: c.description ?? '', bundle_price: String(c.bundle_price) })
    setFormItems(c.items.map(i => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })))
    setOpError(null)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditCombo(null) }

  const addFormItem = () => {
    if (menuItems.length === 0) return
    setFormItems(prev => [...prev, { menu_item_id: menuItems[0]!.id, quantity: 1 }])
  }

  const removeFormItem = (idx: number) => {
    setFormItems(prev => prev.filter((_, i) => i !== idx))
  }

  const updateFormItem = (idx: number, field: 'menu_item_id' | 'quantity', value: string) => {
    setFormItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      return { ...item, [field]: field === 'quantity' ? Math.max(1, parseInt(value) || 1) : value }
    }))
  }

  const individualTotal = formItems.reduce((sum, fi) => {
    const mi = menuItems.find(m => m.id === fi.menu_item_id)
    return sum + (mi ? mi.price * fi.quantity : 0)
  }, 0)

  const bundlePrice = parseFloat(form.bundle_price) || 0
  const savings = individualTotal - bundlePrice

  const handleSave = async () => {
    if (!form.name.trim()) { setOpError('Name is required'); return }
    if (isNaN(bundlePrice) || bundlePrice <= 0) { setOpError('Bundle price must be > 0'); return }
    if (formItems.length === 0) { setOpError('Add at least one item'); return }

    setSaving(true)
    setOpError(null)
    try {
      if (editCombo) {
        const res = await apiFetch(`${serverUrl}/combos/${editCombo.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
            bundle_price: bundlePrice,
          }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save')

        // Sync items: delete all existing, re-add
        for (const existItem of editCombo.items) {
          await apiFetch(`${serverUrl}/combos/${editCombo.id}/items/${existItem.id}`, { method: 'DELETE' })
        }
        for (const fi of formItems) {
          await apiFetch(`${serverUrl}/combos/${editCombo.id}/items`, {
            method: 'POST',
            body: JSON.stringify({ menu_item_id: fi.menu_item_id, quantity: fi.quantity }),
          })
        }
      } else {
        const res = await apiFetch(`${serverUrl}/combos`, {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
            bundle_price: bundlePrice,
            items: formItems,
          }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save')
      }
      closeForm()
      fetchAll()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (c: ComboBundle) => {
    try {
      await apiFetch(`${serverUrl}/combos/${c.id}/toggle`, { method: 'PATCH' })
      fetchAll()
    } catch { setOpError('Failed to toggle combo') }
  }

  const handleDelete = async (c: ComboBundle) => {
    if (!confirm('Delete combo?')) return
    setDeletingId(c.id)
    try {
      await apiFetch(`${serverUrl}/combos/${c.id}`, { method: 'DELETE' })
      fetchAll()
    } catch { setOpError('Failed to delete combo') } finally { setDeletingId(null) }
  }

  return (
    <div className="combo-mgmt">
      <div className="combo-header">
        <h2>Combos</h2>
        <button className="btn-add-combo" onClick={openCreate}>+ Novo Combo</button>
      </div>

      {opError && !showForm && <div className="combo-error">{opError}</div>}

      {loading ? (
        <div className="combo-empty">Carregando…</div>
      ) : combos.length === 0 ? (
        <div className="combo-empty">Nenhum combo cadastrado</div>
      ) : (
        <div className="combo-grid">
          {combos.map(c => {
            const indTotal = c.items.reduce((s, i) => s + i.menu_item.price * i.quantity, 0)
            const save = indTotal - c.bundle_price
            return (
              <div key={c.id} className={`combo-card ${!c.enabled ? 'combo-card--disabled' : ''}`}>
                <div className="combo-card-header">
                  <div>
                    <div className="combo-card-name">{c.name}</div>
                    {c.description && <div className="combo-card-desc">{c.description}</div>}
                  </div>
                  <div className="combo-card-price-block">
                    <span className="combo-bundle-price">R$ {c.bundle_price.toFixed(2)}</span>
                    {save > 0.005 && (
                      <span className="combo-savings">-R$ {save.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <div className="combo-items-list">
                  {c.items.map(i => (
                    <div key={i.id} className="combo-item-row">
                      <span>{i.quantity}× {i.menu_item.name}</span>
                      <span className="combo-item-zone">{i.menu_item.routing_zone}</span>
                      <span className="combo-item-price">R$ {(i.menu_item.price * i.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="combo-card-actions">
                  <span className={`combo-status ${c.enabled ? 'combo-status--on' : 'combo-status--off'}`}>
                    {c.enabled ? 'Ativo' : 'Inativo'}
                  </span>
                  <button className="btn-icon" onClick={() => handleToggle(c)} title={c.enabled ? 'Desativar' : 'Ativar'}>
                    {c.enabled ? '⏸' : '▶'}
                  </button>
                  <button className="btn-icon" onClick={() => openEdit(c)} title="Editar">✏️</button>
                  <button className="btn-icon btn-icon--danger" onClick={() => handleDelete(c)} disabled={deletingId === c.id} title="Excluir">🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="combo-modal-overlay" onClick={e => e.target === e.currentTarget && closeForm()}>
          <div className="combo-modal">
            <h3>{editCombo ? 'Editar Combo' : 'Novo Combo'}</h3>

            {opError && <div className="combo-error">{opError}</div>}

            <label>Nome</label>
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Combo Burger"
            />

            <label>Descrição (opcional)</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descrição curta"
            />

            <label>Preço do Combo (R$)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.bundle_price}
              onChange={e => setForm(f => ({ ...f, bundle_price: e.target.value }))}
              placeholder="0.00"
            />

            {formItems.length > 0 && individualTotal > 0 && (
              <div className="combo-price-summary">
                <span>Individual: R$ {individualTotal.toFixed(2)}</span>
                {bundlePrice > 0 && savings > 0.005 && (
                  <span className="combo-savings-label">Economia: R$ {savings.toFixed(2)}</span>
                )}
              </div>
            )}

            <div className="combo-items-section">
              <div className="combo-items-section-header">
                <span>Itens</span>
                <button className="btn-add-item" onClick={addFormItem} type="button">+ Adicionar item</button>
              </div>
              {formItems.length === 0 && (
                <div className="combo-no-items">Nenhum item adicionado</div>
              )}
              {formItems.map((fi, idx) => (
                <div key={idx} className="combo-form-item-row">
                  <select
                    value={fi.menu_item_id}
                    onChange={e => updateFormItem(idx, 'menu_item_id', e.target.value)}
                    className="combo-item-select"
                  >
                    {menuItems.map(mi => (
                      <option key={mi.id} value={mi.id}>
                        {mi.name} — R$ {mi.price.toFixed(2)} ({mi.routing_zone})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={fi.quantity}
                    onChange={e => updateFormItem(idx, 'quantity', e.target.value)}
                    className="combo-qty-input"
                  />
                  <button className="btn-remove-item" onClick={() => removeFormItem(idx)} type="button">✕</button>
                </div>
              ))}
            </div>

            <div className="combo-modal-actions">
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
