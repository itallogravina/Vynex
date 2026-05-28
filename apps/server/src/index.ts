import Fastify from 'fastify'
import FastifyWebSocket from '@fastify/websocket'
import { VYNEX_VERSION } from '@vynex/shared'
import { initializeDatabase } from './db/init'
import { registerOrderRoutes } from './routes/orders'
import { registerTableRoutes } from './routes/tables'
import { registerMenuRoutes } from './routes/menu'
import { registerWebSocketHandler } from './ws/handler'

async function main() {
  // Initialize database
  const dbPath = process.env['DATABASE_PATH'] || './vynex.db'
  initializeDatabase(dbPath)

  const server = Fastify({ logger: true })

  // Register WebSocket plugin
  await server.register(FastifyWebSocket)

  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'ok', app: 'vynex-server' }
  })

  // Debug: List all registered routes
  server.get('/debug/routes', async () => {
    return server.printRoutes()
  })

  // Register WebSocket handler (must be before order routes for proper routing)
  await registerWebSocketHandler(server)

  // Register routes
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
