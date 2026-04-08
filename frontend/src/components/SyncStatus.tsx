import { useSyncStore } from '@/store/syncStore';
import { useEffect } from 'react';

type IndicatorStatus = 'synced' | 'error' | 'loading';

interface SyncStatusIndicatorProps {
  status: IndicatorStatus;
}

export function SyncStatusIndicator({ status }: SyncStatusIndicatorProps) {
  if (status === 'loading') {
    return (
      <span
        className="inline-flex h-3 w-3 items-center justify-center"
        aria-label="Sincronizando..."
        title="Sincronizando..."
      >
        <span className="h-3 w-3 border-2 border-slate-200 border-t-transparent rounded-full animate-spin" />
      </span>
    );
  }

  const commonClasses = 'inline-block h-3 w-3 rounded-full';

  if (status === 'error') {
    return (
      <span
        className={`${commonClasses} bg-red-500`}
        aria-label="Sin conexión"
        title="Sin conexión"
      />
    );
  }

  // synced
  return (
    <span
      className={`${commonClasses} bg-emerald-500 animate-pulse`}
      aria-label="Sincronizado"
      title="Sincronizado"
    />
  );
}

export default function SyncStatus() {
  const { status, pendingEventos, pendingPartidos, syncNow } = useSyncStore();

  useEffect(() => {
    useSyncStore.getState().runSync();
  }, []);

  let indicatorStatus: IndicatorStatus;

  if (status === 'syncing') {
    indicatorStatus = 'loading';
  } else if (status === 'offline' || pendingEventos > 0 || pendingPartidos > 0) {
    indicatorStatus = 'error';
  } else {
    indicatorStatus = 'synced';
  }

  return (
    <button
      type="button"
      onClick={syncNow}
      className="flex items-center justify-center p-1 rounded-full hover:bg-slate-700/60 focus:outline-none focus:ring-2 focus:ring-slate-200/60"
      aria-label="Estado de sincronización"
    >
      <SyncStatusIndicator status={indicatorStatus} />
    </button>
  );
}
