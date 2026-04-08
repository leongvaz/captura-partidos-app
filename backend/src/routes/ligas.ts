import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../lib/auth.js';
import { ROLES_LECTURA_ROSTER } from '../lib/rbac.js';

export async function ligasRoutes(app: FastifyInstance) {
  app.get('/ligas', { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] }, async (request, reply) => {
    const list = await prisma.liga.findMany({ orderBy: { nombre: 'asc' } });
    return reply.send(
      list.map((l) => ({
        id: l.id,
        nombre: l.nombre,
        temporada: l.temporada,
        deporte: l.deporte,
        categorias: JSON.parse(l.categorias || '[]'),
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      }))
    );
  });

  app.get<{ Params: { id: string } }>('/ligas/:id', { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] }, async (request, reply) => {
    const liga = await prisma.liga.findUnique({ where: { id: request.params.id } });
    if (!liga) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Liga no encontrada' });
    return reply.send({
      id: liga.id,
      nombre: liga.nombre,
      temporada: liga.temporada,
      deporte: liga.deporte,
      categorias: JSON.parse(liga.categorias || '[]'),
      createdAt: liga.createdAt.toISOString(),
      updatedAt: liga.updatedAt.toISOString(),
    });
  });
}
