import { useSyncStore } from '@/store/syncStore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/db';

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
  const { status, pendingEventos, pendingPartidos, pendingAnulaciones, failedItems, lastError, syncNow } = useSyncStore();
  const [open, setOpen] = useState(false);
  const [limpiando, setLimpiando] = useState(false);

  const hasAnyIssues = useMemo(() => {
    return (
      status === 'offline' ||
      status === 'failed' ||
      pendingEventos > 0 ||
      pendingPartidos > 0 ||
      pendingAnulaciones > 0 ||
      failedItems > 0
    );
  }, [failedItems, pendingAnulaciones, pendingEventos, pendingPartidos, status]);

  useEffect(() => {
    useSyncStore.getState().runSync();
    const onOnline = () => {
      useSyncStore.getState().runSync();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  let indicatorStatus: IndicatorStatus;

  if (status === 'syncing') {
    indicatorStatus = 'loading';
  } else if (hasAnyIssues) {
    indicatorStatus = 'error';
  } else {
    indicatorStatus = 'synced';
  }

  const title = status === 'failed'
    ? `Error de sincronización${lastError ? `: ${lastError}` : ''}`
    : status === 'offline'
      ? 'Sin conexión'
      : status === 'syncing'
        ? 'Sincronizando...'
        : pendingEventos || pendingPartidos || pendingAnulaciones
          ? `Pendientes: ${pendingEventos} eventos, ${pendingAnulaciones} anulaciones, ${pendingPartidos} partidos`
          : 'Sincronizado';

  const limpiarPendientesLocales = async () => {
    const ok = window.confirm(
      '¿Limpiar la cola local de sincronización?\n\nEsto borrará partidos/eventos/incidencias/anulaciones/cierres PENDIENTES o FALLIDOS del dispositivo.\n\nNo borra equipos/jugadores/ligas.\n\nEsta acción no se puede deshacer.'
    );
    if (!ok) return;
    setLimpiando(true);
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
          // Borra todo lo que esté pendiente o fallido (lo que provoca reintentos/errores).
          await db.eventos.filter((e) => !e.synced || e.syncStatus === 'failed').delete();
          await db.eventosAnulados.filter((e) => !e.synced || e.syncStatus === 'failed').delete();
          await db.incidencias.filter((i) => !i.synced || i.syncStatus === 'failed').delete();
          await db.cierresPendientes.clear();
          await db.fotosCierre.clear();

          // Partidos pendientes (creación/plantilla) que ya no se pueden subir.
          const partidosToDelete = await db.partidos
            .filter((p) => !p.synced || p.plantillaSynced !== true || p.plantillaSyncStatus === 'failed')
            .toArray();
          for (const p of partidosToDelete) {
            await db.plantilla.where('partidoId').equals(p.id).delete();
            await db.partidos.delete(p.id);
          }
        }
      );
      await useSyncStore.getState().updateCounts();
      setOpen(false);
    } catch (err) {
      console.error(err);
      alert('No se pudo limpiar la cola local.');
    } finally {
      setLimpiando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={title}
        className="flex items-center justify-center p-1 rounded-full hover:bg-slate-700/60 focus:outline-none focus:ring-2 focus:ring-slate-200/60"
        aria-label="Estado de sincronización"
      >
        <SyncStatusIndicator status={indicatorStatus} />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => !limpiando && setOpen(false)}
        >
          <div
            className="bg-slate-800 rounded-xl border border-slate-600 p-5 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-slate-100">Sincronización</h3>
              <button
                type="button"
                className="text-slate-300 hover:text-white"
                onClick={() => !limpiando && setOpen(false)}
                aria-label="Cerrar"
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="text-sm text-slate-300 space-y-1 mb-3">
              <div>
                Estado: <span className="font-medium">{status}</span>
              </div>
              <div>Pendientes: {pendingPartidos} partidos, {pendingEventos} eventos, {pendingAnulaciones} anulaciones</div>
              <div>Fallidos: {failedItems}</div>
            </div>

            {lastError && (
              <div className="text-xs text-rose-200 bg-rose-900/30 border border-rose-800 rounded-lg p-2 mb-3 break-words">
                {lastError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await syncNow();
                  await useSyncStore.getState().updateCounts();
                }}
                className="flex-1 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700"
              >
                Sincronizar ahora
              </button>
              <button
                type="button"
                onClick={limpiarPendientesLocales}
                disabled={limpiando}
                className="flex-1 py-2 rounded-lg bg-rose-700 text-white font-medium hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {limpiando ? 'Limpiando…' : 'Limpiar cola'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
