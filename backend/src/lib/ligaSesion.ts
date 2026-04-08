import type { FastifyReply } from 'fastify';
import type { AuthRequest } from './auth.js';

/** Sesión del organizador = una liga en el JWT; alinear peticiones con esa liga. */
export function ligaCoincideConSesion(
  req: AuthRequest,
  ligaId: string,
  reply: FastifyReply
): boolean {
  if (req.isSuperAdmin) return true;
  if (ligaId !== req.ligaId) {
    void reply.status(403).send({
      code: 'FORBIDDEN',
      message: 'La liga no coincide con tu sesión. Cierra sesión y entra de nuevo.',
    });
    return false;
  }
  return true;
}
