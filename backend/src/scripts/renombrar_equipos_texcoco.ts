import { prisma } from '../lib/prisma.js';

function normalizarNombreEquipo(nombre: string): string {
  return (nombre || '')
    .replace(/\s*texcoco\s*/gi, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const ligaId = process.argv[2] || 'dcee494c-3b8c-4a7a-bcf1-f9ae819191db';

  const equipos = await prisma.equipo.findMany({
    where: { ligaId, activo: true },
    orderBy: [{ createdAt: 'asc' }],
  });

  if (!equipos.length) {
    console.log('No hay equipos activos en liga', ligaId);
    return;
  }

  const reservados = new Set(['Albianas', 'QA Femenil']);
  const poolNombres = [
    'Panteras',
    'Halconas',
    'Guerreras',
    'Lobas',
    'Titanas',
    'Águilas',
    'Leonas',
    'Fénix',
    'Tormenta',
    'Estrellas',
    'Celtas',
    'Dragones',
    'Raptors',
    'Tigresas',
    'Titanes',
    'Lobos',
    'Aurora',
    'Horizonte',
    'Nébula',
    'Quásar',
    'Cobalto',
    'Orquídea',
    'Bruma',
    'Mirage',
    'Atenea',
    'Oasis',
    'Vértice',
    'Boreal',
    'Cometas',
    'Mistral',
  ];

  const usados = new Set<string>();
  for (const e of equipos) {
    usados.add(normalizarNombreEquipo(e.nombre));
  }

  const cambios: { id: string; de: string; a: string }[] = [];
  const conteo: Record<string, number> = {};

  for (const e of equipos) {
    const base = normalizarNombreEquipo(e.nombre);
    if (!conteo[base]) conteo[base] = 0;
    conteo[base] += 1;
  }

  const usadosFinal = new Set<string>();

  for (const e of equipos) {
    if (reservados.has(e.nombre)) {
      usadosFinal.add(e.nombre);
      continue;
    }

    const base = normalizarNombreEquipo(e.nombre);
    const esDuplicado = (conteo[base] || 0) > 1;

    let nuevo = base;
    if (!nuevo) nuevo = e.nombre;

    // Si quedaría duplicado o ya ocupado, asignar uno del pool
    if (esDuplicado || usadosFinal.has(nuevo) || reservados.has(nuevo)) {
      const candidato = poolNombres.find((n) => !usadosFinal.has(n) && !reservados.has(n));
      if (!candidato) {
        // fallback: sufijo incremental
        let k = 2;
        while (usadosFinal.has(`${nuevo} ${k}`)) k++;
        nuevo = `${nuevo} ${k}`;
      } else {
        nuevo = candidato;
      }
    }

    usadosFinal.add(nuevo);
    if (nuevo !== e.nombre) {
      cambios.push({ id: e.id, de: e.nombre, a: nuevo });
    }
  }

  // Aplicar cambios
  for (const c of cambios) {
    await prisma.equipo.update({ where: { id: c.id }, data: { nombre: c.a } });
  }

  console.log('Liga:', ligaId);
  console.log('Equipos activos:', equipos.length);
  console.log('Renombrados:', cambios.length);
  for (const c of cambios) {
    console.log(`- ${c.de} -> ${c.a}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

