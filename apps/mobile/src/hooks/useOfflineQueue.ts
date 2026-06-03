import { useCallback, useEffect, useRef, useState } from 'react'
import * as FileSystem from 'expo-file-system/legacy'
import type { OfflineOrderBundle } from '@vynex/shared'
import { useAuth } from '../context/AuthContext'

const QUEUE_FILE = FileSystem.documentDirectory + 'vynex_offline_queue.json'
const MAX_PER_USER = 10

async function read(): Promise<OfflineOrderBundle[]> {
  try {
    const info = await FileSystem.getInfoAsync(QUEUE_FILE)
    if (!info.exists) return []
    const raw = await FileSystem.readAsStringAsync(QUEUE_FILE)
    return JSON.parse(raw) ?? []
  } catch {
    return []
  }
}

async function write(bundles: OfflineOrderBundle[]): Promise<void> {
  await FileSystem.writeAsStringAsync(QUEUE_FILE, JSON.stringify(bundles))
}

async function clear(): Promise<void> {
  await FileSystem.deleteAsync(QUEUE_FILE, { idempotent: true })
}

export function useOfflineQueue(serverUrl: string, userId: string | undefined) {
  const { token } = useAuth()
  const tokenRef = useRef(token)
  useEffect(() => { tokenRef.current = token }, [token])

  const [queueCount, setQueueCount] = useState(0)
  const [isFlushing, setIsFlushing] = useState(false)
  const isFlushingRef = useRef(false)

  const refresh = useCallback(async () => {
    const all = await read()
    setQueueCount(userId ? all.filter(b => b.user_id === userId).length : all.length)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  const queueOrder = useCallback(async (bundle: Omit<OfflineOrderBundle, 'id' | 'queued_at' | 'attempt'>): Promise<boolean> => {
    const all = await read()
    const userCount = userId ? all.filter(b => b.user_id === bundle.user_id).length : all.length
    if (userCount >= MAX_PER_USER) return false
    const entry: OfflineOrderBundle = {
      ...bundle,
      id: Math.random().toString(36).slice(2),
      queued_at: new Date().toISOString(),
      attempt: 0,
    }
    await write([...all, entry])
    refresh()
    return true
  }, [userId, refresh])

  const flush = useCallback(async () => {
    console.log('[offlineQueue] flush() called')
    if (isFlushingRef.current) {
      console.log('[offlineQueue] flush() skipped — already flushing')
      return
    }
    const all = await read()
    if (all.length === 0) {
      console.log('[offlineQueue] flush() skipped — queue empty')
      return
    }
    const currentToken = tokenRef.current
    console.log(`[offlineQueue] flush — ${all.length} bundle(s), token=${currentToken ? 'ok' : 'MISSING'}`)
    isFlushingRef.current = true
    setIsFlushing(true)
    try {
      const authHeader: Record<string, string> = currentToken ? { Authorization: `Bearer ${currentToken}` } : {}
      const sorted = [...all].sort((a, b) => a.queued_at.localeCompare(b.queued_at))
      for (const bundle of sorted) {
        try {
          let orderId: string
          const orderRes = await fetch(`${serverUrl}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({ table_id: bundle.table_id, routing_mode: bundle.routing_mode }),
          })
          if (orderRes.status === 409) {
            const openRes = await fetch(`${serverUrl}/orders/open`, { headers: authHeader })
            const openOrders: Array<{ id: string; table_id: string }> = openRes.ok ? await openRes.json() : []
            const existing = openOrders.find(o => o.table_id === bundle.table_id)
            if (!existing) throw new Error(`409 but no open order for table ${bundle.table_id}`)
            orderId = existing.id
            console.log(`[offlineQueue] 409 — reusing existing order ${orderId}`)
          } else if (!orderRes.ok) {
            const body = await orderRes.json().catch(() => ({}))
            console.error(`[offlineQueue] POST /orders ${orderRes.status}`, body)
            throw new Error(`order creation failed (${orderRes.status})`)
          } else {
            orderId = (await orderRes.json()).id
            console.log(`[offlineQueue] order created: ${orderId}`)
          }

          for (const item of bundle.items) {
            const itemRes = await fetch(`${serverUrl}/orders/${orderId}/items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeader },
              body: JSON.stringify(item),
            })
            if (!itemRes.ok) {
              const body = await itemRes.json().catch(() => ({}))
              console.error(`[offlineQueue] POST /orders/${orderId}/items ${itemRes.status}`, body)
              throw new Error(`item add failed (${itemRes.status})`)
            }
          }

          const confirmRes = await fetch(`${serverUrl}/orders/${orderId}/confirm-routing`, {
            method: 'POST',
            headers: authHeader,
          })
          if (!confirmRes.ok) {
            const body = await confirmRes.json().catch(() => ({}))
            console.error(`[offlineQueue] confirm-routing failed (${confirmRes.status})`, body)
            throw new Error(`confirm-routing failed (${confirmRes.status})`)
          }
          console.log(`[offlineQueue] bundle ${bundle.id} routed`)
          const current = await read()
          await write(current.filter(b => b.id !== bundle.id))
          refresh()
        } catch (err) {
          console.error(`[offlineQueue] bundle ${bundle.id} failed (attempt ${bundle.attempt}):`, err)
          const current = await read()
          await write(current.map(b => b.id === bundle.id ? { ...b, attempt: b.attempt + 1 } : b))
          // no setTimeout retry — WS onopen re-triggers flush() on next reconnect
        }
      }
    } finally {
      isFlushingRef.current = false
      setIsFlushing(false)
    }
  }, [serverUrl, refresh])

  useEffect(() => {
    if (token) flush()
  }, [token])

  return { queueOrder, queueCount, isFlushing, flush, clear }
}
