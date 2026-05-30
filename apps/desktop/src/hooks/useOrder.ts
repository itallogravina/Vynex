import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Order,
  OrderItem,
  MenuItem,
  OrderRoutingMode,
  RoutingZone,
  AddOrderItemRequest,
} from '@vynex/shared'
import { useApi } from '../lib/api'

export type OrderItemWithStatus = OrderItem & {
  menu_item: MenuItem
  live_status?: string
}

export function useOrder() {
  const api = useApi()
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
        const { data: newOrder } = await api.post<Order>('/orders', { table_id, routing_mode })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api.serverUrl, api.token]
  )

  const addItem = useCallback(
    async (menu_item: MenuItem, quantity: number, notes?: string) => {
      if (!order) throw new Error('No order created')
      setLoading(true)
      setError(null)

      try {
        const body: AddOrderItemRequest = { menu_item_id: menu_item.id, quantity, notes }
        const { data: newItem } = await api.post<OrderItem>(`/orders/${order.id}/items`, body)
        const itemWithStatus: OrderItemWithStatus = { ...newItem, menu_item }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order, api.serverUrl, api.token]
  )

  const confirmOrder = useCallback(async () => {
    return order
  }, [order])

  const updateItemStatuses = useCallback(() => {
    setItems(prev =>
      prev.map(item => {
        const queueItem = queueItemsRef.current.get(item.id)
        return { ...item, live_status: queueItem?.status || item.status }
      })
    )
  }, [])

  const subscribeToQueues = useCallback((_newOrder: Order) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close()
    }

    const ws = new WebSocket(api.buildWsUrl())

    ws.onopen = () => {
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
          msg.items.forEach((item: any) => { queueItemsRef.current.set(item.id, item) })
          updateItemStatuses()
        } else if (msg.type === 'item:status_changed') {
          const existing = queueItemsRef.current.get(msg.item_id)
          if (existing) { existing.status = msg.new_status; updateItemStatuses() }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.serverUrl, api.token, updateItemStatuses])

  useEffect(() => {
    if (order) subscribeToQueues(order)
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close()
    }
  }, [order, subscribeToQueues])

  return { order, items, loading, error, createOrder, addItem, confirmOrder }
}
