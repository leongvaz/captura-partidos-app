import { prisma } from './prisma.js';

/** Nombres de sede por id (sin usar `include: { sede }` en Cancha). */
export async function sedeNombrePorIdMap(
  sedeIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const uniq = [...new Set(sedeIds.filter((x): x is string => !!x))];
  if (uniq.length === 0) return new Map();
  const rows = await prisma.sede.findMany({
    where: { id: { in: uniq } },
    select: { id: true, nombre: true },
  });
  return new Map(rows.map((r) => [r.id, r.nombre]));
}
