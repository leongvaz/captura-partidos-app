import Dexie, { type Table } from 'dexie';
import type { Partido, PlantillaPartido, Evento, Incidencia, Liga, Equipo, Jugador, Cancha } from '@/types/entities';

export interface PartidoLocal extends Partido {
  synced?: boolean;
}
export interface EventoLocal extends Evento {
  synced?: boolean;
}

export class CapturaDB extends Dexie {
  ligas!: Table<Liga, string>;
  equipos!: Table<Equipo, string>;
  jugadores!: Table<Jugador, string>;
  canchas!: Table<Cancha, string>;
  partidos!: Table<PartidoLocal, string>;
  plantilla!: Table<PlantillaPartido, string>;
  eventos!: Table<EventoLocal, string>;
  incidencias!: Table<Incidencia, string>;
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
  }
}

export const db = new CapturaDB();
