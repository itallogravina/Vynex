import { useState, useEffect, useCallback } from 'react'
import { TableWithStatus } from '@vynex/shared'
import { useTranslation } from '@vynex/i18n'
import '../styles/TableManagement.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

type FormState = { name: string; seats: string }
type EditTarget = { id: string } & FormState

export default function TableManagementScreen() {
  const { t } = useTranslation()
  const [tables, setTables] = useState<TableWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [form, setForm] = useState<FormState>({ name: '', seats: '4' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchTables = useCallback(() => {
    setLoading(true)
    fetch(`${API_URL}/tables/status`)
      .then(r => r.json())
      .then(data => setTables(data))
      .catch(err => console.error('Failed to fetch tables:', err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchTables()
  }, [fetchTables])

  const openAdd = () => {
    setEditTarget(null)
    setForm({ name: '', seats: '4' })
    setShowForm(true)
  }

  const openEdit = (table: TableWithStatus) => {
    setEditTarget({ id: table.id, name: table.name, seats: String(table.seats) })
    setForm({ name: table.name, seats: String(table.seats) })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditTarget(null)
    setSaveError(null)
  }

  const handleSave = async () => {
    const seats = parseInt(form.seats, 10)
    if (!form.name.trim() || !seats || seats < 1) return

    setSaving(true)
    setSaveError(null)
    try {
      const url = editTarget ? `${API_URL}/tables/${editTarget.id}` : `${API_URL}/tables`
      const method = editTarget ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), seats }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('errors.GENERAL_UNKNOWN'))
      }
      closeForm()
      fetchTables()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('errors.GENERAL_UNKNOWN'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (table: TableWithStatus) => {
    if (table.status === 'occupied') {
      setDeleteError(t('tables.hasOpenOrder', { name: table.name }))
      return
    }
    setDeleteError(null)
    const res = await fetch(`${API_URL}/tables/${table.id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchTables()
    } else {
      const data = await res.json()
      setDeleteError(data.error || t('errors.GENERAL_UNKNOWN'))
    }
  }

  return (
    <div className="mgmt-screen">
      <header className="mgmt-header">
        <h1>{t('tables.title')}</h1>
        <button className="btn-add" onClick={openAdd}>
          {t('tables.addTable')}
        </button>
      </header>

      {deleteError && (
        <div className="mgmt-error" onClick={() => setDeleteError(null)}>
          {deleteError} ✕
        </div>
      )}

      {loading ? (
        <div className="mgmt-empty">{t('common.loading')}</div>
      ) : tables.length === 0 ? (
        <div className="mgmt-empty">{t('tables.noTablesYet')}</div>
      ) : (
        <div className="tables-grid">
          {tables.map(table => (
            <div
              key={table.id}
              className={`table-card table-${table.status}`}
            >
              <div className="table-card-header">
                <span className={`table-status-dot dot-${table.status}`} />
                <span className="table-status-label">
                  {table.status === 'occupied' ? t('tables.status.occupied') : t('tables.status.available')}
                </span>
              </div>
              <div className="table-name-large">{table.name}</div>
              <div className="table-seats">{table.seats} {t('tables.seats').toLowerCase()}</div>
              <div className="table-card-actions">
                <button className="btn-icon btn-edit" onClick={() => openEdit(table)}>
                  {t('common.edit')}
                </button>
                <button
                  className="btn-icon btn-delete"
                  disabled={table.status === 'occupied'}
                  onClick={() => handleDelete(table)}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editTarget ? t('tables.editTable') : t('tables.newTable')}</h2>

            {saveError && (
              <div className="mgmt-error" onClick={() => setSaveError(null)}>
                {saveError} ✕
              </div>
            )}

            <div className="modal-field">
              <label>{t('tables.tableName')}</label>
              <input
                autoFocus
                type="text"
                value={form.name}
                placeholder="e.g. Table 7"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>

            <div className="modal-field">
              <label>{t('tables.seats')}</label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.seats}
                onChange={e => setForm(f => ({ ...f, seats: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeForm}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-save"
                disabled={saving || !form.name.trim()}
                onClick={handleSave}
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
