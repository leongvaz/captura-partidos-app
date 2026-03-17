import { jsPDF } from 'jspdf';

export interface ActaDataForPdf {
  partido: { estado?: string };
  local: { nombre: string; puntos: number; jugadores: Array<{ nombre: string; apellido: string; numero: number; puntos: number; faltas: number }> };
  visitante: { nombre: string; puntos: number; jugadores: Array<{ nombre: string; apellido: string; numero: number; puntos: number; faltas: number }> };
  cancha: string;
  categoria: string;
  fecha: string;
  horaInicio: string;
  folio: string;
}

const MARGIN = 20;
const PAGE_W = 210;
const LINE_HEIGHT = 6;
const TABLE_ROW = 6;

function drawTable(
  doc: jsPDF,
  y: number,
  title: string,
  jugadores: Array<{ nombre: string; apellido: string; numero: number; puntos: number; faltas: number }>
): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, y);
  y += LINE_HEIGHT + 2;

  const colW = [15, 80, 25, 20];
  const x0 = MARGIN;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('#', x0, y);
  doc.text('Jugador', x0 + colW[0], y);
  doc.text('Pts', x0 + colW[0] + colW[1], y);
  doc.text('F', x0 + colW[0] + colW[1] + colW[2], y);
  y += LINE_HEIGHT;
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 3;

  doc.setFont('helvetica', 'normal');
  for (const j of jugadores) {
    if (y > 270) {
      doc.addPage();
      y = MARGIN + LINE_HEIGHT;
    }
    doc.text(String(j.numero), x0, y);
    doc.text(`${j.nombre} ${j.apellido}`.slice(0, 35), x0 + colW[0], y);
    doc.text(String(j.puntos), x0 + colW[0] + colW[1], y);
    doc.text(String(j.faltas), x0 + colW[0] + colW[1] + colW[2], y);
    y += TABLE_ROW;
  }
  return y + 8;
}

export function generateActaPdf(acta: ActaDataForPdf, imageDataUrl?: string): jsPDF {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  let y = MARGIN;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Acta oficial', PAGE_W / 2, y, { align: 'center' });
  y += LINE_HEIGHT + 4;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Folio: ${acta.folio}`, PAGE_W / 2, y, { align: 'center' });
  y += LINE_HEIGHT + 6;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const marcador = `${acta.local.nombre} ${acta.local.puntos} - ${acta.visitante.puntos} ${acta.visitante.nombre}`;
  doc.text(marcador, PAGE_W / 2, y, { align: 'center' });
  y += LINE_HEIGHT + 4;

  if (acta.partido?.estado === 'default_local' || acta.partido?.estado === 'default_visitante') {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const ganador = acta.partido.estado === 'default_visitante' ? acta.local.nombre : acta.visitante.nombre;
    doc.text(`Partido ganado por default. Ganador: ${ganador}`, PAGE_W / 2, y, { align: 'center' });
    y += LINE_HEIGHT + 4;
  } else if (acta.partido?.estado === 'finalizado' && acta.local.puntos !== acta.visitante.puntos) {
    doc.setFontSize(10);
    const ganador = acta.local.puntos > acta.visitante.puntos ? acta.local.nombre : acta.visitante.nombre;
    doc.text(`Ganador: ${ganador}`, PAGE_W / 2, y, { align: 'center' });
    y += LINE_HEIGHT + 4;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${acta.categoria} · ${acta.cancha} · ${acta.fecha} ${acta.horaInicio}`, MARGIN, y);
  y += LINE_HEIGHT + 8;

  y = drawTable(doc, y, acta.local.nombre, acta.local.jugadores);
  y = drawTable(doc, y, acta.visitante.nombre, acta.visitante.jugadores);

  if (imageDataUrl) {
    try {
      if (y > 180) {
        doc.addPage();
        y = MARGIN;
      }
      doc.setFontSize(9);
      doc.text('Foto del marcador', MARGIN, y);
      y += LINE_HEIGHT;
      const imgW = PAGE_W - 2 * MARGIN;
      const imgH = Math.min(50, imgW * 0.75);
      const format = imageDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(imageDataUrl, format, MARGIN, y, imgW, imgH);
      y += imgH + 8;
    } catch {
      doc.text('(Foto no disponible en PDF)', MARGIN, y);
      y += LINE_HEIGHT;
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Folio: ${acta.folio} — Captura Partidos`, MARGIN, 290);

  return doc;
}

export function getActaPdfBlob(acta: ActaDataForPdf, imageDataUrl?: string): Blob {
  const doc = generateActaPdf(acta, imageDataUrl);
  return doc.output('blob');
}
