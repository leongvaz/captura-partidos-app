import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { db } from '@/lib/db';
import { AppPage, SectionCard, PageHeader } from '@/components/ui/Page';
import { FormField, TextInput } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  /** Ruta interna tras login (ej. `/sedes-canchas` si venías de ahí sin sesión). */
  const redirect = (() => {
    const r = searchParams.get('redirect') || '/';
    return r.startsWith('/') ? r : `/${r}`;
  })();
  const loginByEmail = useAuthStore((s) => s.loginByEmail);
  const [email, setEmail] = useState('');
  const [passwordOrPin, setPasswordOrPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginByEmail(email, passwordOrPin);
      const liga = useAuthStore.getState().liga;
      const ligaId = liga?.id;
      if (ligaId) {
        try {
          const [equipos, canchas] = await Promise.all([
            api<unknown[]>('/equipos?ligaId=' + ligaId),
            api<unknown[]>('/canchas?ligaId=' + ligaId),
          ]);
          if (liga) {
            await db.ligas.put({
              ...liga,
              createdAt: liga.createdAt || new Date().toISOString(),
              updatedAt: liga.updatedAt || new Date().toISOString(),
            });
          }
          for (const eq of Array.isArray(equipos) ? equipos : []) {
            const e = eq as {
              id: string;
              ligaId: string;
              temporadaId?: string;
              nombre: string;
              categoria: string;
              activo: boolean;
              createdAt: string;
              updatedAt: string;
            };
            await db.equipos.put(e);
            try {
              const jugadores = await api<unknown[]>('/jugadores?equipoId=' + e.id);
              for (const j of Array.isArray(jugadores) ? jugadores : []) {
                const jj = j as {
                  id: string;
                  equipoId: string;
                  nombre: string;
                  apellido: string;
                  numero: number;
                  invitado: boolean;
                  activo: boolean;
                  createdAt: string;
                  updatedAt: string;
                };
                await db.jugadores.put(jj);
              }
            } catch {
              /* un equipo puede fallar; seguimos */
            }
          }
          for (const c of Array.isArray(canchas) ? canchas : []) {
            const cc = c as {
              id: string;
              ligaId: string;
              sedeId?: string | null;
              nombre: string;
              nombreCompleto?: string;
              sede?: { id: string; nombre: string } | null;
              activo: boolean;
              createdAt?: string;
              updatedAt?: string;
            };
            await db.canchas.put({
              id: cc.id,
              ligaId: cc.ligaId,
              sedeId: cc.sedeId ?? null,
              nombre: cc.nombre,
              nombreCompleto: cc.nombreCompleto,
              sedeNombre: cc.sede?.nombre ?? null,
              activo: cc.activo,
              createdAt: cc.createdAt,
              updatedAt: cc.updatedAt,
            });
          }
        } catch (syncErr) {
          console.warn('[login] Sincronización para modo offline incompleta (puedes usar la app igual):', syncErr);
        }
      }
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-slate-900">
      <AppPage maxWidth="sm">
        <PageHeader
          title="Captura Partidos"
          subtitle="Inicia sesión para administrar ligas, equipos y partidos."
        />
        <SectionCard>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Correo electrónico">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
              />
            </FormField>
            <FormField label="Contraseña o PIN rápido">
              <TextInput
                type="password"
                value={passwordOrPin}
                onChange={(e) => setPasswordOrPin(e.target.value)}
                placeholder="Ingresa tu contraseña o PIN"
                required
              />
            </FormField>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </SectionCard>
      </AppPage>
    </div>
  );
}
