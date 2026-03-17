import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import SyncStatus from './SyncStatus';

export default function Layout() {
  const usuario = useAuthStore((s) => s.usuario);
  const liga = useAuthStore((s) => s.liga);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const showBack = location.pathname !== '/' && location.pathname !== '/login';

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <header className="sticky top-0 z-10 bg-primary-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {showBack && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white"
              title="Volver"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-100 truncate">Captura Partidos</h1>
            <p className="text-xs text-slate-400 truncate">
              {liga?.nombre} · {usuario?.nombre}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/panel" className="text-sm text-slate-300 hover:text-white px-2 py-1 rounded">
            Panel
          </Link>
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
