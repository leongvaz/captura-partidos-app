import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore, ROLES_PARTIDO } from '@/store/authStore';
import { api, withTemporadaQuery } from '@/lib/api';
import { db } from '@/lib/db';
import type { Partido } from '@/types/entities';
import type { PartidoLocal } from '@/lib/db';

export default function PartidosList() {
  const ligaId = useAuthStore((s) => s.liga?.id);
  const usuario = useAuthStore((s) => s.usuario);
  const usuarioId = usuario?.id;
  const canWritePartido = useAuthStore((s) => s.hasRole(...ROLES_PARTIDO));
  const isAdminLiga = useAuthStore((s) => s.hasRole('admin_liga'));
  const navigate = useNavigate();
  const canEditPartido = (p: Partido | PartidoLocal) => canWritePartido && (p.anotadorId === usuarioId || isAdminLiga);
  const canDeletePartidoLocal = (p: Partido | PartidoLocal) => canEditPartido(p);
  const canDeletePartidoServidor = (p: Partido | PartidoLocal) => canEditPartido(p) && (p.estado !== 'finalizado' || isAdminLiga);
  const [partidos, setPartidos] = useState<(Partido | PartidoLocal)[]>([]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [modalDefault, setModalDefault] = useState<{ partidoId: string; partido: Partido | PartidoLocal } | null>(null);
  const [modalGanador, setModalGanador] = useState<'local' | 'visitante' | null>(null);
  const [modalMotivo, setModalMotivo] = useState('');
  const [registrandoDefault, setRegistrandoDefault] = useState(false);

  useEffect(() => {
    if (!ligaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fromApi = await api<Partido[]>(
          withTemporadaQuery(`/partidos?ligaId=${ligaId}&fecha=${fecha}`)
        );
        const fromDb = await db.partidos.where('ligaId').equals(ligaId).filter((p) => p.fecha === fecha).toArray();
        const byId = new Map<string, Partido | PartidoLocal>();
        for (const p of fromApi) byId.set(p.id, p);
        for (const p of fromDb) {
          if (!byId.has(p.id)) byId.set(p.id, p);
          else {
            const existing = byId.get(p.id)!;
            if ((existing as PartidoLocal).synced === false) byId.set(p.id, p);
          }
        }
        if (!cancelled) setPartidos(Array.from(byId.values()));
      } catch {
        const fromDb = await db.partidos.where('ligaId').equals(ligaId).filter((p) => p.fecha === fecha).toArray();
        if (!cancelled) setPartidos(fromDb);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ligaId, fecha]);

  const confirmarDefault = async () => {
    if (!modalDefault || !modalGanador) return;
    setRegistrandoDefault(true);
    try {
      const partidoActualizado = await api<Partido>(`/partidos/${modalDefault.partidoId}/registrar-default`, {
        method: 'POST',
        body: { ganador: modalGanador, motivo: modalMotivo || undefined },
      });
      await db.partidos.put({ ...partidoActualizado, synced: true });
      setPartidos((prev) => prev.map((p) => (p.id === modalDefault.partidoId ? partidoActualizado : p)));
      setModalDefault(null);
      setModalGanador(null);
      setModalMotivo('');
    } catch (err) {
      console.error(err);
      alert('No se pudo registrar el default. Revisa la conexión.');
    } finally {
      setRegistrandoDefault(false);
    }
  };

  const abrirModalDefault = (e: React.MouseEvent, p: Partido | PartidoLocal) => {
    e.preventDefault();
    e.stopPropagation();
    setModalDefault({ partidoId: p.id, partido: p });
    setModalGanador(null);
    setModalMotivo('');
  };

  const localNombre = async (id: string) => {
    const eq = await db.equipos.get(id);
    return eq?.nombre ?? id.slice(0, 8);
  };
  const [nombres, setNombres] = useState<Record<string, string>>({});
  useEffect(() => {
    partidos.forEach(async (p) => {
      const local = await localNombre(p.localEquipoId);
      const visit = await localNombre(p.visitanteEquipoId);
      setNombres((prev) => ({ ...prev, [p.localEquipoId]: local, [p.visitanteEquipoId]: visit }));
    });
  }, [partidos]);

  const eliminarPartido = async (e: React.MouseEvent, p: Partido | PartidoLocal) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canDeletePartidoLocal(p)) return;
    const okLocal = window.confirm(
      `¿Eliminar este partido de ESTE dispositivo?\n\nEsto borrará el partido y sus eventos locales.\n\nEsta acción no se puede deshacer.`
    );
    if (!okLocal) return;

    try {
      await db.transaction(
        'rw',
        [
          db.partidos,
          db.plantilla,
          db.eventos,
          db.eventosAnulados,
          db.incidencias,
          db.fotosCierre,
          db.cierresPendientes,
        ],
        async () => {
          await db.eventos.where('partidoId').equals(p.id).delete();
          await db.eventosAnulados.where('partidoId').equals(p.id).delete();
          await db.plantilla.where('partidoId').equals(p.id).delete();
          await db.incidencias.where('partidoId').equals(p.id).delete();
          await db.fotosCierre.delete(p.id);
          await db.cierresPendientes.where('partidoId').equals(p.id).delete();
          await db.partidos.delete(p.id);
        }
      );
      setPartidos((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      console.error(err);
      alert('No se pudo eliminar el partido en este dispositivo.');
      return;
    }

    if (navigator.onLine && canDeletePartidoServidor(p)) {
      const okServidor = window.confirm(
        `¿También quieres eliminarlo del SERVIDOR?\n\nEsto lo borrará para todos los dispositivos.\n\nEsta acción no se puede deshacer.`
      );
      if (!okServidor) return;
      try {
        await api(`/partidos/${p.id}`, { method: 'DELETE' });
      } catch (err) {
        console.error(err);
        alert('El partido se eliminó localmente, pero no se pudo eliminar en el servidor (revisa permisos/conexión).');
      }
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-slate-100">Partidos del día</h2>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
        />
      </div>
      {isAdminLiga && ligaId !== 'superadmin' && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <button
            type="button"
            onClick={() => navigate('/reglas-liga')}
            className="rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm px-3 py-2 flex-1 text-center"
          >
            Modificar reglas de liga
          </button>
          <button
            type="button"
            onClick={() => navigate('/administrar-equipos')}
            className="rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm px-3 py-2 flex-1 text-center"
          >
            Administrar equipos
          </button>
        </div>
      )}
      {canWritePartido && (
        <button
          type="button"
          onClick={() => navigate(`/pruebas/alta-partido?fecha=${encodeURIComponent(fecha)}`)}
          className="w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 mb-4"
        >
          + Nuevo partido rapido
        </button>
      )}
      {canWritePartido && (
        <p className="text-xs text-slate-400 mb-4">
          Este flujo crea partidos persistidos en backend para captura rapida, aun si todavia no existe registro formal de capitanes, CURP o roster administrativo.
        </p>
      )}
      {loading ? (
        <p className="text-slate-400 text-center py-8">Cargando...</p>
      ) : partidos.length === 0 ? (
        <p className="text-slate-400 text-center py-8">
          No hay partidos para esta fecha.
          {canWritePartido && ' Crea uno arriba.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {partidos.map((p) => (
            <li key={p.id}>
              <Link
                to={
                  (p as PartidoLocal).closurePending
                    ? `/partido/${p.id}/resumen`
                    : canEditPartido(p)
                    ? p.estado === 'programado'
                      ? `/partido/${p.id}/config`
                      : p.estado === 'en_curso'
                      ? `/partido/${p.id}/captura`
                      : p.estado === 'finalizado' || p.estado === 'default_local' || p.estado === 'default_visitante'
                      ? `/partido/${p.id}/acta`
                      : `/partido/${p.id}/resumen`
                    : p.estado === 'finalizado' || p.estado === 'default_local' || p.estado === 'default_visitante'
                    ? `/partido/${p.id}/acta`
                    : `/partido/${p.id}/resumen`
                }
                className="block rounded-xl bg-slate-800 border border-slate-700 p-4 hover:border-primary-600 transition"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-100">
                    {nombres[p.localEquipoId] ?? 'Local'} vs {nombres[p.visitanteEquipoId] ?? 'Visitante'}
                  </span>
                  <span className="flex items-center gap-2">
                    {canEditPartido(p) && p.estado === 'programado' && (
                      <button
                        type="button"
                        onClick={(e) => abrirModalDefault(e, p)}
                        className="text-xs px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white"
                      >
                        Registrar default
                      </button>
                    )}
                    {canDeletePartidoLocal(p) && (
                      <button
                        type="button"
                        onClick={(e) => eliminarPartido(e, p)}
                        className="text-xs px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white"
                      >
                        Eliminar
                      </button>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${p.estado === 'finalizado' ? 'bg-slate-600' : p.estado === 'default_local' || p.estado === 'default_visitante' ? 'bg-amber-800' : p.estado === 'en_curso' ? 'bg-emerald-700' : 'bg-slate-600'}`}>
                      {p.estado}
                    </span>
                    {(p as PartidoLocal).closurePending && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-700 text-amber-100">Pendiente sync</span>
                    )}
                  </span>
                </div>
                <div className="text-sm text-slate-400 mt-1">
                  {p.categoria} · {p.horaInicio} {p.folio && `· ${p.folio}`}
                </div>
                {(p.estado === 'default_local' || p.estado === 'default_visitante') && (
                  <p className="text-sm font-medium text-amber-400 mt-1">
                    Ganador: {p.estado === 'default_visitante' ? (nombres[p.localEquipoId] ?? 'Local') : (nombres[p.visitanteEquipoId] ?? 'Visitante')}
                  </p>
                )}
                {p.estado === 'finalizado' && p.marcadorLocalFinal != null && p.marcadorVisitanteFinal != null && p.marcadorLocalFinal !== p.marcadorVisitanteFinal && (
                  <p className="text-sm font-medium text-emerald-400 mt-1">
                    Ganador: {(p.marcadorLocalFinal > p.marcadorVisitanteFinal ? nombres[p.localEquipoId] : nombres[p.visitanteEquipoId]) ?? (p.marcadorLocalFinal > p.marcadorVisitanteFinal ? 'Local' : 'Visitante')}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {modalDefault && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !registrandoDefault && setModalDefault(null)}>
          <div className="bg-slate-800 rounded-xl border border-slate-600 p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Registrar partido por default</h3>
            <p className="text-sm text-slate-400 mb-3">¿Quién gana por no presentación del rival?</p>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setModalGanador('local')}
                className={`flex-1 py-2 rounded-lg font-medium ${modalGanador === 'local' ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                Local gana
              </button>
              <button
                type="button"
                onClick={() => setModalGanador('visitante')}
                className={`flex-1 py-2 rounded-lg font-medium ${modalGanador === 'visitante' ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                Visitante gana
              </button>
            </div>
            <label className="block text-sm text-slate-400 mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={modalMotivo}
              onChange={(e) => setModalMotivo(e.target.value)}
              placeholder="Ej. No presentación"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => !registrandoDefault && setModalDefault(null)}
                className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarDefault}
                disabled={!modalGanador || registrandoDefault}
                className="flex-1 py-2 rounded-lg bg-primary-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700"
              >
                {registrandoDefault ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
