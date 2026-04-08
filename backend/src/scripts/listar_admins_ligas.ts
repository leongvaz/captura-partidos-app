import { prisma } from '../lib/prisma.js';

async function main() {
  const membresias = await prisma.membresiaLiga.findMany({
    where: { rol: 'admin_liga', activo: true },
    include: { usuario: true, liga: true },
    orderBy: [{ ligaId: 'asc' }, { createdAt: 'asc' }],
  });

  const rows = membresias.map((m) => ({
    liga: m.liga.nombre,
    ligaId: m.ligaId,
    usuario: m.usuario.nombre,
    email: m.usuario.email,
    curp: m.usuario.curp,
    usuarioId: m.usuarioId,
  }));

  console.log('Admins (admin_liga) activos:', rows.length);
  console.log(rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

