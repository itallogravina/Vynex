import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Order,
  OrderItem,
  MenuItem,
  OrderRoutingMode,
  Priority,
  RoutingZone,
  AddOrderItemRequest,
  ConfirmRoutingResponse,
} from '@vynex/shared'
import { useServerUrl } from '../context/ServerUrlContext'

export type OrderItemWithStatus = OrderItem & {
  menu_item: MenuItem
  live_status?: string
}

export function useOrder() {
  const { serverUrl, wsUrl } = useServerUrl()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItemWithStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const queueItemsRef = useRef<Map<string, any>>(new Map())

  const createOrder = useCallback(
    async (table_id: string, routing_mode: OrderRoutingMode) => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${serverUrl}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_id, routing_mode }),
        })

        if (!response.ok) {
          throw new Error('Failed to create order')
        }

        const newOrder = (await response.json()) as Order
        setOrder(newOrder)
        setItems([])
        return newOrder
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [serverUrl]
  )

  const addItem = useCallback(
    async (menu_item: MenuItem, quantity: number, notes?: string, priority?: Priority, variations?: string[]) => {
      if (!order) throw new Error('No order created')
      setLoading(true)
      setError(null)

      try {
        const body: AddOrderItemRequest = { menu_item_id: menu_item.id, quantity }
        if (notes) body.notes = notes
        if (priority) body.priority = priority
        if (variations && variations.length > 0) body.variations = variations
        const response = await fetch(`${serverUrl}/orders/${order.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          throw new Error('Failed to add item')
        }

        const newItem = (await response.json()) as OrderItem
        const itemWithStatus: OrderItemWithStatus = {
          ...newItem,
          menu_item,
        }

        setItems(prev => [...prev, itemWithStatus])

        return itemWithStatus
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [order, serverUrl]
  )

  const refreshItems = useCallback(async () => {
    if (!order) return
    const res = await fetch(`${serverUrl}/orders/${order.id}`)
    if (res.ok) {
      const data = await res.json()
      setItems(
        (data.items as (OrderItem & { menu_item: MenuItem })[]).map(i => ({
          ...i,
          live_status: queueItemsRef.current.get(i.id)?.status ?? i.status,
        }))
      )
    }
  }, [order, serverUrl])

  const confirmOrder = useCallback(async (): Promise<ConfirmRoutingResponse> => {
    if (!order) throw new Error('No order')
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${serverUrl}/orders/${order.id}/confirm-routing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to confirm routing')
      }
      const result = await response.json()
      await refreshItems()
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [order, serverUrl, refreshItems])

  const cancelOrder = useCallback(async (): Promise<void> => {
    if (!order) throw new Error('No order')
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${serverUrl}/orders/${order.id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to cancel order')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [order, serverUrl])

  const subscribeToQueues = useCallback((_newOrder: Order) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close()
    }

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      // Subscribe to all routing zones to track items
      Object.values(RoutingZone).forEach(zone => {
        if (zone !== RoutingZone.TABLE) {
          ws.send(JSON.stringify({ action: 'subscribe', routing_zone: zone }))
        }
      })
    }

    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'queue:snapshot') {
          // Store all items from queue snapshot
          msg.items.forEach((item: any) => {
            queueItemsRef.current.set(item.id, item)
          })
          updateItemStatuses()
        } else if (msg.type === 'item:status_changed') {
          // Update status for specific item
          const existing = queueItemsRef.current.get(msg.item_id)
          if (existing) {
            existing.status = msg.new_status
            updateItemStatuses()
          }
        }
      } catch (err) {
        console.error('WebSocket message error:', err)
      }
    }

    ws.onerror = err => {
      console.error('WebSocket error:', err)
      setError('WebSocket connection failed')
    }

    wsRef.current = ws
  }, [wsUrl])

  const updateItemStatuses = useCallback(() => {
    setItems(prev =>
      prev.map(item => {
        const queueItem = queueItemsRef.current.get(item.id)
        return {
          ...item,
          live_status: queueItem?.status || item.status,
        }
      })
    )
  }, [])

  useEffect(() => {
    if (order) {
      subscribeToQueues(order)
    }

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close()
      }
    }
  }, [order, subscribeToQueues])

  const unroutedCount = items.filter(i => !i.routed_at).length

  return {
    order,
    items,
    loading,
    error,
    createOrder,
    addItem,
    confirmOrder,
    cancelOrder,
    refreshItems,
    unroutedCount,
  }
}
