import { useCallback, useEffect, useState } from 'react'
import type { OfflineOrderBundle } from '@vynex/shared'
import { useAuth } from '../context/AuthContext'

const STORAGE_KEY = 'vynex_offline_queue'
const MAX_PER_USER = 10

function read(): OfflineOrderBundle[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function save(bundles: OfflineOrderBundle[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bundles))
}

export function useOfflineQueue(serverUrl: string, userId: string | undefined) {
  const { token } = useAuth()
  const [queueCount, setQueueCount] = useState(0)
  const [isFlushing, setIsFlushing] = useState(false)

  const refresh = useCallback(() => {
    const all = read()
    setQueueCount(userId ? all.filter(b => b.user_id === userId).length : 0)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  const queueOrder = useCallback((bundle: Omit<OfflineOrderBundle, 'id' | 'queued_at' | 'attempt'>): boolean => {
    const all = read()
    const userCount = all.filter(b => b.user_id === bundle.user_id).length
    if (userCount >= MAX_PER_USER) return false
    const entry: OfflineOrderBundle = {
      ...bundle,
      id: crypto.randomUUID(),
      queued_at: new Date().toISOString(),
      attempt: 0,
    }
    save([...all, entry])
    refresh()
    return true
  }, [refresh])

  const flush = useCallback(async () => {
    const all = read()
    if (all.length === 0) return
    console.log(`[offlineQueue] flush() triggered — ${all.length} bundle(s), token=${token ? 'present' : 'MISSING'}`)
    setIsFlushing(true)

    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
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
          console.error(`[offlineQueue] POST /orders failed: ${orderRes.status}`, body)
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
            console.error(`[offlineQueue] POST /orders/${orderId}/items failed: ${itemRes.status}`, body)
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
        save(read().filter(b => b.id !== bundle.id))
        refresh()
      } catch (err) {
        console.error(`[offlineQueue] bundle ${bundle.id} failed (attempt ${bundle.attempt}):`, err)
        const current = read()
        save(current.map(b => b.id === bundle.id ? { ...b, attempt: b.attempt + 1 } : b))
        // no setTimeout retry — useConnectionStatus flip to 'connected' re-triggers flush()
      }
    }

    setIsFlushing(false)
  }, [serverUrl, refresh, token])

  return { queueOrder, queueCount, isFlushing, flush }
}
