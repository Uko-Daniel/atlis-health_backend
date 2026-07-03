import { type FastifyInstance } from 'fastify';
import { authenticate }       from '../middleware/authenticate';
import { authRateLimitConfig } from '../middleware/rateLimiter';
import { authController }     from '../controllers/authController';

// ── AUTH ROUTES ───────────────────────────────────────────────
// /login is public — strict rate limit to prevent brute force.
// All other routes require a valid token.

export async function authRoutes(fastify: FastifyInstance) {

  // POST /api/auth/login
  // Public — strict rate limit (10 attempts / 15 min)
  fastify.post('/login', {
    ...authRateLimitConfig,
    handler: authController.login,
  });

  // GET /api/auth/me
  // Returns the currently authenticated staff member's profile
  fastify.get('/me', {
    preHandler: [authenticate],
    handler:    authController.me,
  });

  // PATCH /api/auth/password
  // Change own password — requires current password
  fastify.patch('/password', {
    preHandler: [authenticate],
    handler:    authController.changePassword,
  });
}