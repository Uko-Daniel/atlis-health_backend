import type { FastifyRequest, FastifyReply } from 'fastify'
import { tenantService } from '../services/tenantService'

export const adminController = {
  async getAllTenants(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenants = await tenantService.getAllWithCounts()
      return reply.send(tenants)
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  },

  async getTenantDetail(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const tenant = await tenantService.getTenantDetail(id)
      if (!tenant) return reply.status(404).send({ error: 'Tenant not found' })
      return reply.send(tenant)
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  },

  async createTenant(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = request.body as any
      const tenant = await tenantService.create(data)
      return reply.status(201).send(tenant)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  },

  async updatePlan(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const { planTier } = request.body as { planTier: any }
      const tenant = await tenantService.updatePlan(id, planTier)
      return reply.send(tenant)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  },

  async updateSubscription(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const { status, licenseExpiresAt } = request.body as { status: any; licenseExpiresAt?: string }
      const tenant = await tenantService.updateSubscription(id, status, licenseExpiresAt)
      return reply.send(tenant)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  },

  async updatePaystackConfig(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const { publicKey, secretKey } = request.body as { publicKey: string; secretKey?: string }
      const tenant = await tenantService.updatePaystackConfig(id, publicKey, secretKey)
      return reply.send({ success: true, tenant })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  },

  async deactivateTenant(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const tenant = await tenantService.deactivateTenant(id)
      return reply.send(tenant)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  },

  async updateBillingPeriodStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const { status } = request.body as { status: any }
      const period = await tenantService.updateBillingPeriodStatus(id, status)
      return reply.send(period)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  },
}