import { prisma } from './prisma.js';

export type PersonaDatos = {
  curp: string;
  nombre?: string;
  apellido?: string;
  sexo?: string | null;
  fechaNacimiento?: string | null;
};

/** CURP normalizada (mayúsculas, trim). Crea o actualiza datos de display. */
export async function ensurePersonaPorCurp(datos: PersonaDatos): Promise<string> {
  const curp = datos.curp.trim().toUpperCase();
  const nombreDisplay = datos.nombre?.trim() || null;
  const apellidoDisplay = datos.apellido?.trim() || null;

  const existente = await prisma.persona.findUnique({ where: { curp } });
  if (existente) {
    await prisma.persona.update({
      where: { id: existente.id },
      data: {
        nombreDisplay: nombreDisplay ?? existente.nombreDisplay,
        apellidoDisplay: apellidoDisplay ?? existente.apellidoDisplay,
        sexo: datos.sexo ?? existente.sexo,
        fechaNacimiento: datos.fechaNacimiento ?? existente.fechaNacimiento,
      },
    });
    return existente.id;
  }

  const creada = await prisma.persona.create({
    data: {
      curp,
      nombreDisplay,
      apellidoDisplay,
      sexo: datos.sexo ?? null,
      fechaNacimiento: datos.fechaNacimiento ?? null,
    },
  });
  return creada.id;
}
