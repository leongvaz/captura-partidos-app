import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Rol } from '../lib/rbac.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    usuarioId?: string;
    ligaId?: string;
    isSuperAdmin?: boolean;
    roles?: Rol[];
  }
}
