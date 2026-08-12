import {
  type FastifyRequest,
  type FastifyReply,
} from 'fastify';
import { type Department } from '../../generated/prisma/enums';
import { prisma } from '../lib/prisma';

// ── DEPARTMENT GUARD ──────────────────────────────────────────
// Ensures staff can only access resources belonging to
// their own department. ADMIN always bypasses.
//
// Applied on result, template, and order routes where
// department scoping is required.

function forbidden(reply: FastifyReply, message: string): void {
  reply.status(403).send({
    statusCode: 403,
    error:      'Forbidden',
    message,
  });
}

/**
 * Verifies the requesting staff belongs to the specified department.
 * Used when department is known at route definition time.
 *
 * Usage:
 *   preHandler: [authenticate, guardDepartment('LABORATORY')]
 */
export function guardDepartment(department: Department) {
  return async function (
    request: FastifyRequest,
    reply:   FastifyReply,
  ): Promise<void> {
    const { role, department: userDept } = request.user;

    if (role === 'SUPER_ADMIN') return;
    if (role === 'DOCTOR') return;
    if (role === 'ADMIN') return; // Super Admin bypasses all dept checks

    if (userDept !== department) {
      forbidden(
        reply,
        `This resource belongs to the ${department} department`,
      );
    }
  };
}

/**
 * Verifies the requesting staff's department matches
 * the department on a Result record.
 * Reads resultId from request.params.
 *
 * Usage:
 *   preHandler: [authenticate, guardResultDepartment]
 */
export async function guardResultDepartment(
  request: FastifyRequest,
  reply:   FastifyReply,
): Promise<void> {
  const { role, department: userDept } = request.user;

  if (role === 'SUPER_ADMIN') return;
  if (role === 'ADMIN') return;
  if (role === 'DOCTOR') return;

  const { id, resultId } = request.params as {
    id?:       string;
    resultId?: string;
  };
  const idToCheck = id ?? resultId;

  if (!idToCheck) {
    reply.status(400).send({
      statusCode: 400,
      error:      'Bad Request',
      message:    'Result ID is required',
    });
    return;
  }

  const result = await prisma.result.findUnique({
    where:  { id: idToCheck },
    select: { department: true },
  });

  if (!result) {
    reply.status(404).send({
      statusCode: 404,
      error:      'Not Found',
      message:    'Result not found',
    });
    return;
  }

  if (result.department !== userDept) {
    forbidden(
      reply,
      'You do not have access to results outside your department',
    );
  }
}

/**
 * Verifies the requesting staff's department matches
 * the department on a Template record.
 * Reads templateId from request.params.
 *
 * Usage:
 *   preHandler: [authenticate, guardTemplateDepartment]
 */
export async function guardTemplateDepartment(
  request: FastifyRequest,
  reply:   FastifyReply,
): Promise<void> {
  const { department: userDept } = request.user;

  const { id } = request.params as { id: string };

  if (!id) {
    reply.status(400).send({
      statusCode: 400,
      error:      'Bad Request',
      message:    'Template ID is required',
    });
    return;
  }

  const template = await prisma.template.findUnique({
    where:  { id },
    select: { department: true },
  });

  if (!template) {
    reply.status(404).send({
      statusCode: 404,
      error:      'Not Found',
      message:    'Template not found',
    });
    return;
  }

  if (template.department !== userDept) {
    forbidden(
      reply,
      'You do not have access to templates outside your department',
    );
  }
}

/**
 * Soft department check — attaches a boolean to the request
 * indicating whether the user is in the given department.
 * Does not block — used for conditional logic in controllers.
 *
 * Usage:
 *   preHandler: [authenticate, attachDepartmentContext]
 *   Then in handler: request.user.department === 'LABORATORY'
 */
export async function attachDepartmentContext(
  _request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  // Department is already on request.user from the JWT payload.
  // This hook exists as a named placeholder for route clarity
  // and future department context enrichment.
}
