import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../lib/auth.js';
import type { AuthRequest } from '../lib/auth.js';
import { ROLES_LECTURA_ROSTER, ROLES_PARTIDO } from '../lib/rbac.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const preRead = [requireRole(...ROLES_LECTURA_ROSTER)];
const preWrite = [requireRole(...ROLES_PARTIDO)];

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
  req.roles = [membresia.rol];
}

function partidoToJson(p: {
  id: string;
  ligaId: string;
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

export async function partidosRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { ligaId?: string; fecha?: string; estado?: string };
  }>('/partidos', { preHandler: [app.authenticate, ...preRead] }, async (request, reply) => {
    const ligaId = request.query.ligaId || (request as { ligaId: string }).ligaId;
    if (!ligaId) return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId es requerido' });
    const where: { ligaId: string; fecha?: string; estado?: string } = { ligaId };
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
    const ligaId = (request as { ligaId: string }).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    return reply.send(partidoToJson(partido));
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
    const ligaId = (request as { ligaId: string }).ligaId;
    const usuarioId = (request as { usuarioId: string }).usuarioId;
    const body = request.body;
    if (!body?.id || !body.localEquipoId || !body.visitanteEquipoId || !body.canchaId || !body.categoria || !body.fecha || !body.horaInicio) {
      return reply.status(400).send({ code: 'VALIDATION', message: 'Faltan campos requeridos' });
    }
    const existing = await prisma.partido.findUnique({ where: { id: body.id } });
    if (existing) return reply.send(partidoToJson(existing));

    const anotadorId = body.anotadorId || usuarioId;
    const membresia = await prisma.membresiaLiga.findFirst({
      where: { ligaId, usuarioId: anotadorId, activo: true, rol: { in: ['anotador_partido', 'admin_liga'] } },
    });
    if (!membresia) {
      return reply.status(400).send({
        code: 'VALIDATION',
        message: 'El anotador debe tener membresía activa en la liga con rol anotador_partido o admin_liga',
      });
    }

    const partido = await prisma.partido.create({
      data: {
        id: body.id,
        ligaId,
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
    const ligaId = (request as { ligaId: string }).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const req = request as { usuarioId: string; isSuperAdmin?: boolean; roles?: string[] };
    if (!canEditPartido(partido, req)) return reply.status(403).send({ code: 'FORBIDDEN', message: 'Solo el anotador del partido puede modificarlo' });
    if (partido.estado === 'finalizado') return reply.status(400).send({ code: 'VALIDATION', message: 'Partido ya cerrado' });
    const data: { estado?: string; fotoMarcadorUrl?: string } = {};
    if (request.body?.estado) data.estado = request.body.estado as any;
    if (request.body?.fotoMarcadorUrl !== undefined) data.fotoMarcadorUrl = request.body.fotoMarcadorUrl;
    const updated = await prisma.partido.update({ where: { id: request.params.id }, data });
    return reply.send(partidoToJson(updated));
  });

  app.post<{
    Params: { id: string };
    Body: { ganador: 'local' | 'visitante'; motivo?: string };
  }>('/partidos/:id/registrar-default', { preHandler: [app.authenticate, ...preWrite] }, async (request, reply) => {
    const partidoId = request.params.id;
    const partido = await prisma.partido.findUnique({ where: { id: partidoId } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as { ligaId: string }).ligaId;
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
    const updated = await prisma.partido.findUnique({ where: { id: partidoId } });
    return reply.send(partidoToJson(updated!));
  });

  app.get<{ Params: { id: string } }>('/partidos/:id/plantilla', { preHandler: [app.authenticate, ...preRead] }, async (request, reply) => {
    const partido = await prisma.partido.findUnique({ where: { id: request.params.id } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as { ligaId: string }).ligaId;
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
    const ligaId = (request as { ligaId: string }).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const req = request as { usuarioId: string; isSuperAdmin?: boolean; roles?: string[] };
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
    const ligaId = (request as { ligaId: string }).ligaId;
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
        createdAt: e.createdAt.toISOString(),
        serverReceivedAt: e.serverReceivedAt?.toISOString() ?? null,
      }))
    );
  });

  app.post<{
    Params: { id: string };
    Body: { eventos: Array<{ id: string; tipo: string; jugadorId: string; jugadorEntraId?: string; minutoPartido: number; cuarto: number; orden: number }> };
  }>('/partidos/:id/eventos', { preHandler: [app.authenticate, ...preWrite] }, async (request, reply) => {
    const partidoId = request.params.id;
    const partido = await prisma.partido.findUnique({ where: { id: partidoId } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    if (partido.estado === 'finalizado') return reply.status(400).send({ code: 'VALIDATION', message: 'Partido ya cerrado' });
    const ligaId = (request as { ligaId: string }).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const req = request as { usuarioId: string; isSuperAdmin?: boolean; roles?: string[] };
    if (!canEditPartido(partido, req)) return reply.status(403).send({ code: 'FORBIDDEN', message: 'Solo el anotador del partido puede registrar eventos' });

    let eventos = request.body?.eventos;
    if (Array.isArray(request.body) && !eventos) eventos = request.body as any;
    if (!Array.isArray(eventos)) eventos = [];
    const sorted = [...eventos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
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
        createdAt: e.createdAt.toISOString(),
        serverReceivedAt: e.serverReceivedAt?.toISOString() ?? null,
      })),
    });
  });

  app.get<{ Params: { id: string } }>('/partidos/:id/incidencias', { preHandler: [app.authenticate, ...preRead] }, async (request, reply) => {
    const partido = await prisma.partido.findUnique({ where: { id: request.params.id } });
    if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
    const ligaId = (request as { ligaId: string }).ligaId;
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
    const ligaId = (request as { ligaId: string }).ligaId;
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
    const ligaId = (request as { ligaId: string }).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
    const req = request as { usuarioId: string; isSuperAdmin?: boolean; roles?: string[] };
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
    const body = request.body as { fotoMarcadorUrl?: string } | undefined;
    if (!fotoMarcadorUrl && body?.fotoMarcadorUrl) fotoMarcadorUrl = body.fotoMarcadorUrl;

    const puntosPorJugador: Record<string, number> = {};
    for (const e of partido.eventos) {
      if (!puntosPorJugador[e.jugadorId]) puntosPorJugador[e.jugadorId] = 0;
      if (e.tipo === 'punto_2') puntosPorJugador[e.jugadorId] += 2;
      else if (e.tipo === 'punto_3') puntosPorJugador[e.jugadorId] += 3;
      else if (e.tipo === 'tiro_libre_anotado') puntosPorJugador[e.jugadorId] += 1;
    }
    const marcadorLocalFinal = partido.plantilla
      .filter((p) => p.equipoId === partido.localEquipoId)
      .reduce((s, p) => s + (puntosPorJugador[p.jugadorId] || 0), 0);
    const marcadorVisitanteFinal = partido.plantilla
      .filter((p) => p.equipoId === partido.visitanteEquipoId)
      .reduce((s, p) => s + (puntosPorJugador[p.jugadorId] || 0), 0);

    if (marcadorLocalFinal === marcadorVisitanteFinal) {
      return reply.status(400).send({
        code: 'VALIDATION',
        message: 'No se puede cerrar el partido con empate. Registra tiempo extra hasta que haya ganador.',
      });
    }

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
    const ligaId = (request as { ligaId: string }).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });

    const FALTA_TIPOS_ACTA = ['falta_personal', 'falta_tecnica', 'falta_antideportiva'];
    const puntosPorJugador: Record<string, number> = {};
    const faltasPorJugador: Record<string, number> = {};
    for (const e of partido.eventos) {
      if (!puntosPorJugador[e.jugadorId]) puntosPorJugador[e.jugadorId] = 0;
      if (!faltasPorJugador[e.jugadorId]) faltasPorJugador[e.jugadorId] = 0;
      if (e.tipo === 'punto_2') puntosPorJugador[e.jugadorId] += 2;
      else if (e.tipo === 'punto_3') puntosPorJugador[e.jugadorId] += 3;
      else if (e.tipo === 'tiro_libre_anotado') puntosPorJugador[e.jugadorId] += 1;
      else if (FALTA_TIPOS_ACTA.includes(e.tipo)) faltasPorJugador[e.jugadorId]++;
    }
    for (const jid of Object.keys(faltasPorJugador)) {
      faltasPorJugador[jid] = Math.min(5, faltasPorJugador[jid]);
    }
    const localTotal = Object.entries(puntosPorJugador).filter(([jid]) =>
      partido.plantilla.some((p) => p.equipoId === partido.localEquipoId && p.jugadorId === jid)
    ).reduce((s, [, v]) => s + v, 0);
    const visitanteTotal = Object.entries(puntosPorJugador).filter(([jid]) =>
      partido.plantilla.some((p) => p.equipoId === partido.visitanteEquipoId && p.jugadorId === jid)
    ).reduce((s, [, v]) => s + v, 0);

    const acta = {
      partido: partidoToJson(partido),
      liga: partido.ligaId,
      local: { nombre: partido.localEquipo.nombre, puntos: localTotal, jugadores: partido.plantilla.filter((p) => p.equipoId === partido.localEquipoId).map((p) => ({ ...p.jugador, puntos: puntosPorJugador[p.jugadorId] || 0, faltas: faltasPorJugador[p.jugadorId] || 0 })) },
      visitante: { nombre: partido.visitanteEquipo.nombre, puntos: visitanteTotal, jugadores: partido.plantilla.filter((p) => p.equipoId === partido.visitanteEquipoId).map((p) => ({ ...p.jugador, puntos: puntosPorJugador[p.jugadorId] || 0, faltas: faltasPorJugador[p.jugadorId] || 0 })) },
      cancha: partido.cancha.nombre,
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
    const ligaId = (request as { ligaId: string }).ligaId;
    if (partido.ligaId !== ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });

    const FALTA_TIPOS_ACTA = ['falta_personal', 'falta_tecnica', 'falta_antideportiva'];
    const puntosPorJugador: Record<string, number> = {};
    const faltasPorJugador: Record<string, number> = {};
    for (const e of partido.eventos) {
      if (!puntosPorJugador[e.jugadorId]) puntosPorJugador[e.jugadorId] = 0;
      if (!faltasPorJugador[e.jugadorId]) faltasPorJugador[e.jugadorId] = 0;
      if (e.tipo === 'punto_2') puntosPorJugador[e.jugadorId] += 2;
      else if (e.tipo === 'punto_3') puntosPorJugador[e.jugadorId] += 3;
      else if (e.tipo === 'tiro_libre_anotado') puntosPorJugador[e.jugadorId] += 1;
      else if (FALTA_TIPOS_ACTA.includes(e.tipo)) faltasPorJugador[e.jugadorId]++;
    }
    for (const jid of Object.keys(faltasPorJugador)) {
      faltasPorJugador[jid] = Math.min(5, faltasPorJugador[jid]);
    }
    let localTotal = Object.entries(puntosPorJugador).filter(([jid]) =>
      partido.plantilla.some((p) => p.equipoId === partido.localEquipoId && p.jugadorId === jid)
    ).reduce((s, [, v]) => s + v, 0);
    let visitanteTotal = Object.entries(puntosPorJugador).filter(([jid]) =>
      partido.plantilla.some((p) => p.equipoId === partido.visitanteEquipoId && p.jugadorId === jid)
    ).reduce((s, [, v]) => s + v, 0);

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
    doc.fontSize(10).text(`${partido.categoria} · ${partido.cancha.nombre} · ${partido.fecha} ${partido.horaInicio}`);
    doc.moveDown(0.5);

    if (partido.estado === 'default_local' || partido.estado === 'default_visitante') {
      doc.text(`Partido ganado por default (no presentación). Ganador: ${partido.estado === 'default_visitante' ? partido.localEquipo.nombre : partido.visitanteEquipo.nombre}`);
      doc.moveDown(0.5);
    }

    doc.text('Local — ' + partido.localEquipo.nombre);
    doc.moveDown(0.3);
    partido.plantilla.filter((p) => p.equipoId === partido.localEquipoId).forEach((p) => {
      doc.fontSize(9).text(`  #${p.jugador.numero} ${p.jugador.nombre} ${p.jugador.apellido} — Pts: ${puntosPorJugador[p.jugadorId] || 0}, F: ${faltasPorJugador[p.jugadorId] || 0}`);
    });
    doc.moveDown(0.5);
    doc.text('Visitante — ' + partido.visitanteEquipo.nombre);
    doc.moveDown(0.3);
    partido.plantilla.filter((p) => p.equipoId === partido.visitanteEquipoId).forEach((p) => {
      doc.fontSize(9).text(`  #${p.jugador.numero} ${p.jugador.nombre} ${p.jugador.apellido} — Pts: ${puntosPorJugador[p.jugadorId] || 0}, F: ${faltasPorJugador[p.jugadorId] || 0}`);
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
