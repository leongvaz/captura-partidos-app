import type { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import type { AuthRequest } from '../lib/auth.js';
import { ligaCoincideConSesion } from '../lib/ligaSesion.js';

async function puedeAdministrarLiga(
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
    await reply.status(403).send({ code: 'FORBIDDEN', message: 'Solo el organizador de la liga puede gestionar sedes' });
    return false;
  }
  return true;
}

export async function sedesRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { ligaId: string } }>(
    '/sedes',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const req = request as AuthRequest;
      const { ligaId } = request.query;
      if (!ligaId) {
        return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId es requerido' });
      }
      if (!ligaCoincideConSesion(req, ligaId, reply)) return;
      if (!(await puedeAdministrarLiga(req, ligaId, reply))) return;

      const sedes = await prisma.sede.findMany({
        where: { ligaId, activo: true },
        include: {
          canchas: {
            where: { activo: true },
            orderBy: { nombre: 'asc' },
          },
        },
        orderBy: { nombre: 'asc' },
      });

      return reply.send(
        sedes.map((s) => ({
          id: s.id,
          ligaId: s.ligaId,
          nombre: s.nombre,
          activo: s.activo,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          canchas: s.canchas.map((c) => ({
            id: c.id,
            ligaId: c.ligaId,
            sedeId: c.sedeId,
            nombre: c.nombre,
            activo: c.activo,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
          })),
        }))
      );
    }
  );

  app.post<{
    Body: { ligaId: string; nombre: string };
  }>('/sedes', { preHandler: [app.authenticate] }, async (request, reply) => {
    const req = request as AuthRequest;
    const { ligaId, nombre } = request.body || {};
    if (!ligaId || !nombre?.trim()) {
      return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId y nombre son requeridos' });
    }
    if (!ligaCoincideConSesion(req, ligaId, reply)) return;
    if (!(await puedeAdministrarLiga(req, ligaId, reply))) return;

    const liga = await prisma.liga.findUnique({ where: { id: ligaId } });
    if (!liga) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Liga no encontrada' });
    }

    const sede = await prisma.sede.create({
      data: { ligaId, nombre: nombre.trim() },
    });

    return reply.status(201).send({
      id: sede.id,
      ligaId: sede.ligaId,
      nombre: sede.nombre,
      activo: sede.activo,
      createdAt: sede.createdAt.toISOString(),
      updatedAt: sede.updatedAt.toISOString(),
      canchas: [],
    });
  });

  app.patch<{
    Params: { id: string };
    Body: { nombre?: string; activo?: boolean };
  }>('/sedes/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const req = request as AuthRequest;
    const sede = await prisma.sede.findUnique({ where: { id: request.params.id } });
    if (!sede) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Sede no encontrada' });
    }
    if (!ligaCoincideConSesion(req, sede.ligaId, reply)) return;
    if (!(await puedeAdministrarLiga(req, sede.ligaId, reply))) return;

    const { nombre, activo } = request.body || {};
    const data: { nombre?: string; activo?: boolean } = {};
    if (nombre !== undefined) data.nombre = nombre.trim();
    if (activo !== undefined) data.activo = activo;
    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ code: 'VALIDATION', message: 'Sin cambios' });
    }

    const updated =
      activo === false
        ? await prisma.$transaction(async (tx) => {
            const u = await tx.sede.update({ where: { id: sede.id }, data });
            await tx.cancha.updateMany({
              where: { sedeId: sede.id },
              data: { activo: false },
            });
            return u;
          })
        : await prisma.sede.update({
            where: { id: sede.id },
            data,
          });

    return reply.send({
      id: updated.id,
      ligaId: updated.ligaId,
      nombre: updated.nombre,
      activo: updated.activo,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  });
}
