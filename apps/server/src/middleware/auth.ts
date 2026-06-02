import { FastifyRequest, FastifyReply } from 'fastify'
import { Role } from '@vynex/shared'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
      return
    }
    const payload = request.user as { role: Role }
    if (!roles.includes(payload.role)) {
      reply.status(403).send({ error: 'Forbidden' })
      return
    }
  }
}
