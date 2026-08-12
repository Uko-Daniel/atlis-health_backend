import { prisma } from '../lib/prisma';
import { encryptJSON, decryptJSON } from '../utils/crypto';
import crypto from 'crypto';

const PAYSTACK_BASE = 'https://api.paystack.co';

interface InitializePaymentInput {
  tenantId: string;
  patientId: string;
  serviceIds: string[];
  amount: number; // in Naira
  currency?: string;
}

/**
 * Initialize a Paystack transaction for a tenant.
 * Saves a PENDING payment record and returns the authorization URL.
 */
export async function initializePayment({
  tenantId,
  patientId,
  serviceIds,
  amount,
  currency = 'NGN',
}: InitializePaymentInput) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.paystackSecretKey || !tenant?.paystackPublicKey) {
    throw new Error('Paystack is not configured for this tenant');
  }

  const secretKey = decryptJSON(tenant.paystackSecretKey);
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });

  const payload = {
    email: patient?.email ?? 'no-reply@example.com',
    amount: amount * 100, // kobo
    currency,
    metadata: {
      tenantId,
      patientId,
      serviceIds,
    },
  };

  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Paystack initialization failed');
  }

  const { reference, authorization_url, access_code } = data.data;

  await prisma.payment.create({
    data: {
      tenantId,
      patientId,
      reference,
      amount,
      authorizationUrl: authorization_url,
      accessCode: access_code,
      status: 'PENDING',
      metadata: payload.metadata,
    },
  });

  return { reference, authorizationUrl: authorization_url };
}

/**
 * Handle Paystack webhook events.
 * Verifies signature, updates payment status, and creates orders on success.
 *
 * @param rawBody - raw request body as string
 * @param signature - value of `x-paystack-signature` header
 */
export async function handlePaystackWebhook(rawBody: string, signature: string) {
  if (!rawBody || !signature) {
    throw new Error('Missing raw body or signature');
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid JSON');
  }

  const tenantId = payload?.data?.metadata?.tenantId;
  if (!tenantId) {
    throw new Error('Missing tenantId in webhook payload');
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.paystackSecretKey) {
    throw new Error('Tenant not configured for Paystack');
  }

  const secretKey = decryptJSON(tenant.paystackSecretKey);
  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  if (hash !== signature) {
    throw new Error('Invalid Paystack signature');
  }

  const eventType = payload.event as string;
  const data = payload.data;

  const payment = await prisma.payment.findUnique({
    where: { reference: data.reference },
  });

  if (!payment) {
    return { status: 'ignored' };
  }

  if (eventType === 'charge.success') {
    if (payment.status !== 'SUCCESSFUL') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESSFUL', paidAt: new Date() },
      });

      const metadata = payment.metadata as any;
      const { serviceIds } = metadata;

      // Create order directly (avoid circular dependency)
      const order = await prisma.order.create({
        data: {
          patientId: payment.patientId,
          paymentMethod: 'CARD',
          services: {
            create: serviceIds.map((serviceId: string) => ({ serviceId })),
          },
        },
        include: { services: true },
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: { orderId: order.id },
      });

      return { status: 'order_created', orderId: order.id };
    }
  } else if (eventType === 'charge.failed' || eventType === 'charge.reversed') {
    const newStatus = eventType === 'charge.failed' ? 'FAILED' : 'REVERSED';
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus },
    });
    return { status: 'updated', paymentStatus: newStatus };
  }

  return { status: 'ignored' };
}