import 'dotenv/config'
import Fastify from 'fastify'
import FastifyCors from '@fastify/cors'
import FastifyJwt from '@fastify/jwt'
import FastifyWebSocket from '@fastify/websocket'
import { VYNEX_VERSION } from '@vynex/shared'
import { initializeDatabase, isReplicaMode } from './db/init'
import { syncNow, startSync, getLastSyncAt } from './db/sync'
import { registerOrderRoutes } from './routes/orders'
import { registerTableRoutes } from './routes/tables'
import { registerMenuRoutes } from './routes/menu'
import { registerAuthRoutes } from './routes/auth'
import { registerUserRoutes } from './routes/users'
import { registerTableOpsRoutes } from './routes/table-ops'
import { registerFloorMapRoutes } from './routes/floor-map'
import { registerCashierClosingRoutes } from './routes/cashier-closing'
import { registerReportsRoutes } from './routes/reports'
import { registerPromotionsRoutes } from './routes/promotions'
import { registerCombosRoutes } from './routes/combos'
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

  await server.register(FastifyCors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  const jwtSecret = process.env['JWT_SECRET'] || 'vynex-local-secret-change-in-production'
  await server.register(FastifyJwt, { secret: jwtSecret })

  await server.register(FastifyWebSocket)

  server.get('/health', async () => {
    return {
      status: 'ok',
      version: VYNEX_VERSION,
      db: isReplicaMode() ? 'replica' : 'local',
      last_sync: getLastSyncAt(),
    }
  })

  // TODO: remove before production
  server.post('/admin/sync', async (_request, reply) => {
    if (!isReplicaMode()) {
      return reply.status(400).send({ error: 'Not in replica mode — no Turso credentials configured' })
    }
    await syncNow()
    return { ok: true }
  })

  await registerWebSocketHandler(server)
  await registerAuthRoutes(server)
  await registerUserRoutes(server)
  await registerOrderRoutes(server)
  await registerTableRoutes(server)
  await registerMenuRoutes(server)
  await registerTableOpsRoutes(server)
  await registerFloorMapRoutes(server)
  await registerCashierClosingRoutes(server)
  await registerReportsRoutes(server)
  await registerPromotionsRoutes(server)
  await registerCombosRoutes(server)

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
