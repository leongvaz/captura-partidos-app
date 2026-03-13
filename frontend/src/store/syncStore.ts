import { create } from 'zustand';
import { db } from '@/lib/db';
import { api } from '@/lib/api';

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
    const partidosP = await db.partidos.filter((p) => !p.synced).count();
    const eventosP = await db.eventos.filter((e) => !e.synced).count();
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
      const partidosPendientes = await db.partidos.filter((p) => !p.synced).toArray();
      for (const p of partidosPendientes) {
        try {
          await api('/partidos', { method: 'POST', body: p });
          await db.partidos.update(p.id, { synced: true });
        } catch (e) {
          console.warn('Sync partido', p.id, e);
        }
      }
      const uniquePartidos = [...new Set((await db.eventos.filter((e) => !e.synced).toArray()).map((e) => e.partidoId))];
      for (const partidoId of uniquePartidos) {
        const eventos = await db.eventos.where('partidoId').equals(partidoId).filter((e) => !e.synced).sortBy('orden');
        if (eventos.length === 0) continue;
        try {
          await api(`/partidos/${partidoId}/eventos`, { method: 'POST', body: { eventos } });
          for (const e of eventos) await db.eventos.update(e.id, { synced: true });
        } catch (e) {
          console.warn('Sync eventos', partidoId, e);
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
