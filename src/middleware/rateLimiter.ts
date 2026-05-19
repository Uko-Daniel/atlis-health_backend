import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { type FastifyInstance } from 'fastify';

// ── RATE LIMITER PLUGIN ───────────────────────────────────────
// Registered as a Fastify plugin so it can be applied globally
// or scoped to specific route groups.
//
// Three tiers:
//   default     — general API endpoints
//   auth        — login / token endpoints (strict)
//   evee        — EVEE evaluation endpoint (moderate)

// ── DEFAULT — general API ─────────────────────────────────────
export const rateLimiterPlugin = fp(async (fastify: FastifyInstance) => {
  await fastify.register(rateLimit, {
    global:    true,
    max:       200,           // 200 requests
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Key by authenticated staff ID if available, else by IP
      return (request.user?.sub) ?? request.ip;
    },
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error:      'Too Many Requests',
      message:    `Rate limit exceeded. Try again in ${context.after}.`,
    }),
  });
});

// ── AUTH TIER — login endpoints ───────────────────────────────
// Applied directly on auth route group registration.
// Strict — prevents brute force on login.

export const authRateLimitConfig = {
  config: {
    rateLimit: {
      max:        10,         // 10 attempts
      timeWindow: '15 minutes',
      errorResponseBuilder: (_request: any, context: any) => ({
        statusCode: 429,
        error:      'Too Many Requests',
        message:    `Too many login attempts. Try again in ${context.after}.`,
      }),
    },
  },
};

// ── EVEE TIER — evaluation endpoint ──────────────────────────
// Moderate — EVEE is compute-heavy, prevent hammering.

export const eveeRateLimitConfig = {
  config: {
    rateLimit: {
      max:        30,         // 30 evaluations
      timeWindow: '1 minute',
      errorResponseBuilder: (_request: any, context: any) => ({
        statusCode: 429,
        error:      'Too Many Requests',
        message:    `EVEE evaluation rate limit reached. Try again in ${context.after}.`,
      }),
    },
  },
};

// ── RESULT EDITOR TIER — draft save endpoint ──────────────────
// Relaxed — auto-save fires frequently during editing.

export const editorRateLimitConfig = {
  config: {
    rateLimit: {
      max:        120,        // 120 saves
      timeWindow: '1 minute',
      errorResponseBuilder: (_request: any, context: any) => ({
        statusCode: 429,
        error:      'Too Many Requests',
        message:    `Auto-save rate limit reached. Try again in ${context.after}.`,
      }),
    },
  },
};