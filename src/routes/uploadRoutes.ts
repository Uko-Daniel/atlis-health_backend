import { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { access, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/var/www/atlis-health/uploads';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/dicom'];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export async function uploadRoutes(fastify: FastifyInstance) {
  await fastify.register(multipart, {
    limits: {
      fileSize: MAX_SIZE,
    },
  });

  fastify.addHook('preHandler', authenticate);

  // POST /api/upload — single file upload
  fastify.post('/upload', {
    preHandler: [authorize(['DOCTOR', 'LAB_SCIENTIST', 'IMAGING_TECH', 'NURSES', 'ADMIN', 'IT_SUPPORT'])],
    handler: async (request, reply) => {
      try {
        const file = await request.file();
        if (!file) return reply.status(400).send({ error: 'No file uploaded' });

        // Validate type
        if (!ALLOWED_TYPES.includes(file.mimetype)) {
          return reply.status(400).send({ error: `File type ${file.mimetype} not allowed` });
        }

        // Validate size
        const chunks: Buffer[] = [];
        for await (const chunk of file.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        if (buffer.length > MAX_SIZE) {
          return reply.status(400).send({ error: 'File exceeds 20MB limit' });
        }

        // Generate safe filename
        const ext = path.extname(file.filename) || '.bin';
        const safeName = `${randomUUID()}${ext}`;
        const tenantDir = path.join(UPLOAD_DIR, request.tenantId);

        await mkdir(tenantDir, { recursive: true });
        await writeFile(path.join(tenantDir, safeName), buffer);

        const url = `/api/uploads/${request.tenantId}/${safeName}`;

        return reply.status(201).send({
          url,
          filename: file.filename,
          mimetype: file.mimetype,
          size: buffer.length,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        return reply.status(500).send({ error: message });
      }
    },
  });

  // GET /api/uploads/:tenantId/:filename — serve uploaded files
  fastify.get('/uploads/:tenantId/:filename', {
    handler: async (request, reply) => {
      const { tenantId, filename } = request.params as { tenantId: string; filename: string };

      // Prevent directory traversal
      if (filename.includes('..') || filename.includes('/')) {
        return reply.status(400).send({ error: 'Invalid filename' });
      }

      const filepath = path.join(UPLOAD_DIR, tenantId, filename);
      try {
        await access(filepath);
        return reply.send(createReadStream(filepath));
      } catch {
        return reply.status(404).send({ error: 'File not found' });
      }
    },
  });
}
