import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../lib/auth.js';
import { ROLES_LECTURA_ROSTER } from '../lib/rbac.js';

export async function equiposRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { ligaId?: string } }>(
    '/equipos',
    { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] },
    async (request, reply) => {
      const ligaId = request.query.ligaId || (request as { ligaId?: string }).ligaId;
      if (!ligaId) return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId es requerido' });
      const list = await prisma.equipo.findMany({
        where: { ligaId },
        orderBy: { nombre: 'asc' },
      });
      return reply.send(
        list.map((e) => ({
          id: e.id,
          ligaId: e.ligaId,
          nombre: e.nombre,
          categoria: e.categoria,
          activo: e.activo,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        }))
      );
    }
  );

  app.get<{ Params: { id: string } }>('/equipos/:id', { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] }, async (request, reply) => {
    const equipo = await prisma.equipo.findUnique({ where: { id: request.params.id } });
    if (!equipo) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Equipo no encontrado' });
    const ligaId = (request as { ligaId: string }).ligaId;
    if (equipo.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    return reply.send({
      id: equipo.id,
      ligaId: equipo.ligaId,
      nombre: equipo.nombre,
      categoria: equipo.categoria,
      activo: equipo.activo,
      createdAt: equipo.createdAt.toISOString(),
      updatedAt: equipo.updatedAt.toISOString(),
    });
  });
}
