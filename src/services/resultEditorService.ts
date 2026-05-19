import { prisma } from '../lib/prisma';
import { Department, ResultStatus, Prisma } from '../../generated/prisma/client';
import { acquireLock, releaseLock, refreshLock, assertLockOwner } from '../utils/editLock';
import { calculate, getAvailableFormulas, getFormulaInputs } from '../utils/formulaEngine';
import type { FormulaKey, PatientContext } from '../utils/formulaEngine';
import type { TemplateField, TemplateGroup, DataSchema } from '../types/template';
import type { FieldFlag, DraftData, FlaggedField, EveeInlineAlert, SessionState } from '../types/editor';

// ─── Types ───────────────────────────────────────────────────────────────────



// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract a flat list of all fields from a dataSchema.
 */
function flattenSchemaFields(schema: DataSchema): TemplateField[] {
  return schema.groups.flatMap((g: TemplateGroup) => g.fields);
}

/**
 * Derive patient age in years from date of birth.
 */
function ageFromDob(dob: Date): number {
  const now  = new Date();
  const diff = now.getFullYear() - dob.getFullYear();
  const bday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
  return now >= bday ? diff : diff - 1;
}

/**
 * Determine flag for a numeric value against a field's reference and critical ranges,
 * taking patient sex and age into account.
 */
export function flagNumericValue(
  field:     TemplateField,
  value:     number,
  sex:       'MALE' | 'FEMALE' | 'OTHER',
  ageYears:  number,
): FlaggedField['flag'] | 'C' {

  // Critical range check first — takes priority
  if (field.criticalRange) {
    const { low, high } = field.criticalRange;
    if ((low  !== undefined && value < low)  ||
        (high !== undefined && value > high)) {
      return 'C';
    }
  }

  if (!field.referenceRange) return null;

  // Pick the right band: child < 18, otherwise sex-specific, fallback to general
  const rr = field.referenceRange;
  const band =
    ageYears < 18 && rr.child   ? rr.child   :
    sex === 'MALE' && rr.male   ? rr.male   :
    sex === 'FEMALE' && rr.female ? rr.female :
    rr.general                  ? rr.general :
    null;

  if (!band) return null;

  if (value < band.min) return 'L';
  if (value > band.max) return 'H';
  return 'N';
}

/**
 * Build a map of fieldKey → value from a DraftData for formula resolution.
 */
function buildValueMap(draft: DraftData): Record<string, number | string | boolean | null> {
  const map: Record<string, number | string | boolean | null> = {};
  for (const group of draft.groups) {
    for (const field of group.fields) {
      map[field.key] = field.value;
    }
  }
  return map;
}

function isFormulaKey(value: string): value is FormulaKey {
  return (getAvailableFormulas() as string[]).includes(value);
}

function buildFormulaInputs(
  formulaInputs: string[],
  valueMap: Record<string, number | string | boolean | null>,
): Record<string, number> {
  const inputs: Record<string, number> = {};

  for (const key of formulaInputs) {
    const val = valueMap[key];
    const numeric = typeof val === 'number'
      ? val
      : typeof val === 'string' && val.trim() !== ''
        ? Number(val)
        : NaN;

    if (Number.isFinite(numeric)) inputs[key] = numeric;
  }

  return inputs;
}

function buildPatientContext(
  age: number,
  sex: 'MALE' | 'FEMALE' | 'OTHER',
  valueMap: Record<string, number | string | boolean | null>,
): PatientContext {
  const context: PatientContext = { age, sex };
  const weight = valueMap.weight;
  const numericWeight = typeof weight === 'number'
    ? weight
    : typeof weight === 'string' && weight.trim() !== ''
      ? Number(weight)
      : NaN;

  if (Number.isFinite(numericWeight)) context.weight = numericWeight;
  return context;
}

/**
 * SESSION_DURATION_MINUTES — how long an edit session lives without a heartbeat.
 */
const SESSION_DURATION_MINUTES = 30;

function sessionExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + SESSION_DURATION_MINUTES);
  return d;
}

// ─── Open Session ─────────────────────────────────────────────────────────────

/**
 * Acquire an edit lock and create (or resume) a ResultEditSession.
 *
 * - If another staff member holds an active lock → throws with their name.
 * - If the result is FINALIZED → throws.
 * - If the same staff member already has a session → returns it (idempotent).
 */
export async function openSession(resultId: string, staffId: string): Promise<SessionState> {
  if (!resultId || !staffId) throw new Error('resultId and staffId are required');

  // Check result exists and is editable
  const result = await prisma.result.findUnique({
    where:   { id: resultId },
    include: { editSession: true },
  });

  if (!result)                              throw new Error('Result not found');
  if (result.status === ResultStatus.FINALIZED) throw new Error('Result is finalized — it cannot be edited');

  // Attempt to acquire lock (editLock util handles expiry + conflict)
  const lockResult = await acquireLock(resultId, staffId);
  if (!lockResult.success) throw new Error(lockResult.error ?? 'Could not acquire edit lock');

  // Existing session for this staff member — resume it
  if (result.editSession && result.editSession.staffId === staffId) {
    const updated = await prisma.resultEditSession.update({
      where: { id: result.editSession.id },
      data:  { expiresAt: sessionExpiry() },
    });

    return {
      sessionId:   updated.id,
      resultId,
      staffId,
      draftData:   updated.draftData as DraftData | null,
      startedAt:   updated.startedAt,
      lastSavedAt: updated.lastSavedAt,
      expiresAt:   updated.expiresAt,
    };
  }

  // New session
  const session = await prisma.resultEditSession.create({
    data: {
      resultId,
      staffId,
      draftData:  Prisma.JsonNull,
      startedAt:  new Date(),
      expiresAt:  sessionExpiry(),
    },
  });

  return {
    sessionId:   session.id,
    resultId,
    staffId,
    draftData:   null,
    startedAt:   session.startedAt,
    lastSavedAt: null,
    expiresAt:   session.expiresAt,
  };
}

// ─── Auto-Save Draft ──────────────────────────────────────────────────────────

/**
 * Persist in-progress data without submitting.
 * Validates lock ownership before writing.
 * Runs field flagging and formula calculation on the draft before saving.
 */
export async function autoSaveDraft(
  resultId:  string,
  staffId:   string,
  draft:     DraftData,
  patientId: string,
): Promise<{ savedAt: Date; flaggedDraft: DraftData }> {

  await assertLockOwner(resultId, staffId);

  // Fetch patient for sex + age (needed for reference range flagging)
  const patient = await prisma.patient.findUnique({
    where:  { id: patientId },
    select: { dob: true, gender: true },
  });
  if (!patient) throw new Error('Patient not found');

  const age = ageFromDob(patient.dob);
  const sex = patient.gender as 'MALE' | 'FEMALE' | 'OTHER';

  // Fetch the template's dataSchema
  const result = await prisma.result.findUnique({
    where:   { id: resultId },
    include: { template: true },
  });
  if (!result) throw new Error('Result not found');

  const schema    = result.template.dataSchema as unknown as DataSchema;
  const allFields = flattenSchemaFields(schema);
  const valueMap  = buildValueMap(draft);
  const patientContext = buildPatientContext(age, sex, valueMap);

  // Enrich draft: flag numeric fields, calculate derived fields
  const flaggedDraft: DraftData = {
    ...draft,
    groups: draft.groups.map(draftGroup => {
      const schemaGroup = schema.groups.find(g => g.id === draftGroup.groupId);

      return {
        ...draftGroup,
        fields: draftGroup.fields.map(draftField => {
          const schemaField = allFields.find(f => f.id === draftField.fieldId);
          if (!schemaField) return draftField;

          // ── Calculated fields ─────────────────────────────────────────────
          if (schemaField.type === 'calculated' && schemaField.formula && schemaField.formulaInputs) {
            if (!isFormulaKey(schemaField.formula)) return draftField;
            const inputs = buildFormulaInputs(schemaField.formulaInputs, valueMap);

            try {
              const calcResult = calculate(schemaField.formula, inputs, patientContext);
              return {
                ...draftField,
                value:    calcResult.value,
                flag:     null,
                critical: false,
              };
            } catch {
              // Formula can't run yet — inputs incomplete, leave as-is
              return draftField;
            }
          }

          // ── Numeric fields — auto-flag ─────────────────────────────────────
          if (
            schemaField.type === 'numeric' &&
            schemaField.flagLogic === 'auto' &&
            draftField.value !== null &&
            typeof draftField.value === 'number'
          ) {
            const flag     = flagNumericValue(schemaField, draftField.value, sex, age);
            const critical = flag === 'C';
            return { ...draftField, flag, critical };
          }

          return draftField;
        }),
      };
    }),
  };

  // Persist to session
  const session = await prisma.resultEditSession.findUnique({
    where: { resultId },
  });
  if (!session) throw new Error('No active session found for this result');

  const now = new Date();

  await prisma.resultEditSession.update({
    where: { id: session.id },
    data: {
      draftData:   flaggedDraft as unknown as Prisma.InputJsonValue,
      lastSavedAt: now,
      expiresAt:   sessionExpiry(), // extend on every save
    },
  });

  return { savedAt: now, flaggedDraft };
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

/**
 * Frontend calls this every 5 minutes to keep the session alive.
 * Extends the lock and session expiry.
 */
export async function heartbeat(resultId: string, staffId: string): Promise<{ expiresAt: Date }> {
  await assertLockOwner(resultId, staffId);
  await refreshLock(resultId, staffId);

  const session = await prisma.resultEditSession.findUnique({
    where: { resultId },
  });
  if (!session) throw new Error('No active session found');

  const updated = await prisma.resultEditSession.update({
    where: { id: session.id },
    data:  { expiresAt: sessionExpiry() },
  });

  return { expiresAt: updated.expiresAt };
}

// ─── Flag a Single Field Entry ────────────────────────────────────────────────

/**
 * Called by the frontend on every field value change (debounced).
 * Returns the flag for that field and — if critical — an inline EVEE alert.
 *
 * This is the real-time feedback loop: the editor doesn't wait for full
 * submission to surface dangerous values.
 */
export async function flagFieldEntry(params: {
  resultId:  string;
  staffId:   string;
  fieldId:   string;
  value:     number | string | boolean | null;
  patientId: string;
}): Promise<{ flag: FieldFlag; eveeAlert: EveeInlineAlert | null }> {

  const { resultId, staffId, fieldId, value, patientId } = params;

  await assertLockOwner(resultId, staffId);

  const [result, patient] = await Promise.all([
    prisma.result.findUnique({
      where:   { id: resultId },
      include: { template: true },
    }),
    prisma.patient.findUnique({
      where:  { id: patientId },
      select: { dob: true, gender: true },
    }),
  ]);

  if (!result)  throw new Error('Result not found');
  if (!patient) throw new Error('Patient not found');

  const schema    = result.template.dataSchema as unknown as DataSchema;
  const allFields = flattenSchemaFields(schema);
  const field     = allFields.find(f => f.id === fieldId);

  if (!field) throw new Error(`Field ${fieldId} not found in template`);

  // Non-numeric fields — no auto-flagging
  if (field.type !== 'numeric' || value === null || typeof value !== 'number') {
    return { flag: { flag: null, critical: false }, eveeAlert: null };
  }

  const age  = ageFromDob(patient.dob);
  const sex  = patient.gender as 'MALE' | 'FEMALE' | 'OTHER';
  const flag = flagNumericValue(field, value, sex, age);

  const flagResult: FieldFlag = {
    flag:     flag === 'N' ? null : flag,
    critical: flag === 'C',
  };

  // ── Inline EVEE alert on critical breach ──────────────────────────────────
  let eveeAlert: EveeInlineAlert | null = null;

  if (flag === 'C') {
    eveeAlert = buildCriticalLabAlert(field, value, flag);
  }

  return { flag: flagResult, eveeAlert };
}

/**
 * Build an inline EVEE-style alert for a critical lab value.
 * These are deterministic rule-engine alerts, not ML — always fire.
 */
function buildCriticalLabAlert(
  field: TemplateField,
  value: number,
  flag:  'C',
): EveeInlineAlert {
  const direction = field.criticalRange?.low !== undefined && value < field.criticalRange.low
    ? 'critically low'
    : 'critically high';

  return {
    ruleId:         `LAB-CRITICAL-${field.key.toUpperCase()}`,
    severity:       'CRITICAL',
    message:        `${field.label} is ${direction}: ${value} ${field.unit ?? ''}`.trim(),
    recommendation: getCriticalLabRecommendation(field.key, direction),
    fieldKey:       field.key,
  };
}

/**
 * Domain-specific critical recommendations for common lab fields.
 * Falls back to a generic message for unrecognised field keys.
 */
function getCriticalLabRecommendation(key: string, direction: string): string {
  const recommendations: Record<string, Record<string, string>> = {
    haemoglobin: {
      'critically low':  'Assess for active bleeding. Consider urgent transfusion. Cross-match blood. Notify attending doctor immediately.',
      'critically high': 'Assess for polycythaemia vera, dehydration, or COPD. Consider phlebotomy if symptomatic.',
    },
    potassium: {
      'critically low':  'Risk of fatal arrhythmia. IV potassium replacement required under cardiac monitoring. Notify doctor immediately.',
      'critically high': 'Risk of fatal arrhythmia. 12-lead ECG immediately. Consider calcium gluconate, insulin-dextrose. Notify doctor.',
    },
    glucose: {
      'critically low':  'Severe hypoglycaemia. Administer 50mL of 50% dextrose IV. Recheck in 15 minutes. Identify precipitant.',
      'critically high': 'Possible DKA or HHS. Assess hydration, ketones, anion gap. Fluid resuscitation. Urgent insulin therapy.',
    },
    sodium: {
      'critically low':  'Severe hyponatraemia. Risk of cerebral oedema. Slow correction — no faster than 10 mmol/L per 24 hours.',
      'critically high': 'Severe hypernatraemia. Assess fluid status. Cautious rehydration. Risk of cerebral oedema on rapid correction.',
    },
    creatinine: {
      'critically high': 'Possible acute kidney injury or CKD decompensation. Review nephrotoxins. Assess fluid balance. Nephrology review.',
    },
    platelets: {
      'critically low':  'Severe thrombocytopaenia. Risk of spontaneous bleeding. Platelet transfusion threshold assessment. Haematology review.',
      'critically high': 'Thrombocytosis. Assess for reactive vs primary aetiology. Risk of thrombosis.',
    },
    wbc: {
      'critically low':  'Severe leucopaenia. High infection risk. Reverse barrier nursing. Neutropenia precautions.',
      'critically high': 'Severe leucocytosis. Consider infection, CML, or leukaemia. Blood film and haematology review.',
    },
    total_bilirubin: {
      'critically high': 'Severe jaundice. Assess for acute liver failure, haemolysis, or biliary obstruction. Hepatology review.',
    },
    spO2: {
      'critically low': 'Critical hypoxaemia. Supplemental oxygen immediately. Assess airway, breathing, circulation. Consider ventilation.',
    },
  };

  return recommendations[key]?.[direction]
    ?? `${key} is ${direction}. Notify attending doctor immediately for clinical assessment.`;
}

// ─── Calculate Derived Fields ─────────────────────────────────────────────────

/**
 * Recalculate all formula-driven fields in a draft.
 * Called explicitly when source fields change, or on autoSave.
 * Returns the updated draft with calculated values populated.
 */
export async function recalculateDerivedFields(
  resultId:  string,
  staffId:   string,
  draft:     DraftData,
  patientId: string,
): Promise<DraftData> {

  await assertLockOwner(resultId, staffId);

  const [result, patient] = await Promise.all([
    prisma.result.findUnique({
      where:   { id: resultId },
      include: { template: true },
    }),
    prisma.patient.findUnique({
      where:  { id: patientId },
      select: { dob: true, gender: true },
    }),
  ]);

  if (!result)  throw new Error('Result not found');
  if (!patient) throw new Error('Patient not found');

  const schema    = result.template.dataSchema as unknown as DataSchema;
  const allFields = flattenSchemaFields(schema);
  const valueMap  = buildValueMap(draft);
  const age       = ageFromDob(patient.dob);
  const sex       = patient.gender as 'MALE' | 'FEMALE' | 'OTHER';
  const patientContext = buildPatientContext(age, sex, valueMap);

  return {
    ...draft,
    groups: draft.groups.map(draftGroup => ({
      ...draftGroup,
      fields: draftGroup.fields.map(draftField => {
        const schemaField = allFields.find(f => f.id === draftField.fieldId);
        if (!schemaField || schemaField.type !== 'calculated') return draftField;
        if (!schemaField.formula || !schemaField.formulaInputs)  return draftField;

        if (!isFormulaKey(schemaField.formula)) return draftField;
        const inputs = buildFormulaInputs(schemaField.formulaInputs, valueMap);

        try {
          const calcResult = calculate(schemaField.formula, inputs, patientContext);
          return {
            ...draftField,
            value:    calcResult.value,
            flag:     null,
            critical: false,
          };
        } catch {
          return draftField;
        }
      }),
    })),
  };
}

// ─── Submit Result ────────────────────────────────────────────────────────────

/**
 * Finalise and submit the result from the editor.
 *
 * - Validates all required fields are filled.
 * - Runs a final flag pass over all numeric fields.
 * - Recalculates all derived fields.
 * - Writes data to the Result record.
 * - Clears the edit session.
 * - Releases the lock.
 * - Bumps result status to PENDING (awaiting verification).
 *
 * Does NOT verify or sign — that is a separate step in resultService.
 */
export async function submitResult(params: {
  resultId:    string;
  staffId:     string;
  patientId:   string;
  draft:       DraftData;
  interpretation?: string;
}): Promise<{ success: boolean; missingFields: string[]; criticalAlerts: EveeInlineAlert[] }> {

  const { resultId, staffId, patientId, draft, interpretation } = params;

  await assertLockOwner(resultId, staffId);

  const [result, patient] = await Promise.all([
    prisma.result.findUnique({
      where:   { id: resultId },
      include: { template: true },
    }),
    prisma.patient.findUnique({
      where:  { id: patientId },
      select: { dob: true, gender: true },
    }),
  ]);

  if (!result)  throw new Error('Result not found');
  if (!patient) throw new Error('Patient not found');

  const schema    = result.template.dataSchema as unknown as DataSchema;
  const allFields = flattenSchemaFields(schema);
  const age       = ageFromDob(patient.dob);
  const sex       = patient.gender as 'MALE' | 'FEMALE' | 'OTHER';
  const valueMap  = buildValueMap(draft);
  const patientContext = buildPatientContext(age, sex, valueMap);

  // ── Required field validation ─────────────────────────────────────────────
  const missingFields: string[] = [];

  for (const field of allFields) {
    if (!field.required) continue;
    if (field.type === 'calculated') continue; // derived — not user-entered

    const val = valueMap[field.key];
    if (val === null || val === undefined || val === '') {
      missingFields.push(field.label);
    }
  }

  if (missingFields.length > 0) {
    return { success: false, missingFields, criticalAlerts: [] };
  }

  // ── Final flag + calculate pass ───────────────────────────────────────────
  const criticalAlerts: EveeInlineAlert[] = [];

  const finalDraft: DraftData = {
    ...draft,
    groups: draft.groups.map(draftGroup => ({
      ...draftGroup,
      fields: draftGroup.fields.map(draftField => {
        const schemaField = allFields.find(f => f.id === draftField.fieldId);
        if (!schemaField) return draftField;

        // Calculated fields
        if (schemaField.type === 'calculated' && schemaField.formula && schemaField.formulaInputs) {
          if (!isFormulaKey(schemaField.formula)) return draftField;
          const inputs = buildFormulaInputs(schemaField.formulaInputs, valueMap);
          try {
            const calcResult = calculate(schemaField.formula, inputs, patientContext);
            return { ...draftField, value: calcResult.value, flag: null, critical: false };
          } catch {
            return draftField;
          }
        }

        // Numeric auto-flag
        if (
          schemaField.type === 'numeric' &&
          schemaField.flagLogic === 'auto' &&
          typeof draftField.value === 'number'
        ) {
          const flag     = flagNumericValue(schemaField, draftField.value, sex, age);
          const critical = flag === 'C';

          if (critical) {
            criticalAlerts.push(buildCriticalLabAlert(schemaField, draftField.value as number, 'C'));
          }

          return { ...draftField, flag, critical };
        }

        return draftField;
      }),
    })),
  };

  const finalInterpretation = interpretation ?? draft.interpretation;
  if (finalInterpretation !== undefined) {
    finalDraft.interpretation = finalInterpretation;
  }

  // ── Persist to Result record ──────────────────────────────────────────────
  await prisma.$transaction([
    // Write final data to result
    prisma.result.update({
      where: { id: resultId },
      data: {
        data:    finalDraft as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
        status:  ResultStatus.PENDING, // Back to pending — awaiting verification
        // Clear any previous signature if this is a re-submission
        signatureHash: null,
        verifiedBy:    null,
        verifiedAt:    null,
        verifierRole:  null,
      },
    }),

    // Delete edit session
    prisma.resultEditSession.deleteMany({ where: { resultId } }),
  ]);

  // Release lock after transaction
  await releaseLock(resultId, staffId);

  return { success: true, missingFields: [], criticalAlerts };
}

// ─── Close Session ────────────────────────────────────────────────────────────

/**
 * Cleanly close a session without submitting — e.g. user navigates away.
 * Releases lock but preserves draft data so they can resume later.
 */
export async function closeSession(resultId: string, staffId: string): Promise<void> {
  await assertLockOwner(resultId, staffId);
  await releaseLock(resultId, staffId);

  // Don't delete the session — preserve draft. Just expire it.
  const session = await prisma.resultEditSession.findUnique({ where: { resultId } });
  if (session) {
    const now = new Date();
    await prisma.resultEditSession.update({
      where: { id: session.id },
      data:  { expiresAt: now }, // immediately expired — another user can take over
    });
  }
}

// ─── Get Session State ────────────────────────────────────────────────────────

/**
 * Fetch the current session state for a result.
 * Used by the frontend on page load to know if there's a draft to resume.
 */
export async function getSessionByResult(resultId: string): Promise<SessionState | null> {
  const session = await prisma.resultEditSession.findUnique({
    where: { resultId },
  });

  if (!session) return null;

  return {
    sessionId:   session.id,
    resultId:    session.resultId,
    staffId:     session.staffId,
    draftData:   session.draftData as DraftData | null,
    startedAt:   session.startedAt,
    lastSavedAt: session.lastSavedAt,
    expiresAt:   session.expiresAt,
  };
}

// ─── Expire Stale Sessions ────────────────────────────────────────────────────

/**
 * Sweep expired sessions and release their locks.
 * Call this from a cron job — e.g. every 10 minutes.
 */
export async function expireStaleSession(): Promise<{ expired: number }> {
  const now = new Date();

  // Find all expired sessions
  const stale = await prisma.resultEditSession.findMany({
    where: { expiresAt: { lt: now } },
    select: { resultId: true, staffId: true },
  });

  if (stale.length === 0) return { expired: 0 };

  // Release locks for all stale sessions
  await Promise.all(
    stale.map(s =>
      prisma.result.update({
        where: { id: s.resultId },
        data:  { lockedBy: null, lockedAt: null },
      }).catch(() => null) // swallow if result was deleted
    )
  );

  // Delete all expired sessions
  await prisma.resultEditSession.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  return { expired: stale.length };
}

// ─── Get Formula Metadata ─────────────────────────────────────────────────────

/**
 * Returns what source fields a formula needs — used by the template builder
 * to show the tech which fields must exist before a calculated field can populate.
 */
export function getFormulaMetadata(formulaKey: string) {
  if (!isFormulaKey(formulaKey)) return [];
  return getFormulaInputs(formulaKey);
}
