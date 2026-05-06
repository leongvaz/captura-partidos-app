import Dexie, { type Table } from 'dexie';
import type { Partido, PlantillaPartido, Evento, Incidencia, Liga, Equipo, Jugador, Cancha } from '@/types/entities';

export interface PartidoLocal extends Partido {
  synced?: boolean;
  /** Partidos creados solo para pruebas locales (no se sincronizan). */
  isTest?: boolean;
  closurePending?: boolean;
  plantillaSynced?: boolean;
  plantillaSyncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
  plantillaSyncError?: string | null;
  cuartoActual?: number;
  segundosRestantesCuarto?: number;
  cronoRunning?: boolean;
  lastTickAt?: string | null;
}
export interface FotoCierre {
  partidoId: string;
  blob: Blob;
}
export interface CierrePendiente {
  id: string;
  partidoId: string;
  clientClosureId: string;
  createdAt: string;
  cuartoActual?: number;
  segundosRestantesCuarto?: number;
}
export interface EventoLocal extends Evento {
  synced?: boolean;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string | null;
  /** Evento de partido de pruebas locales (no se sincroniza). */
  isTest?: boolean;
  segundosRestantesCuarto?: number;
  tiempoPartidoSegundos?: number;
}
export interface EventoAnuladoLocal {
  eventId: string;
  partidoId: string;
  createdAt: string;
  synced?: boolean;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string | null;
  isTest?: boolean;
}
export interface IncidenciaLocal extends Incidencia {
  synced?: boolean;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string | null;
  /** Incidencia de partido de pruebas locales (no se sincroniza). */
  isTest?: boolean;
}

export class CapturaDB extends Dexie {
  ligas!: Table<Liga, string>;
  equipos!: Table<Equipo, string>;
  jugadores!: Table<Jugador, string>;
  canchas!: Table<Cancha, string>;
  partidos!: Table<PartidoLocal, string>;
  plantilla!: Table<PlantillaPartido, string>;
  eventos!: Table<EventoLocal, string>;
  eventosAnulados!: Table<EventoAnuladoLocal, string>;
  incidencias!: Table<IncidenciaLocal, string>;
  fotosCierre!: Table<FotoCierre, string>;
  cierresPendientes!: Table<CierrePendiente, string>;
  session!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('CapturaPartidos');
    this.version(1).stores({
      ligas: 'id',
      equipos: 'id, ligaId',
      jugadores: 'id, equipoId',
      canchas: 'id, ligaId',
      partidos: 'id, ligaId, fecha, estado',
      plantilla: 'id, partidoId, equipoId, jugadorId',
      eventos: 'id, partidoId, orden',
      incidencias: 'id, partidoId',
      session: 'key',
    });
    this.version(2).stores({
      ligas: 'id',
      equipos: 'id, ligaId',
      jugadores: 'id, equipoId',
      canchas: 'id, ligaId',
      partidos: 'id, ligaId, fecha, estado',
      plantilla: 'id, partidoId, equipoId, jugadorId',
      eventos: 'id, partidoId, orden',
      incidencias: 'id, partidoId',
      fotosCierre: 'partidoId',
      cierresPendientes: 'id, partidoId',
      session: 'key',
    });
    this.version(3).stores({
      ligas: 'id',
      equipos: 'id, ligaId',
      jugadores: 'id, equipoId',
      canchas: 'id, ligaId, sedeId',
      partidos: 'id, ligaId, fecha, estado',
      plantilla: 'id, partidoId, equipoId, jugadorId',
      eventos: 'id, partidoId, orden',
      incidencias: 'id, partidoId',
      fotosCierre: 'partidoId',
      cierresPendientes: 'id, partidoId',
      session: 'key',
    });
    this.version(4).stores({
      ligas: 'id',
      equipos: 'id, ligaId',
      jugadores: 'id, equipoId',
      canchas: 'id, ligaId, sedeId',
      partidos: 'id, ligaId, fecha, estado',
      plantilla: 'id, partidoId, equipoId, jugadorId',
      eventos: 'id, partidoId, orden, syncStatus',
      eventosAnulados: 'eventId, partidoId, syncStatus',
      incidencias: 'id, partidoId, syncStatus',
      fotosCierre: 'partidoId',
      cierresPendientes: 'id, partidoId',
      session: 'key',
    });
    this.version(5).stores({
      ligas: 'id',
      equipos: 'id, ligaId, temporadaId',
      jugadores: 'id, equipoId',
      canchas: 'id, ligaId, sedeId',
      partidos: 'id, ligaId, temporadaId, fecha, estado',
      plantilla: 'id, partidoId, equipoId, jugadorId',
      eventos: 'id, partidoId, orden, syncStatus',
      eventosAnulados: 'eventId, partidoId, syncStatus',
      incidencias: 'id, partidoId, syncStatus',
      fotosCierre: 'partidoId',
      cierresPendientes: 'id, partidoId',
      session: 'key',
    });
  }
}

export const db = new CapturaDB();
