import { type FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { getAuthUrl, handleCallback, storeTokens, getConnectionStatus, disconnect } from '../services/googleService';

export async function googleRoutes(fastify: FastifyInstance) {

  // GET /api/auth/google — returns the OAuth URL for a staff member
  fastify.get('/auth/google', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const state = Buffer.from(JSON.stringify({ staffId: request.user.sub })).toString('base64');
      const url = getAuthUrl(state);
      return reply.send({ url });
    },
  });

  // GET /api/auth/google/callback — Google redirects here after user consents
  fastify.get('/auth/google/callback', {
  handler: async (request, reply) => {
    try {
      const { code, state } = request.query as { code: string; state: string };
      if (!code) return reply.status(400).send({ error: 'Missing authorization code' });

      let staffId: string;
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        staffId = decoded.staffId;
      } catch {
        return reply.status(400).send({ error: 'Invalid state parameter' });
      }

      const { tokens } = await handleCallback(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        return reply.status(400).send({ error: 'Missing tokens from Google' });
      }

      await storeTokens(
        staffId,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date!,
        tokens.scope ?? '',
      );

      return reply.redirect(
        `${process.env.FRONTEND_URL ?? 'https://health.atlis.com.ng'}/settings?google=connected`
      );
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },
});

  // GET /api/auth/google/status — check if staff has connected Google
  fastify.get('/auth/google/status', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const status = await getConnectionStatus(request.user.sub);
      return reply.send(status);
    },
  });

  // DELETE /api/auth/google — disconnect Google account
  fastify.delete('/auth/google', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      await disconnect(request.user.sub);
      return reply.send({ message: 'Google account disconnected' });
    },
  });
}