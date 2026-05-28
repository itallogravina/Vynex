import { createContext, useContext, useState, ReactNode } from 'react'

const STORAGE_KEY = 'vynex_server_url'
const DEFAULT_URL = 'http://localhost:3000'

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function toWsUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, 'ws') + '/ws'
}

type ServerUrlContextValue = {
  serverUrl: string
  wsUrl: string
  setServerUrl: (url: string) => void
}

const ServerUrlContext = createContext<ServerUrlContextValue>({
  serverUrl: DEFAULT_URL,
  wsUrl: toWsUrl(DEFAULT_URL),
  setServerUrl: () => {},
})

export function ServerUrlProvider({ children }: { children: ReactNode }) {
  const [serverUrl, setServerUrlState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? normalizeUrl(stored) : DEFAULT_URL
  })

  function setServerUrl(url: string) {
    const normalized = normalizeUrl(url)
    localStorage.setItem(STORAGE_KEY, normalized)
    setServerUrlState(normalized)
  }

  return (
    <ServerUrlContext.Provider
      value={{ serverUrl, wsUrl: toWsUrl(serverUrl), setServerUrl }}
    >
      {children}
    </ServerUrlContext.Provider>
  )
}

export function useServerUrl(): ServerUrlContextValue {
  return useContext(ServerUrlContext)
}
