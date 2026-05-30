import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import {
  getAllPinUsers,
  getUserByName,
  getUser,
  getListLoginUsers,
  createSession,
  deleteSession,
} from '../db/queries'
import { requireSession } from '../middleware/session'
import { apiError } from '../lib/errors'
import { LoginRequest } from '@vynex/shared'

const { v4: uuid } = require('uuid')

const SESSION_TTL_HOURS = Number(process.env['SESSION_TTL_HOURS'] ?? 8)

function sessionExpiry(): string {
  return new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString()
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login', async (request, reply) => {
    const body = request.body as LoginRequest

    if (body.login_method === 'pin') {
      const pinUsers = await getAllPinUsers()
      const matches: typeof pinUsers = []
      for (const u of pinUsers) {
        if (u.pin_hash && (await bcrypt.compare(body.pin, u.pin_hash))) {
          matches.push(u)
        }
      }
      if (matches.length === 0) return apiError(reply, 401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials')
      if (matches.length > 1) return apiError(reply, 409, 'AUTH_PIN_CONFLICT', 'PIN conflict — contact manager')

      const user = matches[0]!
      const token: string = uuid()
      await createSession(token, user.id, SESSION_TTL_HOURS)
      return { token, user: { id: user.id, name: user.name, role: user.role }, expires_at: sessionExpiry() }
    }

    if (body.login_method === 'password') {
      const user = await getUserByName(body.username)
      if (!user || !user.password_hash) return apiError(reply, 401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials')
      const valid = await bcrypt.compare(body.password, user.password_hash)
      if (!valid) return apiError(reply, 401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials')

      const token: string = uuid()
      await createSession(token, user.id, SESSION_TTL_HOURS)
      return { token, user: { id: user.id, name: user.name, role: user.role }, expires_at: sessionExpiry() }
    }

    if (body.login_method === 'list') {
      const user = await getUser(body.user_id)
      if (!user || user.login_method !== 'list' || !user.enabled) {
        return apiError(reply, 401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials')
      }

      const token: string = uuid()
      await createSession(token, user.id, SESSION_TTL_HOURS)
      return { token, user: { id: user.id, name: user.name, role: user.role }, expires_at: sessionExpiry() }
    }

    return apiError(reply, 400, 'AUTH_INVALID_METHOD', 'Invalid login_method')
  })

  app.delete('/logout', { preHandler: [requireSession] }, async (request, reply) => {
    const token = request.headers['x-session-token'] as string
    await deleteSession(token)
    return reply.status(204).send()
  })

  app.get('/users/list-login', async () => {
    return getListLoginUsers()
  })
}
