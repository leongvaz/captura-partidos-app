import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { ReglasLigaConfig } from '@/lib/api';
import { obtenerReglasLiga, guardarReglasLiga } from '@/lib/api';
import { HourSelect, normalizeJornadaHour } from '@/components/ui/HourSelect';

/** Fin de temporada sugerido: 1 partido por semana (domingos). `yyyy-MM-dd` en calendario local. */
function sugerenciaFinTemporadaYmd(
  temporadaInicio: string | null | undefined,
  partidosClasificacion: number
): string | null {
  if (!temporadaInicio || partidosClasificacion <= 0) return null;
  const raw = String(temporadaInicio).trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const inicio = new Date(y, mo, d);
  if (Number.isNaN(inicio.getTime())) return null;
  const semanas = Math.ceil(partidosClasificacion);
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 7 * (semanas - 1));
  const yy = fin.getFullYear();
  const mm = String(fin.getMonth() + 1).padStart(2, '0');
  const dd = String(fin.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export default function ReglasLiga() {
  const liga = useAuthStore((s) => s.liga);
  const ligaId = liga?.id;
  const [config, setConfig] = useState<ReglasLigaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const FUERZAS_DISPONIBLES = ['primera', 'segunda', 'tercera', 'intermedia', 'especial'] as const;

  useEffect(() => {
    if (!ligaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const cfg = await obtenerReglasLiga(ligaId);
        if (!cancelled) {
          const sug = sugerenciaFinTemporadaYmd(cfg.temporadaInicio, cfg.partidosClasificacion);
          const temporadaFin =
            cfg.temporadaFin && String(cfg.temporadaFin).trim() !== '' ? cfg.temporadaFin : sug ?? null;
          setConfig({
            ...cfg,
            temporadaFin,
            jornadaHorario: {
              horaInicio: normalizeJornadaHour(cfg.jornadaHorario?.horaInicio, 8),
              horaFin: normalizeJornadaHour(cfg.jornadaHorario?.horaFin, 14),
            },
          });
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError('No se pudieron cargar las reglas de la liga.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ligaId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ligaId || !config) return;
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      await guardarReglasLiga(ligaId, config);
      setSavedMessage('Reglas guardadas correctamente.');
    } catch (e) {
      console.error(e);
      setError('No se pudieron guardar las reglas. Revisa la conexión.');
    } finally {
      setSaving(false);
    }
  };

  if (!ligaId) {
    return <div className="p-4 text-slate-400">No hay liga seleccionada.</div>;
  }

  if (loading || !config) {
    return <div className="p-4 text-slate-400">Cargando reglas de la liga...</div>;
  }

  const update = (patch: Partial<ReglasLigaConfig>) =>
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));

  const toggleFuerzaRama = (
    rama: keyof ReglasLigaConfig['fuerzasPorRama'],
    fuerza: string,
    checked: boolean
  ) => {
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            fuerzasPorRama: {
              ...prev.fuerzasPorRama,
              [rama]: checked
                ? Array.from(new Set([...(prev.fuerzasPorRama[rama] || []), fuerza]))
                : (prev.fuerzasPorRama[rama] || []).filter((f) => f !== fuerza),
            },
          }
        : prev
    );
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Reglas de la liga</h1>
      <p className="text-slate-400 text-sm mb-4">
        Define cómo funcionará la liga
        {liga ? ` "${liga.nombre}"` : ''}. Estas opciones se usarán para programación de partidos,
        inscripción de equipos y estadísticas.
      </p>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      {savedMessage && <p className="text-emerald-400 text-sm mb-3">{savedMessage}</p>}

      <form onSubmit={handleSave} className="space-y-6">
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Duración y calendario</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Minutos por cuarto
              </label>
              <input
                type="number"
                min={1}
                value={config.duracionCuartoMin}
                onChange={(e) => update({ duracionCuartoMin: Number(e.target.value) || 0 })}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Partidos de clasificación por equipo
              </label>
              <input
                type="number"
                min={1}
                value={config.partidosClasificacion}
                onChange={(e) => update({ partidosClasificacion: Number(e.target.value) || 0 })}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Inicio de temporada (primer partido)
              </label>
              <input
                type="date"
                value={config.temporadaInicio ?? ''}
                onChange={(e) => update({ temporadaInicio: e.target.value || null })}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label htmlFor="jornada-hora-inicio" className="block text-sm text-slate-300 mb-1">
                Inicio de jornada de juego
              </label>
              <HourSelect
                id="jornada-hora-inicio"
                fallbackHour={8}
                value={normalizeJornadaHour(config.jornadaHorario?.horaInicio, 8)}
                onChange={(hhmm) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          jornadaHorario: {
                            ...prev.jornadaHorario,
                            horaInicio: hhmm,
                          },
                        }
                      : prev
                  )
                }
              />
            </div>
            <div>
              <label htmlFor="jornada-hora-fin" className="block text-sm text-slate-300 mb-1">
                Fin de jornada (último partido)
              </label>
              <HourSelect
                id="jornada-hora-fin"
                fallbackHour={14}
                value={normalizeJornadaHour(config.jornadaHorario?.horaFin, 14)}
                onChange={(hhmm) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          jornadaHorario: {
                            ...prev.jornadaHorario,
                            horaFin: hhmm,
                          },
                        }
                      : prev
                  )
                }
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Solo horas en punto (00 min). El horario de fin es el tope para que el último partido del día pueda
            jugarse (inicio o cierre dentro de la jornada, según acuerden en la liga).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div>
              <label htmlFor="temporada-fin" className="block text-sm text-slate-300 mb-1">
                Fin de temporada (último día)
              </label>
              <input
                id="temporada-fin"
                type="date"
                value={config.temporadaFin ?? ''}
                onChange={(e) => update({ temporadaFin: e.target.value || null })}
                className="w-full max-w-xs rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">
                La primera vez se rellena con la sugerencia (inicio + partidos de clasificación, 1 por semana,
                domingos). Puedes cambiar la fecha y guardar.
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="tienePlayoffs"
              type="checkbox"
              checked={config.tienePlayoffs}
              onChange={(e) => update({ tienePlayoffs: e.target.checked })}
              className="rounded border-slate-600 bg-slate-700 text-primary-600"
            />
            <label htmlFor="tienePlayoffs" className="text-sm text-slate-300">
              Usar torneo de playoffs para definir campeón
            </label>
          </div>
        </section>

        <section className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Ramas y fuerzas</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {(['varonil', 'femenil', 'mixta', 'veteranos', 'infantil'] as const).map((rama) => (
              <label key={rama} className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={config.ramas[rama]}
                  onChange={(e) =>
                    setConfig((prev) =>
                      prev
                        ? { ...prev, ramas: { ...prev.ramas, [rama]: e.target.checked } }
                        : prev
                    )
                  }
                  className="rounded border-slate-600 bg-slate-700 text-primary-600"
                />
                {rama.charAt(0).toUpperCase() + rama.slice(1)}
              </label>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            {(['varonil', 'femenil', 'mixta', 'veteranos', 'infantil'] as const).map((rama) => {
              if (!config.ramas[rama]) return null;
              const seleccionadas = new Set(config.fuerzasPorRama[rama] || []);
              return (
                <div key={rama} className="border-t border-slate-700 pt-2">
                  <p className="text-sm font-medium text-slate-200 mb-1">
                    Fuerzas para {rama}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                    {FUERZAS_DISPONIBLES.map((f) => (
                      <label
                        key={f}
                        className="flex items-center gap-2 text-xs md:text-sm text-slate-300"
                      >
                        <input
                          type="checkbox"
                          checked={seleccionadas.has(f)}
                          onChange={(e) => toggleFuerzaRama(rama, f, e.target.checked)}
                          className="rounded border-slate-600 bg-slate-700 text-primary-600"
                        />
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Plantillas y jugadores</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Máximo jugadores por equipo
              </label>
              <input
                type="number"
                min={1}
                value={config.maxJugadoresPorEquipo}
                onChange={(e) =>
                  update({ maxJugadoresPorEquipo: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Máximo invitados por partido
              </label>
              <input
                type="number"
                min={0}
                value={config.maxInvitadosPorPartido}
                onChange={(e) =>
                  update({ maxInvitadosPorPartido: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 mt-5 md:mt-6">
              <input
                id="permitirInvitadosSinCurp"
                type="checkbox"
                checked={config.permitirInvitadosSinCurp}
                onChange={(e) => update({ permitirInvitadosSinCurp: e.target.checked })}
                className="rounded border-slate-600 bg-slate-700 text-primary-600"
              />
              <label htmlFor="permitirInvitadosSinCurp" className="text-sm text-slate-300">
                Permitir invitados sin CURP para completar equipo
              </label>
            </div>
          </div>
        </section>

        <section className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Inscripción de equipos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Inicio de inscripción
              </label>
              <input
                type="date"
                value={config.periodoInscripcion?.inicio ?? ''}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          periodoInscripcion: {
                            ...(prev.periodoInscripcion || {}),
                            inicio: e.target.value || null,
                          },
                        }
                      : prev
                  )
                }
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Fin de inscripción
              </label>
              <input
                type="date"
                value={config.periodoInscripcion?.fin ?? ''}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          periodoInscripcion: {
                            ...(prev.periodoInscripcion || {}),
                            fin: e.target.value || null,
                          },
                        }
                      : prev
                  )
                }
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Después de la fecha de fin de inscripción, la creación de nuevos equipos se
            deshabilitará (regla de negocio a implementar en backend).
          </p>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium px-4 py-2 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar reglas'}
          </button>
        </div>
      </form>

      {savedMessage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 max-w-sm w-full shadow-xl">
            <h2 className="text-lg font-semibold text-slate-100 mb-2">Reglas guardadas</h2>
            <p className="text-sm text-slate-300 mb-4">{savedMessage}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSavedMessage('')}
                className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium px-4 py-2"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

