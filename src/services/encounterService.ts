import { prisma } from '../lib/prisma';
import { type EncounterType } from '../../generated/prisma/enums';
import type { CreateEncounterInput, UpdateEncounterInput } from '../types/encounter';

const VALID_ENCOUNTER_TYPES = [
  'OUTPATIENT', 'INPATIENT', 'EMERGENCY',
  'FOLLOW_UP', 'PROCEDURE', 'TELEMEDICINE',
];

function validateEncounterInput(
  data: Partial<CreateEncounterInput & { stopTime?: string }>,
  partial = false,
) {
  const errors: string[] = [];

  if (!partial) {
    if (!data.patientId?.trim()) errors.push('patientId is required');
    if (!data.attendingStaff?.trim()) errors.push('attendingStaff is required');
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

  if (data.startTime && data.stopTime && new Date(data.stopTime) <= new Date(data.startTime)) {
    errors.push('stopTime must be after startTime');
  }

  return { valid: errors.length === 0, errors };
}

export const encounterService = {

  async createEncounter(data: {
    patientId: string;
    attendingStaff: string;
    type?: EncounterType;
    chiefComplaint?: string;
    notes?: string;
    startTime?: string;
    stopTime?: string;
    recordId?: string;
    tenantId: string;
  }) {
    const { patientId, recordId: providedRecordId, tenantId } = data;
    if (!tenantId) throw new Error('tenantId is required');

    const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId } });
    if (!patient) throw new Error('Patient not found');

    let recordId = providedRecordId;
    if (!recordId) {
      const record = await prisma.record.findFirst({
        where: { patientId, patient: { tenantId } },
        orderBy: { createdAt: 'asc' },
      });

      if (!record) {
        const newRecord = await prisma.record.create({ data: { patientId } });
        recordId = newRecord.id;
      } else {
        recordId = record.id;
      }
    } else {
      const record = await prisma.record.findFirst({
        where: { id: recordId, patientId, patient: { tenantId } },
      });
      if (!record) throw new Error('Record not found');
    }

    let meetLinkNote: string | null = null;

    // ── Google Calendar sync (non-blocking) ─────────────────────
  if (data.startTime) {
      try {
        const { createCalendarEvent } = await import('./googleService');
        const { getConnectionStatus } = await import('./googleService');
        
        const status = await getConnectionStatus(data.attendingStaff);
        if (status.connected) {
          const endTime = data.stopTime
            ? new Date(data.stopTime)
            : new Date(new Date(data.startTime).getTime() + 60 * 60 * 1000); // default 1hr

          const patientName = patient.firstName + ' ' + patient.lastName;
          
          const { meetLink } = await createCalendarEvent(data.attendingStaff, {
            summary: `${data.type ?? 'Appointment'}: ${patientName}`,
            description: data.chiefComplaint ?? 'Clinical consultation',
            startTime: new Date(data.startTime).toISOString(),
            endTime: endTime.toISOString(),
          });

          // Store Meet link on the encounter
          if (meetLink) {
            meetLinkNote = meetLink;
          }
        }
      } catch (err: any) {
        console.error(`[GoogleCalendar] Sync failed for this encounter:`, err.message);
      }
    }

    return prisma.encounter.create({
      data: {
        patientId,
        recordId,
        attendingStaff: data.attendingStaff,
        type: data.type ?? 'OUTPATIENT',
        chiefComplaint: data.chiefComplaint ?? null,
        notes: meetLinkNote
          ? data.notes
            ? `${data.notes}\n\nMeet: ${meetLinkNote}`
            : `Meet: ${meetLinkNote}`
          : data.notes ?? null,
        startTime: data.startTime ? new Date(data.startTime) : new Date(),
      },
      include: {
        vitals: true,
        diagnoses: true,
      },
    });
  },

  async getAllEncounters(params: {
    tenantId: string;
    type?: EncounterType;
    limit?: number;
    page?: number;
  }) {
    const { tenantId, type, limit = 20, page = 1 } = params;
    if (!tenantId) throw new Error('tenantId is required');

    const where = {
      patient: { tenantId },
      ...(type && { type }),
    };

    const total = await prisma.encounter.count({ where });
    const data = await prisma.encounter.findMany({
      where,
      orderBy: { startTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        patient: {
          select: {
            id: true, firstName: true, lastName: true,
            gender: true, dob: true,
          },
        },
      },
    });

    return { data, total, page, limit };
  },

  async getEncounterById(id: string, tenantId: string) {
    return prisma.encounter.findFirst({
      where: { id, patient: { tenantId } },
      include: {
        vitals: { orderBy: { recordedAt: 'desc' } },
        diagnoses: { orderBy: { diagnosedAt: 'desc' } },
      },
    });
  },

  async getEncountersByPatient(
    patientId: string,
    tenantId: string,
    options?: { limit?: number; type?: EncounterType },
  ) {
    return prisma.encounter.findMany({
      where: {
        patientId,
        patient: { tenantId },
        ...(options?.type && { type: options.type }),
      },
      orderBy: { encounteredAt: 'desc' },
      take: options?.limit ?? 50,
      include: {
        vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
        diagnoses: { orderBy: { diagnosedAt: 'desc' } },
      },
    });
  },

  async getEncountersByRecord(recordId: string, tenantId: string) {
    return prisma.encounter.findMany({
      where: { recordId, patient: { tenantId } },
      orderBy: { encounteredAt: 'desc' },
      include: {
        vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
        diagnoses: true,
      },
    });
  },

  async getLatestEncounter(patientId: string, tenantId: string) {
    return prisma.encounter.findFirst({
      where: { patientId, patient: { tenantId } },
      orderBy: { encounteredAt: 'desc' },
      include: {
        vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
        diagnoses: true,
      },
    });
  },

  async closeEncounter(id: string, tenantId: string, stopTime?: string): Promise<object> {
    const existing = await prisma.encounter.findFirst({
      where: { id, patient: { tenantId } },
    });
    if (!existing) throw new Error('Encounter not found');
    if (existing.stopTime) throw new Error('Encounter is already closed');

    const stop = stopTime ? new Date(stopTime) : new Date();
    if (stop <= existing.startTime) throw new Error('stopTime must be after startTime');

    return prisma.encounter.update({
      where: { id },
      data: { stopTime: stop },
    });
  },

  async updateEncounter(
    id: string,
    tenantId: string,
    data: UpdateEncounterInput & { stopTime?: string },
  ) {
    const { valid, errors } = validateEncounterInput(data, true);
    if (!valid) throw new Error(errors.join(', '));

    const existing = await prisma.encounter.findFirst({
      where: { id, patient: { tenantId } },
    });
    if (!existing) throw new Error('Encounter not found');

    if (data.stopTime !== undefined && existing.stopTime) {
      throw new Error('Encounter is already closed - use closeEncounter to update stopTime');
    }

    // ── Google Calendar sync on update (non-blocking) ──────────
if (data.startTime || data.stopTime || data.notes || data.chiefComplaint) {
  try {
    const { createCalendarEvent, getConnectionStatus } = await import('./googleService');
    
    const status = await getConnectionStatus(existing.attendingStaff);
    if (status.connected) {
      const patient = await prisma.patient.findFirst({
        where: { id: existing.patientId, tenantId },
        select: { firstName: true, lastName: true },
      });
      
      if (patient) {
        const patientName = patient.firstName + ' ' + patient.lastName;
        const start = data.startTime 
          ? new Date(data.startTime).toISOString()
          : existing.startTime.toISOString();
        const end = data.stopTime
          ? new Date(data.stopTime).toISOString()
          : existing.stopTime?.toISOString() 
            ?? new Date(existing.startTime.getTime() + 60 * 60 * 1000).toISOString();

        await createCalendarEvent(existing.attendingStaff, {
          summary: `${existing.type}: ${patientName}`,
          description: data.chiefComplaint ?? existing.chiefComplaint ?? 'Clinical consultation',
          startTime: start,
          endTime: end,
        });
      }
    }
  } catch (err: any) {
    console.error(`[GoogleCalendar] Sync failed for this encounter:`, err.message);
  }
}

    return prisma.encounter.update({
      where: { id },
      data: {
        ...(data.chiefComplaint !== undefined && { chiefComplaint: data.chiefComplaint }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.stopTime !== undefined && { stopTime: new Date(data.stopTime) }),
      },
    });
  },
};
