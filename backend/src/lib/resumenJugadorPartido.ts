import { prisma } from './prisma.js';

const FALTA_TIPOS = ['falta_personal', 'falta_tecnica', 'falta_antideportiva'] as const;

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

  type Acum = { p2: number; p3: number; tl: number; faltas: number };
  const stats: Record<string, Acum> = {};
  for (const jid of jugadorIds) stats[jid] = { p2: 0, p3: 0, tl: 0, faltas: 0 };

  if (partido.estado === 'finalizado') {
    for (const e of partido.eventos) {
      const j = e.jugadorId;
      if (!stats[j]) continue;
      if (e.tipo === 'punto_2') stats[j].p2++;
      else if (e.tipo === 'punto_3') stats[j].p3++;
      else if (e.tipo === 'tiro_libre_anotado') stats[j].tl++;
      else if (FALTA_TIPOS.includes(e.tipo as (typeof FALTA_TIPOS)[number])) stats[j].faltas++;
    }
    for (const j of Object.keys(stats)) {
      stats[j].faltas = Math.min(5, stats[j].faltas);
    }
  }

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
    minutosJugados: null;
  }[] = [];

  for (const jid of jugadorIds) {
    const pl = plantillaPorJugador.get(jid);
    if (!pl) continue;
    const s = stats[jid] || { p2: 0, p3: 0, tl: 0, faltas: 0 };
    const puntos = s.p2 * 2 + s.p3 * 3 + s.tl;
    rows.push({
      partidoId,
      jugadorId: jid,
      personaId: personaPorJugador[jid] ?? null,
      equipoId: pl.equipoId,
      puntos,
      canastasDe2: s.p2,
      canastasDe3: s.p3,
      tirosLibresAnotados: s.tl,
      faltas: s.faltas,
      minutosJugados: null,
    });
  }

  if (rows.length > 0) {
    await prisma.resumenJugadorPartido.createMany({ data: rows });
  }
}
