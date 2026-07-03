import { prisma } from '../lib/prisma';

// ── TYPES ─────────────────────────────────────────────────────

export interface CreateRecordInput {
  patientId: string;
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

    const patient = await prisma.patient.findUnique({ where: { id: data.patientId } });
    if (!patient) throw new Error('Patient not found');

    return prisma.record.create({
      data: { patientId: data.patientId },
    });
  },

  async getRecordById(id: string) {
    return prisma.record.findUnique({
      where: { id },
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
  async getRecordsByPatient(patientId: string) {
    return prisma.record.findMany({
      where:   { patientId },
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
  async resolveOrCreateRecord(patientId: string) {
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new Error('Patient not found');

    let record = await prisma.record.findFirst({
      where:   { patientId },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      record = await prisma.record.create({
        data: { patientId },
      });
    }

    return record;
  },

  // Summary counts — useful for a patient overview screen
  async getRecordSummary(id: string) {
    const record = await prisma.record.findUnique({ where: { id } });
    if (!record) throw new Error('Record not found');

    const [medicationCount, encounterCount, resultCount, reportCount] = await Promise.all([
      prisma.medication.count({ where: { recordId: id } }),
      prisma.encounter.count({  where: { recordId: id } }),
      prisma.result.count({     where: { recordId: id } }),
      prisma.report.count({     where: { recordId: id } }),
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