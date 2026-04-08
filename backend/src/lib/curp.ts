export function validarCurpBasica(curp: string): { ok: boolean; mensaje?: string } {
  const normalizada = curp.toUpperCase().trim();

  const regex =
    /^([A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|B[CS]|C[CLMSH]|D[FG]|G[TR]|HG|JC|M[CNS]|N[ETL]|OC|PL|Q[TR]|S[PLR]|T[CSL]|VZ|YN|ZS)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d])(\d)$/;

  const match = normalizada.match(regex);
  if (!match) {
    return { ok: false, mensaje: 'La CURP no tiene un formato válido.' };
  }

  const cuerpo = match[1]; // primeros 17 caracteres
  const digitoStr = match[2]; // dígito verificador

  const diccionario = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    const c = cuerpo.charAt(i);
    const valor = diccionario.indexOf(c);
    if (valor === -1) {
      return { ok: false, mensaje: 'La CURP contiene caracteres inválidos.' };
    }
    suma += valor * (18 - i);
  }

  let digitoEsperado = 10 - (suma % 10);
  if (digitoEsperado === 10) digitoEsperado = 0;

  if (String(digitoEsperado) !== digitoStr) {
    return { ok: false, mensaje: 'La CURP no es válida (dígito verificador incorrecto).' };
  }

  return { ok: true };
}

export function datosDesdeCurp(curp: string): { sexo: 'H' | 'M'; fechaNacimiento: string; edad: number } {
  const normalizada = curp.toUpperCase().trim();
  const yy = normalizada.slice(4, 6);
  const mm = normalizada.slice(6, 8);
  const dd = normalizada.slice(8, 10);
  const sexo = normalizada[10] as 'H' | 'M';

  const año = Number(yy) >= 30 ? 1900 + Number(yy) : 2000 + Number(yy);
  const fechaNacimiento = `${año.toString().padStart(4, '0')}-${mm}-${dd}`;

  const hoy = new Date();
  let edad = hoy.getFullYear() - año;
  const mesActual = hoy.getMonth() + 1;
  const diaActual = hoy.getDate();
  if (mesActual < Number(mm) || (mesActual === Number(mm) && diaActual < Number(dd))) {
    edad -= 1;
  }

  return { sexo, fechaNacimiento, edad };
}
