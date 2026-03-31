import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { ReglasLigaConfig } from '@/lib/api';
import { obtenerLigaPublica, obtenerReglasLiga, registrarCapitan, registrarEquipoCapitan } from '@/lib/api';

function normalizarNombrePropio(valor: string): string {
  if (!valor) return '';
  const lower = valor.toLocaleLowerCase('es-MX');
  return lower.replace(/\S+/g, (palabra) => {
    const [primera, ...resto] = palabra;
    if (!primera) return palabra;
    return primera.toLocaleUpperCase('es-MX') + resto.join('');
  });
}

export default function RegistroEquipo() {
  const usuario = useAuthStore((s) => s.usuario);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ligaFromStore = useAuthStore((s) => s.liga);
  const ligaIdQuery = searchParams.get('ligaId') || ligaFromStore?.id || '';
  const ligaNombreStore = ligaFromStore?.nombre;
  const [ligaNombrePublica, setLigaNombrePublica] = useState<string | null>(null);

  const [config, setConfig] = useState<ReglasLigaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const [nombreEquipo, setNombreEquipo] = useState('');
  const [rama, setRama] = useState('');
  const [fuerza, setFuerza] = useState('');
  const [regNombres, setRegNombres] = useState('');
  const [regApellidoP, setRegApellidoP] = useState('');
  const [regApellidoM, setRegApellidoM] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  const [regCurp, setRegCurp] = useState('');
  const [registering, setRegistering] = useState(false);

  // Cargar nombre público de la liga para mostrarlo en el encabezado, incluso sin sesión
  useEffect(() => {
    if (!ligaIdQuery) return;
    let cancelled = false;
    (async () => {
      try {
        const liga = await obtenerLigaPublica(ligaIdQuery);
        if (!cancelled) setLigaNombrePublica(liga.nombre);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ligaIdQuery]);

  useEffect(() => {
    // Solo intentamos cargar reglas cuando tenemos ligaId y ya hay usuario (sesión iniciada)
    if (!ligaIdQuery || !usuario) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const cfg = await obtenerReglasLiga(ligaIdQuery);
        if (!cancelled) {
          setConfig(cfg);
          // Seleccionar por defecto la primera rama activa
          const ramasDisponibles = (['varonil', 'femenil', 'mixta', 'veteranos', 'infantil'] as const).filter(
            (r) => cfg.ramas[r]
          );
          if (ramasDisponibles.length) {
            setRama(ramasDisponibles[0]);
            const fuerzas = cfg.fuerzasPorRama[ramasDisponibles[0]] || [];
            if (fuerzas.length) setFuerza(fuerzas[0]);
          }
        }
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
  }, [ligaIdQuery, usuario]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ligaIdQuery || !rama || !fuerza) return;
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      await registrarEquipoCapitan({
        ligaId: ligaIdQuery,
        nombre: nombreEquipo.trim(),
        rama,
        fuerza,
      });
      setNombreEquipo('');
      setSavedMessage('Equipo registrado correctamente en la liga.');
      // Ir al panel principal del capitán
      window.location.href = '/panel-equipo';
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'No se pudo registrar el equipo.');
    } finally {
      setSaving(false);
    }
  };

  if (!usuario) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Crear cuenta para registrar equipo</h1>
        <p className="text-slate-400 text-sm mb-4">
          Liga:{' '}
          <span className="font-medium text-slate-100">
            {ligaNombrePublica || ligaNombreStore || '—'}
          </span>
          . Regístrate como capitán para poder inscribir tu equipo en esta liga.
        </p>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ligaIdQuery) {
              setError('Falta el ID de la liga en el link.');
              return;
            }
            if (/\s/.test(regPassword)) {
              setError('La contraseña no debe contener espacios.');
              return;
            }
            if (regPassword !== regPassword2) {
              setError('Las contraseñas no coinciden.');
              return;
            }
            if (!regCurp || regCurp.length !== 18) {
              setError('La CURP es obligatoria y debe tener 18 caracteres.');
              return;
            }
            setRegistering(true);
            setError('');
            try {
              const nombreCompleto = `${regNombres} ${regApellidoP} ${regApellidoM}`.trim();
              const nombreNormalizado = normalizarNombrePropio(nombreCompleto || regNombres);
              const res = await registrarCapitan({
                ligaId: ligaIdQuery,
                email: regEmail,
                password: regPassword,
                nombre: nombreNormalizado,
                curp: regCurp.toUpperCase(),
              });
              useAuthStore.getState().setAuth(res.token, res.usuario, res.liga);
            } catch (err) {
              console.error(err);
              setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
            } finally {
              setRegistering(false);
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre(s)</label>
            <input
              type="text"
              value={regNombres}
              onChange={(e) => setRegNombres(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Apellido paterno</label>
              <input
                type="text"
                value={regApellidoP}
                onChange={(e) => setRegApellidoP(e.target.value)}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Apellido materno</label>
              <input
                type="text"
                value={regApellidoM}
                onChange={(e) => setRegApellidoM(e.target.value)}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">CURP</label>
            <input
              type="text"
              value={regCurp}
              onChange={(e) => setRegCurp(e.target.value.toUpperCase())}
              maxLength={18}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              placeholder="18 caracteres en mayúsculas"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
            <input
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Repite la contraseña</label>
            <input
              type="password"
              value={regPassword2}
              onChange={(e) => setRegPassword2(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={registering}
            className="mt-2 w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 disabled:opacity-50"
          >
            {registering ? 'Creando cuenta...' : 'Crear cuenta y continuar'}
          </button>
        </form>
        <button
          type="button"
          onClick={() =>
            navigate(
              `/login?redirect=${encodeURIComponent(
                `/registro-equipo?ligaId=${encodeURIComponent(ligaIdQuery)}`
              )}`
            )
          }
          className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-200"
        >
          ¿Ya tienes cuenta? Inicia sesión para registrar tu equipo
        </button>
      </div>
    );
  }

  if (!ligaIdQuery) {
    return <div className="p-4 text-slate-400">Falta el identificador de la liga en el link.</div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Registro de equipo</h1>
      <p className="text-slate-400 text-sm mb-4">
        Liga:{' '}
        <span className="font-medium text-slate-100">
          {ligaNombrePublica || ligaNombreStore || ligaIdQuery}
        </span>
        . Completa los datos para inscribir tu equipo en esta liga.
      </p>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {loading || !config ? (
        <p className="text-slate-400 text-sm">Cargando configuración de la liga...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del equipo</label>
            <input
              type="text"
              value={nombreEquipo}
              onChange={(e) => setNombreEquipo(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Rama</label>
              <select
                value={rama}
                onChange={(e) => {
                  const nuevaRama = e.target.value;
                  setRama(nuevaRama);
                  const fuerzas = config.fuerzasPorRama[nuevaRama as keyof ReglasLigaConfig['fuerzasPorRama']] || [];
                  setFuerza(fuerzas[0] || '');
                }}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
                required
              >
                <option value="">Selecciona rama</option>
                {(['varonil', 'femenil', 'mixta', 'veteranos', 'infantil'] as const).map((r) =>
                  config.ramas[r] ? (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ) : null
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Fuerza</label>
              <select
                value={fuerza}
                onChange={(e) => setFuerza(e.target.value)}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
                required
              >
                <option value="">Selecciona fuerza</option>
                {rama &&
                  (config.fuerzasPorRama[
                    rama as keyof ReglasLigaConfig['fuerzasPorRama']
                  ] || []
                  ).map((f) => (
                    <option key={f} value={f}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Solo puedes registrar este equipo en una combinación de rama y fuerza. Más adelante
            podrás agregar jugadores y ver tus partidos desde tu panel.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 disabled:opacity-50"
          >
            {saving ? 'Registrando equipo...' : 'Registrar equipo'}
          </button>
        </form>
      )}

      {savedMessage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 max-w-sm w-full shadow-xl">
            <h2 className="text-lg font-semibold text-slate-100 mb-2">Equipo registrado</h2>
            <p className="text-sm text-slate-300 mb-4">{savedMessage}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSavedMessage('')}
                className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium px-4 py-2"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

