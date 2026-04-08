import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  obtenerLigaAdminDetalle,
  type LigaAdminDetalleEquipo,
  type LigaAdminDetalleResponse,
  type ReglasLigaConfig,
} from '@/lib/api';

function etiquetaRamas(r: ReglasLigaConfig['ramas']): string {
  const on = (Object.entries(r) as [keyof typeof r, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);
  return on.length ? on.join(', ') : '—';
}

export default function SuperAdminLigaDetalle() {
  const { ligaId } = useParams<{ ligaId: string }>();
  const usuario = useAuthStore((s) => s.usuario);
  const [data, setData] = useState<LigaAdminDetalleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ligaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await obtenerLigaAdminDetalle(ligaId);
        if (!cancelled) setData(d);
      } catch (e: unknown) {
        if (!cancelled) {
          console.error(e);
          setError(e instanceof Error ? e.message : 'No se pudo cargar la liga.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ligaId]);

  const equiposPorCat = useMemo(() => {
    const eqs = data?.equipos;
    if (!eqs?.length) return new Map<string, LigaAdminDetalleEquipo[]>();
    const m = new Map<string, LigaAdminDetalleEquipo[]>();
    for (const e of eqs) {
      const k = e.categoria || 'Sin categoría';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return m;
  }, [data]);

  if (!usuario?.isSuperAdmin) {
    return <div className="p-4 text-slate-300">No tienes acceso.</div>;
  }

  if (!ligaId) {
    return <div className="p-4 text-slate-400">Falta el identificador de la liga.</div>;
  }

  if (loading) {
    return <div className="p-4 text-slate-400">Cargando liga…</div>;
  }

  if (error || !data) {
    return (
      <div className="p-4 max-w-3xl mx-auto space-y-3">
        <p className="text-red-400 text-sm">{error || 'Sin datos'}</p>
        <Link to="/superadmin" className="text-primary-400 text-sm underline">
          Volver al listado
        </Link>
      </div>
    );
  }

  const { liga, reglas } = data;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <Link to="/superadmin" className="text-sm text-primary-400 hover:underline w-fit">
          ← Ligas registradas
        </Link>
        <h1 className="text-xl font-bold text-slate-100">{liga.nombre}</h1>
        <p className="text-sm text-slate-400">
          Deporte: {liga.deporte} · Temporada: {liga.temporada}
          <span className="text-slate-600 mx-2">·</span>
          ID: <span className="font-mono text-xs">{liga.id}</span>
        </p>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-2">
        <h2 className="text-lg font-semibold text-slate-100">Categorías configuradas</h2>
        <p className="text-sm text-slate-300">
          {liga.categorias.length ? liga.categorias.join(', ') : 'Ninguna listada en la liga.'}
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Reglas de la liga</h2>
        <ul className="text-sm text-slate-300 space-y-1.5">
          <li>
            <span className="text-slate-500">Duración por cuarto:</span> {reglas.duracionCuartoMin} min
          </li>
          <li>
            <span className="text-slate-500">Partidos de clasificación:</span>{' '}
            {reglas.partidosClasificacion}
          </li>
          <li>
            <span className="text-slate-500">Playoffs:</span> {reglas.tienePlayoffs ? 'Sí' : 'No'}
          </li>
          {reglas.temporadaFin ? (
            <li>
              <span className="text-slate-500">Fin de temporada:</span> {reglas.temporadaFin}
            </li>
          ) : null}
          <li>
            <span className="text-slate-500">Jornada de juego:</span>{' '}
            {reglas.jornadaHorario?.horaInicio ?? '—'} – {reglas.jornadaHorario?.horaFin ?? '—'}
          </li>
          <li>
            <span className="text-slate-500">Ramas activas:</span> {etiquetaRamas(reglas.ramas)}
          </li>
          <li>
            <span className="text-slate-500">Máx. jugadores por equipo:</span>{' '}
            {reglas.maxJugadoresPorEquipo}
          </li>
          <li>
            <span className="text-slate-500">Máx. invitados por partido:</span>{' '}
            {reglas.maxInvitadosPorPartido}
          </li>
          <li>
            <span className="text-slate-500">Invitados sin CURP:</span>{' '}
            {reglas.permitirInvitadosSinCurp ? 'Permitido' : 'No'}
          </li>
          {reglas.periodoInscripcion?.inicio || reglas.periodoInscripcion?.fin ? (
            <li>
              <span className="text-slate-500">Periodo de inscripción:</span>{' '}
              {reglas.periodoInscripcion?.inicio || '—'} → {reglas.periodoInscripcion?.fin || '—'}
            </li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">Equipos</h2>
        {data.equipos.length === 0 ? (
          <p className="text-sm text-slate-400">No hay equipos activos en esta liga.</p>
        ) : (
          <div className="space-y-4">
            {Array.from(equiposPorCat.entries()).map(([cat, eqs]) => (
              <div key={cat}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  {cat}
                </h3>
                <ul className="space-y-2">
                  {eqs.map((e) => (
                    <li key={e.id}>
                      <Link
                        to={`/superadmin/liga/${ligaId}/equipo/${e.id}`}
                        className="block rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 hover:border-primary-600 hover:bg-slate-900/80 transition-colors"
                      >
                        <div className="font-medium text-primary-300">{e.nombre}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {e.jugadoresActivos} jugador{e.jugadoresActivos !== 1 ? 'es' : ''} activo
                          {e.jugadoresActivos !== 1 ? 's' : ''}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
