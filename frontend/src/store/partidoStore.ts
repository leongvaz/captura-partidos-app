import { create } from 'zustand';
import type { Partido, PlantillaPartido, Evento, TipoEvento } from '@/types/entities';
import type { EventoLocal, PartidoLocal } from '@/lib/db';
import { db } from '@/lib/db';
function uuidv4(): string {
  return crypto.randomUUID();
}

interface PartidoState {
  partidoActual: Partido | PartidoLocal | null;
  plantilla: PlantillaPartido[];
  eventos: EventoLocal[];
  jugadorSeleccionadoId: string | null;
  minutoActual: number;
  cuartoActual: number;
  ordenContador: number;
  setPartidoActual: (p: Partido | PartidoLocal | null) => void;
  setPlantilla: (pl: PlantillaPartido[]) => void;
  setEventos: (ev: EventoLocal[]) => void;
  loadPartido: (partidoId: string) => Promise<void>;
  seleccionarJugador: (id: string | null) => void;
  agregarEvento: (tipo: TipoEvento, jugadorEntraId?: string) => Promise<void>;
  deshacerUltimoEvento: () => Promise<void>;
  setMinutoCuarto: (minuto: number, cuarto: number) => void;
  getJugadoresEnCancha: (equipoId: string) => PlantillaPartido[];
  getPuntosJugador: (jugadorId: string) => number;
  getFaltasJugador: (jugadorId: string) => number;
}

const PUNTOS: Record<string, number> = {
  punto_2: 2,
  punto_3: 3,
  tiro_libre_anotado: 1,
};
const FALTA_TIPOS = ['falta_personal', 'falta_antideportiva', 'falta_tecnica'];

export const usePartidoStore = create<PartidoState>((set, get) => ({
  partidoActual: null,
  plantilla: [],
  eventos: [],
  jugadorSeleccionadoId: null,
  minutoActual: 0,
  cuartoActual: 1,
  ordenContador: 0,
  setPartidoActual: (p) => set({ partidoActual: p }),
  setPlantilla: (pl) => set({ plantilla: pl }),
  setEventos: (ev) => set({ eventos: ev }),
  loadPartido: async (partidoId) => {
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
    const { partidoActual, plantilla, eventos, jugadorSeleccionadoId, minutoActual, cuartoActual, ordenContador } = get();
    if (!partidoActual || !jugadorSeleccionadoId) return;
    const orden = ordenContador;
    const ev: EventoLocal = {
      id: uuidv4(),
      partidoId: partidoActual.id,
      tipo,
      jugadorId: jugadorSeleccionadoId,
      jugadorEntraId: jugadorEntraId || undefined,
      minutoPartido: minutoActual,
      cuarto: cuartoActual,
      orden,
      createdAt: new Date().toISOString(),
      synced: false,
    };
    await db.eventos.add(ev);
    set({ eventos: [...eventos, ev], ordenContador: orden + 1 });
  },
  deshacerUltimoEvento: async () => {
    const { eventos, partidoActual } = get();
    if (!eventos.length || !partidoActual) return;
    const last = eventos[eventos.length - 1];
    await db.eventos.delete(last.id);
    set({ eventos: eventos.slice(0, -1), ordenContador: get().ordenContador - 1 });
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
}));
