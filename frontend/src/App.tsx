import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, ROLES_PARTIDO } from '@/store/authStore';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import RegistroOrganizadora from '@/pages/RegistroOrganizadora';
import PartidosList from '@/pages/PartidosList';
import ReglasLiga from '@/pages/ReglasLiga';
import InvitacionesEquipos from '@/pages/InvitacionesEquipos';
import RegistroEquipo from '@/pages/RegistroEquipo';
import PanelEquipo from '@/pages/PanelEquipo';
import ConfigMesa from '@/pages/ConfigMesa';
import Captura from '@/pages/Captura';
import Resumen from '@/pages/Resumen';
import Acta from '@/pages/Acta';
import PanelLiga from '@/pages/PanelLiga';
import PanelSuperAdmin from '@/pages/PanelSuperAdmin';
import SuperAdminLigaDetalle from '@/pages/SuperAdminLigaDetalle';
import SuperAdminEquipoDetalle from '@/pages/SuperAdminEquipoDetalle';
import JugadoresEquipo from '@/pages/JugadoresEquipo';
import SedesCanchas from '@/pages/SedesCanchas';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const loc = useLocation();
  if (!token) {
    const redirect = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
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
      <Route path="/sedes_canchas" element={<Navigate to="/sedes-canchas" replace />} />
      <Route path="/registro-organizadora" element={<RegistroOrganizadora />} />
      <Route path="/registro-equipo" element={<RegistroEquipo />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<PartidosList />} />
        <Route path="reglas-liga" element={<ReglasLiga />} />
        <Route path="invitaciones-equipos" element={<InvitacionesEquipos />} />
        <Route path="panel-equipo" element={<PanelEquipo />} />
        <Route path="equipo/:equipoId/jugadores" element={<JugadoresEquipo />} />
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
        <Route path="panel" element={<PanelLiga />} />
        <Route path="sedes-canchas" element={<SedesCanchas />} />
        <Route path="superadmin" element={<PanelSuperAdmin />} />
        <Route path="superadmin/liga/:ligaId" element={<SuperAdminLigaDetalle />} />
        <Route
          path="superadmin/liga/:ligaId/equipo/:equipoId"
          element={<SuperAdminEquipoDetalle />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
