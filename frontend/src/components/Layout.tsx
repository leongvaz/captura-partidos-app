import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import SyncStatus from './SyncStatus';

export default function Layout() {
  const usuario = useAuthStore((s) => s.usuario);
  const liga = useAuthStore((s) => s.liga);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <header className="sticky top-0 z-10 bg-primary-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Captura Partidos</h1>
          <p className="text-xs text-slate-400">
            {liga?.nombre} · {usuario?.nombre}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncStatus />
          <button
            type="button"
            onClick={logout}
            className="text-sm text-slate-400 hover:text-slate-200 px-2 py-1 rounded"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
