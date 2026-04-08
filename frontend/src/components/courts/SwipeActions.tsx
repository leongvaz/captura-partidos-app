/** Ancho del panel de acciones al deslizar (debe coincidir con la lógica de swipe en `CourtRowMobile`). */
export const COURT_SWIPE_REVEAL_PX = 120;

type SwipeActionsProps = {
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
};

const btnBase =
  'flex flex-1 min-h-0 min-w-0 items-center justify-center px-1.5 text-center text-xs font-medium leading-none text-white transition-colors duration-200 disabled:opacity-40';

/**
 * Franja derecha con separación entre botones para que cada uno lleve su propio radio.
 * Editar: redondeo en las cuatro esquinas. Borrar: rojo + redondeo en la izquierda; la derecha la recorta el contenedor `rounded-r-xl`.
 */
export function SwipeActions({ onEdit, onDelete, disabled }: SwipeActionsProps) {
  return (
    <div
      className="flex h-full min-h-[3rem] w-[120px] shrink-0 self-stretch gap-1 overflow-hidden rounded-r-xl p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      role="group"
      aria-label="Acciones de la cancha"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onEdit}
        aria-label="Editar cancha"
        className={`${btnBase} rounded-xl bg-sky-600 active:bg-sky-700`}
      >
        <span className="block max-w-full truncate">Editar</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        aria-label="Dar de baja cancha"
        className={`${btnBase} rounded-xl bg-red-600 active:bg-red-700`}
      >
        <span className="block max-w-full truncate">Borrar</span>
      </button>
    </div>
  );
}
