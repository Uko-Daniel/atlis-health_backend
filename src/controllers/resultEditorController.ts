import { type FastifyRequest, type FastifyReply } from 'fastify';
import {
  openSession,
  autoSaveDraft,
  heartbeat,
  flagFieldEntry,
  recalculateDerivedFields,
  submitResult,
  closeSession,
  getSessionByResult,
  getFormulaMetadata,
} from '../services/resultEditorService';
import type { DraftData } from '../types/editor';

// ── RESULT EDITOR CONTROLLER ──────────────────────────────────
// All handlers assume request.user is populated by authenticate middleware.
// staffId is always taken from request.user.sub — never trusted from body.

export const resultEditorController = {

  // POST /api/editor/:resultId/session
  // Opens an edit session and acquires the edit lock.
  // Idempotent — if the same staff member already has a session, resumes it.
  async openSession(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { resultId } = request.params as { resultId: string };
      const session = await openSession(resultId, request.user.sub);
      return reply.status(200).send(session);
    } catch (err: any) {
      const status = err.message.includes('not found')   ? 404
                   : err.message.includes('finalized')   ? 409
                   : err.message.includes('edit lock')   ? 423  // 423 Locked
                   : err.message.includes('being edited') ? 423 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // GET /api/editor/:resultId/session
  // Returns current session state — used on page load to check for a resumable draft.
  async getSession(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { resultId } = request.params as { resultId: string };
      const session = await getSessionByResult(resultId);
      if (!session) return reply.status(404).send({ error: 'No active session for this result' });
      return reply.status(200).send(session);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  // POST /api/editor/:resultId/draft
  // Auto-saves in-progress draft. Runs flagging + formula calculation before saving.
  // Frontend calls this every 30 seconds while editing.
  async autoSaveDraft(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { resultId } = request.params  as { resultId:  string };
      const { draft, patientId } = request.body as {
        draft:     DraftData;
        patientId: string;
      };

      if (!draft)     throw new Error('draft is required');
      if (!patientId) throw new Error('patientId is required');

      const result = await autoSaveDraft(
        resultId,
        request.user.sub,
        draft,
        patientId,
      );

      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.message.includes('not found')    ? 404
                   : err.message.includes('lock')         ? 423
                   : err.message.includes('expired')      ? 410 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // POST /api/editor/:resultId/heartbeat
  // Extends the edit lock and session expiry by 30 minutes.
  // Frontend calls this every 5 minutes while the editor is open.
  async heartbeat(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { resultId } = request.params as { resultId: string };
      const result = await heartbeat(resultId, request.user.sub);
      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404
                   : err.message.includes('lock')      ? 423 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // POST /api/editor/:resultId/flag
  // Evaluates a single field value against its reference and critical ranges.
  // Returns the flag (H/L/C/N/null) and an inline EVEE alert if critical.
  // Frontend calls this debounced on every field value change.
  async flagField(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { resultId } = request.params as { resultId: string };
      const { fieldId, value, patientId } = request.body as {
        fieldId:   string;
        value:     number | string | boolean | null;
        patientId: string;
      };

      if (!fieldId)   throw new Error('fieldId is required');
      if (!patientId) throw new Error('patientId is required');

      const result = await flagFieldEntry({
        resultId,
        staffId:   request.user.sub,
        fieldId,
        value,
        patientId,
      });

      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404
                   : err.message.includes('lock')      ? 423 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // POST /api/editor/:resultId/calculate
  // Recalculates all formula-driven fields in a draft.
  // Frontend calls this when source fields for a formula change.
  async calculateFields(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { resultId } = request.params as { resultId: string };
      const { draft, patientId } = request.body as {
        draft:     DraftData;
        patientId: string;
      };

      if (!draft)     throw new Error('draft is required');
      if (!patientId) throw new Error('patientId is required');

      const updatedDraft = await recalculateDerivedFields(
        resultId,
        request.user.sub,
        draft,
        patientId,
      );

      return reply.status(200).send({ draft: updatedDraft });
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404
                   : err.message.includes('lock')      ? 423 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // POST /api/editor/:resultId/submit
  // Submits the completed result from the editor.
  // Validates required fields, runs final flag pass, writes to Result record,
  // clears the session, releases the lock.
  // Does NOT verify — that is a separate step in resultController.
  async submitResult(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { resultId } = request.params as { resultId: string };
      const { draft, patientId, interpretation } = request.body as {
        draft:            DraftData;
        patientId:        string;
        interpretation?:  string;
      };

      if (!draft)     throw new Error('draft is required');
      if (!patientId) throw new Error('patientId is required');

      const submitParams: {
        resultId: string;
        staffId: string;
        patientId: string;
        draft: DraftData;
        interpretation?: string;
      } = {
        resultId,
        staffId:        request.user.sub,
        patientId,
        draft,
      };

      if (interpretation !== undefined) submitParams.interpretation = interpretation;

      const result = await submitResult(submitParams);

      // Return 422 if required fields are missing — result not submitted
      if (!result.success) {
        return reply.status(422).send({
          error:        'Submission failed — required fields are missing',
          missingFields: result.missingFields,
          criticalAlerts: result.criticalAlerts,
        });
      }

      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404
                   : err.message.includes('lock')      ? 423
                   : err.message.includes('finalized') ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // DELETE /api/editor/:resultId/session
  // Cleanly closes the session without submitting.
  // Releases the lock but preserves draft data so another session can resume it.
  // Frontend calls this on tab close / navigate away (via beforeunload).
  async closeSession(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { resultId } = request.params as { resultId: string };
      await closeSession(resultId, request.user.sub);
      return reply.status(200).send({ message: 'Session closed' });
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404
                   : err.message.includes('lock')      ? 423 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // GET /api/editor/formula/:formulaKey
  // Returns the required input fields for a formula.
  // Template builder uses this to show which source fields must exist
  // before a calculated field can be added.
  async getFormulaMetadata(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { formulaKey } = request.params as { formulaKey: string };
      const inputs = getFormulaMetadata(formulaKey);
      return reply.status(200).send({ formulaKey, inputs });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  },
};
