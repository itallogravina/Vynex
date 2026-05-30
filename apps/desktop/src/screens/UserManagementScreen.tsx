import { useState, useEffect, useCallback, useRef } from 'react'
import { User, Role, LoginMethod, CreateUserRequest, BulkImportResult } from '@vynex/shared'
import { useAuthedFetch } from '../context/AuthContext'
import { useServerUrl } from '../context/ServerUrlContext'
import '../styles/UserManagement.css'

const ROLES: Role[] = ['owner', 'manager', 'cashier', 'waiter', 'bartender', 'kitchen']
const LOGIN_METHODS: LoginMethod[] = ['pin', 'password', 'list']

type UserForm = {
  name: string
  role: Role
  login_method: LoginMethod
  username: string
  pin: string
  password: string
}

const EMPTY_FORM: UserForm = {
  name: '', role: 'waiter', login_method: 'pin', username: '', pin: '', password: '',
}

type Tab = 'users' | 'bulk' | 'auto'

export default function UserManagementScreen() {
  const apiFetch = useAuthedFetch()
  const { serverUrl } = useServerUrl()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('users')
  const [opError, setOpError] = useState<string | null>(null)
  const [opSuccess, setOpSuccess] = useState<string | null>(null)

  // User form
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Bulk import
  const [bulkText, setBulkText] = useState('')
  const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-generate
  const [genRole, setGenRole] = useState<Role>('waiter')
  const [genMethod, setGenMethod] = useState<LoginMethod>('pin')
  const [genCount, setGenCount] = useState('5')
  const [genPrefix, setGenPrefix] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [genResult, setGenResult] = useState<{ name: string; pin?: string }[] | null>(null)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    apiFetch(`${serverUrl}/users`)
      .then(r => r.json())
      .then((data: User[]) => setUsers(data))
      .catch(() => setOpError('Failed to load users'))
      .finally(() => setLoading(false))
  }, [apiFetch, serverUrl])

  useEffect(() => { fetchUsers() }, [])

  function flash(success: string) {
    setOpSuccess(success)
    setOpError(null)
    setTimeout(() => setOpSuccess(null), 3000)
  }

  function openCreate() {
    setEditUser(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setOpError(null)
  }

  function openEdit(u: User) {
    setEditUser(u)
    setForm({ name: u.name, role: u.role, login_method: u.login_method, username: '', pin: '', password: '' })
    setShowForm(true)
    setOpError(null)
  }

  async function handleSave() {
    if (!form.name.trim()) { setOpError('Name is required'); return }
    setSaving(true)
    setOpError(null)
    try {
      const body: CreateUserRequest = {
        name: form.name.trim(),
        role: form.role,
        login_method: form.login_method,
        ...(form.username.trim() ? { username: form.username.trim() } : {}),
        ...(form.pin ? { pin: form.pin } : {}),
        ...(form.password ? { password: form.password } : {}),
      }

      if (editUser) {
        const res = await apiFetch(`${serverUrl}/users/${editUser.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        if (!res.ok) { const e = await res.json(); setOpError(e.error ?? 'Update failed'); return }
      } else {
        const res = await apiFetch(`${serverUrl}/users`, { method: 'POST', body: JSON.stringify(body) })
        if (!res.ok) { const e = await res.json(); setOpError(e.error ?? 'Create failed'); return }
      }

      fetchUsers()
      setShowForm(false)
      flash(editUser ? 'User updated.' : 'User created.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleEnabled(u: User) {
    setOpError(null)
    const res = await apiFetch(`${serverUrl}/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !u.enabled }),
    })
    if (!res.ok) { setOpError('Failed to update user'); return }
    fetchUsers()
  }

  async function handleDelete(u: User) {
    if (!confirm(`Delete "${u.name}"? If they have orders they will be disabled instead.`)) return
    setOpError(null)
    const res = await apiFetch(`${serverUrl}/users/${u.id}`, { method: 'DELETE' })
    if (!res.ok) { const e = await res.json(); setOpError(e.error ?? 'Delete failed'); return }
    fetchUsers()
    flash('User removed.')
  }

  // ---- Bulk import ----
  function loadCsvFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setBulkText(text)
    }
    reader.readAsText(file)
  }

  function parseBulkText(text: string): CreateUserRequest[] {
    const lines = text.trim().split('\n')
    const result: CreateUserRequest[] = []
    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const [name, role, login_method, credential] = line.split(',').map(s => s.trim())
      if (!name || !role || !login_method) continue
      const req: CreateUserRequest = {
        name,
        role: role as Role,
        login_method: login_method as LoginMethod,
      }
      if (login_method === 'pin' && credential) req.pin = credential
      if (login_method === 'password' && credential) {
        const [username, password] = credential.split(':')
        if (username) req.username = username
        if (password) req.password = password
      }
      result.push(req)
    }
    return result
  }

  async function handleBulkImport() {
    setBulkLoading(true)
    setBulkResult(null)
    setOpError(null)
    try {
      const parsed = parseBulkText(bulkText)
      if (parsed.length === 0) { setOpError('No valid rows found. Format: name, role, login_method[, credential]'); return }

      const res = await apiFetch(`${serverUrl}/users/bulk-import`, {
        method: 'POST',
        body: JSON.stringify({ users: parsed }),
      })
      const data: BulkImportResult = await res.json()
      setBulkResult(data)
      if (data.created > 0) { fetchUsers(); flash(`Imported ${data.created} user(s).`) }
    } catch {
      setOpError('Import failed')
    } finally {
      setBulkLoading(false)
    }
  }

  // ---- Auto-generate ----
  async function handleAutoGenerate() {
    const count = parseInt(genCount, 10)
    if (!count || count < 1 || count > 100) { setOpError('Count must be 1–100'); return }
    setGenLoading(true)
    setGenResult(null)
    setOpError(null)
    try {
      const res = await apiFetch(`${serverUrl}/users/auto-generate`, {
        method: 'POST',
        body: JSON.stringify({ role: genRole, login_method: genMethod, count, prefix: genPrefix || undefined }),
      })
      if (!res.ok) { const e = await res.json(); setOpError(e.error ?? 'Auto-generate failed'); return }
      const data = await res.json()
      setGenResult(data.created)
      fetchUsers()
      flash(`Generated ${data.created.length} user(s).`)
    } finally {
      setGenLoading(false)
    }
  }

  return (
    <div className="um-root">
      <div className="um-header">
        <h2 className="um-title">Users</h2>
        <div className="um-tabs">
          {(['users', 'bulk', 'auto'] as Tab[]).map(t => (
            <button key={t} className={`um-tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setOpError(null) }}>
              {t === 'users' ? 'Manage' : t === 'bulk' ? 'Bulk Import' : 'Auto-generate'}
            </button>
          ))}
        </div>
      </div>

      {opError && <div className="um-error">{opError}</div>}
      {opSuccess && <div className="um-success">{opSuccess}</div>}

      {/* ---- Manage tab ---- */}
      {tab === 'users' && (
        <div className="um-manage">
          <div className="um-toolbar">
            <button className="um-btn-primary" onClick={openCreate}>+ New User</button>
          </div>

          {loading ? (
            <p className="um-hint">Loading…</p>
          ) : users.length === 0 ? (
            <p className="um-hint">No users yet. Create one or use Bulk Import / Auto-generate.</p>
          ) : (
            <table className="um-table">
              <thead>
                <tr>
                  <th>Name</th><th>Role</th><th>Login</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={u.enabled ? '' : 'um-row-disabled'}>
                    <td>{u.name}</td>
                    <td><span className={`um-role-badge um-role-${u.role}`}>{u.role}</span></td>
                    <td>{u.login_method}</td>
                    <td>
                      <button
                        className={`um-toggle ${u.enabled ? 'enabled' : 'disabled'}`}
                        onClick={() => handleToggleEnabled(u)}
                      >
                        {u.enabled ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="um-actions">
                      <button className="um-btn-icon" onClick={() => openEdit(u)}>Edit</button>
                      <button className="um-btn-icon danger" onClick={() => handleDelete(u)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {showForm && (
            <div className="um-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
              <div className="um-modal">
                <h3 className="um-modal-title">{editUser ? 'Edit User' : 'New User'}</h3>

                <label className="um-field-label">Name
                  <input className="um-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </label>

                <label className="um-field-label">Role
                  <select className="um-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>

                <label className="um-field-label">Login method
                  <select className="um-select" value={form.login_method} onChange={e => setForm(f => ({ ...f, login_method: e.target.value as LoginMethod, pin: '', password: '', username: '' }))}>
                    {LOGIN_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>

                {form.login_method === 'pin' && (
                  <label className="um-field-label">
                    PIN {editUser ? '(leave blank to keep current)' : ''}
                    <input className="um-input" type="password" inputMode="numeric" maxLength={6}
                      placeholder="4–6 digits" value={form.pin}
                      onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))} />
                  </label>
                )}

                {form.login_method === 'password' && (
                  <>
                    <label className="um-field-label">Username
                      <input className="um-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                    </label>
                    <label className="um-field-label">
                      Password {editUser ? '(leave blank to keep current)' : ''}
                      <input className="um-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                    </label>
                  </>
                )}

                <div className="um-modal-actions">
                  <button className="um-btn-secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
                  <button className="um-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Bulk import tab ---- */}
      {tab === 'bulk' && (
        <div className="um-bulk">
          <p className="um-hint">
            Paste CSV rows or upload a file. Format: <code>name, role, login_method[, credential]</code><br />
            For PIN: <code>Ana Silva, waiter, pin, 1234</code><br />
            For password: <code>João, manager, password, joao:senha123</code><br />
            For list: <code>Maria, cashier, list</code>
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) loadCsvFile(f) }}
          />
          <button className="um-btn-secondary" onClick={() => fileInputRef.current?.click()}>Upload CSV</button>

          <textarea
            className="um-textarea"
            rows={10}
            placeholder={'Ana Silva, waiter, pin, 1234\nJoão, manager, password, joao:senha123\nMaria, cashier, list'}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
          />

          <button className="um-btn-primary" onClick={handleBulkImport} disabled={!bulkText.trim() || bulkLoading}>
            {bulkLoading ? 'Importing…' : 'Import'}
          </button>

          {bulkResult && (
            <div className="um-bulk-result">
              <p className="um-success-inline">✓ {bulkResult.created} user(s) created</p>
              {bulkResult.failed.length > 0 && (
                <ul className="um-bulk-errors">
                  {bulkResult.failed.map((f, i) => (
                    <li key={i}>Row {f.index + 1} "{f.name}": {f.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- Auto-generate tab ---- */}
      {tab === 'auto' && (
        <div className="um-auto">
          <p className="um-hint">
            Generate numbered users automatically (e.g. "Waiter 1, Waiter 2…"). PIN users get sequential auto-assigned PINs.
          </p>

          <label className="um-field-label">Role
            <select className="um-select" value={genRole} onChange={e => setGenRole(e.target.value as Role)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          <label className="um-field-label">Login method
            <select className="um-select" value={genMethod} onChange={e => setGenMethod(e.target.value as LoginMethod)}>
              <option value="pin">PIN (auto-assigned)</option>
              <option value="list">Select from list</option>
            </select>
          </label>

          <label className="um-field-label">Count (1–100)
            <input className="um-input" type="number" min={1} max={100} value={genCount}
              onChange={e => setGenCount(e.target.value)} />
          </label>

          <label className="um-field-label">
            Name prefix (optional, defaults to role)
            <input className="um-input" placeholder="e.g. Garçom" value={genPrefix}
              onChange={e => setGenPrefix(e.target.value)} />
          </label>

          <button className="um-btn-primary" onClick={handleAutoGenerate} disabled={genLoading}>
            {genLoading ? 'Generating…' : 'Generate'}
          </button>

          {genResult && genResult.length > 0 && (
            <div className="um-gen-result">
              <p className="um-success-inline">✓ {genResult.length} user(s) created</p>
              {genResult[0]?.pin !== undefined && (
                <table className="um-table um-gen-table">
                  <thead><tr><th>Name</th><th>PIN</th></tr></thead>
                  <tbody>
                    {genResult.map((u, i) => (
                      <tr key={i}><td>{u.name}</td><td className="um-pin-cell">{u.pin}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
