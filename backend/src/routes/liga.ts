import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole, ensureMembership } from '../lib/auth.js';
import { ROLES_LECTURA_ROSTER } from '../lib/rbac.js';

const ESTADOS_CERRADOS = ['finalizado', 'default_local', 'default_visitante'] as const;

function getMarcadorPartido(
  partido: { marcadorLocalFinal: number | null; marcadorVisitanteFinal: number | null; estado: string },
  eventos: { tipo: string; jugadorId: string }[],
  plantilla: { equipoId: string; jugadorId: string }[],
  localEquipoId: string,
  visitanteEquipoId: string
): { local: number; visitante: number } {
  if (partido.marcadorLocalFinal != null && partido.marcadorVisitanteFinal != null) {
    return { local: partido.marcadorLocalFinal, visitante: partido.marcadorVisitanteFinal };
  }
  const puntosPorJugador: Record<string, number> = {};
  for (const e of eventos) {
    if (!puntosPorJugador[e.jugadorId]) puntosPorJugador[e.jugadorId] = 0;
    if (e.tipo === 'punto_2') puntosPorJugador[e.jugadorId] += 2;
    else if (e.tipo === 'punto_3') puntosPorJugador[e.jugadorId] += 3;
    else if (e.tipo === 'tiro_libre_anotado') puntosPorJugador[e.jugadorId] += 1;
  }
  const local = plantilla
    .filter((p) => p.equipoId === localEquipoId)
    .reduce((s, p) => s + (puntosPorJugador[p.jugadorId] || 0), 0);
  const visitante = plantilla
    .filter((p) => p.equipoId === visitanteEquipoId)
    .reduce((s, p) => s + (puntosPorJugador[p.jugadorId] || 0), 0);
  if (partido.estado === 'default_local') return { local: 0, visitante: 20 };
  if (partido.estado === 'default_visitante') return { local: 20, visitante: 0 };
  return { local, visitante };
}

export async function ligaRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { ligaId: string; fechaDesde?: string; fechaHasta?: string; conIncidencia?: string };
  }>(
    '/liga/panel',
    { preHandler: [app.authenticate, ensureMembership, requireRole(...ROLES_LECTURA_ROSTER)] },
    async (request, reply) => {
      const { ligaId, fechaDesde, fechaHasta, conIncidencia } = request.query;
      const req = request as { ligaId: string };
      if (!ligaId || req.ligaId !== ligaId) {
        return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId es requerido' });
      }

      const where: { ligaId: string; estado: { in: readonly string[] }; fecha?: object; incidencias?: object } = {
        ligaId,
        estado: { in: [...ESTADOS_CERRADOS] },
      };
      if (fechaDesde || fechaHasta) {
        where.fecha = {};
        if (fechaDesde) (where.fecha as Record<string, string>).gte = fechaDesde;
        if (fechaHasta) (where.fecha as Record<string, string>).lte = fechaHasta;
      }
      if (conIncidencia === 'true') {
        where.incidencias = { some: {} };
      }

      const partidos = await prisma.partido.findMany({
        where,
        include: {
          localEquipo: true,
          visitanteEquipo: true,
          cancha: true,
          eventos: true,
          plantilla: true,
          incidencias: true,
        },
        orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
      });

      const list = partidos.map((p) => {
        const { local, visitante } = getMarcadorPartido(
          p,
          p.eventos,
          p.plantilla,
          p.localEquipoId,
          p.visitanteEquipoId
        );
        return {
          id: p.id,
          fecha: p.fecha,
          horaInicio: p.horaInicio,
          estado: p.estado,
          folio: p.folio,
          localEquipo: { id: p.localEquipo.id, nombre: p.localEquipo.nombre },
          visitanteEquipo: { id: p.visitanteEquipo.id, nombre: p.visitanteEquipo.nombre },
          cancha: p.cancha.nombre,
          resultado: { local, visitante },
        };
      });

      return reply.send(list);
    }
  );

  app.get<{ Querystring: { ligaId: string } }>(
    '/liga/equipos-estadisticas',
    { preHandler: [app.authenticate, ensureMembership, requireRole(...ROLES_LECTURA_ROSTER)] },
    async (request, reply) => {
      const { ligaId } = request.query;
      const req = request as { ligaId: string };
      if (!ligaId || req.ligaId !== ligaId) {
        return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId es requerido' });
      }

      const equipos = await prisma.equipo.findMany({
        where: { ligaId, activo: true },
        orderBy: { nombre: 'asc' },
      });

      const partidos = await prisma.partido.findMany({
        where: { ligaId, estado: { in: [...ESTADOS_CERRADOS] } },
        include: {
          eventos: true,
          plantilla: true,
        },
      });

      const stats = equipos.map((eq) => {
        let PJ = 0;
        let PG = 0;
        let PP = 0;
        let PF = 0;
        let PC = 0;

        for (const p of partidos) {
          const esLocal = p.localEquipoId === eq.id;
          const esVisitante = p.visitanteEquipoId === eq.id;
          if (!esLocal && !esVisitante) continue;

          const { local, visitante } = getMarcadorPartido(
            p,
            p.eventos,
            p.plantilla,
            p.localEquipoId,
            p.visitanteEquipoId
          );

          PJ += 1;
          PF += esLocal ? local : visitante;
          PC += esLocal ? visitante : local;
          const gano = (esLocal && local > visitante) || (esVisitante && visitante > local);
          if (gano) PG += 1;
          else PP += 1;
        }

        return {
          equipoId: eq.id,
          nombre: eq.nombre,
          PJ,
          PG,
          PP,
          PF,
          PC,
          DIF: PF - PC,
        };
      });

      return reply.send(stats);
    }
  );
}
