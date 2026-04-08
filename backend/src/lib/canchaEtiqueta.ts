type CanchaConSede = {
  nombre: string;
  sede: { nombre: string } | null;
};

/** Texto para actas, panel y PDF: "Sede — Cancha" o solo nombre si no hay sede (datos viejos). */
export function etiquetaCancha(c: CanchaConSede): string {
  if (c.sede?.nombre) {
    return `${c.sede.nombre} — ${c.nombre}`;
  }
  return c.nombre;
}
