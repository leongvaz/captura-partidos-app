import { useCallback, useRef, useState } from 'react';
import { SwipeActions, COURT_SWIPE_REVEAL_PX } from '@/components/courts/SwipeActions';

export type JugadorSwipeRowMobileProps = {
  jugadorId: string;
  numero: number;
  nombre: string;
  apellido: string;
  curp: string | null | undefined;
  openSwipeId: string | null;
  onOpenSwipeId: (id: string | null) => void;
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

/** Deslizar para editar / eliminar jugador (mismo patrón que canchas). */
export function JugadorSwipeRowMobile({
  jugadorId,
  numero,
  nombre,
  apellido,
  curp,
  openSwipeId,
  onOpenSwipeId,
  disabled,
  onEdit,
  onDelete,
}: JugadorSwipeRowMobileProps) {
  const open = openSwipeId === jugadorId;
  const [pull, setPull] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; base: number } | null>(null);
  const W = COURT_SWIPE_REVEAL_PX;

  const offset = pull !== null ? pull : open ? -W : 0;

  const closeOthersThenStart = useCallback(
    (clientX: number) => {
      if (disabled) return;
      if (openSwipeId != null && openSwipeId !== jugadorId) {
        onOpenSwipeId(null);
      }
      drag.current = {
        startX: clientX,
        base: open ? -W : 0,
      };
      setDragging(true);
      setPull(open ? -W : 0);
    },
    [disabled, openSwipeId, jugadorId, onOpenSwipeId, open, W]
  );

  const moveDrag = useCallback(
    (clientX: number) => {
      if (!drag.current || disabled) return;
      const dx = clientX - drag.current.startX;
      const next = Math.min(0, Math.max(-W, drag.current.base + dx));
      setPull(next);
    },
    [disabled, W]
  );

  const endDrag = useCallback(() => {
    if (disabled) {
      drag.current = null;
      setDragging(false);
      setPull(null);
      return;
    }
    const end = pull !== null ? pull : open ? -W : 0;
    drag.current = null;
    setDragging(false);
    setPull(null);
    if (end < -W / 2) {
      onOpenSwipeId(jugadorId);
    } else {
      onOpenSwipeId(null);
    }
  }, [disabled, pull, open, W, jugadorId, onOpenSwipeId]);

  const tapEdit = () => {
    onOpenSwipeId(null);
    onEdit();
  };
  const tapDelete = () => {
    onOpenSwipeId(null);
    onDelete();
  };

  return (
    <div className="box-border min-h-[3rem] w-full overflow-hidden rounded-xl border border-white/[0.08] shadow-sm shadow-black/15">
      <div className="grid min-h-[3rem] w-full grid-cols-1 grid-rows-1">
        <div className="col-start-1 row-start-1 flex min-h-[3rem] w-full items-stretch justify-end bg-slate-950/25">
          <SwipeActions disabled={disabled} onEdit={tapEdit} onDelete={tapDelete} />
        </div>

        <div
          onTouchStart={(e) => {
            if (e.touches.length !== 1) return;
            closeOthersThenStart(e.touches[0].clientX);
          }}
          onTouchMove={(e) => {
            if (e.touches.length !== 1) return;
            moveDrag(e.touches[0].clientX);
          }}
          onTouchEnd={endDrag}
          onTouchCancel={() => {
            setDragging(false);
            drag.current = null;
            setPull(null);
            if (!open) onOpenSwipeId(null);
          }}
          className={[
            'col-start-1 row-start-1 z-10 flex min-h-[3rem] w-full touch-pan-y items-center gap-3 rounded-xl px-3 py-2',
            'border-0 bg-slate-950/50 backdrop-blur-md',
            'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]',
            dragging ? '' : 'transition-[transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          ].join(' ')}
          style={{
            transform: `translate3d(${offset}px,0,0)`,
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
          }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-100">
            {numero}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium leading-snug text-slate-100">
              {nombre} {apellido}
            </div>
            {curp ? (
              <div className="truncate font-mono text-[11px] text-slate-500">{curp}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
