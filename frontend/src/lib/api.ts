// const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor;
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (isCapacitor ? 'https://captura-partidos-api.onrender.com/api/v1' : '/api/v1');

function getToken(): string | null {
  return localStorage.getItem('token');
}

type ApiRequestInit = Omit<RequestInit, 'body'> & { body?: unknown };

export async function api<T>(path: string, options: ApiRequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const isFormData = options.body instanceof FormData;
  const hasJsonBody = !isFormData && options.body != null;
  if (hasJsonBody) headers['Content-Type'] = 'application/json';
  const body = isFormData
    ? (options.body as FormData)
    : options.body != null
      ? JSON.stringify(options.body)
      : undefined;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface AuthResponse {
  token: string;
  usuario: { id: string; ligaId: string; nombre: string; roles: string[]; isSuperAdmin?: boolean; curp?: string | null };
  liga: Liga;
}
interface Liga {
  id: string;
  nombre: string;
  temporada: string;
  categorias: string[];
  deporte?: string;
}

export async function login(ligaId: string, pin: string): Promise<AuthResponse> {
  return api<AuthResponse>('/auth/anotador', { method: 'POST', body: { ligaId, pin } });
}

export async function loginEmail(email: string, passwordOrPin: string): Promise<AuthResponse> {
  return api<AuthResponse>('/auth/login-email', {
    method: 'POST',
    body: { email, passwordOrPin },
  });
}

export interface RegistroOrganizadorInput {
  ligaId: string;
  email: string;
  password: string;
  pin: string;
  nombre: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  curp?: string;
}

export async function registrarOrganizador(data: RegistroOrganizadorInput): Promise<AuthResponse> {
  const { ligaId, ...payload } = data;
  return api<AuthResponse>('/auth/organizador/registro', {
    method: 'POST',
    body: { ligaId, ...payload },
  });
}

export interface RegistroCapitanInput {
  ligaId: string;
  email: string;
  password: string;
  nombre: string;
  curp: string;
}

export async function registrarCapitan(data: RegistroCapitanInput): Promise<AuthResponse> {
  const { ligaId, ...payload } = data;
  return api<AuthResponse>('/auth/registro-capitan', {
    method: 'POST',
    body: { ligaId, ...payload },
  });
}

export interface ReglasLigaConfig {
  duracionCuartoMin: number;
  partidosClasificacion: number;
  tienePlayoffs: boolean;
  temporadaInicio?: string | null;
  /** Último día de temporada (elegido por el admin; `yyyy-MM-dd`). */
  temporadaFin?: string | null;
  ramas: {
    varonil: boolean;
    femenil: boolean;
    mixta: boolean;
    veteranos: boolean;
    infantil: boolean;
  };
  fuerzas?: string[]; // legado: lista global
  fuerzasPorRama: {
    varonil: string[];
    femenil: string[];
    mixta: string[];
    veteranos: string[];
    infantil: string[];
  };
  maxJugadoresPorEquipo: number;
  maxInvitadosPorPartido: number;
  permitirInvitadosSinCurp: boolean;
  periodoInscripcion?: {
    inicio?: string | null;
    fin?: string | null;
  };
  /** Rango horario permitido para partidos (`HH:mm`, 24 h). `horaFin` = hora a la que debe iniciar (o terminar) el último partido. */
  jornadaHorario?: {
    horaInicio?: string | null;
    horaFin?: string | null;
  };
}

/** `type="date"` solo acepta `yyyy-MM-dd`; ISO completo u otros formatos se muestran vacíos. */
function fechaReglasAInput(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function horaReglasHHmm(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function normalizarFechasReglasCliente(cfg: ReglasLigaConfig): ReglasLigaConfig {
  const pi = cfg.periodoInscripcion;
  const jh = cfg.jornadaHorario;
  return {
    ...cfg,
    temporadaInicio: fechaReglasAInput(cfg.temporadaInicio),
    temporadaFin: fechaReglasAInput(cfg.temporadaFin),
    periodoInscripcion: {
      inicio: fechaReglasAInput(pi?.inicio),
      fin: fechaReglasAInput(pi?.fin),
    },
    jornadaHorario: {
      horaInicio: horaReglasHHmm(jh?.horaInicio) ?? jh?.horaInicio ?? '08:00',
      horaFin: horaReglasHHmm(jh?.horaFin) ?? jh?.horaFin ?? '14:00',
    },
  };
}

export async function obtenerReglasLiga(ligaId: string): Promise<ReglasLigaConfig> {
  const cfg = await api<ReglasLigaConfig>(`/liga/reglas?ligaId=${ligaId}`);
  return normalizarFechasReglasCliente(cfg);
}

export async function guardarReglasLiga(ligaId: string, config: ReglasLigaConfig): Promise<void> {
  return api<void>('/liga/reglas', { method: 'PUT', body: { ligaId, config } });
}

export interface RegistroEquipoCapitanInput {
  ligaId: string;
  nombre: string;
  rama: string;
  fuerza: string;
}

export async function registrarEquipoCapitan(
  data: RegistroEquipoCapitanInput
): Promise<{ id: string; ligaId: string; nombre: string; categoria: string }> {
  return api<{ id: string; ligaId: string; nombre: string; categoria: string }>(
    '/equipos/registro-capitan',
    { method: 'POST', body: data }
  );
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

export async function listarMisEquipos(): Promise<Equipo[]> {
  return api<Equipo[]>('/equipos/mis');
}

export interface Jugador {
  id: string;
  equipoId: string;
  personaId?: string | null;
  nombre: string;
  apellido: string;
  numero: number;
  curp?: string | null;
  invitado: boolean;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listarJugadores(equipoId: string): Promise<Jugador[]> {
  return api<Jugador[]>(`/jugadores?equipoId=${equipoId}`);
}

export async function registrarJugador(data: {
  equipoId: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  numero: number;
  curp: string;
}): Promise<Jugador> {
  return api<Jugador>('/jugadores', { method: 'POST', body: data });
}

export async function actualizarJugador(id: string, data: {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  numero: number;
}): Promise<Jugador> {
  return api<Jugador>(`/jugadores/${id}`, { method: 'PUT', body: data });
}

export async function eliminarJugador(id: string): Promise<Jugador> {
  return api<Jugador>(`/jugadores/${id}`, { method: 'DELETE' });
}

// Superadmin: gestión de ligas
export async function listarLigasAdmin(): Promise<Liga[]> {
  return api<Liga[]>('/admin/ligas');
}

export async function crearLigaAdmin(data: {
  nombre: string;
  temporada: string;
  categorias?: string[];
  deporte?: string;
}): Promise<Liga> {
  return api<Liga>('/admin/ligas', { method: 'POST', body: data });
}

export interface LigaAdminDetalleEquipo {
  id: string;
  nombre: string;
  categoria: string;
  jugadoresActivos: number;
}

export interface LigaAdminDetalleResponse {
  liga: { id: string; nombre: string; temporada: string; deporte: string; categorias: string[] };
  reglas: ReglasLigaConfig;
  equipos: LigaAdminDetalleEquipo[];
}

export async function obtenerLigaAdminDetalle(ligaId: string): Promise<LigaAdminDetalleResponse> {
  return api<LigaAdminDetalleResponse>(`/admin/ligas/${ligaId}`);
}

export interface EquipoAdminDetalleResponse {
  equipo: Equipo;
  jugadores: Jugador[];
}

export async function obtenerEquipoAdminDetalle(equipoId: string): Promise<EquipoAdminDetalleResponse> {
  return api<EquipoAdminDetalleResponse>(`/admin/equipos/${equipoId}`);
}

// Info pública de liga (para pantallas de registro)
export async function obtenerLigaPublica(ligaId: string): Promise<Liga> {
  return api<Liga>(`/liga/public-info?ligaId=${ligaId}`);
}

export interface HistorialPersonaInscripcion {
  jugadorId: string;
  ligaId: string;
  ligaNombre: string;
  temporada: string;
  deporte: string;
  equipoId: string;
  equipoNombre: string;
  categoria: string;
  numero: number;
  activo: boolean;
  invitado: boolean;
  inscripcionDesde: string;
}

export interface HistorialPersonaPartido {
  partidoId: string;
  fecha: string;
  horaInicio: string;
  folio: string | null;
  estado: string;
  categoriaPartido: string;
  liga: { id: string; nombre: string; temporada: string; deporte: string };
  equipo: { id: string; nombre: string; categoria: string };
  rivalNombre: string;
  localEsEquipo: boolean;
  resumen: {
    puntos: number;
    canastasDe2: number;
    canastasDe3: number;
    tirosLibresAnotados: number;
    faltas: number;
    minutosJugados: number | null;
  };
}

export interface HistorialPersonaResponse {
  persona: {
    id: string;
    curp: string;
    nombreDisplay: string | null;
    apellidoDisplay: string | null;
    sexo: string | null;
    fechaNacimiento: string | null;
  } | null;
  inscripciones: HistorialPersonaInscripcion[];
  partidos: HistorialPersonaPartido[];
  totalesGlobales: {
    partidosConResumen: number;
    puntosTotales: number;
    faltasTotales: number;
  };
}

export async function obtenerHistorialPersonaPorCurp(curp: string): Promise<HistorialPersonaResponse> {
  const q = encodeURIComponent(curp.trim().toUpperCase());
  return api<HistorialPersonaResponse>(`/admin/personas/historial?curp=${q}`);
}

export interface CanchaEnSede {
  id: string;
  ligaId: string;
  sedeId: string | null;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SedeConCanchas {
  id: string;
  ligaId: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  canchas: CanchaEnSede[];
}

export async function listarSedes(ligaId: string): Promise<SedeConCanchas[]> {
  return api<SedeConCanchas[]>(`/sedes?ligaId=${ligaId}`);
}

export async function crearSede(ligaId: string, nombre: string): Promise<SedeConCanchas> {
  return api<SedeConCanchas>('/sedes', { method: 'POST', body: { ligaId, nombre } });
}

export async function crearCanchaEnSede(sedeId: string, nombre: string): Promise<{
  id: string;
  ligaId: string;
  sedeId: string | null;
  nombre: string;
  nombreCompleto: string;
  sede: { id: string; nombre: string } | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}> {
  return api('/canchas', { method: 'POST', body: { sedeId, nombre } });
}

export async function actualizarSede(
  sedeId: string,
  body: { nombre?: string; activo?: boolean }
): Promise<{
  id: string;
  ligaId: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}> {
  return api(`/sedes/${sedeId}`, { method: 'PATCH', body });
}

export async function actualizarCancha(
  canchaId: string,
  body: { nombre?: string; activo?: boolean }
): Promise<{
  id: string;
  ligaId: string;
  sedeId: string | null;
  nombre: string;
  nombreCompleto: string;
  sede: { id: string; nombre: string } | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}> {
  return api(`/canchas/${canchaId}`, { method: 'PATCH', body });
}
