import { useCallback, useRef, useState } from 'react';
import { TeamSwipeActions, TEAM_SWIPE_REVEAL_PX } from './TeamSwipeActions';

export type TeamSwipeRowMobileProps = {
  teamId: string;
  name: string;
  openSwipeId: string | null;
  onOpenSwipeId: (id: string | null) => void;
  disabled?: boolean;
  onRename: () => void;
  onJugadores: () => void;
  onDelete: () => void;
};

/** Móvil: deslizar para Renombrar / Jugadores / Dar de baja (mismo patrón que `CourtRowMobile`). */
export function TeamSwipeRowMobile({
  teamId,
  name,
  openSwipeId,
  onOpenSwipeId,
  disabled,
  onRename,
  onJugadores,
  onDelete,
}: TeamSwipeRowMobileProps) {
  const open = openSwipeId === teamId;
  const [pull, setPull] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; base: number } | null>(null);
  const W = TEAM_SWIPE_REVEAL_PX;

  const offset = pull !== null ? pull : open ? -W : 0;

  const closeOthersThenStart = useCallback(
    (clientX: number) => {
      if (disabled) return;
      if (openSwipeId != null && openSwipeId !== teamId) {
        onOpenSwipeId(null);
      }
      drag.current = {
        startX: clientX,
        base: open ? -W : 0,
      };
      setDragging(true);
      setPull(open ? -W : 0);
    },
    [disabled, openSwipeId, teamId, onOpenSwipeId, open, W]
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
      onOpenSwipeId(teamId);
    } else {
      onOpenSwipeId(null);
    }
  }, [disabled, pull, open, W, teamId, onOpenSwipeId]);

  const tapRename = () => {
    onOpenSwipeId(null);
    onRename();
  };
  const tapJugadores = () => {
    onOpenSwipeId(null);
    onJugadores();
  };
  const tapDelete = () => {
    onOpenSwipeId(null);
    onDelete();
  };

  return (
    <div className="box-border min-h-[3rem] w-full overflow-hidden rounded-xl border border-white/[0.08] shadow-sm shadow-black/15">
      <div className="grid min-h-[3rem] w-full grid-cols-1 grid-rows-1">
        <div className="col-start-1 row-start-1 flex min-h-[3rem] w-full items-stretch justify-end bg-slate-950/25">
          <TeamSwipeActions
            disabled={disabled}
            onRename={tapRename}
            onJugadores={tapJugadores}
            onDelete={tapDelete}
          />
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
