import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { validarCurpBasica } from '../lib/curp.js';

type Sexo = 'H' | 'M';

function quitarAcentosUpper(valor: string): string {
  return (valor || '')
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function soloLetrasN(valor: string): string {
  return quitarAcentosUpper(valor).replace(/[^A-ZÑ]/g, '');
}

function inicial(valor: string): string {
  const s = soloLetrasN(valor);
  if (!s) return 'X';
  const c = s[0]!;
  return c === 'Ñ' ? 'X' : c;
}

function primeraVocalInterna(apellidoPaterno: string): string {
  const s = soloLetrasN(apellidoPaterno);
  const vocales = new Set(['A', 'E', 'I', 'O', 'U']);
  for (let i = 1; i < s.length; i++) {
    if (vocales.has(s[i]!)) return s[i]!;
  }
  return 'X';
}

function primeraConsonanteInterna(valor: string): string {
  const s = soloLetrasN(valor);
  const vocales = new Set(['A', 'E', 'I', 'O', 'U']);
  for (let i = 1; i < s.length; i++) {
    const c = s[i]!;
    if (!vocales.has(c) && c !== 'Ñ') return c;
  }
  return 'X';
}

function inicialNombreCurp(nombre: string): string {
  const tokens = quitarAcentosUpper(nombre)
    .replace(/[^A-ZÑ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (tokens.length === 0) return 'X';
  const first = tokens[0]!;
  const second = tokens[1];
  const elegido = (first === 'JOSE' || first === 'MARIA') && second ? second : first;
  const c = elegido[0]!;
  return c === 'Ñ' ? 'X' : c;
}

function digitoVerificador(curp17: string): string {
  const diccionario = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    suma += diccionario.indexOf(curp17.charAt(i)) * (18 - i);
  }
  let digito = 10 - (suma % 10);
  if (digito === 10) digito = 0;
  return String(digito);
}

function generarCurpValida(input: {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string; // YYYY-MM-DD
  sexo: Sexo;
  estado: string; // DF
  homoclave?: string; // 1 char
}): string {
  const [yyyy, mm, dd] = input.fechaNacimiento.split('-');
  const yy = yyyy!.slice(2, 4);
  const cuerpo =
    inicial(input.apellidoPaterno) +
    primeraVocalInterna(input.apellidoPaterno) +
    inicial(input.apellidoMaterno) +
    inicialNombreCurp(input.nombre) +
    yy +
    mm +
    dd +
    input.sexo +
    input.estado +
    primeraConsonanteInterna(input.apellidoPaterno) +
    primeraConsonanteInterna(input.apellidoMaterno) +
    primeraConsonanteInterna(input.nombre) +
    (input.homoclave?.toUpperCase().padEnd(1, '0').slice(0, 1) ?? '0');
  if (cuerpo.length !== 17) throw new Error('Cuerpo CURP inválido');
  return cuerpo + digitoVerificador(cuerpo);
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
  const equipoAlbianas = await prisma.equipo.findFirst({ where: { nombre: { equals: 'Albianas' } } });
  if (!equipoAlbianas) throw new Error('No existe equipo Albianas');

  const ligaId = equipoAlbianas.ligaId;

  // Usuario QA capitán
  const email = 'qa.capitan@example.com';
  const password = 'Qa123456';
  const curpCapitan = generarCurpValida({
    nombre: 'Carla',
    apellidoPaterno: 'Prueba',
    apellidoMaterno: 'Capitan',
    fechaNacimiento: '1999-01-10',
    sexo: 'M',
    estado: 'DF',
  });

  let usuario = await prisma.usuario.findFirst({ where: { email } });
  if (!usuario) {
    const passwordHash = await bcrypt.hash(password, 10);
    usuario = await prisma.usuario.create({
      data: { email, passwordHash, nombre: 'QA Capitán', curp: curpCapitan },
    });
  }

  // Membresía y equipo QA (femenil)
  const miembro = await prisma.membresiaLiga.findFirst({
    where: { ligaId, usuarioId: usuario.id, rol: 'capturista_roster', activo: true },
  });
  if (!miembro) {
    await prisma.membresiaLiga.create({
      data: { ligaId, usuarioId: usuario.id, rol: 'capturista_roster', activo: true },
    });
  }

  let equipoQA = await prisma.equipo.findFirst({
    where: { ligaId, duenoId: usuario.id, nombre: 'QA Femenil', activo: true },
  });
  if (!equipoQA) {
    equipoQA = await prisma.equipo.create({
      data: { ligaId, duenoId: usuario.id, nombre: 'QA Femenil', categoria: 'femenil:primera', activo: true },
    });
  }

  const baseUrl = 'http://127.0.0.1:3001/api/v1';
  // Login para token
  const loginRes = await fetch(`${baseUrl}/auth/login-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, passwordOrPin: password }),
  });
  if (!loginRes.ok) {
    const err = await loginRes.text();
    throw new Error(`No se pudo hacer login QA (${loginRes.status}): ${err}`);
  }
  const loginJson = (await loginRes.json()) as { token: string };
  const token = loginJson.token;

  // Caso A: hombre en femenil
  const curpHombre = generarCurpValida({
    nombre: 'Leonardo Jose',
    apellidoPaterno: 'Gonzalez',
    apellidoMaterno: 'Vazquez',
    fechaNacimiento: '1997-11-15',
    sexo: 'H',
    estado: 'DF',
  });
  console.log('Caso A (hombre en femenil):', await postJugador(baseUrl, token, {
    equipoId: equipoQA.id,
    nombre: 'Leonardo Jose',
    apellidoPaterno: 'Gonzalez',
    apellidoMaterno: 'Vazquez',
    numero: 10,
    curp: curpHombre,
  }));

  // Caso B: menor de 13 (12 años) en femenil
  const curpMenor = generarCurpValida({
    nombre: 'Paula',
    apellidoPaterno: 'Hernandez',
    apellidoMaterno: 'Ruiz',
    fechaNacimiento: '2014-03-01',
    sexo: 'M',
    estado: 'DF',
  });
  console.log('Caso B (12 años):', await postJugador(baseUrl, token, {
    equipoId: equipoQA.id,
    nombre: 'Paula',
    apellidoPaterno: 'Hernandez',
    apellidoMaterno: 'Ruiz',
    numero: 11,
    curp: curpMenor,
  }));

  // Caso C: dígito verificador incorrecto
  const curpInvalida = curpMenor.slice(0, 17) + (curpMenor.slice(17) === '0' ? '1' : '0');
  console.log('Caso C (DV incorrecto):', await postJugador(baseUrl, token, {
    equipoId: equipoQA.id,
    nombre: 'Paula',
    apellidoPaterno: 'Hernandez',
    apellidoMaterno: 'Ruiz',
    numero: 12,
    curp: curpInvalida,
  }));

  // Caso D: CURP válida pero nombre/apellidos no coinciden
  const curpValidaOtraPersona = generarCurpValida({
    nombre: 'Maria Abigail',
    apellidoPaterno: 'Mota',
    apellidoMaterno: 'Guillen',
    fechaNacimiento: '1997-08-06',
    sexo: 'M',
    estado: 'DF',
  });
  const ok = validarCurpBasica(curpValidaOtraPersona);
  if (!ok.ok) throw new Error('CURP de control inválida');
  console.log('Caso D (no coincide nombre):', await postJugador(baseUrl, token, {
    equipoId: equipoQA.id,
    nombre: 'Paula',
    apellidoPaterno: 'Hernandez',
    apellidoMaterno: 'Ruiz',
    numero: 13,
    curp: curpValidaOtraPersona,
  }));

  // Caso E: exactamente 13 años (nacida hoy hace 13 años)
  const hoy = new Date();
  const yyyy = String(hoy.getFullYear() - 13).padStart(4, '0');
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  const fecha13 = `${yyyy}-${mm}-${dd}`;
  const curp13 = generarCurpValida({
    nombre: 'Lucia',
    apellidoPaterno: 'Garcia',
    apellidoMaterno: 'Perez',
    fechaNacimiento: fecha13,
    sexo: 'M',
    estado: 'DF',
  });
  console.log('Caso E (exactamente 13 años):', await postJugador(baseUrl, token, {
    equipoId: equipoQA.id,
    nombre: 'Lucia',
    apellidoPaterno: 'Garcia',
    apellidoMaterno: 'Perez',
    numero: 14,
    curp: curp13,
  }));

  console.log('Equipo QA usado:', { id: equipoQA.id, ligaId, email });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

