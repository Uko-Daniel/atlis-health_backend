import { type FastifyRequest, type FastifyReply } from 'fastify';
import { eveeService } from '../services/eveeService';

export const eveeController = {

  // POST /api/evee/evaluate/:patientId
  // Runs a full EVEE evaluation — assembles patient context, calls the
  // rule engine, persists the evaluation + alerts, returns results.
  async evaluate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const result = await eveeService.evaluate(patientId, request.user.sub);
      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.message.includes('not found')   ? 404
                   : err.message.includes('timed out')   ? 504
                   : err.message.includes('Failed to reach') ? 502 : 500;
      return reply.status(status).send({ error: err.message });
    }
  },

  // GET /api/evee/evaluations/patient/:patientId
  // Evaluation history for a patient
  async getEvaluationsByPatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const { limit }     = request.query  as { limit?: string };
      const evaluations = await eveeService.getEvaluationsByPatient(
        patientId,
        limit ? parseInt(limit, 10) : 10,
      );
      return reply.status(200).send(evaluations);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  // GET /api/evee/evaluations/:id
  // Single evaluation with full alert detail
  async getEvaluationById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const evaluation = await eveeService.getEvaluationById(id);
      if (!evaluation) return reply.status(404).send({ error: 'Evaluation not found' });
      return reply.status(200).send(evaluation);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  // PATCH /api/evee/alerts/:id/override
  // Doctor dismisses an alert with a mandatory documented reason
  async overrideAlert(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }              = request.params as { id: string };
      const { overrideReason }  = request.body   as { overrideReason: string };

      const alert = await eveeService.overrideAlert({
        alertId:        id,
        overriddenBy:   request.user.sub,
        overrideReason,
      });

      return reply.status(200).send(alert);
    } catch (err: any) {
      const status = err.message.includes('not found')           ? 404
                   : err.message.includes('already been')        ? 409
                   : err.message.includes('reason is required')  ? 400 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // GET /api/evee/alerts/critical/:patientId
  // Unacknowledged critical alerts — for dashboard warnings
  async getOpenCriticalAlerts(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const alerts = await eveeService.getOpenCriticalAlerts(patientId);
      return reply.status(200).send(alerts);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },
};