/**
 * Tras agregar Sede/sedeId: crea una sede "Sede principal" por liga y enlaza canchas huérfanas.
 * Uso: npx tsx src/scripts/backfill_sedes_canchas.ts
 */
import { prisma } from '../lib/prisma.js';

async function main() {
  const sinSede = await prisma.cancha.findMany({ where: { sedeId: null } });
  if (sinSede.length === 0) {
    console.log('No hay canchas sin sede.');
    return;
  }
  const ligaIds = [...new Set(sinSede.map((c) => c.ligaId))];
  for (const ligaId of ligaIds) {
    const sede = await prisma.sede.create({
      data: { ligaId, nombre: 'Sede principal' },
    });
    await prisma.cancha.updateMany({
      where: { ligaId, sedeId: null },
      data: { sedeId: sede.id },
    });
    console.log(`Liga ${ligaId}: sede "${sede.nombre}" (${sede.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
