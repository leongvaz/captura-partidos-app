import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole, ensureMembership, type AuthRequest } from '../lib/auth.js';
import { ROLES_LECTURA_ROSTER } from '../lib/rbac.js';

export async function jugadoresRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { equipoId?: string } }>(
    '/jugadores',
    { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] },
    async (request, reply) => {
      const equipoId = request.query.equipoId;
      if (!equipoId) return reply.status(400).send({ code: 'VALIDATION', message: 'equipoId es requerido' });
      const list = await prisma.jugador.findMany({
        where: { equipoId, activo: true },
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

  app.get<{ Params: { id: string } }>(
    '/jugadores/:id',
    { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] },
    async (request, reply) => {
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
    }
  );

  // Alta de jugador por capitán, solo en sus propios equipos
  app.post<{
    Body: { equipoId: string; nombre: string; apellidoPaterno: string; apellidoMaterno?: string; numero: number };
  }>(
    '/jugadores',
    { preHandler: [app.authenticate, ensureMembership, requireRole('capturista_roster')] },
    async (request, reply) => {
      const req = request as AuthRequest;
      const { equipoId, nombre, apellidoPaterno, apellidoMaterno, numero } = request.body || {};
      if (!equipoId || !nombre || !apellidoPaterno || numero === undefined || numero === null) {
        return reply.status(400).send({
          code: 'VALIDATION',
          message: 'equipoId, nombre, apellidoPaterno y numero son requeridos',
        });
      }

      const equipo = await prisma.equipo.findUnique({ where: { id: equipoId } });
      if (!equipo || equipo.ligaId !== req.ligaId || equipo.duenoId !== req.usuarioId) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'No puedes registrar jugadores en este equipo',
        });
      }

      // Respetar límite de jugadores por equipo si la liga tiene reglas configuradas
      const liga = await prisma.liga.findUnique({ where: { id: equipo.ligaId } });
      let maxJugadores = 15;
      if (liga) {
        try {
          const cfg = JSON.parse(liga.reglasConfig || '{}') as { maxJugadoresPorEquipo?: number };
          if (cfg.maxJugadoresPorEquipo && cfg.maxJugadoresPorEquipo > 0) {
            maxJugadores = cfg.maxJugadoresPorEquipo;
          }
        } catch {
          // ignorar error de parseo
        }
      }

      const count = await prisma.jugador.count({ where: { equipoId, activo: true } });
      if (count >= maxJugadores) {
        return reply.status(400).send({
          code: 'EQUIPO_LLENO',
          message: `Este equipo ya alcanzó el máximo de ${maxJugadores} jugadores activos.`,
        });
      }

      if (numero < 0 || numero > 999) {
        return reply.status(400).send({
          code: 'NUMERO_FUERA_DE_RANGO',
          message: 'El número de jugador debe estar entre 0 y 999.',
        });
      }

      // Evitar números repetidos dentro del mismo equipo
      const numeroExistente = await prisma.jugador.findFirst({
        where: { equipoId, numero, activo: true },
      });
      if (numeroExistente) {
        return reply.status(400).send({
          code: 'NUMERO_DUPLICADO',
          message: 'Ese número ya está asignado a otro jugador de este equipo.',
        });
      }

      const apellido = apellidoMaterno
        ? `${apellidoPaterno} ${apellidoMaterno}`.trim()
        : apellidoPaterno;

      const jugador = await prisma.jugador.create({
        data: {
          equipoId,
          nombre,
          apellido,
          numero,
        },
      });

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
    }
  );

  // Edición de jugador por capitán (solo en sus equipos)
  app.put<{
    Params: { id: string };
    Body: { nombre: string; apellidoPaterno: string; apellidoMaterno?: string; numero: number };
  }>(
    '/jugadores/:id',
    { preHandler: [app.authenticate, ensureMembership, requireRole('capturista_roster')] },
    async (request, reply) => {
      const req = request as AuthRequest;
      const { id } = request.params;
      const { nombre, apellidoPaterno, apellidoMaterno, numero } = request.body || {};

      if (!nombre || !apellidoPaterno || numero === undefined || numero === null) {
        return reply.status(400).send({
          code: 'VALIDATION',
          message: 'nombre, apellidoPaterno y numero son requeridos',
        });
      }

      const jugador = await prisma.jugador.findUnique({ where: { id } , include: { equipo: true }});
      if (!jugador || !jugador.equipo || jugador.equipo.ligaId !== req.ligaId || jugador.equipo.duenoId !== req.usuarioId) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'No puedes editar jugadores de este equipo',
        });
      }

      if (numero < 0 || numero > 999) {
        return reply.status(400).send({
          code: 'NUMERO_FUERA_DE_RANGO',
          message: 'El número de jugador debe estar entre 0 y 999.',
        });
      }

      const numeroExistente = await prisma.jugador.findFirst({
        where: { equipoId: jugador.equipoId, numero, activo: true, NOT: { id } },
      });
      if (numeroExistente) {
        return reply.status(400).send({
          code: 'NUMERO_DUPLICADO',
          message: 'Ese número ya está asignado a otro jugador de este equipo.',
        });
      }

      const apellido = apellidoMaterno
        ? `${apellidoPaterno} ${apellidoMaterno}`.trim()
        : apellidoPaterno;

      const actualizado = await prisma.jugador.update({
        where: { id },
        data: {
          nombre,
          apellido,
          numero,
        },
      });

      return reply.send({
        id: actualizado.id,
        equipoId: actualizado.equipoId,
        nombre: actualizado.nombre,
        apellido: actualizado.apellido,
        numero: actualizado.numero,
        invitado: actualizado.invitado,
        activo: actualizado.activo,
        createdAt: actualizado.createdAt.toISOString(),
        updatedAt: actualizado.updatedAt.toISOString(),
      });
    }
  );

  // Eliminación (baja lógica) de jugador por capitán
  app.delete<{ Params: { id: string } }>(
    '/jugadores/:id',
    { preHandler: [app.authenticate, ensureMembership, requireRole('capturista_roster')] },
    async (request, reply) => {
      const req = request as AuthRequest;
      const { id } = request.params;

      const jugador = await prisma.jugador.findUnique({ where: { id }, include: { equipo: true } });
      if (!jugador || !jugador.equipo || jugador.equipo.ligaId !== req.ligaId || jugador.equipo.duenoId !== req.usuarioId) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'No puedes eliminar jugadores de este equipo',
        });
      }

      const actualizado = await prisma.jugador.update({
        where: { id },
        data: { activo: false },
      });

      return reply.send({
        id: actualizado.id,
        equipoId: actualizado.equipoId,
        nombre: actualizado.nombre,
        apellido: actualizado.apellido,
        numero: actualizado.numero,
        invitado: actualizado.invitado,
        activo: actualizado.activo,
        createdAt: actualizado.createdAt.toISOString(),
        updatedAt: actualizado.updatedAt.toISOString(),
      });
    }
  );
}
