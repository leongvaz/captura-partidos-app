import { useCallback, useRef, useState } from 'react';
import { SwipeActions, COURT_SWIPE_REVEAL_PX } from './SwipeActions';

export type CourtRowMobileProps = {
  courtId: string;
  name: string;
  openSwipeId: string | null;
  onOpenSwipeId: (id: string | null) => void;
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * Móvil: dos capas en la misma celda de grid bajo un único `overflow-hidden rounded-xl`.
 * Así el recorte es una sola forma redondeada: la franja de acciones no “sobresale” del contorno.
 * El frontal es translúcido + blur para insinuar el color de fondo sin efecto de capas descuadradas.
 */
export function CourtRowMobile({
  courtId,
  name,
  openSwipeId,
  onOpenSwipeId,
  disabled,
  onEdit,
  onDelete,
}: CourtRowMobileProps) {
  const open = openSwipeId === courtId;
  const [pull, setPull] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; base: number } | null>(null);
  const W = COURT_SWIPE_REVEAL_PX;

  const offset = pull !== null ? pull : open ? -W : 0;

  const closeOthersThenStart = useCallback(
    (clientX: number) => {
      if (disabled) return;
      if (openSwipeId != null && openSwipeId !== courtId) {
        onOpenSwipeId(null);
      }
      drag.current = {
        startX: clientX,
        base: open ? -W : 0,
      };
      setDragging(true);
      setPull(open ? -W : 0);
    },
    [disabled, openSwipeId, courtId, onOpenSwipeId, open, W]
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
      onOpenSwipeId(courtId);
    } else {
      onOpenSwipeId(null);
    }
  }, [disabled, pull, open, W, courtId, onOpenSwipeId]);

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
        {/* Capa trasera: base suave + franja de acciones pegada a la derecha, ya recortada por el padre */}
        <div className="col-start-1 row-start-1 flex min-h-[3rem] w-full items-stretch justify-end bg-slate-950/25">
          <SwipeActions disabled={disabled} onEdit={tapEdit} onDelete={tapDelete} />
        </div>

        {/* Capa frontal: mismo radio `rounded-xl` que la tarjeta y que la franja inferior, para que la silueta coincida al deslizar */}
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
            'col-start-1 row-start-1 z-10 flex min-h-[3rem] w-full touch-pan-y items-center rounded-xl px-4 py-2.5',
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
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-snug text-slate-100">
            {name}
          </span>
        </div>
      </div>
    </div>
  );
}
