import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore, ROLES_PARTIDO } from '@/store/authStore';
import { db } from '@/lib/db';
import { api } from '@/lib/api';
import { usePartidoStore } from '@/store/partidoStore';
import { useSyncStore } from '@/store/syncStore';
import type { Jugador } from '@/types/entities';

export default function Resumen() {
  const { partidoId } = useParams<{ partidoId: string }>();
  const navigate = useNavigate();
  const canWritePartido = useAuthStore((s) => s.hasRole(...ROLES_PARTIDO));
  const { partidoActual, plantilla, eventos, loadPartido, getPuntosJugador, getFaltasJugador } = usePartidoStore();
  const [jugadoresMap, setJugadoresMap] = useState<Record<string, Jugador>>({});
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    if (!partidoId) return;
    loadPartido(partidoId);
    db.jugadores.toArray().then((all) => {
      const map: Record<string, Jugador> = {};
      all.forEach((j) => { map[j.id] = j; });
      setJugadoresMap(map);
    });
  }, [partidoId, loadPartido]);

  const partido = partidoActual;
  if (!partido) return <div className="p-4 text-slate-400">Cargando...</div>;

  const puntosLocal = plantilla.filter((p) => p.equipoId === partido.localEquipoId).reduce((s, p) => s + getPuntosJugador(p.jugadorId), 0);
  const puntosVisitante = plantilla.filter((p) => p.equipoId === partido.visitanteEquipoId).reduce((s, p) => s + getPuntosJugador(p.jugadorId), 0);

  const localJugadores = plantilla.filter((p) => p.equipoId === partido.localEquipoId);
  const visitanteJugadores = plantilla.filter((p) => p.equipoId === partido.visitanteEquipoId);

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFotoFile(f);
    const url = URL.createObjectURL(f);
    setFotoPreview(url);
  };

  const runSync = useSyncStore((s) => s.runSync);

  const cerrarPartido = async () => {
    if (!partidoId || !fotoFile) {
      alert('Toma una foto del marcador antes de cerrar.');
      return;
    }
    setCerrando(true);
    try {
      await runSync();
      const form = new FormData();
      form.append('fotoMarcador', fotoFile);
      const res = await api<{ partido: { fotoMarcadorUrl?: string }; folio: string }>('/partidos/' + partidoId + '/cerrar', {
        method: 'POST',
        body: form as unknown as Record<string, unknown>,
        headers: {} as Record<string, string>,
      });
      const { partido: updated, folio } = res;
      await db.partidos.update(partidoId, {
        estado: 'finalizado',
        folio,
        fotoMarcadorUrl: updated?.fotoMarcadorUrl ?? '',
        cerradoAt: new Date().toISOString(),
        synced: true,
      });
      navigate(`/partido/${partidoId}/acta?folio=${encodeURIComponent(folio)}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cerrar');
    } finally {
      setCerrando(false);
    }
  };

  const yaCerrado = partido.estado === 'finalizado';

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-slate-100 mb-4">Resumen y cierre</h2>
      <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 mb-4">
        <div className="text-center text-2xl font-bold text-slate-100 mb-4">
          {puntosLocal} - {puntosVisitante}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-slate-300 mb-2">Local</p>
            <ul>
              {localJugadores.map((pl) => {
                const j = jugadoresMap[pl.jugadorId];
                return j ? (
                  <li key={j.id} className="flex justify-between text-slate-400">
                    <span>#{j.numero} {j.apellido}</span>
                    <span>{getPuntosJugador(j.id)} pts · {getFaltasJugador(j.id)} F</span>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
          <div>
            <p className="font-medium text-slate-300 mb-2">Visitante</p>
            <ul>
              {visitanteJugadores.map((pl) => {
                const j = jugadoresMap[pl.jugadorId];
                return j ? (
                  <li key={j.id} className="flex justify-between text-slate-400">
                    <span>#{j.numero} {j.apellido}</span>
                    <span>{getPuntosJugador(j.id)} pts · {getFaltasJugador(j.id)} F</span>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        </div>
      </div>
      {canWritePartido ? (
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Foto del marcador (obligatoria)</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFoto}
            disabled={yaCerrado}
            className="block w-full text-slate-400 file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary-600 file:text-white"
          />
          {fotoPreview && (
            <img src={fotoPreview} alt="Marcador" className="mt-2 rounded-lg max-h-48 object-contain bg-slate-800" />
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400 mb-4">Vista de solo lectura. No puedes cerrar este partido.</p>
      )}
      {canWritePartido && !yaCerrado && (
        <button
          type="button"
          disabled={!fotoFile || cerrando}
          onClick={cerrarPartido}
          className="w-full py-3 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium"
        >
          {cerrando ? 'Cerrando...' : 'Cerrar partido y generar acta'}
        </button>
      )}
      {yaCerrado && partido.folio && (
        <button
          type="button"
          onClick={() => navigate(`/partido/${partidoId}/acta`)}
          className="w-full py-3 rounded-lg bg-emerald-600 text-white font-medium"
        >
          Ver acta · Folio {partido.folio}
        </button>
      )}
    </div>
  );
}
