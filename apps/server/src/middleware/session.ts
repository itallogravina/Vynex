import { FastifyRequest, FastifyReply } from 'fastify'
import { getSessionUser } from '../db/queries'
import { apiError } from '../lib/errors'
import { User } from '@vynex/shared'

declare module 'fastify' {
  interface FastifyRequest {
    user: User
  }
}

export async function requireSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.headers['x-session-token'] as string | undefined
  if (!token) {
    return apiError(reply, 401, 'AUTH_UNAUTHORIZED', 'Unauthorized')
  }
  const user = await getSessionUser(token)
  if (!user) {
    return apiError(reply, 401, 'AUTH_UNAUTHORIZED', 'Unauthorized')
  }
  request.user = user
}
