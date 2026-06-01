import { useState, useEffect, useRef, useCallback } from 'react'
import type { TableFloorMapItem } from '@vynex/shared'
import { useAuth } from '../context/AuthContext'
import { useServerUrl } from '../context/ServerUrlContext'
import { useTranslation } from '../context/I18nContext'
import '../styles/FloorMapScreen.css'

const GRID = 20
const snap = (v: number) => Math.round(v / GRID) * GRID

export default function FloorMapScreen() {
  const { serverUrl } = useServerUrl()
  const { user } = useAuth()
  const { t } = useTranslation()
  const isEditor = user?.role === 'owner' || user?.role === 'manager'

  const [tables, setTables] = useState<TableFloorMapItem[]>([])
  const [floor, setFloor] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const dragRef = useRef<{ tableId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const floors = [...new Set(tables.map(t => t.floor))].sort()
  if (!floors.includes(0)) floors.unshift(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/tables/floor-map`)
      if (!res.ok) throw new Error('Failed to load floor map')
      setTables(await res.json())
    } catch {
      setError('Could not load floor map')
    }
  }, [serverUrl])

  useEffect(() => { load() }, [load])

  const visibleTables = tables.filter(t => t.floor === floor)

  const onMouseDown = (e: React.MouseEvent, table: TableFloorMapItem) => {
    if (!isEditor) return
    e.preventDefault()
    dragRef.current = {
      tableId: table.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: table.pos_x,
      origY: table.pos_y,
    }
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    setTables(prev => prev.map(t =>
      t.id === d.tableId
        ? { ...t, pos_x: snap(d.origX + dx), pos_y: snap(d.origY + dy) }
        : t
    ))
  }, [])

  const onMouseUp = useCallback(async () => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    const table = tables.find(t => t.id === d.tableId)
    if (!table) return
    try {
      await fetch(`${serverUrl}/tables/${table.id}/position`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pos_x: table.pos_x, pos_y: table.pos_y, floor: table.floor }),
      })
    } catch {
      setError('Failed to save position')
      load()
    }
  }, [tables, serverUrl, load])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  return (
    <div className="floor-map-screen">
      <header className="screen-header">
        <h1>{isEditor ? t('tables.editor') : t('nav.floorMap')}</h1>
        <div className="floor-tabs">
          {floors.map(f => (
            <button
              key={f}
              className={`floor-tab ${floor === f ? 'active' : ''}`}
              onClick={() => setFloor(f)}
            >
              {f === 0 ? 'Piso 1' : `Piso ${f + 1}`}
            </button>
          ))}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="floor-map-canvas">
        {visibleTables.map(table => (
          <div
            key={table.id}
            className={`floor-table floor-table--${table.status}${isEditor ? ' floor-table--draggable' : ''}`}
            style={{ left: table.pos_x, top: table.pos_y }}
            onMouseDown={(e) => onMouseDown(e, table)}
            title={table.status === 'occupied' ? t('tables.occupied') : t('tables.available')}
          >
            <span className="floor-table-name">{table.name}</span>
            <span className="floor-table-seats">{table.seats}</span>
            {table.status === 'occupied' && table.opened_at && (
              <span className="floor-table-time">
                {Math.floor((Date.now() - new Date(table.opened_at).getTime()) / 60000)}m
              </span>
            )}
          </div>
        ))}
      </div>

      {isEditor && (
        <p className="floor-map-hint">Arraste as mesas para reposicioná-las. A posição é salva automaticamente.</p>
      )}
    </div>
  )
}
