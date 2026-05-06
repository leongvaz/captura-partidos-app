import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../lib/auth.js';
import { ROLES_LECTURA_ROSTER } from '../lib/rbac.js';
import { ligaJsonWithTemporadas } from '../lib/temporada.js';

export async function ligasRoutes(app: FastifyInstance) {
  app.get('/ligas', { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] }, async (request, reply) => {
    const list = await prisma.liga.findMany({ orderBy: { nombre: 'asc' } });
    const out = await Promise.all(list.map((l) => ligaJsonWithTemporadas(l)));
    return reply.send(out);
  });

  app.get<{ Params: { id: string } }>('/ligas/:id', { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] }, async (request, reply) => {
    const liga = await prisma.liga.findUnique({ where: { id: request.params.id } });
    if (!liga) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Liga no encontrada' });
    return reply.send(await ligaJsonWithTemporadas(liga));
  });
}
