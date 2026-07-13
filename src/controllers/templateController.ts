import { type FastifyRequest, type FastifyReply } from 'fastify';
import * as templateService from '../services/templateService';

export const templateController = {

  // POST /api/templates
  async createTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      const template = await templateService.createTemplate({
        name:        body.name,
        description: body.description,
        department:  body.department ?? request.user.department,
        dataSchema:  body.dataSchema,
        createdBy:   request.user.sub,
        tenantId: request.tenantId,
      });
      return reply.status(201).send(template);
    } catch (err: any) {
      const status = err.message.includes('already exists')   ? 409
                   : err.message.includes('Invalid dataSchema') ? 422
                   : err.message.includes('Invalid department') ? 400 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // GET /api/templates/:id
  async getTemplateById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const template = await templateService.getTemplateById(id, request.tenantId);
      return reply.status(200).send(template);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500;
      return reply.status(status).send({ error: err.message });
    }
  },

  // GET /api/templates/department/:department
  async getTemplatesByDepartment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { department } = request.params as { department: string };
      const templates = await templateService.getTemplatesByDepartment(department, request.tenantId);
      return reply.status(200).send(templates);
    } catch (err: any) {
      const status = err.message.includes('Invalid department') ? 400 : 500;
      return reply.status(status).send({ error: err.message });
    }
  },

  // GET /api/templates?page=&limit=&department=&activeOnly=
  async getAllTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as {
        page?:       string;
        limit?:      string;
        department?: string;
        activeOnly?: string;
      };

      const params: {
        tenantId:     string;
        page:        number;
        limit:       number;
        activeOnly:  boolean;
        department?: string;
      } = {
        page:       query.page  ? parseInt(query.page,  10) : 1,
        limit:      query.limit ? parseInt(query.limit, 10) : 20,
        activeOnly: query.activeOnly !== 'false',
        tenantId:    request.tenantId,
      };
      if (query.department) params.department = query.department;

      const templates = await templateService.getAllTemplates(params);
      return reply.status(200).send(templates);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  // GET /api/templates/search?q=&department=&activeOnly=
  async searchTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as {
        q?:          string;
        department?: string;
        activeOnly?: string;
      };

      if (!query.q) return reply.status(400).send({ error: 'Query param "q" is required' });

      const params: {
        tenantId:    string;
        query:       string;
        activeOnly:  boolean;
        department?: string;
      } = {
        query:      query.q,
        activeOnly: query.activeOnly !== 'false',
        tenantId:   request.tenantId,
      };
      if (query.department) params.department = query.department;

      const templates = await templateService.searchTemplates(params);
      return reply.status(200).send(templates);
    } catch (err: any) {
      const status = err.message.includes('required') ? 400 : 500;
      return reply.status(status).send({ error: err.message });
    }
  },

  // POST /api/templates/:id/clone
  async cloneTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }   = request.params as { id: string };
      const body     = request.body   as { newName: string; department?: string };

      if (!body.newName) return reply.status(400).send({ error: 'newName is required' });

      const cloneData: {
        sourceId:   string;
        newName:    string;
        department?: string;
        clonedBy:   string;
        tenantId:    string;
      } = {
        sourceId:   id,
        newName:    body.newName,
        clonedBy:   request.user.sub,
        tenantId:   request.tenantId,
      };
      if (body.department) cloneData.department = body.department;

      const template = await templateService.cloneTemplate(cloneData);

      return reply.status(201).send(template);
    } catch (err: any) {
      const status = err.message.includes('not found')      ? 404
                   : err.message.includes('already exists') ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // PATCH /api/templates/:id
  async updateTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const template = await templateService.updateTemplate(
        id,
        request.user.sub,
        request.tenantId,
        request.body as any,
      );
      return reply.status(200).send(template);
    } catch (err: any) {
      const status = err.message.includes('not found')         ? 404
                   : err.message.includes('Invalid dataSchema') ? 422
                   : err.message.includes('result(s) recorded') ? 409
                   : err.message.includes('deactivated')        ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // PATCH /api/templates/:id/deactivate
  async deactivateTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const template = await templateService.deactivateTemplate(id, request.user.sub, request.tenantId);
      return reply.status(200).send(template);
    } catch (err: any) {
      const status = err.message.includes('not found')        ? 404
                   : err.message.includes('already deactivated') ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async activateTemplate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const template = await templateService.activateTemplate(id, request.user.sub);
    return reply.status(200).send(template);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404
                 : err.message.includes('already active') ? 409 : 400;
    return reply.status(status).send({ error: err.message });
  }
},

  // POST /api/templates/seed
  async seedDefaultTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await templateService.seedDefaultTemplates(request.user.sub, request.tenantId);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },
};
