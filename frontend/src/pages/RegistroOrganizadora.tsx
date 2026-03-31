import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { registrarOrganizador } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

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

  // Si ya hay sesión iniciada, no tiene sentido mostrar de nuevo el registro de organizador.
  useEffect(() => {
    if (token) {
      navigate('/', { replace: true });
    }
  }, [token, navigate]);

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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900">
      <div className="w-full max-w-md rounded-xl bg-slate-800 p-6 shadow-xl border border-slate-700">
        <h1 className="text-2xl font-bold text-slate-100 text-center mb-1">
          Registro de organizador/a
        </h1>
        <p className="text-slate-400 text-sm text-center mb-4">
          Completa tus datos para administrar la liga.
        </p>
        {!ligaId && (
          <p className="text-red-400 text-sm mb-4">
            Este link no tiene un <code className="bg-slate-700 px-1 rounded">ligaId</code> válido.
          </p>
        )}
        {ligaId && (
          <p className="text-xs text-slate-500 mb-4 text-center">
            Liga ID: <code className="bg-slate-700 px-1 rounded">{ligaId}</code>
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nombre(s)</label>
              <input
                type="text"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Apellido paterno
              </label>
              <input
                type="text"
                value={apellidoPaterno}
                onChange={(e) => setApellidoPaterno(e.target.value)}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Apellido materno
              </label>
              <input
                type="text"
                value={apellidoMaterno}
                onChange={(e) => setApellidoMaterno(e.target.value)}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">CURP</label>
              <input
                type="text"
                value={curp}
                onChange={(e) => setCurp(e.target.value.toUpperCase())}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
                placeholder="CURP completa"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">PIN rápido</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
                placeholder="4-6 dígitos para acceso rápido"
                required
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !ligaId}
            className="w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 disabled:opacity-50 mt-2"
          >
            {loading ? 'Registrando...' : 'Crear cuenta y entrar'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-200"
        >
          Ir al inicio de sesión
        </button>
      </div>
    </div>
  );
}

