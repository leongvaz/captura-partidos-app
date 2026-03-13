import { useSyncStore } from '@/store/syncStore';
import { useEffect } from 'react';

export default function SyncStatus() {
  const { status, pendingEventos, pendingPartidos, syncNow } = useSyncStore();

  useEffect(() => {
    useSyncStore.getState().runSync();
  }, []);

  if (status === 'offline') {
    return (
      <span className="text-xs text-amber-400" title="Sin conexión">
        Sin conexión
      </span>
    );
  }
  if (status === 'syncing') {
    return <span className="text-xs text-blue-400 animate-pulse">Sincronizando...</span>;
  }
  if (pendingEventos > 0 || pendingPartidos > 0) {
    return (
      <button
        type="button"
        onClick={syncNow}
        className="text-xs text-amber-400 hover:text-amber-300 underline"
      >
        {pendingPartidos + pendingEventos} pendientes · Sincronizar
      </button>
    );
  }
  return (
    <span className="text-xs text-emerald-400" title="Todo sincronizado">
      Sincronizado
    </span>
  );
}
