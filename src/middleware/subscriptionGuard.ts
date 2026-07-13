import { type FastifyRequest, type FastifyReply } from 'fastify';

// ── SUBSCRIPTION GUARD ────────────────────────────────────────
// Applied after tenantContext. Blocks mutating requests based on
// subscription status.
//
// ACTIVE       → full access
// GRACE_PERIOD → read-only (blocks POST/PUT/PATCH/DELETE except auth + billing)
// SUSPENDED    → blocks all except auth + billing info endpoint
// EXPIRED      → blocks all except auth

const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const EXEMPT_PREFIXES = ['/api/auth', '/api/billing/status'];

function isExempt(url: string): boolean {
  return EXEMPT_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export async function enforceSubscription(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const status = request.tenant?.subscriptionStatus;
  const method = request.method;
  const url = request.url;

  // Exempt endpoints always pass
  if (isExempt(url)) return;

  // ACTIVE — full access
  if (status === 'ACTIVE') return;

  // GRACE_PERIOD — read-only
  if (status === 'GRACE_PERIOD' && READ_ONLY_METHODS.includes(method)) return;

  // Everything else is blocked
  const message = status === 'GRACE_PERIOD'
    ? 'Your subscription is in a grace period. Data entry is temporarily restricted. Please contact billing to restore full access.'
    : 'Your subscription has been suspended. Please contact billing to reactivate your account.';

  return reply.status(402).send({
    statusCode: 402,
    error: 'Subscription Required',
    message,
    subscriptionStatus: status,
  });
}