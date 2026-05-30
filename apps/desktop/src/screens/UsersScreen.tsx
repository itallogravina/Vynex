import { useState, useEffect } from 'react'
import { User, Role, LoginMethod } from '@vynex/shared'
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
  const api = useApi()
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState<UserForm>(BLANK_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Bulk import
  const [bulkJson, setBulkJson] = useState('')
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: { index: number; error: string }[] } | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  // Auto-generate
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
        setSuccess('User updated.')
      } else {
        await api.post('/users', body)
        setSuccess('User created.')
      }
      cancelEdit()
      loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(u: User) {
    if (!confirm(`Remove ${u.name}?`)) return
    try {
      await api.del(`/users/${u.id}`)
      setSuccess(`${u.name} removed.`)
      loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
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
      setError(err instanceof Error ? err.message : 'Bulk import failed')
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
      <h2>Users</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Form */}
      <div className="users-form card">
        <h3>{editId ? 'Edit User' : 'Add User'}</h3>
        <div className="form-row">
          <input className="input" placeholder="Name" value={form.name} onChange={e => f('name', e.target.value)} />
          <select className="select" value={form.role} onChange={e => f('role', e.target.value as Role)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="select" value={form.login_method} onChange={e => f('login_method', e.target.value as LoginMethod)}>
            {LOGIN_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {form.login_method === 'pin' && (
            <input className="input" placeholder="PIN" value={form.pin} onChange={e => f('pin', e.target.value)} />
          )}
          {form.login_method === 'password' && (
            <input className="input" type="password" placeholder="Password" value={form.password} onChange={e => f('password', e.target.value)} />
          )}
          {editId && (
            <label className="checkbox-label">
              <input type="checkbox" checked={form.enabled} onChange={e => f('enabled', e.target.checked)} />
              Enabled
            </label>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
          </button>
          {editId && <button className="btn" onClick={cancelEdit}>Cancel</button>}
        </div>
      </div>

      {/* Users table */}
      <div className="users-table card">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Role</th><th>Login</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={!u.enabled ? 'row-disabled' : ''}>
                <td>{u.name}</td>
                <td>{u.role}</td>
                <td>{u.login_method}</td>
                <td>{u.enabled ? 'Active' : 'Disabled'}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => startEdit(u)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u)}>Remove</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>No users yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Auto-generate */}
      <div className="users-gen card">
        <h3>Auto-generate</h3>
        <div className="form-row">
          <select className="select" value={genRole} onChange={e => setGenRole(e.target.value as Role)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input
            className="input" style={{ width: 80 }} type="number" min={1} max={20}
            value={genCount} onChange={e => setGenCount(e.target.value)}
          />
          <button className="btn" onClick={handleAutoGenerate}>Generate JSON</button>
        </div>
      </div>

      {/* Bulk import */}
      <div className="users-bulk card">
        <h3>Bulk Import (JSON)</h3>
        <textarea
          className="bulk-textarea"
          rows={8}
          placeholder='[{"name":"...","role":"waiter","login_method":"pin","pin":"1234"}]'
          value={bulkJson}
          onChange={e => setBulkJson(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleBulkImport} disabled={bulkLoading || !bulkJson.trim()}>
          {bulkLoading ? 'Importing…' : 'Import'}
        </button>
        {bulkResult && (
          <div className="bulk-result">
            <span className="text-success">Created: {bulkResult.created}</span>
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
