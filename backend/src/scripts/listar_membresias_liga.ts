import { prisma } from '../lib/prisma.js';

async function main() {
  const ligaId = process.argv[2];
  if (!ligaId) {
    console.log('Uso: npx tsx src/scripts/listar_membresias_liga.ts <ligaId>');
    process.exit(1);
  }

  const liga = await prisma.liga.findUnique({ where: { id: ligaId } });
  if (!liga) {
    console.log('Liga no encontrada:', ligaId);
    process.exit(1);
  }

  const membresias = await prisma.membresiaLiga.findMany({
    where: { ligaId, activo: true },
    include: { usuario: true },
    orderBy: [{ rol: 'asc' }, { createdAt: 'asc' }],
  });

  const resumen = membresias.map((m) => ({
    rol: m.rol,
    usuario: m.usuario.nombre,
    email: m.usuario.email,
    curp: m.usuario.curp,
    usuarioId: m.usuarioId,
  }));

  console.log('Liga:', { id: liga.id, nombre: liga.nombre, temporada: liga.temporada });
  console.log('Membresías activas:', resumen.length);
  console.log(resumen);

  const admins = resumen.filter((r) => r.rol === 'admin_liga');
  console.log('Admins (admin_liga):', admins.length);
  console.log(admins);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

