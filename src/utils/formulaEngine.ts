// ============================================================
// EVEE Formula Engine
// Calculates derived clinical fields from structured inputs.
// All formulas are evidence-based and reference-cited.
// ============================================================

// ── TYPES ─────────────────────────────────────────────────────

export type FormulaKey =
  | 'ckd_epi'
  | 'bmi'
  | 'anion_gap'
  | 'corrected_calcium'
  | 'mean_abp'
  | 'sofa_score'
  | 'egfr_cockcroft'
  | 'ldl_friedewald'
  | 'bsa_mosteller'
  | 'ibw'
  | 'abw';

export interface FormulaInput {
  key:      string;   // matches field key in template dataSchema
  label:    string;
  unit:     string;
  required: boolean;
}

export interface FormulaResult {
  value:       number | null;
  unit:        string;
  formula:     FormulaKey;
  inputs:      Record<string, number>;  // values used in calculation
  error?:      string;                  // set if calculation failed
  interpretation?: string;             // optional clinical interpretation
}

export interface PatientContext {
  age:    number;
  sex:    'MALE' | 'FEMALE' | 'OTHER';
  weight?: number;  // kg — used for some formulas
}

// ── FORMULA INPUT DEFINITIONS ─────────────────────────────────
// Frontend reads this to know what fields to collect
// before a derived field can be calculated.

export const FORMULA_INPUTS: Record<FormulaKey, FormulaInput[]> = {

  ckd_epi: [
    { key: 'creatinine', label: 'Serum Creatinine', unit: 'mg/dL', required: true },
    // age and sex come from patient context, not template fields
  ],

  egfr_cockcroft: [
    { key: 'creatinine', label: 'Serum Creatinine', unit: 'mg/dL', required: true },
    { key: 'weight',     label: 'Weight',           unit: 'kg',    required: true },
  ],

  bmi: [
    { key: 'weight', label: 'Weight', unit: 'kg', required: true },
    { key: 'height', label: 'Height', unit: 'cm', required: true },
  ],

  anion_gap: [
    { key: 'sodium',      label: 'Sodium',      unit: 'mmol/L', required: true },
    { key: 'chloride',    label: 'Chloride',    unit: 'mmol/L', required: true },
    { key: 'bicarbonate', label: 'Bicarbonate', unit: 'mmol/L', required: true },
  ],

  corrected_calcium: [
    { key: 'calcium', label: 'Total Calcium', unit: 'mmol/L', required: true },
    { key: 'albumin', label: 'Albumin',       unit: 'g/dL',   required: true },
  ],

  mean_abp: [
    { key: 'systolic_bp',  label: 'Systolic BP',  unit: 'mmHg', required: true },
    { key: 'diastolic_bp', label: 'Diastolic BP', unit: 'mmHg', required: true },
  ],

  sofa_score: [
    { key: 'pao2_fio2',    label: 'PaO₂/FiO₂ ratio',   unit: 'mmHg', required: true },
    { key: 'platelets',    label: 'Platelets',           unit: '×10⁹/L', required: true },
    { key: 'bilirubin',    label: 'Bilirubin',           unit: 'mg/dL',  required: true },
    { key: 'creatinine',   label: 'Creatinine',          unit: 'mg/dL',  required: true },
    { key: 'map',          label: 'Mean Arterial Pressure', unit: 'mmHg', required: true },
    { key: 'gcs',          label: 'GCS Score',           unit: '',       required: true },
  ],

  ldl_friedewald: [
    { key: 'total_cholesterol', label: 'Total Cholesterol', unit: 'mmol/L', required: true },
    { key: 'hdl',               label: 'HDL Cholesterol',   unit: 'mmol/L', required: true },
    { key: 'triglycerides',     label: 'Triglycerides',     unit: 'mmol/L', required: true },
  ],

  bsa_mosteller: [
    { key: 'weight', label: 'Weight', unit: 'kg', required: true },
    { key: 'height', label: 'Height', unit: 'cm', required: true },
  ],

  ibw: [
    { key: 'height', label: 'Height', unit: 'cm', required: true },
  ],

  abw: [
    { key: 'weight', label: 'Actual Weight', unit: 'kg', required: true },
    { key: 'height', label: 'Height',        unit: 'cm', required: true },
  ],
};

// ── INDIVIDUAL FORMULA IMPLEMENTATIONS ───────────────────────

/**
 * CKD-EPI eGFR (2021 race-free equation)
 * Ref: Inker et al., NEJM 2021
 * Input: creatinine in mg/dL, age in years, sex
 * Output: eGFR in mL/min/1.73m²
 */
function calcCkdEpi(
  creatinine: number,
  age:        number,
  sex:        'MALE' | 'FEMALE' | 'OTHER',
): number {
  const isFemale = sex === 'FEMALE';
  const kappa    = isFemale ? 0.7  : 0.9;
  const alpha    = isFemale ? -0.241 : -0.302;
  const sexMult  = isFemale ? 1.012 : 1.0;

  const crRatio = creatinine / kappa;

  const egfr =
    142 *
    Math.pow(Math.min(crRatio, 1), alpha) *
    Math.pow(Math.max(crRatio, 1), -1.200) *
    Math.pow(0.9938, age) *
    sexMult;

  return round(egfr, 1);
}

/**
 * Cockcroft-Gault Creatinine Clearance
 * Ref: Cockcroft & Gault, Nephron 1976
 * Input: creatinine in mg/dL, age, sex, weight in kg
 * Output: CrCl in mL/min
 */
function calcCockcroftGault(
  creatinine: number,
  age:        number,
  sex:        'MALE' | 'FEMALE' | 'OTHER',
  weight:     number,
): number {
  const sexFactor = sex === 'FEMALE' ? 0.85 : 1.0;
  const crcl = ((140 - age) * weight * sexFactor) / (72 * creatinine);
  return round(crcl, 1);
}

/**
 * Body Mass Index
 * Input: weight in kg, height in cm
 * Output: BMI in kg/m²
 */
function calcBMI(weight: number, height: number): number {
  const heightM = height / 100;
  return round(weight / (heightM * heightM), 1);
}

/**
 * Anion Gap
 * Ref: Standard formula
 * Input: sodium, chloride, bicarbonate in mmol/L
 * Output: anion gap in mmol/L (normal 8–12)
 */
function calcAnionGap(
  sodium:      number,
  chloride:    number,
  bicarbonate: number,
): number {
  return round(sodium - (chloride + bicarbonate), 1);
}

/**
 * Corrected Calcium (for hypoalbuminaemia)
 * Ref: Payne et al., BMJ 1973
 * Input: calcium in mmol/L, albumin in g/dL
 * Output: corrected calcium in mmol/L
 */
function calcCorrectedCalcium(calcium: number, albumin: number): number {
  return round(calcium + 0.8 * (4.0 - albumin), 2);
}

/**
 * Mean Arterial Pressure
 * Input: systolic and diastolic BP in mmHg
 * Output: MAP in mmHg
 */
function calcMAP(systolic: number, diastolic: number): number {
  return round(diastolic + (systolic - diastolic) / 3, 1);
}

/**
 * SOFA Score (Sequential Organ Failure Assessment)
 * Ref: Vincent et al., Intensive Care Med 1996
 * Used by EVEE for sepsis risk assessment
 * Output: SOFA score 0–24
 */
function calcSOFA(inputs: {
  pao2_fio2:  number;
  platelets:  number;
  bilirubin:  number;
  creatinine: number;
  map:        number;
  gcs:        number;
}): number {
  let score = 0;

  // Respiratory (PaO2/FiO2)
  if      (inputs.pao2_fio2 < 100) score += 4;
  else if (inputs.pao2_fio2 < 200) score += 3;
  else if (inputs.pao2_fio2 < 300) score += 2;
  else if (inputs.pao2_fio2 < 400) score += 1;

  // Coagulation (Platelets ×10⁹/L)
  if      (inputs.platelets < 20)  score += 4;
  else if (inputs.platelets < 50)  score += 3;
  else if (inputs.platelets < 100) score += 2;
  else if (inputs.platelets < 150) score += 1;

  // Liver (Bilirubin mg/dL)
  if      (inputs.bilirubin >= 12.0) score += 4;
  else if (inputs.bilirubin >= 6.0)  score += 3;
  else if (inputs.bilirubin >= 2.0)  score += 2;
  else if (inputs.bilirubin >= 1.2)  score += 1;

  // Renal (Creatinine mg/dL)
  if      (inputs.creatinine >= 5.0) score += 4;
  else if (inputs.creatinine >= 3.5) score += 3;
  else if (inputs.creatinine >= 2.0) score += 2;
  else if (inputs.creatinine >= 1.2) score += 1;

  // Cardiovascular (MAP mmHg)
  if      (inputs.map < 70) score += 1;

  // Neurological (GCS)
  if      (inputs.gcs < 6)  score += 4;
  else if (inputs.gcs < 10) score += 3;
  else if (inputs.gcs < 13) score += 2;
  else if (inputs.gcs < 15) score += 1;

  return score;
}

/**
 * LDL Cholesterol — Friedewald Equation
 * Ref: Friedewald et al., Clin Chem 1972
 * Note: Invalid if triglycerides > 4.52 mmol/L
 * Input/Output: mmol/L
 */
function calcLDLFriedewald(
  totalCholesterol: number,
  hdl:              number,
  triglycerides:    number,
): { value: number | null; error?: string } {
  if (triglycerides > 4.52) {
    return {
      value: null,
      error: 'Friedewald equation invalid when triglycerides > 4.52 mmol/L — direct LDL measurement required',
    };
  }
  return { value: round(totalCholesterol - hdl - triglycerides / 2.2, 2) };
}

/**
 * Body Surface Area — Mosteller Formula
 * Ref: Mosteller, NEJM 1987
 * Input: weight kg, height cm
 * Output: BSA in m²
 */
function calcBSAMosteller(weight: number, height: number): number {
  return round(Math.sqrt((height * weight) / 3600), 2);
}

/**
 * Ideal Body Weight (Devine formula)
 * Ref: Devine, Drug Intelligence 1974
 * Input: height cm, sex
 * Output: IBW in kg
 */
function calcIBW(height: number, sex: 'MALE' | 'FEMALE' | 'OTHER'): number {
  const heightInches = height / 2.54;
  const base = sex === 'FEMALE' ? 45.5 : 50.0;
  return round(base + 2.3 * (heightInches - 60), 1);
}

/**
 * Adjusted Body Weight
 * Used for drug dosing in obese patients
 * Input: actual weight kg, height cm, sex
 * Output: ABW in kg
 */
function calcABW(
  actualWeight: number,
  height:       number,
  sex:          'MALE' | 'FEMALE' | 'OTHER',
): number {
  const ibw = calcIBW(height, sex);
  return round(ibw + 0.4 * (actualWeight - ibw), 1);
}

// ── CLINICAL INTERPRETATIONS ──────────────────────────────────

function interpretEGFR(egfr: number): string {
  if      (egfr >= 90) return 'G1 — Normal or high (≥90)';
  else if (egfr >= 60) return 'G2 — Mildly decreased (60–89)';
  else if (egfr >= 45) return 'G3a — Mildly to moderately decreased (45–59)';
  else if (egfr >= 30) return 'G3b — Moderately to severely decreased (30–44)';
  else if (egfr >= 15) return 'G4 — Severely decreased (15–29)';
  else                 return 'G5 — Kidney failure (<15) — consider renal replacement therapy';
}

function interpretBMI(bmi: number): string {
  if      (bmi < 18.5) return 'Underweight';
  else if (bmi < 25.0) return 'Normal weight';
  else if (bmi < 30.0) return 'Overweight';
  else if (bmi < 35.0) return 'Obese class I';
  else if (bmi < 40.0) return 'Obese class II';
  else                 return 'Obese class III (severe)';
}

function interpretSOFA(score: number): string {
  if      (score === 0) return 'No organ dysfunction';
  else if (score <= 6)  return 'Low mortality risk (~10%)';
  else if (score <= 9)  return 'Moderate mortality risk (~15–20%)';
  else if (score <= 11) return 'High mortality risk (~40–50%)';
  else                  return 'Very high mortality risk (>50%) — escalate care';
}

function interpretAnionGap(ag: number): string {
  if      (ag < 8)  return 'Low — consider hypoalbuminaemia, multiple myeloma';
  else if (ag <= 12) return 'Normal (8–12 mmol/L)';
  else              return 'Elevated — consider MUDPILES (methanol, uraemia, DKA, propylene glycol, isoniazid, lactic acidosis, ethylene glycol, salicylates)';
}

// ── MAIN ENTRY POINT ──────────────────────────────────────────

/**
 * Calculate a derived field.
 * Called by resultEditorService when a calculated field's
 * source inputs are all populated.
 */
export function calculate(
  formula:  FormulaKey,
  inputs:   Record<string, number>,
  patient:  PatientContext,
): FormulaResult {
  try {
    switch (formula) {

      case 'ckd_epi': {
        const cr = requireInput(inputs, 'creatinine');
        const value = calcCkdEpi(cr, patient.age, patient.sex);
        return {
          value,
          unit:           'mL/min/1.73m²',
          formula,
          inputs,
          interpretation: interpretEGFR(value),
        };
      }

      case 'egfr_cockcroft': {
        const cr  = requireInput(inputs, 'creatinine');
        const wt  = requireInput(inputs, 'weight');
        const value = calcCockcroftGault(cr, patient.age, patient.sex, wt);
        return {
          value,
          unit:           'mL/min',
          formula,
          inputs,
          interpretation: interpretEGFR(value),
        };
      }

      case 'bmi': {
        const wt = requireInput(inputs, 'weight');
        const ht = requireInput(inputs, 'height');
        const value = calcBMI(wt, ht);
        return {
          value,
          unit:           'kg/m²',
          formula,
          inputs,
          interpretation: interpretBMI(value),
        };
      }

      case 'anion_gap': {
        const na  = requireInput(inputs, 'sodium');
        const cl  = requireInput(inputs, 'chloride');
        const hco = requireInput(inputs, 'bicarbonate');
        const value = calcAnionGap(na, cl, hco);
        return {
          value,
          unit:           'mmol/L',
          formula,
          inputs,
          interpretation: interpretAnionGap(value),
        };
      }

      case 'corrected_calcium': {
        const ca  = requireInput(inputs, 'calcium');
        const alb = requireInput(inputs, 'albumin');
        return {
          value:  calcCorrectedCalcium(ca, alb),
          unit:   'mmol/L',
          formula,
          inputs,
        };
      }

      case 'mean_abp': {
        const sbp = requireInput(inputs, 'systolic_bp');
        const dbp = requireInput(inputs, 'diastolic_bp');
        return {
          value:  calcMAP(sbp, dbp),
          unit:   'mmHg',
          formula,
          inputs,
        };
      }

      case 'sofa_score': {
        const value = calcSOFA({
          pao2_fio2:  requireInput(inputs, 'pao2_fio2'),
          platelets:  requireInput(inputs, 'platelets'),
          bilirubin:  requireInput(inputs, 'bilirubin'),
          creatinine: requireInput(inputs, 'creatinine'),
          map:        requireInput(inputs, 'map'),
          gcs:        requireInput(inputs, 'gcs'),
        });
        return {
          value,
          unit:           '',
          formula,
          inputs,
          interpretation: interpretSOFA(value),
        };
      }

      case 'ldl_friedewald': {
        const tc  = requireInput(inputs, 'total_cholesterol');
        const hdl = requireInput(inputs, 'hdl');
        const tg  = requireInput(inputs, 'triglycerides');
        const { value, error } = calcLDLFriedewald(tc, hdl, tg);
        const result: FormulaResult = { value, unit: 'mmol/L', formula, inputs };
        if (error !== undefined) result.error = error;
        return result;
      }

      case 'bsa_mosteller': {
        const wt = requireInput(inputs, 'weight');
        const ht = requireInput(inputs, 'height');
        return {
          value:  calcBSAMosteller(wt, ht),
          unit:   'm²',
          formula,
          inputs,
        };
      }

      case 'ibw': {
        const ht = requireInput(inputs, 'height');
        return {
          value:  calcIBW(ht, patient.sex),
          unit:   'kg',
          formula,
          inputs,
        };
      }

      case 'abw': {
        const wt = requireInput(inputs, 'weight');
        const ht = requireInput(inputs, 'height');
        return {
          value:  calcABW(wt, ht, patient.sex),
          unit:   'kg',
          formula,
          inputs,
        };
      }

      default:
        return {
          value:   null,
          unit:    '',
          formula,
          inputs,
          error:   `Unknown formula: ${formula}`,
        };
    }
  } catch (err: any) {
    return {
      value:   null,
      unit:    '',
      formula,
      inputs,
      error:   err.message,
    };
  }
}

/**
 * Returns the required input field definitions for a formula.
 * Frontend uses this to know what fields to render before
 * a calculated field can be evaluated.
 */
export function getFormulaInputs(formula: FormulaKey): FormulaInput[] {
  return FORMULA_INPUTS[formula] ?? [];
}

/**
 * Returns all formula keys — for template builder dropdowns.
 */
export function getAvailableFormulas(): FormulaKey[] {
  return Object.keys(FORMULA_INPUTS) as FormulaKey[];
}

// ── INTERNAL HELPERS ──────────────────────────────────────────

function requireInput(inputs: Record<string, number>, key: string): number {
  const val = inputs[key];
  if (val === undefined || val === null || isNaN(val)) {
    throw new Error(`Required input '${key}' is missing or invalid`);
  }
  return val;
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
