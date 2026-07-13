import { prisma } from '../lib/prisma';
import { type MedStatus } from '../../generated/prisma/enums';

// ── TYPES ─────────────────────────────────────────────────────

export interface CreateMedicationInput {
  recordId:      string;
  name:          string;
  dosage:        string;
  route:         string;
  frequency:     string;
  instructions?: string;
  startDate:     string;   // ISO date string
  endDate?:      string;   // null = ongoing
  prescribedBy:  string;   // Staff ID or external doctor name

  // Optional — links medication to a specific encounter
  // If null, medication was prescribed externally (another org/doctor)
  encounterId?:  string;

  // External prescription metadata
  externalSource?: boolean;  // true = prescribed outside this facility
  externalDoctor?: string;   // name of prescribing doctor if external
  externalFacility?: string; // facility name if external
}

export interface UpdateMedicationInput {
  dosage?:       string;
  frequency?:    string;
  instructions?: string;
  endDate?:      string;
}

// ── VALIDATION ────────────────────────────────────────────────

function validateMedication(data: Partial<CreateMedicationInput>, partial = false) {
  const errors: string[] = [];

  if (!partial) {
    if (!data.recordId?.trim())     errors.push('recordId is required');
    if (!data.name?.trim())         errors.push('medication name is required');
    if (!data.dosage?.trim())       errors.push('dosage is required');
    if (!data.route?.trim())        errors.push('route is required');
    if (!data.frequency?.trim())    errors.push('frequency is required');
    if (!data.startDate?.trim())    errors.push('startDate is required');
    if (!data.prescribedBy?.trim()) errors.push('prescribedBy is required');
  }

  if (data.startDate && isNaN(Date.parse(data.startDate))) {
    errors.push('startDate is not a valid date');
  }

  if (data.endDate && isNaN(Date.parse(data.endDate))) {
    errors.push('endDate is not a valid date');
  }

  if (data.startDate && data.endDate) {
    if (new Date(data.endDate) < new Date(data.startDate)) {
      errors.push('endDate cannot be before startDate');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── SERVICE ───────────────────────────────────────────────────

export const medicationService = {

  // Creates a medication against a record.
  // encounterId is optional — omit for external/historical prescriptions.
  async createMedication(data: CreateMedicationInput & { tenantId: string }) {
    const { valid, errors } = validateMedication(data, false);
    if (!valid) throw new Error(errors.join(', '));

    // Verify record exists
    const record = await prisma.record.findUnique({
      where: { id: data.recordId },
      include: { patient: true },
    });
    if (!record) throw new Error('Record not found');
    if (record.patient.tenantId !== data.tenantId) throw new Error('Record not found');

    // If encounterId provided, verify it belongs to same patient as record
    if (data.encounterId) {
      const encounter = await prisma.encounter.findFirst({
        where: {
          id:       data.encounterId,
          recordId: data.recordId,
        },
      });
      if (!encounter) {
        throw new Error('Encounter not found or does not belong to this record');
      }
    }

    return prisma.medication.create({
      data: {
        recordId:     data.recordId,
        name:         data.name.trim(),
        dosage:       data.dosage.trim(),
        route:        data.route.trim(),
        frequency:    data.frequency.trim(),
        instructions: data.instructions?.trim() ?? null,
        startDate:    new Date(data.startDate),
        endDate:      data.endDate ? new Date(data.endDate) : null,
        prescribedBy: data.prescribedBy.trim(),
        status:       'ACTIVE',
      },
    });
  },

  async getMedicationsByRecord(recordId: string, tenantId: string, status?: MedStatus) {
    return prisma.medication.findMany({
      where: {
        recordId,
        record: { patient: { tenantId } },
        ...(status && { status }),
      },
      orderBy: { startDate: 'desc' },
    });
  },

  // All active medications for a patient across all records
  // This is what EVEE uses for drug interaction checks
  async getActiveMedicationsByPatient(patientId: string, tenantId: string) {
    return prisma.medication.findMany({
      where: {
        record:  { patientId, patient: { tenantId } },
        status:  'ACTIVE',
      },
      orderBy: { startDate: 'desc' },
    });
  },

  async getMedicationById(id: string, tenantId: string) {
    return prisma.medication.findFirst({ where: { id, record: { patient: { tenantId } } } });
  },

  async updateMedication(id: string, tenantId: string, data: UpdateMedicationInput) {
    const { valid, errors } = validateMedication(data, true);
    if (!valid) throw new Error(errors.join(', '));

    const existing = await prisma.medication.findFirst({ where: { id, record: { patient: { tenantId } } } });
    if (!existing) throw new Error('Medication not found');

    if (existing.status === 'DISCONTINUED') {
      throw new Error('Cannot update a discontinued medication');
    }

    return prisma.medication.update({
      where: { id },
      data: {
        ...(data.dosage       && { dosage:       data.dosage.trim()       }),
        ...(data.frequency    && { frequency:    data.frequency.trim()    }),
        ...(data.instructions !== undefined && { instructions: data.instructions }),
        ...(data.endDate      && { endDate:      new Date(data.endDate)   }),
      },
    });
  },

  async updateMedicationStatus(id: string, tenantId: string, status: MedStatus) {
    const validStatuses: MedStatus[] = ['ACTIVE', 'COMPLETED', 'DISCONTINUED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const existing = await prisma.medication.findFirst({ where: { id, record: { patient: { tenantId } } } });
    if (!existing) throw new Error('Medication not found');

    return prisma.medication.update({
      where: { id },
      data:  { status },
    });
  },

  // Discontinue with a reason — clinical safety record
  async discontinueMedication(
    id:     string,
    tenantId: string,
    reason: string,
  ) {
    if (!reason?.trim()) {
      throw new Error('Discontinuation reason is required');
    }

    const existing = await prisma.medication.findFirst({ where: { id, record: { patient: { tenantId } } } });
    if (!existing) throw new Error('Medication not found');

    if (existing.status === 'DISCONTINUED') {
      throw new Error('Medication is already discontinued');
    }

    return prisma.medication.update({
      where: { id },
      data: {
        status:       'DISCONTINUED',
        endDate:      new Date(),
        instructions: existing.instructions
          ? `${existing.instructions} | DISCONTINUED: ${reason.trim()}`
          : `DISCONTINUED: ${reason.trim()}`,
      },
    });
  },

  // Medication history search — used for EVEE temporal reasoning
  async searchMedicationHistory(patientId: string, tenantId: string, drugName: string) {
    return prisma.medication.findMany({
      where: {
        record: { patientId, patient: { tenantId } },
        name:   { contains: drugName, mode: 'insensitive' },
      },
      orderBy: { startDate: 'desc' },
    });
  },
};
