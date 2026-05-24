import { fastify, type FastifyInstance } from "fastify";
import { patientRoutes } from "./routes/patientRoutes";
import orderRoutes from "./routes/orderRoutes";
import { staffRoutes } from "./routes/staffRoutes";
import { serviceRoutes } from "./routes/serviceRoutes";

export const app = async (fastify: FastifyInstance) => {
    fastify.register(patientRoutes, { prefix: '/api' });
    fastify.register(orderRoutes, { prefix: '/api'});
    fastify.register(serviceRoutes, { prefix: '/api'});
    fastify.register(staffRoutes, { prefix: '/api'});
};