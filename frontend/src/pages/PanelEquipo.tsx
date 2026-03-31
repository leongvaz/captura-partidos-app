import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { listarMisEquipos, type Equipo } from '@/lib/api';

export default function PanelEquipo() {
  const usuario = useAuthStore((s) => s.usuario);
  const liga = useAuthStore((s) => s.liga);
  const navigate = useNavigate();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!usuario || !liga) {
    return (
      <div className="p-4 text-slate-400">
        No hay sesión activa. Inicia sesión con tu cuenta de capitán para ver este panel.
      </div>
    );
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await listarMisEquipos();
        if (!cancelled) setEquipos(data);
      } catch (e: any) {
        if (!cancelled) {
          console.error(e);
          setError(e?.message || 'No se pudieron cargar tus equipos.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Panel de capitán</h1>
      <p className="text-slate-400 text-sm">
        Bienvenido, <span className="font-medium text-slate-100">{usuario.nombre}</span>. Aquí podrás
        registrar equipos y gestionar la lista de jugadores de cada uno en la liga{' '}
        <span className="font-medium text-slate-100">{liga.nombre}</span>.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() =>
            navigate(`/registro-equipo?ligaId=${encodeURIComponent(liga.id)}`)
          }
          className="flex-1 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium px-4 py-2 text-sm text-center"
        >
          Registrar otro equipo
        </button>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="flex-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium px-4 py-2 text-sm text-center"
        >
          Ir al panel principal
        </button>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Mis equipos</h2>
        {loading ? (
          <p className="text-slate-400 text-sm">Cargando equipos...</p>
        ) : error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : equipos.length === 0 ? (
          <p className="text-slate-400 text-sm">
            Aún no has registrado equipos. Usa el botón "Registrar otro equipo" para crear uno.
          </p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-200">
            {equipos.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              >
                <div>
                  <div className="font-medium">{e.nombre}</div>
                  <div className="text-xs text-slate-400">Categoría: {e.categoria}</div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/equipo/${e.id}/jugadores`)}
                  className="text-[11px] px-3 py-1 rounded bg-primary-600 hover:bg-primary-500 text-white"
                >
                  Gestionar jugadores
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

