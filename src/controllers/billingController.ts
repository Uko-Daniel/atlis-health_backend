import { type FastifyRequest, type FastifyReply } from 'fastify';
import {
  closeBillingPeriod,
  closeAllBillingPeriods,
  getBillingHistory,
  getCurrentEstimate,
} from '../services/billingService';

export const billingController = {

  // GET /api/billing/estimate — current month estimate
  async getEstimate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const estimate = await getCurrentEstimate(request.tenantId);
      return reply.send(estimate);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  // GET /api/billing/history — past periods
  async getHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const history = await getBillingHistory(request.tenantId);
      return reply.send(history);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  // POST /api/billing/close — manually close previous month (admin)
  async closeCurrent(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await closeBillingPeriod(request.tenantId);
      if (!result.created) {
        return reply.send({ message: 'Period already closed', period: result.period });
      }
      return reply.status(201).send({ message: 'Period closed', period: result.period });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  // POST /api/admin/billing/close-all — cron endpoint (ADMIN only, internal)
  async closeAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await closeAllBillingPeriods();
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },
};
