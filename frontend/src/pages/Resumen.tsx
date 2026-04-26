import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore, ROLES_PARTIDO } from '@/store/authStore';
import { db } from '@/lib/db';
import { api } from '@/lib/api';
import { usePartidoStore } from '@/store/partidoStore';
import { useSyncStore } from '@/store/syncStore';
import type { Jugador } from '@/types/entities';
import type { Partido } from '@/types/entities';
import type { PlantillaPartido } from '@/types/entities';
import type { EventoLocal, PartidoLocal } from '@/lib/db';

async function ensurePartidoEnDexie(partidoId: string): Promise<boolean> {
  const p = await db.partidos.get(partidoId);
  if (p) return true;
  try {
    const partido = await api<Partido>(`/partidos/${partidoId}`);
    await db.partidos.put({
      ...partido,
      synced: true,
      plantillaSynced: true,
      plantillaSyncStatus: 'synced',
      plantillaSyncError: null,
    });
    const plantilla = await api<PlantillaPartido[]>(`/partidos/${partidoId}/plantilla`);
    for (const pl of plantilla) await db.plantilla.put(pl);
    const eventos = await api<Array<{ id: string; partidoId: string; tipo: string; jugadorId: string; jugadorEntraId?: string; minutoPartido: number; cuarto: number; orden: number; createdAt: string }>>(`/partidos/${partidoId}/eventos`);
    for (const e of eventos) await db.eventos.put({ ...e, synced: true } as EventoLocal);
    return true;
  } catch {
    return false;
  }
}

export default function Resumen() {
  const { partidoId } = useParams<{ partidoId: string }>();
  const navigate = useNavigate();
  const usuarioId = useAuthStore((s) => s.usuario?.id);
  const isAdminLiga = useAuthStore((s) => s.hasRole('admin_liga'));
  const {
    partidoActual,
    plantilla,
    loadPartido,
    getOfficialScore,
    getPuntosJugador,
    getFaltasJugador,
    isJugadorExpulsado,
    canFinishMatch,
    getFinishBlockReasons,
    getCronoSnapshot,
  } = usePartidoStore();
  const runSync = useSyncStore((s) => s.runSync);
  const getPartidoSyncHealth = useSyncStore((s) => s.getPartidoSyncHealth);
  const [jugadoresMap, setJugadoresMap] = useState<Record<string, Jugador>>({});
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [equipoNombres, setEquipoNombres] = useState<Record<string, string>>({});
  const [syncHealth, setSyncHealth] = useState<{ pending: number; failed: number; lastError: string | null }>({
    pending: 0,
    failed: 0,
    lastError: null,
  });

  const isConsulta = !useAuthStore((s) => s.hasRole(...ROLES_PARTIDO));

  useEffect(() => {
    if (!partidoId) return;
    (async () => {
      setLoading(true);
      await ensurePartidoEnDexie(partidoId);
      await loadPartido(partidoId);
      const all = await db.jugadores.toArray();
      const map: Record<string, Jugador> = {};
      all.forEach((j) => { map[j.id] = j; });
      setJugadoresMap(map);
      const equipos = await db.equipos.toArray();
      const nombres: Record<string, string> = {};
      equipos.forEach((e) => { nombres[e.id] = e.nombre; });
      setEquipoNombres(nombres);
      setSyncHealth(await useSyncStore.getState().getPartidoSyncHealth(partidoId));
      setLoading(false);
    })();
  }, [partidoId, loadPartido, getPartidoSyncHealth]);

  useEffect(() => {
    if (!partidoId || !isConsulta) return;
    const interval = setInterval(async () => {
      try {
        const partido = await api<Partido>(`/partidos/${partidoId}`);
        await db.partidos.put({ ...partido, synced: true });
        const plantilla = await api<PlantillaPartido[]>(`/partidos/${partidoId}/plantilla`);
        for (const pl of plantilla) await db.plantilla.put(pl);
        const eventos = await api<Array<{ id: string; partidoId: string; tipo: string; jugadorId: string; jugadorEntraId?: string; minutoPartido: number; cuarto: number; orden: number; createdAt: string }>>(`/partidos/${partidoId}/eventos`);
        for (const e of eventos) await db.eventos.put({ ...e, synced: true } as EventoLocal);
        await loadPartido(partidoId);
      } catch {
        // ignore
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [partidoId, isConsulta, loadPartido]);

  const partido = partidoActual;
  if (loading || !partido) return <div className="p-4 text-slate-400">Cargando...</div>;
  const isTest = Boolean((partido as PartidoLocal).isTest);

  const canClosePartido = partido.anotadorId === usuarioId || isAdminLiga;

  const officialScore = getOfficialScore();
  const puntosLocal = officialScore.home;
  const puntosVisitante = officialScore.away;

  const localJugadores = plantilla.filter((p) => p.equipoId === partido.localEquipoId);
  const visitanteJugadores = plantilla.filter((p) => p.equipoId === partido.visitanteEquipoId);

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFotoFile(f);
    const url = URL.createObjectURL(f);
    setFotoPreview(url);
  };

  const cerrarPartido = async () => {
    if (!partidoId) return;
    const closingPhotoProvided = Boolean(fotoFile);
    const finishBlockReasons = getFinishBlockReasons(closingPhotoProvided);
    if (!canFinishMatch(closingPhotoProvided)) {
      const mensajes = {
        CLOCK_NOT_EXPIRED: 'El reloj del periodo actual no ha terminado.',
        TIED_SCORE_REQUIRES_OVERTIME: 'No se puede cerrar el partido con empate. Agrega tiempos extra hasta que haya ganador.',
        CLOSING_PHOTO_REQUIRED: 'La foto del marcador es obligatoria para cerrar.',
        MATCH_ALREADY_FINISHED: 'El partido ya fue cerrado.',
        REGULATION_NOT_COMPLETED: 'El partido no está en un periodo válido para cierre.',
      } as const;
      alert(finishBlockReasons.map((reason) => mensajes[reason as keyof typeof mensajes] ?? reason).join('\n'));
      return;
    }
    const clockSnapshot = getCronoSnapshot();
    setCerrando(true);
    try {
      if (isTest) {
        await db.partidos.update(partidoId, {
          estado: 'finalizado',
          folio: null,
          fotoMarcadorUrl: null,
          cerradoAt: new Date().toISOString(),
          marcadorLocalFinal: puntosLocal,
          marcadorVisitanteFinal: puntosVisitante,
          closurePending: false,
        });
        await loadPartido(partidoId);
      } else if (!navigator.onLine) {
        const clientClosureId = crypto.randomUUID();
        if (fotoFile) await db.fotosCierre.put({ partidoId, blob: fotoFile });
        await db.cierresPendientes.add({
          id: crypto.randomUUID(),
          partidoId,
          clientClosureId,
          createdAt: new Date().toISOString(),
          cuartoActual: clockSnapshot.cuartoActual,
          segundosRestantesCuarto: clockSnapshot.segundosRestantesCuarto,
        });
        await db.partidos.update(partidoId, {
          estado: 'finalizado',
          folio: null,
          fotoMarcadorUrl: null,
          cerradoAt: new Date().toISOString(),
          marcadorLocalFinal: puntosLocal,
          marcadorVisitanteFinal: puntosVisitante,
          closurePending: true,
        });
        await loadPartido(partidoId);
      } else {
        await runSync();
        const health = await useSyncStore.getState().getPartidoSyncHealth(partidoId);
        setSyncHealth(health);
        if (health.pending > 0 || health.failed > 0) {
          alert(
            `No se puede cerrar todavía. Hay ${health.pending} cambios pendientes y ${health.failed} con error de sincronización.` +
              (health.lastError ? `\n${health.lastError}` : '')
          );
          return;
        }
        const body = (() => {
          if (fotoFile) {
            const f = new FormData();
            f.append('fotoMarcador', fotoFile);
            f.append('cuartoActual', String(clockSnapshot.cuartoActual));
            f.append('segundosRestantesCuarto', String(clockSnapshot.segundosRestantesCuarto));
            return f;
          }
          return {
            cuartoActual: clockSnapshot.cuartoActual,
            segundosRestantesCuarto: clockSnapshot.segundosRestantesCuarto,
          };
        })();
        const res = await api<{ partido: { fotoMarcadorUrl?: string | null; marcadorLocalFinal?: number; marcadorVisitanteFinal?: number }; folio: string }>(
          '/partidos/' + partidoId + '/cerrar',
          {
            method: 'POST',
            body: body as unknown as Record<string, unknown>,
            headers: {} as Record<string, string>,
          }
        );
        const { partido: updated, folio } = res;
        await db.partidos.update(partidoId, {
          estado: 'finalizado',
          folio,
          fotoMarcadorUrl: updated?.fotoMarcadorUrl ?? '',
          cerradoAt: new Date().toISOString(),
          marcadorLocalFinal: updated?.marcadorLocalFinal ?? undefined,
          marcadorVisitanteFinal: updated?.marcadorVisitanteFinal ?? undefined,
          synced: true,
          closurePending: false,
        });
        navigate(`/partido/${partidoId}/acta?folio=${encodeURIComponent(folio)}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cerrar');
    } finally {
      setCerrando(false);
    }
  };

  const yaCerrado = partido.estado === 'finalizado';
  const closurePending = (partido as PartidoLocal).closurePending === true;
  const ganadorEquipoId =
    partido.estado === 'default_visitante'
      ? partido.localEquipoId
      : partido.estado === 'default_local'
        ? partido.visitanteEquipoId
        : puntosLocal !== puntosVisitante
          ? (puntosLocal > puntosVisitante ? partido.localEquipoId : partido.visitanteEquipoId)
          : null;
  const ganadorNombre = ganadorEquipoId ? equipoNombres[ganadorEquipoId] ?? null : null;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-slate-100 mb-4">
        {closurePending ? 'Resumen de cierre pendiente' : 'Resumen y cierre'}
      </h2>
      {closurePending && (
        <div className="mb-4 rounded-lg bg-amber-900/80 border border-amber-600 px-3 py-2 text-amber-200 text-sm">
          <p className="font-medium">Pendiente de sincronizar</p>
          <p>Conecta a internet y pulsa Sincronizar para obtener el folio y el acta oficial.</p>
        </div>
      )}
      {(syncHealth.pending > 0 || syncHealth.failed > 0) && !isTest && (
        <div className="mb-4 rounded-lg bg-amber-900/80 border border-amber-600 px-3 py-2 text-amber-200 text-sm">
          <p className="font-medium">Acta oficial pendiente de sincronización</p>
          <p>
            Hay {syncHealth.pending} cambios pendientes y {syncHealth.failed} con error. El acta/PDF del servidor puede no coincidir hasta sincronizar.
          </p>
          {syncHealth.lastError && <p className="mt-1 text-xs">{syncHealth.lastError}</p>}
        </div>
      )}
      {ganadorNombre && (partido.estado === 'finalizado' || partido.estado === 'default_local' || partido.estado === 'default_visitante') && (
        <p className="text-center text-slate-300 font-medium mb-2">Ganador: {ganadorNombre}</p>
      )}
      <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 mb-4">
        <div className="text-center text-2xl font-bold text-slate-100 mb-4">
          {puntosLocal} - {puntosVisitante}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-slate-300 mb-2">Local</p>
            <ul>
              {localJugadores.map((pl) => {
                const j = jugadoresMap[pl.jugadorId];
                return j ? (
                  <li key={j.id} className="flex justify-between text-slate-400">
                    <span>#{j.numero} {j.apellido}</span>
                    <span>{getPuntosJugador(j.id)} pts · {Math.min(5, getFaltasJugador(j.id))} F{isJugadorExpulsado(j.id) ? ' (EXP)' : ''}</span>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
          <div>
            <p className="font-medium text-slate-300 mb-2">Visitante</p>
            <ul>
              {visitanteJugadores.map((pl) => {
                const j = jugadoresMap[pl.jugadorId];
                return j ? (
                  <li key={j.id} className="flex justify-between text-slate-400">
                    <span>#{j.numero} {j.apellido}</span>
                    <span>{getPuntosJugador(j.id)} pts · {Math.min(5, getFaltasJugador(j.id))} F{isJugadorExpulsado(j.id) ? ' (EXP)' : ''}</span>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        </div>
      </div>
      {canClosePartido ? (
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Foto del marcador (opcional)</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFoto}
            disabled={yaCerrado}
            className="block w-full text-slate-400 file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary-600 file:text-white"
          />
          {fotoPreview && (
            <img src={fotoPreview} alt="Marcador" className="mt-2 rounded-lg max-h-48 object-contain bg-slate-800" />
          )}
          {isTest && (
            <p className="mt-2 text-xs text-amber-300">
              Partido de pruebas: el cierre se guarda solo localmente y no genera acta oficial en backend.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400 mb-4">Vista de solo lectura. No puedes cerrar este partido.</p>
      )}
      {canClosePartido && !yaCerrado && (
        <button
          type="button"
          disabled={cerrando}
          onClick={cerrarPartido}
          className="w-full py-3 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium"
        >
          {cerrando ? 'Cerrando...' : isTest ? 'Cerrar partido de pruebas' : !navigator.onLine ? 'Cerrar localmente (se sincronizará cuando haya conexión)' : 'Cerrar partido y generar acta'}
        </button>
      )}
      {yaCerrado && partido.folio && !closurePending && !isTest && (
        <button
          type="button"
          onClick={() => navigate(`/partido/${partidoId}/acta`)}
          className="w-full py-3 rounded-lg bg-emerald-600 text-white font-medium"
        >
          Ver acta · Folio {partido.folio}
        </button>
      )}
    </div>
  );
}
