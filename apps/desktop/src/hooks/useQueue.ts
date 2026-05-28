import { useEffect, useState, useRef } from 'react'
import { RoutingZone, QueueItem, ItemStatusChangedEvent, QueueSnapshotEvent } from '@vynex/shared'
import { useServerUrl } from '../context/ServerUrlContext'

type QueueEvent = ItemStatusChangedEvent | QueueSnapshotEvent

interface UseQueueResult {
  items: QueueItem[]
  isConnected: boolean
  error: string | undefined
}

export function useQueue(zone: RoutingZone): UseQueueResult {
  const { wsUrl } = useServerUrl()
  const [items, setItems] = useState<QueueItem[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string>()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const url = new URL(wsUrl)
    url.searchParams.set('zones', zone)

    const ws = new WebSocket(url.toString())

    ws.onopen = () => {
      setIsConnected(true)
      setError(undefined)
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as QueueEvent

        if (data.type === 'queue:snapshot' && data.routing_zone === zone) {
          setItems(data.items)
        } else if (data.type === 'item:status_changed' && data.routing_zone === zone) {
          setItems(prev =>
            prev.map(item =>
              item.id === data.item_id ? { ...item, status: data.new_status } : item
            )
          )
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err)
      }
    }

    ws.onerror = () => {
      setError('WebSocket connection error')
      setIsConnected(false)
    }

    ws.onclose = () => {
      setIsConnected(false)
    }

    wsRef.current = ws

    return () => {
      ws.close()
    }
  }, [zone, wsUrl])

  return { items, isConnected, error }
}
