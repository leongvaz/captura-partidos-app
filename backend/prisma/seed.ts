import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const anotadorPinHash = await bcrypt.hash('1234', 10);
  const consultaPinHash = await bcrypt.hash('5678', 10);

  const liga = await prisma.liga.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      nombre: 'Liga Amateur Demo',
      temporada: '2025-2026',
      categorias: '["primera","segunda","veteranos","femenil","varonil"]',
    },
  });

  const usuarioAnotador = await prisma.usuario.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: { pinHash: anotadorPinHash },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      nombre: 'Anotador Demo',
      pinHash: anotadorPinHash,
    },
  });

  await prisma.membresiaLiga.upsert({
    where: {
      ligaId_usuarioId_rol: {
        ligaId: liga.id,
        usuarioId: usuarioAnotador.id,
        rol: 'anotador_partido',
      },
    },
    update: {},
    create: {
      ligaId: liga.id,
      usuarioId: usuarioAnotador.id,
      rol: 'anotador_partido',
      activo: true,
    },
  });

  const usuarioConsulta = await prisma.usuario.upsert({
    where: { id: '00000000-0000-0000-0000-000000000006' },
    update: { pinHash: consultaPinHash },
    create: {
      id: '00000000-0000-0000-0000-000000000006',
      nombre: 'Consulta Demo',
      pinHash: consultaPinHash,
    },
  });

  await prisma.membresiaLiga.upsert({
    where: {
      ligaId_usuarioId_rol: {
        ligaId: liga.id,
        usuarioId: usuarioConsulta.id,
        rol: 'consulta',
      },
    },
    update: {},
    create: {
      ligaId: liga.id,
      usuarioId: usuarioConsulta.id,
      rol: 'consulta',
      activo: true,
    },
  });

  const cancha1 = await prisma.cancha.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      ligaId: liga.id,
      nombre: 'Cancha 1',
    },
  });

  const equipoA = await prisma.equipo.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      ligaId: liga.id,
      nombre: 'Halcones',
      categoria: 'primera',
    },
  });

  const equipoB = await prisma.equipo.upsert({
    where: { id: '00000000-0000-0000-0000-000000000005' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000005',
      ligaId: liga.id,
      nombre: 'Águilas',
      categoria: 'primera',
    },
  });

  const numerosA = [7, 10, 12, 23, 34];
  const numerosB = [5, 8, 11, 15, 24];

  for (let i = 0; i < 5; i++) {
    await prisma.jugador.upsert({
      where: { id: `00000000-0000-0000-0000-00000000001${i}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000001${i}`,
        equipoId: equipoA.id,
        nombre: 'Jugador',
        apellido: `Local ${i + 1}`,
        numero: numerosA[i],
      },
    });
  }

  for (let i = 0; i < 5; i++) {
    await prisma.jugador.upsert({
      where: { id: `00000000-0000-0000-0000-00000000002${i}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000002${i}`,
        equipoId: equipoB.id,
        nombre: 'Jugador',
        apellido: `Visitante ${i + 1}`,
        numero: numerosB[i],
      },
    });
  }

  console.log('Seed OK.');
  console.log('- Liga:', liga.nombre, '(ID:', liga.id + ')');
  console.log('- Anotador Demo -> PIN 1234');
  console.log('- Consulta Demo -> PIN 5678');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
