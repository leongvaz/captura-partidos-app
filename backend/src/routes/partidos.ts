import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../lib/auth.js';
import type { AuthRequest } from '../lib/auth.js';
import { ROLES_LECTURA_ROSTER, ROLES_PARTIDO } from '../lib/rbac.js';
import type { Rol } from '../lib/rbac.js';
import { deriveBackendMatchState, validateIncomingBackendEvents } from '../lib/matchDomain.js';
import { syncResumenesPartido } from '../lib/resumenJugadorPartido.js';
import { etiquetaCancha } from '../lib/canchaEtiqueta.js';
import { sedeNombrePorIdMap } from '../lib/canchaSedeBatch.js';
import { defaultTemporadaActivaId, resolveTemporadaIdForLiga } from '../lib/temporada.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const preRead = [requireRole(...ROLES_LECTURA_ROSTER)];
const preWrite = [requireRole(...ROLES_PARTIDO)];

const DEBUG_LOG_PATHS = [
  path.resolve(process.cwd(), 'debug-19c21e.log'),
  path.resolve(process.cwd(), '..', 'debug-19c21e.log'),
];
async function debugLog(payload: Record<string, unknown>) {
  const line = JSON.stringify(payload) + '\n';
  for (const p of DEBUG_LOG_PATHS) {
    try {
      await fs.appendFile(p, line, 'utf8');
    } catch {
      // ignore
    }
  }
}

/** Para cerrar partido: carga la liga del partido y los roles del usuario desde BD (evita 403 por token con roles vacíos) */
async function ensurePartidoLigaAndRoles(request: FastifyRequest, reply: FastifyReply) {
  const req = request as AuthRequest;
  if (req.isSuperAdmin) return;
  const partidoId = (request.params as { id: string }).id;
  if (!partidoId) return;
  const partido = await prisma.partido.findUnique({ where: { id: partidoId }, select: { ligaId: true } });
  if (!partido) {
    await reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    return;
  }
  const membresia = await prisma.membresiaLiga.findFirst({
    where: { ligaId: partido.ligaId, usuarioId: req.usuarioId, activo: true },
  });
  if (!membresia) {
    await reply.status(403).send({ code: 'FORBIDDEN', message: 'No tienes membresía en esta liga' });
    return;
  }
  req.ligaId = partido.ligaId;
  req.roles = [membresia.rol as Rol];
}

function partidoToJson(p: {
  id: string;
  ligaId: string;
  temporadaId: string;
  localEquipoId: string;
  visitanteEquipoId: string;
  canchaId: string;
  categoria: string;
  fecha: string;
  horaInicio: string;
  estado: string;
  folio: string | null;
  anotadorId: string;
  marcadorLocalFinal?: number | null;
  marcadorVisitanteFinal?: number | null;
  fotoMarcadorUrl: string | null;
  fotosOpcionales: string | null;
  cerradoAt: Date | null;
  localVersion: number;
  serverVersion: number;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    ligaId: p.ligaId,
    temporadaId: p.temporadaId,
    localEquipoId: p.localEquipoId,
    visitanteEquipoId: p.visitanteEquipoId,
    canchaId: p.canchaId,
    categoria: p.categoria,
    fecha: p.fecha,
    horaInicio: p.horaInicio,
    estado: p.estado,
    folio: p.folio,
    anotadorId: p.anotadorId,
    marcadorLocalFinal: p.marcadorLocalFinal ?? null,
    marcadorVisitanteFinal: p.marcadorVisitanteFinal ?? null,
    fotoMarcadorUrl: p.fotoMarcadorUrl,
    fotosOpcionales: p.fotosOpcionales ? JSON.parse(p.fotosOpcionales) : [],
    cerradoAt: p.cerradoAt?.toISOString() ?? null,
    localVersion: p.localVersion,
    serverVersion: p.serverVersion,
    lastSyncedAt: p.lastSyncedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function generateFolio(ligaId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.partido.count({
    where: { ligaId, folio: { not: null } },
  });
  const seq = String(count + 1).padStart(5, '0');
  return `CPT-${year}-${seq}`;
}

/** Solo el anotador del partido o admin_liga/superadmin pueden editar el partido */
function canEditPartido(partido: { anotadorId: string }, req: { usuarioId: string; isSuperAdmin?: boolean; roles?: string[] }) {
  if (req.isSuperAdmin || (req.roles && req.roles.includes('admin_liga'))) return true;
  return partido.anotadorId === req.usuarioId;
}

function getMultipartFieldValue(field: unknown): string | undefined {
  if (typeof field === 'string') return field;
  if (field && typeof field === 'object' && 'value' in field) {
    const value = (field as { value?: unknown }).value;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

function firstFinishReasonMessage(reason: string | undefined): string {
  switch (reason) {
    case 'CLOCK_NOT_EXPIRED':
      return 'No se puede cerrar el partido porque el reloj del periodo actual no ha terminado.';
    case 'TIED_SCORE_REQUIRES_OVERTIME':
      return 'No se puede cerrar el partido con empate. Registra tiempo extra hasta que haya ganador.';
    case 'CLOSING_PHOTO_REQUIRED':
      return 'No se puede cerrar el partido sin la foto obligatoria del marcador.';
    case 'MATCH_ALREADY_FINISHED':
      return 'Partido ya cerrado.';
    case 'REGULATION_NOT_COMPLETED':
      return 'No se puede cerrar el partido antes de terminar el periodo reglamentario u overtime correspondiente.';
    default:
      return 'No se puede cerrar el partido por reglas de dominio.';
  }
}

function normalizarTextoBasico(valor: string): string {
  return (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

type JugadorRapidoInput = {
  numero: number;
  nombre: string;
  apellido: string;
};

async function ensureEquipoRapido(params: {
  ligaId: string;
  temporadaId: string;
  categoria: string;
  nombre: string;
  usuarioId: string;
}) {
  const candidatos = await prisma.equipo.findMany({
    where: {
      ligaId: params.ligaId,
      temporadaId: params.temporadaId,
      categoria: params.categoria,
      activo: true,
    },
  });
  const existente = candidatos.find(
    (equipo) => normalizarTextoBasico(equipo.nombre) === normalizarTextoBasico(params.nombre)
  );
  if (existente) return existente;

  return prisma.equipo.create({
    data: {
      id: randomUUID(),
      ligaId: params.ligaId,
      temporadaId: params.temporadaId,
      nombre: params.nombre.trim(),
      categoria: params.categoria,
      duenoId: params.usuarioId,
    },
  });
}

async function ensureCanchaRapida(params: { ligaId: string; nombre: string }) {
  const candidatos = await prisma.cancha.findMany({
    where: {
      ligaId: params.ligaId,
      activo: true,
    },
  });
  const existente = candidatos.find(
    (cancha) => normalizarTextoBasico(cancha.nombre) === normalizarTextoBasico(params.nombre)
  );
  if (existente) return existente;

  return prisma.cancha.create({
    data: {
      id: randomUUID(),
      ligaId: params.ligaId,
      nombre: params.nombre.trim(),
    },
  });
}

async function ensureJugadoresRapidos(params: {
  equipoId: string;
  jugadores: JugadorRapidoInput[];
}) {
  const existentes = await prisma.jugador.findMany({
    where: {
      equipoId: params.equipoId,
      activo: true,
    },
  });

  const out: typeof existentes = [];
  for (const jugadorInput of params.jugadores) {
    const existente = existentes.find((jugador) => jugador.numero === jugadorInput.numero);
    if (existente) {
      const actualizado =
        existente.nombre !== jugadorInput.nombre.trim() ||
        existente.apellido !== jugadorInput.apellido.trim()
          ? await prisma.jugador.update({
              where: { id: existente.id },
              data: {
                nombre: jugadorInput.nombre.trim(),
                apellido: jugadorInput.apellido.trim(),
              },
            })
          : existente;
      out.push(actualizado);
      continue;
    }

    const creado = await prisma.jugador.create({
      data: {
        id: randomUUID(),
        equipoId: params.equipoId,
        nombre: jugadorInput.nombre.trim(),
        apellido: jugadorInput.apellido.trim(),
        numero: jugadorInput.numero,
        curp: null,
      },
    });
    out.push(creado);
  }

  return out;
}

export async function partidosRoutes(app: FastifyInstance) {
  app.get('/debug/log-test', { preHandler: [app.authenticate] }, async (request, reply) => {
    const req = request as AuthRequest;
    await debugLog({
      sessionId: '19c21e',
      runId: 'pre-fix',
      hypothesisId: 'H0',
      location: 'backend/src/routes/partidos.ts:GET /debug/log-test',
      message: 'debug log test line',
      data: { usuarioId: req.usuarioId ?? null, ligaId: req.ligaId ?? null },
      timestamp: Date.now(),
    });
    return reply.send({ ok: true, wrote: true, paths: DEBUG_LOG_PATHS });
  });

  app.get<{
    Querystring: { ligaId?: string; fecha?: string; estado?: string; temporadaId?: string };
  }>('/partidos', { preHandler: [app.authenticate, ...preRead] }, async (request, reply) => {
    const ligaId = request.query.ligaId || (request as AuthRequest).ligaId;
    if (!ligaId) return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId es requerido' });
    const tid = await resolveTemporadaIdForLiga(ligaId, request.query.temporadaId, reply);
    if (!tid) return;
    const where: { ligaId: string; temporadaId: string; fecha?: string; estado?: string } = {
      ligaId,
      temporadaId: tid,
    };
    if (request.query.fecha) where.fecha = request.query.fecha;
    if (request.query.estado) where.estado = request.query.estado as any;
    const list = await prisma.partido.findMany({
      where,
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });
    return reply.send(list.map(partidoToJson));
  });

  app.get<{ Params: { id: string } }>('/partidos/:id', { preHandler: [app.authenticate, ...preRead] }, async (request, reply) => {
    const partido = await prisma.partido.findUnique({ where: { id: request.params.id } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    return reply.send(partidoToJson(partido));
  });

  app.post<{
    Body: {
      fecha: string;
      horaInicio: string;
      categoria: string;
      equipoA: string;
      equipoB: string;
      cancha?: string;
      jugadoresA: JugadorRapidoInput[];
      jugadoresB: JugadorRapidoInput[];
    };
  }>('/partidos/alta-rapida', { preHandler: [app.authenticate, ...preWrite] }, async (request, reply) => {
    const req = request as AuthRequest;
    const { fecha, horaInicio, categoria, equipoA, equipoB, cancha, jugadoresA, jugadoresB } = request.body || {};

    if (!fecha || !horaInicio || !categoria || !equipoA?.trim() || !equipoB?.trim()) {
      return reply.status(400).send({
        code: 'VALIDATION',
        message: 'fecha, horaInicio, categoria, equipoA y equipoB son requeridos',
      });
    }
    if (!Array.isArray(jugadoresA) || !Array.isArray(jugadoresB) || jugadoresA.length < 5 || jugadoresB.length < 5) {
      return reply.status(400).send({
        code: 'VALIDATION',
        message: 'Se requieren al menos 5 jugadores por equipo para el alta rápida persistida.',
      });
    }

    const validarJugadores = (jugadores: JugadorRapidoInput[]) =>
      jugadores.every(
        (jugador) =>
          Number.isInteger(jugador.numero) &&
          jugador.numero >= 0 &&
          jugador.numero <= 999 &&
          Boolean(jugador.nombre?.trim()) &&
          Boolean(jugador.apellido?.trim())
      );
    const numerosUnicos = (jugadores: JugadorRapidoInput[]) =>
      new Set(jugadores.map((jugador) => jugador.numero)).size === jugadores.length;

    if (!validarJugadores(jugadoresA) || !validarJugadores(jugadoresB)) {
      return reply.status(400).send({
        code: 'VALIDATION',
        message: 'Cada jugador debe incluir numero, nombre y apellido validos.',
      });
    }
    if (!numerosUnicos(jugadoresA) || !numerosUnicos(jugadoresB)) {
      return reply.status(400).send({
        code: 'VALIDATION',
        message: 'No puede haber numeros repetidos dentro del mismo equipo.',
      });
    }

    const ligaId = req.ligaId;
    const temporadaId = await defaultTemporadaActivaId(ligaId);
    if (!temporadaId) {
      return reply.status(400).send({
        code: 'SIN_TEMPORADA',
        message: 'La liga no tiene temporada activa. Crea una temporada primero.',
      });
    }
    const equipoLocal = await ensureEquipoRapido({
      ligaId,
      temporadaId,
      categoria,
      nombre: equipoA,
      usuarioId: req.usuarioId,
    });
    const equipoVisitante = await ensureEquipoRapido({
      ligaId,
      temporadaId,
      categoria,
      nombre: equipoB,
      usuarioId: req.usuarioId,
    });

    if (equipoLocal.id === equipoVisitante.id) {
      return reply.status(400).send({
        code: 'VALIDATION',
        message: 'El equipo local y visitante no pueden ser el mismo.',
      });
    }

    const canchaRow = await ensureCanchaRapida({
      ligaId,
      nombre: (cancha || 'Cancha pruebas').trim(),
    });

    const jugadoresLocal = await ensureJugadoresRapidos({
      equipoId: equipoLocal.id,
      jugadores: jugadoresA,
    });
    const jugadoresVisitante = await ensureJugadoresRapidos({
      equipoId: equipoVisitante.id,
      jugadores: jugadoresB,
    });

    const partidoId = randomUUID();
    const partido = await prisma.partido.create({
      data: {
        id: partidoId,
        ligaId,
        temporadaId,
        localEquipoId: equipoLocal.id,
        visitanteEquipoId: equipoVisitante.id,
        canchaId: canchaRow.id,
        categoria,
        fecha,
        horaInicio,
        anotadorId: req.usuarioId,
        estado: 'programado',
      },
    });

    const now = new Date();
    const plantillaRows = await Promise.all(
      [...jugadoresLocal, ...jugadoresVisitante].map((jugador, index) =>
        prisma.plantillaPartido.create({
          data: {
            id: randomUUID(),
            partidoId,
            equipoId: jugador.equipoId,
            jugadorId: jugador.id,
            enCanchaInicial: jugador.equipoId === equipoLocal.id
              ? index < jugadoresLocal.length && jugadoresLocal.slice(0, 5).some((j) => j.id === jugador.id)
              : jugadoresVisitante.slice(0, 5).some((j) => j.id === jugador.id),
            esCapitan: jugador.equipoId === equipoLocal.id
              ? jugadoresLocal[0]?.id === jugador.id
              : jugadoresVisitante[0]?.id === jugador.id,
            esCoach: false,
            invitado: false,
            createdAt: now,
            updatedAt: now,
          },
        })
      )
    );

    return reply.status(201).send({
      partido: partidoToJson(partido),
      equipos: [
        {
          id: equipoLocal.id,
          ligaId: equipoLocal.ligaId,
          nombre: equipoLocal.nombre,
          categoria: equipoLocal.categoria,
          activo: equipoLocal.activo,
          createdAt: equipoLocal.createdAt.toISOString(),
          updatedAt: equipoLocal.updatedAt.toISOString(),
        },
        {
          id: equipoVisitante.id,
          ligaId: equipoVisitante.ligaId,
          nombre: equipoVisitante.nombre,
          categoria: equipoVisitante.categoria,
          activo: equipoVisitante.activo,
          createdAt: equipoVisitante.createdAt.toISOString(),
          updatedAt: equipoVisitante.updatedAt.toISOString(),
        },
      ],
      cancha: {
        id: canchaRow.id,
        ligaId: canchaRow.ligaId,
        sedeId: canchaRow.sedeId,
        nombre: canchaRow.nombre,
        activo: canchaRow.activo,
        createdAt: canchaRow.createdAt.toISOString(),
        updatedAt: canchaRow.updatedAt.toISOString(),
      },
      jugadores: [...jugadoresLocal, ...jugadoresVisitante].map((jugador) => ({
        id: jugador.id,
        equipoId: jugador.equipoId,
        nombre: jugador.nombre,
        apellido: jugador.apellido,
        numero: jugador.numero,
        curp: jugador.curp,
        invitado: jugador.invitado,
        activo: jugador.activo,
        createdAt: jugador.createdAt.toISOString(),
        updatedAt: jugador.updatedAt.toISOString(),
      })),
      plantilla: plantillaRows.map((pl) => ({
        id: pl.id,
        partidoId: pl.partidoId,
        equipoId: pl.equipoId,
        jugadorId: pl.jugadorId,
        enCanchaInicial: pl.enCanchaInicial,
        esCapitan: pl.esCapitan,
        esCoach: pl.esCoach,
        invitado: pl.invitado,
        createdAt: pl.createdAt.toISOString(),
        updatedAt: pl.updatedAt.toISOString(),
      })),
    });
  });

  app.post<{
    Body: {
      id: string;
      localEquipoId: string;
      visitanteEquipoId: string;
      canchaId: string;
      categoria: string;
      fecha: string;
      horaInicio: string;
      anotadorId?: string;
    };
  }>('/partidos', { preHandler: [app.authenticate, ...preRead] }, async (request, reply) => {
    const ligaId = (request as AuthRequest).ligaId;
    const usuarioId = (request as AuthRequest).usuarioId;
    const body = request.body;
    if (!body?.id || !body.localEquipoId || !body.visitanteEquipoId || !body.canchaId || !body.categoria || !body.fecha || !body.horaInicio) {
      await debugLog({
        sessionId: '19c21e',
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'backend/src/routes/partidos.ts:POST /partidos:missing_fields',
        message: 'POST /partidos missing required fields',
        data: { hasBody: Boolean(body), keys: body ? Object.keys(body as any) : [], usuarioId, ligaId },
        timestamp: Date.now(),
      });
      return reply.status(400).send({ code: 'VALIDATION', message: 'Faltan campos requeridos' });
    }
    const existing = await prisma.partido.findUnique({ where: { id: body.id } });
    if (existing) return reply.send(partidoToJson(existing));

    const anotadorId = body.anotadorId || usuarioId;
    const membresia = await prisma.membresiaLiga.findFirst({
      where: { ligaId, usuarioId: anotadorId, activo: true, rol: { in: ['anotador_partido', 'admin_liga'] } },
    });
    if (!membresia) {
      await debugLog({
        sessionId: '19c21e',
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'backend/src/routes/partidos.ts:POST /partidos:no_membership',
        message: 'POST /partidos rejected: anotador membership missing',
        data: { partidoId: body.id, anotadorId, usuarioId, ligaId },
        timestamp: Date.now(),
      });
      return reply.status(400).send({
        code: 'VALIDATION',
        message: 'El anotador debe tener membresía activa en la liga con rol anotador_partido o admin_liga',
      });
    }

    const loc = await prisma.equipo.findUnique({ where: { id: body.localEquipoId } });
    const vis = await prisma.equipo.findUnique({ where: { id: body.visitanteEquipoId } });
    if (!loc || !vis || loc.ligaId !== ligaId || vis.ligaId !== ligaId) {
      return reply.status(400).send({ code: 'VALIDATION', message: 'Equipos no válidos para esta liga' });
    }
    if (loc.temporadaId !== vis.temporadaId) {
      return reply.status(400).send({
        code: 'VALIDATION',
        message: 'Los equipos deben pertenecer a la misma temporada',
      });
    }

    const partido = await prisma.partido.create({
      data: {
        id: body.id,
        ligaId,
        temporadaId: loc.temporadaId,
        localEquipoId: body.localEquipoId,
        visitanteEquipoId: body.visitanteEquipoId,
        canchaId: body.canchaId,
        categoria: body.categoria,
        fecha: body.fecha,
        horaInicio: body.horaInicio,
        anotadorId,
        estado: 'programado',
      },
    });
    return reply.status(201).send(partidoToJson(partido));
  });

  app.patch<{
    Params: { id: string };
    Body: { estado?: string; fotoMarcadorUrl?: string };
  }>('/partidos/:id', { preHandler: [app.authenticate, ...preWrite] }, async (request, reply) => {
    const partido = await prisma.partido.findUnique({ where: { id: request.params.id } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const req = request as AuthRequest;
    if (!canEditPartido(partido, req)) return reply.status(403).send({ code: 'FORBIDDEN', message: 'Solo el anotador del partido puede modificarlo' });
    if (partido.estado === 'finalizado') return reply.status(400).send({ code: 'VALIDATION', message: 'Partido ya cerrado' });
    const data: { estado?: string; fotoMarcadorUrl?: string } = {};
    if (request.body?.estado) data.estado = request.body.estado as any;
    if (request.body?.fotoMarcadorUrl !== undefined) data.fotoMarcadorUrl = request.body.fotoMarcadorUrl;
    const updated = await prisma.partido.update({ where: { id: request.params.id }, data });
    return reply.send(partidoToJson(updated));
  });

  app.delete<{ Params: { id: string } }>(
    '/partidos/:id',
    { preHandler: [app.authenticate, ...preWrite] },
    async (request, reply) => {
      const partidoId = request.params.id;
      const partido = await prisma.partido.findUnique({ where: { id: partidoId } });
      if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
      const ligaId = (request as AuthRequest).ligaId;
      if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
      const req = request as AuthRequest;
      if (!canEditPartido(partido, req)) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: 'Solo el anotador del partido puede eliminarlo' });
      }
      // Si ya está finalizado, solo admin_liga/superadmin pueden eliminar.
      if (partido.estado === 'finalizado' && !(req.isSuperAdmin || (req.roles && req.roles.includes('admin_liga')))) {
        return reply.status(400).send({ code: 'VALIDATION', message: 'No se puede eliminar un partido finalizado' });
      }

      await prisma.$transaction([
        prisma.evento.deleteMany({ where: { partidoId } }),
        prisma.plantillaPartido.deleteMany({ where: { partidoId } }),
        prisma.incidencia.deleteMany({ where: { partidoId } }),
        prisma.cierrePartido.deleteMany({ where: { partidoId } }),
        prisma.partido.delete({ where: { id: partidoId } }),
      ]);
      return reply.status(200).send({ ok: true });
    }
  );

  app.post<{
    Params: { id: string };
    Body: { ganador: 'local' | 'visitante'; motivo?: string };
  }>('/partidos/:id/registrar-default', { preHandler: [app.authenticate, ...preWrite] }, async (request, reply) => {
    const partidoId = request.params.id;
    const partido = await prisma.partido.findUnique({ where: { id: partidoId } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    if (['finalizado', 'default_local', 'default_visitante'].includes(partido.estado)) {
      return reply.status(400).send({ code: 'VALIDATION', message: 'Partido ya cerrado o en default' });
    }
    const ganador = request.body?.ganador;
    if (!ganador || (ganador !== 'local' && ganador !== 'visitante')) {
      return reply.status(400).send({ code: 'VALIDATION', message: 'ganador es requerido (local o visitante)' });
    }
    const motivo = request.body?.motivo ?? 'No presentación';
    const estado = ganador === 'local' ? 'default_visitante' : 'default_local';
    const equipoPerdedorId = ganador === 'local' ? partido.visitanteEquipoId : partido.localEquipoId;
    const folio = await generateFolio(partido.ligaId);
    await prisma.$transaction([
      prisma.incidencia.create({
        data: {
          partidoId,
          tipo: 'default_no_presentacion',
          equipoId: equipoPerdedorId,
          motivo,
        },
      }),
      prisma.partido.update({
        where: { id: partidoId },
        data: { estado, folio, cerradoAt: new Date() },
      }),
    ]);
    await syncResumenesPartido(partidoId);
    const updated = await prisma.partido.findUnique({ where: { id: partidoId } });
    return reply.send(partidoToJson(updated!));
  });

  app.get<{ Params: { id: string } }>('/partidos/:id/plantilla', { preHandler: [app.authenticate, ...preRead] }, async (request, reply) => {
    const partido = await prisma.partido.findUnique({ where: { id: request.params.id } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const list = await prisma.plantillaPartido.findMany({
      where: { partidoId: request.params.id },
    });
    return reply.send(
      list.map((pl) => ({
        id: pl.id,
        partidoId: pl.partidoId,
        equipoId: pl.equipoId,
        jugadorId: pl.jugadorId,
        enCanchaInicial: pl.enCanchaInicial,
        esCapitan: pl.esCapitan,
        esCoach: pl.esCoach,
        invitado: pl.invitado,
        createdAt: pl.createdAt.toISOString(),
        updatedAt: pl.updatedAt.toISOString(),
      }))
    );
  });

  app.post<{
    Params: { id: string };
    Body: { items: Array<{ partidoId: string; equipoId: string; jugadorId: string; enCanchaInicial: boolean; esCapitan: boolean; esCoach: boolean; invitado?: boolean }> };
  }>('/partidos/:id/plantilla', { preHandler: [app.authenticate, ...preWrite] }, async (request, reply) => {
    const partidoId = request.params.id;
    const partido = await prisma.partido.findUnique({ where: { id: partidoId } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const req = request as AuthRequest;
    if (!canEditPartido(partido, req)) return reply.status(403).send({ code: 'FORBIDDEN', message: 'Solo el anotador del partido puede configurar la plantilla' });
    const items = request.body?.items || [];
    const localCount = items.filter((i) => i.equipoId === partido.localEquipoId && i.enCanchaInicial).length;
    const visitanteCount = items.filter((i) => i.equipoId === partido.visitanteEquipoId && i.enCanchaInicial).length;
    if (localCount !== 5 || visitanteCount !== 5) {
      return reply.status(400).send({ code: 'VALIDATION', message: 'Debe haber exactamente 5 jugadores en cancha por equipo' });
    }
    const capitanes = items.filter((i) => i.esCapitan);
    for (const c of capitanes) {
      if (!items.find((i) => i.jugadorId === c.jugadorId && i.enCanchaInicial)) {
        return reply.status(400).send({ code: 'VALIDATION', message: 'El capitán debe estar en cancha' });
      }
    }
    await prisma.plantillaPartido.deleteMany({ where: { partidoId } });
    for (const it of items) {
      await prisma.plantillaPartido.create({
        data: {
          partidoId,
          equipoId: it.equipoId,
          jugadorId: it.jugadorId,
          enCanchaInicial: it.enCanchaInicial,
          esCapitan: it.esCapitan,
          esCoach: it.esCoach ?? false,
          invitado: it.invitado ?? false,
        },
      });
    }
    const list = await prisma.plantillaPartido.findMany({ where: { partidoId } });
    return reply.send(
      list.map((pl) => ({
        id: pl.id,
        partidoId: pl.partidoId,
        equipoId: pl.equipoId,
        jugadorId: pl.jugadorId,
        enCanchaInicial: pl.enCanchaInicial,
        esCapitan: pl.esCapitan,
        esCoach: pl.esCoach,
        invitado: pl.invitado,
        createdAt: pl.createdAt.toISOString(),
        updatedAt: pl.updatedAt.toISOString(),
      }))
    );
  });

  app.get<{ Params: { id: string } }>('/partidos/:id/eventos', { preHandler: [app.authenticate, ...preRead] }, async (request, reply) => {
    const partido = await prisma.partido.findUnique({ where: { id: request.params.id } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const list = await prisma.evento.findMany({
      where: { partidoId: request.params.id },
      orderBy: { orden: 'asc' },
    });
    return reply.send(
      list.map((e) => ({
        id: e.id,
        partidoId: e.partidoId,
        tipo: e.tipo,
        jugadorId: e.jugadorId,
        jugadorEntraId: e.jugadorEntraId,
        minutoPartido: e.minutoPartido,
        cuarto: e.cuarto,
        orden: e.orden,
        segundosRestantesCuarto: e.segundosRestantesCuarto ?? null,
        tiempoPartidoSegundos: e.tiempoPartidoSegundos ?? null,
        createdAt: e.createdAt.toISOString(),
        serverReceivedAt: e.serverReceivedAt?.toISOString() ?? null,
      }))
    );
  });

  app.get<{ Params: { id: string } }>('/partidos/:id/diagnostico', { preHandler: [app.authenticate, ...preRead] }, async (request, reply) => {
    const partido = await prisma.partido.findUnique({
      where: { id: request.params.id },
      include: {
        plantilla: { include: { jugador: true } },
        eventos: { orderBy: { orden: 'asc' } },
      },
    });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const domainState = deriveBackendMatchState(partido);
    const lastEvent = partido.eventos.at(-1);
    return reply.send({
      partidoId: partido.id,
      estado: partido.estado,
      eventosServidor: partido.eventos.length,
      ultimoEvento: lastEvent
        ? {
            id: lastEvent.id,
            orden: lastEvent.orden,
            tipo: lastEvent.tipo,
            jugadorId: lastEvent.jugadorId,
            cuarto: lastEvent.cuarto,
            createdAt: lastEvent.createdAt.toISOString(),
          }
        : null,
      score: domainState.score,
      canFinish: domainState.canFinish,
      finishBlockReasons: domainState.finishBlockReasons,
      home: {
        playersOnCourt: domainState.home.playersOnCourt.length,
        disqualifiedPlayers: domainState.home.disqualifiedPlayers.length,
      },
      away: {
        playersOnCourt: domainState.away.playersOnCourt.length,
        disqualifiedPlayers: domainState.away.disqualifiedPlayers.length,
      },
    });
  });

  app.post<{
    Params: { id: string };
    Body: { eventos: Array<{ id: string; tipo: string; jugadorId: string; jugadorEntraId?: string; minutoPartido: number; cuarto: number; orden: number; segundosRestantesCuarto?: number; tiempoPartidoSegundos?: number }> };
  }>('/partidos/:id/eventos', { preHandler: [app.authenticate, ...preWrite] }, async (request, reply) => {
    const partidoId = request.params.id;
    const partido = await prisma.partido.findUnique({
      where: { id: partidoId },
      include: {
        plantilla: { include: { jugador: true } },
        eventos: { orderBy: { orden: 'asc' } },
      },
    });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    if (partido.estado === 'finalizado') {
      await debugLog({
        sessionId: '19c21e',
        runId: 'pre-fix',
        hypothesisId: 'H3',
        location: 'backend/src/routes/partidos.ts:POST /partidos/:id/eventos:already_closed',
        message: 'POST eventos rejected: match already finished',
        data: { partidoId, estado: partido.estado },
        timestamp: Date.now(),
      });
      return reply.status(400).send({ code: 'VALIDATION', message: 'Partido ya cerrado' });
    }
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const req = request as AuthRequest;
    if (!canEditPartido(partido, req)) return reply.status(403).send({ code: 'FORBIDDEN', message: 'Solo el anotador del partido puede registrar eventos' });

    let eventos = request.body?.eventos;
    if (Array.isArray(request.body) && !eventos) eventos = request.body as any;
    if (!Array.isArray(eventos)) eventos = [];
    const sorted = [...eventos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const existingIds = new Set(partido.eventos.map((event) => event.id));
    const validation = validateIncomingBackendEvents(
      partido,
      sorted
        .filter((ev) => !existingIds.has(ev.id))
        .map((ev) => ({
        id: ev.id,
        tipo: String(ev.tipo),
        jugadorId: ev.jugadorId,
        jugadorEntraId: ev.jugadorEntraId || null,
        cuarto: Number(ev.cuarto) || 1,
        orden: Number(ev.orden) || 0,
        createdAt: new Date(),
        segundosRestantesCuarto:
          ev.segundosRestantesCuarto != null ? Number(ev.segundosRestantesCuarto) : null,
        }))
    );
    if (validation) {
      const invalidEvent = sorted.find((ev) => ev.id === validation.eventId);
      await debugLog({
        sessionId: '19c21e',
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'backend/src/routes/partidos.ts:POST /partidos/:id/eventos:domain_validation_failed',
        message: 'POST eventos rejected by domain validation',
        data: {
          partidoId,
          eventId: validation.eventId,
          invalidOrden: invalidEvent?.orden ?? null,
          invalidTipo: invalidEvent?.tipo ?? null,
          invalidJugadorId: invalidEvent?.jugadorId ?? null,
          firstViolation: validation.violations?.[0]?.code ?? null,
          firstViolationMessage: validation.violations?.[0]?.message ?? null,
        },
        timestamp: Date.now(),
      });
      return reply.status(400).send({
        code: 'VALIDATION',
        message: validation.violations[0]?.message ?? 'Evento inválido por reglas de partido',
        eventId: validation.eventId,
        orden: invalidEvent?.orden ?? null,
        tipo: invalidEvent?.tipo ?? null,
        jugadorId: invalidEvent?.jugadorId ?? null,
        violations: validation.violations,
      });
    }
    let recibidos = 0;
    for (const ev of sorted) {
      if (!ev?.id || !ev?.tipo || !ev?.jugadorId) continue;
      const existing = await prisma.evento.findUnique({ where: { id: ev.id } });
      if (existing) {
        recibidos++;
        continue;
      }
      try {
        await prisma.evento.create({
          data: {
            id: ev.id,
            partidoId,
            tipo: String(ev.tipo),
            jugadorId: ev.jugadorId,
            jugadorEntraId: ev.jugadorEntraId || null,
            minutoPartido: Number(ev.minutoPartido) || 0,
            cuarto: Number(ev.cuarto) || 1,
            orden: Number(ev.orden) || 0,
            segundosRestantesCuarto: ev.segundosRestantesCuarto != null ? Number(ev.segundosRestantesCuarto) : null,
            tiempoPartidoSegundos: ev.tiempoPartidoSegundos != null ? Number(ev.tiempoPartidoSegundos) : null,
            serverReceivedAt: new Date(),
          },
        });
        recibidos++;
      } catch (err) {
        console.warn('Evento create error', ev.id, err);
        return reply.status(400).send({ code: 'VALIDATION', message: 'Error al guardar evento', detail: String((err as Error).message) });
      }
    }
    const list = await prisma.evento.findMany({ where: { partidoId }, orderBy: { orden: 'asc' } });
    return reply.send({
      recibidos,
      eventos: list.map((e) => ({
        id: e.id,
        partidoId: e.partidoId,
        tipo: e.tipo,
        jugadorId: e.jugadorId,
        jugadorEntraId: e.jugadorEntraId,
        minutoPartido: e.minutoPartido,
        cuarto: e.cuarto,
        orden: e.orden,
        segundosRestantesCuarto: e.segundosRestantesCuarto ?? null,
        tiempoPartidoSegundos: e.tiempoPartidoSegundos ?? null,
        createdAt: e.createdAt.toISOString(),
        serverReceivedAt: e.serverReceivedAt?.toISOString() ?? null,
      })),
    });
  });

  app.delete<{
    Params: { id: string; eventId: string };
  }>('/partidos/:id/eventos/:eventId', { preHandler: [app.authenticate, ...preWrite] }, async (request, reply) => {
    const partidoId = request.params.id;
    const eventId = request.params.eventId;
    const partido = await prisma.partido.findUnique({ where: { id: partidoId } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    if (partido.estado === 'finalizado') return reply.status(400).send({ code: 'VALIDATION', message: 'Partido ya cerrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const req = request as AuthRequest;
    if (!canEditPartido(partido, req)) return reply.status(403).send({ code: 'FORBIDDEN', message: 'Solo el anotador del partido puede anular eventos' });

    const existing = await prisma.evento.findUnique({ where: { id: eventId } });
    if (!existing || existing.partidoId !== partidoId) {
      return reply.status(200).send({ ok: true, deleted: false });
    }
    await prisma.evento.delete({ where: { id: eventId } });
    return reply.status(200).send({ ok: true, deleted: true });
  });

  app.get<{ Params: { id: string } }>('/partidos/:id/incidencias', { preHandler: [app.authenticate, ...preRead] }, async (request, reply) => {
    const partido = await prisma.partido.findUnique({ where: { id: request.params.id } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const list = await prisma.incidencia.findMany({ where: { partidoId: request.params.id } });
    return reply.send(
      list.map((i) => ({
        id: i.id,
        partidoId: i.partidoId,
        tipo: i.tipo,
        equipoId: i.equipoId,
        jugadorId: i.jugadorId,
        motivo: i.motivo,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      }))
    );
  });

  app.post<{
    Params: { id: string };
    Body: { id?: string; tipo: string; equipoId?: string; jugadorId?: string; motivo?: string };
  }>('/partidos/:id/incidencias', { preHandler: [app.authenticate, ...preWrite] }, async (request, reply) => {
    const partidoId = request.params.id;
    const partido = await prisma.partido.findUnique({ where: { id: partidoId } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const body = request.body;
    if (!body?.tipo) return reply.status(400).send({ code: 'VALIDATION', message: 'tipo es requerido' });

    if (body.id) {
      const existente = await prisma.incidencia.findUnique({ where: { id: body.id } });
      if (existente) {
        return reply.status(200).send({
          id: existente.id,
          partidoId: existente.partidoId,
          tipo: existente.tipo,
          equipoId: existente.equipoId,
          jugadorId: existente.jugadorId,
          motivo: existente.motivo,
          createdAt: existente.createdAt.toISOString(),
          updatedAt: existente.updatedAt.toISOString(),
        });
      }
    }

    const incidencia = await prisma.incidencia.create({
      data: {
        ...(body.id && { id: body.id }),
        partidoId,
        tipo: body.tipo as any,
        equipoId: body.equipoId || null,
        jugadorId: body.jugadorId || null,
        motivo: body.motivo || null,
      },
    });
    return reply.status(201).send({
      id: incidencia.id,
      partidoId: incidencia.partidoId,
      tipo: incidencia.tipo,
      equipoId: incidencia.equipoId,
      jugadorId: incidencia.jugadorId,
      motivo: incidencia.motivo,
      createdAt: incidencia.createdAt.toISOString(),
      updatedAt: incidencia.updatedAt.toISOString(),
    });
  });

  app.post<{ Params: { id: string } }>('/partidos/:id/cerrar', { preHandler: [app.authenticate, ensurePartidoLigaAndRoles, ...preWrite] }, async (request, reply) => {
    const partidoId = request.params.id;
    const clientClosureId = (request.headers['x-client-closure-id'] as string) || undefined;
    if (clientClosureId) {
      const cierreExistente = await prisma.cierrePartido.findUnique({ where: { clientClosureId }, include: { partido: true } });
      if (cierreExistente && cierreExistente.partidoId === partidoId) {
        const p = cierreExistente.partido;
        return reply.status(200).send({ partido: partidoToJson(p), folio: p.folio ?? '' });
      }
    }

    const partido = await prisma.partido.findUnique({
      where: { id: partidoId },
      include: { plantilla: true, eventos: { orderBy: { orden: 'asc' } } },
    });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    if (partido.estado === 'finalizado') return reply.status(400).send({ code: 'VALIDATION', message: 'Partido ya cerrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const req = request as AuthRequest;
    if (!canEditPartido(partido, req)) return reply.status(403).send({ code: 'FORBIDDEN', message: 'Solo el anotador del partido puede cerrar el partido' });

    let fotoMarcadorUrl: string | null = null;
    let data: Awaited<ReturnType<typeof request.file>> | null = null;
    try {
      data = await request.file();
    } catch {
      data = null;
    }
    if (data) {
      await ensureUploadDir();
      const ext = path.extname(data.filename) || '.jpg';
      const filename = `marcador-${partidoId}${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);
      const buf = await data.toBuffer();
      await fs.writeFile(filepath, buf);
      fotoMarcadorUrl = `/uploads/${filename}`;
    }
    const body = request.body as {
      fotoMarcadorUrl?: string;
      cuartoActual?: string | number;
      segundosRestantesCuarto?: string | number;
    } | undefined;
    if (!fotoMarcadorUrl && body?.fotoMarcadorUrl) fotoMarcadorUrl = body.fotoMarcadorUrl;
    const multipartFields = (data as { fields?: Record<string, unknown> } | null)?.fields;
    const cuartoActualRaw =
      getMultipartFieldValue(multipartFields?.cuartoActual) ?? (body?.cuartoActual != null ? String(body.cuartoActual) : undefined);
    const segundosRestantesRaw =
      getMultipartFieldValue(multipartFields?.segundosRestantesCuarto) ??
      (body?.segundosRestantesCuarto != null ? String(body.segundosRestantesCuarto) : undefined);
    const closingClockSnapshot =
      cuartoActualRaw != null && segundosRestantesRaw != null
        ? {
            cuartoActual: Number(cuartoActualRaw),
            segundosRestantesCuarto: Number(segundosRestantesRaw),
          }
        : undefined;

    const domainState = deriveBackendMatchState(partido, {
      closingPhotoProvided: Boolean(fotoMarcadorUrl),
      closingClockSnapshot,
    });
    if (!domainState.canFinish) {
      return reply.status(400).send({
        code: 'VALIDATION',
        message: firstFinishReasonMessage(domainState.finishBlockReasons[0]),
        finishBlockReasons: domainState.finishBlockReasons,
      });
    }
    const marcadorLocalFinal = domainState.score.home;
    const marcadorVisitanteFinal = domainState.score.away;

    const folio = await generateFolio(partido.ligaId);
    const updateData: {
      estado: string;
      folio: string;
      fotoMarcadorUrl: string | null;
      cerradoAt: Date;
      marcadorLocalFinal?: number;
      marcadorVisitanteFinal?: number;
    } = {
      estado: 'finalizado',
      folio,
      fotoMarcadorUrl,
      cerradoAt: new Date(),
    };
    updateData.marcadorLocalFinal = Number(marcadorLocalFinal);
    updateData.marcadorVisitanteFinal = Number(marcadorVisitanteFinal);

    const updated = await prisma.partido.update({
      where: { id: partidoId },
      data: updateData,
    });
    if (clientClosureId) {
      await prisma.cierrePartido.create({
        data: { partidoId, clientClosureId },
      });
    }
    await syncResumenesPartido(partidoId);
    return reply.send({ partido: partidoToJson(updated), folio });
  });

  app.get<{ Params: { id: string } }>('/partidos/:id/acta', { preHandler: [app.authenticate, ...preRead] }, async (request, reply) => {
    const partido = await prisma.partido.findUnique({
      where: { id: request.params.id },
      include: {
        localEquipo: true,
        visitanteEquipo: true,
        cancha: true,
        plantilla: { include: { jugador: true } },
        eventos: { orderBy: { orden: 'asc' } },
        incidencias: true,
      },
    });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });

    const sedeMapActa = await sedeNombrePorIdMap([partido.cancha.sedeId]);
    const sedeN = partido.cancha.sedeId ? sedeMapActa.get(partido.cancha.sedeId) : undefined;
    const etiquetaC = etiquetaCancha({
      nombre: partido.cancha.nombre,
      sede: sedeN ? { nombre: sedeN } : null,
    });

    const domainState = deriveBackendMatchState(partido, {
      closingPhotoProvided: Boolean(partido.fotoMarcadorUrl),
    });
    const localTotal =
      partido.estado === 'default_local' || partido.estado === 'default_visitante'
        ? partido.marcadorLocalFinal ?? (partido.estado === 'default_visitante' ? 20 : 0)
        : domainState.score.home;
    const visitanteTotal =
      partido.estado === 'default_local' || partido.estado === 'default_visitante'
        ? partido.marcadorVisitanteFinal ?? (partido.estado === 'default_local' ? 20 : 0)
        : domainState.score.away;

    const acta = {
      partido: partidoToJson(partido),
      liga: partido.ligaId,
      local: {
        nombre: partido.localEquipo.nombre,
        puntos: localTotal,
        jugadores: partido.plantilla
          .filter((p) => p.equipoId === partido.localEquipoId)
          .map((p) => ({
            ...p.jugador,
            puntos: domainState.players[p.jugadorId]?.points || 0,
            faltas: domainState.players[p.jugadorId]?.totalFoulsForDisplay || 0,
          })),
      },
      visitante: {
        nombre: partido.visitanteEquipo.nombre,
        puntos: visitanteTotal,
        jugadores: partido.plantilla
          .filter((p) => p.equipoId === partido.visitanteEquipoId)
          .map((p) => ({
            ...p.jugador,
            puntos: domainState.players[p.jugadorId]?.points || 0,
            faltas: domainState.players[p.jugadorId]?.totalFoulsForDisplay || 0,
          })),
      },
      cancha: etiquetaC,
      categoria: partido.categoria,
      fecha: partido.fecha,
      horaInicio: partido.horaInicio,
      folio: partido.folio,
      fotoMarcadorUrl: partido.fotoMarcadorUrl,
      incidencias: partido.incidencias,
    };
    return reply.send(acta);
  });

  app.get<{ Params: { id: string } }>('/partidos/:id/acta/pdf', { preHandler: [app.authenticate, ...preRead] }, async (request, reply) => {
    const partido = await prisma.partido.findUnique({
      where: { id: request.params.id },
      include: {
        localEquipo: true,
        visitanteEquipo: true,
        cancha: true,
        plantilla: { include: { jugador: true } },
        eventos: { orderBy: { orden: 'asc' } },
        incidencias: true,
      },
    });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as AuthRequest).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });

    const sedeMapPdf = await sedeNombrePorIdMap([partido.cancha.sedeId]);
    const sedePdf = partido.cancha.sedeId ? sedeMapPdf.get(partido.cancha.sedeId) : undefined;
    const etiquetaPdf = etiquetaCancha({
      nombre: partido.cancha.nombre,
      sede: sedePdf ? { nombre: sedePdf } : null,
    });

    const domainState = deriveBackendMatchState(partido, {
      closingPhotoProvided: Boolean(partido.fotoMarcadorUrl),
    });
    let localTotal = domainState.score.home;
    let visitanteTotal = domainState.score.away;

    if (partido.estado === 'default_local' || partido.estado === 'default_visitante') {
      localTotal = partido.marcadorLocalFinal ?? (partido.estado === 'default_visitante' ? 20 : 0);
      visitanteTotal = partido.marcadorVisitanteFinal ?? (partido.estado === 'default_local' ? 20 : 0);
    }

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => {
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `inline; filename="acta-${partido.folio || partido.id}.pdf"`);
      reply.send(Buffer.concat(chunks));
    });

    doc.fontSize(18).text(`Acta ${partido.folio || partido.id}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`${partido.localEquipo.nombre} ${localTotal} - ${visitanteTotal} ${partido.visitanteEquipo.nombre}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`${partido.categoria} · ${etiquetaPdf} · ${partido.fecha} ${partido.horaInicio}`);
    doc.moveDown(0.5);

    if (partido.estado === 'default_local' || partido.estado === 'default_visitante') {
      doc.text(`Partido ganado por default (no presentación). Ganador: ${partido.estado === 'default_visitante' ? partido.localEquipo.nombre : partido.visitanteEquipo.nombre}`);
      doc.moveDown(0.5);
    }

    doc.text('Local — ' + partido.localEquipo.nombre);
    doc.moveDown(0.3);
    partido.plantilla.filter((p) => p.equipoId === partido.localEquipoId).forEach((p) => {
      doc.fontSize(9).text(`  #${p.jugador.numero} ${p.jugador.nombre} ${p.jugador.apellido} — Pts: ${domainState.players[p.jugadorId]?.points || 0}, F: ${domainState.players[p.jugadorId]?.totalFoulsForDisplay || 0}`);
    });
    doc.moveDown(0.5);
    doc.text('Visitante — ' + partido.visitanteEquipo.nombre);
    doc.moveDown(0.3);
    partido.plantilla.filter((p) => p.equipoId === partido.visitanteEquipoId).forEach((p) => {
      doc.fontSize(9).text(`  #${p.jugador.numero} ${p.jugador.nombre} ${p.jugador.apellido} — Pts: ${domainState.players[p.jugadorId]?.points || 0}, F: ${domainState.players[p.jugadorId]?.totalFoulsForDisplay || 0}`);
    });
    doc.moveDown(0.5);

    if (partido.incidencias.length > 0) {
      doc.text('Incidencias:');
      partido.incidencias.forEach((i) => {
        doc.fontSize(9).text(`  ${i.tipo}${i.motivo ? ': ' + i.motivo : ''}`);
      });
      doc.moveDown(0.5);
    }

    doc.fontSize(8).text(`Folio: ${partido.folio || '-'}`, { align: 'center' });
    doc.end();
  });
}
