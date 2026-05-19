import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { type FastifyInstance } from 'fastify';
import { rateLimiterPlugin } from '../middleware/rateLimiter';
import { auditLoggerPlugin } from '../middleware/auditLogger';

// ── PLUGIN REGISTRATION ───────────────────────────────────────
// Call this once in your main server file:
//
//   import { registerPlugins } from './plugins/index';
//   await registerPlugins(fastify);

export const registerPlugins = fp(async (fastify: FastifyInstance) => {

  // ── JWT ─────────────────────────────────────────────────────
  // @fastify/jwt decorates fastify.jwt and request.jwtVerify()
  // authenticate.ts calls request.jwtVerify() on protected routes.
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET!,
    sign: {
      expiresIn: '12h',
    },
    // request.user is populated automatically after jwtVerify()
    decode: { complete: false },
  });

  // ── RATE LIMITER ─────────────────────────────────────────────
  // Applied globally — 200 req/min per staff ID or IP.
  // Individual route groups override with tighter limits.
  await fastify.register(rateLimiterPlugin);

  // ── AUDIT LOGGER ─────────────────────────────────────────────
  // onResponse hook — fires after every mutating request.
  await fastify.register(auditLoggerPlugin);

  fastify.log.info('Plugins registered: JWT, RateLimiter, AuditLogger');
});