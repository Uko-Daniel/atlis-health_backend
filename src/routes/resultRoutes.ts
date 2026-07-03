import { type FastifyInstance } from 'fastify';
import { authenticate }   from '../middleware/authenticate';
import {   guardResultDepartment }      from '../middleware/departmentGuard';
import {
  authorizeVerifier,
  authorize,
  blockResultAccess,
} from '../middleware/authorize';
import { resultController } from '../controllers/resultController';

// ── RESULT ROUTES ─────────────────────────────────────────────
// All routes require authentication.
// RECEPTIONIST and BILLING_OFFICER are blocked from all result data.

export async function resultRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', blockResultAccess);

  // ── CREATE ────────────────────────────────────────────────
  // POST /api/results
  // Lab techs and radiologists create results against an order
  fastify.post('/', {
    preHandler: [authorize(['LAB_TECH', 'RADIOLOGIST', 'ADMIN'])],
    handler:    resultController.createResult,
  });

  // ── DEPARTMENT WORKLIST ───────────────────────────────────
  // GET /api/results/department
  // Must be registered before /:id to avoid route conflict
  fastify.get('/department', {
    preHandler: [authorize(['LAB_TECH', 'RADIOLOGIST', 'DOCTOR', 'ADMIN'])],
    handler:    resultController.getResultsByDepartment,
  });

  // ── CRITICAL PENDING ──────────────────────────────────────
  // GET /api/results/department/critical
  fastify.get('/department/critical', {
    preHandler: [authorize(['LAB_TECH', 'RADIOLOGIST', 'DOCTOR', 'ADMIN'])],
    handler:    resultController.getCriticalPendingResults,
  });

  // ── BY PATIENT ────────────────────────────────────────────
  // GET /api/results/patient/:patientId
  // ?department= &releasedOnly= &page= &limit=
  fastify.get('/patient/:patientId', {
    preHandler: [authorize(['DOCTOR', 'LAB_TECH', 'RADIOLOGIST', 'ADMIN', 'HIM_OFFICER'])],
    handler:    resultController.getResultsByPatient,
  });

  // ── BY ORDER ──────────────────────────────────────────────
  // GET /api/results/order/:orderId
  fastify.get('/order/:orderId', {
    preHandler: [authorize(['DOCTOR', 'LAB_TECH', 'RADIOLOGIST', 'ADMIN'])],
    handler:    resultController.getResultsByOrder,
  });

  // ── SINGLE RESULT ─────────────────────────────────────────
  // GET /api/results/:id
  // guardResultDepartment blocks non-ADMIN/DOCTOR from cross-dept access
  fastify.get('/:id', {
    preHandler: [guardResultDepartment],
    handler:    resultController.getResultById,
  });

  // ── UPDATE STATUS ─────────────────────────────────────────
  // PATCH /api/results/:id/status
  fastify.patch('/:id/status', {
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'ADMIN']),
      guardResultDepartment,
    ],
    handler: resultController.updateResultStatus,
  });

  // ── UPDATE DATA ───────────────────────────────────────────
  // PATCH /api/results/:id/data
  // Re-submits result data — voids any previous signature
  fastify.patch('/:id/data', {
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'ADMIN']),
      guardResultDepartment,
    ],
    handler: resultController.updateResultData,
  });

  // ── VERIFY / SIGN ─────────────────────────────────────────
  // PATCH /api/results/:id/verify
  // canVerify or isHOD only — enforced in service + middleware
  fastify.patch('/:id/verify', {
    preHandler: [
      authorizeVerifier,
      guardResultDepartment,
    ],
    handler: resultController.verifyResult,
  });

  // ── FINALIZE ──────────────────────────────────────────────
  // PATCH /api/results/:id/finalize
  // Second sign-off step — VERIFIED → FINALIZED
  fastify.patch('/:id/finalize', {
    preHandler: [
      authorizeVerifier,
      guardResultDepartment,
    ],
    handler: resultController.finalizeResult,
  });

  // ── RELEASE TO PATIENT ────────────────────────────────────
  // PATCH /api/results/:id/release
  // Explicit patient release — ADMIN, DOCTOR, or dept HOD
  fastify.patch('/:id/release', {
    preHandler: [authorize(['DOCTOR', 'ADMIN', 'HIM_OFFICER'])],
    handler:    resultController.releaseToPatient,
  });

  // ── SIGNATURE INTEGRITY CHECK ─────────────────────────────
  // GET /api/results/:id/integrity
  // Verify result hasn't been tampered with since signing
  fastify.get('/:id/integrity', {
    preHandler: [authorize(['DOCTOR', 'ADMIN', 'HIM_OFFICER'])],
    handler:    resultController.checkSignatureIntegrity,
  });
}
