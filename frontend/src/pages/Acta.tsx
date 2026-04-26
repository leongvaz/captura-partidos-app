import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSyncStore } from '@/store/syncStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function fetchPdfBlob(partidoId: string): Promise<Blob> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/partidos/${partidoId}/acta/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(res.statusText || 'Error al obtener el PDF');
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/pdf')) {
    // Si el backend devolvió JSON/HTML (p.ej. error) pero con 200, evitamos descargar "PDF" corrupto.
    const text = await res.text().catch(() => '');
    throw new Error(`Respuesta no es PDF (${contentType || 'sin content-type'}): ${text.slice(0, 200)}`);
  }
  return res.blob();
}

interface ActaData {
  partido: { folio?: string; categoria: string; fecha: string; horaInicio: string; estado?: string };
  local: { nombre: string; puntos: number; jugadores: Array<{ nombre: string; apellido: string; numero: number; puntos: number; faltas: number }> };
  visitante: { nombre: string; puntos: number; jugadores: Array<{ nombre: string; apellido: string; numero: number; puntos: number; faltas: number }> };
  cancha: string;
  categoria: string;
  fecha: string;
  horaInicio: string;
  folio: string;
  fotoMarcadorUrl?: string;
  incidencias: unknown[];
}

export default function Acta() {
  const { partidoId } = useParams<{ partidoId: string }>();
  const [searchParams] = useSearchParams();
  const folioParam = searchParams.get('folio');
  const [acta, setActa] = useState<ActaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [syncHealth, setSyncHealth] = useState<{ pending: number; failed: number; lastError: string | null }>({
    pending: 0,
    failed: 0,
    lastError: null,
  });

  useEffect(() => {
    if (!partidoId) return;
    api<ActaData>('/partidos/' + partidoId + '/acta')
      .then(setActa)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
    useSyncStore.getState().getPartidoSyncHealth(partidoId).then(setSyncHealth).catch(() => {});
  }, [partidoId]);

  const fotoUrl = acta?.fotoMarcadorUrl
    ? (acta.fotoMarcadorUrl.startsWith('http') ? acta.fotoMarcadorUrl : API_BASE + acta.fotoMarcadorUrl)
    : '';

  const handleExportPdf = useCallback(async () => {
    if (!partidoId) return;
    setDownloading(true);
    try {
      const blob = await fetchPdfBlob(partidoId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `acta-${acta?.folio || partidoId}.pdf`;
      a.click();
      // En algunos navegadores, revocar inmediatamente puede corromper/invalidar el download.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error(e);
      alert('No se pudo descargar el PDF.');
    } finally {
      setDownloading(false);
    }
  }, [partidoId, acta?.folio]);

  const handleShare = useCallback(async () => {
    if (!partidoId) return;
    setSharing(true);
    try {
      const blob = await fetchPdfBlob(partidoId);
      const folio = acta?.folio ?? partidoId;
      const file = new File([blob], `acta-${folio}.pdf`, { type: 'application/pdf' });
      const shareTitle = `Acta ${folio}`;
      const shareText = acta
        ? `Acta del partido ${acta.local.nombre} vs ${acta.visitante.nombre} - Folio ${acta.folio}`
        : `Acta ${folio}`;

      if (typeof navigator.share !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `acta-${acta?.folio || partidoId}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        if (typeof navigator.share === 'undefined') {
          alert('Descarga iniciada. En este navegador no está disponible compartir directamente.');
        }
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      console.error(e);
      alert('No se pudo compartir. Prueba con "Exportar PDF" para descargar.');
    } finally {
      setSharing(false);
    }
  }, [partidoId, acta]);

  if (loading) return <div className="p-4 text-slate-400">Cargando acta...</div>;
  if (error || !acta) return <div className="p-4 text-red-400">{error || 'No se pudo cargar el acta'}</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto bg-slate-800 rounded-xl border border-slate-700">
      <h1 className="text-xl font-bold text-slate-100 text-center mb-4">Acta oficial</h1>
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={downloading || sharing}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium"
        >
          {downloading ? 'Descargando…' : 'Exportar PDF'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={downloading || sharing}
          className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium"
        >
          {sharing ? 'Preparando…' : 'Compartir'}
        </button>
      </div>
      {folioParam && (
        <p className="text-center text-emerald-400 font-medium mb-2">Folio: {acta.folio || folioParam}</p>
      )}
      {(syncHealth.pending > 0 || syncHealth.failed > 0) && (
        <div className="mb-4 rounded-lg bg-amber-900/80 border border-amber-600 px-3 py-2 text-amber-200 text-sm">
          El acta oficial puede no incluir {syncHealth.pending} cambios pendientes y {syncHealth.failed} con error.
        </div>
      )}
      <div className="text-center text-2xl font-bold text-slate-100 mb-4">
        {acta.local.nombre} {acta.local.puntos} - {acta.visitante.puntos} {acta.visitante.nombre}
      </div>
      {(acta.partido?.estado === 'default_local' || acta.partido?.estado === 'default_visitante') && (
        <p className="text-center text-amber-400 font-medium mb-2">
          Partido ganado por default (no presentación). Ganador: {acta.partido.estado === 'default_visitante' ? acta.local.nombre : acta.visitante.nombre}
        </p>
      )}
      {(acta.partido?.estado === 'finalizado' && acta.local.puntos !== acta.visitante.puntos) && (
        <p className="text-center text-slate-300 font-medium mb-2">
          Ganador: {acta.local.puntos > acta.visitante.puntos ? acta.local.nombre : acta.visitante.nombre}
        </p>
      )}
      <p className="text-sm text-slate-400 mb-4">
        {acta.categoria} · {acta.cancha} · {acta.fecha} {acta.horaInicio}
      </p>
      <table className="w-full text-sm text-left mb-4">
        <thead>
          <tr className="text-slate-300 border-b border-slate-600">
            <th className="py-2">#</th>
            <th className="py-2">Jugador</th>
            <th className="py-2 text-right">Pts</th>
            <th className="py-2 text-right">F</th>
          </tr>
        </thead>
        <tbody>
          {acta.local.jugadores.map((j) => (
            <tr key={j.numero} className="border-b border-slate-700 text-slate-300">
              <td className="py-1">{j.numero}</td>
              <td className="py-1">{j.nombre} {j.apellido}</td>
              <td className="py-1 text-right">{j.puntos}</td>
              <td className="py-1 text-right">{j.faltas}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="w-full text-sm text-left mb-4">
        <thead>
          <tr className="text-slate-300 border-b border-slate-600">
            <th className="py-2">#</th>
            <th className="py-2">Jugador</th>
            <th className="py-2 text-right">Pts</th>
            <th className="py-2 text-right">F</th>
          </tr>
        </thead>
        <tbody>
          {acta.visitante.jugadores.map((j) => (
            <tr key={j.numero} className="border-b border-slate-700 text-slate-300">
              <td className="py-1">{j.numero}</td>
              <td className="py-1">{j.nombre} {j.apellido}</td>
              <td className="py-1 text-right">{j.puntos}</td>
              <td className="py-1 text-right">{j.faltas}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {fotoUrl && (
        <div className="mb-4">
          <p className="text-sm text-slate-400 mb-2">Foto del marcador</p>
          <img src={fotoUrl} alt="Marcador" className="rounded-lg max-h-64 object-contain bg-slate-900" />
        </div>
      )}
      <p className="text-xs text-slate-500">Folio: {acta.folio}</p>
    </div>
  );
}
