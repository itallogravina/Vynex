import { useState, useEffect } from 'react'
import { useServerUrl } from '../context/ServerUrlContext'
import type { TableFloorMapItem } from '@vynex/shared'

export function useIdleTables(pollIntervalMs = 60_000) {
  const { serverUrl: apiUrl } = useServerUrl()
  const [idleTables, setIdleTables] = useState<TableFloorMapItem[]>([])

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`${apiUrl}/tables/idle`)
        if (!res.ok) return
        const data: TableFloorMapItem[] = await res.json()
        if (!cancelled) setIdleTables(data)
      } catch {
        // server unreachable — keep previous state
      }
    }
    poll()
    const id = setInterval(poll, pollIntervalMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [apiUrl, pollIntervalMs])

  return idleTables
}
