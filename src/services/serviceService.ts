import { prisma } from '../lib/prisma';
import { type Service } from '../types/service';
import { validateService } from '../utils/validation';

export const serviceService = {
  async createService(data: Partial<Service>) {
    const { valid, errors } = validateService(data);
    if (!valid) throw new Error(errors?.join(', '));

    return prisma.service.create({
      data: {
        name: data.name!,
        labCode: data.labCode!,
        category: data.category ?? null,
        description: data.description ?? null,
        price: data.price!,
        templateId: data.templateId ?? null,
      },
    });
  },

  async getServiceById(id: string) {
    return prisma.service.findUnique({ where: { id } });
  },

  async getAllServices() {
    return prisma.service.findMany({ orderBy: { createdAt: 'desc' } });
  },

  async getByCategory(category: string) {
    return prisma.service.findMany({
        where: { category },
        orderBy: { name: 'asc' },
    })
  },

  async getAllServicesByPrice(ascending = true) {
    return prisma.service.findMany({
        orderBy: { price: ascending ? 'asc': 'desc'},
    });
  },

  async updateService(id: string, data: Partial<Service>) {
    const { valid, errors } = validateService(data);
    if (!valid) throw new Error(errors?.join(', '));

    return prisma.service.update({ where: { id }, data });
  },

  async deleteService(id: string) {
    return prisma.service.delete({ where: { id } });
  },

  async searchServiceByName(name: string) {
    return prisma.service.findMany({
      where: {
        name: { contains: name, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getServicesByTemplate(templateId: string) {
    return prisma.service.findMany({
      where: { templateId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
