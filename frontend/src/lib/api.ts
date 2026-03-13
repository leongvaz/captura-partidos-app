const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit & { body?: unknown } = {}
): Promise<T> {
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
