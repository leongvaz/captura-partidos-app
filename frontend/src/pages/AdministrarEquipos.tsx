import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { ReglasLigaConfig } from '@/lib/api';
import {
  obtenerReglasLiga,
  listarEquiposLiga,
  actualizarEquipoLiga,
  eliminarEquipoLiga,
  type Equipo,
} from '@/lib/api';
import { inscripcionEquiposPermitidaPorReglas } from '@/lib/inscripcionEquipos';
import { TeamRow } from '@/components/team/TeamRow';

const RAMAS = ['varonil', 'femenil', 'mixta', 'veteranos', 'infantil'] as const;

function etiquetaRama(rama: string): string {
  return rama.charAt(0).toUpperCase() + rama.slice(1);
}

function etiquetaFuerza(f: string): string {
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
}

export default function AdministrarEquipos() {
  const navigate = useNavigate();
  const liga = useAuthStore((s) => s.liga);
  const ligaId = liga?.id;
  const isAdmin = useAuthStore((s) => s.hasRole('admin_liga'));

  const [config, setConfig] = useState<ReglasLigaConfig | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  /** Categorías expandidas (por defecto todas plegadas). */
  const [categoriaAbierta, setCategoriaAbierta] = useState<Record<string, boolean>>({});
  const [openSwipeTeamId, setOpenSwipeTeamId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!ligaId) return;
    setLoading(true);
    setError('');
    try {
      const [cfg, list] = await Promise.all([
        obtenerReglasLiga(ligaId),
        listarEquiposLiga(ligaId),
      ]);
      setConfig(cfg);
      setEquipos(list.filter((e) => e.activo));
    } catch (e) {
      console.error(e);
      setError('No se pudieron cargar equipos o reglas.');
    } finally {
      setLoading(false);
    }
  }, [ligaId]);

  useEffect(() => {
    if (!isAdmin) {
      setError('Solo el administrador de la liga puede acceder a esta sección.');
      setLoading(false);
      return;
    }
    cargar();
  }, [isAdmin, cargar]);

  const inscripcionOk = config ? inscripcionEquiposPermitidaPorReglas(config) : false;

  const combinaciones = useMemo(() => {
    if (!config) return [] as { rama: (typeof RAMAS)[number]; fuerza: string }[];
    const out: { rama: (typeof RAMAS)[number]; fuerza: string }[] = [];
    for (const rama of RAMAS) {
      if (!config.ramas[rama]) continue;
      for (const fuerza of config.fuerzasPorRama[rama] || []) {
        out.push({ rama, fuerza });
      }
    }
    return out;
  }, [config]);

  const linkBase = useMemo(() => {
    if (!ligaId || typeof window === 'undefined') return '';
    return `${window.location.origin}/registro-equipo?ligaId=${encodeURIComponent(ligaId)}`;
  }, [ligaId]);

  const linkPara = (rama: string, fuerza: string) =>
    `${linkBase}&rama=${encodeURIComponent(rama)}&fuerza=${encodeURIComponent(fuerza)}`;

  const equiposPorCategoria = useMemo(() => {
    const m = new Map<string, Equipo[]>();
    for (const e of equipos) {
      const k = e.categoria;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return m;
  }, [equipos]);

  const iniciarEdicion = (eq: Equipo) => {
    setEditId(eq.id);
    setEditNombre(eq.nombre);
  };

  const guardarNombre = async (id: string) => {
    const nombre = editNombre.trim();
    if (!nombre) return;
    setSavingId(id);
    setError('');
    try {
      const upd = await actualizarEquipoLiga(id, { nombre });
      setEquipos((prev) => prev.map((e) => (e.id === id ? upd : e)));
      setEditId(null);
    } catch (e: unknown) {
      console.error(e);
      setError((e as Error)?.message || 'No se pudo actualizar el equipo.');
    } finally {
      setSavingId(null);
    }
  };

  const eliminar = async (eq: Equipo) => {
    if (
      !confirm(
        `¿Dar de baja el equipo "${eq.nombre}"? Los jugadores quedarán inactivos en roster.`
      )
    ) {
      return;
    }
    setSavingId(eq.id);
    setError('');
    try {
      await eliminarEquipoLiga(eq.id);
      setEquipos((prev) => prev.filter((e) => e.id !== eq.id));
    } catch (e: unknown) {
      console.error(e);
      setError((e as Error)?.message || 'No se pudo eliminar el equipo.');
    } finally {
      setSavingId(null);
    }
  };

  if (!ligaId) {
    return <div className="p-4 text-slate-400">No hay liga seleccionada.</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <p className="text-red-400">{error || 'No autorizado.'}</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1">Administrar equipos</h1>
        <p className="text-slate-400 text-sm">
          Inscripción por enlace y listado de equipos por rama y fuerza según las reglas de la liga.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <section className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Inscripción de equipos (enlaces)</h2>
        {loading || !config ? (
          <p className="text-slate-400 text-sm">Cargando...</p>
        ) : inscripcionOk ? (
          <>
            <p className="text-xs text-slate-400">
              Comparte el enlace de cada categoría con quien registrará al capitán. El link fija rama y
              fuerza según lo habilitado en reglas.
            </p>
            <ul className="space-y-2">
              {combinaciones.length === 0 ? (
                <p className="text-amber-200/90 text-sm">
                  No hay ramas o fuerzas activas en reglas. Configúralas en &quot;Reglas de la liga&quot;.
                </p>
              ) : (
                combinaciones.map(({ rama, fuerza }) => {
                  const url = linkPara(rama, fuerza);
                  return (
                    <li
                      key={`${rama}-${fuerza}`}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2"
                    >
                      <span className="text-sm text-slate-200 shrink-0">
                        {etiquetaRama(rama)} · {etiquetaFuerza(fuerza)}
                      </span>
                      <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          readOnly
                          value={url}
                          className="flex-1 rounded-md bg-slate-950 border border-slate-600 text-slate-200 px-2 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(url).catch(() =>
                              alert('No se pudo copiar.')
                            );
                          }}
                          className="rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium px-3 py-1.5 shrink-0"
                        >
                          Copiar
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </>
        ) : (
          <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100/95">
            <p className="font-medium mb-1">Inscripción cerrada por reglas</p>
            <p className="text-xs text-amber-200/80">
              El período de inscripción configurado en reglas no permite altas de equipos en esta fecha.
              Ajusta el período en &quot;Reglas de la liga&quot; o espera la ventana indicada. Los enlaces no
              deben compartirse hasta entonces.
            </p>
            {config.periodoInscripcion?.inicio || config.periodoInscripcion?.fin ? (
              <p className="text-xs mt-2 text-slate-400">
                Periodo: {config.periodoInscripcion?.inicio || '—'} →{' '}
                {config.periodoInscripcion?.fin || '—'}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Equipos en la liga</h2>
            <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
              En pantallas anchas, pasa el cursor sobre la fila para ver acciones. En móvil, desliza la fila
              hacia la izquierda (igual que en Sedes y canchas).
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 sm:hidden">
              Desliza cada equipo hacia la izquierda para renombrar, jugadores o baja.
            </p>
          </div>
          <button
            type="button"
            onClick={() => cargar()}
            className="text-xs text-slate-300 hover:text-white px-2 py-1 rounded border border-slate-600"
          >
            Actualizar
          </button>
        </div>
        {loading ? (
          <p className="text-slate-400 text-sm">Cargando equipos...</p>
        ) : combinaciones.length === 0 ? (
          <p className="text-slate-400 text-sm">Configura ramas y fuerzas en reglas para ver equipos.</p>
        ) : (
          <div className="space-y-2">
            {combinaciones.map(({ rama, fuerza }) => {
              const cat = `${rama}:${fuerza}`;
              const lista = equiposPorCategoria.get(cat) || [];
              const abierta = categoriaAbierta[cat] ?? false;
              return (
                <div
                  key={cat}
                  className="overflow-hidden rounded-xl border border-slate-700/90 bg-slate-900/30 shadow-sm shadow-black/20"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setCategoriaAbierta((p) => ({
                        ...p,
                        [cat]: !p[cat],
                      }))
                    }
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-800/60"
                    aria-expanded={abierta}
                  >
                    <span className="text-sm font-semibold text-slate-100">
                      {etiquetaRama(rama)} — {etiquetaFuerza(fuerza)}
                    </span>
                    <span
                      className={`shrink-0 text-slate-400 transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`}
                      aria-hidden
                    >
                      ▼
                    </span>
                  </button>
                  {abierta ? (
                    <div className="border-t border-slate-700/80 px-2 pb-3 pt-2">
                      {lista.length === 0 ? (
                        <p className="px-1 text-sm text-slate-500">Ningún equipo en esta categoría.</p>
                      ) : (
                        <ul className="space-y-2">
                          {lista.map((eq) => (
                            <li key={eq.id}>
                              {editId === eq.id ? (
                                <div className="flex flex-col gap-2 rounded-xl border border-slate-600 bg-slate-900/60 p-3">
                                  <input
                                    type="text"
                                    value={editNombre}
                                    onChange={(e) => setEditNombre(e.target.value)}
                                    className="w-full rounded-md bg-slate-800 border border-slate-600 text-slate-100 px-2 py-1.5 text-sm"
                                    autoFocus
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={savingId === eq.id}
                                      onClick={() => guardarNombre(eq.id)}
                                      className="rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-1.5"
                                    >
                                      Guardar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditId(null)}
                                      className="rounded-md border border-slate-600 text-slate-300 text-xs px-3 py-1.5"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <TeamRow
                                  teamId={eq.id}
                                  name={eq.nombre}
                                  openSwipeId={openSwipeTeamId}
                                  onOpenSwipeId={setOpenSwipeTeamId}
                                  disabled={savingId === eq.id}
                                  onRename={() => {
                                    setOpenSwipeTeamId(null);
                                    iniciarEdicion(eq);
                                  }}
                                  onJugadores={() => {
                                    setOpenSwipeTeamId(null);
                                    navigate(`/equipo/${eq.id}/jugadores`);
                                  }}
                                  onDelete={() => {
                                    setOpenSwipeTeamId(null);
                                    eliminar(eq);
                                  }}
                                />
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
