import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole, ensureMembership, type AuthRequest } from '../lib/auth.js';
import { ROLES_LECTURA_ROSTER } from '../lib/rbac.js';

export async function equiposRoutes(app: FastifyInstance) {
  /** Equipo + jugadores activos (solo superadmin, cualquier liga) */
  app.get<{ Params: { equipoId: string } }>(
    '/admin/equipos/:equipoId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const req = request as AuthRequest;
      if (!req.isSuperAdmin) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: 'Solo superadmin' });
      }
      const { equipoId } = request.params;
      const equipo = await prisma.equipo.findUnique({
        where: { id: equipoId },
        include: {
          jugadores: {
            where: { activo: true },
            orderBy: { numero: 'asc' },
          },
        },
      });
      if (!equipo) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: 'Equipo no encontrado' });
      }
      return reply.send({
        equipo: {
          id: equipo.id,
          ligaId: equipo.ligaId,
          nombre: equipo.nombre,
          categoria: equipo.categoria,
          activo: equipo.activo,
          createdAt: equipo.createdAt.toISOString(),
          updatedAt: equipo.updatedAt.toISOString(),
        },
        jugadores: equipo.jugadores.map((j) => ({
          id: j.id,
          equipoId: j.equipoId,
          nombre: j.nombre,
          apellido: j.apellido,
          numero: j.numero,
          curp: j.curp,
          invitado: j.invitado,
          activo: j.activo,
          createdAt: j.createdAt.toISOString(),
          updatedAt: j.updatedAt.toISOString(),
        })),
      });
    }
  );

  function normalizarNombreEquipo(nombre: string): string {
    return (nombre || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

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

  // Registro simple de equipo por capitán (inscripción). Luego se extenderá a solicitudes/aprobación.
  app.post<{
    Body: { ligaId: string; nombre: string; rama: string; fuerza: string };
  }>(
    '/equipos/registro-capitan',
    { preHandler: [app.authenticate, ensureMembership, requireRole('capturista_roster')] },
    async (request, reply) => {
      const { ligaId, nombre, rama, fuerza } = request.body || {};
      if (!ligaId || !nombre || !rama || !fuerza) {
        return reply.status(400).send({
          code: 'VALIDATION',
          message: 'ligaId, nombre, rama y fuerza son requeridos',
        });
      }

      const liga = await prisma.liga.findUnique({ where: { id: ligaId } });
      if (!liga) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: 'Liga no encontrada' });
      }

      // Evitar nombres duplicados dentro de la misma combinación rama+fuerza
      const categoria = `${rama}:${fuerza}`;
      const equiposMismaCategoria = await prisma.equipo.findMany({
        where: { ligaId, categoria, activo: true },
        select: { id: true, nombre: true },
      });
      const nombreNorm = normalizarNombreEquipo(nombre);
      const existeDuplicado = equiposMismaCategoria.some((e) => normalizarNombreEquipo(e.nombre) === nombreNorm);
      if (existeDuplicado) {
        return reply.status(400).send({
          code: 'EQUIPO_DUPLICADO',
          message: 'Ya existe un equipo con ese nombre en esa rama y fuerza',
        });
      }

      const req = request as AuthRequest;

      const equipo = await prisma.equipo.create({
        data: {
          ligaId,
          duenoId: req.usuarioId,
          nombre,
          categoria,
        },
      });

      return reply.send({
        id: equipo.id,
        ligaId: equipo.ligaId,
        nombre: equipo.nombre,
        categoria: equipo.categoria,
        activo: equipo.activo,
        createdAt: equipo.createdAt.toISOString(),
        updatedAt: equipo.updatedAt.toISOString(),
      });
    }
  );

  // Equipos del capitán autenticado en la liga actual
  app.get(
    '/equipos/mis',
    { preHandler: [app.authenticate, ensureMembership, requireRole('capturista_roster')] },
    async (request, reply) => {
      const req = request as AuthRequest;
      const list = await prisma.equipo.findMany({
        where: { ligaId: req.ligaId, duenoId: req.usuarioId, activo: true },
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
