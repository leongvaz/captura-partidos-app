import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/db';
import { api } from '@/lib/api';
import { usePartidoStore } from '@/store/partidoStore';
import { useSyncStore } from '@/store/syncStore';
import CronometroPartido from '@/components/CronometroPartido';
import type { TipoEvento } from '@/types/entities';
import type { Jugador } from '@/types/entities';
import type { Partido } from '@/types/entities';
import type { PlantillaPartido } from '@/types/entities';
import type { EventoLocal, PartidoLocal } from '@/lib/db';

async function ensurePartidoEnDexie(partidoId: string): Promise<boolean> {
  const p = await db.partidos.get(partidoId);
  if (p) return true;
  try {
    const partido = await api<Partido>(`/partidos/${partidoId}`);
    await db.partidos.put({ ...partido, synced: true });
    const plantilla = await api<PlantillaPartido[]>(`/partidos/${partidoId}/plantilla`);
    for (const pl of plantilla) await db.plantilla.put(pl);
    const eventos = await api<Array<{ id: string; partidoId: string; tipo: string; jugadorId: string; jugadorEntraId?: string; minutoPartido: number; cuarto: number; orden: number; createdAt: string }>>(`/partidos/${partidoId}/eventos`);
    for (const e of eventos) await db.eventos.put({ ...e, synced: true } as EventoLocal);
    return true;
  } catch {
    return false;
  }
}

export default function Captura() {
  const { partidoId } = useParams<{ partidoId: string }>();
  const navigate = useNavigate();
  const usuarioId = useAuthStore((s) => s.usuario?.id);
  const isAdminLiga = useAuthStore((s) => s.hasRole('admin_liga'));
  const {
    partidoActual,
    plantilla,
    eventos,
    jugadorSeleccionadoId,
    setPartidoActual,
    loadPartido,
    hidratarCronoDesdePartidoLocal,
    seleccionarJugador,
    agregarEvento,
    deshacerUltimoEvento,
    getJugadoresEnCancha,
    getPuntosJugador,
    getFaltasJugador,
    getFaltasPersonalesJugador,
    getFaltasAntideportivasJugador,
    getFaltasTecnicasJugador,
    isJugadorExpulsado,
  } = usePartidoStore();
  const [equipoActivo, setEquipoActivo] = useState<'local' | 'visitante'>('local');
  const [jugadoresMap, setJugadoresMap] = useState<Record<string, Jugador>>({});
  const [showTL, setShowTL] = useState(false);
  const [showFaltaTipo, setShowFaltaTipo] = useState(false);
  const [modalExpulsado, setModalExpulsado] = useState(false);

  useEffect(() => {
    if (!partidoId) return;
    (async () => {
      const ok = await ensurePartidoEnDexie(partidoId);
      if (!ok) {
        navigate('/');
        return;
      }
      const p = await db.partidos.get(partidoId);
      if (!p) {
        navigate('/');
        return;
      }
      if (p.estado === 'finalizado' || p.estado === 'default_local' || p.estado === 'default_visitante') {
        navigate(`/partido/${partidoId}/resumen`);
        return;
      }
      if (p.anotadorId !== usuarioId && !isAdminLiga) {
        navigate(`/partido/${partidoId}/resumen`);
        return;
      }
      setPartidoActual(p);
      await loadPartido(partidoId);
      hidratarCronoDesdePartidoLocal(p as PartidoLocal);
      const allJ = await db.jugadores.toArray();
      const map: Record<string, Jugador> = {};
      allJ.forEach((j) => { map[j.id] = j; });
      setJugadoresMap(map);
    })();
  }, [partidoId, navigate, loadPartido, setPartidoActual, hidratarCronoDesdePartidoLocal]);

  const partido = partidoActual;
  if (!partido) return <div className="p-4 text-slate-400">Cargando...</div>;

  const equipoId = equipoActivo === 'local' ? partido.localEquipoId : partido.visitanteEquipoId;
  const enCancha = getJugadoresEnCancha(equipoId);
  const enCanchaLocal = getJugadoresEnCancha(partido.localEquipoId);
  const enCanchaVisitante = getJugadoresEnCancha(partido.visitanteEquipoId);
  const expulsadosEnCancha = [...enCanchaLocal, ...enCanchaVisitante]
    .map((pl) => ({ pl, j: jugadoresMap[pl.jugadorId] }))
    .filter(({ j }) => j && isJugadorExpulsado(j.id)) as { pl: PlantillaPartido; j: Jugador }[];
  const puntosLocal = plantilla.filter((p) => p.equipoId === partido.localEquipoId).reduce((s, p) => s + getPuntosJugador(p.jugadorId), 0);
  const puntosVisitante = plantilla.filter((p) => p.equipoId === partido.visitanteEquipoId).reduce((s, p) => s + getPuntosJugador(p.jugadorId), 0);

  const handleEvento = async (tipo: TipoEvento) => {
    if (tipo === 'tiro_libre_anotado' || tipo === 'tiro_libre_fallado') {
      if (!jugadorSeleccionadoId) return;
      if (isJugadorExpulsado(jugadorSeleccionadoId)) {
        setModalExpulsado(true);
        return;
      }
      await agregarEvento('tiro_libre_anotado');
      return;
    }
    if (tipo === 'falta_personal' || tipo === 'falta_antideportiva' || tipo === 'falta_tecnica') {
      if (!jugadorSeleccionadoId) return;
      if (isJugadorExpulsado(jugadorSeleccionadoId)) {
        setModalExpulsado(true);
        return;
      }
      setShowFaltaTipo(true);
      return;
    }
    if (!jugadorSeleccionadoId) return;
    if (isJugadorExpulsado(jugadorSeleccionadoId)) {
      setModalExpulsado(true);
      return;
    }
    await agregarEvento(tipo);
  };

  const handleFaltaTipo = async (tipo: 'falta_personal' | 'falta_antideportiva' | 'falta_tecnica') => {
    if (!jugadorSeleccionadoId || !partido) return;
    setShowFaltaTipo(false);
    await agregarEvento(tipo);
    const j = jugadoresMap[jugadorSeleccionadoId];
    const personales = getFaltasPersonalesJugador(jugadorSeleccionadoId);
    const antideportivas = getFaltasAntideportivasJugador(jugadorSeleccionadoId);
    const tecnicas = getFaltasTecnicasJugador(jugadorSeleccionadoId);
    if (isJugadorExpulsado(jugadorSeleccionadoId)) {
      const pl = plantilla.find((p) => p.jugadorId === jugadorSeleccionadoId);
      const equipoId = pl?.equipoId ?? partido.localEquipoId;
      let tipoIncidencia: 'expulsion_antideportivas' | 'expulsion_tecnicas' = 'expulsion_tecnicas';
      if (antideportivas >= 2) tipoIncidencia = 'expulsion_antideportivas';
      else if (tecnicas >= 2) tipoIncidencia = 'expulsion_tecnicas';
      else if (antideportivas >= 1 && tecnicas >= 1) tipoIncidencia = 'expulsion_tecnicas';
      await db.incidencias.add({
        id: crypto.randomUUID(),
        partidoId: partido.id,
        tipo: tipoIncidencia,
        equipoId,
        jugadorId: jugadorSeleccionadoId,
        motivo: tipoIncidencia === 'expulsion_antideportivas' ? '2 faltas antideportivas' : '2 faltas técnicas o 1+1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: false,
        isTest: Boolean((partido as any)?.isTest),
      });
      if (!Boolean((partido as any)?.isTest)) useSyncStore.getState().runSync().catch(() => {});
    }
    if (j) {
      if (tipo === 'falta_personal' && personales === 4) {
        alert(`⚠ ${j.nombre} ${j.apellido} (#${j.numero}) tiene 4 faltas.`);
      } else if (tipo === 'falta_personal' && personales >= 5) {
        alert(`🚫 ${j.nombre} ${j.apellido} (#${j.numero}) tiene 5 faltas – debe salir.`);
      } else if (isJugadorExpulsado(jugadorSeleccionadoId)) {
        alert(`🚫 ${j.nombre} ${j.apellido} (#${j.numero}) expulsado (2 antideportivas/técnicas o 5 personales).`);
      }
    }
  };

  // TL ahora suma +1 directo (sin modal).

  const handleSeleccionJugador = (j: { id: string }) => {
    if (isJugadorExpulsado(j.id)) {
      setModalExpulsado(true);
      return;
    }
    seleccionarJugador(jugadorSeleccionadoId === j.id ? null : j.id);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col min-h-[80vh]">
      {partidoId && <CronometroPartido partidoId={partidoId} />}
      <div className="flex justify-between items-center mb-4 rounded-xl bg-slate-800 px-4 py-3">
        <button
          type="button"
          onClick={() => setEquipoActivo('local')}
          className={`font-bold ${equipoActivo === 'local' ? 'text-emerald-400' : 'text-slate-400'}`}
        >
          Local
        </button>
        <span className="text-2xl font-bold text-slate-100">
          {puntosLocal} - {puntosVisitante}
        </span>
        <button
          type="button"
          onClick={() => setEquipoActivo('visitante')}
          className={`font-bold ${equipoActivo === 'visitante' ? 'text-emerald-400' : 'text-slate-400'}`}
        >
          Visitante
        </button>
      </div>
      {expulsadosEnCancha.length > 0 && (
        <div className="mb-3 rounded-lg bg-amber-900/80 border border-amber-600 px-3 py-2 text-amber-200 text-sm">
          {expulsadosEnCancha.map(({ j }) => (
            <div key={j.id}>
              Jugador expulsado aún en cancha: {j.nombre} {j.apellido} (#{j.numero})
            </div>
          ))}
        </div>
      )}
      <p className="text-sm text-slate-400 mb-2">
        Toca un dorsal y luego +2 / +3 / TL / Falta
      </p>
      <div className="flex flex-wrap gap-3 mb-4 justify-center">
        {enCancha.map((pl) => {
          const j = jugadoresMap[pl.jugadorId];
          if (!j) return null;
          const selected = jugadorSeleccionadoId === j.id;
          const personales = getFaltasPersonalesJugador(j.id);
          const expulsado = isJugadorExpulsado(j.id);
          return (
            <button
              key={j.id}
              type="button"
              onClick={() => handleSeleccionJugador(j)}
              className={`min-w-[52px] min-h-[52px] rounded-xl text-lg font-bold border-2 ${
                selected ? 'bg-primary-600 border-primary-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-200'
              } ${personales >= 4 && !expulsado ? 'ring-2 ring-amber-400' : ''} ${expulsado ? 'opacity-60 border-red-600' : ''}`}
            >
              {j.numero}
            </button>
          );
        })}
      </div>
      {showFaltaTipo ? (
        <div className="flex flex-col gap-2 mb-4">
          <p className="text-sm text-slate-400">Tipo de falta</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => handleFaltaTipo('falta_personal')} className="flex-1 min-w-[80px] py-3 rounded-xl bg-red-600 text-white font-bold">Normal</button>
            <button type="button" onClick={() => handleFaltaTipo('falta_tecnica')} className="flex-1 min-w-[80px] py-3 rounded-xl bg-orange-600 text-white font-bold">Técnica</button>
            <button type="button" onClick={() => handleFaltaTipo('falta_antideportiva')} className="flex-1 min-w-[80px] py-3 rounded-xl bg-rose-700 text-white font-bold">Antideportiva</button>
            <button type="button" onClick={() => setShowFaltaTipo(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          <button type="button" onClick={() => handleEvento('punto_2')} className="flex-1 min-w-[70px] py-4 rounded-xl bg-emerald-600 text-white font-bold text-lg">+2</button>
          <button type="button" onClick={() => handleEvento('punto_3')} className="flex-1 min-w-[70px] py-4 rounded-xl bg-blue-600 text-white font-bold text-lg">+3</button>
          <button type="button" onClick={() => handleEvento('tiro_libre_anotado')} className="flex-1 min-w-[70px] py-4 rounded-xl bg-amber-600 text-white font-bold">TL</button>
          <button type="button" onClick={() => handleEvento('falta_personal')} className="flex-1 min-w-[70px] py-4 rounded-xl bg-red-600 text-white font-bold">Falta</button>
        </div>
      )}
      {modalExpulsado && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setModalExpulsado(false)}>
          <div className="bg-slate-800 rounded-xl border border-slate-600 p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-slate-100 mb-2">Este jugador está expulsado.</p>
            <p className="text-sm text-slate-400 mb-4">No puede registrar más puntos ni faltas. Use &quot;Deshacer último evento&quot; si fue un error, o registre una sustitución para que salga de cancha.</p>
            <button type="button" onClick={() => setModalExpulsado(false)} className="w-full py-2 rounded-lg bg-primary-600 text-white font-medium">Entendido</button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={deshacerUltimoEvento}
        className="w-full py-3 rounded-lg bg-slate-700 text-slate-300 border border-slate-600 mb-2"
      >
        Deshacer último evento
      </button>
      <div className="mt-auto rounded-lg bg-slate-800/80 border border-slate-700 p-3 mb-3 text-xs text-slate-400 overflow-x-auto">
        <p className="font-medium text-slate-300 mb-2">Vista rápida (en cancha)</p>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-slate-400 border-b border-slate-600">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Nombre</th>
              <th className="py-1 pr-1 text-right">P</th>
              <th className="py-1 pr-3 text-right">F</th>
              <th className="py-1 pr-2 w-4" />
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Nombre</th>
              <th className="py-1 pr-1 text-right">P</th>
              <th className="py-1 text-right">F</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(
              {
                length: Math.max(
                  getJugadoresEnCancha(partido.localEquipoId).length,
                  getJugadoresEnCancha(partido.visitanteEquipoId).length
                ),
              },
              (_, i) => {
                const plLocal = getJugadoresEnCancha(partido.localEquipoId)[i];
                const plVisit = getJugadoresEnCancha(partido.visitanteEquipoId)[i];
              const jLocal = plLocal ? jugadoresMap[plLocal.jugadorId] : null;
              const jVisit = plVisit ? jugadoresMap[plVisit.jugadorId] : null;
              const expulsadoLocal = jLocal && isJugadorExpulsado(jLocal.id);
              const expulsadoVisit = jVisit && isJugadorExpulsado(jVisit.id);
              const bgExpulsado = 'bg-red-900/30';
              return (
                <tr key={i} className="border-b border-slate-700/50">
                  <td className={`py-0.5 pr-2 ${expulsadoLocal ? bgExpulsado : ''}`}>{jLocal?.numero ?? '—'}</td>
                  <td className={`py-0.5 pr-2 truncate max-w-[80px] ${expulsadoLocal ? bgExpulsado : ''}`}>{jLocal ? (jLocal.nombre || '').split(/\s+/)[0] || jLocal.nombre : '—'}</td>
                  <td className={`py-0.5 pr-1 text-right ${expulsadoLocal ? bgExpulsado : ''}`}>{jLocal ? getPuntosJugador(jLocal.id) : '—'}</td>
                  <td className={`py-0.5 pr-3 text-right ${expulsadoLocal ? bgExpulsado : ''}`}>{jLocal ? `${Math.min(5, getFaltasJugador(jLocal.id))}${isJugadorExpulsado(jLocal.id) ? ' EXP' : ''}` : '—'}</td>
                  <td className="py-0.5 w-4" />
                  <td className={`py-0.5 pr-2 ${expulsadoVisit ? bgExpulsado : ''}`}>{jVisit?.numero ?? '—'}</td>
                  <td className={`py-0.5 pr-2 truncate max-w-[80px] ${expulsadoVisit ? bgExpulsado : ''}`}>{jVisit ? (jVisit.nombre || '').split(/\s+/)[0] || jVisit.nombre : '—'}</td>
                  <td className={`py-0.5 pr-1 text-right ${expulsadoVisit ? bgExpulsado : ''}`}>{jVisit ? getPuntosJugador(jVisit.id) : '—'}</td>
                  <td className={`py-0.5 text-right ${expulsadoVisit ? bgExpulsado : ''}`}>{jVisit ? `${Math.min(5, getFaltasJugador(jVisit.id))}${isJugadorExpulsado(jVisit.id) ? ' EXP' : ''}` : '—'}</td>
                </tr>
              );
              }
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => navigate(`/partido/${partidoId}/resumen`)}
        className="w-full py-3 rounded-lg bg-primary-600 text-white font-medium"
      >
        Ir a resumen / Cerrar partido
      </button>
    </div>
  );
}
