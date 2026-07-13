import 'dotenv/config';
import jwt from '@fastify/jwt';
import Fastify from 'fastify';
import { app } from './app';
import cors from '@fastify/cors';
import { resolveTenant } from './middleware/tenantContext';
import { enforceSubscription } from './middleware/subscriptionGuard';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET missing');
}

const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: true, // Allow all origins — tenant subdomains will vary
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

server.register(jwt, {
  secret: JWT_SECRET,
  sign: {
    expiresIn: '24h',
  },
});

// ── Global hooks: tenant resolution + subscription enforcement ─
server.addHook('onRequest', resolveTenant);
server.addHook('onRequest', enforceSubscription);

// Register the main app
server.register(app);

// ── Monthly billing cron (runs 1st of each month at 00:05) ─
import { closeAllBillingPeriods } from './services/billingService';

const CHECK_INTERVAL = 60 * 60 * 1000; // Every hour

setInterval(async () => {
  const now = new Date();
  // Only run on the 1st of the month, between 00:00-01:00
  if (now.getDate() === 1 && now.getHours() === 0) {
    try {
      const result = await closeAllBillingPeriods();
      server.log.info(`Billing cron: processed ${result.processed} tenants, created ${result.created} periods`);
    } catch (err) {
      server.log.error({ err }, 'Billing cron failed');
    }
  }
}, CHECK_INTERVAL);

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
