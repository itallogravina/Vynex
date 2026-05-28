import 'dotenv/config'
import Fastify from 'fastify'
import FastifyWebSocket from '@fastify/websocket'
import { VYNEX_VERSION } from '@vynex/shared'
import { initializeDatabase, isReplicaMode } from './db/init'
import { syncNow, startSync } from './db/sync'
import { registerOrderRoutes } from './routes/orders'
import { registerTableRoutes } from './routes/tables'
import { registerMenuRoutes } from './routes/menu'
import { registerWebSocketHandler } from './ws/handler'

async function main() {
  const dbPath = process.env['DB_PATH'] || process.env['DATABASE_PATH'] || './vynex.db'
  await initializeDatabase(dbPath)

  if (isReplicaMode()) {
    await syncNow()
    const intervalSeconds = Number(process.env['SYNC_INTERVAL_SECONDS'] ?? 60)
    startSync(intervalSeconds)
  }

  const server = Fastify({ logger: true })

  await server.register(FastifyWebSocket)

  server.get('/health', async () => {
    return {
      status: 'ok',
      version: VYNEX_VERSION,
      db: isReplicaMode() ? 'replica' : 'local',
    }
  })

  // TODO: remove before production
  server.post('/admin/sync', async (request, reply) => {
    if (!isReplicaMode()) {
      return reply.status(400).send({ error: 'Not in replica mode — no Turso credentials configured' })
    }
    await syncNow()
    return { ok: true }
  })

  await registerWebSocketHandler(server)
  await registerOrderRoutes(server)
  await registerTableRoutes(server)
  await registerMenuRoutes(server)

  const port = Number(process.env['PORT'] ?? 3000)

  server.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      server.log.error(err)
      process.exit(1)
    }
    server.log.info(`Vynex v${VYNEX_VERSION} listening on ${address}`)
  })
}

main().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
