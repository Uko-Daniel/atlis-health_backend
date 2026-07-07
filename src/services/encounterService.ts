import { prisma } from '../lib/prisma';
import { type EncounterType } from '../../generated/prisma/enums';
import type { CreateEncounterInput, UpdateEncounterInput } from '../types/encounter';

const VALID_ENCOUNTER_TYPES = [
  'OUTPATIENT', 'INPATIENT', 'EMERGENCY',
  'FOLLOW_UP', 'PROCEDURE', 'TELEMEDICINE',
];

function validateEncounterInput(
  data:    Partial<CreateEncounterInput & { stopTime?: string }>,
  partial = false,
) {
  const errors: string[] = [];

  if (!partial) {
    if (!data.patientId?.trim())      errors.push('patientId is required');
    if (!data.attendingStaff?.trim()) errors.push('attendingStaff is required');
    // recordId is optional — backend resolves or creates it
  }

  if (data.type && !VALID_ENCOUNTER_TYPES.includes(data.type)) {
    errors.push(`type must be one of: ${VALID_ENCOUNTER_TYPES.join(', ')}`);
  }

  if (data.startTime && isNaN(Date.parse(data.startTime))) {
    errors.push('startTime is not a valid datetime');
  }

  if (data.stopTime && isNaN(Date.parse(data.stopTime))) {
    errors.push('stopTime is not a valid datetime');
  }

  if (data.startTime && data.stopTime) {
    if (new Date(data.stopTime) <= new Date(data.startTime)) {
      errors.push('stopTime must be after startTime');
    }
  }

  return { valid: errors.length === 0, errors };
}

export const encounterService = {

  async createEncounter(data: {
  patientId:      string
  attendingStaff: string
  type?:          EncounterType
  chiefComplaint?: string
  notes?:         string
  startTime?:     string
  stopTime?:      string
  recordId?:      string    // optional — we look it up if not provided
}) {
  const { patientId, recordId: providedRecordId, ...rest } = data

  // Auto-resolve recordId — never require it from the client
  let recordId = providedRecordId
  if (!recordId) {
    const record = await prisma.record.findFirst({
      where:   { patientId },
      orderBy: { createdAt: 'asc' },
    })
    if (!record) {
      // Safety net — create one if somehow missing
      const newRecord = await prisma.record.create({ data: { patientId } })
      recordId = newRecord.id
    } else {
      recordId = record.id
    }
  }

  return prisma.encounter.create({
    data: {
      patientId,
      recordId,
      attendingStaff: data.attendingStaff,
      type:           data.type ?? 'OUTPATIENT',
      chiefComplaint: data.chiefComplaint ?? null,
      notes:          data.notes ?? null,
      startTime:      data.startTime ? new Date(data.startTime) : new Date(),
    },
    include: {
      vitals:    true,
      diagnoses: true,
    },
  })
},

  async getAllEncounters(params: {
    type?:  EncounterType
    limit?: number
    page?:  number
  }) {
    const { type, limit = 20, page = 1 } = params
    const where = type ? { type } : {}
    const total = await prisma.encounter.count({ where })
    const data  = await prisma.encounter.findMany({
      where,
      orderBy: { startTime: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: {
        patient: {
          select: {
            id: true, firstName: true, lastName: true,
            gender: true, dob: true,
          },
        },
      },
    })
    return { data, total, page, limit }
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
    options?: { limit?: number; type?: EncounterType },
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

  // Close an encounter — sets stopTime to now or a provided time.
  // A closed encounter is still editable for notes/diagnoses,
  // but stopTime cannot be cleared once set.
  async closeEncounter(id: string, stopTime?: string): Promise<object> {
    const existing = await prisma.encounter.findUnique({ where: { id } });
    if (!existing) throw new Error('Encounter not found');
    if (existing.stopTime) throw new Error('Encounter is already closed');

    const stop = stopTime ? new Date(stopTime) : new Date();

    if (stop <= existing.startTime) {
      throw new Error('stopTime must be after startTime');
    }

    return prisma.encounter.update({
      where: { id },
      data:  { stopTime: stop },
    });
  },

  async updateEncounter(
    id:   string,
    data: UpdateEncounterInput & { stopTime?: string },
  ) {
    const { valid, errors } = validateEncounterInput(data, true);
    if (!valid) throw new Error(errors.join(', '));

    const existing = await prisma.encounter.findUnique({ where: { id } });
    if (!existing) throw new Error('Encounter not found');

    if (data.stopTime !== undefined && existing.stopTime) {
      throw new Error('Encounter is already closed — use closeEncounter to update stopTime');
    }

    return prisma.encounter.update({
      where: { id },
      data: {
        ...(data.chiefComplaint !== undefined && { chiefComplaint: data.chiefComplaint }),
        ...(data.notes          !== undefined && { notes:          data.notes          }),
        ...(data.type           !== undefined && { type:           data.type           }),
        ...(data.stopTime       !== undefined && { stopTime:       new Date(data.stopTime) }),
      },
    });
  },
};
