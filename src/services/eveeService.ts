import { prisma } from '../lib/prisma';
import type { EveeAlert, EveeEvaluationResult, OverrideAlertInput } from '../types/evee';

// ── CONFIG ────────────────────────────────────────────────────

const EVEE_SERVICE_URL    = process.env.EVEE_SERVICE_URL ?? 'http://localhost:8000';
const EVEE_RULE_SET_VERSION = parseInt(process.env.EVEE_RULE_SET_VERSION ?? '1', 10);
const EVEE_TIMEOUT_MS     = 10_000; // 10 second timeout

// ── PATIENT DATA ASSEMBLY ─────────────────────────────────────
// Pulls everything EVEE needs from the DB in one structured query.
// This is the full patient context the Python engine receives.

async function assemblePatientContext(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      // Active allergies
      allergies: {
        where:   { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      },
      // Last 10 encounters with their vitals and diagnoses
      encounters: {
        orderBy: { encounteredAt: 'desc' },
        take:    10,
        include: {
          vitals:    { orderBy: { recordedAt: 'desc' }, take: 1 },
          diagnoses: { orderBy: { diagnosedAt: 'desc' } },
        },
      },
      // All records with active medications and recent results
      records: {
        include: {
          medications: {
            where:   { status: 'ACTIVE' },
            orderBy: { startDate: 'desc' },
          },
          results: {
            orderBy: { createdAt: 'desc' },
            take:    20,
            include: { template: true },
          },
        },
      },
    },
  });

  if (!patient) throw new Error('Patient not found');

  // Derive age from DOB
  const age = Math.floor(
    (Date.now() - patient.dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  );

  // Flatten most recent vitals across all encounters
  const latestVitals = patient.encounters
    .flatMap(e => e.vitals)
    .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0] ?? null;

  // Flatten all active/chronic diagnoses as a problem list
  const problemList = patient.encounters
    .flatMap(e => e.diagnoses)
    .filter(d => ['ACTIVE', 'CHRONIC'].includes(d.status));

  // Flatten all active medications across all records
  const activeMedications = patient.records
    .flatMap(r => r.medications)
    .filter(m => m.status === 'ACTIVE');

  // Flatten lab results — decrypt happens in resultService;
  // here we just pass raw DB data to EVEE (Python side decrypts or
  // we pass decrypted — decision: pass structured template name + data)
  const recentResults = patient.records
    .flatMap(r => r.results)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20);

  return {
    patientId: patient.id,
    demographics: {
      firstName: patient.firstName,
      lastName:  patient.lastName,
      age,
      sex:       patient.gender,
      dob:       patient.dob.toISOString(),
    },
    allergies: patient.allergies.map(a => ({
      substance: a.substance,
      reaction:  a.reaction,
      severity:  a.severity,
      drugClass: a.drugClass,
      confirmed: a.confirmed,
    })),
    currentMedications: activeMedications.map(m => ({
      name:         m.name,
      dosage:       m.dosage,
      route:        m.route,
      frequency:    m.frequency,
      prescribedBy: m.prescribedBy,
      startDate:    m.startDate.toISOString(),
    })),
    vitals: latestVitals ? {
      systolicBP:      latestVitals.systolicBP,
      diastolicBP:     latestVitals.diastolicBP,
      heartRate:       latestVitals.heartRate,
      temperature:     latestVitals.temperature,
      spO2:            latestVitals.spO2,
      respiratoryRate: latestVitals.respiratoryRate,
      gcs:             latestVitals.gcs,
      recordedAt:      latestVitals.recordedAt.toISOString(),
    } : null,
    medicalHistory: problemList.map(d => ({
      name:       d.name,
      icdCode:    d.icdCode,
      status:     d.status,
      isPrimary:  d.isPrimary,
      diagnosedAt: d.diagnosedAt.toISOString(),
    })),
    recentResults: recentResults.map(r => ({
      templateName: (r as any).template?.name ?? 'Unknown',
      data:         r.data,  // still encrypted — Python EVEE handles decryption via shared key
      createdAt:    r.createdAt.toISOString(),
    })),
  };
}

// ── EVEE SERVICE ──────────────────────────────────────────────

export const eveeService = {

  async evaluate(patientId: string, triggeredBy: string): Promise<EveeEvaluationResult> {
    // 1. Assemble full patient context from DB
    const patientContext = await assemblePatientContext(patientId);

    // 2. Call Python EVEE FastAPI service
    let engineResponse: { alerts: EveeAlert[]; mlScore?: number; mlLabel?: string };

    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), EVEE_TIMEOUT_MS);

      const response = await fetch(`${EVEE_SERVICE_URL}/evaluate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(patientContext),
        signal:  controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`EVEE engine error: ${response.status} — ${err}`);
      }

      engineResponse = await response.json();

    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('EVEE engine timed out — evaluation aborted');
      }
      throw new Error(`Failed to reach EVEE engine: ${err.message}`);
    }

    const alerts        = engineResponse.alerts ?? [];
    const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;

    // 3. Persist evaluation audit record
    const evaluation = await prisma.eveeEvaluation.create({
      data: {
        patientId,
        triggeredBy,
        ruleSetVersion: EVEE_RULE_SET_VERSION,
        alertCount:     alerts.length,
        criticalCount,
        mlScore:        engineResponse.mlScore  ?? null,
        mlLabel:        engineResponse.mlLabel  ?? null,
        alerts: {
          create: alerts.map(a => ({
            ruleId:         a.ruleId,
            domain:         a.domain         as any,
            severity:       a.severity       as any,
            message:        a.message,
            recommendation: a.recommendation,
          })),
        },
      },
      include: { alerts: true },
    });

    const result: EveeEvaluationResult = {
      evaluationId:   evaluation.id,
      patientId,
      triggeredBy,
      alerts:         evaluation.alerts,
      alertCount:     evaluation.alertCount,
      criticalCount:  evaluation.criticalCount,
      ruleSetVersion: evaluation.ruleSetVersion,
      evaluatedAt:    evaluation.createdAt,
    };

    if (evaluation.mlScore !== null) result.mlScore = evaluation.mlScore;
    if (evaluation.mlLabel !== null) result.mlLabel = evaluation.mlLabel;

    return result;
  },

  // Doctor dismisses an alert with a documented reason
  async overrideAlert(input: OverrideAlertInput) {
    if (!input.overrideReason?.trim()) {
      throw new Error('Override reason is required — this is a medico-legal record');
    }

    const alert = await prisma.eveeAlert.findUnique({ where: { id: input.alertId } });
    if (!alert) throw new Error('Alert not found');
    if (alert.overridden) throw new Error('Alert has already been overridden');

    return prisma.eveeAlert.update({
      where: { id: input.alertId },
      data: {
        overridden:     true,
        overriddenBy:   input.overriddenBy,
        overrideReason: input.overrideReason.trim(),
        overriddenAt:   new Date(),
      },
    });
  },

  // Fetch evaluation history for a patient
  async getEvaluationsByPatient(patientId: string, limit = 10) {
    return prisma.eveeEvaluation.findMany({
      where:   { patientId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      include: { alerts: true },
    });
  },

  // Fetch a single evaluation with full alert detail
  async getEvaluationById(evaluationId: string) {
    return prisma.eveeEvaluation.findUnique({
      where:   { id: evaluationId },
      include: { alerts: true },
    });
  },

  // Unacknowledged critical alerts for a patient — for dashboard warnings
  async getOpenCriticalAlerts(patientId: string) {
    return prisma.eveeAlert.findMany({
      where: {
        evaluation: { patientId },
        severity:   'CRITICAL',
        overridden: false,
      },
      orderBy: { createdAt: 'desc' },
      include: { evaluation: { select: { createdAt: true, triggeredBy: true } } },
    });
  },
};
