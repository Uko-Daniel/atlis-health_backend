import { fastify, type FastifyInstance } from "fastify";
import { patientRoutes } from "./routes/patientRoutes";
import orderRoutes from "./routes/orderRoutes";
import { templateRoutes } from "./routes/templateRoutes";
import { serviceRoutes } from "./routes/serviceRoutes";
import { resultRoutes } from "./routes/resultRoutes";

export const app = async (fastify: FastifyInstance) => {
    fastify.register(patientRoutes, { prefix: '/api' });
    fastify.register(orderRoutes, { prefix: '/api'});
    fastify.register(templateRoutes, { prefix: '/api'});
    fastify.register(serviceRoutes, { prefix: '/api'});
    fastify.register(resultRoutes, { prefix: '/api'});
};