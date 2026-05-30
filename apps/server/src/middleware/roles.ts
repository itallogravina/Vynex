import { FastifyRequest, FastifyReply } from 'fastify'
import { Role } from '@vynex/shared'
import { apiError } from '../lib/errors'

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user || !roles.includes(request.user.role)) {
      return apiError(reply, 403, 'AUTH_FORBIDDEN', 'Forbidden')
    }
  }
}
