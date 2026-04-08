import type { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole, type AuthRequest } from '../lib/auth.js';
import { ligaCoincideConSesion } from '../lib/ligaSesion.js';
import { ROLES_LECTURA_ROSTER } from '../lib/rbac.js';

type CanchaRow = {
  id: string;
  ligaId: string;
  sedeId: string | null;
  nombre: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toJsonCancha(c: CanchaRow, sede: { id: string; nombre: string } | null) {
  return {
    id: c.id,
    ligaId: c.ligaId,
    sedeId: c.sedeId,
    nombre: c.nombre,
    nombreCompleto: sede ? `${sede.nombre} — ${c.nombre}` : c.nombre,
    sede: sede ? { id: sede.id, nombre: sede.nombre } : null,
    activo: c.activo,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

/** Evita `include: { sede: true }` para no depender de un Prisma Client regenerado tras añadir la relación. */
async function cargarSedesPorIds(ids: string[]): Promise<Map<string, { id: string; nombre: string }>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const sedes = await prisma.sede.findMany({
    where: { id: { in: uniq } },
    select: { id: true, nombre: true },
  });
  return new Map(sedes.map((s) => [s.id, s]));
}

async function enriquecerCanchas(list: CanchaRow[]) {
  const sedeMap = await cargarSedesPorIds(list.map((c) => c.sedeId).filter((x): x is string => !!x));
  return list.map((c) => {
    const sed = c.sedeId ? sedeMap.get(c.sedeId) ?? null : null;
    return toJsonCancha(c, sed);
  });
}

async function puedeAdministrarLigaCancha(
  req: AuthRequest,
  ligaId: string,
  reply: FastifyReply
): Promise<boolean> {
  if (req.isSuperAdmin) return true;
  const m = await prisma.membresiaLiga.findFirst({
    where: {
      ligaId,
      usuarioId: req.usuarioId,
      activo: true,
      rol: 'admin_liga',
    },
  });
  if (!m) {
    await reply.status(403).send({ code: 'FORBIDDEN', message: 'Solo el organizador puede crear canchas' });
    return false;
  }
  return true;
}

export async function canchasRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { ligaId?: string } }>(
    '/canchas',
    { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] },
    async (request, reply) => {
      const ligaId = request.query.ligaId || (request as { ligaId?: string }).ligaId;
      if (!ligaId) return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId es requerido' });
      const list = await prisma.cancha.findMany({
        where: { ligaId, activo: true },
        orderBy: { nombre: 'asc' },
      });
      return reply.send(await enriquecerCanchas(list));
    }
  );

  app.post<{
    Body: { sedeId: string; nombre: string };
  }>('/canchas', { preHandler: [app.authenticate] }, async (request, reply) => {
    const req = request as AuthRequest;
    const { sedeId, nombre } = request.body || {};
    if (!sedeId || !nombre?.trim()) {
      return reply.status(400).send({ code: 'VALIDATION', message: 'sedeId y nombre son requeridos' });
    }
    const sede = await prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede || !sede.activo) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Sede no encontrada' });
    }
    if (!ligaCoincideConSesion(req, sede.ligaId, reply)) return;
    if (!(await puedeAdministrarLigaCancha(req, sede.ligaId, reply))) return;

    const cancha = await prisma.cancha.create({
      data: {
        ligaId: sede.ligaId,
        sedeId: sede.id,
        nombre: nombre.trim(),
      },
    });

    return reply.status(201).send(toJsonCancha(cancha, { id: sede.id, nombre: sede.nombre }));
  });

  app.patch<{
    Params: { id: string };
    Body: { nombre?: string; activo?: boolean };
  }>('/canchas/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const req = request as AuthRequest;
    const cancha = await prisma.cancha.findUnique({ where: { id: request.params.id } });
    if (!cancha) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Cancha no encontrada' });
    if (!ligaCoincideConSesion(req, cancha.ligaId, reply)) return;
    if (!(await puedeAdministrarLigaCancha(req, cancha.ligaId, reply))) return;

    const { nombre, activo } = request.body || {};
    const data: { nombre?: string; activo?: boolean } = {};
    if (nombre !== undefined) data.nombre = nombre.trim();
    if (activo !== undefined) data.activo = activo;

    const updated = await prisma.cancha.update({
      where: { id: cancha.id },
      data,
    });

    const sedeMap = await cargarSedesPorIds(updated.sedeId ? [updated.sedeId] : []);
    const sed = updated.sedeId ? sedeMap.get(updated.sedeId) ?? null : null;
    return reply.send(toJsonCancha(updated, sed));
  });

  app.get<{ Params: { id: string } }>('/canchas/:id', { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] }, async (request, reply) => {
    const cancha = await prisma.cancha.findUnique({
      where: { id: request.params.id },
    });
    if (!cancha) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Cancha no encontrada' });
    const sedeMap = await cargarSedesPorIds(cancha.sedeId ? [cancha.sedeId] : []);
    const sed = cancha.sedeId ? sedeMap.get(cancha.sedeId) ?? null : null;
    return reply.send(toJsonCancha(cancha, sed));
  });
}
