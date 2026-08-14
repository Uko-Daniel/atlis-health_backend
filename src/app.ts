import { type FastifyInstance } from "fastify";
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
import { signupRoutes } from "./routes/signupRoutes";
import { tenantRoutes } from './routes/tenantRoutes';
import { billingRoutes } from './routes/billingRoutes';
import { permissionRoutes } from './routes/permissionRoutes';
import { googleRoutes } from './routes/googleRoutes';
import { uploadRoutes } from './routes/uploadRoutes';
import { requestRoutes } from './routes/requestRoutes';
import { supplierRoutes } from './routes/supplierRoutes';
import { inventoryRoutes } from './routes/inventoryRoutes';
import { purchaseOrderRoutes } from './routes/purchaseOrderRoutes';
import { auditLogRoutes } from './routes/auditLogRoutes';
import { notificationRoutes } from './routes/notificationRoutes';
import { paystackWebhookRoutes } from './routes/webhooks';
import adminRoutes from './routes/s-adminRoutes';




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
  fastify.register(signupRoutes,        { prefix: '/api' })
  fastify.register(tenantRoutes,        { prefix: '/api' });
  fastify.register(billingRoutes,       { prefix: '/api' });
  fastify.register(permissionRoutes,    { prefix: '/api' });
  fastify.register(googleRoutes,        { prefix: '/api' });
  fastify.register(uploadRoutes,        { prefix: '/api' });
  fastify.register(requestRoutes,       { prefix: '/api' });
  fastify.register(supplierRoutes, { prefix: '/api' });
  fastify.register(inventoryRoutes, { prefix: '/api' });
  fastify.register(purchaseOrderRoutes, { prefix: '/api' });
  fastify.register(auditLogRoutes, { prefix: '/api' });
  fastify.register(notificationRoutes, { prefix: '/api' });
  fastify.register(paystackWebhookRoutes, { prefix: '/api' });
  fastify.register(adminRoutes, { prefix: '/api/admin' });

}


