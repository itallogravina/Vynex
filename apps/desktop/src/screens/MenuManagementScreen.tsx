import { useState, useEffect, useCallback } from 'react'
import { CategoryWithItems, MenuItem, RoutingZone } from '@vynex/shared'
import '../styles/TableManagement.css'
import '../styles/MenuManagement.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const ZONE_LABELS: Record<string, string> = {
  kitchen: 'Kitchen',
  bar: 'Bar',
  cashier: 'Cashier',
  table: 'Table',
}

const ZONE_COLORS: Record<string, string> = {
  kitchen: '#e67e22',
  bar: '#8e44ad',
  cashier: '#16a085',
  table: '#2980b9',
}

type ItemForm = { name: string; price: string; routing_zone: RoutingZone }
type CatForm = { name: string; routing_zone: RoutingZone }
type EditItem = { id: string } & ItemForm

export default function MenuManagementScreen() {
  const [categories, setCategories] = useState<CategoryWithItems[]>([])
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Item form state
  const [showItemForm, setShowItemForm] = useState(false)
  const [editItem, setEditItem] = useState<EditItem | null>(null)
  const [itemForm, setItemForm] = useState<ItemForm>({
    name: '',
    price: '',
    routing_zone: RoutingZone.KITCHEN,
  })
  const [savingItem, setSavingItem] = useState(false)

  // Category form state
  const [showCatForm, setShowCatForm] = useState(false)
  const [catForm, setCatForm] = useState<CatForm>({
    name: '',
    routing_zone: RoutingZone.KITCHEN,
  })
  const [savingCat, setSavingCat] = useState(false)

  const [opError, setOpError] = useState<string | null>(null)

  const fetchCategories = useCallback(() => {
    setLoading(true)
    fetch(`${API_URL}/categories`)
      .then(r => r.json())
      .then((data: CategoryWithItems[]) => {
        setCategories(data)
        if (data.length > 0 && !selectedCatId) {
          setSelectedCatId(data[0]?.id ?? null)
        }
      })
      .catch(err => console.error('Failed to fetch categories:', err))
      .finally(() => setLoading(false))
  }, [selectedCatId])

  useEffect(() => {
    fetchCategories()
  }, [])

  const selectedCat = categories.find(c => c.id === selectedCatId) ?? null

  // ---- Category actions ----

  const handleAddCategory = async () => {
    if (!catForm.name.trim()) return
    setSavingCat(true)
    setOpError(null)
    try {
      const res = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catForm.name.trim(), routing_zone: catForm.routing_zone }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create category')
      }
      setShowCatForm(false)
      setCatForm({ name: '', routing_zone: RoutingZone.KITCHEN })
      fetchCategories()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Failed to create category')
    } finally {
      setSavingCat(false)
    }
  }

  const handleDeleteCategory = async (catId: string) => {
    const cat = categories.find(c => c.id === catId)
    if (cat && cat.items.length > 0) {
      setOpError(`Delete all items in "${cat.name}" first`)
      return
    }
    try {
      const res = await fetch(`${API_URL}/categories/${catId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete category')
      }
      if (selectedCatId === catId) setSelectedCatId(null)
      fetchCategories()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Failed to delete category')
    }
  }

  // ---- Item actions ----

  const openAddItem = () => {
    setEditItem(null)
    setItemForm({
      name: '',
      price: '',
      routing_zone: (selectedCat?.routing_zone as RoutingZone) ?? RoutingZone.KITCHEN,
    })
    setShowItemForm(true)
  }

  const openEditItem = (item: MenuItem) => {
    setEditItem({
      id: item.id,
      name: item.name,
      price: String(item.price),
      routing_zone: item.routing_zone,
    })
    setItemForm({ name: item.name, price: String(item.price), routing_zone: item.routing_zone })
    setShowItemForm(true)
  }

  const closeItemForm = () => {
    setShowItemForm(false)
    setEditItem(null)
  }

  const handleSaveItem = async () => {
    const price = parseFloat(itemForm.price)
    if (!itemForm.name.trim() || isNaN(price) || price < 0) return

    setSavingItem(true)
    setOpError(null)
    try {
      const res = editItem
        ? await fetch(`${API_URL}/menu-items/${editItem.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: itemForm.name.trim(),
              price,
              routing_zone: itemForm.routing_zone,
            }),
          })
        : await fetch(`${API_URL}/menu-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category_id: selectedCatId,
              name: itemForm.name.trim(),
              price,
              routing_zone: itemForm.routing_zone,
            }),
          })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save item')
      }
      closeItemForm()
      fetchCategories()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Failed to save item')
    } finally {
      setSavingItem(false)
    }
  }

  const handleToggleItem = async (item: MenuItem) => {
    try {
      const res = await fetch(`${API_URL}/menu-items/${item.id}/toggle`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Failed to toggle item')
      fetchCategories()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Failed to toggle item')
    }
  }

  const handleDeleteItem = async (item: MenuItem) => {
    try {
      const res = await fetch(`${API_URL}/menu-items/${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete item')
      }
      fetchCategories()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Failed to delete item')
    }
  }

  return (
    <div className="mgmt-screen menu-mgmt">
      <header className="mgmt-header">
        <h1>Menu Management</h1>
      </header>

      {opError && (
        <div className="mgmt-error" onClick={() => setOpError(null)}>
          {opError} ✕
        </div>
      )}

      {loading ? (
        <div className="mgmt-empty">Loading…</div>
      ) : (
        <div className="menu-layout">
          {/* Categories sidebar */}
          <aside className="categories-panel">
            <div className="panel-title">Categories</div>
            <div className="categories-list">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className={`cat-item ${selectedCatId === cat.id ? 'selected' : ''}`}
                  onClick={() => setSelectedCatId(cat.id)}
                >
                  <div className="cat-info">
                    <span className="cat-name">{cat.name}</span>
                    <span
                      className="cat-zone-badge"
                      style={{ background: ZONE_COLORS[cat.routing_zone] }}
                    >
                      {ZONE_LABELS[cat.routing_zone]}
                    </span>
                  </div>
                  <span className="cat-count">{cat.items.length}</span>
                  <button
                    className="cat-delete-btn"
                    onClick={e => {
                      e.stopPropagation()
                      handleDeleteCategory(cat.id)
                    }}
                    title="Delete category"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {showCatForm ? (
              <div className="cat-add-form">
                <input
                  autoFocus
                  type="text"
                  placeholder="Category name"
                  value={catForm.name}
                  onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                />
                <select
                  value={catForm.routing_zone}
                  onChange={e => setCatForm(f => ({ ...f, routing_zone: e.target.value as RoutingZone }))}
                >
                  {Object.values(RoutingZone).map(z => (
                    <option key={z} value={z}>
                      {ZONE_LABELS[z]}
                    </option>
                  ))}
                </select>
                <div className="cat-form-actions">
                  <button onClick={() => setShowCatForm(false)}>Cancel</button>
                  <button
                    className="btn-confirm"
                    disabled={savingCat || !catForm.name.trim()}
                    onClick={handleAddCategory}
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <button className="cat-add-btn" onClick={() => setShowCatForm(true)}>
                + Add Category
              </button>
            )}
          </aside>

          {/* Items main panel */}
          <main className="items-panel">
            {!selectedCat ? (
              <div className="mgmt-empty">Select a category</div>
            ) : (
              <>
                <div className="items-panel-header">
                  <div>
                    <span className="items-panel-title">{selectedCat.name}</span>
                    <span
                      className="zone-tag"
                      style={{ background: ZONE_COLORS[selectedCat.routing_zone] }}
                    >
                      {ZONE_LABELS[selectedCat.routing_zone]}
                    </span>
                  </div>
                  <button className="btn-add" onClick={openAddItem}>
                    + Add Item
                  </button>
                </div>

                {selectedCat.items.length === 0 ? (
                  <div className="mgmt-empty" style={{ flex: 1 }}>
                    No items in this category
                  </div>
                ) : (
                  <div className="menu-items-list">
                    {selectedCat.items.map(item => (
                      <div key={item.id} className={`menu-item-row ${item.enabled ? '' : 'item-disabled'}`}>
                        <div className="menu-item-info">
                          <span className="menu-item-name">{item.name}</span>
                          <span
                            className="zone-tag zone-tag-sm"
                            style={{ background: ZONE_COLORS[item.routing_zone] }}
                          >
                            {ZONE_LABELS[item.routing_zone]}
                          </span>
                        </div>
                        <span className="menu-item-price">R$ {item.price.toFixed(2)}</span>
                        <div className="menu-item-actions">
                          <button
                            className={`toggle-btn ${item.enabled ? 'enabled' : 'disabled'}`}
                            onClick={() => handleToggleItem(item)}
                            title={item.enabled ? 'Disable item' : 'Enable item'}
                          >
                            {item.enabled ? 'Active' : 'Off'}
                          </button>
                          <button className="btn-icon btn-edit" onClick={() => openEditItem(item)}>
                            Edit
                          </button>
                          <button className="btn-icon btn-delete" onClick={() => handleDeleteItem(item)}>
                            Del
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}

      {/* Item add/edit modal */}
      {showItemForm && (
        <div className="modal-overlay" onClick={closeItemForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editItem ? 'Edit Item' : 'New Item'}</h2>

            <div className="modal-field">
              <label>Name</label>
              <input
                autoFocus
                type="text"
                value={itemForm.name}
                placeholder="e.g. Grilled Chicken"
                onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSaveItem()}
              />
            </div>

            <div className="modal-field">
              <label>Price (R$)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={itemForm.price}
                placeholder="0.00"
                onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSaveItem()}
              />
            </div>

            <div className="modal-field">
              <label>Routes to</label>
              <select
                value={itemForm.routing_zone}
                onChange={e => setItemForm(f => ({ ...f, routing_zone: e.target.value as RoutingZone }))}
              >
                {Object.values(RoutingZone).map(z => (
                  <option key={z} value={z}>
                    {ZONE_LABELS[z]}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeItemForm}>
                Cancel
              </button>
              <button
                className="btn-save"
                disabled={savingItem || !itemForm.name.trim() || itemForm.price === ''}
                onClick={handleSaveItem}
              >
                {savingItem ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
