import { useState, useEffect } from 'react'
import { User, Role, LoginMethod } from '@vynex/shared'
import { useTranslation } from '@vynex/i18n'
import { useApi } from '../lib/api'

type UserForm = {
  name: string
  role: Role
  login_method: LoginMethod
  pin: string
  password: string
  enabled: boolean
}

const BLANK_FORM: UserForm = {
  name: '', role: 'waiter', login_method: 'pin', pin: '', password: '', enabled: true,
}

const ROLES: Role[] = ['owner', 'manager', 'cashier', 'waiter', 'bartender', 'kitchen']
const LOGIN_METHODS: LoginMethod[] = ['pin', 'password', 'list']

export default function UsersScreen() {
  const { t } = useTranslation()
  const api = useApi()
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState<UserForm>(BLANK_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [bulkJson, setBulkJson] = useState('')
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: { index: number; error: string }[] } | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  const [genRole, setGenRole] = useState<Role>('waiter')
  const [genCount, setGenCount] = useState('3')

  async function loadUsers() {
    try {
      const data = await api.get<User[]>('/users')
      setUsers(data)
    } catch { /* will show stale data */ }
  }

  useEffect(() => { loadUsers() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(u: User) {
    setEditId(u.id)
    setForm({ name: u.name, role: u.role, login_method: u.login_method, pin: '', password: '', enabled: u.enabled })
    setError(null)
    setSuccess(null)
  }

  function cancelEdit() { setEditId(null); setForm(BLANK_FORM) }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const body: Record<string, unknown> = {
        name: form.name, role: form.role, login_method: form.login_method, enabled: form.enabled,
      }
      if (form.login_method === 'pin' && form.pin) body.pin = form.pin
      if (form.login_method === 'password' && form.password) body.password = form.password

      if (editId) {
        await api.patch(`/users/${editId}`, body)
        setSuccess(t('users.updated'))
      } else {
        await api.post('/users', body)
        setSuccess(t('users.created'))
      }
      cancelEdit()
      loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.GENERAL_UNKNOWN'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(u: User) {
    if (!confirm(t('users.removeConfirm', { name: u.name }))) return
    try {
      await api.del(`/users/${u.id}`)
      setSuccess(t('users.removed', { name: u.name }))
      loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.GENERAL_UNKNOWN'))
    }
  }

  async function handleBulkImport() {
    setBulkLoading(true); setBulkResult(null); setError(null)
    try {
      const parsed = JSON.parse(bulkJson)
      const { data } = await api.post<{ created: number; errors: { index: number; error: string }[] }>(
        '/users/bulk-import', parsed
      )
      setBulkResult(data)
      if (data.created > 0) loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.GENERAL_UNKNOWN'))
    } finally {
      setBulkLoading(false)
    }
  }

  async function handleAutoGenerate() {
    const count = Math.max(1, Math.min(20, Number(genCount) || 3))
    const label = genRole.charAt(0).toUpperCase() + genRole.slice(1)
    const entries = Array.from({ length: count }, (_, i) => ({
      name: `${label} ${i + 1}`,
      role: genRole,
      login_method: 'pin' as LoginMethod,
      pin: String(1000 + i).padStart(4, '0'),
    }))
    setBulkJson(JSON.stringify(entries, null, 2))
  }

  const f = (k: keyof UserForm, v: unknown) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="screen-users">
      <h2>{t('users.title')}</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="users-form card">
        <h3>{editId ? t('users.editUser') : t('users.newUser')}</h3>
        <div className="form-row">
          <input className="input" placeholder={t('users.userName')} value={form.name} onChange={e => f('name', e.target.value)} />
          <select className="select" value={form.role} onChange={e => f('role', e.target.value as Role)}>
            {ROLES.map(r => <option key={r} value={r}>{t(`roles.${r}` as Parameters<typeof t>[0])}</option>)}
          </select>
          <select className="select" value={form.login_method} onChange={e => f('login_method', e.target.value as LoginMethod)}>
            {LOGIN_METHODS.map(m => <option key={m} value={m}>{t(`users.loginMethods.${m}` as Parameters<typeof t>[0])}</option>)}
          </select>
          {form.login_method === 'pin' && (
            <input className="input" placeholder={t('users.pin')} value={form.pin} onChange={e => f('pin', e.target.value)} />
          )}
          {form.login_method === 'password' && (
            <input className="input" type="password" placeholder={t('auth.password')} value={form.password} onChange={e => f('password', e.target.value)} />
          )}
          {editId && (
            <label className="checkbox-label">
              <input type="checkbox" checked={form.enabled} onChange={e => f('enabled', e.target.checked)} />
              {t('users.enabled')}
            </label>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? t('common.saving') : editId ? t('common.update') : t('common.create')}
          </button>
          {editId && <button className="btn" onClick={cancelEdit}>{t('common.cancel')}</button>}
        </div>
      </div>

      <div className="users-table card">
        <table>
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('users.role')}</th>
              <th>{t('users.loginMethod')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={!u.enabled ? 'row-disabled' : ''}>
                <td>{u.name}</td>
                <td>{t(`roles.${u.role}` as Parameters<typeof t>[0])}</td>
                <td>{t(`users.loginMethods.${u.login_method}` as Parameters<typeof t>[0])}</td>
                <td>{u.enabled ? t('users.enabled') : t('users.disabled')}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => startEdit(u)}>{t('common.edit')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u)}>{t('common.remove')}</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>{t('users.noUsersYet')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="users-gen card">
        <h3>{t('users.autoGenerate')}</h3>
        <div className="form-row">
          <select className="select" value={genRole} onChange={e => setGenRole(e.target.value as Role)}>
            {ROLES.map(r => <option key={r} value={r}>{t(`roles.${r}` as Parameters<typeof t>[0])}</option>)}
          </select>
          <input
            className="input" style={{ width: 80 }} type="number" min={1} max={20}
            value={genCount} onChange={e => setGenCount(e.target.value)}
          />
          <button className="btn" onClick={handleAutoGenerate}>{t('users.generateJson')}</button>
        </div>
      </div>

      <div className="users-bulk card">
        <h3>{t('users.bulkImport')} (JSON)</h3>
        <textarea
          className="bulk-textarea"
          rows={8}
          placeholder='[{"name":"...","role":"waiter","login_method":"pin","pin":"1234"}]'
          value={bulkJson}
          onChange={e => setBulkJson(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleBulkImport} disabled={bulkLoading || !bulkJson.trim()}>
          {bulkLoading ? t('users.importing') : t('common.import')}
        </button>
        {bulkResult && (
          <div className="bulk-result">
            <span className="text-success">{t('users.createdCount', { count: bulkResult.created })}</span>
            {bulkResult.errors.length > 0 && (
              <ul className="bulk-errors">
                {bulkResult.errors.map(e => <li key={e.index}>#{e.index}: {e.error}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
