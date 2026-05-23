import fp from 'fastify-plugin';
import {
  type FastifyInstance,
  type FastifyRequest,
  type FastifyReply,
} from 'fastify';
import { prisma } from '../lib/prisma';

// ── AUDIT LOGGER ──────────────────────────────────────────────

function getPathParts(url: string): string[] {
    const [path = ''] = url.split('?');
  return path.split('/').filter(Boolean);
}

function deriveAction(method: string, url: string | undefined | null): string {
    if (!url) return `${method}_UNKNOWN`;
  const parts  = getPathParts(url);
  const entity = (parts[1] ?? 'UNKNOWN').toUpperCase();

  if (url.includes('/verify'))     return `VERIFY_${entity}`;
  if (url.includes('/release'))    return `RELEASE_${entity}`;
  if (url.includes('/override'))   return `OVERRIDE_EVEE_ALERT`;
  if (url.includes('/deactivate')) return `DEACTIVATE_${entity}`;
  if (url.includes('/draft'))      return `AUTOSAVE_DRAFT`;
  if (url.includes('/submit'))     return `SUBMIT_RESULT`;
  if (url.includes('/evaluate'))   return `EVEE_EVALUATE`;
  if (url.includes('/session'))    return `EDITOR_SESSION`;

  const methodMap: Record<string, string> = {
    POST:   'CREATE',
    PUT:    'UPDATE',
    PATCH:  'UPDATE',
    DELETE: 'DELETE',
  };

  return `${methodMap[method] ?? method}_${entity}`;
}

function extractEntityId(request: FastifyRequest): string {
  const params = request.params as Record<string, string> | undefined;
  const body   = request.body   as Record<string, unknown> | null | undefined;

  return params?.['id']
      ?? params?.['patientId']
      ?? params?.['resultId']
      ?? params?.['orderId']
      ?? (typeof body?.['id'] === 'string' ? body['id'] : undefined)
      ?? 'unknown';
}

const ENTITY_TYPE_MAP: Record<string, string> = {
  patients:    'Patient',
  results:     'Result',
  orders:      'Order',
  templates:   'Template',
  encounters:  'Encounter',
  vitals:      'Vital',
  diagnoses:   'Diagnosis',
  allergies:   'Allergy',
  medications: 'Medication',
  staff:       'Staff',
  evee:        'EveeEvaluation',
  admissions:  'Admission',
  services:    'Service',
  inventory:   'InventoryItem',
};

function extractEntityType(url: string | undefined): string {
  if (!url) return 'Unknown';
  const parts = getPathParts(url);
  const resource = parts[1] ?? '';
  return ENTITY_TYPE_MAP[resource] ?? 'Unknown';
}

// ── PLUGIN ────────────────────────────────────────────────────

export const auditLoggerPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {

      const mutateMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      if (!mutateMethods.includes(request.method)) return;
      if (!request.user?.sub)                      return;
      if (reply.statusCode >= 500)                 return;

      try {
        await prisma.auditLog.create({
          data: {
            userId:     request.user.sub,
            action:     deriveAction(request.method, request.url),
            entityId:   extractEntityId(request),
            entityType: extractEntityType(request.url),
            ipAddress:  request.ip ?? null,
          },
        });
      } catch (err) {
        fastify.log.error({ err }, 'Failed to write audit log');
      }
    },
  );
});

// ── MANUAL AUDIT HELPER ───────────────────────────────────────

export async function writeAuditLog(params: {
  userId:     string;
  action:     string;
  entityId:   string;
  entityType: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params });
  } catch (err) {
    console.error('Failed to write manual audit log:', err);
  }
}