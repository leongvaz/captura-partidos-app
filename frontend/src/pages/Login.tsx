import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { db } from '@/lib/db';

const DEMO_LIGA_ID = '00000000-0000-0000-0000-000000000001';

export default function Login() {
  const navigate = useNavigate();
  const loginStore = useAuthStore((s) => s.login);
  const [ligaId, setLigaId] = useState(DEMO_LIGA_ID);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginStore(ligaId, pin);
      const [equipos, canchas] = await Promise.all([
        api<unknown[]>('/equipos?ligaId=' + ligaId),
        api<unknown[]>('/canchas?ligaId=' + ligaId),
      ]);
      const liga = useAuthStore.getState().liga;
      if (liga) await db.ligas.put({ ...liga, createdAt: liga.createdAt || new Date().toISOString(), updatedAt: liga.updatedAt || new Date().toISOString() });
      for (const eq of Array.isArray(equipos) ? equipos : []) {
        const e = eq as { id: string; ligaId: string; nombre: string; categoria: string; activo: boolean; createdAt: string; updatedAt: string };
        await db.equipos.put(e);
        const jugadores = await api<unknown[]>('/jugadores?equipoId=' + e.id);
        for (const j of Array.isArray(jugadores) ? jugadores : []) {
          const jj = j as { id: string; equipoId: string; nombre: string; apellido: string; numero: number; invitado: boolean; activo: boolean; createdAt: string; updatedAt: string };
          await db.jugadores.put(jj);
        }
      }
      for (const c of Array.isArray(canchas) ? canchas : []) {
        const cc = c as { id: string; ligaId: string; nombre: string; activo: boolean; createdAt?: string; updatedAt?: string };
        await db.canchas.put(cc);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900">
      <div className="w-full max-w-sm rounded-xl bg-slate-800 p-6 shadow-xl border border-slate-700">
        <h1 className="text-2xl font-bold text-slate-100 text-center mb-2">Captura Partidos</h1>
        <p className="text-slate-400 text-sm text-center mb-6">Basketball Amateur</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">ID de Liga</label>
            <input
              type="text"
              value={ligaId}
              onChange={(e) => setLigaId(e.target.value)}
              placeholder="UUID de la liga"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN del anotador"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="mt-4 text-slate-500 text-xs text-center">
          Demo: Liga ya rellenada, PIN <code className="bg-slate-700 px-1 rounded">1234</code>
        </p>
      </div>
    </div>
  );
}
