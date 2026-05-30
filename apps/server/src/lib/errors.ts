import type { FastifyReply } from 'fastify'

export function apiError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
): ReturnType<FastifyReply['send']> {
  return reply.status(status).send({ code, error: message })
}
