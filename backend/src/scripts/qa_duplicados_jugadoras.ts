import { prisma } from '../lib/prisma.js';

async function login(email: string, passwordOrPin: string) {
  const baseUrl = 'http://127.0.0.1:3001/api/v1';
  const res = await fetch(`${baseUrl}/auth/login-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, passwordOrPin }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, baseUrl };
}

async function postJugador(baseUrl: string, token: string, body: any) {
  const res = await fetch(`${baseUrl}/jugadores`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  // Tomar dos capitanes recién creados
  const u1 = await prisma.usuario.findFirst({ where: { email: 'capitan01.texcoco@example.com' } });
  const u2 = await prisma.usuario.findFirst({ where: { email: 'capitan02.texcoco@example.com' } });
  if (!u1 || !u2) throw new Error('No encontré capitan01/capitan02');

  const eq1 = await prisma.equipo.findFirst({ where: { duenoId: u1.id, nombre: 'Panteras Texcoco' } });
  const eq2 = await prisma.equipo.findFirst({ where: { duenoId: u2.id, nombre: 'Halconas Texcoco' } });
  if (!eq1 || !eq2) throw new Error('No encontré equipos Panteras/Halconas');

  // Tomar una jugadora existente de eq1
  const jug = await prisma.jugador.findFirst({
    where: { equipoId: eq1.id, activo: true, curp: { not: null } },
    select: { curp: true },
  });
  if (!jug?.curp) throw new Error('No encontré jugadora con CURP en eq1');

  // Login como capitan02 e intentar registrar esa misma CURP en eq2
  const l = await login('capitan02.texcoco@example.com', 'DemoTexcoco!02');
  if (l.status !== 200) throw new Error(`No pude login capitan02 (${l.status})`);
  const token = (l.json as any).token as string;

  const intentoDuplicado = await postJugador(l.baseUrl, token, {
    equipoId: eq2.id,
    nombre: 'Prueba',
    apellidoPaterno: 'Duplicada',
    apellidoMaterno: 'Curp',
    numero: 99,
    curp: jug.curp,
  });

  // Intento 2: usar la CURP de otra capitana como jugadora (si esa CURP no está ya como jugadora en liga, debería permitir)
  const curpCapitana = u1.curp;
  const intentoCurpCapitana = await postJugador(l.baseUrl, token, {
    equipoId: eq2.id,
    nombre: 'Ana Sofia',
    apellidoPaterno: 'Ruiz',
    apellidoMaterno: 'Hernandez',
    numero: 98,
    curp: curpCapitana,
  });

  console.log('Caso 1 (jugadora ya inscrita en otro equipo):', intentoDuplicado);
  console.log('Caso 2 (CURP de capitana como jugadora):', intentoCurpCapitana);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
