import { prisma } from '../lib/prisma';
import type { CreateVitalInput } from '../types/vital';

function validateVitalInput(data: Partial<CreateVitalInput>, partial = false) {
  const errors: string[] = [];

  if (!partial) {
    if (!data.encounterId?.trim()) errors.push('encounterId is required');
    if (!data.patientId?.trim())   errors.push('patientId is required');
    if (!data.recordedBy?.trim())  errors.push('recordedBy is required');
  }

  // Range guards — catch obvious data entry errors
  if (data.systolicBP  !== undefined && (data.systolicBP  < 40  || data.systolicBP  > 300)) errors.push('systolicBP out of range (40–300)');
  if (data.diastolicBP !== undefined && (data.diastolicBP < 20  || data.diastolicBP > 200)) errors.push('diastolicBP out of range (20–200)');
  if (data.heartRate   !== undefined && (data.heartRate   < 10  || data.heartRate   > 300)) errors.push('heartRate out of range (10–300)');
  if (data.spO2        !== undefined && (data.spO2        < 50  || data.spO2        > 100)) errors.push('spO2 out of range (50–100)');
  if (data.temperature !== undefined && (data.temperature < 25  || data.temperature > 45))  errors.push('temperature out of range (25–45°C)');
  if (data.respiratoryRate !== undefined && (data.respiratoryRate < 4 || data.respiratoryRate > 60)) errors.push('respiratoryRate out of range (4–60)');
  if (data.gcs         !== undefined && (data.gcs         < 3   || data.gcs         > 15))  errors.push('GCS out of range (3–15)');
  if (data.painScore   !== undefined && (data.painScore   < 0   || data.painScore   > 10))  errors.push('painScore out of range (0–10)');

  return { valid: errors.length === 0, errors };
}

function calculateBMI(weight?: number, height?: number): number | null {
  if (!weight || !height || height === 0) return null;
  const heightM = height / 100;
  return parseFloat((weight / (heightM * heightM)).toFixed(1));
}

function calculateMAP(systolic?: number, diastolic?: number): number | null {
  if (!systolic || !diastolic) return null;
  // MAP = DBP + 1/3 (SBP - DBP)
  return parseFloat((diastolic + (systolic - diastolic) / 3).toFixed(1));
}

export const vitalService = {

  async createVital(data: CreateVitalInput) {
    const { valid, errors } = validateVitalInput(data, false);
    if (!valid) throw new Error(errors.join(', '));

    // Verify encounter exists and belongs to patient
    const encounter = await prisma.encounter.findFirst({
      where: { id: data.encounterId, patientId: data.patientId },
    });
    if (!encounter) throw new Error('Encounter not found or does not belong to patient');

    // Auto-calculate BMI and MAP if source values present
    const bmi = calculateBMI(data.weight, data.height);
    const map = data.meanABP ?? calculateMAP(data.systolicBP, data.diastolicBP);

    return prisma.vital.create({
      data: {
        encounterId:     data.encounterId,
        patientId:       data.patientId,
        recordedBy:      data.recordedBy,
        systolicBP:      data.systolicBP      ?? null,
        diastolicBP:     data.diastolicBP     ?? null,
        heartRate:       data.heartRate       ?? null,
        meanABP:         map                  ?? null,
        respiratoryRate: data.respiratoryRate ?? null,
        spO2:            data.spO2            ?? null,
        temperature:     data.temperature     ?? null,
        weight:          data.weight          ?? null,
        height:          data.height          ?? null,
        bmi:             bmi                  ?? null,
        gcs:             data.gcs             ?? null,
        urineOutput:     data.urineOutput     ?? null,
        painScore:       data.painScore       ?? null,
        recordedAt:      data.recordedAt ? new Date(data.recordedAt) : new Date(),
      },
    });
  },

  async getVitalsByEncounter(encounterId: string) {
    return prisma.vital.findMany({
      where:   { encounterId },
      orderBy: { recordedAt: 'desc' },
    });
  },

  // Most recent vital set per patient — what EVEE uses
  async getLatestVitals(patientId: string) {
    return prisma.vital.findFirst({
      where:   { patientId },
      orderBy: { recordedAt: 'desc' },
    });
  },

  // Vital trend — last N readings for a patient (useful for deterioration scoring)
  async getVitalTrend(patientId: string, limit = 10) {
    return prisma.vital.findMany({
      where:   { patientId },
      orderBy: { recordedAt: 'desc' },
      take:    limit,
    });
  },

  async getVitalById(id: string) {
    return prisma.vital.findUnique({ where: { id } });
  },
};