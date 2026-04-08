import { Pencil, Trash2 } from 'lucide-react';

type RowActionsProps = {
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
  className?: string;
};

const ghostIcon =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-slate-400 transition-colors duration-200 hover:bg-slate-700/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]';

/**
 * Acciones de escritorio: iconos circulares tipo ghost, visibles con hover del grupo padre.
 */
export function RowActions({ onEdit, onDelete, disabled, className = '' }: RowActionsProps) {
  return (
    <div
      className={`flex shrink-0 items-center gap-1 ${className}`}
      role="group"
      aria-label="Acciones de la cancha"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onEdit}
        className={ghostIcon}
        aria-label="Editar cancha"
        title="Editar"
      >
        <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        className={`${ghostIcon} hover:text-red-400 hover:bg-red-950/35 focus-visible:ring-red-500/50`}
        aria-label="Dar de baja cancha"
        title="Eliminar"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
