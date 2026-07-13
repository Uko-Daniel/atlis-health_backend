import { prisma } from '../lib/prisma';

export const inventoryService = {

  async create(tenantId: string, data: {
    name: string;
    category?: string;
    unit: string;
    quantity: number;
    flagLevel?: number;
    unitPrice?: number;
    supplierId?: string;
    expiryDate?: string;
  }) {
    return prisma.inventoryItem.create({
      data: {
        tenantId,
        name: data.name.trim(),
        category: data.category ?? null,
        unit: data.unit.trim(),
        quantity: data.quantity,
        flagLevel: data.flagLevel ?? 0,
        unitPrice: data.unitPrice ?? null,
        supplierId: data.supplierId ?? null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
  },

  async getAll(tenantId: string, params?: { category?: string; search?: string }) {
    const where: any = { tenantId };
    if (params?.category) where.category = params.category;
    if (params?.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    return prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { supplier: { select: { id: true, name: true } } },
    });
  },

  async getById(id: string, tenantId: string) {
    return prisma.inventoryItem.findFirst({
      where: { id, tenantId },
      include: {
        supplier: { select: { id: true, name: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  },

  async update(id: string, tenantId: string, data: {
    name?: string;
    category?: string;
    unit?: string;
    quantity?: number;
    flagLevel?: number;
    unitPrice?: number;
    supplierId?: string | null;
    expiryDate?: string | null;
  }) {
    return prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.unit && { unit: data.unit.trim() }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.flagLevel !== undefined && { flagLevel: data.flagLevel }),
        ...(data.unitPrice !== undefined && { unitPrice: data.unitPrice }),
        ...(data.supplierId !== undefined && { supplierId: data.supplierId }),
        ...(data.expiryDate !== undefined && { expiryDate: data.expiryDate ? new Date(data.expiryDate) : null }),
      },
    });
  },

  async addTransaction(tenantId: string, data: {
    itemId: string;
    type: 'STOCK_IN' | 'STOCK_OUT' | 'EXPIRED' | 'ADJUSTMENT';
    quantity: number;
    unitPrice?: number;
    reference?: string;
    performedBy: string;
  }) {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: data.itemId, tenantId },
    });
    if (!item) throw new Error('Item not found');

    const newQty = item.quantity + data.quantity; // positive for in, negative for out

    const [transaction] = await prisma.$transaction([
      prisma.inventoryTransaction.create({
        data: {
          itemId: data.itemId,
          type: data.type,
          quantity: data.quantity,
          unitPrice: data.unitPrice ?? null,
          reference: data.reference ?? null,
          performedBy: data.performedBy,
        },
      }),
      prisma.inventoryItem.update({
        where: { id: data.itemId },
        data: { quantity: newQty },
      }),
    ]);

    return transaction;
  },

  async getLowStock(tenantId: string) {
    return prisma.inventoryItem.findMany({
      where: {
        tenantId,
        quantity: { lte: prisma.inventoryItem.fields.flagLevel },
      },
      orderBy: { quantity: 'asc' },
    });
  },
};