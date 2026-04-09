import { RowActions } from '@/components/courts/RowActions';

export type JugadorRowDesktopProps = {
  numero: number;
  nombre: string;
  apellido: string;
  curp: string | null | undefined;
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

/** Escritorio: iconos al hover (mismo estilo que canchas). */
export function JugadorRowDesktop({
  numero,
  nombre,
  apellido,
  curp,
  disabled,
  onEdit,
  onDelete,
}: JugadorRowDesktopProps) {
  return (
    <div className="group flex min-h-[3rem] items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2 shadow-sm shadow-black/10 transition-colors duration-200 hover:bg-white/[0.07]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-100">
        {numero}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-100">
          {nombre} {apellido}
        </div>
        {curp ? <div className="truncate font-mono text-[11px] text-slate-500">{curp}</div> : null}
      </div>
      <RowActions
        disabled={disabled}
        onEdit={onEdit}
        onDelete={onDelete}
        className="opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
      />
    </div>
  );
}
