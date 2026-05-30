import { useMemo } from 'react'
import { useServerUrl } from '../context/ServerUrlContext'
import { useAuth } from '../context/AuthContext'

export function useApi() {
  const { serverUrl } = useServerUrl()
  const { token } = useAuth()

  return useMemo(() => {
    function headers(extra?: Record<string, string>): Record<string, string> {
      const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra }
      if (token) h['X-Session-Token'] = token
      return h
    }

    async function get<T>(path: string): Promise<T> {
      const res = await fetch(`${serverUrl}${path}`, { headers: headers() })
      if (!res.ok) throw Object.assign(new Error(`GET ${path} failed`), { status: res.status })
      return res.json() as Promise<T>
    }

    async function post<T>(path: string, body?: unknown): Promise<{ data: T; status: number }> {
      const init: RequestInit = { method: 'POST', headers: headers() }
      if (body !== undefined) init.body = JSON.stringify(body)
      const res = await fetch(`${serverUrl}${path}`, init)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw Object.assign(new Error((data as any)?.error ?? `POST ${path} failed`), { status: res.status, data })
      return { data: data as T, status: res.status }
    }

    async function patch<T>(path: string, body?: unknown): Promise<T> {
      const init: RequestInit = { method: 'PATCH', headers: headers() }
      if (body !== undefined) init.body = JSON.stringify(body)
      const res = await fetch(`${serverUrl}${path}`, init)
      if (!res.ok) throw Object.assign(new Error(`PATCH ${path} failed`), { status: res.status })
      return res.json() as Promise<T>
    }

    async function del(path: string): Promise<void> {
      const res = await fetch(`${serverUrl}${path}`, { method: 'DELETE', headers: headers() })
      if (!res.ok && res.status !== 204) throw Object.assign(new Error(`DELETE ${path} failed`), { status: res.status })
    }

    async function getBlob(path: string): Promise<Blob> {
      const res = await fetch(`${serverUrl}${path}`, { headers: headers() })
      if (!res.ok) throw Object.assign(new Error(`GET ${path} failed`), { status: res.status })
      return res.blob()
    }

    function buildWsUrl(zones?: string): string {
      const base = serverUrl.replace(/^http/, 'ws')
      const url = new URL(`${base}/ws`)
      if (token) url.searchParams.set('token', token)
      if (zones) url.searchParams.set('zones', zones)
      return url.toString()
    }

    return { get, post, patch, del, getBlob, buildWsUrl, serverUrl, token }
  }, [serverUrl, token])
}
