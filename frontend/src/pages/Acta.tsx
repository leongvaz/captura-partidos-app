import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';

interface ActaData {
  partido: { folio?: string; categoria: string; fecha: string; horaInicio: string };
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

  useEffect(() => {
    if (!partidoId) return;
    api<ActaData>('/partidos/' + partidoId + '/acta')
      .then(setActa)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [partidoId]);

  if (loading) return <div className="p-4 text-slate-400">Cargando acta...</div>;
  if (error || !acta) return <div className="p-4 text-red-400">{error || 'No se pudo cargar el acta'}</div>;

  const baseUrl = import.meta.env.VITE_API_URL || '';
  const fotoUrl = acta.fotoMarcadorUrl?.startsWith('http') ? acta.fotoMarcadorUrl : baseUrl + acta.fotoMarcadorUrl;

  return (
    <div className="p-4 max-w-2xl mx-auto bg-slate-800 rounded-xl border border-slate-700">
      <h1 className="text-xl font-bold text-slate-100 text-center mb-4">Acta oficial</h1>
      {folioParam && (
        <p className="text-center text-emerald-400 font-medium mb-2">Folio: {acta.folio || folioParam}</p>
      )}
      <div className="text-center text-2xl font-bold text-slate-100 mb-4">
        {acta.local.nombre} {acta.local.puntos} - {acta.visitante.puntos} {acta.visitante.nombre}
      </div>
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
