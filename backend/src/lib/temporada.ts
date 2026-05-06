import type { FastifyReply } from 'fastify';
import { prisma } from './prisma.js';

export type TemporadaJson = {
  id: string;
  etiqueta: string;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeTemporada(t: {
  id: string;
  etiqueta: string;
  estado: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TemporadaJson {
  return {
    id: t.id,
    etiqueta: t.etiqueta,
    estado: t.estado,
    fechaInicio: t.fechaInicio?.toISOString() ?? null,
    fechaFin: t.fechaFin?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Temporadas de una liga (más reciente primero). */
export async function listTemporadasByLiga(ligaId: string) {
  return prisma.temporada.findMany({
    where: { ligaId },
    orderBy: { createdAt: 'desc' },
  });
}

/** Primera temporada `activa`; si no hay, la más reciente. */
export async function temporadaActivaPreferida(ligaId: string) {
  const activas = await prisma.temporada.findMany({
    where: { ligaId, estado: 'activa' },
    orderBy: { createdAt: 'desc' },
  });
  if (activas.length > 0) return activas[0];
  return prisma.temporada.findFirst({
    where: { ligaId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function defaultTemporadaActivaId(ligaId: string): Promise<string | null> {
  const t = await temporadaActivaPreferida(ligaId);
  return t?.id ?? null;
}

/**
 * Resuelve temporada para filtros de API: query explícita o temporada activa por defecto.
 * Si `reply` se pasa y hay error, envía respuesta y devuelve null.
 */
export async function resolveTemporadaIdForLiga(
  ligaId: string,
  temporadaIdQuery: string | undefined,
  reply?: FastifyReply
): Promise<string | null> {
  if (temporadaIdQuery?.trim()) {
    const t = await prisma.temporada.findFirst({
      where: { id: temporadaIdQuery.trim(), ligaId },
    });
    if (!t) {
      if (reply) {
        await reply.status(400).send({
          code: 'TEMPORADA_INVALIDA',
          message: 'temporadaId no existe en esta liga',
        });
      }
      return null;
    }
    return t.id;
  }
  const id = await defaultTemporadaActivaId(ligaId);
  if (!id && reply) {
    await reply.status(400).send({
      code: 'SIN_TEMPORADA',
      message: 'La liga no tiene temporadas. Crea una desde administración.',
    });
  }
  return id;
}

export async function payloadTemporadasParaLiga(ligaId: string) {
  const rows = await listTemporadasByLiga(ligaId);
  const activa = await temporadaActivaPreferida(ligaId);
  return {
    temporadas: rows.map(serializeTemporada),
    temporadaActiva: activa ? serializeTemporada(activa) : null,
  };
}

/** Respuesta API de liga + lista de temporadas (compat: campo `temporada` = etiqueta activa). */
export async function ligaJsonWithTemporadas(liga: {
  id: string;
  nombre: string;
  deporte: string;
  categorias: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { temporadas, temporadaActiva } = await payloadTemporadasParaLiga(liga.id);
  const categorias = JSON.parse(liga.categorias || '[]') as string[];
  return {
    id: liga.id,
    nombre: liga.nombre,
    deporte: liga.deporte,
    categorias,
    createdAt: liga.createdAt.toISOString(),
    updatedAt: liga.updatedAt.toISOString(),
    temporadas,
    temporadaActiva,
    temporada: temporadaActiva?.etiqueta ?? '',
  };
}
