import { create } from 'zustand';
import type { Partido, PlantillaPartido, TipoEvento } from '@/types/entities';
import type { EventoLocal, PartidoLocal } from '@/lib/db';
import { db } from '@/lib/db';
import {
  defaultLeagueRules,
  deriveLegacyMatchState,
  getPeriodKey,
} from '@/domain/match';
import { useSyncStore } from '@/store/syncStore';
function uuidv4(): string {
  return crypto.randomUUID();
}

const SEGUNDOS_POR_CUARTO = 600; // 10 min
const SEGUNDOS_POR_TIEMPO_EXTRA = 300; // 5 min

function duracionPeriodo(cuarto: number): number {
  return cuarto <= 4 ? SEGUNDOS_POR_CUARTO : SEGUNDOS_POR_TIEMPO_EXTRA;
}

function segundosRestantesDerivado(nowMs: number, cronoRunning: boolean, lastTickAt: string | null, segundosBase: number): number {
  if (!cronoRunning || !lastTickAt) return segundosBase;
  const startedAtMs = new Date(lastTickAt).getTime();
  const elapsedSeconds = Math.max(0, (nowMs - startedAtMs) / 1000);
  return Math.max(0, segundosBase - elapsedSeconds);
}

interface PartidoState {
  partidoActual: Partido | PartidoLocal | null;
  plantilla: PlantillaPartido[];
  eventos: EventoLocal[];
  jugadorSeleccionadoId: string | null;
  minutoActual: number;
  cuartoActual: number;
  segundosRestantesCuarto: number;
  cronoRunning: boolean;
  lastTickAt: string | null;
  ordenContador: number;
  setPartidoActual: (p: Partido | PartidoLocal | null) => void;
  setPlantilla: (pl: PlantillaPartido[]) => void;
  setEventos: (ev: EventoLocal[]) => void;
  loadPartido: (partidoId: string) => Promise<void>;
  seleccionarJugador: (id: string | null) => void;
  agregarEvento: (tipo: TipoEvento, jugadorEntraId?: string) => Promise<void>;
  deshacerUltimoEvento: () => Promise<void>;
  setMinutoCuarto: (minuto: number, cuarto: number) => void;
  inicializarCronoSiHaceFalta: () => void;
  hidratarCronoDesdePartidoLocal: (partidoLocal: PartidoLocal) => void;
  persistirCronoEnPartidoLocal: (partidoId: string) => Promise<void>;
  toggleCrono: () => void;
  pausarCronoSiCorriendo: () => void;
  tickCrono: () => void; // compat (ya no se usa para contar)
  cambiarCuarto: (nuevoCuarto: number) => void;
  editarTiempoManual: (minutos: number, segundos: number) => void;
  getCronoSnapshot: () => { cuartoActual: number; segundosRestantesCuarto: number; tiempoPartidoSegundos: number };
  getJugadoresEnCancha: (equipoId: string) => PlantillaPartido[];
  getOfficialScore: () => { home: number; away: number };
  getPuntosJugador: (jugadorId: string) => number;
  getFaltasJugador: (jugadorId: string) => number;
  getFaltasPersonalesJugador: (jugadorId: string) => number;
  getFaltasAntideportivasJugador: (jugadorId: string) => number;
  getFaltasTecnicasJugador: (jugadorId: string) => number;
  isJugadorExpulsado: (jugadorId: string) => boolean;
  getTeamFoulsByPeriod: (equipoId: string, cuarto?: number) => number;
  canFinishMatch: (closingPhotoProvided?: boolean) => boolean;
  shouldStartOvertime: () => boolean;
  getFinishBlockReasons: (closingPhotoProvided?: boolean) => string[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildDomainStateFromStore(
  state: Pick<
    PartidoState,
    'partidoActual' | 'plantilla' | 'eventos' | 'cuartoActual' | 'segundosRestantesCuarto' | 'cronoRunning' | 'lastTickAt'
  >,
  closingPhotoProvided = false
) {
  if (!state.partidoActual) return null;
  const segundosRestantesActual = segundosRestantesDerivado(
    Date.now(),
    state.cronoRunning,
    state.lastTickAt,
    state.segundosRestantesCuarto
  );

  return deriveLegacyMatchState(
    state.partidoActual,
    state.plantilla,
    state.eventos,
    {
      cuartoActual: state.cuartoActual,
      segundosRestantesCuarto: segundosRestantesActual,
      cronoRunning: state.cronoRunning,
    },
    defaultLeagueRules,
    {
      closingPhotoProvided,
    }
  );
}

export const usePartidoStore = create<PartidoState>((set, get) => ({
  partidoActual: null,
  plantilla: [],
  eventos: [],
  jugadorSeleccionadoId: null,
  minutoActual: 0,
  cuartoActual: 1,
  segundosRestantesCuarto: SEGUNDOS_POR_CUARTO,
  cronoRunning: false,
  lastTickAt: null,
  ordenContador: 0,
  setPartidoActual: (p) => set({ partidoActual: p }),
  setPlantilla: (pl) => set({ plantilla: pl }),
  setEventos: (ev) => set({ eventos: ev }),
  inicializarCronoSiHaceFalta: () => {
    const s = get();
    if (s.cuartoActual == null || s.cuartoActual < 1 || s.segundosRestantesCuarto == null) {
      set({
        cuartoActual: 1,
        segundosRestantesCuarto: SEGUNDOS_POR_CUARTO,
        cronoRunning: false,
        lastTickAt: null,
      });
    }
  },
  hidratarCronoDesdePartidoLocal: (partidoLocal: PartidoLocal) => {
    const cuarto = Math.max(1, partidoLocal.cuartoActual ?? 1);
    const seg = partidoLocal.segundosRestantesCuarto ?? duracionPeriodo(cuarto);
    const running = partidoLocal.cronoRunning ?? false;
    const last = partidoLocal.lastTickAt ?? null;
    set({
      cuartoActual: cuarto,
      segundosRestantesCuarto: clamp(seg, 0, duracionPeriodo(cuarto)),
      cronoRunning: Boolean(running && last),
      lastTickAt: running && last ? last : null,
    });
  },
  persistirCronoEnPartidoLocal: async (partidoId: string) => {
    const { cuartoActual, segundosRestantesCuarto, cronoRunning, lastTickAt } = get();
    const segundosRestantesActual = segundosRestantesDerivado(Date.now(), cronoRunning, lastTickAt, segundosRestantesCuarto);
    const nextLastTickAt = cronoRunning ? new Date().toISOString() : null;
    set({
      segundosRestantesCuarto: segundosRestantesActual,
      lastTickAt: nextLastTickAt,
    });
    await db.partidos.update(partidoId, {
      cuartoActual,
      segundosRestantesCuarto: segundosRestantesActual,
      cronoRunning,
      lastTickAt: nextLastTickAt,
    });
  },
  toggleCrono: () => {
    const { cronoRunning, lastTickAt, segundosRestantesCuarto } = get();
    get().inicializarCronoSiHaceFalta();
    if (!cronoRunning) {
      set({ cronoRunning: true, lastTickAt: new Date().toISOString() });
      return;
    }
    const nuevo = segundosRestantesDerivado(Date.now(), true, lastTickAt, segundosRestantesCuarto);
    set({ segundosRestantesCuarto: nuevo, cronoRunning: false, lastTickAt: null });
  },
  pausarCronoSiCorriendo: () => {
    const { cronoRunning, lastTickAt, segundosRestantesCuarto } = get();
    if (!cronoRunning) return;
    const nuevo = segundosRestantesDerivado(Date.now(), true, lastTickAt, segundosRestantesCuarto);
    set({ segundosRestantesCuarto: nuevo, cronoRunning: false, lastTickAt: null });
  },
  tickCrono: () => {
    // Ya no contamos “por tick”. El tiempo se deriva de lastTickAt + base.
    // Se mantiene por compatibilidad con llamadas existentes (si quedara alguna).
    return;
  },
  cambiarCuarto: (nuevoCuarto: number) => {
    get().pausarCronoSiCorriendo();
    const n = Math.max(1, Math.floor(nuevoCuarto));
    set({
      cuartoActual: n,
      segundosRestantesCuarto: duracionPeriodo(n),
      cronoRunning: false,
      lastTickAt: null,
    });
  },
  editarTiempoManual: (minutos: number, segundos: number) => {
    get().pausarCronoSiCorriendo();
    const maxMin = get().cuartoActual <= 4 ? 10 : 5;
    const m = clamp(minutos, 0, maxMin);
    const s = clamp(segundos, 0, 59);
    const total = Math.min(duracionPeriodo(get().cuartoActual), m * 60 + s);
    set({
      segundosRestantesCuarto: total,
      cronoRunning: false,
      lastTickAt: null,
    });
  },
  getCronoSnapshot: () => {
    const { cuartoActual, segundosRestantesCuarto, cronoRunning, lastTickAt } = get();
    const segundosRestantesActual = segundosRestantesDerivado(Date.now(), cronoRunning, lastTickAt, segundosRestantesCuarto);
    let acumulado = 0;
    for (let i = 1; i < cuartoActual; i++) acumulado += duracionPeriodo(i);
    const dur = duracionPeriodo(cuartoActual);
    const tiempoPartidoSegundos = acumulado + (dur - segundosRestantesActual);
    return {
      cuartoActual,
      segundosRestantesCuarto: segundosRestantesActual,
      tiempoPartidoSegundos,
    };
  },
  loadPartido: async (partidoId: string) => {
    const partido = await db.partidos.get(partidoId);
    const plantilla = await db.plantilla.where('partidoId').equals(partidoId).toArray();
    const eventos = await db.eventos.where('partidoId').equals(partidoId).sortBy('orden');
    const maxOrden = eventos.length ? Math.max(...eventos.map((e) => e.orden)) : 0;
    set({
      partidoActual: partido ?? null,
      plantilla,
      eventos,
      ordenContador: maxOrden + 1,
      jugadorSeleccionadoId: null,
    });
  },
  seleccionarJugador: (id) => set({ jugadorSeleccionadoId: id }),
  setMinutoCuarto: (minuto, cuarto) => set({ minutoActual: minuto, cuartoActual: cuarto }),
  agregarEvento: async (tipo, jugadorEntraId) => {
    const { partidoActual, plantilla, eventos, jugadorSeleccionadoId, ordenContador, getCronoSnapshot } = get();
    if (!partidoActual || !jugadorSeleccionadoId) return;
    if (tipo === 'sustitucion_entra') {
      const pl = plantilla.find((item) => item.jugadorId === jugadorSeleccionadoId);
      const domainState = buildDomainStateFromStore(get());
      if (!pl || !domainState) return;
      const isHome = pl.equipoId === partidoActual.localEquipoId;
      const team = isHome ? domainState.home : domainState.away;
      const player = domainState.players[jugadorSeleccionadoId];
      if (!player || player.isDisqualified || player.isOnCourt || team.playersOnCourt.length >= defaultLeagueRules.maxPlayersOnCourt) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[captura][sustitucion_bloqueada]', {
            jugadorId: jugadorSeleccionadoId,
            equipoId: pl.equipoId,
            enCancha: team.playersOnCourt.length,
          });
        }
        return;
      }
    }
    const orden = ordenContador;
    const { cuartoActual, segundosRestantesCuarto, tiempoPartidoSegundos } = getCronoSnapshot();
    const isTest = Boolean((partidoActual as PartidoLocal | null)?.isTest);
    const ev: EventoLocal = {
      id: uuidv4(),
      partidoId: partidoActual.id,
      tipo,
      jugadorId: jugadorSeleccionadoId,
      jugadorEntraId: jugadorEntraId || undefined,
      minutoPartido: Math.floor(tiempoPartidoSegundos / 60),
      cuarto: cuartoActual,
      orden,
      createdAt: new Date().toISOString(),
      synced: false,
      syncStatus: isTest ? 'synced' : 'pending',
      syncError: null,
      isTest,
      segundosRestantesCuarto,
      tiempoPartidoSegundos,
    };
    if (import.meta.env.DEV) {
      // Debug de captura: ver eventos uno por uno conforme se registran.
      // eslint-disable-next-line no-console
      console.debug('[captura][evento]', {
        orden: ev.orden,
        tipo: ev.tipo,
        jugadorId: ev.jugadorId,
        jugadorEntraId: ev.jugadorEntraId,
        cuarto: ev.cuarto,
        segundosRestantesCuarto: ev.segundosRestantesCuarto,
      });
    }
    await db.eventos.add(ev);
    set({ eventos: [...eventos, ev], ordenContador: orden + 1 });
    if (!isTest) useSyncStore.getState().runSync().catch(() => {});
  },
  deshacerUltimoEvento: async () => {
    const { eventos, partidoActual } = get();
    if (!eventos.length || !partidoActual) return;
    const last = eventos[eventos.length - 1];
    const isTest = Boolean((partidoActual as PartidoLocal | null)?.isTest);
    if (last.synced && !isTest) {
      await db.eventosAnulados.put({
        eventId: last.id,
        partidoId: partidoActual.id,
        createdAt: new Date().toISOString(),
        synced: false,
        syncStatus: 'pending',
        syncError: null,
        isTest,
      });
    }
    await db.eventos.delete(last.id);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[captura][deshacer]', { orden: last.orden, tipo: last.tipo, jugadorId: last.jugadorId });
    }
    set({ eventos: eventos.slice(0, -1), ordenContador: get().ordenContador - 1 });
    if (!isTest) useSyncStore.getState().runSync().catch(() => {});
  },
  getJugadoresEnCancha: (equipoId) => {
    const state = get();
    const { partidoActual, plantilla } = state;
    if (!partidoActual) return [];
    const domainState = buildDomainStateFromStore(state);
    if (!domainState) return [];
    const isHome = equipoId === partidoActual.localEquipoId;
    const ids = new Set(isHome ? domainState.home.playersOnCourt : domainState.away.playersOnCourt);
    return plantilla.filter((p) => p.equipoId === equipoId && ids.has(p.jugadorId));
  },
  getOfficialScore: () => {
    const domainState = buildDomainStateFromStore(get());
    return domainState ? domainState.score : { home: 0, away: 0 };
  },
  getPuntosJugador: (jugadorId) => {
    const domainState = buildDomainStateFromStore(get());
    return domainState?.players[jugadorId]?.points ?? 0;
  },
  getFaltasJugador: (jugadorId) => {
    const domainState = buildDomainStateFromStore(get());
    return domainState?.players[jugadorId]?.totalFoulsForDisplay ?? 0;
  },
  getFaltasPersonalesJugador: (jugadorId) => {
    const domainState = buildDomainStateFromStore(get());
    return domainState?.players[jugadorId]?.personalFouls ?? 0;
  },
  getFaltasAntideportivasJugador: (jugadorId) => {
    const domainState = buildDomainStateFromStore(get());
    return domainState?.players[jugadorId]?.unsportsmanlikeFouls ?? 0;
  },
  getFaltasTecnicasJugador: (jugadorId) => {
    const domainState = buildDomainStateFromStore(get());
    return domainState?.players[jugadorId]?.technicalFouls ?? 0;
  },
  isJugadorExpulsado: (jugadorId) => {
    const domainState = buildDomainStateFromStore(get());
    return domainState?.players[jugadorId]?.isDisqualified ?? false;
  },
  getTeamFoulsByPeriod: (equipoId, cuarto) => {
    const state = get();
    const { partidoActual, cuartoActual } = state;
    if (!partidoActual) return 0;
    const domainState = buildDomainStateFromStore(state);
    if (!domainState) return 0;
    const targetCuarto = cuarto ?? cuartoActual;
    const periodType = targetCuarto <= defaultLeagueRules.regularPeriods ? 'regular' : 'overtime';
    const periodNumber =
      periodType === 'regular'
        ? targetCuarto
        : targetCuarto - defaultLeagueRules.regularPeriods;
    const key = getPeriodKey(periodNumber, periodType);
    const team =
      equipoId === partidoActual.localEquipoId
        ? domainState.home.teamFoulsByPeriod
        : domainState.away.teamFoulsByPeriod;
    return team[key] ?? 0;
  },
  canFinishMatch: (closingPhotoProvided = false) => {
    const domainState = buildDomainStateFromStore(get(), closingPhotoProvided);
    return domainState?.canFinish ?? false;
  },
  shouldStartOvertime: () => {
    const domainState = buildDomainStateFromStore(get());
    return domainState?.needsOvertime ?? false;
  },
  getFinishBlockReasons: (closingPhotoProvided = false) => {
    const domainState = buildDomainStateFromStore(get(), closingPhotoProvided);
    return domainState?.finishBlockReasons ?? [];
  },
}));
