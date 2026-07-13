import { type FastifyInstance } from 'fastify';
import { authenticate }       from '../middleware/authenticate';
import { authorize }          from '../middleware/authorize';
import { eveeRateLimitConfig } from '../middleware/rateLimiter';
import { eveeController }     from '../controllers/eveeController';

// ── EVEE ROUTES ───────────────────────────────────────────────
// Doctors run evaluations and override alerts.
// Nurses can view but not evaluate or override.
// Compute-heavy evaluate endpoint gets a tighter rate limit.

export async function eveeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // ── EVALUATE ──────────────────────────────────────────────
  // POST /api/evee/evaluate/:patientId
  // Doctors only — runs the full CDSS evaluation
  fastify.post('/evaluate/:patientId', {
    ...eveeRateLimitConfig,
    preHandler: [authorize(['DOCTOR'])],
    handler:    eveeController.evaluate,
  });

  // ── EVALUATION HISTORY ────────────────────────────────────
  // GET /api/evee/evaluations/patient/:patientId
  fastify.get('/evaluations/patient/:patientId', {
    preHandler: [authorize(['DOCTOR', 'NURSES'])],
    handler:    eveeController.getEvaluationsByPatient,
  });

  // ── SINGLE EVALUATION ─────────────────────────────────────
  // GET /api/evee/evaluations/:id
  fastify.get('/evaluations/:id', {
    preHandler: [authorize(['DOCTOR', 'NURSES', 'PHARMACIST'])],
    handler:    eveeController.getEvaluationById,
  });

  // ── OVERRIDE ALERT ────────────────────────────────────────
  // PATCH /api/evee/alerts/:id/override
  // Doctors only — dismissing a clinical alert requires medical authority
  fastify.patch('/alerts/:id/override', {
    preHandler: [authorize(['DOCTOR'])],
    handler:    eveeController.overrideAlert,
  });

  // ── OPEN CRITICAL ALERTS ──────────────────────────────────
  // GET /api/evee/alerts/critical/:patientId
  fastify.get('/alerts/critical/:patientId', {
    preHandler: [authorize(['DOCTOR', 'NURSES', 'PHARMACIST'])],
    handler:    eveeController.getOpenCriticalAlerts,
  });
}