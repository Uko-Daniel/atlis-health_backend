import { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate'
import { signupService } from '../services/signUp'

// ── Validation schemas ───────────────────────────────────────

const createSignupSchema = z.object({
  firstName:     z.string().min(1, 'First name is required').max(50),
  lastName:      z.string().min(1, 'Last name is required').max(50),
  email:         z.string().email('Valid email is required'),
  phone:         z.string().min(10, 'Phone number is required'),
  profession:    z.string().min(1, 'Profession is required'),
  department:    z.enum([
    'LABORATORY', 'RADIOLOGY', 'CARDIOLOGY', 'PHARMACY',
    'GENERAL', 'EMERGENCY', 'PAEDIATRICS', 'OBSTETRICS',
    'SURGERY', 'ADMINISTRATION',
  ]),
  facility:      z.string().optional(),
  licenseNumber: z.string().optional(),
  message:       z.string().optional(),
})

const listQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  page:   z.coerce.number().int().min(1).optional().default(1),
  limit:  z.coerce.number().int().min(1).max(100).optional().default(20),
})

const reviewParamsSchema = z.object({
  id: z.string().min(1),
})

const reviewBodySchema = z.object({
  action:      z.enum(['APPROVE', 'REJECT']),
  reviewNotes: z.string().optional(),
})

// ── Routes ────────────────────────────────────────────────────

export async function signupRoutes(fastify: FastifyInstance) {

  // POST /api/signup — PUBLIC
  // Prospective staff submit a sign-up request.
  // Strict rate limit to prevent abuse.
  fastify.post('/signup', {
    config: {
      rateLimit: {
        max:        5,
        timeWindow: '15 minutes',
      },
    },
    handler: async (request, reply) => {
      const parse = createSignupSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(400).send({
          error:   'Validation failed',
          details: parse.error.flatten().fieldErrors,
        })
      }

      try {
        const result = await signupService.create(parse.data)
        return reply.status(201).send({
          message: 'Sign-up request submitted successfully. You will be notified when it is reviewed.',
          id:      result.id,
        })
      } catch (err: any) {
        if (
          err.message.includes('already exists') ||
          err.message.includes('already associated')
        ) {
          return reply.status(409).send({ error: err.message })
        }
        throw err
      }
    },
  })

  // GET /api/admin/signup-requests — AUTHENTICATED
  // List sign-up requests for admin review.
  fastify.get('/admin/signup-requests', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const query = listQuerySchema.parse(request.query)
      return signupService.list(query)
    },
  })

  // GET /api/admin/signup-requests/:id — AUTHENTICATED
  // Get a single sign-up request for review.
  fastify.get('/admin/signup-requests/:id', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = reviewParamsSchema.parse(request.params)
      const result = await signupService.getById(id)
      if (!result) {
        return reply.status(404).send({ error: 'Sign-up request not found.' })
      }
      return result
    },
  })

  // PATCH /api/admin/signup-requests/:id — AUTHENTICATED
  // Approve or reject a sign-up request.
  fastify.patch('/admin/signup-requests/:id', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = reviewParamsSchema.parse(request.params)
      const body = reviewBodySchema.parse(request.body)
      const reviewerId = request.user.sub

      try {
        if (body.action === 'APPROVE') {
          const result = await signupService.approve(id, reviewerId, body.reviewNotes)
          return {
            message: `Request approved. Staff account created for ${result.firstName} ${result.lastName}.`,
            ...result,
          }
        } else {
          const result = await signupService.reject(id, reviewerId, body.reviewNotes)
          return {
            message: 'Request rejected.',
            ...result,
          }
        }
      } catch (err: any) {
        if (err.message.includes('not found')) {
          return reply.status(404).send({ error: err.message })
        }
        if (err.message.includes('already been')) {
          return reply.status(409).send({ error: err.message })
        }
        throw err
      }
    },
  })
}