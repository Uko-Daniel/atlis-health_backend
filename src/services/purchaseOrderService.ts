import { prisma } from '../lib/prisma';

export const purchaseOrderService = {

  async create(tenantId: string, orderedBy: string, data: {
    supplierId: string;
    requestId?: string;
    items: Array<{ itemName: string; quantity: number; unitPrice: number }>;
    notes?: string;
  }) {
    const totalAmount = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

    return prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: data.supplierId,
        requestId: data.requestId ?? null,
        totalAmount,
        notes: data.notes ?? null,
        orderedBy,
        items: {
          create: data.items.map((i) => ({
            itemName: i.itemName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.quantity * i.unitPrice,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: true,
      },
    });
  },

  async getAll(tenantId: string, params?: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = params ?? {};
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          supplier: { select: { id: true, name: true } },
          items: true,
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  },

  async getById(id: string, tenantId: string) {
    return prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        items: true,
        request: true,
      },
    });
  },

  async receive(id: string, tenantId: string, _receivedBy: string) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!po) throw new Error('Purchase order not found');
    if (po.status !== 'PENDING' && po.status !== 'PROCESSING') {
      throw new Error('Order is not in a receivable state');
    }

    // Update order + create inventory transactions for each item
    await prisma.$transaction([
      prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'COMPLETED', receivedAt: new Date() },
      }),
      // Note: individual item stock-in would happen manually via inventoryService.addTransaction
      // as items are physically received and counted
    ]);

    return prisma.purchaseOrder.findFirst({
      where: { id },
      include: { supplier: true, items: true },
    });
  },
};
