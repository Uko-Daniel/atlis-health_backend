import { type FastifyRequest, type FastifyReply } from 'fastify';
import { resultService } from '../services/resultService';
import { type ResultStatus } from '../../generated/prisma/enums';

// ── RESULT CONTROLLER ─────────────────────────────────────────

export const resultController = {

  // POST /api/results
  async createResult(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      const result = await resultService.createResult({
        ...body,
        department: body.department ?? request.user.department,
      });
      return reply.status(201).send(result);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // GET /api/results/:id
  async getResultById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }  = request.params as { id: string };
      const { role, department } = request.user;

      // ADMIN and DOCTOR see across departments — no dept filter
      const deptFilter = (role === 'ADMIN' || role === 'DOCTOR')
        ? undefined
        : department ?? undefined;

      const result = await resultService.getResultById(id, deptFilter);
      if (!result) return reply.status(404).send({ error: 'Result not found' });
      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.message.includes('Access denied') ? 403
                   : err.message.includes('not found')     ? 404 : 500;
      return reply.status(status).send({ error: err.message });
    }
  },

  // GET /api/results/patient/:patientId
  async getResultsByPatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const query = request.query as {
        department?:   string;
        releasedOnly?: string;
        page?:         string;
        limit?:        string;
      };

      const params: {
        department?: string;
        releasedOnly?: boolean;
        page?: number;
        limit?: number;
      } = {
        releasedOnly: query.releasedOnly === 'true',
        page:         query.page  ? parseInt(query.page,  10) : 1,
        limit:        query.limit ? parseInt(query.limit, 10) : 20,
      };

      if (query.department !== undefined) params.department = query.department;

      const results = await resultService.getResultsByPatient(patientId, params);

      return reply.status(200).send(results);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  // GET /api/results/order/:orderId
  async getResultsByOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orderId } = request.params as { orderId: string };
      const results = await resultService.getResultsByOrder(orderId);
      return reply.status(200).send(results);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  // GET /api/results/department
  // Department worklist — scoped to requesting staff's department
  async getResultsByDepartment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { department, role } = request.user;
      const query = request.query as {
        status?: ResultStatus;
        page?:   string;
        limit?:  string;
      };

      // ADMIN can pass ?department= query param to view any dept
      const targetDept = role === 'ADMIN'
        ? (request.query as any).department ?? department
        : department;

      if (!targetDept) {
        return reply.status(400).send({ error: 'No department associated with your account' });
      }

      const params: {
        status?: ResultStatus;
        page?: number;
        limit?: number;
      } = {
        page:   query.page  ? parseInt(query.page,  10) : 1,
        limit:  query.limit ? parseInt(query.limit, 10) : 30,
      };

      if (query.status !== undefined) params.status = query.status;

      const results = await resultService.getResultsByDepartment(targetDept, params);

      return reply.status(200).send(results);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  // PATCH /api/results/:id/status
  async updateResultStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }     = request.params as { id: string };
      const { status } = request.body   as { status: ResultStatus };
      const result = await resultService.updateResultStatus(id, status);
      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404
                   : err.message.includes('Cannot revert') ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // PATCH /api/results/:id/data
  async updateResultData(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }  = request.params as { id: string };
      const { data, templateId } = request.body as {
        data:       unknown;
        templateId: string;
      };
      const result = await resultService.updateResultData(id, data, templateId);
      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.message.includes('not found')   ? 404
                   : err.message.includes('finalized')   ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // PATCH /api/results/:id/verify
  async verifyResult(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const result = await resultService.verifyResult({
        resultId:   id,
        verifierId: request.user.sub,
      });
      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.message.includes('not found')    ? 404
                   : err.message.includes('already')      ? 409
                   : err.message.includes('Insufficient') ||
                     err.message.includes('authority')    ? 403
                   : err.message.includes('department')   ? 403 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // PATCH /api/results/:id/finalize
  async finalizeResult(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const result = await resultService.finalizeResult({
        resultId:    id,
        finalizedBy: request.user.sub,
      });
      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.message.includes('not found')    ? 404
                   : err.message.includes('Insufficient') ? 403
                   : err.message.includes('department')   ? 403
                   : err.message.includes('Only VERIFIED') ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // PATCH /api/results/:id/release
  async releaseToPatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const result = await resultService.releaseToPatient({
        resultId:   id,
        releasedBy: request.user.sub,
      });
      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.message.includes('not found')    ? 404
                   : err.message.includes('already been') ? 409
                   : err.message.includes('Insufficient') ? 403
                   : err.message.includes('FINALIZED')    ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // GET /api/results/:id/integrity
  async checkSignatureIntegrity(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }  = request.params as { id: string };
      const integrity = await resultService.checkSignatureIntegrity(id);
      return reply.status(200).send(integrity);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500;
      return reply.status(status).send({ error: err.message });
    }
  },

  // GET /api/results/department/critical
  async getCriticalPendingResults(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { department, role } = request.user;

      const targetDept = role === 'ADMIN'
        ? (request.query as any).department ?? department
        : department;

      if (!targetDept) {
        return reply.status(400).send({ error: 'No department associated with your account' });
      }

      const results = await resultService.getCriticalPendingResults(targetDept);
      return reply.status(200).send(results);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },
};
