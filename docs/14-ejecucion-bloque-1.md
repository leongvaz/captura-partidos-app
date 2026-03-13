## Ejecución Bloque 1 – Control de acceso por rol y vistas de resumen

**Fecha:** 2026-03-13  
**Alcance:** Implementación completa del Bloque 1 del documento `13-plan-ejecucion-mvp.md` en el frontend.

---

### 1. Cambios en `App.tsx`

- **Imports actualizados**:
  - Se añadió `useLocation` de `react-router-dom`.
  - Se amplió el import de auth: `import { useAuthStore, ROLES_PARTIDO } from '@/store/authStore';`.
- **Nuevo guard de ruta `RequirePartidoConfigCaptura`**:
  - Firma: `function RequirePartidoConfigCaptura({ children }: { children: React.ReactNode })`.
  - Lógica:
    - Obtiene `canWrite = useAuthStore((s) => s.hasRole(...ROLES_PARTIDO))`.
    - Obtiene la ubicación actual con `useLocation()`.
    - Calcula `isConfigOrCaptura` con el patrón `^/partido/[^/]+/(config|captura)$` sobre `loc.pathname`.
    - Si `!canWrite && isConfigOrCaptura` → devuelve `<Navigate to="/" replace />`.
    - En caso contrario, devuelve los `children` sin modificar.
- **Rutas protegidas según plan**:
  - Dentro del árbol protegido por `PrivateRoute` + `Layout`, se modificaron las rutas de partido:
    - `partido/:partidoId/config` ahora va envuelta en `RequirePartidoConfigCaptura`, renderizando `ConfigMesa` dentro.
    - `partido/:partidoId/captura` ahora va envuelta en `RequirePartidoConfigCaptura`, renderizando `Captura` dentro.
    - `partido/:partidoId/resumen` se deja **sin guard**, accesible para usuarios de consulta.
  - El resto de la estructura (login, ruta raíz, wildcard) se mantiene igual.

**Resultado funcional:**  
Los usuarios sin rol de escritura de partido (no incluidos en `ROLES_PARTIDO`) no pueden entrar a `/partido/:id/config` ni `/partido/:id/captura` aunque conozcan la URL; son redirigidos a `/`. La ruta `/partido/:id/resumen` permanece accesible en modo lectura.

---

### 2. Cambios en `PartidosList.tsx`

- **Imports actualizados**:
  - Se amplió a `import { useAuthStore, ROLES_PARTIDO } from '@/store/authStore';`.
- **Nuevo flag de permiso de escritura**:
  - Dentro del componente se añadió:
    - `const canWritePartido = useAuthStore((s) => s.hasRole(...ROLES_PARTIDO));`
- **Botón “+ Nuevo partido” condicionado por rol**:
  - Antes: botón siempre visible.
  - Ahora: el botón se renderiza solo si `canWritePartido` es `true`.
  - El texto de “No hay partidos para esta fecha” también se ajusta:
    - Si `canWritePartido` es `true` se muestra “Crea uno arriba”.
    - Si es `false`, solo se muestra “No hay partidos para esta fecha.” sin sugerir crear.
- **Navegación según rol y estado del partido**:
  - Se cambió el `to={...}` del `Link` por una lógica ramificada:
    - Si `canWritePartido === true`:
      - `programado` → `/partido/:id/config`.
      - `en_curso` → `/partido/:id/captura`.
      - `finalizado`, `default_local`, `default_visitante` → `/partido/:id/acta`.
      - Otros estados → `/partido/:id/resumen`.
    - Si `canWritePartido === false` (rol consulta):
      - `finalizado`, `default_local`, `default_visitante` → `/partido/:id/acta`.
      - Resto de estados (`programado`, `en_curso`, etc.) → `/partido/:id/resumen`.
  - El resto del layout de la tarjeta (estado, nombres de equipos, folio si existe) permanece intacto.

**Resultado funcional:**  
Los usuarios con rol de anotador/admin pueden crear partidos y entrar a config/captura; los de solo consulta ya no ven el botón de creación y, desde la lista, solo pueden ir a **resumen** (para partidos no cerrados) o **acta** (para finalizados/default).

---

### 3. Cambios en `Resumen.tsx`

- **Imports actualizados**:
  - Se añadió `import { useAuthStore, ROLES_PARTIDO } from '@/store/authStore';`.
- **Nuevo flag `canWritePartido`**:
  - Dentro del componente:
    - `const canWritePartido = useAuthStore((s) => s.hasRole(...ROLES_PARTIDO));`
- **Separación entre vista de escritura y de solo lectura**:
  - **Bloque de foto de marcador**:
    - Antes: input de archivo y preview siempre visibles (solo deshabilitados si `yaCerrado`).
    - Ahora:
      - Si `canWritePartido` es `true`:
        - Se mantiene el bloque original: label “Foto del marcador (obligatoria)”, input `type="file"` con `capture="environment"`, y preview de la imagen.
      - Si `canWritePartido` es `false`:
        - Se muestra un texto informativo: “Vista de solo lectura. No puedes cerrar este partido.”
        - No se muestra el input de foto ni el preview.
  - **Botón de cierre “Cerrar partido y generar acta”**:
    - Antes: se mostraba para cualquier usuario mientras el partido no estuviera cerrado (`!yaCerrado`).
    - Ahora: se muestra **solo** si `canWritePartido && !yaCerrado`.
    - El flujo interno del cierre (runSync, POST `/partidos/:id/cerrar`, actualización en Dexie, navegación a acta) se mantiene sin cambios.
  - **Botón “Ver acta · Folio ...”**:
    - Para partidos ya finalizados con folio se sigue mostrando, independientemente del rol, lo que permite que usuarios de consulta vean el acta.

**Resultado funcional:**  
En `/partido/:id/resumen` todos los usuarios ven marcador y estadísticas por jugador. Solo los roles de escritura (`ROLES_PARTIDO`) pueden cargar la foto y cerrar el partido. Un usuario con rol `consulta` entra a esta ruta en modo lectura (sin inputs ni botones de cierre) tal como define el Bloque 1.

---

### 4. Alcance actual tras ejecutar el Bloque 1

- **Control de acceso por rol**:
  - Rutas sensibles (`/partido/:id/config` y `/partido/:id/captura`) protegidas por un guard que exige rol en `ROLES_PARTIDO` además de sesión válida.
  - `/partido/:id/resumen` permanece accesible para consulta, pero con comportamiento diferenciado.
- **Lista de partidos**:
  - Solo usuarios con permisos de escritura pueden crear nuevos partidos.
  - La navegación desde la lista respeta el rol:
    - Escritura: flujo operativo completo (config, captura, resumen, acta).
    - Consulta: siempre a resumen (para partidos no cerrados) o a acta (para partidos cerrados/default).
- **Resumen de partido**:
  - Vista unificada que sirve tanto de cierre operativo (para anotadores) como de consulta (para usuarios de solo lectura).
  - El cierre con foto solo está disponible para `ROLES_PARTIDO`; para otros se explicita que se trata de una vista de solo lectura.

Con esto, el **Bloque 1** del plan queda implementado en frontend según lo descrito en `13-plan-ejecucion-mvp.md`, sin tocar aún los Bloques 2–6 ni la lógica de backend.

