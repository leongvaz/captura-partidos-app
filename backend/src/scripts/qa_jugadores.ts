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
  estado: string; // ej. DF
  homoclave?: string; // 2 chars (A-Z0-9) + digit verificador se calcula
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

  // cuerpo debe ser 17 chars; homoclave (pos 17) la ponemos simple '0'
  if (cuerpo.length !== 17) {
    throw new Error(`CURP cuerpo inválido (len=${cuerpo.length}): ${cuerpo}`);
  }
  const dv = digitoVerificador(cuerpo);
  return cuerpo + dv;
}

async function main() {
  const equipo = await prisma.equipo.findFirst({
    where: { nombre: { equals: 'Albianas' } },
  });
  if (!equipo) {
    console.log('No encontré el equipo "Albianas" en la tabla Equipo.');
    process.exit(1);
  }

  const existentes = await prisma.jugador.findMany({
    where: { equipoId: equipo.id, activo: true },
    select: { numero: true },
  });
  const usados = new Set(existentes.map((j) => j.numero));

  const tomarNumeroLibre = (): number => {
    for (let n = 0; n <= 999; n++) {
      if (!usados.has(n)) {
        usados.add(n);
        return n;
      }
    }
    throw new Error('No hay números libres (0-999) para este equipo.');
  };

  const jugadoras = [
    { nombre: 'Paola', ap: 'Hernández', am: 'Sánchez', fn: '2002-05-14' },
    { nombre: 'Valeria', ap: 'Gómez', am: 'Ruiz', fn: '2001-11-23' },
    { nombre: 'Diana', ap: 'Martínez', am: 'Castro', fn: '1999-02-08' },
    { nombre: 'Fernanda', ap: 'López', am: 'Aguilar', fn: '2004-07-30' },
    { nombre: 'Karen', ap: 'Ramírez', am: 'Nava', fn: '2000-09-12' },
    { nombre: 'Andrea', ap: 'Vargas', am: 'Mendoza', fn: '2003-03-19' },
    { nombre: 'Ximena', ap: 'Morales', am: 'Cortés', fn: '1998-12-05' },
  ];

  const creadas: { nombre: string; curp: string; numero: number; id: string }[] = [];

  for (const j of jugadoras) {
    const numero = tomarNumeroLibre();
    const curp = generarCurpValida({
      nombre: j.nombre,
      apellidoPaterno: j.ap,
      apellidoMaterno: j.am,
      fechaNacimiento: j.fn,
      sexo: 'M',
      estado: 'DF',
    });
    const ok = validarCurpBasica(curp);
    if (!ok.ok) {
      throw new Error(`CURP generada no válida: ${curp} (${ok.mensaje ?? 'sin mensaje'})`);
    }

    const apellido = `${j.ap} ${j.am}`.trim();
    const creado = await prisma.jugador.create({
      data: {
        equipoId: equipo.id,
        nombre: j.nombre,
        apellido,
        numero,
        curp,
        sexo: 'M',
        fechaNacimiento: j.fn,
        invitado: false,
        activo: true,
      },
      select: { id: true },
    });
    creadas.push({ id: creado.id, nombre: `${j.nombre} ${apellido}`, curp, numero });
  }

  console.log('Equipo encontrado:', { id: equipo.id, nombre: equipo.nombre, categoria: equipo.categoria });
  console.log('Jugadoras creadas (7):');
  for (const c of creadas) {
    console.log(`- #${c.numero} ${c.nombre} — ${c.curp}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

