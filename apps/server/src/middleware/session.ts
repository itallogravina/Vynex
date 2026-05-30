import { FastifyRequest, FastifyReply } from 'fastify'
import { getSessionUser } from '../db/queries'
import { User } from '@vynex/shared'

declare module 'fastify' {
  interface FastifyRequest {
    user: User
  }
}

export async function requireSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.headers['x-session-token'] as string | undefined
  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
  const user = await getSessionUser(token)
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
  request.user = user
}
