import type { ReglasLigaConfig } from './api';

function hoyYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Si el período de inscripción en reglas permite dar de alta equipos hoy (fechas en `yyyy-MM-dd`). */
export function inscripcionEquiposPermitidaPorReglas(cfg: ReglasLigaConfig): boolean {
  const pi = cfg.periodoInscripcion;
  const inicio = pi?.inicio?.trim() || '';
  const fin = pi?.fin?.trim() || '';
  const hoy = hoyYmd();
  if (!inicio && !fin) return true;
  if (inicio && hoy < inicio) return false;
  if (fin && hoy > fin) return false;
  return true;
}
