/**
 * Una sola vez (o tras importar datos viejos):
 * 1) Vincula Jugador.personaId según CURP (tabla Persona).
 * 2) Regenera ResumenJugadorPartido para partidos cerrados.
 *
 * Uso: npx tsx src/scripts/backfill_persona_resumenes.ts
 */
import { prisma } from '../lib/prisma.js';
import { ensurePersonaPorCurp } from '../lib/persona.js';
import { syncResumenesPartido } from '../lib/resumenJugadorPartido.js';

async function main() {
  const conCurp = await prisma.jugador.findMany({
    where: { curp: { not: null } },
  });
  let vinculados = 0;
  for (const j of conCurp) {
    if (!j.curp) continue;
    const personaId = await ensurePersonaPorCurp({
      curp: j.curp,
      nombre: j.nombre,
      apellido: j.apellido,
      sexo: j.sexo,
      fechaNacimiento: j.fechaNacimiento,
    });
    if (j.personaId !== personaId) {
      await prisma.jugador.update({ where: { id: j.id }, data: { personaId } });
      vinculados++;
    }
  }
  console.log(`Jugadores con CURP: ${conCurp.length}, actualizados con personaId: ${vinculados}`);

  const cerrados = await prisma.partido.findMany({
    where: {
      estado: { in: ['finalizado', 'default_local', 'default_visitante'] },
    },
    select: { id: true },
  });
  for (const p of cerrados) {
    await syncResumenesPartido(p.id);
  }
  console.log(`Resúmenes regenerados para ${cerrados.length} partidos cerrados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
