import { type FastifyRequest, type FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';

// ── TENANT RESOLUTION ─────────────────────────────────────────
// Extracts tenant from Host header on every request.
// Attaches request.tenantId for use in all downstream handlers.
//
// Resolution order:
//   1. Exact match on customDomain
//   2. Subdomain match: {tenant}.atlis.com.ng → tenant
//   3. Fallback: health.atlis.com.ng → default "atlis" tenant

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    tenant?: {
      id: string;
      facilityName: string;
      subdomain: string;
      subscriptionStatus: string;
      themePrimaryColor: string | null;
      logoUrl: string | null;
    };
  }
}

export async function resolveTenant(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const host = request.headers.host ?? '';
  const originHost = host.split(':')[0] ?? ''; // strip port

  let tenant = null;

  // 1. Try custom domain exact match
  tenant = await prisma.tenant.findFirst({
    where: {
      customDomain: originHost,
      subscriptionStatus: { not: 'EXPIRED' },
    },
  });

  // 2. Try subdomain match
  if (!tenant && originHost.endsWith('.atlis.com.ng')) {
    const subdomain = originHost.replace('.atlis.com.ng', '');
    if (subdomain && subdomain !== 'health') {
      tenant = await prisma.tenant.findFirst({
        where: {
          subdomain,
          subscriptionStatus: { not: 'EXPIRED' },
        },
      });
    }
  }

  // 3. Fallback: health.atlis.com.ng or localhost → default "atlis" tenant
  if (!tenant) {
    tenant = await prisma.tenant.findFirst({
      where: { subdomain: 'atlis' },
    });
  }

  if (!tenant) {
    return reply.status(500).send({
      error: 'Tenant not configured',
      message: 'No tenant found for this domain. Contact support.',
    });
  }

  request.tenantId = tenant.id;
  request.tenant = {
    id: tenant.id,
    facilityName: tenant.facilityName,
    subdomain: tenant.subdomain,
    subscriptionStatus: tenant.subscriptionStatus,
    themePrimaryColor: tenant.themePrimaryColor,
    logoUrl: tenant.logoUrl,
  };
}
