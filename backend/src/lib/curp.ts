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
