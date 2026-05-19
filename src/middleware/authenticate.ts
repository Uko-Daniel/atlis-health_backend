import {
  type FastifyRequest,
  type FastifyReply,
} from 'fastify';

// ── AUTHENTICATE ──────────────────────────────────────────────
// Verifies the JWT on every protected request.
// Attaches the decoded payload to request.user.
// Register as a preHandler hook on protected route groups.

export async function authenticate(
  request: FastifyRequest,
  reply:   FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({
      statusCode: 401,
      error:      'Unauthorized',
      message:    'Invalid or expired token',
    });
  }
}