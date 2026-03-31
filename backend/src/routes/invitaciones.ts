import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/auth.js';
import type { Rol } from '../lib/rbac.js';

type TipoInvitacion = 'organizador';

interface CrearInvitacionBody {
  ligaId: string;
  tipo: TipoInvitacion;
  // Campo opcional para desarrollo: "seedSecret" para no exponer esto en producción
  seedSecret?: string;
}

interface RegistroOrganizadorBody {
  email: string;
  password: string;
  nombre: string;
  curp?: string;
  selfieUrl?: string;
}

export async function invitacionesRoutes(app: FastifyInstance) {
  /**
   * Endpoint provisional para generar una invitación de organizador.
   *
   * - Pensado para entorno de desarrollo/simulación.
   * - Protegido por un "seedSecret" simple en el body para que no quede totalmente abierto.
   * - En el futuro, esto debería requerir un usuario superadmin autenticado.
   */
  app.post<{ Body: CrearInvitacionBody }>('/auth/invitaciones', async (request, reply) => {
    const { ligaId, tipo, seedSecret } = request.body || {};

    // Protección mínima para que no cualquiera pueda crear invitaciones en producción
    const EXPECTED_SECRET = process.env.SEED_INVITE_SECRET;
    if (!EXPECTED_SECRET || seedSecret !== EXPECTED_SECRET) {
      return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado para crear invitaciones' });
    }

    if (!ligaId || !tipo) {
      return reply.status(400).send({ code: 'VALIDATION', message: 'ligaId y tipo son requeridos' });
    }

    const liga = await prisma.liga.findUnique({ where: { id: ligaId } });
    if (!liga) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Liga no encontrada' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    const invitacion = await prisma.invitacion.create({
      data: {
        ligaId,
        tipo,
        token,
        expiresAt,
      },
    });

    return reply.send({
      id: invitacion.id,
      token: invitacion.token,
      tipo: invitacion.tipo,
      ligaId: invitacion.ligaId,
      expiresAt: invitacion.expiresAt.toISOString(),
    });
  });

  /**
   * Registro mediante invitación (por ahora solo tipo "organizador").
   *
   * Flujo:
   * - Recibe token en la URL.
   * - Verifica que exista, no esté usada y no esté expirada.
   * - Crea usuario con email + passwordHash (bcrypt).
   * - Crea MembresiaLiga con rol "admin_liga".
   * - Marca la invitación como usada.
   * - Devuelve token JWT y datos de usuario/liga (mismo formato que /auth/anotador).
   */
  app.post<{ Params: { token: string }; Body: RegistroOrganizadorBody }>(
    '/auth/invitaciones/:token/registro',
    async (request, reply) => {
      const { token } = request.params;
      const { email, password, nombre } = request.body || {};

      if (!email || !password || !nombre) {
        return reply
          .status(400)
          .send({ code: 'VALIDATION', message: 'email, password y nombre son requeridos' });
      }

      const invitacion = await prisma.invitacion.findUnique({ where: { token } });
      if (!invitacion || invitacion.usado) {
        return reply
          .status(400)
          .send({ code: 'INVALID_INVITE', message: 'Invitación inválida o ya utilizada' });
      }

      if (invitacion.expiresAt < new Date()) {
        return reply.status(400).send({ code: 'EXPIRED_INVITE', message: 'Invitación expirada' });
      }

      if (invitacion.tipo !== 'organizador') {
        return reply
          .status(400)
          .send({ code: 'UNSUPPORTED_INVITE', message: 'Tipo de invitación no soportado aún' });
      }

      const liga = await prisma.liga.findUnique({ where: { id: invitacion.ligaId } });
      if (!liga) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: 'Liga no encontrada' });
      }

      const existingUser = await prisma.usuario.findFirst({
        where: { email: email.toLowerCase() },
      });
      if (existingUser) {
        return reply
          .status(400)
          .send({ code: 'EMAIL_IN_USE', message: 'Ya existe un usuario con ese email' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const usuario = await prisma.usuario.create({
        data: {
          nombre,
          email: email.toLowerCase(),
          passwordHash,
        },
      });

      const rol: Rol = 'admin_liga';

      await prisma.membresiaLiga.create({
        data: {
          ligaId: liga.id,
          usuarioId: usuario.id,
          rol,
        },
      });

      await prisma.invitacion.update({
        where: { id: invitacion.id },
        data: { usado: true },
      });

      const tokenJwt = signToken({
        usuarioId: usuario.id,
        ligaId: liga.id,
        isSuperAdmin: usuario.isSuperAdmin,
        roles: [rol],
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
        id: usuario.id,
        ligaId: liga.id,
        nombre: usuario.nombre,
        roles: [rol],
        isSuperAdmin: usuario.isSuperAdmin,
        activo: true,
      };

      return reply.send({ token: tokenJwt, usuario: usuarioJson, liga: ligaJson });
    }
  );
}

