import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  listarSedes,
  crearSede,
  crearCanchaEnSede,
  actualizarSede,
  actualizarCancha,
  type SedeConCanchas,
} from '@/lib/api';
import { CourtRow } from '@/components/courts';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function SedesCanchas() {
  const ligaId = useAuthStore((s) => s.liga?.id);
  const ligaNombre = useAuthStore((s) => s.liga?.nombre);
  const hasRole = useAuthStore((s) => s.hasRole);
  const narrow = useMediaQuery('(max-width: 767px)');

  const [sedes, setSedes] = useState<SedeConCanchas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nuevaSede, setNuevaSede] = useState('');
  const [guardandoSede, setGuardandoSede] = useState(false);

  const [filasCanchaPorSede, setFilasCanchaPorSede] = useState<Record<string, string[]>>({});
  const [guardandoCanchasSedeId, setGuardandoCanchasSedeId] = useState<string | null>(null);

  const [editarSede, setEditarSede] = useState<{ id: string; nombre: string } | null>(null);
  const [editarCancha, setEditarCancha] = useState<{ id: string; nombre: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [swipeOpenCanchaId, setSwipeOpenCanchaId] = useState<string | null>(null);
  const [addAbierto, setAddAbierto] = useState<Record<string, boolean>>({});
  /** Solo una sede expandida a la vez; el resto se ven como tarjetas compactas. */
  const [sedeExpandidaId, setSedeExpandidaId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!ligaId) return;
    setError(null);
    setLoading(true);
    try {
      const data = await listarSedes(ligaId);
      setSedes(data);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las sedes.');
      setSedes([]);
    } finally {
      setLoading(false);
    }
  }, [ligaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const asegurarFilas = (sedeId: string) => {
    setFilasCanchaPorSede((prev) => {
      if (prev[sedeId]) return prev;
      return { ...prev, [sedeId]: [''] };
    });
  };

  const agregarFilaCancha = (sedeId: string) => {
    setFilasCanchaPorSede((prev) => ({
      ...prev,
      [sedeId]: [...(prev[sedeId] || ['']), ''],
    }));
  };

  const setFilaCancha = (sedeId: string, index: number, valor: string) => {
    setFilasCanchaPorSede((prev) => {
      const filas = [...(prev[sedeId] || [''])];
      filas[index] = valor;
      return { ...prev, [sedeId]: filas };
    });
  };

  const handleGuardarSede = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ligaId || !nuevaSede.trim()) return;
    setGuardandoSede(true);
    setError(null);
    try {
      await crearSede(ligaId, nuevaSede.trim());
      setNuevaSede('');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la sede.');
    } finally {
      setGuardandoSede(false);
    }
  };

  const handleGuardarCanchas = async (sedeId: string) => {
    const filas = (filasCanchaPorSede[sedeId] || [''])
      .map((s) => s.trim())
      .filter(Boolean);
    if (filas.length === 0) {
      setError('Escribe al menos un nombre de cancha.');
      return;
    }
    setGuardandoCanchasSedeId(sedeId);
    setError(null);
    try {
      for (const nombre of filas) {
        await crearCanchaEnSede(sedeId, nombre);
      }
      setFilasCanchaPorSede((prev) => ({ ...prev, [sedeId]: [''] }));
      setAddAbierto((prev) => ({ ...prev, [sedeId]: false }));
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron registrar las canchas.');
    } finally {
      setGuardandoCanchasSedeId(null);
    }
  };

  const guardarEdicionSede = async () => {
    if (!editarSede?.nombre.trim()) {
      setError('El nombre de la sede no puede quedar vacío.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await actualizarSede(editarSede.id, { nombre: editarSede.nombre.trim() });
      setEditarSede(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la sede.');
    } finally {
      setBusy(false);
    }
  };

  const eliminarSede = async (sede: SedeConCanchas) => {
    const n = sede.canchas.length;
    const msg =
      n > 0
        ? `¿Dar de baja la sede "${sede.nombre}" y sus ${n} cancha(s)? Los partidos ya jugados conservan el registro; no podrás elegir estas canchas en partidos nuevos.`
        : `¿Dar de baja la sede "${sede.nombre}"?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      await actualizarSede(sede.id, { activo: false });
      setEditarSede((e) => (e?.id === sede.id ? null : e));
      setSedeExpandidaId((id) => (id === sede.id ? null : id));
      setSwipeOpenCanchaId(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la sede.');
    } finally {
      setBusy(false);
    }
  };

  const guardarEdicionCancha = async () => {
    if (!editarCancha?.nombre.trim()) {
      setError('El nombre de la cancha no puede quedar vacío.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await actualizarCancha(editarCancha.id, { nombre: editarCancha.nombre.trim() });
      setEditarCancha(null);
      setSwipeOpenCanchaId(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la cancha.');
    } finally {
      setBusy(false);
    }
  };

  const eliminarCancha = async (canchaId: string, nombre: string, sedeNombre: string) => {
    if (
      !window.confirm(
        `¿Dar de baja la cancha "${nombre}" (${sedeNombre})? No podrás usarla en partidos nuevos; los partidos ya capturados no se borran.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await actualizarCancha(canchaId, { activo: false });
      setEditarCancha((e) => (e?.id === canchaId ? null : e));
      setSwipeOpenCanchaId(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la cancha.');
    } finally {
      setBusy(false);
    }
  };

  if (!hasRole('admin_liga')) {
    return (
      <div className="p-4 text-slate-300 max-w-2xl mx-auto">
        Solo el organizador de la liga (rol admin) puede configurar sedes y canchas.
      </div>
    );
  }

  if (!ligaId) {
    return <div className="p-4 text-slate-400">No hay liga en la sesión.</div>;
  }

  const iconBtn =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-600/80 bg-slate-800/80 text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-40';
  const iconBtnDanger =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-900/50 bg-red-950/20 text-red-300 transition hover:bg-red-950/40 disabled:opacity-40';

  return (
    <div className="p-4 max-w-xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">Sedes y canchas</h1>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
          <span className="text-slate-400">{ligaNombre}</span>
          <span className="mx-1.5 text-slate-600">·</span>
          En actas verás <span className="text-slate-400">Sede — Cancha</span>.
        </p>
        {narrow && (
          <p className="mt-2 text-xs text-sky-500/90 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            Desliza una cancha hacia la izquierda para editarla o darla de baja.
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2">{error}</p>
      )}

      <section className="rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-800/90 to-slate-800/50 p-4 shadow-lg shadow-black/20">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Nueva sede</h2>
        <form onSubmit={handleGuardarSede} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0">
            <label className="sr-only">Nombre de la sede</label>
            <input
              type="text"
              value={nuevaSede}
              onChange={(e) => setNuevaSede(e.target.value)}
              placeholder="Ej. Deportivo Silverio Pérez"
              className="w-full rounded-xl bg-slate-900/80 border border-slate-600/80 px-4 py-3 text-slate-100 text-sm placeholder:text-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition"
            />
          </div>
          <button
            type="submit"
            disabled={guardandoSede || !nuevaSede.trim()}
            className="rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-40 px-5 py-3 text-sm font-medium text-white shrink-0 transition"
          >
            {guardandoSede ? 'Guardando…' : 'Añadir sede'}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 px-0.5">Sedes registradas</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
            <span className="h-4 w-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
            Cargando…
          </div>
        ) : sedes.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8 rounded-2xl border border-dashed border-slate-700">
            Aún no hay sedes. Crea la primera arriba.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {sedes.map((s) => {
              const expandida = sedeExpandidaId === s.id;
              return (
                <li
                  key={s.id}
                  className={`rounded-2xl border bg-slate-800/50 overflow-hidden shadow-md shadow-black/15 transition-[border-color,box-shadow] duration-200 ${
                    expandida
                      ? 'border-primary-500/35 ring-1 ring-primary-500/20 sm:col-span-2'
                      : 'border-slate-700/70 hover:border-slate-600 hover:shadow-lg'
                  }`}
                >
                  <div className="h-1 bg-gradient-to-r from-primary-600/80 via-sky-500/60 to-slate-600/40" />

                  <div className={`p-4 ${expandida ? 'border-b border-slate-700/60' : ''}`}>
                    {editarSede?.id === s.id ? (
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-700/60 text-sky-400/90">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-xs text-slate-500">Nombre de la sede</p>
                          <input
                            type="text"
                            value={editarSede.nombre}
                            onChange={(e) => setEditarSede({ id: s.id, nombre: e.target.value })}
                            className="w-full rounded-xl bg-slate-900 border border-slate-600 px-3 py-2 text-slate-100 text-sm"
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void guardarEdicionSede()}
                            className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setEditarSede(null)}
                            className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 gap-3 rounded-xl text-left outline-none transition hover:bg-slate-900/40 focus-visible:ring-2 focus-visible:ring-primary-500/50 -m-1 p-1"
                          onClick={() => {
                            setSedeExpandidaId((prev) => (prev === s.id ? null : s.id));
                            setSwipeOpenCanchaId(null);
                          }}
                          aria-expanded={expandida}
                          aria-controls={`sede-canchas-${s.id}`}
                          id={`sede-card-${s.id}`}
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-700/60 text-sky-400/90">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                          </span>
                          <span className="min-w-0 flex-1 pt-0.5">
                            <span className="font-semibold text-slate-100 text-lg leading-tight block">
                              {s.nombre}
                            </span>
                            <span className="text-xs text-slate-500 mt-1 block">
                              {s.canchas.length === 0
                                ? 'Sin canchas'
                                : `${s.canchas.length} cancha${s.canchas.length === 1 ? '' : 's'}`}
                              {!expandida && (
                                <span className="text-slate-600"> · Toca para ver y editar</span>
                              )}
                            </span>
                            {expandida && (
                              <span className="text-xs text-primary-400/90 mt-1.5 block">
                                Toca de nuevo la tarjeta para ocultar las canchas
                              </span>
                            )}
                          </span>
                        </button>
                        <div className="flex gap-1.5 shrink-0 pt-0.5">
                          <button
                            type="button"
                            disabled={busy || !!editarCancha}
                            onClick={() => {
                              setSedeExpandidaId(s.id);
                              setEditarSede({ id: s.id, nombre: s.nombre });
                            }}
                            className={iconBtn}
                            title="Editar sede"
                          >
                            <IconPencil className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            disabled={busy || !!editarCancha}
                            onClick={() => void eliminarSede(s)}
                            className={iconBtnDanger}
                            title="Eliminar sede"
                          >
                            <IconTrash className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {expandida && (
                    <div
                      id={`sede-canchas-${s.id}`}
                      role="region"
                      aria-labelledby={`sede-card-${s.id}`}
                      className="px-4 pb-4 space-y-2"
                      onFocus={() => asegurarFilas(s.id)}
                    >
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-600 pt-1">
                        Canchas
                      </p>
                      {s.canchas.length > 0 ? (
                        <ul className="space-y-2">
                          {s.canchas.map((c) => (
                            <li key={c.id}>
                              {editarCancha?.id === c.id ? (
                                <div className="rounded-xl border border-slate-600 bg-slate-900/80 p-3 space-y-2">
                                  <input
                                    type="text"
                                    value={editarCancha.nombre}
                                    onChange={(e) => setEditarCancha({ id: c.id, nombre: e.target.value })}
                                    className="w-full rounded-lg bg-slate-950 border border-slate-600 px-3 py-2 text-slate-100 text-sm"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void guardarEdicionCancha()}
                                      className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                                    >
                                      Guardar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => setEditarCancha(null)}
                                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <CourtRow
                                  courtId={c.id}
                                  name={c.nombre}
                                  openSwipeId={swipeOpenCanchaId}
                                  onOpenSwipeId={setSwipeOpenCanchaId}
                                  disabled={busy || !!editarSede}
                                  onEdit={() => setEditarCancha({ id: c.id, nombre: c.nombre })}
                                  onDelete={() => void eliminarCancha(c.id, c.nombre, s.nombre)}
                                />
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-600 italic py-1">Ninguna cancha aún.</p>
                      )}

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setAddAbierto((prev) => {
                              const next = !prev[s.id];
                              if (next) asegurarFilas(s.id);
                              return { ...prev, [s.id]: next };
                            })
                          }
                          className="flex w-full items-center justify-between rounded-xl border border-slate-600/60 bg-slate-900/30 px-3 py-2.5 text-left text-sm text-slate-400 hover:border-slate-500 hover:text-slate-300 transition"
                        >
                          <span>Añadir canchas a esta sede</span>
                          <span
                            className={`text-slate-500 transition-transform ${addAbierto[s.id] ? 'rotate-180' : ''}`}
                          >
                            ▼
                          </span>
                        </button>
                        {addAbierto[s.id] && (
                          <div className="mt-2 space-y-2 rounded-xl border border-slate-700/60 bg-slate-900/25 p-3">
                            {(filasCanchaPorSede[s.id] || ['']).map((valor, idx) => (
                              <input
                                key={idx}
                                type="text"
                                value={valor}
                                onChange={(e) => setFilaCancha(s.id, idx, e.target.value)}
                                onFocus={() => asegurarFilas(s.id)}
                                placeholder={`Nombre cancha ${idx + 1}`}
                                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-slate-100 text-sm placeholder:text-slate-600"
                              />
                            ))}
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  asegurarFilas(s.id);
                                  agregarFilaCancha(s.id);
                                }}
                                className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                              >
                                + Otra fila
                              </button>
                              <button
                                type="button"
                                disabled={guardandoCanchasSedeId === s.id || busy}
                                onClick={() => handleGuardarCanchas(s.id)}
                                className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
                              >
                                {guardandoCanchasSedeId === s.id ? 'Guardando…' : 'Guardar canchas'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
