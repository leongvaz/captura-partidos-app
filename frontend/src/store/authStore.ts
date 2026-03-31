import { create } from 'zustand';
import type { Liga, Usuario } from '@/types/entities';
import { login as apiLogin, loginEmail as apiLoginEmail } from '@/lib/api';

export const ROLES_PARTIDO = ['admin_liga', 'anotador_partido'] as const;
export const ROLES_LECTURA = ['consulta', 'admin_liga', 'capturista_roster', 'anotador_partido'] as const;

interface AuthState {
  token: string | null;
  usuario: Usuario | null;
  liga: Liga | null;
  setAuth: (token: string, usuario: Usuario, liga: Liga) => void;
  logout: () => void;
  login: (ligaId: string, pin: string) => Promise<void>;
  loginByEmail: (email: string, passwordOrPin: string) => Promise<void>;
  loadFromStorage: () => void;
  hasRole: (...roles: string[]) => boolean;
}

const initialToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
const initialUsuario =
  typeof window !== 'undefined' ? localStorage.getItem('usuario') : null;
const initialLiga = typeof window !== 'undefined' ? localStorage.getItem('liga') : null;

export const useAuthStore = create<AuthState>((set, get) => ({
  token: initialToken,
  usuario: initialUsuario ? (JSON.parse(initialUsuario) as Usuario) : null,
  liga: initialLiga ? (JSON.parse(initialLiga) as Liga) : null,
  setAuth: (token, usuario, liga) => {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
    localStorage.setItem('liga', JSON.stringify(liga));
    set({ token, usuario, liga });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('liga');
    set({ token: null, usuario: null, liga: null });
  },
  login: async (ligaId, pin) => {
    const res = await apiLogin(ligaId, pin);
    get().setAuth(res.token, res.usuario as Usuario, res.liga);
  },
  loginByEmail: async (email, passwordOrPin) => {
    const res = await apiLoginEmail(email, passwordOrPin);
    get().setAuth(res.token, res.usuario as Usuario, res.liga);
  },
  loadFromStorage: () => {
    const token = localStorage.getItem('token');
    const usuario = localStorage.getItem('usuario');
    const liga = localStorage.getItem('liga');
    if (token && usuario && liga) {
      set({ token, usuario: JSON.parse(usuario), liga: JSON.parse(liga) });
    }
  },
  hasRole: (...roles) => {
    const u = get().usuario;
    if (!u?.roles) return false;
    if (u.isSuperAdmin) return true;
    return roles.some((r) => u.roles.includes(r));
  },
}));
