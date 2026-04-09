import { Pencil, Trash2, Users } from 'lucide-react';

const ghostIcon =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-slate-400 transition-colors duration-200 hover:bg-slate-700/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]';

export type TeamRowDesktopProps = {
  name: string;
  disabled?: boolean;
  onRename: () => void;
  onJugadores: () => void;
  onDelete: () => void;
};

/** Escritorio: acciones con iconos al hover (como `CourtRowDesktop`). */
export function TeamRowDesktop({ name, disabled, onRename, onJugadores, onDelete }: TeamRowDesktopProps) {
  return (
    <div className="group flex min-h-[3rem] items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 shadow-sm shadow-black/10 transition-colors duration-200 hover:bg-white/[0.07]">
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-snug text-slate-100">
        {name}
      </span>
      <div
        className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
        role="group"
        aria-label="Acciones del equipo"
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onRename}
          className={`${ghostIcon} hover:text-sky-300`}
          aria-label="Renombrar equipo"
          title="Renombrar"
        >
          <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onJugadores}
          className={`${ghostIcon} hover:text-emerald-300`}
          aria-label="Gestionar jugadores"
          title="Jugadores"
        >
          <Users className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          className={`${ghostIcon} hover:text-red-400 hover:bg-red-950/35 focus-visible:ring-red-500/50`}
          aria-label="Dar de baja equipo"
          title="Dar de baja"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
