# Estado del proyecto — Captura Partidos

Documento de referencia: **qué está listo** y **qué falta** según el PRD y los sprints MVP.  
**Última actualización:** Febrero 2026.

---

## 1. Documentación

| Documento | Estado | Notas |
|-----------|--------|-------|
| [00-PRD-maestro.md](./00-PRD-maestro.md) | ✅ Listo | Visión, problema, usuarios, reglas, índice. |
| [01-pantallas-clave.md](./01-pantallas-clave.md) | ✅ Listo | Diseño de pantallas. |
| [02-modelo-datos.md](./02-modelo-datos.md) | ✅ Listo | Modelo de datos (referencia; implementación puede diferir). |
| [03-sincronizacion.md](./03-sincronizacion.md) | ✅ Listo | Flujo offline/online. |
| [04-validaciones.md](./04-validaciones.md) | ✅ Listo | Validaciones críticas. |
| [05-stack-y-roadmap.md](./05-stack-y-roadmap.md) | ✅ Listo | Stack y roadmap MVP/F2/F3. |
| [06-play-store.md](./06-play-store.md) | ✅ Listo | Consideraciones Play Store. |
| [07-especificacion-tecnica.md](./07-especificacion-tecnica.md) | ⚠️ Parcial | Endpoints y tipos; actualizar con RBAC y MembresiaLiga. |
| [08-sprints-y-historias.md](./08-sprints-y-historias.md) | ✅ Listo | Historias y tareas por sprint. |
| [09-checklist-rbac.md](./09-checklist-rbac.md) | ✅ Listo | Pruebas de roles y migración RBAC. |
| [10-estado-del-proyecto.md](./10-estado-del-proyecto.md) | ✅ Listo | Este documento. |
| README.md | ✅ Listo | Resumen y enlaces a docs. |
| DESARROLLO.md | ✅ Listo | Cómo ejecutar y migración RBAC. |

---

## 2. Backend (API)

### 2.1 Infraestructura

| Elemento | Estado |
|----------|--------|
| Node.js + Fastify + TypeScript | ✅ |
| Prisma + SQLite | ✅ |
| JWT (ligaId + PIN → token) | ✅ |
| Auth middleware (Bearer, payload en request) | ✅ |
| RBAC: Usuario global + MembresiaLiga | ✅ |
| Roles: superadmin, admin_liga, capturista_roster, anotador_partido, consulta | ✅ |
| requireRole en rutas (lectura vs escritura partidos) | ✅ |
| Validación anotadorId con membresía en liga | ✅ |
| Migración RBAC (script `db:migrate-rbac`) | ✅ |
| Seed con liga demo y usuario anotador_partido | ✅ |

### 2.2 Endpoints

| Endpoint | Estado | Protección |
|----------|--------|------------|
| POST /auth/anotador | ✅ | Público |
| GET /ligas, GET /ligas/:id | ✅ | auth + lectura |
| GET /equipos, GET /equipos/:id | ✅ | auth + lectura |
| GET /jugadores, GET /jugadores/:id | ✅ | auth + lectura |
| GET /canchas, GET /canchas/:id | ✅ | auth + lectura |
| GET /partidos | ✅ | auth + lectura |
| GET /partidos/:id | ✅ | auth + lectura |
| POST /partidos | ✅ | auth + escritura partido |
| PATCH /partidos/:id | ✅ | auth + escritura partido |
| GET/POST /partidos/:id/plantilla | ✅ | auth + lectura/escritura según rol |
| GET/POST /partidos/:id/eventos | ✅ | auth + lectura/escritura según rol |
| GET/POST /partidos/:id/incidencias | ✅ | auth + lectura/escritura según rol |
| POST /partidos/:id/cerrar (multipart foto) | ✅ | auth + escritura partido |
| GET /partidos/:id/acta | ✅ | auth + lectura |

### 2.3 Pendiente en backend

- CRUD equipos/jugadores (solo lectura hoy); necesario para Fase 2 y para que capturista_roster/admin_liga gestionen roster.
- Endpoint(s) panel liga: partidos finalizados con filtro incidencias, historial por equipo (W-L, PF, PC).
- Cierre offline: endpoint o flujo que acepte cierre con foto en cola para subir después (hoy el cierre requiere subir foto al momento).
- Actualizar doc 07 con modelo RBAC (JWT con roles, MembresiaLiga, permisos por ruta).

---

## 3. Frontend (PWA)

### 3.1 Infraestructura

| Elemento | Estado |
|----------|--------|
| React + Vite + TypeScript | ✅ |
| Tailwind CSS | ✅ |
| Zustand (auth, partido, sync) | ✅ |
| Dexie (IndexedDB): partidos, plantilla, eventos, equipos, jugadores, canchas, ligas, session | ✅ |
| React Router (login, partidos, config, captura, resumen, acta) | ✅ |
| PWA (vite-plugin-pwa, manifest, Workbox) | ✅ |
| Auth: login ligaId + PIN, token y usuario (con roles) en localStorage | ✅ |
| hasRole() en authStore para UI según rol | ✅ |

### 3.2 Pantallas

| Pantalla | Ruta | Estado | Notas |
|----------|------|--------|-------|
| Login | /login | ✅ | ligaId + PIN; redirección a / |
| Partidos del día | / | ✅ | Lista por fecha; crear partido; enlace a config/captura/resumen/acta |
| Configuración de mesa | /partido/:id/config | ✅ | 5 en cancha por equipo, coach, capitán; validación e iniciar partido |
| Captura | /partido/:id/captura | ✅ | Local/Visitante, dorsales, +2/+3/TL/falta/sustitución, deshacer |
| Resumen | /partido/:id/resumen | ✅ | Marcador, puntos/faltas por jugador, foto obligatoria, cerrar partido |
| Acta | /partido/:id/acta | ✅ | Vista de acta con folio; **falta** exportar PDF y compartir |

### 3.3 Sincronización

| Funcionalidad | Estado |
|---------------|--------|
| Guardar partidos y eventos en IndexedDB (synced flag) | ✅ |
| Botón "Sincronizar" en header | ✅ |
| Estado: Sin conexión / N pendientes / Sincronizando / Sincronizado | ✅ |
| Envío de partidos pendientes y luego eventos por partido | ✅ |
| Cierre con foto: sync previo + POST cerrar con FormData | ✅ |
| Cierre 100% offline (guardar foto en local y cerrar al tener red) | ❌ No implementado |

### 3.4 Pendiente en frontend

- **Acta:** botón Exportar PDF y Compartir (Web Share API / WhatsApp).
- **Captura:** alerta explícita para 5.ª falta (“debe salir”); alerta y registro de incidencia en expulsión (2 antideportivas / 2 técnicas).
- **Partidos del día:** flujo "Registrar default" (modal/botón: equipo que no presenta 5 → estado default_local/default_visitante + incidencia).
- **Panel liga / Historial:** vista con partidos finalizados, filtro por incidencias, y por equipo (partidos jugados, W-L, PF, PC).
- **Ocultar/mostrar por rol:** deshabilitar o ocultar "Crear partido" y captura/cierre para rol solo **consulta** (usar `hasRole`).
- **Selección de liga:** si el usuario tiene varias ligas, pantalla o selector de liga al iniciar (opcional para MVP).

---

## 4. Por epic / sprint (MVP)

### Epic 1: Autenticación y contexto de liga

| Historia / Tarea | Estado |
|------------------|--------|
| U1.1 Login liga + PIN | ✅ |
| U1.2 Sesión guardada localmente | ✅ |
| U1.3 Indicador online/offline y estado de sync | ✅ |

### Epic 2: Partidos del día e inicio de partido

| Historia / Tarea | Estado |
|------------------|--------|
| U2.1 Listado partidos del día por liga y fecha | ✅ |
| U2.2 Iniciar solo con 5 jugadores en cancha | ✅ |
| U2.3 Coach y capitán (capitán en cancha) | ✅ |
| U2.4 Registrar partido por default | ❌ Falta UI y flujo completo |

### Epic 3: Captura rápida

| Historia / Tarea | Estado |
|------------------|--------|
| U3.1 Jugadores en cancha con dorsal, selección por tap | ✅ |
| U3.2 +2, +3, TL, falta, sustitución | ✅ |
| U3.3 Deshacer último evento | ✅ |
| U3.4 Alertas 4 y 5 faltas | ⚠️ Parcial (alerta a partir de 4 faltas; falta mensaje específico 5.ª y bloqueo opcional) |
| U3.5 Alerta expulsión (2 antideportivas/2 técnicas) e incidencia | ❌ Falta |

### Epic 4: Cierre y acta

| Historia / Tarea | Estado |
|------------------|--------|
| U4.1 Cierre con foto obligatoria del marcador | ✅ |
| U4.2 Ver acta y exportar/compartir | ⚠️ Ver acta ✅; exportar PDF y compartir ❌ |
| U4.3 Folio único y compartir | ⚠️ Folio visible ✅; compartir enlace/acta ❌ |

### Epic 5: Sincronización

| Historia / Tarea | Estado |
|------------------|--------|
| U5.1 Eventos guardados en dispositivo (IndexedDB) | ✅ |
| U5.2 Envío automático al haber conexión | ✅ (runSync al cargar y botón) |
| U5.3 Botón "Sincronizar ahora" | ✅ |
| U5.4 Ver cuántos eventos/partidos pendientes | ✅ |

### Epic 6: Panel liga (MVP básico)

| Historia / Tarea | Estado |
|------------------|--------|
| U6.1 Listado partidos finalizados y filtro incidencias | ❌ Falta vista dedicada |
| U6.2 Historial por equipo (W-L, PF, PC) | ❌ Falta |

### Sprint 3 — PWA y cierre offline

| Tarea | Estado |
|-------|--------|
| 3.10 PWA instalable y offline básico | ✅ (manifest + Workbox) |
| 3.3 Cierre offline (foto en local, subir al sincronizar) | ❌ Falta |

---

## 5. Resumen ejecutivo

### Listo

- **Documentación:** PRD, pantallas, modelo, sincronización, validaciones, stack/roadmap, Play Store, sprints/historias, checklist RBAC y estado del proyecto.
- **Backend:** API REST con auth JWT, RBAC (Usuario global + MembresiaLiga), roles por liga, migración de datos, CRUD de partidos/plantilla/eventos/incidencias, cierre con foto y folio, acta.
- **Frontend:** Login, partidos del día, crear partido, configuración de mesa (5 en cancha, capitán, coach), captura (eventos + deshacer), resumen y cierre con foto, vista de acta, sincronización con indicador y botón, PWA básica, tipos y store con soporte de roles.

### Falta (MVP)

1. **Registrar default:** UI y flujo para marcar partido perdido por no presentación.
2. **Alertas completas:** 5.ª falta (“debe salir”) y expulsión (2 antideportivas/2 técnicas) con incidencia.
3. **Acta:** exportar PDF y compartir (WhatsApp / Web Share).
4. **Panel liga:** vista partidos finalizados, filtro incidencias, historial por equipo (W-L, PF, PC).
5. **Cierre offline:** guardar foto en local y enviar al tener red sin perder cierre.
6. **UX por rol:** ocultar/deshabilitar acciones para rol **consulta**.
7. **Doc 07:** alinear con RBAC y nuevos endpoints/modelos.

### No iniciado (Fase 2 y 3)

- Jugador invitado con validación en servidor.
- CRUD equipos/jugadores desde app.
- Pagos (inscripción, adeudos, regla 5to partido).
- Perfil jugador y rankings (top scorers, triples).
- Audit log y bloqueo de partido cerrado.
- Rol de juegos, playoffs, premios/menciones.
- Notificaciones push (opcional).
- Empaquetado Capacitor y publicación en Play Store (doc 06 como guía).

---

*Para ejecutar el proyecto y migrar RBAC en DB existente, ver [DESARROLLO.md](../DESARROLLO.md) y [09-checklist-rbac.md](./09-checklist-rbac.md).*
