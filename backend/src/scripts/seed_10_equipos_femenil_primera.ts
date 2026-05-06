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

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]!;
}

async function main() {
  const albianas = await prisma.equipo.findFirst({ where: { nombre: { equals: 'Albianas' } } });
  if (!albianas) throw new Error('No encontré equipo Albianas');
  const ligaId = albianas.ligaId;
  const temporadaId = albianas.temporadaId;
  if (!temporadaId) throw new Error('Equipo Albianas sin temporada asignada');

  const nombresEquipos = [
    'Halconas', 'Panteras', 'Guerreras', 'Tigresas', 'Águilas', 'Lobos', 'Dragones',
    'Raptors', 'Celtas', 'Titanes',
  ];

  const nombres = ['Ana', 'Sofía', 'Mariana', 'Camila', 'Daniela', 'Regina', 'Natalia', 'Lucía', 'Paola', 'Valeria', 'Ximena', 'Renata', 'Diana', 'Andrea', 'Fernanda', 'Karla', 'Karen', 'Alondra', 'Brenda', 'Itzel'];
  const apellidos = ['Hernández', 'Gómez', 'Martínez', 'López', 'Ramírez', 'Vargas', 'Morales', 'Cortés', 'Aguilar', 'Castro', 'Mendoza', 'Nava', 'Reyes', 'Ortiz', 'Soto', 'Rojas', 'Pérez', 'Ruiz', 'Sánchez', 'Flores'];

  const creados: { email: string; password: string; equipo: string }[] = [];

  for (let i = 0; i < 10; i++) {
    const equipoNombre = `${nombresEquipos[i]} Texcoco`;
    const capNombre = pick(nombres);
    const capAP = pick(apellidos);
    let capAM = pick(apellidos);
    if (capAM === capAP) capAM = pick(apellidos);
    const capEmail = `capitan.${i + 1}@texcoco.example.com`;
    const capPassword = 'Tontito123';
    const fnCap = `${randInt(1987, 2002)}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`;

    const curpCap = generarCurpValida({
      nombre: capNombre,
      apellidoPaterno: capAP,
      apellidoMaterno: capAM,
      fechaNacimiento: fnCap,
      sexo: 'M',
      estado: 'DF',
    });
    const okCurp = validarCurpBasica(curpCap);
    if (!okCurp.ok) throw new Error(`CURP capitan inválida: ${curpCap}`);

    const existing = await prisma.usuario.findFirst({ where: { email: capEmail } });
    const usuario = existing
      ? existing
      : await prisma.usuario.create({
          data: {
            email: capEmail.toLowerCase(),
            nombre: `${capNombre} ${capAP} ${capAM}`,
            passwordHash: await bcrypt.hash(capPassword, 10),
            curp: curpCap,
            activo: true,
          },
        });

    const mem = await prisma.membresiaLiga.findFirst({
      where: { ligaId, usuarioId: usuario.id, rol: 'capturista_roster', activo: true },
    });
    if (!mem) {
      await prisma.membresiaLiga.create({
        data: { ligaId, usuarioId: usuario.id, rol: 'capturista_roster', activo: true },
      });
    }

    const equipo = await prisma.equipo.create({
      data: {
        ligaId,
        temporadaId,
        duenoId: usuario.id,
        nombre: equipoNombre,
        categoria: 'femenil:primera',
        activo: true,
      },
    });

    // 7 jugadoras por equipo (mínimo solicitado)
    const numerosUsados = new Set<number>();
    for (let j = 0; j < 7; j++) {
      let nombreJ = pick(nombres);
      let apJ = pick(apellidos);
      let amJ = pick(apellidos);
      if (amJ === apJ) amJ = pick(apellidos);

      const fn = `${randInt(1990, 2009)}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`;
      // Asegurar +13 (2026)
      const año = Number(fn.slice(0, 4));
      if (año > 2013) {
        // fuerza un año válido
        const nuevoAño = randInt(1990, 2013);
        const mm = fn.slice(5, 7);
        const dd = fn.slice(8, 10);
        // eslint-disable-next-line no-param-reassign
        // @ts-ignore
        // just rebuild
        // fn = `${nuevoAño}-${mm}-${dd}`;
      }

      const fechaNacimiento = `${Math.min(año, 2013)}-${fn.slice(5, 7)}-${fn.slice(8, 10)}`;

      const curp = generarCurpValida({
        nombre: nombreJ,
        apellidoPaterno: apJ,
        apellidoMaterno: amJ,
        fechaNacimiento,
        sexo: 'M',
        estado: 'DF',
      });
      const ok = validarCurpBasica(curp);
      if (!ok.ok) throw new Error(`CURP jugadora inválida: ${curp}`);

      let numero = randInt(0, 99);
      while (numerosUsados.has(numero)) numero = randInt(0, 99);
      numerosUsados.add(numero);

      await prisma.jugador.create({
        data: {
          equipoId: equipo.id,
          nombre: nombreJ,
          apellido: `${apJ} ${amJ}`.trim(),
          numero,
          curp,
          sexo: 'M',
          fechaNacimiento,
          invitado: false,
          activo: true,
        },
      });
    }

    creados.push({ email: capEmail, password: capPassword, equipo: equipoNombre });
  }

  console.log('Creados 10 equipos femenil primera para liga:', ligaId);
  console.log('Credenciales (capitanes):');
  for (const c of creados) console.log(`- ${c.equipo}: ${c.email} / ${c.password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

