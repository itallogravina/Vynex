import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; name: string; role: string }
    user: { sub: string; id: string; name: string; role: string }
  }
}
