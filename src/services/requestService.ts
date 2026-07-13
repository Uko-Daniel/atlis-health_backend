import { prisma } from '../lib/prisma';
import type { RequestType, RequestStatus } from '../../generated/prisma/client';

export interface CreateRequestInput {
  type: RequestType;
  title: string;
  description?: string;
  amount?: number;
  referenceId?: string;
}

export const requestService = {

  async create(tenantId: string, requestedBy: string, data: CreateRequestInput) {
    return prisma.request.create({
      data: {
        tenantId,
        type: data.type,
        title: data.title.trim(),
        description: data.description?.trim() ?? null,
        amount: data.amount ?? null,
        referenceId: data.referenceId ?? null,
        requestedBy,
        status: 'PENDING',
      },
    });
  },

  async getAll(tenantId: string, params?: {
    type?: RequestType;
    status?: RequestStatus;
    page?: number;
    limit?: number;
  }) {
    const { type, status, page = 1, limit = 20 } = params ?? {};
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (type) where.type = type;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.request.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.request.count({ where }),
    ]);

    return { data, total, page, limit };
  },

  async getById(id: string, tenantId: string) {
    return prisma.request.findFirst({ where: { id, tenantId } });
  },

  async approve(id: string, tenantId: string, approvedBy: string) {
    const request = await prisma.request.findFirst({ where: { id, tenantId } });
    if (!request) throw new Error('Request not found');
    if (request.status !== 'PENDING') throw new Error('Request is not pending');

    return prisma.request.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });
  },

  async reject(id: string, tenantId: string, rejectedBy: string, reason: string) {
    const request = await prisma.request.findFirst({ where: { id, tenantId } });
    if (!request) throw new Error('Request not found');
    if (request.status !== 'PENDING') throw new Error('Request is not pending');

    return prisma.request.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: rejectedBy,
        approvedAt: new Date(),
        rejectionReason: reason.trim(),
      },
    });
  },

  async fulfill(id: string, tenantId: string) {
    const request = await prisma.request.findFirst({ where: { id, tenantId } });
    if (!request) throw new Error('Request not found');
    if (request.status !== 'APPROVED') throw new Error('Request must be approved first');

    return prisma.request.update({
      where: { id },
      data: {
        status: 'FULFILLED',
        fulfilledAt: new Date(),
      },
    });
  },

  async getMyRequests(tenantId: string, requestedBy: string) {
    return prisma.request.findMany({
      where: { tenantId, requestedBy },
      orderBy: { createdAt: 'desc' },
    });
  },
};