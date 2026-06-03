import { useEffect, useState, useRef } from 'react'
import { RoutingZone, QueueItem, ItemStatusChangedEvent, QueueSnapshotEvent } from '@vynex/shared'
import { useServerUrl } from '../context/ServerUrlContext'

type QueueEvent = ItemStatusChangedEvent | QueueSnapshotEvent

interface UseQueueResult {
  items: QueueItem[]
  isConnected: boolean
  error: string | undefined
  wsLogs: string[]
}

const STORAGE_KEY = (z: string) => `vynex_queue_cache_${z}`

export function useQueue(zone: RoutingZone): UseQueueResult {
  const { wsUrl } = useServerUrl()
  const [items, setItems] = useState<QueueItem[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY(zone))
      return cached ? (JSON.parse(cached) as QueueItem[]) : []
    } catch {
      return []
    }
  })
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string>()
  const [wsLogs, setWsLogs] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  function addLog(msg: string) {
    const ts = new Date().toLocaleTimeString('pt-BR', { hour12: false })
    setWsLogs(prev => [...prev.slice(-4), `${ts} ${msg}`])
  }

  useEffect(() => {
    let mounted = true
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let ws: WebSocket | null = null

    function connect() {
      const url = new URL(wsUrl)
      url.searchParams.set('zones', zone)
      addLog(`connecting…`)
      ws = new WebSocket(url.toString())
      wsRef.current = ws

      ws.onopen = () => {
        if (!mounted) return
        addLog(`connected`)
        setIsConnected(true)
        setError(undefined)
      }

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as QueueEvent

          if (data.type === 'queue:snapshot' && data.routing_zone === zone) {
            setItems(data.items)
            localStorage.setItem(STORAGE_KEY(zone), JSON.stringify(data.items))
          } else if (data.type === 'item:status_changed' && data.routing_zone === zone) {
            setItems(prev => {
              const updated = prev.map(item =>
                item.id === data.item_id ? { ...item, status: data.new_status } : item
              )
              localStorage.setItem(STORAGE_KEY(zone), JSON.stringify(updated))
              return updated
            })
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err)
        }
      }

      ws.onerror = () => {
        if (!mounted) return
        addLog(`onerror`)
        setError('WebSocket connection error')
        setIsConnected(false)
      }

      ws.onclose = (ev) => {
        if (!mounted) return
        addLog(`onclose code=${ev.code} — retry in 2s`)
        setIsConnected(false)
        reconnectTimer = setTimeout(connect, 2000)
      }
    }

    connect()

    return () => {
      mounted = false
      if (reconnectTimer !== null) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [zone, wsUrl])

  return { items, isConnected, error, wsLogs }
}
