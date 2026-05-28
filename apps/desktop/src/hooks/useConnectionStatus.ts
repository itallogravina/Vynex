import { useEffect, useState } from 'react'
import { useServerUrl } from '../context/ServerUrlContext'

export type ConnectionStatus = 'checking' | 'connected' | 'disconnected'

export type ServerInfo = {
  version: string
  db: 'local' | 'replica'
} | null

const POLL_INTERVAL_MS = 5000
const TIMEOUT_MS = 3000

export function useConnectionStatus(): {
  status: ConnectionStatus
  serverInfo: ServerInfo
} {
  const { serverUrl } = useServerUrl()
  const [status, setStatus] = useState<ConnectionStatus>('checking')
  const [serverInfo, setServerInfo] = useState<ServerInfo>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch(`${serverUrl}/health`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setStatus('connected')
          setServerInfo({ version: data.version, db: data.db })
        } else {
          setStatus('disconnected')
          setServerInfo(null)
        }
      } catch {
        if (!cancelled) {
          setStatus('disconnected')
          setServerInfo(null)
        }
      }
    }

    setStatus('checking')
    setServerInfo(null)
    check()
    const interval = setInterval(check, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [serverUrl])

  return { status, serverInfo }
}
