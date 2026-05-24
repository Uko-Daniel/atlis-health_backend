import 'dotenv/config';
import jwt from '@fastify/jwt';
import Fastify from 'fastify';
import { app } from './app';
import cors from '@fastify/cors'


const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET missing');
}


const server = Fastify({
    logger: true,
});

await server.register(cors, {
  origin: 'http://localhost:5173',   // your Vite dev server
  credentials: true,                  // needed for httpOnly cookie refresh token
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
})

server.register(jwt, {
  secret: JWT_SECRET,
});

// Register the main app (all routes, plugins, etc.)
server.register(app);

const start = async () => {
    try {
        await server.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Server running on http://localhost:${PORT}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();