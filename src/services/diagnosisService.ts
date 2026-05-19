import { prisma } from '../lib/prisma';
import { type DiagnosisStatus } from '../../generated/prisma/enums';
import type { CreateDiagnosisInput, UpdateDiagnosisInput } from '../types/diagnosis';

const VALID_STATUSES: DiagnosisStatus[] = ['ACTIVE', 'RESOLVED', 'CHRONIC', 'SUSPECTED'];

function validateDiagnosisInput(data: Partial<CreateDiagnosisInput>, partial = false) {
  const errors: string[] = [];

  if (!partial) {
    if (!data.patientId?.trim())   errors.push('patientId is required');
    if (!data.encounterId?.trim()) errors.push('encounterId is required');
    if (!data.name?.trim())        errors.push('name is required');
    if (!data.diagnosedBy?.trim()) errors.push('diagnosedBy is required');
  }

  if (data.status && !VALID_STATUSES.includes(data.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  // Loose ICD-10 format check — letter + 2 digits, optional dot + more
  if (data.icdCode && !/^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/i.test(data.icdCode.trim())) {
    errors.push('icdCode does not appear to be a valid ICD-10 code (e.g. E11, J18.1)');
  }

  return { valid: errors.length === 0, errors };
}

export const diagnosisService = {

  async createDiagnosis(data: CreateDiagnosisInput) {
    const { valid, errors } = validateDiagnosisInput(data, false);
    if (!valid) throw new Error(errors.join(', '));

    // Verify encounter belongs to patient
    const encounter = await prisma.encounter.findFirst({
      where: { id: data.encounterId, patientId: data.patientId },
    });
    if (!encounter) throw new Error('Encounter not found or does not belong to patient');

    // If isPrimary, demote any existing primary for this encounter
    if (data.isPrimary) {
      await prisma.diagnosis.updateMany({
        where: { encounterId: data.encounterId, isPrimary: true },
        data:  { isPrimary: false },
      });
    }

    return prisma.diagnosis.create({
      data: {
        patientId:      data.patientId,
        encounterId:    data.encounterId,
        name:           data.name.trim(),
        icdCode:        data.icdCode?.toUpperCase().trim()  ?? null,
        icdDescription: data.icdDescription?.trim()         ?? null,
        status:         data.status    ?? 'ACTIVE',
        isPrimary:      data.isPrimary ?? false,
        notes:          data.notes     ?? null,
        diagnosedBy:    data.diagnosedBy,
        diagnosedAt:    data.diagnosedAt ? new Date(data.diagnosedAt) : new Date(),
      },
    });
  },

  async getDiagnosesByPatient(patientId: string) {
    return prisma.diagnosis.findMany({
      where:   { patientId },
      orderBy: { diagnosedAt: 'desc' },
      include: { encounter: { select: { encounteredAt: true, type: true } } },
    });
  },

  // Active problem list — what EVEE uses for history-based rules
  async getActiveDiagnosesByPatient(patientId: string) {
    return prisma.diagnosis.findMany({
      where:   { patientId, status: { in: ['ACTIVE', 'CHRONIC'] } },
      orderBy: { diagnosedAt: 'desc' },
    });
  },

  async getDiagnosesByEncounter(encounterId: string) {
    return prisma.diagnosis.findMany({
      where:   { encounterId },
      orderBy: [{ isPrimary: 'desc' }, { diagnosedAt: 'asc' }],
    });
  },

  async getDiagnosisById(id: string) {
    return prisma.diagnosis.findUnique({ where: { id } });
  },

  async updateDiagnosis(id: string, data: UpdateDiagnosisInput) {
    const { valid, errors } = validateDiagnosisInput(data, true);
    if (!valid) throw new Error(errors.join(', '));

    const existing = await prisma.diagnosis.findUnique({ where: { id } });
    if (!existing) throw new Error('Diagnosis not found');

    // If promoting to primary, demote others in same encounter
    if (data.isPrimary) {
      await prisma.diagnosis.updateMany({
        where: { encounterId: existing.encounterId, isPrimary: true },
        data:  { isPrimary: false },
      });
    }

    return prisma.diagnosis.update({
      where: { id },
      data: {
        ...(data.name           !== undefined && { name:           data.name.trim()                    }),
        ...(data.icdCode        !== undefined && { icdCode:        data.icdCode?.toUpperCase().trim()  }),
        ...(data.icdDescription !== undefined && { icdDescription: data.icdDescription                }),
        ...(data.status         !== undefined && { status:         data.status                         }),
        ...(data.isPrimary      !== undefined && { isPrimary:      data.isPrimary                      }),
        ...(data.notes          !== undefined && { notes:          data.notes                          }),
      },
    });
  },

  // Search patient history by ICD code — useful clinically and for EVEE temporal reasoning
  async findDiagnosisByICDCode(patientId: string, icdCode: string) {
    return prisma.diagnosis.findMany({
      where: {
        patientId,
        icdCode: { startsWith: icdCode.toUpperCase(), mode: 'insensitive' },
      },
      orderBy: { diagnosedAt: 'desc' },
    });
  },
};