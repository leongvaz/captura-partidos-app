import { create } from 'zustand';
import { db } from '@/lib/db';
import { api } from '@/lib/api';
import type { Partido } from '@/types/entities';
type PartidoJson = Partido & { cerradoAt?: string | null };

type SyncStatus = 'idle' | 'offline' | 'pending' | 'syncing' | 'synced';

interface SyncState {
  status: SyncStatus;
  pendingPartidos: number;
  pendingEventos: number;
  lastSyncedAt: string | null;
  setStatus: (s: SyncStatus) => void;
  runSync: () => Promise<void>;
  syncNow: () => Promise<void>;
  updateCounts: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  pendingPartidos: 0,
  pendingEventos: 0,
  lastSyncedAt: null,
  setStatus: (s) => set({ status: s }),
  updateCounts: async () => {
    const partidosP = await db.partidos.filter((p) => !p.synced && !p.isTest).count();
    const eventosP = await db.eventos.filter((e) => !e.synced && !e.isTest).count();
    set({
      pendingPartidos: partidosP,
      pendingEventos: eventosP,
      status: eventosP > 0 || partidosP > 0 ? 'pending' : navigator.onLine ? 'synced' : get().status,
    });
  },
  runSync: async () => {
    if (!navigator.onLine) {
      set({ status: 'offline' });
      await get().updateCounts();
      return;
    }
    set({ status: 'syncing' });
    try {
      const partidosPendientes = await db.partidos.filter((p) => !p.synced && !p.isTest).toArray();
      for (const p of partidosPendientes) {
        try {
          await api('/partidos', { method: 'POST', body: p });
          await db.partidos.update(p.id, { synced: true });
        } catch (e) {
          console.warn('Sync partido', p.id, e);
        }
      }
      const uniquePartidos = [
        ...new Set((await db.eventos.filter((e) => !e.synced && !e.isTest).toArray()).map((e) => e.partidoId)),
      ];
      for (const partidoId of uniquePartidos) {
        const eventos = await db.eventos
          .where('partidoId')
          .equals(partidoId)
          .filter((e) => !e.synced && !e.isTest)
          .sortBy('orden');
        if (eventos.length === 0) continue;
        try {
          await api(`/partidos/${partidoId}/eventos`, { method: 'POST', body: { eventos } });
          for (const e of eventos) await db.eventos.update(e.id, { synced: true });
        } catch (e) {
          console.warn('Sync eventos', partidoId, e);
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
          console.warn('Sync incidencia', inc.id, e);
        }
      }
      const cierresPendientes = await db.cierresPendientes.toArray();
      for (const c of cierresPendientes) {
        try {
          const foto = await db.fotosCierre.get(c.partidoId);
          const form = new FormData();
          if (foto?.blob) form.append('fotoMarcador', foto.blob, 'marcador.jpg');
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
      set({ status: 'synced', lastSyncedAt: new Date().toISOString() });
    } catch (e) {
      set({ status: navigator.onLine ? 'pending' : 'offline' });
    }
    await get().updateCounts();
  },
  syncNow: async () => {
    await get().runSync();
  },
}));
