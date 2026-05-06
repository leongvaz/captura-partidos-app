import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  crearLigaAdmin,
  listarLigasAdmin,
  obtenerHistorialPersonaPorCurp,
  type HistorialPersonaResponse,
} from '@/lib/api';

interface LigaItem {
  id: string;
  nombre: string;
  temporada: string;
  categorias: string[];
  deporte?: string;
}

export default function PanelSuperAdmin() {
  const usuario = useAuthStore((s) => s.usuario);
  const [ligas, setLigas] = useState<LigaItem[]>([]);
  const [nombre, setNombre] = useState('');
  const [temporada, setTemporada] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** `${ligaId}:equipo` | `${ligaId}:organizador` */
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const [curpBusqueda, setCurpBusqueda] = useState('');
  const [historial, setHistorial] = useState<HistorialPersonaResponse | null>(null);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError, setHistorialError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listarLigasAdmin();
        if (!cancelled) setLigas(data);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!usuario?.isSuperAdmin) {
    return (
      <div className="p-4 text-slate-300">
        No tienes acceso a este panel.
      </div>
    );
  }

  const handleCrearLiga = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nombre.trim() || !temporada.trim()) {
      setError('Nombre y temporada son obligatorios.');
      return;
    }
    setLoading(true);
    try {
      const nueva = await crearLigaAdmin({ nombre: nombre.trim(), temporada: temporada.trim() });
      setLigas((prev) => [nueva, ...prev]);
      setNombre('');
      setTemporada('');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'No se pudo crear la liga.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarHistorial = async (e: React.FormEvent) => {
    e.preventDefault();
    setHistorialError(null);
    setHistorial(null);
    if (!curpBusqueda.trim()) {
      setHistorialError('Escribe una CURP.');
      return;
    }
    setHistorialLoading(true);
    try {
      const data = await obtenerHistorialPersonaPorCurp(curpBusqueda);
      setHistorial(data);
    } catch (err: unknown) {
      setHistorialError(err instanceof Error ? err.message : 'No se pudo consultar.');
    } finally {
      setHistorialLoading(false);
    }
  };

  const copyUrl = async (url: string, linkKey: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkKey(linkKey);
      setTimeout(() => setCopiedLinkKey(null), 2500);
    } catch (e) {
      console.error(e);
      alert(`No se pudo copiar. URL: ${url}`);
    }
  };

  const handleCopyLinkEquipos = (ligaId: string) => {
    const url = `${window.location.origin}/registro-equipo?ligaId=${ligaId}`;
    void copyUrl(url, `${ligaId}:equipo`);
  };

  const handleCopyLinkOrganizador = (ligaId: string) => {
    const url = `${window.location.origin}/registro-organizadora?ligaId=${ligaId}`;
    void copyUrl(url, `${ligaId}:organizador`);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Panel superadmin</h1>
      <p className="text-slate-300 text-sm">
        Aquí podrás crear nuevas ligas y ver el listado existente.
      </p>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">Crear nueva liga</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <form className="space-y-3" onSubmit={handleCrearLiga}>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Nombre de la liga</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
              placeholder="Liga Municipal de Basquetbol Texcoco"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Temporada</label>
            <input
              type="text"
              value={temporada}
              onChange={(e) => setTemporada(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
              placeholder="Primavera 2026"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 hover:bg-primary-500 disabled:opacity-60 px-4 py-2 text-sm font-medium text-white"
          >
            {loading ? 'Creando...' : 'Crear liga'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Ligas registradas</h2>
        {ligas.length === 0 ? (
          <p className="text-slate-400 text-sm">Aún no hay ligas registradas.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-200">
            {ligas.map((l) => (
              <li
                key={l.id}
                className="flex items-stretch justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              >
                <Link
                  to={`/superadmin/liga/${l.id}`}
                  className="min-w-0 flex-1 text-left rounded-md -m-1 p-1 hover:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <div className="font-medium text-primary-300">{l.nombre}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {l.deporte ? `${l.deporte} · ` : ''}
                    Temporada: {l.temporada} · Categorías: {l.categorias.join(', ') || '—'}
                  </div>
                  <span className="text-[11px] text-primary-400 mt-1 inline-block">
                    Ver reglas, categorías y equipos →
                  </span>
                </Link>
                <div className="flex flex-col items-end justify-end gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyLinkOrganizador(l.id)}
                    className="text-[11px] px-3 py-1 rounded bg-amber-700/90 hover:bg-amber-600 text-white text-right max-w-[200px]"
                  >
                    {copiedLinkKey === `${l.id}:organizador`
                      ? 'Link organizador copiado'
                      : 'Copiar link registro organizador'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyLinkEquipos(l.id)}
                    className="text-[11px] px-3 py-1 rounded bg-primary-600 hover:bg-primary-500 text-white text-right max-w-[200px]"
                  >
                    {copiedLinkKey === `${l.id}:equipo`
                      ? 'Link equipos copiado'
                      : 'Copiar link inscripción equipos'}
                  </button>
                  <div className="text-[10px] text-slate-500 text-right max-w-[140px] break-all">
                    ID: {l.id}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Historial por CURP</h2>
        <p className="text-xs text-slate-400">
          Inscripciones en ligas y partidos cerrados con resumen (puntos, faltas). Los eventos completos
          siguen en base de datos por partido.
        </p>
        <form className="flex flex-wrap gap-2 items-end" onSubmit={handleBuscarHistorial}>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-slate-300 mb-1">CURP</label>
            <input
              type="text"
              value={curpBusqueda}
              onChange={(e) => setCurpBusqueda(e.target.value.toUpperCase())}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 text-sm font-mono"
              placeholder="18 caracteres"
              maxLength={18}
            />
          </div>
          <button
            type="submit"
            disabled={historialLoading}
            className="rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-60 px-4 py-2 text-sm text-white"
          >
            {historialLoading ? 'Buscando…' : 'Consultar'}
          </button>
        </form>
        {historialError && <p className="text-sm text-red-400">{historialError}</p>}
        {historial && !historial.persona && (
          <p className="text-sm text-slate-400">No hay registros con esa CURP (aún no se ha inscrito ningún jugador con ella).</p>
        )}
        {historial?.persona && (
          <div className="space-y-3 text-sm border-t border-slate-700 pt-3">
            <div>
              <p className="text-slate-200 font-medium">
                {historial.persona.nombreDisplay || '—'} {historial.persona.apellidoDisplay || ''}
              </p>
              <p className="text-xs text-slate-500 font-mono">{historial.persona.curp}</p>
              <p className="text-xs text-slate-400 mt-1">
                Totales (partidos con resumen): {historial.totalesGlobales.partidosConResumen} partidos ·{' '}
                {historial.totalesGlobales.puntosTotales} pts · {historial.totalesGlobales.faltasTotales}{' '}
                faltas
              </p>
            </div>
            {historial.inscripciones.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-slate-500 mb-1">Inscripciones</h3>
                <ul className="space-y-1 text-slate-300 text-xs">
                  {historial.inscripciones.map((i) => (
                    <li key={i.jugadorId}>
                      {i.ligaNombre} ({i.temporadaEtiqueta}, {i.deporte}) — {i.equipoNombre} · #{i.numero}
                      {!i.activo ? ' · baja' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {historial.partidos.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-slate-500 mb-1">Partidos</h3>
                <ul className="max-h-48 overflow-y-auto space-y-1 text-xs text-slate-300">
                  {historial.partidos.map((p) => (
                    <li key={`${p.partidoId}-${p.equipo.id}`} className="border-b border-slate-700/50 pb-1">
                      {p.fecha} · {p.liga.nombre} / {p.temporada?.etiqueta ?? '—'} — {p.equipo.nombre} vs{' '}
                      {p.rivalNombre}: {p.resumen.puntos} pts
                      {p.folio ? ` · ${p.folio}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

