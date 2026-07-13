import {
  type FastifyRequest,
  type FastifyReply,
} from 'fastify';
import { type StaffRole } from '../../generated/prisma/enums';

// ── ROLE HIERARCHY ────────────────────────────────────────────
// Higher index = higher privilege.
// Used for "at least this role" checks.

const ROLE_HIERARCHY: StaffRole[] = [
  'RECEPTIONIST',
  'BILLING_OFFICER',
  'LAB_SCIENTIST',
  'IMAGING_TECH',
  'NURSES',
  'PHARMACIST',
  'HIM_OFFICER',
  'DOCTOR',
  'MANAGER',
  'IT_SUPPORT',
  'ADMIN',
  'SUPER_ADMIN'
];

// ── HELPERS ───────────────────────────────────────────────────

function roleIndex(role: StaffRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

function forbidden(reply: FastifyReply, message: string): void {
  reply.status(403).send({
    statusCode: 403,
    error:      'Forbidden',
    message,
  });
}

// ── AUTHORIZE ─────────────────────────────────────────────────

/**
 * Restricts a route to one or more specific roles.
 *
 * Usage on a route:
 *   preHandler: [authenticate, authorize(['ADMIN', 'MANAGER'])]
 */
export function authorize(allowedRoles: StaffRole[]) {
  return async function (
    request: FastifyRequest,
    reply:   FastifyReply,
  ): Promise<void> {
    if (!allowedRoles.includes(request.user.role)) {
      forbidden(reply, `Access restricted to: ${allowedRoles.join(', ')}`);
    }
  };
}

/**
 * Restricts a route to roles at or above a minimum level
 * in the role hierarchy.
 *
 * Usage:
 *   preHandler: [authenticate, authorizeMinRole('DOCTOR')]
 *   → allows DOCTOR, MANAGER, ADMIN
 */
export function authorizeMinRole(minimumRole: StaffRole) {
  return async function (
    request: FastifyRequest,
    reply:   FastifyReply,
  ): Promise<void> {
    const userIndex = roleIndex(request.user.role);
    const minIndex  = roleIndex(minimumRole);

    if (userIndex < minIndex) {
      forbidden(
        reply,
        `This action requires at least the ${minimumRole} role`,
      );
    }
  };
}

/**
 * Restricts a route to HODs only (within their department).
 * ADMIN always passes.
 */
export async function authorizeHOD(
  request: FastifyRequest,
  reply:   FastifyReply,
): Promise<void> {
  const { role, isHOD } = request.user;

  if (role !== 'ADMIN' && !isHOD) {
    forbidden(reply, 'This action requires Head of Department privileges');
  }
}

/**
 * Restricts result verification to staff with canVerify flag
 * or ADMIN.
 */
export async function authorizeVerifier(
  request: FastifyRequest,
  reply:   FastifyReply,
): Promise<void> {
  const { role, canVerify } = request.user;

  if (role !== 'ADMIN' && !canVerify) {
    forbidden(reply, 'You cannot verify results. Ask a staff member with verification privileges to do it for you');
  }
}

/**
 * Blocks patient-facing routes from staff roles that
 * should never access clinical result data.
 * Receptionist and Billing see order status only — never data.
 */
export async function blockResultAccess(
  request: FastifyRequest,
  reply:   FastifyReply,
): Promise<void> {
  const blockedRoles: StaffRole[] = ['RECEPTIONIST', 'BILLING_OFFICER'];

  if (blockedRoles.includes(request.user.role)) {
    forbidden(reply, 'You cannot access clinical results');
  }
}