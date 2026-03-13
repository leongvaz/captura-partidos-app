import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../lib/auth.js';
import { ROLES_LECTURA_ROSTER } from '../lib/rbac.js';

export async function jugadoresRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { equipoId?: string } }>(
    '/jugadores',
    { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] },
    async (request, reply) => {
      const equipoId = request.query.equipoId;
      if (!equipoId) return reply.status(400).send({ code: 'VALIDATION', message: 'equipoId es requerido' });
      const list = await prisma.jugador.findMany({
        where: { equipoId },
        orderBy: { numero: 'asc' },
      });
      return reply.send(
        list.map((j) => ({
          id: j.id,
          equipoId: j.equipoId,
          nombre: j.nombre,
          apellido: j.apellido,
          numero: j.numero,
          invitado: j.invitado,
          activo: j.activo,
          createdAt: j.createdAt.toISOString(),
          updatedAt: j.updatedAt.toISOString(),
        }))
      );
    }
  );

  app.get<{ Params: { id: string } }>('/jugadores/:id', { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] }, async (request, reply) => {
    const jugador = await prisma.jugador.findUnique({ where: { id: request.params.id } });
    if (!jugador) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Jugador no encontrado' });
    return reply.send({
      id: jugador.id,
      equipoId: jugador.equipoId,
      nombre: jugador.nombre,
      apellido: jugador.apellido,
      numero: jugador.numero,
      invitado: jugador.invitado,
      activo: jugador.activo,
      createdAt: jugador.createdAt.toISOString(),
      updatedAt: jugador.updatedAt.toISOString(),
    });
  });
}
