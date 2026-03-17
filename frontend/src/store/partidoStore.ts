import { create } from 'zustand';
import type { Partido, PlantillaPartido, Evento, TipoEvento } from '@/types/entities';
import type { EventoLocal, PartidoLocal } from '@/lib/db';
import { db } from '@/lib/db';
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
  const elapsed = Math.floor((nowMs - startedAtMs) / 1000);
  return Math.max(0, segundosBase - Math.max(0, elapsed));
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
  getPuntosJugador: (jugadorId: string) => number;
  getFaltasJugador: (jugadorId: string) => number;
  getFaltasPersonalesJugador: (jugadorId: string) => number;
  getFaltasAntideportivasJugador: (jugadorId: string) => number;
  getFaltasTecnicasJugador: (jugadorId: string) => number;
  isJugadorExpulsado: (jugadorId: string) => boolean;
}

const PUNTOS: Record<string, number> = {
  punto_2: 2,
  punto_3: 3,
  tiro_libre_anotado: 1,
};
const FALTA_TIPOS = ['falta_personal', 'falta_antideportiva', 'falta_tecnica'];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
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
    await db.partidos.update(partidoId, {
      cuartoActual,
      segundosRestantesCuarto,
      cronoRunning,
      lastTickAt,
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
    const orden = ordenContador;
    const { cuartoActual, segundosRestantesCuarto, tiempoPartidoSegundos } = getCronoSnapshot();
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
      segundosRestantesCuarto,
      tiempoPartidoSegundos,
    };
    await db.eventos.add(ev);
    set({ eventos: [...eventos, ev], ordenContador: orden + 1 });
    useSyncStore.getState().runSync().catch(() => {});
  },
  deshacerUltimoEvento: async () => {
    const { eventos, partidoActual } = get();
    if (!eventos.length || !partidoActual) return;
    const last = eventos[eventos.length - 1];
    await db.eventos.delete(last.id);
    set({ eventos: eventos.slice(0, -1), ordenContador: get().ordenContador - 1 });
    useSyncStore.getState().runSync().catch(() => {});
  },
  getJugadoresEnCancha: (equipoId) => {
    const { plantilla, eventos } = get();
    const enCanchaInicial = plantilla.filter((p) => p.equipoId === equipoId && p.enCanchaInicial).map((p) => p.jugadorId);
    let actual = new Set(enCanchaInicial);
    for (const e of eventos) {
      if (e.tipo === 'sustitucion_sale') actual.delete(e.jugadorId);
      else if (e.tipo === 'sustitucion_entra' && e.jugadorEntraId) actual.add(e.jugadorEntraId);
    }
    return plantilla.filter((p) => p.equipoId === equipoId && actual.has(p.jugadorId));
  },
  getPuntosJugador: (jugadorId) => {
    return get().eventos
      .filter((e) => e.jugadorId === jugadorId && PUNTOS[e.tipo])
      .reduce((s, e) => s + (PUNTOS[e.tipo] ?? 0), 0);
  },
  getFaltasJugador: (jugadorId) => {
    return get().eventos.filter((e) => e.jugadorId === jugadorId && FALTA_TIPOS.includes(e.tipo)).length;
  },
  getFaltasPersonalesJugador: (jugadorId) => {
    return get().eventos.filter((e) => e.jugadorId === jugadorId && e.tipo === 'falta_personal').length;
  },
  getFaltasAntideportivasJugador: (jugadorId) => {
    return get().eventos.filter((e) => e.jugadorId === jugadorId && e.tipo === 'falta_antideportiva').length;
  },
  getFaltasTecnicasJugador: (jugadorId) => {
    return get().eventos.filter((e) => e.jugadorId === jugadorId && e.tipo === 'falta_tecnica').length;
  },
  isJugadorExpulsado: (jugadorId) => {
    const personales = get().eventos.filter((e) => e.jugadorId === jugadorId && e.tipo === 'falta_personal').length;
    const antideportivas = get().eventos.filter((e) => e.jugadorId === jugadorId && e.tipo === 'falta_antideportiva').length;
    const tecnicas = get().eventos.filter((e) => e.jugadorId === jugadorId && e.tipo === 'falta_tecnica').length;
    if (personales >= 5) return true;
    if (antideportivas >= 2 || tecnicas >= 2) return true;
    if (antideportivas >= 1 && tecnicas >= 1) return true;
    if (personales >= 4 && (antideportivas >= 1 || tecnicas >= 1)) return true;
    return false;
  },
}));
