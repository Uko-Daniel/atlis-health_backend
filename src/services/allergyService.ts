import { prisma } from '../lib/prisma';
import type { CreateAllergyInput, UpdateAllergyInput } from '../types/allergy';


function validateAllergyInput(data: Partial<CreateAllergyInput>, partial = false) {
  const errors: string[] = [];

  if (!partial) {
    if (!data.patientId?.trim()) errors.push('patientId is required');
    if (!data.substance?.trim()) errors.push('substance is required');
    if (!data.reaction?.trim())  errors.push('reaction is required');
    if (!data.severity)          errors.push('severity is required');
    if (!data.recordedBy?.trim()) errors.push('recordedBy is required');
  }

  const validSeverities = ['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING'];
  if (data.severity && !validSeverities.includes(data.severity)) {
    errors.push(`severity must be one of: ${validSeverities.join(', ')}`);
  }

  const validStatuses = ['ACTIVE', 'INACTIVE', 'UNCONFIRMED'];
  if ((data as any).status && !validStatuses.includes((data as any).status)) {
    errors.push(`status must be one of: ${validStatuses.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

export const allergyService = {

  async createAllergy(data: CreateAllergyInput) {
    const { valid, errors } = validateAllergyInput(data, false);
    if (!valid) throw new Error(errors.join(', '));

    const patient = await prisma.patient.findUnique({ where: { id: data.patientId } });
    if (!patient) throw new Error('Patient not found');

    return prisma.allergy.create({
      data: {
        patientId:  data.patientId,
        substance:  data.substance.trim(),
        reaction:   data.reaction.trim(),
        severity:   data.severity,
        drugClass:  data.drugClass  ?? null,
        onsetDate:  data.onsetDate  ? new Date(data.onsetDate) : null,
        confirmed:  data.confirmed  ?? false,
        notes:      data.notes      ?? null,
        recordedBy: data.recordedBy,
        status:     'ACTIVE',
      },
    });
  },

  async getAllergiesByPatient(patientId: string) {
    return prisma.allergy.findMany({
      where:   { patientId },
      orderBy: { createdAt: 'desc' },
    });
  },

  // EVEE uses this — active allergies only, for rule evaluation
  async getActiveAllergiesByPatient(patientId: string) {
    return prisma.allergy.findMany({
      where:   { patientId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getAllergyById(id: string) {
    return prisma.allergy.findUnique({ where: { id } });
  },

  async updateAllergy(id: string, data: UpdateAllergyInput) {
    const { valid, errors } = validateAllergyInput(data, true);
    if (!valid) throw new Error(errors.join(', '));

    const existing = await prisma.allergy.findUnique({ where: { id } });
    if (!existing) throw new Error('Allergy not found');

    return prisma.allergy.update({
      where: { id },
      data: {
        ...(data.substance && { substance: data.substance.trim() }),
        ...(data.reaction  && { reaction:  data.reaction.trim()  }),
        ...(data.severity  && { severity:  data.severity         }),
        ...(data.status    && { status:    data.status           }),
        ...(data.drugClass !== undefined && { drugClass: data.drugClass }),
        ...(data.confirmed !== undefined && { confirmed: data.confirmed }),
        ...(data.notes     !== undefined && { notes:     data.notes     }),
      },
    });
  },

  // Soft deactivate — never hard delete clinical allergy records
  async deactivateAllergy(id: string) {
    const existing = await prisma.allergy.findUnique({ where: { id } });
    if (!existing) throw new Error('Allergy not found');

    return prisma.allergy.update({
      where: { id },
      data:  { status: 'INACTIVE' },
    });
  },
};