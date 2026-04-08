import { RowActions } from './RowActions';

export type CourtRowDesktopProps = {
  name: string;
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * Fila de cancha en escritorio: sin swipe; acciones con iconos al hover o focus-within del grupo.
 */
export function CourtRowDesktop({ name, disabled, onEdit, onDelete }: CourtRowDesktopProps) {
  return (
    <div className="group flex min-h-[3rem] items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 shadow-sm shadow-black/10 transition-colors duration-200 hover:bg-white/[0.07]">
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-snug text-slate-100">
        {name}
      </span>
      <RowActions
        disabled={disabled}
        onEdit={onEdit}
        onDelete={onDelete}
        className="opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
      />
    </div>
  );
}
