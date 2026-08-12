import 'dotenv/config';
import jwt from '@fastify/jwt';
import Fastify from 'fastify';
import { app } from './app';
import cors from '@fastify/cors';
import fastifyRawBody from 'fastify-raw-body';
import { resolveTenant } from './middleware/tenantContext';
import { enforceSubscription } from './middleware/subscriptionGuard';
import { AppError } from './utils/errors';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET missing');
}

const server = Fastify({
  logger: true,
});

// ── CORS ─────────────────────────────────────────────────────
await server.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// ── JWT ──────────────────────────────────────────────────────
server.register(jwt, {
  secret: JWT_SECRET,
  sign: {
    expiresIn: '24h',
  },
});

// ── Raw body plugin (needed for Paystack webhook signature) ──
server.register(fastifyRawBody, {
  field: 'rawBody',
  global: false, // only routes with config.rawBody = true will have rawBody
  encoding: 'utf8',
  runFirst: true,
});

// ── Global hooks: tenant resolution + subscription enforcement ──
// Skip webhook endpoints because they do not carry tenant host info.
const WEBHOOK_PATHS = [
  '/api/webhooks/paystack',
  // Add other webhook paths here if needed
];

function isWebhook(url: string) {
  return WEBHOOK_PATHS.some(path => url.startsWith(path));
}

server.addHook('onRequest', async (request, reply) => {
  if (isWebhook(request.url)) return;
  await resolveTenant(request, reply);
});

server.addHook('onRequest', async (request, reply) => {
  if (isWebhook(request.url)) return;
  await enforceSubscription(request, reply);
});

// ── Register the main app ────────────────────────────────────
server.register(app);

// ── Global error handler ──────────────────────────────────────
server.setErrorHandler((error: unknown, request, reply) => {
  // Our structured application error
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    });
  }

  // Fastify validation errors
  const fastifyErr = error as { validation?: { instancePath: string; message: string }[] }
  if (Array.isArray(fastifyErr.validation) && fastifyErr.validation.length > 0) {
    const details: Record<string, string[]> = {}
    for (const v of fastifyErr.validation) {
      const path = v.instancePath.replace(/^\//, '') || 'form'
      if (!details[path]) details[path] = []
      details[path].push(v.message)
    }
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the form for errors and try again.',
        details,
      },
    });
  }

  // Prisma errors
  const prismaErr = error as { code?: string }
  if (prismaErr.code && prismaErr.code.startsWith('P')) {
    return reply.status(409).send({
      error: {
        code: 'CONFLICT',
        message: 'A database constraint was violated. Please check your input.',
      },
    });
  }

  // Rate limit
  if (reply.statusCode === 429) {
    return reply.status(429).send({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please wait a moment before trying again.',
      },
    });
  }

  // Fallback
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred on the server.',
    },
  });
});

// ── Monthly billing cron ──────────────────────────────────────
import { closeAllBillingPeriods } from './services/billingService';

const CHECK_INTERVAL = 60 * 60 * 1000;

setInterval(async () => {
  const now = new Date();
  if (now.getDate() === 1 && now.getHours() === 0) {
    try {
      const result = await closeAllBillingPeriods();
      server.log.info(`Billing cron: processed ${result.processed} tenants, created ${result.created} periods`);
    } catch (err) {
      server.log.error({ err }, 'Billing cron failed');
    }
  }
}, CHECK_INTERVAL);

// ── Start server ──────────────────────────────────────────────
const start = async () => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();