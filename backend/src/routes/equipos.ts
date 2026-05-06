import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole, ensureMembership, type AuthRequest } from '../lib/auth.js';
import { ROLES_LECTURA_ROSTER } from '../lib/rbac.js';
import { resolveTemporadaIdForLiga } from '../lib/temporada.js';

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
          temporadaId: equipo.temporadaId,
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

  app.get<{ Querystring: { ligaId?: string; temporadaId?: string } }>(
    '/equipos',
    { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] },
    async (request, reply) => {
      const ligaId = request.query.ligaId || (request as AuthRequest).ligaId;
      if (!ligaId) return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId es requerido' });
      const tid = await resolveTemporadaIdForLiga(ligaId, request.query.temporadaId, reply);
      if (!tid) return;
      const list = await prisma.equipo.findMany({
        where: { ligaId, temporadaId: tid },
        orderBy: { nombre: 'asc' },
      });
      return reply.send(
        list.map((e) => ({
          id: e.id,
          ligaId: e.ligaId,
          temporadaId: e.temporadaId,
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
    Body: { ligaId: string; nombre: string; rama: string; fuerza: string; temporadaId?: string };
  }>(
    '/equipos/registro-capitan',
    { preHandler: [app.authenticate, ensureMembership, requireRole('capturista_roster')] },
    async (request, reply) => {
      const { ligaId, nombre, rama, fuerza, temporadaId: temporadaIdBody } = request.body || {};
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

      const temporadaId = await resolveTemporadaIdForLiga(ligaId, temporadaIdBody, reply);
      if (!temporadaId) return;

      // Evitar nombres duplicados dentro de la misma combinación rama+fuerza
      const categoria = `${rama}:${fuerza}`;
      const equiposMismaCategoria = await prisma.equipo.findMany({
        where: { ligaId, temporadaId, categoria, activo: true },
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
          temporadaId,
          duenoId: req.usuarioId,
          nombre,
          categoria,
        },
      });

      return reply.send({
        id: equipo.id,
        ligaId: equipo.ligaId,
        temporadaId: equipo.temporadaId,
        nombre: equipo.nombre,
        categoria: equipo.categoria,
        activo: equipo.activo,
        createdAt: equipo.createdAt.toISOString(),
        updatedAt: equipo.updatedAt.toISOString(),
      });
    }
  );

  // Equipos del capitán autenticado en la liga actual
  app.get<{ Querystring: { temporadaId?: string } }>(
    '/equipos/mis',
    { preHandler: [app.authenticate, ensureMembership, requireRole('capturista_roster')] },
    async (request, reply) => {
      const req = request as AuthRequest;
      const tid = await resolveTemporadaIdForLiga(req.ligaId, request.query.temporadaId, reply);
      if (!tid) return;
      const list = await prisma.equipo.findMany({
        where: { ligaId: req.ligaId, temporadaId: tid, duenoId: req.usuarioId, activo: true },
        orderBy: { nombre: 'asc' },
      });
      return reply.send(
        list.map((e) => ({
          id: e.id,
          ligaId: e.ligaId,
          temporadaId: e.temporadaId,
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
    const ligaId = (request as AuthRequest).ligaId;
    if (equipo.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    return reply.send({
      id: equipo.id,
      ligaId: equipo.ligaId,
      temporadaId: equipo.temporadaId,
      nombre: equipo.nombre,
      categoria: equipo.categoria,
      activo: equipo.activo,
      createdAt: equipo.createdAt.toISOString(),
      updatedAt: equipo.updatedAt.toISOString(),
    });
  });

  app.put<{ Params: { id: string }; Body: { nombre?: string } }>(
    '/equipos/:id',
    { preHandler: [app.authenticate, ensureMembership, requireRole('admin_liga')] },
    async (request, reply) => {
      const req = request as AuthRequest;
      const { id } = request.params;
      const { nombre } = request.body || {};
      const nombreTrim = (nombre || '').trim();
      if (!nombreTrim) {
        return reply.status(400).send({ code: 'VALIDATION', message: 'nombre es requerido' });
      }
      const equipo = await prisma.equipo.findUnique({ where: { id } });
      if (!equipo || equipo.ligaId !== req.ligaId) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
      }
      const updated = await prisma.equipo.update({
        where: { id },
        data: { nombre: nombreTrim },
      });
      return reply.send({
        id: updated.id,
        ligaId: updated.ligaId,
        temporadaId: updated.temporadaId,
        nombre: updated.nombre,
        categoria: updated.categoria,
        activo: updated.activo,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/equipos/:id',
    { preHandler: [app.authenticate, ensureMembership, requireRole('admin_liga')] },
    async (request, reply) => {
      const req = request as AuthRequest;
      const { id } = request.params;
      const equipo = await prisma.equipo.findUnique({ where: { id } });
      if (!equipo || equipo.ligaId !== req.ligaId) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
      }
      const updated = await prisma.equipo.update({
        where: { id },
        data: { activo: false },
      });
      return reply.send({
        id: updated.id,
        ligaId: updated.ligaId,
        temporadaId: updated.temporadaId,
        nombre: updated.nombre,
        categoria: updated.categoria,
        activo: updated.activo,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    }
  );
}
