import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../lib/auth.js';
import { ROLES_LECTURA_ROSTER } from '../lib/rbac.js';

export async function canchasRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { ligaId?: string } }>(
    '/canchas',
    { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] },
    async (request, reply) => {
      const ligaId = request.query.ligaId || (request as { ligaId?: string }).ligaId;
      if (!ligaId) return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId es requerido' });
      const list = await prisma.cancha.findMany({
        where: { ligaId },
        orderBy: { nombre: 'asc' },
      });
      return reply.send(
        list.map((c) => ({
          id: c.id,
          ligaId: c.ligaId,
          nombre: c.nombre,
          activo: c.activo,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }))
      );
    }
  );

  app.get<{ Params: { id: string } }>('/canchas/:id', { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] }, async (request, reply) => {
    const cancha = await prisma.cancha.findUnique({ where: { id: request.params.id } });
    if (!cancha) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Cancha no encontrada' });
    return reply.send({
      id: cancha.id,
      ligaId: cancha.ligaId,
      nombre: cancha.nombre,
      activo: cancha.activo,
      createdAt: cancha.createdAt.toISOString(),
      updatedAt: cancha.updatedAt.toISOString(),
    });
  });
}
