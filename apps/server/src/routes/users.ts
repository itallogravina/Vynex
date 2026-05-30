import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { Role, LoginMethod } from '@vynex/shared'
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  disableUser,
  deleteUser,
  userHasOrders,
  softOrHardDeleteUser,
  countUsers,
} from '../db/queries'
import { requireRole } from '../middleware/auth'

const SALT_ROUNDS = 10

const ROLES: Role[] = ['owner', 'manager', 'cashier', 'waiter', 'bartender', 'kitchen']
const LOGIN_METHODS: LoginMethod[] = ['pin', 'password', 'list']

type CreateBody = {
  name: string
  role: Role
  login_method: LoginMethod
  username?: string
  pin?: string
  password?: string
}

type UpdateBody = Partial<CreateBody> & { enabled?: boolean }

type BulkBody = { users: CreateBody[] }

type AutoBody = {
  role: Role
  login_method: LoginMethod
  count: number
  prefix?: string
}

async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS)
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  // List all users
  app.get('/users', { preHandler: requireRole('owner', 'manager') }, async () => {
    return listUsers()
  })

  // Create a user
  app.post<{ Body: CreateBody }>(
    '/users',
    { preHandler: requireRole('owner', 'manager') },
    async (request, reply) => {
      const { name, role, login_method, username, pin, password } = request.body

      if (!name?.trim()) return reply.status(400).send({ error: 'name is required' })
      if (!ROLES.includes(role)) return reply.status(400).send({ error: 'invalid role' })
      if (!LOGIN_METHODS.includes(login_method)) return reply.status(400).send({ error: 'invalid login_method' })
      if (login_method === 'pin' && !pin) return reply.status(400).send({ error: 'pin is required for pin login method' })
      if (login_method === 'password' && !password) return reply.status(400).send({ error: 'password is required for password login method' })

      const pinHash = pin ? await hashPin(pin) : undefined
      const passwordHash = password ? await hashPassword(password) : undefined

      const user = await createUser(name.trim(), role, login_method, pinHash, passwordHash, username?.trim())
      return reply.status(201).send(user)
    }
  )

  // Update a user
  app.patch<{ Params: { id: string }; Body: UpdateBody }>(
    '/users/:id',
    { preHandler: requireRole('owner', 'manager') },
    async (request, reply) => {
      const { id } = request.params
      const existing = await getUser(id)
      if (!existing) return reply.status(404).send({ error: 'User not found' })

      const { name, role, login_method, pin, password, enabled } = request.body
      const fields: Parameters<typeof updateUser>[1] = {}

      if (name !== undefined)         fields.name = name.trim()
      if (role !== undefined)         fields.role = role
      if (login_method !== undefined) fields.login_method = login_method
      if (enabled !== undefined)      fields.enabled = enabled

      const method = login_method ?? existing.login_method
      if (pin !== undefined && method === 'pin') {
        fields.pin_hash = await hashPin(pin)
        fields.password_hash = null
      }
      if (password !== undefined && method === 'password') {
        fields.password_hash = await hashPassword(password)
        fields.pin_hash = null
      }

      const updated = await updateUser(id, fields)
      return reply.send(updated)
    }
  )

  // Delete (soft-disable if has orders, hard-delete otherwise) — owner only
  app.delete<{ Params: { id: string } }>(
    '/users/:id',
    { preHandler: requireRole('owner') },
    async (request, reply) => {
      const { id } = request.params
      const existing = await getUser(id)
      if (!existing) return reply.status(404).send({ error: 'User not found' })

      await softOrHardDeleteUser(id)
      return reply.status(204).send()
    }
  )

  // Bulk import from JSON payload
  app.post<{ Body: BulkBody }>(
    '/users/bulk-import',
    { preHandler: requireRole('owner', 'manager') },
    async (request, reply) => {
      const { users } = request.body
      if (!Array.isArray(users) || users.length === 0) {
        return reply.status(400).send({ error: 'users array is required' })
      }

      let created = 0
      const failed: { index: number; name: string; error: string }[] = []

      for (let i = 0; i < users.length; i++) {
        const u = users[i]!
        try {
          if (!u.name?.trim()) throw new Error('name is required')
          if (!ROLES.includes(u.role)) throw new Error('invalid role')
          if (!LOGIN_METHODS.includes(u.login_method)) throw new Error('invalid login_method')
          if (u.login_method === 'pin' && !u.pin) throw new Error('pin is required')
          if (u.login_method === 'password' && !u.password) throw new Error('password is required')

          const pinHash = u.pin ? await hashPin(u.pin) : undefined
          const passwordHash = u.password ? await hashPassword(u.password) : undefined

          await createUser(u.name.trim(), u.role, u.login_method, pinHash, passwordHash, u.username?.trim())
          created++
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'unknown error'
          failed.push({ index: i, name: u.name ?? '?', error: msg })
        }
      }

      return reply.status(207).send({ created, failed })
    }
  )

  // Auto-generate numbered users with sequential PINs
  app.post<{ Body: AutoBody }>(
    '/users/auto-generate',
    { preHandler: requireRole('owner', 'manager') },
    async (request, reply) => {
      const { role, login_method, count, prefix } = request.body

      if (!ROLES.includes(role)) return reply.status(400).send({ error: 'invalid role' })
      if (!LOGIN_METHODS.includes(login_method)) return reply.status(400).send({ error: 'invalid login_method' })
      if (!count || count < 1 || count > 100) return reply.status(400).send({ error: 'count must be between 1 and 100' })
      if (login_method === 'password') {
        return reply.status(400).send({ error: 'auto-generate does not support password login method' })
      }

      const label = prefix?.trim() || capitalize(role)
      const created: { name: string; pin?: string }[] = []

      let pinCounter = (await countUsers()) + 1

      for (let i = 1; i <= count; i++) {
        const name = `${label} ${i}`
        let rawPin: string | undefined
        let pinHash: string | undefined

        if (login_method === 'pin') {
          rawPin = String(pinCounter).padStart(4, '0')
          pinHash = await hashPin(rawPin)
          pinCounter++
        }

        await createUser(name, role, login_method, pinHash, undefined)
        created.push({ name, ...(rawPin ? { pin: rawPin } : {}) })
      }

      return reply.status(201).send({ created })
    }
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
