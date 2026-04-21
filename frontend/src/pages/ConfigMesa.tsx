import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/db';
import { api } from '@/lib/api';
import { usePartidoStore } from '@/store/partidoStore';
import type { PlantillaPartido } from '@/types/entities';
import type { Jugador, Equipo } from '@/types/entities';
import type { EventoLocal } from '@/lib/db';

export default function ConfigMesa() {
  const { partidoId } = useParams<{ partidoId: string }>();
  const navigate = useNavigate();
  const usuarioId = useAuthStore((s) => s.usuario?.id);
  const isAdminLiga = useAuthStore((s) => s.hasRole('admin_liga'));
  const { partidoActual, plantilla, setPartidoActual, setPlantilla, loadPartido } = usePartidoStore();
  const [partido, setPartido] = useState(partidoActual);
  const [localJugadores, setLocalJugadores] = useState<Jugador[]>([]);
  const [visitanteJugadores, setVisitanteJugadores] = useState<Jugador[]>([]);
  const [localEnCancha, setLocalEnCancha] = useState<Set<string>>(new Set());
  const [visitanteEnCancha, setVisitanteEnCancha] = useState<Set<string>>(new Set());
  const [capitanLocal, setCapitanLocal] = useState<string | null>(null);
  const [capitanVisitante, setCapitanVisitante] = useState<string | null>(null);
  const [coachLocal, setCoachLocal] = useState<string | null>(null);
  const [coachVisitante, setCoachVisitante] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!partidoId) return;
    (async () => {
      const p = await db.partidos.get(partidoId);
      if (!p) {
        navigate('/');
        return;
      }
      if (p.anotadorId !== usuarioId && !isAdminLiga) {
        navigate(`/partido/${partidoId}/resumen`);
        return;
      }
      setPartido(p);
      setPartidoActual(p);
      await loadPartido(partidoId);
      const loc = await db.jugadores.where('equipoId').equals(p.localEquipoId).toArray();
      const vis = await db.jugadores.where('equipoId').equals(p.visitanteEquipoId).toArray();
      setLocalJugadores(loc);
      setVisitanteJugadores(vis);
      const pl = await db.plantilla.where('partidoId').equals(partidoId).toArray();
      const locCancha = new Set(pl.filter((x) => x.equipoId === p.localEquipoId && x.enCanchaInicial).map((x) => x.jugadorId));
      const visCancha = new Set(pl.filter((x) => x.equipoId === p.visitanteEquipoId && x.enCanchaInicial).map((x) => x.jugadorId));
      setLocalEnCancha(locCancha);
      setVisitanteEnCancha(visCancha);
      const capL = pl.find((x) => x.equipoId === p.localEquipoId && x.esCapitan)?.jugadorId ?? null;
      const capV = pl.find((x) => x.equipoId === p.visitanteEquipoId && x.esCapitan)?.jugadorId ?? null;
      const coachL = pl.find((x) => x.equipoId === p.localEquipoId && x.esCoach)?.jugadorId ?? null;
      const coachV = pl.find((x) => x.equipoId === p.visitanteEquipoId && x.esCoach)?.jugadorId ?? null;
      setCapitanLocal(capL);
      setCapitanVisitante(capV);
      setCoachLocal(coachL);
      setCoachVisitante(coachV);
    })();
  }, [partidoId, navigate, loadPartido, setPartidoActual]);

  const toggleEnCancha = (equipoId: string, jugadorId: string) => {
    if (partido?.localEquipoId === equipoId) {
      const next = new Set(localEnCancha);
      if (next.has(jugadorId)) {
        if (next.size <= 1) return;
        next.delete(jugadorId);
      } else {
        if (next.size >= 5) return;
        next.add(jugadorId);
      }
      setLocalEnCancha(next);
    } else {
      const next = new Set(visitanteEnCancha);
      if (next.has(jugadorId)) {
        if (next.size <= 1) return;
        next.delete(jugadorId);
      } else {
        if (next.size >= 5) return;
        next.add(jugadorId);
      }
      setVisitanteEnCancha(next);
    }
  };

  const yaIniciado = partido?.estado === 'en_curso';
  const canGuardar = Boolean(
    partido &&
      localEnCancha.size === 5 &&
      visitanteEnCancha.size === 5 &&
      capitanLocal &&
      capitanVisitante &&
      // Capitán en cancha SOLO al iniciar. Ya iniciado, puede salir.
      (yaIniciado || (localEnCancha.has(capitanLocal) && visitanteEnCancha.has(capitanVisitante)))
  );

  const iniciarPartido = async () => {
    if (!partidoId || !partido || !canGuardar) return;
    setSaving(true);
    try {
      // Si el partido ya está en curso, estos cambios representan sustituciones.
      // Registramos eventos de sustitución para que a futuro se pueda calcular "minutos jugados".
      if (yaIniciado) {
        const plActual = await db.plantilla.where('partidoId').equals(partidoId).toArray();
        const prevLocal = new Set(
          plActual.filter((x) => x.equipoId === partido.localEquipoId && x.enCanchaInicial).map((x) => x.jugadorId)
        );
        const prevVisit = new Set(
          plActual.filter((x) => x.equipoId === partido.visitanteEquipoId && x.enCanchaInicial).map((x) => x.jugadorId)
        );

        const diff = (prev: Set<string>, next: Set<string>) => {
          const salen: string[] = [];
          const entran: string[] = [];
          for (const id of prev) if (!next.has(id)) salen.push(id);
          for (const id of next) if (!prev.has(id)) entran.push(id);
          return { salen, entran };
        };

        const dLocal = diff(prevLocal, localEnCancha);
        const dVisit = diff(prevVisit, visitanteEnCancha);
        const cambios = [
          { equipoId: partido.localEquipoId, ...dLocal },
          { equipoId: partido.visitanteEquipoId, ...dVisit },
        ].filter((x) => x.salen.length || x.entran.length);

        if (cambios.length) {
          const snap = usePartidoStore.getState().getCronoSnapshot();
          const existentes = await db.eventos.where('partidoId').equals(partidoId).sortBy('orden');
          let orden = existentes.length ? Math.max(...existentes.map((e) => e.orden)) + 1 : 1;

          const nowIso = new Date().toISOString();
          const toEv = (tipo: 'sustitucion_sale' | 'sustitucion_entra', jugadorId: string): EventoLocal => ({
            id: crypto.randomUUID(),
            partidoId,
            tipo,
            jugadorId,
            jugadorEntraId: tipo === 'sustitucion_entra' ? jugadorId : undefined,
            minutoPartido: Math.floor(snap.tiempoPartidoSegundos / 60),
            cuarto: snap.cuartoActual,
            orden: orden++,
            createdAt: nowIso,
            synced: false,
            segundosRestantesCuarto: snap.segundosRestantesCuarto,
            tiempoPartidoSegundos: snap.tiempoPartidoSegundos,
          });

          const eventosNuevos: EventoLocal[] = [];
          for (const c of cambios) {
            for (const s of c.salen) eventosNuevos.push(toEv('sustitucion_sale', s));
            for (const e of c.entran) eventosNuevos.push(toEv('sustitucion_entra', e));
          }
          for (const ev of eventosNuevos) await db.eventos.add(ev);
        }
      }

      const items: Omit<PlantillaPartido, 'id' | 'createdAt' | 'updatedAt'>[] = [];
      const add = (equipoId: string, jugadorId: string, enCancha: boolean, capitan: boolean, coach: boolean) => {
        items.push({
          partidoId,
          equipoId,
          jugadorId,
          enCanchaInicial: enCancha,
          esCapitan: capitan,
          esCoach: coach,
          invitado: false,
        });
      };
      for (const j of localJugadores) {
        add(partido.localEquipoId, j.id, localEnCancha.has(j.id), capitanLocal === j.id, coachLocal === j.id);
      }
      for (const j of visitanteJugadores) {
        add(partido.visitanteEquipoId, j.id, visitanteEnCancha.has(j.id), capitanVisitante === j.id, coachVisitante === j.id);
      }
      await db.plantilla.where('partidoId').equals(partidoId).delete();
      for (const it of items) {
        await db.plantilla.add({
          ...it,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      setPlantilla(await db.plantilla.where('partidoId').equals(partidoId).toArray());
      await db.partidos.update(partidoId, { estado: 'en_curso', updatedAt: new Date().toISOString() });
      try {
        await api('/partidos/' + partidoId + '/plantilla', { method: 'POST', body: { items } });
        if (!yaIniciado) await api('/partidos/' + partidoId, { method: 'PATCH', body: { estado: 'en_curso' } });
      } catch (_) {}
      navigate(`/partido/${partidoId}/captura`);
    } finally {
      setSaving(false);
    }
  };

  if (!partido) return <div className="p-4 text-slate-400">Cargando...</div>;

  const renderEquipo = (equipoId: string, jugadores: Jugador[], enCancha: Set<string>, setCapitan: (id: string | null) => void, setCoach: (id: string | null) => void, capitan: string | null, coach: string | null) => (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 mb-4">
      <div className="flex flex-wrap gap-2 mb-2">
        {jugadores.map((j) => (
          <div key={j.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleEnCancha(equipoId, j.id)}
              className={`px-3 py-2 rounded-lg font-medium min-w-[44px] ${enCancha.has(j.id) ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
            >
              {j.numero}
            </button>
            <span className="text-sm text-slate-300">{j.nombre} {j.apellido}</span>
            <select
              value={capitan === j.id ? 'capitan' : coach === j.id ? 'coach' : ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'capitan') setCapitan(j.id);
                else if (v === 'coach') setCoach(j.id);
                else {
                  if (capitan === j.id) setCapitan(null);
                  if (coach === j.id) setCoach(null);
                }
              }}
              className="text-xs bg-slate-700 rounded px-1 py-0.5"
            >
              <option value="">—</option>
              <option value="capitan">Capitán</option>
              <option value="coach">Coach</option>
            </select>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        En cancha: {enCancha.size}/5 · El capitán debe iniciar en cancha (puede salir después).
      </p>
    </div>
  );

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-slate-100 mb-4">Configuración de mesa</h2>
      {renderEquipo(partido.localEquipoId, localJugadores, localEnCancha, setCapitanLocal, setCoachLocal, capitanLocal, coachLocal)}
      {renderEquipo(partido.visitanteEquipoId, visitanteJugadores, visitanteEnCancha, setCapitanVisitante, setCoachVisitante, capitanVisitante, coachVisitante)}
      {!canGuardar && (
        <p className="text-amber-400 text-sm mb-4">
          Se requieren 5 jugadores en cancha por equipo{yaIniciado ? '.' : ' y capitán en cancha al iniciar.'}
        </p>
      )}
      <button
        type="button"
        disabled={!canGuardar || saving}
        onClick={iniciarPartido}
        className="w-full rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium py-3"
      >
        {saving ? 'Guardando...' : yaIniciado ? 'Continuar partido' : 'Iniciar partido'}
      </button>
    </div>
  );
}
