import { prisma } from '../lib/prisma';
import { Department, Prisma, TemplateType } from '../../generated/prisma/client';
import { paginate } from '../utils/pagination';
import type { FieldType, LayoutType, CriticalRange, TemplateField, TemplateGroup, InterpretationConfig, SignatureConfig, DataSchema } from '../types/template';

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_FIELD_TYPES: FieldType[] = [
  'numeric', 'text', 'select', 'multiselect', 'richtext', 'calculated', 'boolean',
];

const VALID_LAYOUTS: LayoutType[] = ['table', 'sections', 'freeform'];

const VALID_FORMULA_KEYS = [
  'ckd_epi', 'egfr_cockcroft', 'bmi', 'anion_gap',
  'corrected_calcium', 'mean_abp', 'sofa_score',
  'ldl_friedewald', 'bsa_mosteller', 'ibw', 'abw',
];

function validateDataSchema(schema: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!schema || typeof schema !== 'object') {
    return { valid: false, errors: ['dataSchema must be an object'] };
  }

  const s = schema as Record<string, unknown>;

  // Top-level
  if (typeof s.version !== 'number') errors.push('dataSchema.version must be a number');
  if (!VALID_LAYOUTS.includes(s.layout as LayoutType)) {
    errors.push(`dataSchema.layout must be one of: ${VALID_LAYOUTS.join(', ')}`);
  }
  if (!Array.isArray(s.groups) || s.groups.length === 0) {
    errors.push('dataSchema.groups must be a non-empty array');
  }

  // Groups
  if (Array.isArray(s.groups)) {
    const groupIds = new Set<string>();
    const fieldKeys = new Set<string>();

    (s.groups as unknown[]).forEach((g, gi) => {
      const group = g as Record<string, unknown>;
      const prefix = `groups[${gi}]`;

      if (!group.id || typeof group.id !== 'string') {
        errors.push(`${prefix}.id is required`);
      } else {
        if (groupIds.has(group.id)) errors.push(`${prefix}.id "${group.id}" is duplicated`);
        groupIds.add(group.id as string);
      }

      if (!group.label || typeof group.label !== 'string') {
        errors.push(`${prefix}.label is required`);
      }

      if (!Array.isArray(group.fields) || (group.fields as unknown[]).length === 0) {
        errors.push(`${prefix}.fields must be a non-empty array`);
      } else {
        (group.fields as unknown[]).forEach((f, fi) => {
          const field = f as Record<string, unknown>;
          const fp = `${prefix}.fields[${fi}]`;

          if (!field.id || typeof field.id !== 'string') {
            errors.push(`${fp}.id is required`);
          }

          if (!field.key || typeof field.key !== 'string') {
            errors.push(`${fp}.key is required`);
          } else {
            if (fieldKeys.has(field.key as string)) {
              errors.push(`${fp}.key "${field.key}" is duplicated across template`);
            }
            fieldKeys.add(field.key as string);
          }

          if (!field.label || typeof field.label !== 'string') {
            errors.push(`${fp}.label is required`);
          }

          if (!VALID_FIELD_TYPES.includes(field.type as FieldType)) {
            errors.push(`${fp}.type must be one of: ${VALID_FIELD_TYPES.join(', ')}`);
          }

          // select / multiselect need options
          if (['select', 'multiselect'].includes(field.type as string)) {
            if (!Array.isArray(field.options) || (field.options as unknown[]).length === 0) {
              errors.push(`${fp}.options required for type "${field.type}"`);
            }
          }

          // calculated needs a valid formula key
          if (field.type === 'calculated') {
            if (!VALID_FORMULA_KEYS.includes(field.formula as string)) {
              errors.push(`${fp}.formula "${field.formula}" is not a recognised formula key`);
            }
            if (!Array.isArray(field.formulaInputs) || (field.formulaInputs as unknown[]).length === 0) {
              errors.push(`${fp}.formulaInputs required for calculated fields`);
            }
          }

          // Reference range sanity check
          if (field.referenceRange) {
            const rr = field.referenceRange as Record<string, unknown>;
            (['male', 'female', 'child', 'general'] as const).forEach(sex => {
              if (rr[sex]) {
                const band = rr[sex] as Record<string, unknown>;
                if (typeof band.min !== 'number' || typeof band.max !== 'number') {
                  errors.push(`${fp}.referenceRange.${sex} must have numeric min and max`);
                }
                if (typeof band.min === 'number' && typeof band.max === 'number' && band.min >= band.max) {
                  errors.push(`${fp}.referenceRange.${sex}.min must be less than max`);
                }
              }
            });
          }
        });
      }
    });
  }

  // Interpretation
  if (!s.interpretation || typeof (s.interpretation as Record<string, unknown>).enabled !== 'boolean') {
    errors.push('dataSchema.interpretation.enabled is required');
  }

  // Signature
  if (!s.signature) {
    errors.push('dataSchema.signature is required');
  } else {
    const sig = s.signature as Record<string, unknown>;
    if (typeof sig.required !== 'boolean') errors.push('dataSchema.signature.required must be boolean');
    if (!Array.isArray(sig.roles) || (sig.roles as unknown[]).length === 0) {
      errors.push('dataSchema.signature.roles must be a non-empty array');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assertValidDepartment(dept: string): Department {
  if (!Object.values(Department).includes(dept as Department)) {
    throw new Error(`Invalid department: ${dept}`);
  }
  return dept as Department;
}

function templateTypeForDepartment(department: Department): TemplateType {
  if (department === Department.LABORATORY) return TemplateType.LAB;
  if (department === Department.RADIOLOGY) return TemplateType.IMAGING;
  return TemplateType.OTHER;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Create a new template. dataSchema is validated before saving.
 */
export async function createTemplate(data: {
  name:        string;
  description?: string;
  department:  string;
  dataSchema:  unknown;
  createdBy:   string;
  tenantId:     string;
}) {
  const { name, description, department, dataSchema, createdBy, tenantId } = data;

  if (!name?.trim()) throw new Error('Template name is required');
  if (!tenantId) throw new Error('tenantId is required');

  const dept = assertValidDepartment(department);

  const { valid, errors } = validateDataSchema(dataSchema);
  if (!valid) throw new Error(`Invalid dataSchema:\n${errors.join('\n')}`);

  // Check for duplicate name within department
  const existing = await prisma.template.findFirst({
    where: { tenantId, name: name.trim(), department: dept, isActive: true },
  });
  if (existing) throw new Error(`A template named "${name}" already exists in ${dept}`);

  return prisma.template.create({
    data: {
      name:        name.trim(),
      description: description?.trim() ?? null,
      type:        templateTypeForDepartment(dept),
      department:  dept,
      dataSchema:  dataSchema as Prisma.InputJsonValue,
      version:     1,
      isActive:    true,
      createdBy,
      tenantId,
    },
  });
}

/**
 * Fetch a single template by ID.
 */
export async function getTemplateById(id: string, tenantId: string) {
  if (!id) throw new Error('Template ID is required');
  if (!tenantId) throw new Error('tenantId is required');

  const template = await prisma.template.findFirst({
    where: { id, tenantId },
    include: { services: true },
  });

  if (!template) throw new Error('Template not found');
  return template;
}

/**
 * All active templates for a given department.
 */
export async function getTemplatesByDepartment(department: string, tenantId: string) {
  const dept = assertValidDepartment(department);
  if (!tenantId) throw new Error('tenantId is required');

  return prisma.template.findMany({
    where: { tenantId, department: dept, isActive: true },
    include: { services: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * All templates — admin use only.
 */
export async function getAllTemplates(params: {
  tenantId:    string;
  page?:       number;
  limit?:      number;
  department?: string;
  activeOnly?: boolean;
}) {
  const { tenantId, page = 1, limit = 20, department, activeOnly = true } = params;
  if (!tenantId) throw new Error('tenantId is required');

  const where: Prisma.TemplateWhereInput = { tenantId };
  if (department) where.department = assertValidDepartment(department);
  if (activeOnly) where.isActive = true;

  const [templates, total] = await Promise.all([
    prisma.template.findMany({
      where,
      include: { services: true },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.template.count({ where }),
  ]);

  return paginate(templates, total, page, limit);
}

/**
 * Search templates by name or description within an optional department.
 */
export async function searchTemplates(params: {
  tenantId:     string;
  query:        string;
  department?:  string;
  activeOnly?:  boolean;
}) {
  const { tenantId, query, department, activeOnly = true } = params;

  if (!query?.trim()) throw new Error('Search query is required');
  if (!tenantId) throw new Error('tenantId is required');

  const where: Prisma.TemplateWhereInput = {
    tenantId,
    OR: [
      { name:        { contains: query.trim(), mode: 'insensitive' } },
      { description: { contains: query.trim(), mode: 'insensitive' } },
    ],
  };

  if (department) where.department = assertValidDepartment(department);
  if (activeOnly) where.isActive = true;

  return prisma.template.findMany({
    where,
    include: { services: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Clone an existing template — new name, same dataSchema, version resets to 1.
 * The clone belongs to the same department unless explicitly overridden.
 */
export async function cloneTemplate(data: {
  sourceId:    string;
  newName:     string;
  department?: string;
  clonedBy:    string;
  tenantId:     string;
}) {
  const { sourceId, newName, department, clonedBy, tenantId } = data;

  if (!newName?.trim()) throw new Error('New template name is required');
  if (!tenantId) throw new Error('tenantId is required');

  const source = await prisma.template.findFirst({ where: { id: sourceId, tenantId } });
  if (!source) throw new Error('Source template not found');

  const dept = department ? assertValidDepartment(department) : source.department;

  // Duplicate name check in target department
  const existing = await prisma.template.findFirst({
    where: { tenantId, name: newName.trim(), department: dept, isActive: true },
  });
  if (existing) throw new Error(`A template named "${newName}" already exists in ${dept}`);

  return prisma.template.create({
    data: {
      name:        newName.trim(),
      description: source.description,
      type:        templateTypeForDepartment(dept),
      department:  dept,
      dataSchema:  source.dataSchema as Prisma.InputJsonValue,
      version:     1,
      isActive:    true,
      createdBy:   clonedBy,
      tenantId,
    },
  });
}

/**
 * Update a template. Any change to dataSchema bumps the version.
 * Templates with existing results can only update metadata (name, description).
 * To change dataSchema on a used template, clone it instead.
 */
export async function updateTemplate(
  id: string,
  staffId: string,
  tenantId: string,
  updates: {
    name?:        string;
    description?: string;
    dataSchema?:  unknown;
  }
) {
  if (!id) throw new Error('Template ID is required');
  if (!tenantId) throw new Error('tenantId is required');

  const template = await prisma.template.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { results: true } } },
  });

  if (!template) throw new Error('Template not found');
  if (!template.isActive) throw new Error('Cannot update a deactivated template');

  // If dataSchema is being changed and results already exist — block it
  if (updates.dataSchema && template._count.results > 0) {
    throw new Error(
      `This template has ${template._count.results} result(s) recorded against it. ` +
      `Clone it to create a modified version instead of editing in place.`
    );
  }

  let newVersion = template.version;
  const updateData: Prisma.TemplateUpdateInput = {};

  if (updates.name?.trim()) updateData.name = updates.name.trim();
  if (updates.description !== undefined) updateData.description = updates.description.trim() || null;

  if (updates.dataSchema) {
    const { valid, errors } = validateDataSchema(updates.dataSchema);
    if (!valid) throw new Error(`Invalid dataSchema:\n${errors.join('\n')}`);
    updateData.dataSchema = updates.dataSchema as Prisma.InputJsonValue;
    newVersion += 1;
    updateData.version = newVersion;
  }

  if (Object.keys(updateData).length === 0) throw new Error('No valid update fields provided');

  return prisma.template.update({ where: { id: template.id }, data: updateData });
}

/**
 * Deactivate (soft-delete) a template.
 * Hard deletion is blocked if results exist against it.
 */
export async function deactivateTemplate(id: string, staffId: string, tenantId: string) {
  if (!id) throw new Error('Template ID is required');
  if (!tenantId) throw new Error('tenantId is required');

  const template = await prisma.template.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { results: true } } },
  });

  if (!template) throw new Error('Template not found');
  if (!template.isActive) throw new Error('Template is already deactivated');

  // Warn but still allow deactivation — existing results still reference this template
  // They remain readable; new results just can't use this template anymore
  return prisma.template.update({
    where: { id },
    data:  { isActive: false },
  });
}

export async function activateTemplate(id: string, staffId: string) {
  if (!id) throw new Error('Template ID is required');

  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) throw new Error('Template not found');
  if (template.isActive) throw new Error('Template is already active');

  return prisma.template.update({
    where: { id },
    data:  { isActive: true },
  });
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

/**
 * Seed pre-built Nigerian clinical panel templates.
 * Safe to call multiple times — skips templates that already exist by name + department.
 */
export async function seedDefaultTemplates(seededBy: string, tenantId: string) {
  if (!tenantId) throw new Error('tenantId is required');

  const templates: Array<{
    name:        string;
    description: string;
    department:  Department;
    dataSchema:  DataSchema;
  }> = [

    // ── Full Blood Count ────────────────────────────────────────────────────
    {
      name:        'Full Blood Count (FBC)',
      description: 'Complete haematological profile including WBC differential',
      department:  Department.LABORATORY,
      dataSchema: {
        version: 1,
        layout:  'table',
        groups: [
          {
            id:          'grp_fbc_red',
            label:       'Red Cell Indices',
            collapsible: false,
            fields: [
              {
                id: 'fbc_hb', key: 'haemoglobin', label: 'Haemoglobin', type: 'numeric',
                unit: 'g/dL', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { male: { min: 13.5, max: 17.5 }, female: { min: 11.5, max: 15.5 }, child: { min: 11.0, max: 14.0 } },
                criticalRange: { low: 7.0, high: 20.0 },
              },
              {
                id: 'fbc_rbc', key: 'rbc', label: 'RBC Count', type: 'numeric',
                unit: '×10¹²/L', required: true, precision: 2, flagLogic: 'auto',
                referenceRange: { male: { min: 4.5, max: 5.9 }, female: { min: 3.8, max: 5.2 } },
              },
              {
                id: 'fbc_pcv', key: 'pcv', label: 'PCV / Haematocrit', type: 'numeric',
                unit: '%', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { male: { min: 40, max: 52 }, female: { min: 36, max: 48 } },
                criticalRange: { low: 20, high: 60 },
              },
              {
                id: 'fbc_mcv', key: 'mcv', label: 'MCV', type: 'numeric',
                unit: 'fL', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 80, max: 100 } },
              },
              {
                id: 'fbc_mch', key: 'mch', label: 'MCH', type: 'numeric',
                unit: 'pg', required: false, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 27, max: 33 } },
              },
              {
                id: 'fbc_mchc', key: 'mchc', label: 'MCHC', type: 'numeric',
                unit: 'g/dL', required: false, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 32, max: 36 } },
              },
            ],
          },
          {
            id:          'grp_fbc_white',
            label:       'White Cell Indices',
            collapsible: false,
            fields: [
              {
                id: 'fbc_wbc', key: 'wbc', label: 'WBC Count', type: 'numeric',
                unit: '×10⁹/L', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 4.0, max: 11.0 } },
                criticalRange: { low: 2.0, high: 30.0 },
              },
              {
                id: 'fbc_neut', key: 'neutrophils', label: 'Neutrophils', type: 'numeric',
                unit: '%', required: false, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 40, max: 75 } },
              },
              {
                id: 'fbc_lymph', key: 'lymphocytes', label: 'Lymphocytes', type: 'numeric',
                unit: '%', required: false, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 20, max: 45 } },
              },
              {
                id: 'fbc_mono', key: 'monocytes', label: 'Monocytes', type: 'numeric',
                unit: '%', required: false, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 2, max: 10 } },
              },
              {
                id: 'fbc_eos', key: 'eosinophils', label: 'Eosinophils', type: 'numeric',
                unit: '%', required: false, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 1, max: 6 } },
                hint: 'Elevated in parasitic infections and allergic conditions',
              },
            ],
          },
          {
            id:          'grp_fbc_plt',
            label:       'Platelets',
            collapsible: false,
            fields: [
              {
                id: 'fbc_plt', key: 'platelets', label: 'Platelet Count', type: 'numeric',
                unit: '×10⁹/L', required: true, precision: 0, flagLogic: 'auto',
                referenceRange: { general: { min: 150, max: 400 } },
                criticalRange: { low: 50, high: 1000 },
              },
            ],
          },
        ],
        interpretation: { enabled: true, prompt: 'Provide haematological interpretation including anaemia classification if applicable' },
        signature:      { required: true, roles: ['HOD', 'DOCTOR'] },
      },
    },

    // ── Liver Function Test ─────────────────────────────────────────────────
    {
      name:        'Liver Function Test (LFT)',
      description: 'Hepatocellular and cholestatic markers',
      department:  Department.LABORATORY,
      dataSchema: {
        version: 1,
        layout:  'table',
        groups: [
          {
            id:          'grp_lft_hepato',
            label:       'Hepatocellular Markers',
            collapsible: false,
            fields: [
              {
                id: 'lft_alt', key: 'alt', label: 'ALT (SGPT)', type: 'numeric',
                unit: 'U/L', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { male: { min: 7, max: 56 }, female: { min: 7, max: 45 } },
                criticalRange: { high: 1000 },
              },
              {
                id: 'lft_ast', key: 'ast', label: 'AST (SGOT)', type: 'numeric',
                unit: 'U/L', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { male: { min: 10, max: 40 }, female: { min: 10, max: 35 } },
                criticalRange: { high: 1000 },
              },
              {
                id: 'lft_alb', key: 'albumin', label: 'Albumin', type: 'numeric',
                unit: 'g/dL', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 3.5, max: 5.0 } },
                criticalRange: { low: 2.0 },
              },
              {
                id: 'lft_tp', key: 'total_protein', label: 'Total Protein', type: 'numeric',
                unit: 'g/dL', required: false, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 6.0, max: 8.3 } },
              },
            ],
          },
          {
            id:          'grp_lft_chol',
            label:       'Cholestatic Markers',
            collapsible: false,
            fields: [
              {
                id: 'lft_alp', key: 'alp', label: 'ALP', type: 'numeric',
                unit: 'U/L', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 44, max: 147 } },
              },
              {
                id: 'lft_ggt', key: 'ggt', label: 'GGT', type: 'numeric',
                unit: 'U/L', required: false, precision: 1, flagLogic: 'auto',
                referenceRange: { male: { min: 8, max: 61 }, female: { min: 5, max: 36 } },
              },
              {
                id: 'lft_tbili', key: 'total_bilirubin', label: 'Total Bilirubin', type: 'numeric',
                unit: 'mg/dL', required: true, precision: 2, flagLogic: 'auto',
                referenceRange: { general: { min: 0.1, max: 1.2 } },
                criticalRange: { high: 15.0 },
              },
              {
                id: 'lft_dbili', key: 'direct_bilirubin', label: 'Direct Bilirubin', type: 'numeric',
                unit: 'mg/dL', required: false, precision: 2, flagLogic: 'auto',
                referenceRange: { general: { min: 0.0, max: 0.3 } },
              },
            ],
          },
          {
            id:          'grp_lft_calc',
            label:       'Calculated',
            collapsible: true,
            fields: [
              {
                id: 'lft_corr_ca', key: 'corrected_calcium', label: 'Corrected Calcium', type: 'calculated',
                unit: 'mg/dL', required: false, precision: 2,
                formula: 'corrected_calcium', formulaInputs: ['calcium', 'albumin'],
                hint: 'Auto-calculated from calcium + albumin',
              },
            ],
          },
        ],
        interpretation: { enabled: true, prompt: 'Describe pattern: hepatocellular, cholestatic, or mixed. Note severity.' },
        signature:      { required: true, roles: ['HOD', 'DOCTOR'] },
      },
    },

    // ── Urea & Electrolytes ─────────────────────────────────────────────────
    {
      name:        'Urea & Electrolytes (U&E)',
      description: 'Renal function and electrolyte panel',
      department:  Department.LABORATORY,
      dataSchema: {
        version: 1,
        layout:  'table',
        groups: [
          {
            id:          'grp_ue_renal',
            label:       'Renal Function',
            collapsible: false,
            fields: [
              {
                id: 'ue_urea', key: 'urea', label: 'Urea', type: 'numeric',
                unit: 'mmol/L', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 2.5, max: 7.5 } },
                criticalRange: { high: 35.0 },
              },
              {
                id: 'ue_creat', key: 'creatinine', label: 'Creatinine', type: 'numeric',
                unit: 'μmol/L', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { male: { min: 62, max: 115 }, female: { min: 53, max: 97 } },
                criticalRange: { high: 600 },
              },
              {
                id: 'ue_egfr', key: 'egfr', label: 'eGFR (CKD-EPI)', type: 'calculated',
                unit: 'mL/min/1.73m²', required: false, precision: 1,
                formula: 'ckd_epi', formulaInputs: ['creatinine', 'age', 'sex'],
                hint: '2021 race-free CKD-EPI equation',
              },
            ],
          },
          {
            id:          'grp_ue_elec',
            label:       'Electrolytes',
            collapsible: false,
            fields: [
              {
                id: 'ue_na', key: 'sodium', label: 'Sodium', type: 'numeric',
                unit: 'mmol/L', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 136, max: 145 } },
                criticalRange: { low: 120, high: 160 },
              },
              {
                id: 'ue_k', key: 'potassium', label: 'Potassium', type: 'numeric',
                unit: 'mmol/L', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 3.5, max: 5.0 } },
                criticalRange: { low: 2.8, high: 6.5 },
              },
              {
                id: 'ue_cl', key: 'chloride', label: 'Chloride', type: 'numeric',
                unit: 'mmol/L', required: false, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 98, max: 107 } },
              },
              {
                id: 'ue_hco3', key: 'bicarbonate', label: 'Bicarbonate (HCO₃)', type: 'numeric',
                unit: 'mmol/L', required: false, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 22, max: 29 } },
                criticalRange: { low: 10, high: 40 },
              },
              {
                id: 'ue_ag', key: 'anion_gap', label: 'Anion Gap', type: 'calculated',
                unit: 'mmol/L', required: false, precision: 1,
                formula: 'anion_gap', formulaInputs: ['sodium', 'chloride', 'bicarbonate'],
                hint: 'Auto-calculated. Elevated suggests metabolic acidosis with high AG.',
              },
            ],
          },
        ],
        interpretation: { enabled: true, prompt: 'Comment on renal function, CKD stage if applicable, and electrolyte abnormalities' },
        signature:      { required: true, roles: ['HOD', 'DOCTOR'] },
      },
    },

    // ── Malaria Parasite Test ───────────────────────────────────────────────
    {
      name:        'Malaria Parasite (MP) Test',
      description: 'Thick and thin film microscopy for malaria parasite',
      department:  Department.LABORATORY,
      dataSchema: {
        version: 1,
        layout:  'table',
        groups: [
          {
            id:          'grp_mp_result',
            label:       'Malaria Parasite Result',
            collapsible: false,
            fields: [
              {
                id: 'mp_result', key: 'mp_result', label: 'Result', type: 'select',
                required: true, flagLogic: 'manual',
                options: ['Negative', 'Positive - P. falciparum', 'Positive - P. vivax', 'Positive - P. malariae', 'Positive - P. ovale', 'Positive - Mixed', 'Inconclusive'],
              },
              {
                id: 'mp_density', key: 'parasite_density', label: 'Parasite Density', type: 'select',
                required: false, flagLogic: 'manual',
                options: ['Not applicable', '+  (1–10/HPF)', '++ (11–100/HPF)', '+++ (101–1000/HPF)', '++++ (>1000/HPF)'],
                hint: 'Complete only if result is positive',
              },
              {
                id: 'mp_gametocyte', key: 'gametocytes', label: 'Gametocytes Seen', type: 'boolean',
                required: false, flagLogic: 'manual',
              },
              {
                id: 'mp_method', key: 'method', label: 'Method', type: 'select',
                required: true, flagLogic: 'manual',
                options: ['Thick & Thin Film Microscopy', 'Rapid Diagnostic Test (RDT)', 'Both'],
              },
            ],
          },
        ],
        interpretation: { enabled: true, prompt: 'State clinical significance and any treatment guidance if positive' },
        signature:      { required: true, roles: ['HOD', 'DOCTOR'] },
      },
    },

    // ── Lipid Profile ───────────────────────────────────────────────────────
    {
      name:        'Lipid Profile',
      description: 'Full cardiovascular lipid panel including calculated LDL',
      department:  Department.LABORATORY,
      dataSchema: {
        version: 1,
        layout:  'table',
        groups: [
          {
            id:          'grp_lipid',
            label:       'Lipid Panel',
            collapsible: false,
            fields: [
              {
                id: 'lip_tc', key: 'total_cholesterol', label: 'Total Cholesterol', type: 'numeric',
                unit: 'mmol/L', required: true, precision: 2, flagLogic: 'auto',
                referenceRange: { general: { min: 0, max: 5.2 } },
                criticalRange: { high: 10.0 },
              },
              {
                id: 'lip_hdl', key: 'hdl', label: 'HDL Cholesterol', type: 'numeric',
                unit: 'mmol/L', required: true, precision: 2, flagLogic: 'auto',
                referenceRange: { male: { min: 1.0, max: 99 }, female: { min: 1.3, max: 99 } },
                hint: 'Higher is protective',
              },
              {
                id: 'lip_tg', key: 'triglycerides', label: 'Triglycerides', type: 'numeric',
                unit: 'mmol/L', required: true, precision: 2, flagLogic: 'auto',
                referenceRange: { general: { min: 0, max: 1.7 } },
                criticalRange: { high: 10.0 },
              },
              {
                id: 'lip_ldl', key: 'ldl', label: 'LDL Cholesterol (Friedewald)', type: 'calculated',
                unit: 'mmol/L', required: false, precision: 2,
                formula: 'ldl_friedewald', formulaInputs: ['total_cholesterol', 'hdl', 'triglycerides'],
                hint: 'Invalid if triglycerides >4.52 mmol/L — measure directly instead',
              },
            ],
          },
        ],
        interpretation: { enabled: true, prompt: 'Comment on cardiovascular risk. Note if patient is fasting.' },
        signature:      { required: true, roles: ['HOD', 'DOCTOR'] },
      },
    },

    // ── Ultrasound Report ───────────────────────────────────────────────────
    {
      name:        'Ultrasound Report',
      description: 'General ultrasound imaging report',
      department:  Department.RADIOLOGY,
      dataSchema: {
        version: 1,
        layout:  'sections',
        groups: [
          {
            id:          'grp_us_header',
            label:       'Examination Details',
            collapsible: false,
            fields: [
              {
                id: 'us_region', key: 'region', label: 'Region Examined', type: 'select',
                required: true, flagLogic: 'manual',
                options: ['Abdomen', 'Pelvis', 'Abdomen & Pelvis', 'Obstetric', 'Renal', 'Thyroid', 'Breast', 'Scrotal', 'Musculoskeletal', 'Vascular', 'Other'],
              },
              {
                id: 'us_indication', key: 'clinical_indication', label: 'Clinical Indication', type: 'richtext',
                required: true, flagLogic: 'manual',
              },
            ],
          },
          {
            id:          'grp_us_findings',
            label:       'Findings',
            collapsible: false,
            fields: [
              {
                id: 'us_findings', key: 'findings', label: 'Findings', type: 'richtext',
                required: true, flagLogic: 'manual',
                hint: 'Describe each organ/structure systematically',
              },
            ],
          },
          {
            id:          'grp_us_impression',
            label:       'Impression & Recommendation',
            collapsible: false,
            fields: [
              {
                id: 'us_impression', key: 'impression', label: 'Impression', type: 'richtext',
                required: true, flagLogic: 'manual',
                hint: 'Primary conclusion — this is what the requesting doctor reads first',
              },
              {
                id: 'us_recommendation', key: 'recommendation', label: 'Recommendation', type: 'richtext',
                required: false, flagLogic: 'manual',
              },
            ],
          },
        ],
        interpretation: { enabled: false },
        signature:      { required: true, roles: ['HOD', 'DOCTOR'] },
      },
    },

    // ── Random Blood Sugar ──────────────────────────────────────────────────
    {
      name:        'Blood Glucose',
      description: 'Fasting, random, or post-prandial blood glucose',
      department:  Department.LABORATORY,
      dataSchema: {
        version: 1,
        layout:  'table',
        groups: [
          {
            id:          'grp_bg',
            label:       'Blood Glucose',
            collapsible: false,
            fields: [
              {
                id: 'bg_type', key: 'glucose_type', label: 'Sample Type', type: 'select',
                required: true, flagLogic: 'manual',
                options: ['Fasting', 'Random', '2-hour Post-prandial', 'Post-glucose load (OGTT)'],
              },
              {
                id: 'bg_value', key: 'glucose', label: 'Glucose', type: 'numeric',
                unit: 'mmol/L', required: true, precision: 1, flagLogic: 'auto',
                referenceRange: { general: { min: 3.9, max: 7.8 } },
                criticalRange: { low: 2.8, high: 25.0 },
                hint: 'Reference range shown is for fasting — adjust interpretation for random/post-prandial',
              },
            ],
          },
        ],
        interpretation: { enabled: true, prompt: 'Interpret in context of sample type. Note if diagnostic criteria for diabetes or pre-diabetes are met.' },
        signature:      { required: true, roles: ['HOD', 'DOCTOR'] },
      },
    },

  ];

  const results: { name: string; status: 'created' | 'skipped' }[] = [];

  for (const t of templates) {
    const exists = await prisma.template.findFirst({
      where: { tenantId, name: t.name, department: t.department },
    });

    if (exists) {
      results.push({ name: t.name, status: 'skipped' });
      continue;
    }

    await prisma.template.create({
      data: {
        name:        t.name,
        description: t.description,
        type:        templateTypeForDepartment(t.department),
        department:  t.department,
        dataSchema:  t.dataSchema as unknown as Prisma.InputJsonValue,
        version:     1,
        isActive:    true,
        createdBy:   seededBy,
        tenantId,
      },
    });

    results.push({ name: t.name, status: 'created' });
  }

  return results;
}
