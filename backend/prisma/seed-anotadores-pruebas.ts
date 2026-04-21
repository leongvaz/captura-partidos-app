import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const LIGA_ID = 'd95faced-61aa-4d27-b391-94906ac04144';

type AnotadorSeed = { nombre: string; pin: string; email: string; password: string };

const ANOTADORES: AnotadorSeed[] = [
  {
    nombre: 'Anotador Pruebas 1',
    email: 'anotador1@texcoco.com',
    password: '1111',
    pin: '1111',
  },
  {
    nombre: 'Anotador Pruebas 2',
    email: 'anotador2@texcoco.com',
    password: '2222',
    pin: '2222',
  },
  {
    nombre: 'Anotador Pruebas 3',
    email: 'anotador3@texcoco.com',
    password: '3333',
    pin: '3333',
  },
  {
    nombre: 'Anotador Pruebas 4',
    email: 'anotador4@texcoco.com',
    password: '4444',
    pin: '4444',
  },
  {
    nombre: 'Anotador Pruebas 5',
    email: 'anotador5@texcoco.com',
    password: '5555',
    pin: '5555',
  },
];

async function main() {
  const liga = await prisma.liga.findUnique({ where: { id: LIGA_ID } });
  if (!liga) {
    throw new Error(
      `No existe la liga ${LIGA_ID}. Crea la liga primero (seed/DB) y vuelve a correr este script.`
    );
  }

  const creados: { id: string; nombre: string; email: string; password: string; pin: string }[] = [];

  for (const a of ANOTADORES) {
    const pinHash = await bcrypt.hash(a.pin, 10);
    const passwordHash = await bcrypt.hash(a.password, 10);
    const email = a.email.toLowerCase().trim();

    // En este schema `Usuario.email` NO es unique, así que no podemos usar upsert por email.
    // Estrategia:
    // 1) Si existe usuario con ese email, lo reutilizamos.
    // 2) Si no, buscamos por (liga + rol anotador_partido + nombre).
    // 3) Si no existe, creamos uno nuevo.
    let usuario =
      (await prisma.usuario.findFirst({ where: { email } })) ??
      (
        await prisma.membresiaLiga.findFirst({
          where: {
            ligaId: LIGA_ID,
            rol: 'anotador_partido',
            activo: true,
            usuario: { nombre: a.nombre },
          },
          include: { usuario: true },
        })
      )?.usuario ??
      (await prisma.usuario.create({
        data: {
          nombre: a.nombre,
          email,
          pinHash,
          passwordHash,
          activo: true,
        },
      }));

    usuario = await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        nombre: a.nombre,
        email,
        pinHash,
        passwordHash,
        activo: true,
      },
    });

    await prisma.membresiaLiga.upsert({
      where: {
        ligaId_usuarioId_rol: {
          ligaId: LIGA_ID,
          usuarioId: usuario.id,
          rol: 'anotador_partido',
        },
      },
      update: { activo: true },
      create: {
        ligaId: LIGA_ID,
        usuarioId: usuario.id,
        rol: 'anotador_partido',
        activo: true,
      },
    });

    creados.push({
      id: usuario.id,
      nombre: a.nombre,
      email,
      password: a.password,
      pin: a.pin,
    });
  }

  console.log('Anotadores de pruebas listos para liga:', LIGA_ID);
  for (const u of creados) {
    console.log(`- ${u.nombre} (id ${u.id}) -> ${u.email} / ${u.password} (PIN ${u.pin})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

