export type EstadoPartido =
  | 'programado'
  | 'en_curso'
  | 'finalizado'
  | 'default_local'
  | 'default_visitante'
  | 'cancelado';

export type TipoEvento =
  | 'punto_2'
  | 'punto_3'
  | 'tiro_libre_anotado'
  | 'tiro_libre_fallado'
  | 'falta_personal'
  | 'falta_antideportiva'
  | 'falta_tecnica'
  | 'sustitucion_entra'
  | 'sustitucion_sale';

export type TipoIncidencia =
  | 'default_no_presentacion'
  | 'expulsion_antideportivas'
  | 'expulsion_tecnicas'
  | 'protesta';

export interface Liga {
  id: string;
  nombre: string;
  temporada: string;
  categorias: string[];
  deporte?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Usuario {
  id: string;
  ligaId: string;
  nombre: string;
  roles: string[];
  isSuperAdmin?: boolean;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
  curp?: string | null;
}

export interface Equipo {
  id: string;
  ligaId: string;
  nombre: string;
  categoria: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Jugador {
  id: string;
  equipoId: string;
  nombre: string;
  apellido: string;
  numero: number;
  invitado: boolean;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Cancha {
  id: string;
  ligaId: string;
  sedeId?: string | null;
  nombre: string;
  /** Para UI offline si el API lo envía */
  nombreCompleto?: string;
  sedeNombre?: string | null;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Partido {
  id: string;
  ligaId: string;
  localEquipoId: string;
  visitanteEquipoId: string;
  canchaId: string;
  categoria: string;
  fecha: string;
  horaInicio: string;
  estado: EstadoPartido;
  folio?: string | null;
  anotadorId: string;
  marcadorLocalFinal?: number | null;
  marcadorVisitanteFinal?: number | null;
  fotoMarcadorUrl?: string | null;
  fotosOpcionales?: string[];
  cerradoAt?: string | null;
  localVersion?: number;
  serverVersion?: number | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlantillaPartido {
  id: string;
  partidoId: string;
  equipoId: string;
  jugadorId: string;
  enCanchaInicial: boolean;
  esCapitan: boolean;
  esCoach: boolean;
  invitado: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Evento {
  id: string;
  partidoId: string;
  tipo: TipoEvento;
  jugadorId: string;
  jugadorEntraId?: string | null;
  minutoPartido: number;
  cuarto: number;
  orden: number;
  createdAt: string;
  serverReceivedAt?: string | null;
}

export interface Incidencia {
  id: string;
  partidoId: string;
  tipo: TipoIncidencia;
  equipoId?: string | null;
  jugadorId?: string | null;
  motivo?: string | null;
  createdAt: string;
  updatedAt: string;
}
