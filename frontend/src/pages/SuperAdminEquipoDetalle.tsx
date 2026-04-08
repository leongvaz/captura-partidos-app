import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { obtenerEquipoAdminDetalle, type EquipoAdminDetalleResponse } from '@/lib/api';

export default function SuperAdminEquipoDetalle() {
  const { ligaId, equipoId } = useParams<{ ligaId: string; equipoId: string }>();
  const usuario = useAuthStore((s) => s.usuario);
  const [data, setData] = useState<EquipoAdminDetalleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!equipoId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await obtenerEquipoAdminDetalle(equipoId);
        if (!cancelled) setData(d);
      } catch (e: unknown) {
        if (!cancelled) {
          console.error(e);
          setError(e instanceof Error ? e.message : 'No se pudo cargar el equipo.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [equipoId]);

  if (!usuario?.isSuperAdmin) {
    return <div className="p-4 text-slate-300">No tienes acceso.</div>;
  }

  if (!equipoId || !ligaId) {
    return <div className="p-4 text-slate-400">Faltan parámetros de ruta.</div>;
  }

  if (loading) {
    return <div className="p-4 text-slate-400">Cargando equipo…</div>;
  }

  if (error || !data) {
    return (
      <div className="p-4 max-w-3xl mx-auto space-y-3">
        <p className="text-red-400 text-sm">{error || 'Sin datos'}</p>
        <Link to={`/superadmin/liga/${ligaId}`} className="text-primary-400 text-sm underline">
          Volver a la liga
        </Link>
      </div>
    );
  }

  const { equipo, jugadores } = data;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <Link
          to={`/superadmin/liga/${equipo.ligaId}`}
          className="text-sm text-primary-400 hover:underline w-fit"
        >
          ← Volver a la liga
        </Link>
        <h1 className="text-xl font-bold text-slate-100">{equipo.nombre}</h1>
        <p className="text-sm text-slate-400">
          Categoría: <span className="text-slate-300">{equipo.categoria}</span>
          <span className="text-slate-600 mx-2">·</span>
          ID: <span className="font-mono text-xs">{equipo.id}</span>
        </p>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h2 className="text-lg font-semibold text-slate-100 mb-3">Jugadores activos</h2>
        {jugadores.length === 0 ? (
          <p className="text-sm text-slate-400">No hay jugadores activos.</p>
        ) : (
          <ul className="divide-y divide-slate-700 border border-slate-700 rounded-lg overflow-hidden">
            {jugadores.map((j) => (
              <li
                key={j.id}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-900 text-sm text-slate-200"
              >
                <span>
                  <span className="text-slate-500 font-mono w-8 inline-block">#{j.numero}</span>
                  {j.nombre} {j.apellido}
                  {j.invitado ? (
                    <span className="ml-2 text-xs text-amber-400">Invitado</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
