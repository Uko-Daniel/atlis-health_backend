import { fastify, type FastifyInstance } from "fastify";
import { patientRoutes } from "./routes/patientRoutes";
import orderRoutes from "./routes/orderRoutes";
import { staffRoutes } from "./routes/staffRoutes";
import { serviceRoutes } from "./routes/serviceRoutes";
import { clinicalRoutes } from "./routes/clinicalRoutes";
import { resultRoutes } from "./routes/resultRoutes";
import { resultEditorRoutes } from "./routes/resultEditorRoutes";
import { authRoutes } from "./routes/authRoutes";
import { templateRoutes } from "./routes/templateRoutes";
import { eveeRoutes } from "./routes/eveeRoutes";
import {recordRoutes} from "./routes/recordRoutes";

export const app = async (fastify: FastifyInstance) => {
  fastify.register(authRoutes,          { prefix: '/api/auth'      });
  fastify.register(patientRoutes,       { prefix: '/api'           });
  fastify.register(orderRoutes,         { prefix: '/api'           });
  fastify.register(serviceRoutes,       { prefix: '/api'           });
  fastify.register(staffRoutes,         { prefix: '/api'           });
  fastify.register(clinicalRoutes,      { prefix: '/api'           });
  fastify.register(resultRoutes,        { prefix: '/api/results'   });
  fastify.register(resultEditorRoutes,  { prefix: '/api/editor'    });
  fastify.register(templateRoutes,      { prefix: '/api/templates' });
  fastify.register(eveeRoutes,          { prefix: '/api/evee'      });
  fastify.register(recordRoutes,        { prefix: '/api/records'   });
}


