import { create } from 'zustand';
import { db } from '@/lib/db';
import { api } from '@/lib/api';
import type { Partido } from '@/types/entities';
type PartidoJson = Partido & { cerradoAt?: string | null };

type SyncStatus = 'idle' | 'offline' | 'pending' | 'syncing' | 'synced' | 'failed';

interface SyncState {
  status: SyncStatus;
  pendingPartidos: number;
  pendingEventos: number;
  pendingAnulaciones: number;
  failedItems: number;
  lastError: string | null;
  lastSyncedAt: string | null;
  setStatus: (s: SyncStatus) => void;
  runSync: () => Promise<void>;
  syncNow: () => Promise<void>;
  updateCounts: () => Promise<void>;
  getPartidoSyncHealth: (partidoId: string) => Promise<{
    pending: number;
    failed: number;
    lastError: string | null;
  }>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  pendingPartidos: 0,
  pendingEventos: 0,
  pendingAnulaciones: 0,
  failedItems: 0,
  lastError: null,
  lastSyncedAt: null,
  setStatus: (s) => set({ status: s }),
  updateCounts: async () => {
    const partidosP = await db.partidos.filter((p) => !p.synced && !p.isTest).count();
    const plantillasP = await db.partidos.filter((p) => p.plantillaSynced !== true && !p.isTest).count();
    const eventosP = await db.eventos.filter((e) => !e.synced && !e.isTest).count();
    const anulacionesP = await db.eventosAnulados.filter((e) => !e.synced && !e.isTest).count();
    const eventosF = await db.eventos.filter((e) => e.syncStatus === 'failed' && !e.isTest).count();
    const anulacionesF = await db.eventosAnulados.filter((e) => e.syncStatus === 'failed' && !e.isTest).count();
    const incidenciasF = await db.incidencias.filter((i) => i.syncStatus === 'failed' && !i.isTest).count();
    const plantillasF = await db.partidos.filter((p) => p.plantillaSyncStatus === 'failed' && !p.isTest).count();
    const failedItems = eventosF + anulacionesF + incidenciasF + plantillasF;
    set({
      pendingPartidos: partidosP,
      pendingEventos: eventosP,
      pendingAnulaciones: anulacionesP,
      failedItems,
      status: failedItems > 0
        ? 'failed'
        : eventosP > 0 || partidosP > 0 || plantillasP > 0 || anulacionesP > 0
          ? 'pending'
          : navigator.onLine ? 'synced' : get().status,
    });
  },
  runSync: async () => {
    if (!navigator.onLine) {
      set({ status: 'offline' });
      await get().updateCounts();
      return;
    }
    set({ status: 'syncing', lastError: null });
    try {
      // #region agent log
      fetch('http://127.0.0.1:7895/ingest/4166f2ae-3788-45f4-8343-9dd7f8a1a95d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'19c21e'},body:JSON.stringify({sessionId:'19c21e',runId:'pre-fix',hypothesisId:'H2',location:'frontend/src/store/syncStore.ts:runSync:start',message:'runSync start',data:{online:navigator.onLine},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
      const isTerminalClosedError = (msg: string) => msg.toLowerCase().includes('partido ya cerrado');
      const isNonRetryableCreateError = (msg: string) => {
        const m = msg.toLowerCase();
        // Errores de validación por identidad/rol: reintentar no lo arregla desde el cliente.
        return (
          m.includes('membres') ||
          m.includes('anotador debe') ||
          m.includes('faltan campos requeridos') ||
          m.includes('validation')
        );
      };

      const buildPartidoCreatePayload = (p: any) => ({
        id: p.id,
        localEquipoId: p.localEquipoId,
        visitanteEquipoId: p.visitanteEquipoId,
        canchaId: p.canchaId,
        categoria: p.categoria,
        fecha: p.fecha,
        horaInicio: p.horaInicio,
        // Importante: NO mandamos anotadorId ni ligaId; el backend usa el usuario/token.
      });

      const ensurePartidoEnServidor = async (partidoId: string) => {
        const p = await db.partidos.get(partidoId);
        if (!p || p.isTest) return false;
        // Si ya marcamos que es no reintetable, cortamos para evitar spam.
        if (p.plantillaSyncStatus === 'failed' && p.plantillaSyncError && isNonRetryableCreateError(p.plantillaSyncError)) {
          return false;
        }
        try {
          await api(`/partidos/${partidoId}`);
          if (p.synced !== true) await db.partidos.update(partidoId, { synced: true });
          return true;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          // Si no existe en servidor, intentamos crearlo.
          if (message.toLowerCase().includes('no encontrado')) {
            try {
              await api('/partidos', { method: 'POST', body: buildPartidoCreatePayload(p) });
              await db.partidos.update(partidoId, { synced: true });
              return true;
            } catch (e2) {
              const message2 = e2 instanceof Error ? e2.message : String(e2);
              if (isTerminalClosedError(message2)) {
                // El servidor ya lo cerró: dejamos de intentar sincronizar plantilla/eventos.
                await db.partidos.update(partidoId, {
                  synced: true,
                  estado: 'finalizado',
                  plantillaSynced: true,
                  plantillaSyncStatus: 'synced',
                  plantillaSyncError: null,
                });
                return true;
              }
              await db.partidos.update(partidoId, { synced: false, plantillaSyncStatus: 'failed', plantillaSyncError: message2 });
              set({ status: 'failed', lastError: message2 });
              return false;
            }
          }
          await db.partidos.update(partidoId, { synced: false, plantillaSyncStatus: 'failed', plantillaSyncError: message });
          set({ status: 'failed', lastError: message });
          return false;
        }
      };

      const partidosPendientes = await db.partidos.filter((p) => !p.synced && !p.isTest).toArray();
      // #region agent log
      fetch('http://127.0.0.1:7895/ingest/4166f2ae-3788-45f4-8343-9dd7f8a1a95d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'19c21e'},body:JSON.stringify({sessionId:'19c21e',runId:'pre-fix',hypothesisId:'H2',location:'frontend/src/store/syncStore.ts:runSync:partidosPendientes',message:'partidosPendientes loaded',data:{count:partidosPendientes.length,ids:partidosPendientes.slice(0,5).map(p=>p.id)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
      for (const p of partidosPendientes) {
        try {
          await api('/partidos', { method: 'POST', body: buildPartidoCreatePayload(p) });
          await db.partidos.update(p.id, { synced: true });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          // #region agent log
          fetch('http://127.0.0.1:7895/ingest/4166f2ae-3788-45f4-8343-9dd7f8a1a95d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'19c21e'},body:JSON.stringify({sessionId:'19c21e',runId:'pre-fix',hypothesisId:'H2',location:'frontend/src/store/syncStore.ts:runSync:createPartido:catch',message:'create partido failed',data:{partidoId:p.id,error:message},timestamp:Date.now()})}).catch(()=>{});
          // #endregion agent log
          if (isTerminalClosedError(message)) {
            await db.partidos.update(p.id, {
              synced: true,
              estado: 'finalizado',
              plantillaSynced: true,
              plantillaSyncStatus: 'synced',
              plantillaSyncError: null,
            });
            continue;
          }
          // Si el partido no puede crearse en servidor, evitamos intentar plantilla/eventos luego.
          await db.partidos.update(p.id, { plantillaSyncStatus: 'failed', plantillaSyncError: message });
          set({ status: 'failed', lastError: message });
          console.warn('Sync partido', p.id, e);
        }
      }
      const plantillasPendientes = await db.partidos
        .filter((p) =>
          p.synced === true &&
          p.plantillaSynced !== true &&
          !p.isTest &&
          p.estado !== 'finalizado' &&
          p.estado !== 'default_local' &&
          p.estado !== 'default_visitante'
        )
        .toArray();
      for (const p of plantillasPendientes) {
        const exists = await ensurePartidoEnServidor(p.id);
        if (!exists) continue;
        try {
          const items = await db.plantilla.where('partidoId').equals(p.id).toArray();
          await db.partidos.update(p.id, { plantillaSyncStatus: 'syncing', plantillaSyncError: null });
          await api(`/partidos/${p.id}/plantilla`, { method: 'POST', body: { items } });
          try {
            await api('/partidos/' + p.id, { method: 'PATCH', body: { estado: p.estado } });
          } catch {
            // no bloquea la sincronización de plantilla
          }
          await db.partidos.update(p.id, {
            plantillaSynced: true,
            plantillaSyncStatus: 'synced',
            plantillaSyncError: null,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          await db.partidos.update(p.id, { plantillaSyncStatus: 'failed', plantillaSyncError: message });
          set({ status: 'failed', lastError: message });
          console.warn('Sync plantilla', p.id, e);
        }
      }
      const uniquePartidos = [
        ...new Set((await db.eventos.filter((e) => !e.synced && !e.isTest).toArray()).map((e) => e.partidoId)),
      ];
      // #region agent log
      fetch('http://127.0.0.1:7895/ingest/4166f2ae-3788-45f4-8343-9dd7f8a1a95d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'19c21e'},body:JSON.stringify({sessionId:'19c21e',runId:'pre-fix',hypothesisId:'H3',location:'frontend/src/store/syncStore.ts:runSync:uniquePartidosEventos',message:'unique partidos with pending eventos',data:{count:uniquePartidos.length,ids:uniquePartidos.slice(0,10)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
      for (const partidoId of uniquePartidos) {
        // Asegurar que el partido exista en servidor antes de intentar plantilla/eventos.
        const p = await db.partidos.get(partidoId);
        if (!p || p.isTest) continue;
        const exists = await ensurePartidoEnServidor(partidoId);
        if (!exists) {
          const eventosPendientes = await db.eventos.where('partidoId').equals(partidoId).filter((ev) => !ev.synced && !ev.isTest).toArray();
          for (const ev of eventosPendientes) await db.eventos.update(ev.id, { syncStatus: 'failed', syncError: 'Partido no existe en servidor.' });
          continue;
        }
        // Si la plantilla no está marcada como sincronizada, intentamos sincronizarla primero para evitar PLAYER_NOT_FOUND.
        if (p.plantillaSynced !== true) {
          try {
            const items = await db.plantilla.where('partidoId').equals(partidoId).toArray();
            await db.partidos.update(partidoId, { plantillaSyncStatus: 'syncing', plantillaSyncError: null });
            await api(`/partidos/${partidoId}/plantilla`, { method: 'POST', body: { items } });
            try {
              await api('/partidos/' + partidoId, { method: 'PATCH', body: { estado: p.estado } });
            } catch {
              // no bloquea la sincronización de plantilla
            }
            await db.partidos.update(partidoId, { plantillaSynced: true, plantillaSyncStatus: 'synced', plantillaSyncError: null });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await db.partidos.update(partidoId, { plantillaSyncStatus: 'failed', plantillaSyncError: message });
            const eventosPendientes = await db.eventos.where('partidoId').equals(partidoId).filter((ev) => !ev.synced && !ev.isTest).toArray();
            for (const ev of eventosPendientes) await db.eventos.update(ev.id, { syncStatus: 'failed', syncError: message });
            set({ status: 'failed', lastError: message });
            console.warn('Sync plantilla (pre-eventos)', partidoId, e);
            continue;
          }
        }
        const eventos = await db.eventos
          .where('partidoId')
          .equals(partidoId)
          .filter((e) => !e.synced && !e.isTest)
          .sortBy('orden');
        if (eventos.length === 0) continue;
        try {
          // #region agent log
          fetch('http://127.0.0.1:7895/ingest/4166f2ae-3788-45f4-8343-9dd7f8a1a95d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'19c21e'},body:JSON.stringify({sessionId:'19c21e',runId:'pre-fix',hypothesisId:'H3',location:'frontend/src/store/syncStore.ts:runSync:postEventos:before',message:'posting eventos batch',data:{partidoId,eventosCount:eventos.length,ordenMin:eventos[0]?.orden??null,ordenMax:eventos[eventos.length-1]?.orden??null,firstTipo:eventos[0]?.tipo??null,lastTipo:eventos[eventos.length-1]?.tipo??null,firstEventId:eventos[0]?.id??null,lastEventId:eventos[eventos.length-1]?.id??null},timestamp:Date.now()})}).catch(()=>{});
          // #endregion agent log
          for (const e of eventos) await db.eventos.update(e.id, { syncStatus: 'syncing', syncError: null });
          await api(`/partidos/${partidoId}/eventos`, { method: 'POST', body: { eventos } });
          for (const e of eventos) await db.eventos.update(e.id, { synced: true, syncStatus: 'synced', syncError: null });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          // #region agent log
          fetch('http://127.0.0.1:7895/ingest/4166f2ae-3788-45f4-8343-9dd7f8a1a95d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'19c21e'},body:JSON.stringify({sessionId:'19c21e',runId:'pre-fix',hypothesisId:'H3',location:'frontend/src/store/syncStore.ts:runSync:postEventos:catch',message:'posting eventos batch failed',data:{partidoId,error:message,eventosCount:eventos.length,ordenMin:eventos[0]?.orden??null,ordenMax:eventos[eventos.length-1]?.orden??null},timestamp:Date.now()})}).catch(()=>{});
          // #endregion agent log
          if (isTerminalClosedError(message)) {
            await db.partidos.update(partidoId, {
              estado: 'finalizado',
              synced: true,
              plantillaSynced: true,
              plantillaSyncStatus: 'synced',
              plantillaSyncError: null,
            });
          }
          for (const ev of eventos) await db.eventos.update(ev.id, { syncStatus: 'failed', syncError: message });
          set({ status: 'failed', lastError: message });
          console.warn('Sync eventos', partidoId, e);
        }
      }
      const anulacionesPartidos = [
        ...new Set((await db.eventosAnulados.filter((e) => !e.synced && !e.isTest).toArray()).map((e) => e.partidoId)),
      ];
      for (const partidoId of anulacionesPartidos) {
        const anulaciones = await db.eventosAnulados
          .where('partidoId')
          .equals(partidoId)
          .filter((e) => !e.synced && !e.isTest)
          .toArray();
        for (const anulacion of anulaciones) {
          try {
            await db.eventosAnulados.update(anulacion.eventId, { syncStatus: 'syncing', syncError: null });
            await api(`/partidos/${partidoId}/eventos/${anulacion.eventId}`, { method: 'DELETE' });
            await db.eventosAnulados.update(anulacion.eventId, { synced: true, syncStatus: 'synced', syncError: null });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await db.eventosAnulados.update(anulacion.eventId, { syncStatus: 'failed', syncError: message });
            set({ status: 'failed', lastError: message });
            console.warn('Sync anulacion evento', partidoId, anulacion.eventId, e);
          }
        }
      }
      const incidenciasPendientes = await db.incidencias.filter((i) => !i.synced && !i.isTest).toArray();
      for (const inc of incidenciasPendientes) {
        try {
          const res = await api<{ id: string }>(`/partidos/${inc.partidoId}/incidencias`, {
            method: 'POST',
            body: {
              id: inc.id,
              tipo: inc.tipo,
              equipoId: inc.equipoId ?? undefined,
              jugadorId: inc.jugadorId ?? undefined,
              motivo: inc.motivo ?? undefined,
            },
          });
          if (res?.id) await db.incidencias.update(inc.id, { synced: true });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          await db.incidencias.update(inc.id, { syncStatus: 'failed', syncError: message });
          set({ status: 'failed', lastError: message });
          console.warn('Sync incidencia', inc.id, e);
        }
      }
      const cierresPendientes = await db.cierresPendientes.toArray();
      for (const c of cierresPendientes) {
        try {
          const foto = await db.fotosCierre.get(c.partidoId);
          const form = new FormData();
          if (foto?.blob) form.append('fotoMarcador', foto.blob, 'marcador.jpg');
          if (c.cuartoActual != null) form.append('cuartoActual', String(c.cuartoActual));
          if (c.segundosRestantesCuarto != null) {
            form.append('segundosRestantesCuarto', String(c.segundosRestantesCuarto));
          }
          const res = await api<{ partido: PartidoJson; folio: string }>(`/partidos/${c.partidoId}/cerrar`, {
            method: 'POST',
            body: form,
            headers: { 'X-Client-Closure-Id': c.clientClosureId },
          });
          const partido = res.partido as PartidoJson;
          await db.partidos.put({
            ...partido,
            synced: true,
            closurePending: false,
          });
          await db.fotosCierre.delete(c.partidoId);
          await db.cierresPendientes.delete(c.id);
        } catch (e) {
          console.warn('Sync cierre', c.partidoId, e);
        }
      }
      const failedItems = await db.eventos.filter((e) => e.syncStatus === 'failed' && !e.isTest).count()
        + await db.eventosAnulados.filter((e) => e.syncStatus === 'failed' && !e.isTest).count()
        + await db.incidencias.filter((i) => i.syncStatus === 'failed' && !i.isTest).count()
        + await db.partidos.filter((p) => p.plantillaSyncStatus === 'failed' && !p.isTest).count();
      set({ status: failedItems > 0 ? 'failed' : 'synced', lastSyncedAt: new Date().toISOString() });
    } catch (e) {
      set({ status: navigator.onLine ? 'pending' : 'offline', lastError: e instanceof Error ? e.message : String(e) });
    }
    await get().updateCounts();
  },
  syncNow: async () => {
    await get().runSync();
  },
  getPartidoSyncHealth: async (partidoId) => {
    const eventos = await db.eventos.where('partidoId').equals(partidoId).filter((e) => !e.isTest).toArray();
    const anulaciones = await db.eventosAnulados.where('partidoId').equals(partidoId).filter((e) => !e.isTest).toArray();
    const incidencias = await db.incidencias.where('partidoId').equals(partidoId).filter((e) => !e.isTest).toArray();
    const partido = await db.partidos.get(partidoId);
    const pendingItems = [
      ...eventos.filter((e) => !e.synced),
      ...anulaciones.filter((e) => !e.synced),
      ...incidencias.filter((e) => !e.synced),
      ...(partido && partido.plantillaSynced !== true && !partido.isTest ? [partido] : []),
    ];
    const failedItems = [
      ...eventos.filter((e) => e.syncStatus === 'failed'),
      ...anulaciones.filter((e) => e.syncStatus === 'failed'),
      ...incidencias.filter((e) => e.syncStatus === 'failed'),
      ...(partido && partido.plantillaSyncStatus === 'failed' && !partido.isTest ? [partido] : []),
    ];
    const lastError =
      [
        ...eventos.map((item) => item.syncError),
        ...anulaciones.map((item) => item.syncError),
        ...incidencias.map((item) => item.syncError),
        partido?.plantillaSyncError,
      ].find((value): value is string => Boolean(value)) ?? null;
    return {
      pending: pendingItems.length,
      failed: failedItems.length,
      lastError,
    };
  },
}));
