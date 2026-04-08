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
  if (cuerpo.length !== 17) throw new Error(`Cuerpo CURP inválido (${cuerpo.length}): ${cuerpo}`);
  return cuerpo + digitoVerificador(cuerpo);
}

function passwordPara(i: number): string {
  return `DemoTexcoco!${String(i).padStart(2, '0')}`;
}

async function main() {
  const albianas = await prisma.equipo.findFirst({ where: { nombre: { equals: 'Albianas' } } });
  if (!albianas) throw new Error('No encontré el equipo "Albianas"');

  const ligaId = albianas.ligaId;

  const curpsUsuario = new Set(
    (await prisma.usuario.findMany({ select: { curp: true } }))
      .map((u) => u.curp)
      .filter((c): c is string => !!c)
  );
  const curpsJugadorasLiga = new Set(
    (await prisma.jugador.findMany({
      where: { activo: true, equipo: { ligaId } },
      select: { curp: true },
    }))
      .map((j) => j.curp)
      .filter((c): c is string => !!c)
  );

  const capitanes = [
    { nombres: 'Ana Sofia', ap: 'Ruiz', am: 'Hernandez', fn: '1996-04-11' },
    { nombres: 'Brenda', ap: 'Castillo', am: 'Lopez', fn: '1998-09-22' },
    { nombres: 'Claudia', ap: 'Mendez', am: 'Vargas', fn: '1997-02-05' },
    { nombres: 'Daniela', ap: 'Santos', am: 'Cruz', fn: '1999-12-01' },
    { nombres: 'Erika', ap: 'Gonzalez', am: 'Nava', fn: '1995-07-19' },
    { nombres: 'Fatima', ap: 'Jimenez', am: 'Ortega', fn: '1997-08-28' },
    { nombres: 'Gabriela', ap: 'Morales', am: 'Reyes', fn: '1996-03-30' },
    { nombres: 'Helena', ap: 'Aguilar', am: 'Pineda', fn: '1998-01-14' },
    { nombres: 'Ivonne', ap: 'Salazar', am: 'Medina', fn: '1999-05-09' },
    { nombres: 'Jessica', ap: 'Romero', am: 'Campos', fn: '1996-11-03' },
  ];

  const nombresEquipos = [
    'Panteras',
    'Halconas',
    'Guerreras',
    'Lobas',
    'Titanas',
    'Aguilas',
    'Leonas',
    'Fenix',
    'Tormenta',
    'Estrellas',
  ];

  const jugadorasPool = [
    ['Mariana', 'Sanchez', 'Gomez', '2002-01-12'],
    ['Alejandra', 'Lopez', 'Ruiz', '2003-04-21'],
    ['Karla', 'Hernandez', 'Cortes', '2001-06-07'],
    ['Lucia', 'Martinez', 'Perez', '2004-02-18'],
    ['Natalia', 'Vargas', 'Mendoza', '2000-09-10'],
    ['Paulina', 'Castro', 'Nava', '2002-11-29'],
    ['Renata', 'Morales', 'Aguilar', '2001-03-05'],
    ['Samantha', 'Reyes', 'Ortega', '2003-07-16'],
    ['Ximena', 'Jimenez', 'Santos', '2000-12-08'],
    ['Valeria', 'Campos', 'Medina', '2004-05-27'],
    ['Diana', 'Gomez', 'Lopez', '2003-10-14'],
    ['Fernanda', 'Ruiz', 'Hernandez', '2001-08-31'],
    ['Andrea', 'Perez', 'Castillo', '2002-02-02'],
    ['Karen', 'Mendoza', 'Cruz', '2004-01-20'],
    ['Paola', 'Nava', 'Morales', '2000-06-25'],
    ['Monserrat', 'Aguilar', 'Reyes', '2003-03-13'],
    ['Ariadna', 'Ortega', 'Campos', '2001-09-09'],
    ['Citlali', 'Medina', 'Jimenez', '2002-12-30'],
    ['Itzel', 'Santos', 'Vargas', '2004-07-03'],
    ['Yazmin', 'Castillo', 'Perez', '2000-05-18'],
  ] as const;

  const creados: { email: string; password: string; equipo: string; equipoId: string }[] = [];
  let poolIdx = 0;

  for (let i = 0; i < capitanes.length; i++) {
    const c = capitanes[i]!;
    const email = `capitan${String(i + 1).padStart(2, '0')}.texcoco@example.com`;
    const password = passwordPara(i + 1);
    const passwordHash = await bcrypt.hash(password, 10);

    // CURP capitán (M) única
    let curpCap = '';
    for (let attempt = 0; attempt < 50; attempt++) {
      curpCap = generarCurpValida({
        nombre: c.nombres,
        apellidoPaterno: c.ap,
        apellidoMaterno: c.am,
        fechaNacimiento: c.fn,
        sexo: 'M',
        estado: 'DF',
        homoclave: String(attempt % 10),
      });
      if (!curpsUsuario.has(curpCap) && !curpsJugadorasLiga.has(curpCap)) break;
    }
    if (!curpCap) throw new Error('No pude generar CURP para capitán');
    const okCap = validarCurpBasica(curpCap);
    if (!okCap.ok) throw new Error(`CURP capitan inválida: ${curpCap}`);

    let usuario = await prisma.usuario.findFirst({ where: { email } });
    if (!usuario) {
      usuario = await prisma.usuario.create({
        data: {
          email,
          passwordHash,
          nombre: `${c.nombres} ${c.ap} ${c.am}`.trim(),
          curp: curpCap,
        },
      });
      curpsUsuario.add(curpCap);
    }

    const yaMemb = await prisma.membresiaLiga.findFirst({
      where: { ligaId, usuarioId: usuario.id, rol: 'capturista_roster', activo: true },
    });
    if (!yaMemb) {
      await prisma.membresiaLiga.create({
        data: { ligaId, usuarioId: usuario.id, rol: 'capturista_roster', activo: true },
      });
    }

    const equipoNombre = `${nombresEquipos[i]!} Texcoco`;
    let equipo = await prisma.equipo.findFirst({
      where: { ligaId, duenoId: usuario.id, nombre: equipoNombre },
    });
    if (!equipo) {
      equipo = await prisma.equipo.create({
        data: {
          ligaId,
          duenoId: usuario.id,
          nombre: equipoNombre,
          categoria: 'femenil:primera',
          activo: true,
        },
      });
    }

    // 7 jugadoras (números 0-6) con CURP única por liga
    for (let n = 0; n < 7; n++) {
      const p = jugadorasPool[poolIdx % jugadorasPool.length]!;
      poolIdx++;
      const [nombre, ap, am, fn] = p;

      let curpJ = '';
      for (let attempt = 0; attempt < 50; attempt++) {
        curpJ = generarCurpValida({
          nombre,
          apellidoPaterno: ap,
          apellidoMaterno: am,
          fechaNacimiento: fn,
          sexo: 'M',
          estado: 'DF',
          homoclave: String((poolIdx + attempt) % 10),
        });
        if (!curpsJugadorasLiga.has(curpJ) && !curpsUsuario.has(curpJ)) break;
      }
      const okJ = validarCurpBasica(curpJ);
      if (!okJ.ok) throw new Error(`CURP jugadora inválida: ${curpJ}`);

      const numero = n;
      const existente = await prisma.jugador.findFirst({
        where: { equipoId: equipo.id, numero },
      });
      if (existente?.activo) continue;

      const apellido = `${ap} ${am}`.trim();
      if (existente && !existente.activo) {
        await prisma.jugador.update({
          where: { id: existente.id },
          data: {
            activo: true,
            invitado: false,
            nombre,
            apellido,
            curp: curpJ,
            sexo: 'M',
            fechaNacimiento: fn,
          },
        });
      } else {
        await prisma.jugador.create({
          data: {
            equipoId: equipo.id,
            nombre,
            apellido,
            numero,
            curp: curpJ,
            sexo: 'M',
            fechaNacimiento: fn,
            invitado: false,
            activo: true,
          },
        });
      }

      curpsJugadorasLiga.add(curpJ);
    }

    creados.push({ email, password, equipo: equipoNombre, equipoId: equipo.id });
  }

  console.log('Liga:', ligaId);
  console.log('Se crearon/aseguraron 10 capitanes + 10 equipos femenil:primera con 7 jugadoras c/u.');
  console.log('Credenciales (inventadas):');
  for (const c of creados) {
    console.log(`- ${c.email} | ${c.password} | Equipo: ${c.equipo}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

