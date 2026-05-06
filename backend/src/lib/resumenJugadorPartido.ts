import { prisma } from './prisma.js';
import { deriveBackendMatchState } from './matchDomain.js';

const ESTADOS_CON_RESUMEN = ['finalizado', 'default_local', 'default_visitante'] as const;

/**
 * Regenera filas ResumenJugadorPartido para un partido ya cerrado.
 * Idempotente. Los Evento siguen siendo la fuente de verdad; esto acelera historiales y totales por CURP.
 */
export async function syncResumenesPartido(partidoId: string): Promise<void> {
  const partido = await prisma.partido.findUnique({
    where: { id: partidoId },
    include: { plantilla: true, eventos: { orderBy: { orden: 'asc' } } },
  });
  if (!partido) return;
  if (!ESTADOS_CON_RESUMEN.includes(partido.estado as (typeof ESTADOS_CON_RESUMEN)[number])) return;

  await prisma.resumenJugadorPartido.deleteMany({ where: { partidoId } });

  const jugadorIds = [...new Set(partido.plantilla.map((p) => p.jugadorId))];
  if (jugadorIds.length === 0) return;

  const jugadores = await prisma.jugador.findMany({
    where: { id: { in: jugadorIds } },
    select: { id: true, personaId: true },
  });
  const personaPorJugador = Object.fromEntries(jugadores.map((j) => [j.id, j.personaId]));

  const domainState = deriveBackendMatchState(partido);

  const plantillaPorJugador = new Map<string, (typeof partido.plantilla)[0]>();
  for (const pl of partido.plantilla) {
    if (!plantillaPorJugador.has(pl.jugadorId)) plantillaPorJugador.set(pl.jugadorId, pl);
  }

  const rows: {
    partidoId: string;
    jugadorId: string;
    personaId: string | null;
    equipoId: string;
    puntos: number;
    canastasDe2: number;
    canastasDe3: number;
    tirosLibresAnotados: number;
    faltas: number;
    asistencias: number;
    minutosJugados: null;
  }[] = [];

  for (const jid of jugadorIds) {
    const pl = plantillaPorJugador.get(jid);
    if (!pl) continue;
    const player = domainState.players[jid];
    const asistencias = partido.eventos.filter(
      (e) => e.jugadorId === jid && e.tipo === 'assist'
    ).length;
    rows.push({
      partidoId,
      jugadorId: jid,
      personaId: personaPorJugador[jid] ?? null,
      equipoId: pl.equipoId,
      puntos: player?.points ?? 0,
      canastasDe2: player?.fieldGoals2Made ?? 0,
      canastasDe3: player?.fieldGoals3Made ?? 0,
      tirosLibresAnotados: player?.freeThrowsMade ?? 0,
      faltas: player?.totalFoulsForDisplay ?? 0,
      asistencias,
      minutosJugados: null,
    });
  }

  if (rows.length > 0) {
    await prisma.resumenJugadorPartido.createMany({ data: rows });
  }
}
