import { getClient, isReplicaMode } from './init'

let syncTimer: NodeJS.Timeout | null = null

export async function syncNow(): Promise<void> {
  if (!isReplicaMode()) return

  try {
    await getClient().sync()
    console.log(`[sync] synced at ${new Date().toISOString()}`)
  } catch (err) {
    console.error('[sync] sync failed:', err)
  }
}

export function startSync(intervalSeconds: number): void {
  if (!isReplicaMode()) {
    console.log('[sync] local-only mode — background sync disabled')
    return
  }

  if (syncTimer) clearInterval(syncTimer)

  syncTimer = setInterval(() => {
    syncNow()
  }, intervalSeconds * 1000)

  console.log(`[sync] background sync started — interval: ${intervalSeconds}s`)
}

export function stopSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}
