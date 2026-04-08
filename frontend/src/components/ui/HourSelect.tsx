import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const triggerClasses =
  'w-full flex items-center justify-between gap-2 rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm text-left ' +
  'hover:bg-slate-600/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

function parseHour(value: string | null | undefined, fallback: number): number {
  if (value == null || value === '') return fallback;
  const m = String(value).trim().match(/^(\d{1,2})/);
  if (!m) return fallback;
  return Math.min(23, Math.max(0, parseInt(m[1], 10)));
}

export function hourToHH00(h: number): string {
  return `${String(Math.min(23, Math.max(0, h))).padStart(2, '0')}:00`;
}

export function normalizeJornadaHour(value: string | null | undefined, fallbackHour: number): string {
  return hourToHH00(parseHour(value, fallbackHour));
}

interface HourSelectProps {
  value: string | null | undefined;
  onChange: (hhmm: string) => void;
  fallbackHour?: number;
  id?: string;
  'aria-labelledby'?: string;
  className?: string;
}

export function HourSelect({
  value,
  onChange,
  fallbackHour = 8,
  id,
  'aria-labelledby': ariaLabelledBy,
  className = '',
}: HourSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseHour(value, fallbackHour);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={triggerClasses}
      >
        <span>{hourToHH00(selected)}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-600 bg-slate-800 py-1 shadow-xl ring-1 ring-black/20"
        >
          {HOURS.map((h) => {
            const label = hourToHH00(h);
            const isSel = h === selected;
            return (
              <li key={h} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    isSel
                      ? 'bg-primary-600/30 text-slate-50 font-medium'
                      : 'text-slate-200 hover:bg-slate-700'
                  }`}
                  onClick={() => {
                    onChange(label);
                    setOpen(false);
                  }}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
