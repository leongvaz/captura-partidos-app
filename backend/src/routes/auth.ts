import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/auth.js';

interface AuthBody {
  ligaId: string;
  pin: string;
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: AuthBody }>('/auth/anotador', async (request, reply) => {
    const { ligaId, pin } = request.body || {};
    if (!ligaId || !pin) {
      return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId y pin son requeridos' });
    }

    const liga = await prisma.liga.findUnique({ where: { id: ligaId } });
    if (!liga) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Liga o PIN incorrectos' });
    }

    const membresias = await prisma.membresiaLiga.findMany({
      where: { ligaId, activo: true },
      include: { usuario: true },
    });

    const byUsuario = new Map<
      string,
      { usuario: { id: string; nombre: string; pinHash: string | null; isSuperAdmin: boolean }; roles: string[] }
    >();
    for (const m of membresias) {
      if (!byUsuario.has(m.usuarioId)) {
        byUsuario.set(m.usuarioId, { usuario: m.usuario, roles: [] });
      }
      byUsuario.get(m.usuarioId)!.roles.push(m.rol);
    }

    let usuarioEncontrado: { id: string; nombre: string; pinHash: string | null; isSuperAdmin: boolean } | null = null;
    let roles: string[] = [];

    for (const { usuario, roles: r } of byUsuario.values()) {
      if (usuario.activo && usuario.pinHash) {
        const ok = await bcrypt.compare(pin, usuario.pinHash);
        if (ok) {
          usuarioEncontrado = usuario;
          roles = [...new Set(r)];
          break;
        }
      }
    }

    if (!usuarioEncontrado) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Liga o PIN incorrectos' });
    }

    const token = signToken({
      usuarioId: usuarioEncontrado.id,
      ligaId,
      isSuperAdmin: usuarioEncontrado.isSuperAdmin,
      roles: roles as import('../lib/rbac.js').Rol[],
    });

    const ligaJson = {
      id: liga.id,
      nombre: liga.nombre,
      temporada: liga.temporada,
      categorias: JSON.parse(liga.categorias || '[]'),
      createdAt: liga.createdAt.toISOString(),
      updatedAt: liga.updatedAt.toISOString(),
    };

    const usuarioJson = {
      id: usuarioEncontrado.id,
      ligaId,
      nombre: usuarioEncontrado.nombre,
      roles,
      isSuperAdmin: usuarioEncontrado.isSuperAdmin,
      activo: true,
    };

    return reply.send({ token, usuario: usuarioJson, liga: ligaJson });
  });
}
