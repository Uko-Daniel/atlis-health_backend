import { type Patient } from '../types/patient';
import { type Template } from '../types/template';
import { type Service } from '../types/service';
import Ajv from 'ajv';
import type { AnySchema } from 'ajv';
import { prisma } from '../lib/prisma';

const ajv = new Ajv({ allErrors: true });

function isAjvSchema(value: unknown): value is AnySchema {
  return typeof value === 'object' && value !== null;
}

// --------------------------- Patient ---------------------------

export function validatePatient(data: Partial<Patient>, partial = false): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!partial || data.firstName !== undefined) {
        if (!data.firstName || data.firstName.trim() === '') errors.push('First name is required.');
    }

    if (!partial || data.lastName !== undefined) {
        if (!data.lastName || data.lastName.trim() === '') errors.push('Last name is required.');
    }

    if (!partial || data.dob !== undefined) {
        if (!data.dob) errors.push('Date of birth is required.');
    }

    if (!partial || data.gender !== undefined) {
        if (!['MALE', 'FEMALE', 'OTHER'].includes(data.gender as string)) errors.push('Gender must be MALE, FEMALE, or OTHER.');
    }

    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) errors.push('Invalid email format.');
    if (data.phoneNumber && !/^\+?\d{7,15}$/.test(data.phoneNumber)) errors.push('Invalid phone number format.');

    return { valid: errors.length === 0, errors };
}

// --------------------------- Order ---------------------------

export function validateOrder(data: { patientId?: string; serviceIds?: string[] }) {
    const errors: string[] = [];

    if (!data.patientId) errors.push('Patient ID is required');

    if (!data.serviceIds || data.serviceIds.length === 0) {
        errors.push('At least one service is required');
    }

    return { valid: errors.length === 0, errors };
}

// --------------------------- Enums ---------------------------

export function validateEnum<T extends Record<string, string | number>>(
    value: any,
    enumObject: T,
    fieldName: string
) {
    const validValues = Object.values(enumObject);

    if (!validValues.includes(value)) {
        throw new Error(
           ` ${fieldName} must be one of: ${validValues.join(', ')}`
        );
    }

    return value as T[keyof T];
}

// --------------------------- Template ---------------------------

export function validateTemplate(data: Partial<Template>) {
    const errors: string[] = [];

    if (!data.name || data.name.trim() === '') errors.push('Template name is required.');
    if (!data.type || !['LAB', 'IMAGING', 'OTHER'].includes(data.type)) errors.push('Invalid template type.');
    if (!data.dataSchema || typeof data.dataSchema !== 'object') errors.push('dataSchema must be a valid JSON object.');

    return { valid: errors.length === 0, errors };
}

// --------------------------- Service ---------------------------

export function validateService(data: Partial<Service>) {
  const errors: string[] = [];

  if (!data.name || data.name.trim() === '') errors.push('Name is required');
  if (!data.labCode || data.labCode.trim() === '') errors.push('Lab code is required');
  if (!data.price || data.price <= 0) errors.push('Price must be positive');

  return { valid: errors.length === 0, errors };
}

// --------------------------- Result JSON / Evee ---------------------------

/**
 * Converts your template "fields" array into a proper AJV JSON Schema
 */
function convertTemplateToAjvSchema(templateDataSchema: any) {
  if (!templateDataSchema?.fields || !Array.isArray(templateDataSchema.fields)) {
    throw new Error('Invalid template schema: "fields" array missing');
  }

  const properties: Record<string, any> = {};
  const required: string[] = [];

  templateDataSchema.fields.forEach((f: any) => {
    properties[f.name] = { type: f.type };
    required.push(f.name);

    if (f.range && f.type === 'number') {
      const [min, max] = f.range.split('-').map(Number);
      properties[f.name].minimum = min;
      properties[f.name].maximum = max;
    }
  });
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

/**
 * Validates result JSON against template schema
 */
export const validateResultJSON = async (templateId: string, data: any) => {
  // Fetch the template from DB
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) return { valid: false, errors: ['Template not found'] };

  let ajvSchema;
  try {
    ajvSchema = convertTemplateToAjvSchema(template.dataSchema);
  } catch (err: any) {
    return { valid: false, errors: [err.message] };
  }

  // Compile and validate
  const validate = ajv.compile(ajvSchema);
  const valid = validate(data);

  return { valid: !!valid, errors: validate.errors?.map(e => e.message) };
};
