import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '@/lib/db';
import { usePartidoStore } from '@/store/partidoStore';
import type { TipoEvento } from '@/types/entities';
import type { Jugador } from '@/types/entities';

export default function Captura() {
  const { partidoId } = useParams<{ partidoId: string }>();
  const navigate = useNavigate();
  const {
    partidoActual,
    plantilla,
    eventos,
    jugadorSeleccionadoId,
    minutoActual,
    cuartoActual,
    setPartidoActual,
    loadPartido,
    seleccionarJugador,
    agregarEvento,
    deshacerUltimoEvento,
    setMinutoCuarto,
    getJugadoresEnCancha,
    getPuntosJugador,
    getFaltasJugador,
  } = usePartidoStore();
  const [equipoActivo, setEquipoActivo] = useState<'local' | 'visitante'>('local');
  const [jugadoresMap, setJugadoresMap] = useState<Record<string, Jugador>>({});
  const [showTL, setShowTL] = useState(false);
  const [cronoTimer, setCronoTimer] = useState<number | null>(null);

  useEffect(() => {
    if (!partidoId) return;
    (async () => {
      const p = await db.partidos.get(partidoId);
      if (!p || p.estado === 'finalizado') {
        navigate('/');
        return;
      }
      setPartidoActual(p);
      await loadPartido(partidoId);
      const allJ = await db.jugadores.toArray();
      const map: Record<string, Jugador> = {};
      allJ.forEach((j) => { map[j.id] = j; });
      setJugadoresMap(map);
    })();
  }, [partidoId, navigate, loadPartido, setPartidoActual]);

  useEffect(() => {
    const id = setInterval(() => {
      setMinutoCuarto(
        Math.floor((Date.now() - (partidoActual ? new Date(partidoActual.createdAt).getTime() : Date.now())) / 60000),
        Math.min(4, Math.floor((Date.now() - (partidoActual ? new Date(partidoActual.createdAt).getTime() : Date.now())) / 600000) + 1)
      );
    }, 5000);
    return () => clearInterval(id);
  }, [partidoActual, setMinutoCuarto]);

  const partido = partidoActual;
  if (!partido) return <div className="p-4 text-slate-400">Cargando...</div>;

  const equipoId = equipoActivo === 'local' ? partido.localEquipoId : partido.visitanteEquipoId;
  const enCancha = getJugadoresEnCancha(equipoId);
  const puntosLocal = plantilla.filter((p) => p.equipoId === partido.localEquipoId).reduce((s, p) => s + getPuntosJugador(p.jugadorId), 0);
  const puntosVisitante = plantilla.filter((p) => p.equipoId === partido.visitanteEquipoId).reduce((s, p) => s + getPuntosJugador(p.jugadorId), 0);

  const handleEvento = async (tipo: TipoEvento) => {
    if (tipo === 'tiro_libre_anotado' || tipo === 'tiro_libre_fallado') {
      setShowTL(true);
      return;
    }
    if (!jugadorSeleccionadoId) return;
    await agregarEvento(tipo);
    const faltas = getFaltasJugador(jugadorSeleccionadoId);
    if (faltas >= 4) {
      const j = jugadoresMap[jugadorSeleccionadoId];
      if (j) alert(`⚠ ${j.nombre} ${j.apellido} (#${j.numero}) tiene ${faltas} faltas.`);
    }
  };

  const handleTL = async (anotado: boolean) => {
    if (!jugadorSeleccionadoId) return;
    await agregarEvento(anotado ? 'tiro_libre_anotado' : 'tiro_libre_fallado');
    setShowTL(false);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col min-h-[80vh]">
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
      <p className="text-sm text-slate-400 mb-2">
        Q{cuartoActual} · Min ~{minutoActual} · Toca un dorsal y luego +2 / +3 / TL / Falta
      </p>
      <div className="flex flex-wrap gap-3 mb-4">
        {enCancha.map((pl) => {
          const j = jugadoresMap[pl.jugadorId];
          if (!j) return null;
          const selected = jugadorSeleccionadoId === j.id;
          const faltas = getFaltasJugador(j.id);
          return (
            <button
              key={j.id}
              type="button"
              onClick={() => seleccionarJugador(selected ? null : j.id)}
              className={`min-w-[52px] min-h-[52px] rounded-xl text-lg font-bold border-2 ${
                selected ? 'bg-primary-600 border-primary-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-200'
              } ${faltas >= 4 ? 'ring-2 ring-amber-400' : ''}`}
            >
              {j.numero}
            </button>
          );
        })}
      </div>
      {showTL ? (
        <div className="flex gap-3 mb-4">
          <button type="button" onClick={() => handleTL(true)} className="flex-1 py-4 rounded-xl bg-emerald-600 text-white font-bold">TL Anotado</button>
          <button type="button" onClick={() => handleTL(false)} className="flex-1 py-4 rounded-xl bg-slate-600 text-white font-bold">TL Fallado</button>
          <button type="button" onClick={() => setShowTL(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300">Cancelar</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          <button type="button" onClick={() => handleEvento('punto_2')} className="flex-1 min-w-[70px] py-4 rounded-xl bg-emerald-600 text-white font-bold text-lg">+2</button>
          <button type="button" onClick={() => handleEvento('punto_3')} className="flex-1 min-w-[70px] py-4 rounded-xl bg-blue-600 text-white font-bold text-lg">+3</button>
          <button type="button" onClick={() => handleEvento('tiro_libre_anotado')} className="flex-1 min-w-[70px] py-4 rounded-xl bg-amber-600 text-white font-bold">TL</button>
          <button type="button" onClick={() => handleEvento('falta_personal')} className="flex-1 min-w-[70px] py-4 rounded-xl bg-red-600 text-white font-bold">Falta</button>
        </div>
      )}
      <button
        type="button"
        onClick={deshacerUltimoEvento}
        className="w-full py-3 rounded-lg bg-slate-700 text-slate-300 border border-slate-600 mb-4"
      >
        Deshacer último evento
      </button>
      <button
        type="button"
        onClick={() => navigate(`/partido/${partidoId}/resumen`)}
        className="mt-auto w-full py-3 rounded-lg bg-primary-600 text-white font-medium"
      >
        Ir a resumen / Cerrar partido
      </button>
    </div>
  );
}
