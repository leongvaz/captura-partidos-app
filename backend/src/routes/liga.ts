import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole, ensureMembership, type AuthRequest } from '../lib/auth.js';
import { ROLES_LECTURA_ROSTER } from '../lib/rbac.js';

const ESTADOS_CERRADOS = ['finalizado', 'default_local', 'default_visitante'] as const;

type ReglasLigaConfig = {
  duracionCuartoMin: number;
  partidosClasificacion: number;
  tienePlayoffs: boolean;
  temporadaInicio?: string | null;
  ramas: {
    varonil: boolean;
    femenil: boolean;
    mixta: boolean;
    veteranos: boolean;
    infantil: boolean;
  };
  fuerzas?: string[]; // legado: lista global
  fuerzasPorRama: {
    varonil: string[];
    femenil: string[];
    mixta: string[];
    veteranos: string[];
    infantil: string[];
  };
  maxJugadoresPorEquipo: number;
  maxInvitadosPorPartido: number;
  permitirInvitadosSinCurp: boolean;
  periodoInscripcion?: {
    inicio?: string | null;
    fin?: string | null;
  };
};

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
  // Info pública de liga (nombre, temporada) por ID, sin autenticación
  app.get<{ Querystring: { ligaId: string } }>('/liga/public-info', async (request, reply) => {
    const { ligaId } = request.query;
    if (!ligaId) {
      return reply
        .status(400)
        .send({ code: 'VALIDATION', message: 'ligaId es requerido' });
    }

    const liga = await prisma.liga.findUnique({ where: { id: ligaId } });
    if (!liga) {
      return reply
        .status(404)
        .send({ code: 'NOT_FOUND', message: 'Liga no encontrada' });
    }

    return reply.send({
      id: liga.id,
      nombre: liga.nombre,
      temporada: liga.temporada,
      categorias: JSON.parse(liga.categorias || '[]'),
    });
  });

  // Ligas para superadmin (gestión global)
  app.get('/admin/ligas', { preHandler: [app.authenticate] }, async (request, reply) => {
    const req = request as AuthRequest;
    if (!req.isSuperAdmin) {
      return reply
        .status(403)
        .send({ code: 'FORBIDDEN', message: 'Solo superadmin puede listar ligas' });
    }

    const ligas = await prisma.liga.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const list = ligas.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      temporada: l.temporada,
      categorias: JSON.parse(l.categorias || '[]'),
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    }));

    return reply.send(list);
  });

  app.post<{
    Body: { nombre: string; temporada: string; categorias?: string[] };
  }>('/admin/ligas', { preHandler: [app.authenticate] }, async (request, reply) => {
    const req = request as AuthRequest;
    if (!req.isSuperAdmin) {
      return reply
        .status(403)
        .send({ code: 'FORBIDDEN', message: 'Solo superadmin puede crear ligas' });
    }

    const { nombre, temporada, categorias } = request.body || {};
    if (!nombre || !temporada) {
      return reply.status(400).send({
        code: 'VALIDATION',
        message: 'nombre y temporada son requeridos',
      });
    }

    const cats = categorias && categorias.length > 0
      ? categorias
      : ['primera', 'segunda', 'veteranos', 'femenil', 'varonil'];

    const liga = await prisma.liga.create({
      data: {
        nombre,
        temporada,
        categorias: JSON.stringify(cats),
      },
    });

    return reply.send({
      id: liga.id,
      nombre: liga.nombre,
      temporada: liga.temporada,
      categorias: cats,
      createdAt: liga.createdAt.toISOString(),
      updatedAt: liga.updatedAt.toISOString(),
    });
  });

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

  // Configuración de reglas de liga (admin_liga y capitanes pueden leer)
  app.get<{ Querystring: { ligaId: string } }>(
    '/liga/reglas',
    { preHandler: [app.authenticate, ensureMembership, requireRole('admin_liga', 'capturista_roster')] },
    async (request, reply) => {
      const { ligaId } = request.query;
      const req = request as { ligaId: string };
      if (!ligaId || req.ligaId !== ligaId) {
        return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId es requerido' });
      }

      const liga = await prisma.liga.findUnique({ where: { id: ligaId } });
      if (!liga) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: 'Liga no encontrada' });
      }

      let config: ReglasLigaConfig;
      try {
        config = JSON.parse(liga.reglasConfig || '{}') as ReglasLigaConfig;
      } catch {
        config = {} as ReglasLigaConfig;
      }

      const defaultFuerzas = config.fuerzas ?? ['primera', 'intermedia', 'segunda'];
      const fuerzasPorRama = config.fuerzasPorRama ?? {
        varonil: defaultFuerzas,
        femenil: defaultFuerzas,
        mixta: defaultFuerzas,
        veteranos: defaultFuerzas,
        infantil: defaultFuerzas,
      };

      // Defaults razonables si aún no hay configuración guardada
      const withDefaults: ReglasLigaConfig = {
        duracionCuartoMin: config.duracionCuartoMin ?? 10,
        partidosClasificacion: config.partidosClasificacion ?? 20,
        tienePlayoffs: config.tienePlayoffs ?? true,
        temporadaInicio: config.temporadaInicio ?? null,
        ramas: {
          varonil: config.ramas?.varonil ?? true,
          femenil: config.ramas?.femenil ?? true,
          mixta: config.ramas?.mixta ?? false,
          veteranos: config.ramas?.veteranos ?? false,
          infantil: config.ramas?.infantil ?? false,
        },
        fuerzas: defaultFuerzas,
        fuerzasPorRama,
        maxJugadoresPorEquipo: config.maxJugadoresPorEquipo ?? 15,
        maxInvitadosPorPartido: config.maxInvitadosPorPartido ?? 3,
        permitirInvitadosSinCurp: config.permitirInvitadosSinCurp ?? true,
        periodoInscripcion: config.periodoInscripcion ?? { inicio: null, fin: null },
      };

      return reply.send(withDefaults);
    }
  );

  app.put<{
    Body: { ligaId: string; config: ReglasLigaConfig };
  }>(
    '/liga/reglas',
    { preHandler: [app.authenticate, ensureMembership, requireRole('admin_liga')] },
    async (request, reply) => {
      const { ligaId, config } = request.body || {};
      const req = request as { ligaId: string };
      if (!ligaId || req.ligaId !== ligaId) {
        return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId es requerido' });
      }

      const liga = await prisma.liga.findUnique({ where: { id: ligaId } });
      if (!liga) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: 'Liga no encontrada' });
      }

      await prisma.liga.update({
        where: { id: ligaId },
        data: { reglasConfig: JSON.stringify(config) },
      });

      return reply.status(204).send();
    }
  );
}
