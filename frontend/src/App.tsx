import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, ROLES_PARTIDO } from '@/store/authStore';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import PartidosList from '@/pages/PartidosList';
import ConfigMesa from '@/pages/ConfigMesa';
import Captura from '@/pages/Captura';
import Resumen from '@/pages/Resumen';
import Acta from '@/pages/Acta';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequirePartidoConfigCaptura({ children }: { children: React.ReactNode }) {
  const canWrite = useAuthStore((s) => s.hasRole(...ROLES_PARTIDO));
  const loc = useLocation();
  const isConfigOrCaptura = /^\/partido\/[^/]+\/(config|captura)$/.test(loc.pathname);
  if (!canWrite && isConfigOrCaptura) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<PartidosList />} />
        <Route
          path="partido/:partidoId/config"
          element={
            <RequirePartidoConfigCaptura>
              <ConfigMesa />
            </RequirePartidoConfigCaptura>
          }
        />
        <Route
          path="partido/:partidoId/captura"
          element={
            <RequirePartidoConfigCaptura>
              <Captura />
            </RequirePartidoConfigCaptura>
          }
        />
        <Route path="partido/:partidoId/resumen" element={<Resumen />} />
        <Route path="partido/:partidoId/acta" element={<Acta />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
