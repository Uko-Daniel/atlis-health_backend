import { prisma } from '../lib/prisma';

// ── TYPES ─────────────────────────────────────────────────────

export interface CreateRecordInput {
  patientId: string;
  tenantId:  string;
}

// ── SERVICE ───────────────────────────────────────────────────
// Record is the parent clinical folder for a patient. It links
// together Medications, Encounters, Reports, and Results.
//
// In practice, most callers never create a Record directly —
// encounterService.createEncounter resolves or auto-creates one.
// This service exists for direct record management, admin views,
// and cases where a record needs to exist before any encounter
// (e.g. result entry against a historical/external prescription).

export const recordService = {

  async createRecord(data: CreateRecordInput) {
    if (!data.patientId?.trim()) throw new Error('patientId is required');
    if (!data.tenantId?.trim()) throw new Error('tenantId is required');

    const patient = await prisma.patient.findFirst({ where: { id: data.patientId, tenantId: data.tenantId } });
    if (!patient) throw new Error('Patient not found');

    return prisma.record.create({
      data: { patientId: data.patientId },
    });
  },

  async getRecordById(id: string, tenantId: string) {
    return prisma.record.findFirst({
      where: { id, patient: { tenantId } },
      include: {
        medications: { orderBy: { startDate: 'desc' } },
        encounters:  { orderBy: { encounteredAt: 'desc' } },
        report:      { orderBy: { createdAt: 'desc' } },
        results:     { orderBy: { createdAt: 'desc' }, include: { template: true } },
      },
    });
  },

  // All records for a patient — most patients will only have one,
  // but the model supports multiple (e.g. separate folders per facility visit type)
  async getRecordsByPatient(patientId: string, tenantId: string) {
    return prisma.record.findMany({
      where:   { patientId, patient: { tenantId } },
      orderBy: { createdAt: 'desc' },
      include: {
        medications: { where: { status: 'ACTIVE' } },
        encounters:  { orderBy: { encounteredAt: 'desc' }, take: 5 },
      },
    });
  },

  // Returns the most recent record for a patient, or creates one if none exists.
  // This is the same resolution logic encounterService uses internally —
  // exposed here so other services/controllers can reuse it directly
  // rather than duplicating the find-or-create pattern.
  async resolveOrCreateRecord(patientId: string, tenantId: string) {
    const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId } });
    if (!patient) throw new Error('Patient not found');

    let record = await prisma.record.findFirst({
      where:   { patientId, patient: { tenantId } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      record = await prisma.record.create({
        data: { patientId },
      });
    }

    return record;
  },

  async getRecordCompleteness(tenantId: string) {
  const patients = await prisma.patient.findMany({
    where: { tenantId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      encounters: {
        orderBy: { encounteredAt: 'desc' },
        take: 1,
        select: {
          id: true,
          encounteredAt: true,
          vitals: { take: 1 },
          diagnoses: { take: 1 },
        },
      },
      allergies: { take: 1 },
    },
    take: 100,
  });

  return patients.map((p) => {
    const missing: string[] = [];
    const lastEncounter = p.encounters[0];

    if (!lastEncounter) {
      missing.push('No encounters');
    } else {
      if (!lastEncounter.vitals.length) missing.push('Vitals');
      if (!lastEncounter.diagnoses.length) missing.push('Diagnosis');
    }

    if (!p.allergies.length) missing.push('Allergies');

    return {
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      hasVitals: lastEncounter ? lastEncounter.vitals.length > 0 : false,
      hasDiagnosis: lastEncounter ? lastEncounter.diagnoses.length > 0 : false,
      hasAllergies: p.allergies.length > 0,
      lastEncounter: lastEncounter?.encounteredAt?.toISOString() ?? null,
      missingItems: missing,
    };
  });
},

  // Summary counts — useful for a patient overview screen
  async getRecordSummary(id: string, tenantId: string) {
    const record = await prisma.record.findFirst({ where: { id, patient: { tenantId } } });
    if (!record) throw new Error('Record not found');

    const [medicationCount, encounterCount, resultCount, reportCount] = await Promise.all([
      prisma.medication.count({ where: { recordId: id, record: { patient: { tenantId } } } }),
      prisma.encounter.count({  where: { recordId: id, patient: { tenantId } } }),
      prisma.result.count({     where: { recordId: id, patient: { tenantId } } }),
      prisma.report.count({     where: { recordId: id, record: { patient: { tenantId } } } }),
    ]);

    return {
      recordId:        id,
      medicationCount,
      encounterCount,
      resultCount,
      reportCount,
      createdAt:        record.createdAt,
    };
  },

  // Records are clinical-legal documents — never deleted.
  // No deleteRecord function exists by design.
};
