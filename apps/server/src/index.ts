import Fastify from 'fastify'
import { VYNEX_VERSION } from '@vynex/shared'

const server = Fastify({ logger: true })

server.get('/health', async () => {
  return { status: 'ok', app: 'vynex-server' }
})

const port = Number(process.env['PORT'] ?? 3000)

server.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
  server.log.info(`Vynex v${VYNEX_VERSION} listening on ${address}`)
})
