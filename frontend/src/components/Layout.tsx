import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import SyncStatus from './SyncStatus';

export default function Layout() {
  const usuario = useAuthStore((s) => s.usuario);
  const hasRole = useAuthStore((s) => s.hasRole);
  const liga = useAuthStore((s) => s.liga);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const showBack = path !== '/' && path !== '/login';
  const [menuAbierto, setMenuAbierto] = useState(false);

  const navBtn = (active: boolean, extra = '') =>
    `w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${extra} ${
      active
        ? 'bg-primary-600 text-white font-medium shadow-sm'
        : 'text-slate-100 hover:bg-slate-800'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <header className="sticky top-0 z-20 bg-primary-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
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
            <h1 className="text-lg font-bold text-slate-100 truncate">
              {usuario?.isSuperAdmin
                ? 'Administrador de ligas'
                : hasRole('admin_liga')
                  ? 'Administrador de liga'
                  : hasRole('capturista_roster')
                    ? 'Panel de capitán'
                    : 'Captura Partidos'}
            </h1>
            <p className="text-xs text-slate-400 truncate">
              {liga?.nombre}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SyncStatus />
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            className="p-1.5 rounded-lg text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            aria-label="Abrir menú"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>
      {menuAbierto && (
        <div className="fixed inset-0 z-30 flex">
          <div
            className="flex-1 bg-black/50"
            onClick={() => setMenuAbierto(false)}
          />
          <aside className="w-64 max-w-[70vw] bg-slate-900/95 border-l border-slate-700 p-4 flex flex-col gap-4 shadow-2xl rounded-l-2xl">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-slate-400">Sesión</p>
                <p className="text-sm font-semibold text-slate-100 truncate">
                  {usuario?.nombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800"
                aria-label="Cerrar menú"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 space-y-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  navigate('/');
                  setMenuAbierto(false);
                }}
                className={navBtn(path === '/')}
              >
                Partidos del día
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/panel');
                  setMenuAbierto(false);
                }}
                className={navBtn(path === '/panel')}
              >
                Panel de liga
              </button>
              {hasRole('admin_liga') && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/reglas-liga');
                      setMenuAbierto(false);
                    }}
                    className={navBtn(path === '/reglas-liga')}
                  >
                    Reglas de la liga
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/sedes-canchas');
                      setMenuAbierto(false);
                    }}
                    className={navBtn(path === '/sedes-canchas')}
                  >
                    Sedes y canchas
                  </button>
                </>
              )}
              {hasRole('capturista_roster') && (
                <button
                  type="button"
                  onClick={() => {
                    navigate('/panel-equipo');
                    setMenuAbierto(false);
                  }}
                  className={navBtn(path === '/panel-equipo')}
                >
                  Administrar mi equipo
                </button>
              )}
              {usuario?.isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    navigate('/superadmin');
                    setMenuAbierto(false);
                  }}
                  className={
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ' +
                    (path.startsWith('/superadmin')
                      ? 'bg-amber-600 text-slate-950 font-medium shadow-sm'
                      : 'text-amber-200 hover:bg-slate-800')
                  }
                >
                  Superadmin
                </button>
              )}
            </nav>
            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false);
                logout();
              }}
              className="w-full text-left px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200"
            >
              Cerrar sesión
            </button>
          </aside>
        </div>
      )}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
