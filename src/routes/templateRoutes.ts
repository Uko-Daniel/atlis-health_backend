import { type FastifyInstance } from 'fastify';
import { authenticate }            from '../middleware/authenticate';
import { authorize }               from '../middleware/authorize';
import { guardTemplateDepartment } from '../middleware/departmentGuard';
import { templateController }      from '../controllers/templateController';

// ── TEMPLATE ROUTES ───────────────────────────────────────────

export async function templateRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // ── SEED DEFAULTS ─────────────────────────────────────────
  // POST /api/templates/seed
  fastify.post('/seed', {
    preHandler: [authorize(['ADMIN'])],
    handler:    templateController.seedDefaultTemplates,
  });

  // ── SEARCH ────────────────────────────────────────────────
  // GET /api/templates/search?q=&department=&activeOnly=
  fastify.get('/search', {
    handler: templateController.searchTemplates,
  });

  // ── BY DEPARTMENT ─────────────────────────────────────────
  // GET /api/templates/department/:department
  fastify.get('/department/:department', {
    handler: templateController.getTemplatesByDepartment,
  });

  // ── LIST ALL ──────────────────────────────────────────────
  // GET /api/templates?page=&limit=&department=&activeOnly=
  fastify.get('/', {
    handler: templateController.getAllTemplates,
  });

  // ── CREATE ────────────────────────────────────────────────
  // POST /api/templates
  fastify.post('/', {
    preHandler: [authorize([
      'LAB_TECH', 'RADIOLOGIST', 'DOCTOR', 'PHARMACIST', 'ADMIN',
    ])],
    handler: templateController.createTemplate,
  });

  // ── SINGLE TEMPLATE ───────────────────────────────────────
  // GET /api/templates/:id
  fastify.get('/:id', {
    handler: templateController.getTemplateById,
  });

  // ── CLONE ─────────────────────────────────────────────────
  // POST /api/templates/:id/clone
  fastify.post('/:id/clone', {
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'DOCTOR', 'PHARMACIST', 'ADMIN']),
      guardTemplateDepartment,
    ],
    handler: templateController.cloneTemplate,
  });

  // ── UPDATE ────────────────────────────────────────────────
  // PATCH /api/templates/:id
  // Blocked at the service layer if results already exist — clone instead
  fastify.patch('/:id', {
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'DOCTOR', 'PHARMACIST', 'ADMIN']),
      guardTemplateDepartment,
    ],
    handler: templateController.updateTemplate,
  });

  // ── DEACTIVATE ────────────────────────────────────────────
  // PATCH /api/templates/:id/deactivate
  // Note: no activateTemplate exists in the service — deactivation is one-way.
  // If reactivation is needed, add activateTemplate to templateService first.
  fastify.patch('/:id/deactivate', {
    preHandler: [
      authorize(['LAB_TECH', 'RADIOLOGIST', 'DOCTOR', 'PHARMACIST', 'ADMIN']),
      guardTemplateDepartment,
    ],
    handler: templateController.deactivateTemplate,
  });
}