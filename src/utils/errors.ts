export const ErrorCode = {
  // Generic
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL_ERROR',

  // Patient
  PATIENT_NOT_FOUND: 'PATIENT_NOT_FOUND',

  // Staff
  STAFF_NOT_FOUND: 'STAFF_NOT_FOUND',
  STAFF_EMAIL_EXISTS: 'STAFF_EMAIL_EXISTS',
  STAFF_DEPT_REQUIRED: 'STAFF_DEPT_REQUIRED',
  STAFF_AUDIT_BLOCKED: 'STAFF_AUDIT_BLOCKED',

  // Result
  RESULT_NOT_FOUND: 'RESULT_NOT_FOUND',
  RESULT_LOCKED: 'RESULT_LOCKED',
  RESULT_FINALIZED: 'RESULT_FINALIZED',
  RESULT_VERIFIED: 'RESULT_VERIFIED',
  RESULT_DEPT_MISMATCH: 'RESULT_DEPT_MISMATCH',

  // Order
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_INVALID_SERVICES: 'ORDER_INVALID_SERVICES',

  // Template
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_HAS_RESULTS: 'TEMPLATE_HAS_RESULTS',
  TEMPLATE_ALREADY_ACTIVE: 'TEMPLATE_ALREADY_ACTIVE',

  // Encounter
  ENCOUNTER_NOT_FOUND: 'ENCOUNTER_NOT_FOUND',
  ENCOUNTER_CLOSED: 'ENCOUNTER_CLOSED',

  // Tenant
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',

  // Signup
  SIGNUP_EMAIL_EXISTS: 'SIGNUP_EMAIL_EXISTS',
  SIGNUP_STAFF_EXISTS: 'SIGNUP_STAFF_EXISTS',
  SIGNUP_ALREADY_REVIEWED: 'SIGNUP_ALREADY_REVIEWED',

  // Billing
  BILLING_PERIOD_EXISTS: 'BILLING_PERIOD_EXISTS',
} as const

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode]

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCodeType,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorResponse(
  statusCode: number,
  code: ErrorCodeType,
  message: string,
  details?: Record<string, unknown>
) {
  return {
    statusCode,
    error: { code, message, ...(details && { details }) },
  }
}