import { type FastifyInstance } from 'fastify'
import { adminController } from '../controllers/adminController'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'

export default async function adminRoutes(fastify: FastifyInstance) {
  // All routes require authentication and SUPER_ADMIN role
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', authorize(['SUPER_ADMIN']))

  // Tenant management
  fastify.get('/tenants', adminController.getAllTenants)
  fastify.get('/tenants/:id', adminController.getTenantDetail)
  fastify.post('/tenants', adminController.createTenant)
  fastify.put('/tenants/:id/plan', adminController.updatePlan)
  fastify.put('/tenants/:id/subscription', adminController.updateSubscription)
  fastify.put('/tenants/:id/paystack', adminController.updatePaystackConfig)
  fastify.delete('/tenants/:id', adminController.deactivateTenant)

  // Billing periods
  fastify.put('/billing-periods/:id/status', adminController.updateBillingPeriodStatus)
}