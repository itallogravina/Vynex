import { useState, useEffect, useCallback } from 'react'
import * as SecureStore from 'expo-secure-store'

const STORAGE_KEY = 'vynex_server_url'

export function useServerUrl(): [string | null, (url: string) => Promise<void>, boolean] {
  const [serverUrl, setServerUrlState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then(val => setServerUrlState(val))
      .finally(() => setLoading(false))
  }, [])

  const setServerUrl = useCallback(async (url: string) => {
    if (!url) {
      await SecureStore.deleteItemAsync(STORAGE_KEY)
      setServerUrlState(null)
      return
    }
    const clean = url.replace(/\/$/, '')
    await SecureStore.setItemAsync(STORAGE_KEY, clean)
    setServerUrlState(clean)
  }, [])

  return [serverUrl, setServerUrl, loading]
}
