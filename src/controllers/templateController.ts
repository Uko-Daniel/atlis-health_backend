import type { FastifyRequest, FastifyReply } from 'fastify';
import {
    createTemplate,
    deactivateTemplate,
    type DataSchema,
    getAllTemplates,
    getTemplateById,
    getTemplatesByDepartment,
    searchTemplates,
    updateTemplate,
} from '../services/templateService';

function getStaffId(req: FastifyRequest): string {
    const body = req.body as { staffId?: string } | undefined;
    const query = req.query as { staffId?: string } | undefined;
    const header = req.headers['x-staff-id'];
    const staffId = body?.staffId ?? query?.staffId ?? (Array.isArray(header) ? header[0] : header);

    if (!staffId?.trim()) throw new Error('staffId is required');
    return staffId.trim();
}

export const templateController = {
    async create(req: FastifyRequest, reply: FastifyReply) {
        try {
            const template = await createTemplate(req.body as any);
            reply.send({ success: true, data: template });
        } catch (err: any) {
            reply.status(400).send({ success: false, message: err.message });
        }
    },

    async getById(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const template = await getTemplateById(id);
            reply.send({ success: true, data: template });
        } catch (err: any) {
            reply.status(404).send({ success: false, message: err.message });
        }
    },

    async getAll(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { page, limit, department, activeOnly } = req.query as {
                page?: string;
                limit?: string;
                department?: string;
                activeOnly?: string;
            };

            const params: {
                page: number;
                limit: number;
                department?: string;
                activeOnly: boolean;
            } = {
                page:       Number(page) || 1,
                limit:      Number(limit) || 20,
                activeOnly: activeOnly === undefined ? true : activeOnly !== 'false',
            };
            if (department !== undefined) params.department = department;

            const templates = await getAllTemplates(params);

            reply.send({ success: true, data: templates });
        } catch (err: any) {
            reply.status(400).send({ success: false, message: err.message });
        }
    },

    async searchByName(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { name, query, department, activeOnly } = req.query as {
                name?: string;
                query?: string;
                department?: string;
                activeOnly?: string;
            };

            const params: {
                query: string;
                department?: string;
                activeOnly: boolean;
            } = {
                query:      query ?? name ?? '',
                activeOnly: activeOnly === undefined ? true : activeOnly !== 'false',
            };
            if (department !== undefined) params.department = department;

            const templates = await searchTemplates(params);

            reply.send({ success: true, data: templates });
        } catch (err: any) {
            reply.status(400).send({ success: false, message: err.message });
        }
    },

    async getByType(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { type, department } = req.query as { type?: string; department?: string };
            const resolvedDepartment =
                department ??
                (type === 'LAB' ? 'LABORATORY' :
                 type === 'IMAGING' ? 'RADIOLOGY' :
                 type === 'OTHER' ? 'GENERAL' :
                 undefined);

            if (!resolvedDepartment) {
                return reply.status(400).send({ success: false, message: 'Invalid template type or department' });
            }

            const templates = await getTemplatesByDepartment(resolvedDepartment);
            reply.send({ success: true, data: templates });
        } catch (err: any) {
            reply.status(400).send({ success: false, message: err.message });
        }
    },

    async update(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const body = req.body as {
                staffId?: string;
                name?: string;
                description?: string;
                dataSchema?: DataSchema;
            };
            const updates: {
                name?: string;
                description?: string;
                dataSchema?: unknown;
            } = {};

            if (body.name !== undefined) updates.name = body.name;
            if (body.description !== undefined) updates.description = body.description;
            if (body.dataSchema !== undefined) updates.dataSchema = body.dataSchema;

            const template = await updateTemplate(id, getStaffId(req), updates);
            reply.send({ success: true, data: template });
        } catch (err: any) {
            reply.status(400).send({ success: false, message: err.message });
        }
    },

    async remove(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const template = await deactivateTemplate(id, getStaffId(req));
            reply.send({ success: true, data: template });
        } catch (err: any) {
            reply.status(400).send({ success: false, message: err.message });
        }
    },
};
