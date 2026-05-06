import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const anotadorPinHash = await bcrypt.hash('1234', 10);
  const anotador2PinHash = await bcrypt.hash('2222', 10);
  const consultaPinHash = await bcrypt.hash('5678', 10);
  const consulta2PinHash = await bcrypt.hash('8888', 10);
  const anotadorPruebas1PinHash = await bcrypt.hash('1111', 10);
  const anotadorPruebas1PasswordHash = await bcrypt.hash('1111', 10);

  const TEMPORADA_DEMO_ID = '00000000-0000-0000-0000-0000000000T1';

  const liga = await prisma.liga.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      nombre: 'Liga Amateur Demo',
      categorias: '["primera","segunda","veteranos","femenil","varonil"]',
    },
  });

  await prisma.temporada.upsert({
    where: { id: TEMPORADA_DEMO_ID },
    update: {},
    create: {
      id: TEMPORADA_DEMO_ID,
      ligaId: liga.id,
      etiqueta: '2025-2026',
      estado: 'activa',
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

  // Anotador de pruebas por email (para login-email en producción)
  // Nota: `Usuario.email` no es unique en el schema, así que evitamos upsert por email.
  const anotadorPruebas1Email = 'anotador1@texcoco.com';
  let usuarioAnotadorPruebas1 = await prisma.usuario.findFirst({
    where: { email: anotadorPruebas1Email.toLowerCase().trim() },
  });
  if (!usuarioAnotadorPruebas1) {
    usuarioAnotadorPruebas1 = await prisma.usuario.create({
      data: {
        nombre: 'Anotador Pruebas 1',
        email: anotadorPruebas1Email.toLowerCase().trim(),
        pinHash: anotadorPruebas1PinHash,
        passwordHash: anotadorPruebas1PasswordHash,
        activo: true,
      },
    });
  } else {
    usuarioAnotadorPruebas1 = await prisma.usuario.update({
      where: { id: usuarioAnotadorPruebas1.id },
      data: {
        nombre: 'Anotador Pruebas 1',
        email: anotadorPruebas1Email.toLowerCase().trim(),
        pinHash: anotadorPruebas1PinHash,
        passwordHash: anotadorPruebas1PasswordHash,
        activo: true,
      },
    });
  }
  await prisma.membresiaLiga.upsert({
    where: {
      ligaId_usuarioId_rol: {
        ligaId: liga.id,
        usuarioId: usuarioAnotadorPruebas1.id,
        rol: 'anotador_partido',
      },
    },
    update: { activo: true },
    create: {
      ligaId: liga.id,
      usuarioId: usuarioAnotadorPruebas1.id,
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

  const usuarioAnotador2 = await prisma.usuario.upsert({
    where: { id: '00000000-0000-0000-0000-000000000007' },
    update: { pinHash: anotador2PinHash },
    create: {
      id: '00000000-0000-0000-0000-000000000007',
      nombre: 'Anotador Demo 2',
      pinHash: anotador2PinHash,
    },
  });
  await prisma.membresiaLiga.upsert({
    where: {
      ligaId_usuarioId_rol: {
        ligaId: liga.id,
        usuarioId: usuarioAnotador2.id,
        rol: 'anotador_partido',
      },
    },
    update: {},
    create: {
      ligaId: liga.id,
      usuarioId: usuarioAnotador2.id,
      rol: 'anotador_partido',
      activo: true,
    },
  });

  const usuarioConsulta2 = await prisma.usuario.upsert({
    where: { id: '00000000-0000-0000-0000-000000000008' },
    update: { pinHash: consulta2PinHash },
    create: {
      id: '00000000-0000-0000-0000-000000000008',
      nombre: 'Consulta Demo 2',
      pinHash: consulta2PinHash,
    },
  });
  await prisma.membresiaLiga.upsert({
    where: {
      ligaId_usuarioId_rol: {
        ligaId: liga.id,
        usuarioId: usuarioConsulta2.id,
        rol: 'consulta',
      },
    },
    update: {},
    create: {
      ligaId: liga.id,
      usuarioId: usuarioConsulta2.id,
      rol: 'consulta',
      activo: true,
    },
  });

  const sedeDemo = await prisma.sede.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000AA' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000000AA',
      ligaId: liga.id,
      nombre: 'Sede demo',
    },
  });

  const cancha1 = await prisma.cancha.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: { sedeId: sedeDemo.id },
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      ligaId: liga.id,
      sedeId: sedeDemo.id,
      nombre: 'Cancha 1',
    },
  });

  const equipoA = await prisma.equipo.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: { temporadaId: TEMPORADA_DEMO_ID },
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      ligaId: liga.id,
      temporadaId: TEMPORADA_DEMO_ID,
      nombre: 'Halcones',
      categoria: 'primera',
    },
  });

  const equipoB = await prisma.equipo.upsert({
    where: { id: '00000000-0000-0000-0000-000000000005' },
    update: { temporadaId: TEMPORADA_DEMO_ID },
    create: {
      id: '00000000-0000-0000-0000-000000000005',
      ligaId: liga.id,
      temporadaId: TEMPORADA_DEMO_ID,
      nombre: 'Águilas',
      categoria: 'primera',
    },
  });

  const equipoC = await prisma.equipo.upsert({
    where: { id: '00000000-0000-0000-0000-000000000009' },
    update: { temporadaId: TEMPORADA_DEMO_ID },
    create: {
      id: '00000000-0000-0000-0000-000000000009',
      ligaId: liga.id,
      temporadaId: TEMPORADA_DEMO_ID,
      nombre: 'Tigres',
      categoria: 'primera',
    },
  });

  const equipoD = await prisma.equipo.upsert({
    where: { id: '00000000-0000-0000-0000-00000000000a' },
    update: { temporadaId: TEMPORADA_DEMO_ID },
    create: {
      id: '00000000-0000-0000-0000-00000000000a',
      ligaId: liga.id,
      temporadaId: TEMPORADA_DEMO_ID,
      nombre: 'Lobos',
      categoria: 'primera',
    },
  });

  // Halcones: 6 jugadores, nombres mexicanos
  const halconesJugadores = [
    { num: 7, nombre: 'Juan', apellido: 'Hernández' },
    { num: 10, nombre: 'Carlos', apellido: 'García' },
    { num: 12, nombre: 'Miguel', apellido: 'López' },
    { num: 23, nombre: 'José', apellido: 'Martínez' },
    { num: 34, nombre: 'Luis', apellido: 'Rodríguez' },
    { num: 5, nombre: 'Roberto', apellido: 'Sánchez' },
  ];
  for (let i = 0; i < halconesJugadores.length; i++) {
    const j = halconesJugadores[i];
    await prisma.jugador.upsert({
      where: { id: `00000000-0000-0000-0000-00000000001${i}` },
      update: { nombre: j.nombre, apellido: j.apellido, numero: j.num },
      create: {
        id: `00000000-0000-0000-0000-00000000001${i}`,
        equipoId: equipoA.id,
        nombre: j.nombre,
        apellido: j.apellido,
        numero: j.num,
      },
    });
  }

  // Águilas: 7 jugadores
  const aguilasJugadores = [
    { num: 5, nombre: 'Francisco', apellido: 'González' },
    { num: 8, nombre: 'Antonio', apellido: 'Pérez' },
    { num: 11, nombre: 'Jesús', apellido: 'Ramírez' },
    { num: 15, nombre: 'Pedro', apellido: 'Flores' },
    { num: 24, nombre: 'Alejandro', apellido: 'Díaz' },
    { num: 4, nombre: 'Fernando', apellido: 'Torres' },
    { num: 9, nombre: 'Daniel', apellido: 'Vázquez' },
  ];
  for (let i = 0; i < aguilasJugadores.length; i++) {
    const j = aguilasJugadores[i];
    await prisma.jugador.upsert({
      where: { id: `00000000-0000-0000-0000-00000000002${i}` },
      update: { nombre: j.nombre, apellido: j.apellido, numero: j.num },
      create: {
        id: `00000000-0000-0000-0000-00000000002${i}`,
        equipoId: equipoB.id,
        nombre: j.nombre,
        apellido: j.apellido,
        numero: j.num,
      },
    });
  }

  // Tigres: 6 jugadores
  const tigresJugadores = [
    { num: 6, nombre: 'Ricardo', apellido: 'Mendoza' },
    { num: 14, nombre: 'Eduardo', apellido: 'Reyes' },
    { num: 20, nombre: 'Óscar', apellido: 'Morales' },
    { num: 22, nombre: 'Raúl', apellido: 'Jiménez' },
    { num: 30, nombre: 'Sergio', apellido: 'Castro' },
    { num: 33, nombre: 'Andrés', apellido: 'Ortega' },
  ];
  for (let i = 0; i < tigresJugadores.length; i++) {
    const j = tigresJugadores[i];
    await prisma.jugador.upsert({
      where: { id: `00000000-0000-0000-0000-00000000003${i}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000003${i}`,
        equipoId: equipoC.id,
        nombre: j.nombre,
        apellido: j.apellido,
        numero: j.num,
      },
    });
  }

  // Lobos: 5 jugadores
  const lobosJugadores = [
    { num: 1, nombre: 'Pablo', apellido: 'Ruiz' },
    { num: 13, nombre: 'Jorge', apellido: 'Herrera' },
    { num: 17, nombre: 'Arturo', apellido: 'Medina' },
    { num: 21, nombre: 'Guillermo', apellido: 'Aguilar' },
    { num: 25, nombre: 'Héctor', apellido: 'Núñez' },
  ];
  for (let i = 0; i < lobosJugadores.length; i++) {
    const j = lobosJugadores[i];
    await prisma.jugador.upsert({
      where: { id: `00000000-0000-0000-0000-00000000004${i}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000004${i}`,
        equipoId: equipoD.id,
        nombre: j.nombre,
        apellido: j.apellido,
        numero: j.num,
      },
    });
  }

  console.log('Seed OK.');
  console.log('- Liga:', liga.nombre, '(ID:', liga.id + ')');
  console.log('- Anotador Demo -> PIN 1234');
  console.log('- Anotador Pruebas 1 -> anotador1@texcoco.com / 1111 (PIN 1111)');
  console.log('- Anotador Demo 2 -> PIN 2222');
  console.log('- Consulta Demo -> PIN 5678');
  console.log('- Consulta Demo 2 -> PIN 8888');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
