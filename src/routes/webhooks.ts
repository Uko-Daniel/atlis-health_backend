import { type FastifyInstance } from 'fastify';
import { handlePaystackWebhook } from '../services/paystackService';

export async function paystackWebhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/paystack', {
    config: { rawBody: true }, // enable raw body for this route
  }, async (request, reply) => {
    const rawBody = (request as any).rawBody;
    const signature = request.headers['x-paystack-signature'] as string;

    try {
      const result = await handlePaystackWebhook(rawBody, signature);
      return reply.send({ received: true, result });
    } catch (error: any) {
      // Log but still return 200 to prevent retries (except invalid signature)
      if (error.message === 'Invalid Paystack signature') {
        return reply.code(401).send('Invalid signature');
      }
      request.log.error(`Paystack webhook processing error: ${error.message}`);
      return reply.send({ received: true, error: error.message });
    }
  });
}