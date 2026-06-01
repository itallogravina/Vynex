import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { OfflineOrderBundle } from '@vynex/shared'

const STORAGE_KEY = 'vynex_offline_queue'
const MAX_PER_USER = 10

async function read(): Promise<OfflineOrderBundle[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    return JSON.parse(raw ?? '[]')
  } catch {
    return []
  }
}

async function save(bundles: OfflineOrderBundle[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bundles))
}

export function useOfflineQueue(serverUrl: string, userId: string | undefined) {
  const [queueCount, setQueueCount] = useState(0)
  const [isFlushing, setIsFlushing] = useState(false)

  const refresh = useCallback(async () => {
    const all = await read()
    setQueueCount(userId ? all.filter(b => b.user_id === userId).length : 0)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  const queueOrder = useCallback(async (bundle: Omit<OfflineOrderBundle, 'id' | 'queued_at' | 'attempt'>): Promise<boolean> => {
    const all = await read()
    const userCount = all.filter(b => b.user_id === bundle.user_id).length
    if (userCount >= MAX_PER_USER) return false
    const entry: OfflineOrderBundle = {
      ...bundle,
      id: Math.random().toString(36).slice(2),
      queued_at: new Date().toISOString(),
      attempt: 0,
    }
    await save([...all, entry])
    refresh()
    return true
  }, [refresh])

  const flush = useCallback(async () => {
    const all = await read()
    if (all.length === 0) return
    setIsFlushing(true)

    for (const bundle of all) {
      try {
        const orderRes = await fetch(`${serverUrl}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_id: bundle.table_id, routing_mode: bundle.routing_mode }),
        })
        if (!orderRes.ok) throw new Error('order creation failed')
        const { id: orderId } = await orderRes.json()

        for (const item of bundle.items) {
          const itemRes = await fetch(`${serverUrl}/orders/${orderId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          })
          if (!itemRes.ok) throw new Error('item add failed')
        }

        const current = await read()
        await save(current.filter(b => b.id !== bundle.id))
        refresh()
      } catch {
        const current = await read()
        const updated = current.map(b =>
          b.id === bundle.id ? { ...b, attempt: b.attempt + 1 } : b
        )
        await save(updated)
        const delay = Math.min(5000 * Math.pow(2, bundle.attempt), 300_000)
        setTimeout(flush, delay)
      }
    }

    setIsFlushing(false)
  }, [serverUrl, refresh])

  return { queueOrder, queueCount, isFlushing, flush }
}
