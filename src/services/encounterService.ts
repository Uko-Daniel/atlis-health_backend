import { prisma } from '../lib/prisma';
import { type EncounterType } from '../../generated/prisma/enums';
import type { CreateEncounterInput, UpdateEncounterInput } from '../types/encounter';

const VALID_ENCOUNTER_TYPES = [
  'OUTPATIENT', 'INPATIENT', 'EMERGENCY',
  'FOLLOW_UP', 'PROCEDURE', 'TELEMEDICINE',
];

function validateEncounterInput(data: Partial<CreateEncounterInput>, partial = false) {
  const errors: string[] = [];

  if (!partial) {
    if (!data.patientId?.trim())      errors.push('patientId is required');
    if (!data.recordId?.trim())       errors.push('recordId is required');
    if (!data.attendingStaff?.trim()) errors.push('attendingStaff is required');
  }

  if (data.type && !VALID_ENCOUNTER_TYPES.includes(data.type)) {
    errors.push(`type must be one of: ${VALID_ENCOUNTER_TYPES.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

export const encounterService = {

  async createEncounter(data: CreateEncounterInput) {
    const { valid, errors } = validateEncounterInput(data, false);
    if (!valid) throw new Error(errors.join(', '));

    // Verify patient exists
    const patient = await prisma.patient.findUnique({ where: { id: data.patientId } });
    if (!patient) throw new Error('Patient not found');

    // Verify record belongs to patient
    const record = await prisma.record.findFirst({
      where: { id: data.recordId, patientId: data.patientId },
    });
    if (!record) throw new Error('Record not found or does not belong to patient');

    return prisma.encounter.create({
      data: {
        patientId:      data.patientId,
        recordId:       data.recordId,
        attendingStaff: data.attendingStaff,
        type:           data.type          ?? 'OUTPATIENT',
        chiefComplaint: data.chiefComplaint ?? null,
        notes:          data.notes         ?? null,
        encounteredAt:  data.encounteredAt ? new Date(data.encounteredAt) : new Date(),
      },
      include: {
        vitals:    true,
        diagnoses: true,
      },
    });
  },

  async getEncounterById(id: string) {
    return prisma.encounter.findUnique({
      where: { id },
      include: {
        vitals:    { orderBy: { recordedAt: 'desc' } },
        diagnoses: { orderBy: { diagnosedAt: 'desc' } },
      },
    });
  },

  async getEncountersByPatient(
    patientId: string,
    options?: { limit?: number; type?: EncounterType }
  ) {
    return prisma.encounter.findMany({
      where: {
        patientId,
        ...(options?.type && { type: options.type }),
      },
      orderBy: { encounteredAt: 'desc' },
      take:    options?.limit ?? 50,
      include: {
        vitals:    { orderBy: { recordedAt: 'desc' }, take: 1 },
        diagnoses: { orderBy: { diagnosedAt: 'desc' } },
      },
    });
  },

  async getEncountersByRecord(recordId: string) {
    return prisma.encounter.findMany({
      where:   { recordId },
      orderBy: { encounteredAt: 'desc' },
      include: {
        vitals:    { orderBy: { recordedAt: 'desc' }, take: 1 },
        diagnoses: true,
      },
    });
  },

  // Returns the most recent encounter for EVEE evaluation
  async getLatestEncounter(patientId: string) {
    return prisma.encounter.findFirst({
      where:   { patientId },
      orderBy: { encounteredAt: 'desc' },
      include: {
        vitals:    { orderBy: { recordedAt: 'desc' }, take: 1 },
        diagnoses: true,
      },
    });
  },

  async updateEncounter(id: string, data: UpdateEncounterInput) {
    const { valid, errors } = validateEncounterInput(data, true);
    if (!valid) throw new Error(errors.join(', '));

    const existing = await prisma.encounter.findUnique({ where: { id } });
    if (!existing) throw new Error('Encounter not found');

    return prisma.encounter.update({
      where: { id },
      data: {
        ...(data.chiefComplaint !== undefined && { chiefComplaint: data.chiefComplaint }),
        ...(data.notes          !== undefined && { notes:          data.notes          }),
        ...(data.type           !== undefined && { type:           data.type           }),
      },
    });
  },
};