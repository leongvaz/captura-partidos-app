import { Pencil, Trash2, Users } from 'lucide-react';

export const TEAM_SWIPE_REVEAL_PX = 132;

const btnBase =
  'flex flex-1 min-h-0 min-w-0 items-center justify-center px-0.5 text-center transition-colors duration-200 disabled:opacity-40';

type TeamSwipeActionsProps = {
  onRename: () => void;
  onJugadores: () => void;
  onDelete: () => void;
  disabled?: boolean;
};

/** Franja trasera al deslizar (mismo patrón que canchas en `SwipeActions`). */
export function TeamSwipeActions({ onRename, onJugadores, onDelete, disabled }: TeamSwipeActionsProps) {
  return (
    <div
      className="flex h-full min-h-[3rem] w-[132px] shrink-0 self-stretch gap-1 overflow-hidden rounded-r-xl p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      role="group"
      aria-label="Acciones del equipo"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onRename}
        aria-label="Renombrar equipo"
        title="Renombrar"
        className={`${btnBase} rounded-xl bg-sky-600 text-white active:bg-sky-700`}
      >
        <Pencil className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onJugadores}
        aria-label="Gestionar jugadores"
        title="Jugadores"
        className={`${btnBase} rounded-xl bg-emerald-700 text-white active:bg-emerald-800`}
      >
        <Users className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        aria-label="Dar de baja equipo"
        title="Dar de baja"
        className={`${btnBase} rounded-xl bg-red-600 text-white active:bg-red-700`}
      >
        <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
