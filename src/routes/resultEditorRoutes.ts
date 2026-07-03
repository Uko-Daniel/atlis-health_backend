import { type FastifyInstance } from 'fastify';
import { authenticate }           from '../middleware/authenticate';
import { authorize }              from '../middleware/authorize';
import { guardResultDepartment }  from '../middleware/departmentGuard';
import { editorRateLimitConfig }  from '../middleware/rateLimiter';
import { resultEditorController } from '../controllers/resultEditorController';

// ── RESULT EDITOR ROUTES ──────────────────────────────────────
// All routes require authentication.
// Only LAB_TECH, RADIOLOGIST, and ADMIN can open editor sessions.
// guardResultDepartment ensures techs can only edit their own dept's results.

export async function resultEditorRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // ── FORMULA METADATA ──────────────────────────────────────
  // GET /api/editor/formula/:formulaKey
  // No dept guard needed — formula metadata is not patient data
  // Must be registered before /:resultId routes to avoid conflict
  fastify.get('/formula/:formulaKey', {
    preHandler: [authorize(['LAB_TECH', 'RADIOLOGIST', 'DOCTOR', 'ADMIN'])],
    handler:    resultEditorController.getFormulaMetadata,
  });

  // ── SESSION MANAGEMENT ────────────────────────────────────

  // POST /api/editor/:resultId/session
  // Opens or resumes an edit session — acquires lock
  fastify.post('/:resultId/session', {
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'ADMIN']),
      guardResultDepartment,
    ],
    handler: resultEditorController.openSession,
  });

  // GET /api/editor/:resultId/session
  // Check for an existing session / resumable draft on page load
  fastify.get('/:resultId/session', {
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'ADMIN']),
      guardResultDepartment,
    ],
    handler: resultEditorController.getSession,
  });

  // DELETE /api/editor/:resultId/session
  // Close session cleanly — releases lock, preserves draft
  fastify.delete('/:resultId/session', {
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'ADMIN']),
      guardResultDepartment,
    ],
    handler: resultEditorController.closeSession,
  });

  // ── DRAFT AUTO-SAVE ───────────────────────────────────────

  // POST /api/editor/:resultId/draft
  // Auto-saves draft every 30s — relaxed rate limit applied
  fastify.post('/:resultId/draft', {
    ...editorRateLimitConfig,
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'ADMIN']),
      guardResultDepartment,
    ],
    handler: resultEditorController.autoSaveDraft,
  });

  // ── HEARTBEAT ─────────────────────────────────────────────

  // POST /api/editor/:resultId/heartbeat
  // Extends lock + session every 5 min — relaxed rate limit
  fastify.post('/:resultId/heartbeat', {
    ...editorRateLimitConfig,
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'ADMIN']),
      guardResultDepartment,
    ],
    handler: resultEditorController.heartbeat,
  });

  // ── FIELD OPERATIONS ──────────────────────────────────────

  // POST /api/editor/:resultId/flag
  // Evaluates a single field value — returns H/L/C flag + inline EVEE alert
  // Called debounced on every field change — relaxed rate limit
  fastify.post('/:resultId/flag', {
    ...editorRateLimitConfig,
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'ADMIN']),
      guardResultDepartment,
    ],
    handler: resultEditorController.flagField,
  });

  // POST /api/editor/:resultId/calculate
  // Recalculates all derived formula fields in a draft
  fastify.post('/:resultId/calculate', {
    ...editorRateLimitConfig,
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'ADMIN']),
      guardResultDepartment,
    ],
    handler: resultEditorController.calculateFields,
  });

  // ── SUBMIT ────────────────────────────────────────────────

  // POST /api/editor/:resultId/submit
  // Final submission — validates, flags, calculates, writes to Result,
  // clears session, releases lock. Returns 422 if required fields missing.
  fastify.post('/:resultId/submit', {
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'ADMIN']),
      guardResultDepartment,
    ],
    handler: resultEditorController.submitResult,
  });
}
