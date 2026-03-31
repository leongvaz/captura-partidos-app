import { useAuthStore } from '@/store/authStore';
import type { ReglasLigaConfig } from '@/lib/api';
import { obtenerReglasLiga } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';

export default function InvitacionesEquipos() {
  const liga = useAuthStore((s) => s.liga);
  const ligaId = liga?.id;
  const [config, setConfig] = useState<ReglasLigaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ligaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const cfg = await obtenerReglasLiga(ligaId);
        if (!cancelled) setConfig(cfg);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('No se pudieron cargar las reglas de la liga.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ligaId]);

  const linkInscripcion = useMemo(() => {
    if (!ligaId && typeof window === 'undefined') return '';
    const base =
      typeof window !== 'undefined'
        ? `${window.location.origin}/registro-equipo`
        : '/registro-equipo';
    return `${base}?ligaId=${encodeURIComponent(ligaId || '')}`;
  }, [ligaId]);

  if (!ligaId) {
    return <div className="p-4 text-slate-400">No hay liga seleccionada.</div>;
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Invitación a equipos</h1>
      <p className="text-slate-400 text-sm mb-4">
        Comparte este enlace con las personas que serán capitanes de equipo. Cada capitán podrá
        registrarse, inscribir su equipo y elegir la rama y fuerza permitidas por la liga.
      </p>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <section className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Link de inscripción</h2>
        <p className="text-xs text-slate-400 mb-2">
          Este link incluye el identificador de la liga. Si la persona no tiene sesión iniciada, se
          le pedirá registrarse; si ya tiene sesión, irá directo a la inscripción / gestión de su
          equipo.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            readOnly
            value={linkInscripcion}
            className="flex-1 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              if (!linkInscripcion) return;
              navigator.clipboard
                .writeText(linkInscripcion)
                .catch(() => alert('No se pudo copiar el link al portapapeles.'));
            }}
            className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium px-3 py-2 text-sm"
          >
            Copiar link
          </button>
        </div>
      </section>

      <section className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Ramas y fuerzas disponibles</h2>
        {loading || !config ? (
          <p className="text-slate-400 text-sm">Cargando reglas de la liga...</p>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            {(['varonil', 'femenil', 'mixta', 'veteranos', 'infantil'] as const).map((rama) => {
              if (!config.ramas[rama]) return null;
              const fuerzas = config.fuerzasPorRama[rama] || [];
              return (
                <div key={rama}>
                  <p className="font-medium">
                    {rama.charAt(0).toUpperCase() + rama.slice(1)}:{' '}
                    <span className="font-normal">
                      {fuerzas.length ? fuerzas.join(', ') : 'Sin fuerzas configuradas'}
                    </span>
                  </p>
                </div>
              );
            })}
            <p className="text-xs text-slate-400 mt-2">
              Al inscribir un equipo, el capitán deberá elegir una sola combinación de rama y
              fuerza (por ejemplo, Varonil Intermedia).
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

