import Fastify from 'fastify'
import { VYNEX_VERSION } from '@vynex/shared'
import { initializeDatabase } from './db/init'
import { registerOrderRoutes } from './routes/orders'

async function main() {
  // Initialize database
  const dbPath = process.env['DATABASE_PATH'] || './vynex.db'
  initializeDatabase(dbPath)

  const server = Fastify({ logger: true })

  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'ok', app: 'vynex-server' }
  })

  // Register order routing endpoints
  await registerOrderRoutes(server)

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
