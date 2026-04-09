import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { ReglasLigaConfig } from '@/lib/api';
import {
  obtenerLigaPublica,
  obtenerReglasLiga,
  registrarCapitan,
  registrarEquipoCapitan,
} from '@/lib/api';
import { AppPage, PageHeader, SectionCard } from '@/components/ui/Page';
import { FormField, TextInput, SelectInput } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';

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
          const ramasDisponibles = (['varonil', 'femenil', 'mixta', 'veteranos', 'infantil'] as const).filter(
            (r) => cfg.ramas[r]
          );
          const ramaParam = searchParams.get('rama');
          const fuerzaParam = searchParams.get('fuerza');
          let rSel = ramasDisponibles[0] || '';
          let fSel = '';
          if (ramaParam && cfg.ramas[ramaParam as keyof typeof cfg.ramas] && ramasDisponibles.includes(ramaParam as (typeof ramasDisponibles)[number])) {
            rSel = ramaParam as (typeof ramasDisponibles)[number];
            const fu = cfg.fuerzasPorRama[rSel] || [];
            if (fuerzaParam && fu.includes(fuerzaParam)) fSel = fuerzaParam;
            else if (fu.length) fSel = fu[0];
          } else if (ramasDisponibles.length) {
            const fu = cfg.fuerzasPorRama[ramasDisponibles[0]] || [];
            if (fu.length) fSel = fu[0];
          }
          setRama(rSel);
          setFuerza(fSel);
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
  }, [ligaIdQuery, usuario, searchParams]);

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
      <div className="min-h-screen flex flex-col justify-center bg-slate-900">
        <AppPage maxWidth="md">
          <PageHeader
            title="Crear cuenta para registrar equipo"
            subtitle={
              ligaNombrePublica || ligaNombreStore
                ? `Liga: ${ligaNombrePublica || ligaNombreStore}`
                : 'Regístrate como capitán para inscribir tu equipo.'
            }
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <SectionCard>
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
          className="space-y-4"
        >
          <FormField label="Nombre(s)">
            <TextInput
              type="text"
              value={regNombres}
              onChange={(e) => setRegNombres(e.target.value)}
              required
            />
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Apellido paterno">
              <TextInput
                type="text"
                value={regApellidoP}
                onChange={(e) => setRegApellidoP(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Apellido materno">
              <TextInput
                type="text"
                value={regApellidoM}
                onChange={(e) => setRegApellidoM(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="CURP">
            <TextInput
              type="text"
              value={regCurp}
              onChange={(e) => setRegCurp(e.target.value.toUpperCase())}
              maxLength={18}
              placeholder="18 caracteres en mayúsculas"
              required
            />
          </FormField>
          <FormField label="Correo electrónico">
            <TextInput
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Contraseña">
            <TextInput
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Repite la contraseña">
            <TextInput
              type="password"
              value={regPassword2}
              onChange={(e) => setRegPassword2(e.target.value)}
              required
            />
          </FormField>
          <Button type="submit" disabled={registering} size="lg" className="w-full">
            {registering ? 'Creando cuenta...' : 'Crear cuenta y continuar'}
          </Button>
        </form>
          </SectionCard>
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
        </AppPage>
      </div>
    );
  }

  if (!ligaIdQuery) {
    return <div className="p-4 text-slate-400">Falta el identificador de la liga en el link.</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <AppPage maxWidth="md">
        <PageHeader
          title="Registro de equipo"
          subtitle={`Liga: ${ligaNombrePublica || ligaNombreStore || ligaIdQuery}`}
        />

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        {loading || !config ? (
          <p className="text-slate-400 text-sm">Cargando configuración de la liga...</p>
        ) : (
          <SectionCard>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Nombre del equipo">
                <TextInput
                  type="text"
                  value={nombreEquipo}
                  onChange={(e) => setNombreEquipo(e.target.value)}
                  required
                />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Rama">
                  <SelectInput
                    value={rama}
                    onChange={(e) => {
                      const nuevaRama = e.target.value;
                      setRama(nuevaRama);
                      const fuerzas =
                        config.fuerzasPorRama[
                          nuevaRama as keyof ReglasLigaConfig['fuerzasPorRama']
                        ] || [];
                      setFuerza(fuerzas[0] || '');
                    }}
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
                  </SelectInput>
                </FormField>
                <FormField label="Fuerza">
                  <SelectInput
                    value={fuerza}
                    onChange={(e) => setFuerza(e.target.value)}
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
                  </SelectInput>
                </FormField>
              </div>

              <p className="text-xs text-slate-400">
                Solo puedes registrar este equipo en una combinación de rama y fuerza. Más adelante
                podrás agregar jugadores y ver tus partidos desde tu panel.
              </p>

              <Button type="submit" disabled={saving} size="lg" className="w-full mt-1">
                {saving ? 'Registrando equipo...' : 'Registrar equipo'}
              </Button>
            </form>
          </SectionCard>
        )}

        {savedMessage && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 max-w-sm w-full shadow-xl">
              <h2 className="text-lg font-semibold text-slate-100 mb-2">Equipo registrado</h2>
              <p className="text-sm text-slate-300 mb-4">{savedMessage}</p>
              <div className="flex justify-end">
                <Button type="button" onClick={() => setSavedMessage('')}>
                  Aceptar
                </Button>
              </div>
            </div>
          </div>
        )}
      </AppPage>
    </div>
  );
}

