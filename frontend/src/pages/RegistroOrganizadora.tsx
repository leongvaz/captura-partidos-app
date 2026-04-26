import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { registrarOrganizador, obtenerLigaPublica } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { AppPage, PageHeader, SectionCard } from '@/components/ui/Page';
import { FormField, TextInput } from '@/components/ui/Form';
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

export default function RegistroOrganizadora() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loginStore = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);

  const ligaId = searchParams.get('ligaId') || '';

  const [nombres, setNombres] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [email, setEmail] = useState('');
  const [curp, setCurp] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ligaNombre, setLigaNombre] = useState<string | null>(null);
  const [ligaTemporada, setLigaTemporada] = useState<string | null>(null);
  const [ligaCargando, setLigaCargando] = useState(false);
  const [ligaError, setLigaError] = useState<string | null>(null);

  // Si ya hay sesión iniciada, no tiene sentido mostrar de nuevo el registro de organizador.
  useEffect(() => {
    if (token) {
      navigate('/', { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!ligaId) {
      setLigaNombre(null);
      setLigaTemporada(null);
      setLigaError(null);
      return;
    }
    let cancelled = false;
    setLigaCargando(true);
    setLigaError(null);
    obtenerLigaPublica(ligaId)
      .then((l) => {
        if (!cancelled) {
          setLigaNombre(l.nombre);
          setLigaTemporada(l.temporada);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLigaNombre(null);
          setLigaTemporada(null);
          setLigaError('No se encontró la liga con este enlace. Verifica el link o contacta a quien te lo envió.');
        }
      })
      .finally(() => {
        if (!cancelled) setLigaCargando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ligaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!ligaId) {
      setError('Falta el ID de la liga en el link');
      return;
    }
    setLoading(true);
    try {
      const nombreCompleto = `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim();
      const nombreNormalizado = normalizarNombrePropio(nombreCompleto || nombres);
      const res = await registrarOrganizador({
        ligaId,
        email,
        password,
        pin,
        nombre: nombreNormalizado,
        apellidoPaterno: apellidoPaterno || undefined,
        apellidoMaterno: apellidoMaterno || undefined,
        curp,
      });
      loginStore(res.token, res.usuario, res.liga);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar organizadora');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-slate-900">
      <AppPage maxWidth="md">
        <PageHeader
          title="Registro de organizador/a"
          subtitle="Crea tu cuenta para administrar la liga."
        />
        <SectionCard>
          {!ligaId && (
            <p className="text-red-400 text-sm mb-3">
              Este link no tiene un <code className="bg-slate-700 px-1 rounded">ligaId</code> válido.
            </p>
          )}
          {ligaId && ligaCargando && (
            <p className="text-sm text-slate-400 mb-3">Cargando datos de la liga…</p>
          )}
          {ligaId && ligaError && (
            <p className="text-sm text-amber-400 mb-3">{ligaError}</p>
          )}
          {ligaId && !ligaCargando && ligaNombre && (
            <div className="mb-4 rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Liga</p>
              <p className="text-base font-semibold text-slate-100">{ligaNombre}</p>
              {ligaTemporada && (
                <p className="text-sm text-slate-400 mt-0.5">Temporada: {ligaTemporada}</p>
              )}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Nombre(s)">
                <TextInput
                  type="text"
                  value={nombres}
                  onChange={(e) => setNombres(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Apellido paterno">
                <TextInput
                  type="text"
                  value={apellidoPaterno}
                  onChange={(e) => setApellidoPaterno(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Apellido materno">
                <TextInput
                  type="text"
                  value={apellidoMaterno}
                  onChange={(e) => setApellidoMaterno(e.target.value)}
                />
              </FormField>
              <FormField label="CURP">
                <TextInput
                  type="text"
                  value={curp}
                  onChange={(e) => setCurp(e.target.value.toUpperCase())}
                  placeholder="CURP completa"
                  required
                />
              </FormField>
            </div>
            <FormField label="Correo electrónico">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Contraseña">
                <TextInput
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="PIN rápido">
                <TextInput
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="4-6 dígitos para acceso rápido"
                  required
                />
              </FormField>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button
              type="submit"
              disabled={
                loading ||
                !ligaId ||
                !!ligaError ||
                ligaCargando ||
                Boolean(ligaId && !ligaNombre)
              }
              size="lg"
              className="w-full mt-1"
            >
              {loading ? 'Registrando...' : 'Crear cuenta y entrar'}
            </Button>
          </form>
        </SectionCard>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-200"
        >
          Ir al inicio de sesión
        </button>
      </AppPage>
    </div>
  );
}

