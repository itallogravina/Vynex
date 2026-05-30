import { FastifyInstance } from 'fastify'
import { RoutingZone } from '@vynex/shared'
import { addClient, removeClient } from './broadcast'
import { getSessionUser } from '../db/queries'

type WebSocketLike = {
  send(data: string | Buffer, callback?: (error?: Error) => void): void
  close(): void
  readyState: number
  on(event: string, listener: (...args: any[]) => void): void
}

export async function registerWebSocketHandler(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { zones?: string; token?: string } }>(
    '/ws',
    { websocket: true },
    async (socket: WebSocketLike, request) => {
      const token = request.query.token
      if (!token) {
        socket.send(JSON.stringify({ error: 'Unauthorized' }))
        socket.close()
        return
      }

      const user = await getSessionUser(token)
      if (!user) {
        socket.send(JSON.stringify({ error: 'Unauthorized' }))
        socket.close()
        return
      }

      const zonesParam = request.query.zones || 'kitchen,bar,cashier'
      const zones = zonesParam
        .split(',')
        .map(z => z.trim())
        .filter(z => Object.values(RoutingZone).includes(z as RoutingZone)) as RoutingZone[]

      if (zones.length === 0) {
        socket.send(JSON.stringify({ error: 'No valid routing zones provided' }))
        socket.close()
        return
      }

      addClient(socket, zones)

      socket.on('close', () => {
        removeClient(socket)
      })

      socket.on('error', (err: any) => {
        console.error(`WebSocket error: ${err.message}`)
        removeClient(socket)
      })
    }
  )
}
