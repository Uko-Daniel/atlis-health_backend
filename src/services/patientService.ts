import { prisma } from '../lib/prisma';
import { type Patient } from '../types/patient';
import { validatePatient } from '../utils/validation';
import { getSkipTake, paginate, type PaginatedResult } from '../utils/pagination';

export const patientService = {

  async createPatient(data: Partial<Patient> & {
    nok?: {
      firstName:   string
      lastName:    string
      relation:    string
      phoneNumber: string
    }
  }) {
    const { valid, errors } = validatePatient(data, false)
    if (!valid) throw new Error(errors?.join(', '))
    if (!data.tenantId) throw new Error('tenantId is required')
    const tenantId = data.tenantId

    // Create patient + clinical record + NOK in one atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          firstName:     data.firstName!,
          lastName:      data.lastName!,
          dob:           new Date(data.dob!),
          gender:        data.gender as 'MALE' | 'FEMALE' | 'OTHER',
          phoneNumber:   data.phoneNumber   ?? null,
          email:         data.email         ?? null,
          maritalStatus: (data.maritalStatus as any) ?? null,
          occupation:    data.occupation    ?? null,
          religion:      data.religion      ?? null,
          tenant:        { connect: { id: tenantId } },
        },
      })

      // Auto-open clinical chart
      await tx.record.create({
        data: { patientId: patient.id },
      })

      // Create Next of Kin if provided
      if (data.nok?.firstName) {
        await tx.nextOfKin.create({
          data: {
            patientId:   patient.id,
            firstName:   data.nok.firstName,
            lastName:    data.nok.lastName,
            relation:    data.nok.relation,
            phoneNumber: data.nok.phoneNumber,
          },
        })
      }

      return patient
    })

    return result
  },

  async getPatientById(id: string, tenantId: string) {
    return prisma.patient.findFirst({
      where: { id, tenantId },
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
        nok: true,
      },
    })
  },

  // Lightweight fetch — for lists, search results, etc.
  async getPatientSummaryById(id: string, tenantId: string) {
    return prisma.patient.findFirst({
      where: { id, tenantId },
      include: { nok: true },
    })
  },

  async searchPatients(
    filters: {
      name?:     string
      gender?:   'MALE' | 'FEMALE' | 'OTHER'
      dob?:      string
      page?:     number
      limit?:    number
      tenantId:  string
    }
  ): Promise<PaginatedResult<Patient>> {
    const { name, gender, dob, tenantId, page = 1, limit = 50 } = filters
    if (!tenantId) throw new Error('tenantId is required')
    const where: any = { AND: [{ tenantId }] }

    if (name?.trim()) {
      where.AND.push({
        OR: [
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName:  { contains: name, mode: 'insensitive' } },
        ],
      })
    }

    if (gender) where.AND.push({ gender })

    if (dob) {
      where.AND.push({ dob: new Date(dob) })
    }

    const finalWhere = where
    const total      = await prisma.patient.count({ where: finalWhere })
    const { skip, take } = getSkipTake(page, limit)

    const patients = await prisma.patient.findMany({
      where:   finalWhere,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { nok: true },
    })

    return paginate(patients, total, page, limit)
  },

  async getAllPatients(tenantId: string, page?: number, limit?: number): Promise<PaginatedResult<Patient>> {
    if (!tenantId) throw new Error('tenantId is required')
    const where = { tenantId }
    const total = await prisma.patient.count({ where })
    const { skip, take } = getSkipTake(page, limit)

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { nok: true },
    })

    return paginate(patients, total, page, limit)
  },

  async updatePatient(id: string, tenantId: string, data: Partial<Patient>) {
    const { valid, errors } = validatePatient(data, true)
    if (!valid) throw new Error(errors?.join(', '))

    const existing = await prisma.patient.findFirst({ where: { id, tenantId } })
    if (!existing) throw new Error('Patient not found')

    const { tenantId: _tenantId, nok: _nok, ...safeData } = data as any

    return prisma.patient.update({
      where: { id },
      data: {
        ...safeData,
        maritalStatus: safeData.maritalStatus as any,
      },
    })
  },

  async deletePatient(id: string, tenantId: string) {
    const existing = await prisma.patient.findFirst({ where: { id, tenantId } })
    if (!existing) throw new Error('Patient not found')

    await prisma.staffNextOfKin.deleteMany({ where: { staffId: id } });

    return prisma.patient.delete({ where: { id } })
  },
}