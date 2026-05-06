import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import type { AuthRequest } from '../lib/auth.js';

/**
 * Identidad deportiva e historial agregado por CURP (superadmin).
 * Los detalles play-by-play siguen en Evento; ResumenJugadorPartido acelera consultas.
 */
export async function personasRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { curp: string } }>(
    '/admin/personas/historial',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const req = request as AuthRequest;
      if (!req.isSuperAdmin) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: 'Solo superadmin' });
      }
      const curpRaw = request.query?.curp;
      if (!curpRaw?.trim()) {
        return reply.status(400).send({ code: 'VALIDATION', message: 'curp es requerido' });
      }
      const curp = curpRaw.trim().toUpperCase();

      const persona = await prisma.persona.findUnique({
        where: { curp },
        include: {
          jugadores: {
            include: { equipo: { include: { liga: true, temporada: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!persona) {
        return reply.send({
          persona: null,
          inscripciones: [],
          partidos: [],
          totalesGlobales: {
            partidosConResumen: 0,
            puntosTotales: 0,
            faltasTotales: 0,
          },
        });
      }

      const resumenes = await prisma.resumenJugadorPartido.findMany({
        where: { personaId: persona.id },
        include: {
          partido: {
            include: {
              liga: true,
              temporada: true,
              localEquipo: true,
              visitanteEquipo: true,
            },
          },
          equipo: true,
        },
        orderBy: { partido: { fecha: 'desc' } },
      });

      const inscripciones = persona.jugadores.map((j) => ({
        jugadorId: j.id,
        ligaId: j.equipo.liga.id,
        ligaNombre: j.equipo.liga.nombre,
        temporadaId: j.equipo.temporadaId,
        temporadaEtiqueta: j.equipo.temporada.etiqueta,
        deporte: j.equipo.liga.deporte,
        equipoId: j.equipo.id,
        equipoNombre: j.equipo.nombre,
        categoria: j.equipo.categoria,
        numero: j.numero,
        activo: j.activo,
        invitado: j.invitado,
        inscripcionDesde: j.createdAt.toISOString(),
      }));

      const partidos = resumenes.map((r) => {
        const p = r.partido;
        const miEquipoId = r.equipoId;
        const rival =
          p.localEquipoId === miEquipoId ? p.visitanteEquipo.nombre : p.localEquipo.nombre;
        const localEsEquipo = p.localEquipoId === miEquipoId;
        return {
          partidoId: p.id,
          fecha: p.fecha,
          horaInicio: p.horaInicio,
          folio: p.folio,
          estado: p.estado,
          categoriaPartido: p.categoria,
          liga: {
            id: p.liga.id,
            nombre: p.liga.nombre,
            deporte: p.liga.deporte,
          },
          temporada: {
            id: p.temporada.id,
            etiqueta: p.temporada.etiqueta,
          },
          equipo: { id: r.equipo.id, nombre: r.equipo.nombre, categoria: r.equipo.categoria },
          rivalNombre: rival,
          localEsEquipo,
          resumen: {
            puntos: r.puntos,
            canastasDe2: r.canastasDe2,
            canastasDe3: r.canastasDe3,
            tirosLibresAnotados: r.tirosLibresAnotados,
            faltas: r.faltas,
            asistencias: r.asistencias,
            minutosJugados: r.minutosJugados,
          },
        };
      });

      const totalesGlobales = {
        partidosConResumen: resumenes.length,
        puntosTotales: resumenes.reduce((s, r) => s + r.puntos, 0),
        faltasTotales: resumenes.reduce((s, r) => s + r.faltas, 0),
      };

      return reply.send({
        persona: {
          id: persona.id,
          curp: persona.curp,
          nombreDisplay: persona.nombreDisplay,
          apellidoDisplay: persona.apellidoDisplay,
          sexo: persona.sexo,
          fechaNacimiento: persona.fechaNacimiento,
        },
        inscripciones,
        partidos,
        totalesGlobales,
      });
    }
  );

  /** Registro de solicitud de eliminación de datos personales (LGPD/GDPR). Procesamiento manual. */
  app.post<{ Body: { curp: string } }>(
    '/personas/solicitud-eliminacion',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const req = request as AuthRequest;
      const curpRaw = request.body?.curp;
      if (!curpRaw?.trim()) {
        return reply.status(400).send({ code: 'VALIDATION', message: 'curp es requerido' });
      }
      const curp = curpRaw.trim().toUpperCase();
      if (!req.isSuperAdmin) {
        const u = await prisma.usuario.findUnique({ where: { id: req.usuarioId } });
        if (!u?.curp || u.curp !== curp) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Solo puedes solicitar eliminación para tu propia CURP',
          });
        }
      }
      const persona = await prisma.persona.findUnique({ where: { curp } });
      if (!persona) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: 'CURP no registrada en el sistema' });
      }
      await prisma.persona.update({
        where: { id: persona.id },
        data: { solicitudEliminacionAt: new Date() },
      });
      return reply.send({
        ok: true,
        message:
          'Solicitud registrada. El equipo administrativo procesará la eliminación según política de datos.',
      });
    }
  );
}
