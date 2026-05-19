import 'dotenv/config';

import Fastify from 'fastify';
import { app } from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const server = Fastify({
    logger: true,
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