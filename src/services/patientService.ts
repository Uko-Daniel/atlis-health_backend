import { prisma } from '../lib/prisma';
import { type Patient } from '../types/patient';
import { validatePatient } from '../utils/validation';
import { getSkipTake, paginate, type PaginatedResult } from '../utils/pagination';

export const patientService = {

  async createPatient(data: Partial<Patient>) {
    const { valid, errors } = validatePatient(data, false);
    if (!valid) throw new Error(errors?.join(', '));

    return prisma.patient.create({
      data: {
        firstName: data.firstName!,
        lastName:  data.lastName!,
        dob:       new Date(data.dob!),
        gender:    data.gender as 'MALE' | 'FEMALE' | 'OTHER',
        phoneNumber: data.phoneNumber ?? null,
        email:       data.email       ?? null,
      },
    });
  },

  async getPatientById(id: string) {
    return prisma.patient.findUnique({
      where: { id },
      include: {
        allergies: {
          where:   { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        },
        encounters: {
          orderBy: { encounteredAt: 'desc' },
          take: 5,
          include: {
            vitals:    { orderBy: { recordedAt: 'desc' }, take: 1 },
            diagnoses: { orderBy: { diagnosedAt: 'desc' } },
          },
        },
        records: {
          include: {
            medications: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });
  },

  // Lightweight fetch — for lists, search results, etc.
  // Does not include nested clinical data.
  async getPatientSummaryById(id: string) {
    return prisma.patient.findUnique({ where: { id } });
  },

  async searchPatients(
    filters: {
      name?:   string;
      gender?: 'MALE' | 'FEMALE' | 'OTHER';
      dob?:    string;
      page?:   number;
      limit?:  number;
    }
  ): Promise<PaginatedResult<Patient>> {
    const { name, gender, dob, page = 1, limit = 50 } = filters;
    const where: any = { AND: [] };

    if (name?.trim()) {
      where.AND.push({
        OR: [
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName:  { contains: name, mode: 'insensitive' } },
        ],
      });
    }

    if (gender) where.AND.push({ gender });

    if (dob) {
      where.AND.push({ dob: new Date(dob) });
    }

    const finalWhere = where.AND.length ? where : undefined;
    const total      = await prisma.patient.count({ where: finalWhere });
    const { skip, take } = getSkipTake(page, limit);

    const patients = await prisma.patient.findMany({
      where:   finalWhere,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    return paginate(patients, total, page, limit);
  },

  async getAllPatients(page?: number, limit?: number): Promise<PaginatedResult<Patient>> {
    const total      = await prisma.patient.count();
    const { skip, take } = getSkipTake(page, limit);

    const patients = await prisma.patient.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    return paginate(patients, total, page, limit);
  },

  // Partial = true — only validates fields that are present
  async updatePatient(id: string, data: Partial<Patient>) {
    const { valid, errors } = validatePatient(data, true);
    if (!valid) throw new Error(errors?.join(', '));

    return prisma.patient.update({
      where: { id },
      data,
    });
  },

  async deletePatient(id: string) {
    return prisma.patient.delete({ where: { id } });
  },
};