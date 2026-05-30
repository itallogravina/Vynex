import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { LoginRequest, AuthResponse } from '@vynex/shared'
import {
  getAllPinUsers,
  getUserByUsername,
  getUser,
  listUsersForLogin,
  createSession,
  deleteSession,
} from '../db/queries'

const TOKEN_TTL_HOURS = 12

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // Users available for "select from list" login — no auth required
  app.get('/auth/list-users', async () => {
    return listUsersForLogin()
  })

  app.post<{ Body: LoginRequest }>('/auth/login', async (request, reply) => {
    const body = request.body

    if (body.login_method === 'pin') {
      const { pin } = body
      if (!pin) return reply.status(400).send({ error: 'pin is required' })

      const candidates = await getAllPinUsers()
      let matched: (typeof candidates)[number] | null = null
      for (const u of candidates) {
        if (u.pin_hash && await bcrypt.compare(pin, u.pin_hash)) {
          matched = u
          break
        }
      }
      if (!matched) return reply.status(401).send({ error: 'Invalid PIN' })

      return buildAuthResponse(app, matched)
    }

    if (body.login_method === 'password') {
      const { username, password } = body
      if (!username || !password) return reply.status(400).send({ error: 'username and password are required' })

      const user = await getUserByUsername(username)
      if (!user || !user.enabled) return reply.status(401).send({ error: 'Invalid credentials' })
      if (!user.password_hash) return reply.status(401).send({ error: 'Invalid credentials' })

      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })

      return buildAuthResponse(app, user)
    }

    if (body.login_method === 'list') {
      const { user_id } = body
      if (!user_id) return reply.status(400).send({ error: 'user_id is required' })

      const user = await getUser(user_id)
      if (!user || !user.enabled) return reply.status(401).send({ error: 'User not found' })
      if (user.login_method !== 'list') return reply.status(401).send({ error: 'User does not allow list login' })

      return buildAuthResponse(app, user)
    }

    return reply.status(400).send({ error: 'Invalid login_method' })
  })

  app.post('/auth/logout', async (request, reply) => {
    const auth = request.headers.authorization
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7)
      await deleteSession(token).catch(() => {})
    }
    return reply.status(204).send()
  })
}

function buildAuthResponse(
  app: FastifyInstance,
  user: { id: string; name: string; role: string }
): AuthResponse {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = (app as any).jwt.sign(
    { sub: user.id, id: user.id, name: user.name, role: user.role },
    { expiresIn: `${TOKEN_TTL_HOURS}h` }
  )
  return {
    token,
    user: { id: user.id, name: user.name, role: user.role as any },
    expires_at: expiresAt,
  }
}
