import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';
import type { Rol } from './rbac.js';


const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface JwtPayload {
  usuarioId: string;
  ligaId: string;
  isSuperAdmin: boolean;
  roles: Rol[];
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export type AuthRequest = FastifyRequest & {
  usuarioId: string;
  ligaId: string;
  isSuperAdmin: boolean;
  roles: Rol[];
};

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    await reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Token requerido' });
    return;
  }
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    await reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Token inválido' });
    return;
  }
  const req = request as AuthRequest;
  req.usuarioId = payload.usuarioId;
  req.ligaId = payload.ligaId;
  req.isSuperAdmin = payload.isSuperAdmin;
  req.roles = payload.roles || [];
}

/**
 * Verifica que el usuario tenga membresía activa en la liga (o sea superadmin).
 * Carga los roles desde la BD si no están en el token o si ligaId viene de params.
 */
export async function ensureMembership(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const req = request as AuthRequest;
  if (!req.usuarioId) {
    await reply.status(401).send({ code: 'UNAUTHORIZED', message: 'No autenticado' });
    return;
  }
  if (req.isSuperAdmin) return;

  // Importante: NO asumir que `params.id` es `ligaId`.
  // Muchas rutas usan `:id` para otras entidades (jugadorId, partidoId, etc.).
  const params = request.params as Record<string, unknown> | undefined;
  const query = request.query as Record<string, unknown> | undefined;
  const body = request.body as Record<string, unknown> | undefined;

  const ligaId =
    (typeof params?.ligaId === 'string' ? (params.ligaId as string) : undefined) ||
    (typeof query?.ligaId === 'string' ? (query.ligaId as string) : undefined) ||
    (typeof body?.ligaId === 'string' ? (body.ligaId as string) : undefined) ||
    req.ligaId;

  if (!ligaId) {
    await reply.status(400).send({ code: 'VALIDATION', message: 'ligaId es requerido' });
    return;
  }

  const membresia = await prisma.membresiaLiga.findFirst({
    where: { ligaId, usuarioId: req.usuarioId, activo: true },
  });
  if (!membresia) {
    await reply.status(403).send({ code: 'FORBIDDEN', message: 'No tienes membresía en esta liga' });
    return;
  }

  req.ligaId = ligaId;
  req.roles = [membresia.rol as Rol];
}

/**
 * Requiere al menos uno de los roles indicados (o superadmin).
 */
export function requireRole(...allowedRoles: Rol[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const req = request as AuthRequest;
    if (req.isSuperAdmin) return;
    const hasRole = req.roles?.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      await reply.status(403).send({
        code: 'FORBIDDEN',
        message: `Se requiere uno de los roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }
  };
}
