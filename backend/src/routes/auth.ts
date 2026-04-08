import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/auth.js';
import { validarCurpBasica } from '../lib/curp.js';
import { normalizarNombrePropio } from '../lib/nombres.js';

interface AuthBody {
  ligaId: string;
  pin: string;
}

export async function authRoutes(app: FastifyInstance) {
  // Login de anotador por PIN (flujo actual)
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
      curp: (usuarioEncontrado as any).curp ?? null,
    };

    return reply.send({ token, usuario: usuarioJson, liga: ligaJson });
  });

  // Registro sencillo de organizador de liga (Imelda, etc.)
  app.post<{
    Body: {
      ligaId: string;
      email: string;
      password: string;
      pin: string;
      nombre: string;
      apellidoPaterno?: string;
      apellidoMaterno?: string;
      curp?: string;
    };
  }>('/auth/organizador/registro', async (request, reply) => {
    const { ligaId, email, password, pin, nombre, curp } = request.body || {};
    if (!ligaId || !email || !password || !pin || !nombre || !curp) {
      return reply.status(400).send({
        code: 'VALIDATION',
        message: 'ligaId, email, password, pin, nombre y curp son requeridos',
      });
    }

    const liga = await prisma.liga.findUnique({ where: { id: ligaId } });
    if (!liga) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Liga no encontrada' });
    }

    // No permitir más de un organizador por liga usando este flujo
    const yaTieneOrganizador = await prisma.membresiaLiga.findFirst({
      where: { ligaId, rol: 'admin_liga', activo: true },
    });
    if (yaTieneOrganizador) {
      return reply.status(409).send({
        code: 'LIGA_ALREADY_HAS_ORGANIZER',
        message: 'Esta liga ya tiene una persona organizadora registrada',
      });
    }

    const existingByEmail = await prisma.usuario.findFirst({
      where: { email: email.toLowerCase() },
    });
    if (existingByEmail) {
      return reply
        .status(400)
        .send({ code: 'EMAIL_IN_USE', message: 'Ya existe un usuario con ese email' });
    }

    const curpNormalizada = curp.toUpperCase().trim();
    const validCurp = validarCurpBasica(curpNormalizada);
    if (!validCurp.ok) {
      return reply.status(400).send({
        code: 'CURP_INVALID',
        message: validCurp.mensaje ?? 'La CURP no es válida.',
      });
    }

    const existingCurpOrganizador = await prisma.usuario.findFirst({
      where: { curp: curpNormalizada },
    });
    if (existingCurpOrganizador) {
      return reply.status(400).send({
        code: 'CURP_IN_USE',
        message: 'Ya existe una cuenta registrada con esta CURP. Usa esa cuenta para administrar ligas.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const pinHash = await bcrypt.hash(pin, 8);

    const usuario = await prisma.usuario.create({
      data: {
        nombre: normalizarNombrePropio(nombre),
        email: email.toLowerCase(),
        passwordHash,
        pinHash,
        curp: curpNormalizada,
      },
    });

    const rol: import('../lib/rbac.js').Rol = 'admin_liga';

    await prisma.membresiaLiga.create({
      data: {
        ligaId: liga.id,
        usuarioId: usuario.id,
        rol,
      },
    });

    const token = signToken({
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
      curp: usuario.curp,
    };

    return reply.send({ token, usuario: usuarioJson, liga: ligaJson });
  });

  // Login por email + password o PIN (para organizadores / usuarios web)
  app.post<{
    Body: { email: string; passwordOrPin: string };
  }>('/auth/login-email', async (request, reply) => {
    const { email, passwordOrPin } = request.body || {};
    if (!email || !passwordOrPin) {
      return reply
        .status(400)
        .send({ code: 'VALIDATION', message: 'email y passwordOrPin son requeridos' });
    }

    const usuario = await prisma.usuario.findFirst({
      where: { email: email.toLowerCase(), activo: true },
      include: { membresias: true },
    });
    if (!usuario) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Credenciales incorrectas' });
    }

    let ok = false;
    if (usuario.passwordHash) {
      ok = await bcrypt.compare(passwordOrPin, usuario.passwordHash);
    }
    if (!ok && usuario.pinHash) {
      ok = await bcrypt.compare(passwordOrPin, usuario.pinHash);
    }
    if (!ok) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Credenciales incorrectas' });
    }

    const membresiasActivas = usuario.membresias.filter((m) => m.activo);

    let ligaId: string;
    let roles: string[] = [];
    let ligaJson:
      | {
          id: string;
          nombre: string;
          temporada: string;
          categorias: string[];
          createdAt: string;
          updatedAt: string;
        }
      | null = null;

    if (membresiasActivas.length === 0) {
      if (!usuario.isSuperAdmin) {
        return reply
          .status(403)
          .send({ code: 'FORBIDDEN', message: 'No tienes ligas asignadas actualmente' });
      }

      // Modo superadmin sin liga asociada: usamos un identificador especial
      ligaId = 'superadmin';
      roles = [];
      ligaJson = {
        id: 'superadmin',
        nombre: 'Modo superadmin',
        temporada: '',
        categorias: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Por ahora tomamos la primera liga activa; en el futuro se puede elegir.
      const m = membresiasActivas[0];
      const liga = await prisma.liga.findUnique({ where: { id: m.ligaId } });
      if (!liga) {
        return reply
          .status(404)
          .send({ code: 'NOT_FOUND', message: 'Liga asociada no encontrada' });
      }

      ligaId = liga.id;
      roles = membresiasActivas.filter((mm) => mm.ligaId === liga.id).map((mm) => mm.rol);
      ligaJson = {
        id: liga.id,
        nombre: liga.nombre,
        temporada: liga.temporada,
        categorias: JSON.parse(liga.categorias || '[]'),
        createdAt: liga.createdAt.toISOString(),
        updatedAt: liga.updatedAt.toISOString(),
      };
    }

    const token = signToken({
      usuarioId: usuario.id,
      ligaId,
      isSuperAdmin: usuario.isSuperAdmin,
      roles: roles as import('../lib/rbac.js').Rol[],
    });

    const usuarioJson = {
      id: usuario.id,
      ligaId,
      nombre: usuario.nombre,
      roles,
      isSuperAdmin: usuario.isSuperAdmin,
      activo: usuario.activo,
      curp: usuario.curp,
    };

    return reply.send({ token, usuario: usuarioJson, liga: ligaJson });
  });

  // Registro de usuario "capitán" para inscripción de equipos
  app.post<{
    Body: { ligaId: string; email: string; password: string; nombre: string; curp: string };
  }>('/auth/registro-capitan', async (request, reply) => {
    const { ligaId, email, password, nombre, curp } = request.body || {};
    if (!ligaId || !email || !password || !nombre || !curp) {
      return reply.status(400).send({
        code: 'VALIDATION',
        message: 'ligaId, email, password, nombre y curp son requeridos',
      });
    }

    const liga = await prisma.liga.findUnique({ where: { id: ligaId } });
    if (!liga) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Liga no encontrada' });
    }

    const existingByEmail = await prisma.usuario.findFirst({
      where: { email: email.toLowerCase() },
      include: { membresias: true },
    });
    if (existingByEmail) {
      const tieneRolOrganizadorOAnotador = existingByEmail.membresias.some(
        (m) =>
          m.ligaId === ligaId &&
          (m.rol === 'admin_liga' || m.rol === 'anotador_partido') &&
          m.activo
      );
      if (tieneRolOrganizadorOAnotador) {
        return reply.status(400).send({
          code: 'EMAIL_ES_ORGANIZADOR_O_ANOTADOR',
          message:
            'Este correo ya está registrado como organizador/anotador. Inicia sesión con esa cuenta para registrar equipos.',
        });
      }
      return reply
        .status(400)
        .send({ code: 'EMAIL_IN_USE', message: 'Ya existe un usuario con ese email' });
    }

    const curpNormalizada = curp.toUpperCase().trim();
    const validCurp = validarCurpBasica(curpNormalizada);
    if (!validCurp.ok) {
      return reply.status(400).send({
        code: 'CURP_INVALID',
        message: validCurp.mensaje ?? 'La CURP no es válida.',
      });
    }

    const existingByCurp = await prisma.usuario.findFirst({
      where: { curp: curpNormalizada },
    });
    if (existingByCurp) {
      return reply.status(400).send({
        code: 'CURP_IN_USE',
        message:
          'Ya existe una cuenta registrada con esta CURP. Usa esa cuenta para registrar equipos.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email: email.toLowerCase(),
        passwordHash,
        curp: curpNormalizada,
      },
    });

    const rol: import('../lib/rbac.js').Rol = 'capturista_roster';

    await prisma.membresiaLiga.create({
      data: {
        ligaId: liga.id,
        usuarioId: usuario.id,
        rol,
      },
    });

    const token = signToken({
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

    return reply.send({ token, usuario: usuarioJson, liga: ligaJson });
  });
}
