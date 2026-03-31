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
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const isFormData = options.body instanceof FormData;
  if (isFormData) delete headers['Content-Type'];
  const body = isFormData ? (options.body as FormData) : (options.body != null ? JSON.stringify(options.body) : undefined);
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
  usuario: { id: string; ligaId: string; nombre: string; roles: string[]; isSuperAdmin?: boolean };
  liga: Liga;
}
interface Liga {
  id: string;
  nombre: string;
  temporada: string;
  categorias: string[];
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
}

export async function obtenerReglasLiga(ligaId: string): Promise<ReglasLigaConfig> {
  return api<ReglasLigaConfig>(`/liga/reglas?ligaId=${ligaId}`);
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
  nombre: string;
  apellido: string;
  numero: number;
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
}): Promise<Jugador> {
  return api<Jugador>('/jugadores', { method: 'POST', body: data });
}

export async function actualizarJugador(id: string, data: {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
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
}): Promise<Liga> {
  return api<Liga>('/admin/ligas', { method: 'POST', body: data });
}

// Info pública de liga (para pantallas de registro)
export async function obtenerLigaPublica(ligaId: string): Promise<Liga> {
  return api<Liga>(`/liga/public-info?ligaId=${ligaId}`);
}
