import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import {
  listUsers,
  createUser,
  getUser,
  updateUser,
  disableUser,
  deleteUser,
  userHasOrders,
} from '../db/queries'
import { requireSession } from '../middleware/session'
import { requireRole } from '../middleware/roles'
import { Role, LoginMethod } from '@vynex/shared'

const BCRYPT_ROUNDS = 10

const managerOwner = [requireSession, requireRole('manager', 'owner')]

type CreateUserBody = {
  name: string
  role: Role
  login_method: LoginMethod
  pin?: string
  password?: string
}

async function hashCredentials(body: CreateUserBody): Promise<{ pinHash?: string; passwordHash?: string }> {
  if (body.login_method === 'pin' && body.pin) {
    return { pinHash: await bcrypt.hash(body.pin, BCRYPT_ROUNDS) }
  }
  if (body.login_method === 'password' && body.password) {
    return { passwordHash: await bcrypt.hash(body.password, BCRYPT_ROUNDS) }
  }
  return {}
}

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get('/users', { preHandler: managerOwner }, async () => {
    return listUsers()
  })

  app.post('/users', { preHandler: managerOwner }, async (request, reply) => {
    const body = request.body as CreateUserBody

    if (body.login_method === 'pin' && !body.pin) {
      return reply.status(400).send({ error: 'pin is required for pin login method' })
    }
    if (body.login_method === 'password' && !body.password) {
      return reply.status(400).send({ error: 'password is required for password login method' })
    }

    const { pinHash, passwordHash } = await hashCredentials(body)
    const user = await createUser(body.name, body.role, body.login_method, pinHash, passwordHash)
    return reply.status(201).send(user)
  })

  app.patch('/users/:id', { preHandler: managerOwner }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<CreateUserBody & { enabled: boolean }>

    const existing = await getUser(id)
    if (!existing) return reply.status(404).send({ error: 'User not found' })

    const fields: Parameters<typeof updateUser>[1] = {}
    if (body.name !== undefined) fields.name = body.name
    if (body.role !== undefined) fields.role = body.role
    if (body.login_method !== undefined) fields.login_method = body.login_method
    if (body.enabled !== undefined) fields.enabled = body.enabled
    if (body.pin !== undefined) fields.pin_hash = await bcrypt.hash(body.pin, BCRYPT_ROUNDS)
    if (body.password !== undefined) fields.password_hash = await bcrypt.hash(body.password, BCRYPT_ROUNDS)

    return updateUser(id, fields)
  })

  app.delete('/users/:id', { preHandler: managerOwner }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await getUser(id)
    if (!existing) return reply.status(404).send({ error: 'User not found' })

    if (await userHasOrders(id)) {
      await disableUser(id)
      return { disabled: true }
    }

    await deleteUser(id)
    return reply.status(204).send()
  })

  app.post('/users/bulk-import', { preHandler: managerOwner }, async (request) => {
    const body = request.body as CreateUserBody[]
    let created = 0
    const errors: { index: number; error: string }[] = []

    for (let i = 0; i < body.length; i++) {
      try {
        const u = body[i] as CreateUserBody
        const { pinHash, passwordHash } = await hashCredentials(u)
        await createUser(u.name, u.role, u.login_method, pinHash, passwordHash)
        created++
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    return { created, errors }
  })
}
