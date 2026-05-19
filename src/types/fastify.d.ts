import {
  type StaffRole,
  type Department,
} from '../../generated/prisma/enums';

// ── EXTEND FASTIFY TYPES ──────────────────────────────────────
// Augments FastifyRequest so request.user is fully typed
// everywhere in the codebase without casting.
import '@fastify/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user: JWTPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user:    JWTPayload;
  }
}

export interface JWTPayload {
  sub:        string          // Staff ID
  role:       StaffRole
  department: Department | null
  isHOD:      boolean
  canVerify:  boolean
  email:      string
  iat?:       number
  exp?:       number
}