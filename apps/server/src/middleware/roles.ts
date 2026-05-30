import { FastifyRequest, FastifyReply } from 'fastify'
import { Role } from '@vynex/shared'

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }
}
