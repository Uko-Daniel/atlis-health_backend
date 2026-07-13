import { prisma } from '../lib/prisma';

export const auditLogService = {

  async getAll(tenantId: string, params?: {
    userId?: string;
    action?: string;
    entityType?: string;
    page?: number;
    limit?: number;
  }) {
    const { userId, action, entityType, page = 1, limit = 50 } = params ?? {};
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  },
};