import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { crearLigaAdmin, listarLigasAdmin } from '@/lib/api';

interface LigaItem {
  id: string;
  nombre: string;
  temporada: string;
  categorias: string[];
}

export default function PanelSuperAdmin() {
  const usuario = useAuthStore((s) => s.usuario);
  const [ligas, setLigas] = useState<LigaItem[]>([]);
  const [nombre, setNombre] = useState('');
  const [temporada, setTemporada] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLigaId, setCopiedLigaId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listarLigasAdmin();
        if (!cancelled) setLigas(data);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!usuario?.isSuperAdmin) {
    return (
      <div className="p-4 text-slate-300">
        No tienes acceso a este panel.
      </div>
    );
  }

  const handleCrearLiga = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nombre.trim() || !temporada.trim()) {
      setError('Nombre y temporada son obligatorios.');
      return;
    }
    setLoading(true);
    try {
      const nueva = await crearLigaAdmin({ nombre: nombre.trim(), temporada: temporada.trim() });
      setLigas((prev) => [nueva, ...prev]);
      setNombre('');
      setTemporada('');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'No se pudo crear la liga.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRegistroOrganizador = async (ligaId: string) => {
    const base = window.location.origin;
    const url = `${base}/registro-equipo?ligaId=${ligaId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLigaId(ligaId);
      setTimeout(() => setCopiedLigaId(null), 2000);
    } catch (e) {
      console.error(e);
      alert(`No se pudo copiar. URL: ${url}`);
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Panel superadmin</h1>
      <p className="text-slate-300 text-sm">
        Aquí podrás crear nuevas ligas y ver el listado existente.
      </p>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">Crear nueva liga</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <form className="space-y-3" onSubmit={handleCrearLiga}>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Nombre de la liga</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
              placeholder="Liga Municipal de Basquetbol Texcoco"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Temporada</label>
            <input
              type="text"
              value={temporada}
              onChange={(e) => setTemporada(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 text-sm"
              placeholder="Primavera 2026"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 hover:bg-primary-500 disabled:opacity-60 px-4 py-2 text-sm font-medium text-white"
          >
            {loading ? 'Creando...' : 'Crear liga'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Ligas registradas</h2>
        {ligas.length === 0 ? (
          <p className="text-slate-400 text-sm">Aún no hay ligas registradas.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-200">
            {ligas.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              >
                <div>
                  <div className="font-medium">{l.nombre}</div>
                  <div className="text-xs text-slate-400">
                    Temporada: {l.temporada} · Categorías: {l.categorias.join(', ') || '—'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopyRegistroOrganizador(l.id)}
                    className="text-[11px] px-3 py-1 rounded bg-primary-600 hover:bg-primary-500 text-white"
                  >
                    {copiedLigaId === l.id
                      ? 'Link de inscripción copiado'
                      : 'Copiar link de inscripción de equipos'}
                  </button>
                  <div className="text-[10px] text-slate-500">
                    ID: {l.id}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

