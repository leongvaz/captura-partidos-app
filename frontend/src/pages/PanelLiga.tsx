import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api, getStoredTemporadaId } from '@/lib/api';

interface PartidoPanel {
  id: string;
  fecha: string;
  horaInicio: string;
  estado: string;
  folio: string | null;
  localEquipo: { id: string; nombre: string };
  visitanteEquipo: { id: string; nombre: string };
  cancha: string;
  resultado: { local: number; visitante: number };
}

interface EquipoStats {
  equipoId: string;
  nombre: string;
  PJ: number;
  PG: number;
  PP: number;
  PF: number;
  PC: number;
  DIF: number;
}

export default function PanelLiga() {
  const ligaId = useAuthStore((s) => s.liga?.id);
  const [partidos, setPartidos] = useState<PartidoPanel[]>([]);
  const [equiposStats, setEquiposStats] = useState<EquipoStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [conIncidencia, setConIncidencia] = useState(false);

  useEffect(() => {
    if (!ligaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({ ligaId });
        if (conIncidencia) query.set('conIncidencia', 'true');
        const tid = getStoredTemporadaId();
        if (tid) query.set('temporadaId', tid);
        const eqQ = new URLSearchParams({ ligaId });
        if (tid) eqQ.set('temporadaId', tid);
        const [list, stats] = await Promise.all([
          api<PartidoPanel[]>(`/liga/panel?${query.toString()}`),
          api<EquipoStats[]>(`/liga/equipos-estadisticas?${eqQ.toString()}`),
        ]);
        if (!cancelled) {
          setPartidos(list);
          setEquiposStats(stats);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setPartidos([]);
          setEquiposStats([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ligaId, conIncidencia]);

  if (!ligaId) {
    return (
      <div className="p-4 text-slate-400">Selecciona una liga para ver el panel.</div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-slate-100 mb-4">Panel de liga</h1>

      <label className="flex items-center gap-2 mb-4 text-slate-300">
        <input
          type="checkbox"
          checked={conIncidencia}
          onChange={(e) => setConIncidencia(e.target.checked)}
          className="rounded border-slate-600 bg-slate-700 text-primary-600"
        />
        Solo con incidencias
      </label>

      {loading ? (
        <p className="text-slate-400 py-8">Cargando...</p>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-slate-200 mb-2">Partidos finalizados</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-slate-300 border-b border-slate-600">
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Partido</th>
                    <th className="px-3 py-2 text-center">Resultado</th>
                    <th className="px-3 py-2">Folio</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {partidos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-slate-400 text-center">
                        No hay partidos que coincidan con el filtro.
                      </td>
                    </tr>
                  ) : (
                    partidos.map((p) => (
                      <tr key={p.id} className="border-b border-slate-700 text-slate-300">
                        <td className="px-3 py-2">{p.fecha} {p.horaInicio}</td>
                        <td className="px-3 py-2">
                          <Link to={`/partido/${p.id}/acta`} className="text-primary-400 hover:underline">
                            {p.localEquipo.nombre} vs {p.visitanteEquipo.nombre}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-center font-medium">
                          {p.resultado.local} - {p.resultado.visitante}
                        </td>
                        <td className="px-3 py-2">{p.folio ?? '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${p.estado === 'finalizado' ? 'bg-slate-600' : 'bg-amber-800'}`}>
                            {p.estado}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-200 mb-2">Estadísticas por equipo</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-slate-300 border-b border-slate-600">
                    <th className="px-3 py-2">Equipo</th>
                    <th className="px-3 py-2 text-right">PJ</th>
                    <th className="px-3 py-2 text-right">PG</th>
                    <th className="px-3 py-2 text-right">PP</th>
                    <th className="px-3 py-2 text-right">PF</th>
                    <th className="px-3 py-2 text-right">PC</th>
                    <th className="px-3 py-2 text-right">DIF</th>
                  </tr>
                </thead>
                <tbody>
                  {[...equiposStats]
                    .sort((a, b) => {
                      // PF desc, luego DIF desc, luego nombre asc
                      if (b.PF !== a.PF) return b.PF - a.PF;
                      if (b.DIF !== a.DIF) return b.DIF - a.DIF;
                      return a.nombre.localeCompare(b.nombre);
                    })
                    .map((eq) => (
                    <tr key={eq.equipoId} className="border-b border-slate-700 text-slate-300">
                      <td className="px-3 py-2 font-medium">{eq.nombre}</td>
                      <td className="px-3 py-2 text-right">{eq.PJ}</td>
                      <td className="px-3 py-2 text-right text-emerald-400">{eq.PG}</td>
                      <td className="px-3 py-2 text-right text-red-400">{eq.PP}</td>
                      <td className="px-3 py-2 text-right">{eq.PF}</td>
                      <td className="px-3 py-2 text-right">{eq.PC}</td>
                      <td className={`px-3 py-2 text-right font-medium ${eq.DIF > 0 ? 'text-emerald-400' : eq.DIF < 0 ? 'text-red-400' : ''}`}>
                        {eq.DIF > 0 ? '+' : ''}{eq.DIF}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
