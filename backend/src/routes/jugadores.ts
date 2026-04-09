import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole, ensureMembership, type AuthRequest } from '../lib/auth.js';

function puedeGestionarEquipo(
  req: AuthRequest,
  equipo: { ligaId: string; duenoId: string | null }
): boolean {
  if (equipo.ligaId !== req.ligaId) return false;
  if (req.roles?.includes('admin_liga')) return true;
  if (req.roles?.includes('capturista_roster') && equipo.duenoId === req.usuarioId) return true;
  return false;
}
import { ROLES_LECTURA_ROSTER } from '../lib/rbac.js';
import { validarCurpBasica, datosDesdeCurp } from '../lib/curp.js';
import { ensurePersonaPorCurp } from '../lib/persona.js';

export async function jugadoresRoutes(app: FastifyInstance) {
  function obtenerRamaDesdeCategoria(categoria: string | null | undefined):
    | 'varonil'
    | 'femenil'
    | 'mixta'
    | 'veteranos'
    | 'infantil'
    | null {
    if (!categoria) return null;
    const tokens = categoria
      .toLowerCase()
      .split(/[:\s-]+/g)
      .map((t) => t.trim())
      .filter(Boolean);
    const ramas = ['varonil', 'femenil', 'mixta', 'veteranos', 'infantil'] as const;
    for (const r of ramas) {
      if (tokens.includes(r)) return r;
    }
    return null;
  }

  function normalizarCurpToken(valor: string): string {
    const upper = (valor || '').toUpperCase().trim();
    // quitar acentos/diacríticos
    const sinAcentos = upper.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // dejar solo letras (A-Z) y Ñ (por si viene), y espacios para tokenizar
    return sinAcentos.replace(/[^A-ZÑ\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function inicialApellidoPaterno(apellidoPaterno: string): string {
    const s = normalizarCurpToken(apellidoPaterno);
    if (!s) return 'X';
    const first = s[0];
    // en CURP, Ñ suele representarse como X
    if (first === 'Ñ') return 'X';
    return first;
  }

  function primeraVocalInterna(apellidoPaterno: string): string {
    const s = normalizarCurpToken(apellidoPaterno);
    const vocales = new Set(['A', 'E', 'I', 'O', 'U']);
    for (let i = 1; i < s.length; i++) {
      const c = s[i];
      if (vocales.has(c)) return c;
    }
    return 'X';
  }

  function inicialApellidoMaterno(apellidoMaterno: string): string {
    const s = normalizarCurpToken(apellidoMaterno);
    if (!s) return 'X';
    const first = s[0];
    if (first === 'Ñ') return 'X';
    return first;
  }

  function inicialNombre(nombre: string): string {
    const s = normalizarCurpToken(nombre);
    if (!s) return 'X';
    const tokens = s.split(' ').filter(Boolean);
    if (!tokens.length) return 'X';
    // Reglas comunes CURP: ignorar "JOSE"/"MARIA" si hay otro nombre
    const first = tokens[0];
    const segundo = tokens[1];
    const candidato =
      (first === 'JOSE' || first === 'MARIA') && segundo ? segundo : first;
    const c0 = candidato[0];
    if (!c0) return 'X';
    if (c0 === 'Ñ') return 'X';
    return c0;
  }

  function validarNombreContraCurp(input: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    curp: string;
  }): { ok: true } | { ok: false; message: string } {
    const curp = (input.curp || '').toUpperCase().trim();
    if (curp.length < 4) {
      return { ok: false, message: 'La CURP no tiene un formato válido.' };
    }
    const esperado =
      inicialApellidoPaterno(input.apellidoPaterno) +
      primeraVocalInterna(input.apellidoPaterno) +
      inicialApellidoMaterno(input.apellidoMaterno) +
      inicialNombre(input.nombre);
    const actual = curp.slice(0, 4);
    if (esperado !== actual) {
      return {
        ok: false,
        message:
          'La CURP no coincide con el nombre y apellidos capturados. Revisa que estén correctos.',
      };
    }
    return { ok: true };
  }

  app.get<{ Querystring: { equipoId?: string } }>(
    '/jugadores',
    { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] },
    async (request, reply) => {
      const equipoId = request.query.equipoId;
      if (!equipoId) return reply.status(400).send({ code: 'VALIDATION', message: 'equipoId es requerido' });
      const list = await prisma.jugador.findMany({
        where: { equipoId, activo: true },
        orderBy: { numero: 'asc' },
      });
      return reply.send(
        list.map((j) => ({
          id: j.id,
          equipoId: j.equipoId,
          nombre: j.nombre,
          apellido: j.apellido,
          numero: j.numero,
          curp: j.curp,
          invitado: j.invitado,
          activo: j.activo,
          createdAt: j.createdAt.toISOString(),
          updatedAt: j.updatedAt.toISOString(),
        }))
      );
    }
  );

  app.get<{ Params: { id: string } }>(
    '/jugadores/:id',
    { preHandler: [app.authenticate, requireRole(...ROLES_LECTURA_ROSTER)] },
    async (request, reply) => {
    const jugador = await prisma.jugador.findUnique({ where: { id: request.params.id } });
    if (!jugador) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Jugador no encontrado' });
    return reply.send({
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
    });
    }
  );

  // Alta de jugador por capitán, solo en sus propios equipos
  app.post<{
    Body: {
      equipoId: string;
      nombre: string;
      apellidoPaterno: string;
      apellidoMaterno?: string;
      numero: number;
      curp: string;
    };
  }>(
    '/jugadores',
    { preHandler: [app.authenticate, ensureMembership, requireRole('admin_liga', 'capturista_roster')] },
    async (request, reply) => {
      const req = request as AuthRequest;
      const { equipoId, nombre, apellidoPaterno, apellidoMaterno, numero, curp } = request.body || {};
      if (
        !equipoId ||
        !nombre ||
        !apellidoPaterno ||
        !apellidoMaterno ||
        numero === undefined ||
        numero === null ||
        !curp
      ) {
        return reply.status(400).send({
          code: 'VALIDATION',
          message: 'equipoId, nombre, apellidoPaterno, apellidoMaterno, numero y curp son requeridos',
        });
      }

      const equipo = await prisma.equipo.findUnique({ where: { id: equipoId } });
      if (!equipo || !puedeGestionarEquipo(req, equipo)) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'No puedes registrar jugadores en este equipo',
        });
      }

      // Respetar límite de jugadores por equipo si la liga tiene reglas configuradas
      const liga = await prisma.liga.findUnique({ where: { id: equipo.ligaId } });
      let maxJugadores = 15;
      if (liga) {
        try {
          const cfg = JSON.parse(liga.reglasConfig || '{}') as { maxJugadoresPorEquipo?: number };
          if (cfg.maxJugadoresPorEquipo && cfg.maxJugadoresPorEquipo > 0) {
            maxJugadores = cfg.maxJugadoresPorEquipo;
          }
        } catch {
          // ignorar error de parseo
        }
      }

      const count = await prisma.jugador.count({ where: { equipoId, activo: true } });
      if (count >= maxJugadores) {
        return reply.status(400).send({
          code: 'EQUIPO_LLENO',
          message: `Este equipo ya alcanzó el máximo de ${maxJugadores} jugadores activos.`,
        });
      }

      if (numero < 0 || numero > 999) {
        return reply.status(400).send({
          code: 'NUMERO_FUERA_DE_RANGO',
          message: 'El número de jugador debe estar entre 0 y 999.',
        });
      }

      // Evitar números repetidos dentro del mismo equipo
      const numeroExistente = await prisma.jugador.findFirst({
        where: { equipoId, numero },
      });
      if (numeroExistente?.activo) {
        return reply.status(400).send({
          code: 'NUMERO_DUPLICADO',
          message: 'Ese número ya está asignado a otro jugador de este equipo.',
        });
      }

      const curpTrim = curp.trim().toUpperCase();
      const validCurp = validarCurpBasica(curpTrim);
      if (!validCurp.ok) {
        return reply.status(400).send({
          code: 'CURP_INVALID',
          message: validCurp.mensaje || 'La CURP no es válida.',
        });
      }

      // Evitar que una persona (CURP) se registre en más de un equipo dentro de la misma liga/temporada.
      // Nota: esto considera solo jugadores activos.
      const jugadorConCurpEnLiga = await prisma.jugador.findFirst({
        where: {
          curp: curpTrim,
          activo: true,
          equipo: { ligaId: req.ligaId },
          ...(numeroExistente?.id ? { NOT: { id: numeroExistente.id } } : {}),
        },
        include: { equipo: true },
      });
      if (jugadorConCurpEnLiga) {
        return reply.status(400).send({
          code: 'CURP_YA_REGISTRADA',
          message:
            `Esta CURP ya está registrada en otro equipo de la liga (${jugadorConCurpEnLiga.equipo?.nombre || 'equipo'}).`,
        });
      }

      // Validar que la CURP corresponda a nombre y apellidos (primeros 4 caracteres)
      const nombreVsCurp = validarNombreContraCurp({
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        curp: curpTrim,
      });
      if (!nombreVsCurp.ok) {
        return reply.status(400).send({
          code: 'CURP_NO_COINCIDE_NOMBRE',
          message: nombreVsCurp.message,
        });
      }

      const apellido = apellidoMaterno
        ? `${apellidoPaterno} ${apellidoMaterno}`.trim()
        : apellidoPaterno;

      const { sexo, fechaNacimiento, edad } = datosDesdeCurp(curpTrim);

      // Reglas por rama (derivada de la categoría del equipo)
      const rama = obtenerRamaDesdeCategoria(equipo.categoria);

      // +13 años en ramas competitivas (varonil/femenil; y por ahora también mixta)
      if (rama === 'varonil' || rama === 'femenil' || rama === 'mixta') {
        if (edad < 13) {
          return reply.status(400).send({
            code: 'EDAD_NO_PERMITIDA',
            message: 'La persona jugadora debe tener al menos 13 años para registrarse en esta liga.',
          });
        }
      }

      if (rama === 'varonil' && sexo !== 'H') {
        return reply.status(400).send({
          code: 'CURP_SEXO_NO_PERMITIDO',
          message: 'Este equipo es varonil; la CURP debe corresponder a sexo H.',
        });
      }
      if (rama === 'femenil' && sexo !== 'M') {
        return reply.status(400).send({
          code: 'CURP_SEXO_NO_PERMITIDO',
          message: 'Solo se pueden inscribir jugadoras.',
        });
      }

      const personaId = await ensurePersonaPorCurp({
        curp: curpTrim,
        nombre,
        apellido,
        sexo,
        fechaNacimiento,
      });

      // Si existía un jugador con ese número pero estaba inactivo, lo "revivimos"
      const jugador = numeroExistente && !numeroExistente.activo
        ? await prisma.jugador.update({
            where: { id: numeroExistente.id },
            data: {
              activo: true,
              nombre,
              apellido,
              curp: curpTrim,
              sexo,
              fechaNacimiento,
              invitado: false,
              personaId,
            },
          })
        : await prisma.jugador.create({
            data: {
              equipoId,
              personaId,
              nombre,
              apellido,
              numero,
              curp: curpTrim,
              sexo,
              fechaNacimiento,
            },
          });

      return reply.send({
        id: jugador.id,
        equipoId: jugador.equipoId,
        personaId: jugador.personaId,
        nombre: jugador.nombre,
        apellido: jugador.apellido,
        numero: jugador.numero,
        curp: jugador.curp,
        invitado: jugador.invitado,
        activo: jugador.activo,
        createdAt: jugador.createdAt.toISOString(),
        updatedAt: jugador.updatedAt.toISOString(),
      });
    }
  );

  // Edición de jugador por capitán (solo en sus equipos)
  app.put<{
    Params: { id: string };
    Body: { nombre: string; apellidoPaterno: string; apellidoMaterno?: string; numero: number };
  }>(
    '/jugadores/:id',
    { preHandler: [app.authenticate, ensureMembership, requireRole('admin_liga', 'capturista_roster')] },
    async (request, reply) => {
      const req = request as AuthRequest;
      const { id } = request.params;
      const { nombre, apellidoPaterno, apellidoMaterno, numero } = request.body || {};

      if (!nombre || !apellidoPaterno || numero === undefined || numero === null) {
        return reply.status(400).send({
          code: 'VALIDATION',
          message: 'nombre, apellidoPaterno y numero son requeridos',
        });
      }

      const jugador = await prisma.jugador.findUnique({ where: { id }, include: { equipo: true } });
      if (!jugador || !jugador.equipo || !puedeGestionarEquipo(req, jugador.equipo)) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'No puedes editar jugadores de este equipo',
        });
      }

      if (numero < 0 || numero > 999) {
        return reply.status(400).send({
          code: 'NUMERO_FUERA_DE_RANGO',
          message: 'El número de jugador debe estar entre 0 y 999.',
        });
      }

      const numeroExistente = await prisma.jugador.findFirst({
        where: { equipoId: jugador.equipoId, numero, activo: true, NOT: { id } },
      });
      if (numeroExistente) {
        return reply.status(400).send({
          code: 'NUMERO_DUPLICADO',
          message: 'Ese número ya está asignado a otro jugador de este equipo.',
        });
      }

      const apellido = apellidoMaterno
        ? `${apellidoPaterno} ${apellidoMaterno}`.trim()
        : apellidoPaterno;

      const actualizado = await prisma.jugador.update({
        where: { id },
        data: {
          nombre,
          apellido,
          numero,
        },
      });

      return reply.send({
        id: actualizado.id,
        equipoId: actualizado.equipoId,
        nombre: actualizado.nombre,
        apellido: actualizado.apellido,
        numero: actualizado.numero,
        curp: actualizado.curp,
        invitado: actualizado.invitado,
        activo: actualizado.activo,
        createdAt: actualizado.createdAt.toISOString(),
        updatedAt: actualizado.updatedAt.toISOString(),
      });
    }
  );

  // Eliminación (baja lógica) de jugador por capitán
  app.delete<{ Params: { id: string } }>(
    '/jugadores/:id',
    { preHandler: [app.authenticate, ensureMembership, requireRole('admin_liga', 'capturista_roster')] },
    async (request, reply) => {
      const req = request as AuthRequest;
      const { id } = request.params;

      const jugador = await prisma.jugador.findUnique({ where: { id }, include: { equipo: true } });
      if (!jugador || !jugador.equipo || !puedeGestionarEquipo(req, jugador.equipo)) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'No puedes eliminar jugadores de este equipo',
        });
      }

      const actualizado = await prisma.jugador.update({
        where: { id },
        data: { activo: false },
      });

      return reply.send({
        id: actualizado.id,
        equipoId: actualizado.equipoId,
        nombre: actualizado.nombre,
        apellido: actualizado.apellido,
        numero: actualizado.numero,
        curp: actualizado.curp,
        invitado: actualizado.invitado,
        activo: actualizado.activo,
        createdAt: actualizado.createdAt.toISOString(),
        updatedAt: actualizado.updatedAt.toISOString(),
      });
    }
  );
}
