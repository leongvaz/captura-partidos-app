# Estado del proyecto — Captura Partidos

Documento de referencia: **qué está listo** y **qué falta** según el PRD y los sprints MVP.  
**Última actualización:** Abril 2026.

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
| [07-especificacion-tecnica.md](./07-especificacion-tecnica.md) | ✅ Listo | Endpoints actuales y fuente de verdad (routes + Prisma schema). |
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
| Prisma + PostgreSQL | ✅ |
| JWT (ligaId + PIN → token) | ✅ |
| Auth middleware (Bearer, payload en request) | ✅ |
| RBAC: Usuario global + MembresiaLiga | ✅ |
| Roles: superadmin, admin_liga, capturista_roster, anotador_partido, consulta | ✅ |
| requireRole en rutas (lectura vs escritura partidos) | ✅ |
| Validación anotadorId con membresía en liga | ✅ |
| Migración RBAC (script `db:migrate-rbac`) | ✅ |
| Seed con liga demo y usuario anotador_partido | ✅ |
| Registro web: organizador y capitán (email/password) | ✅ |
| Uploads locales en `/uploads` (dev) | ✅ |

### 2.2 Endpoints

| Endpoint | Estado | Protección |
|----------|--------|------------|
| POST /auth/anotador | ✅ | Público |
| POST /auth/login-email | ✅ | Público |
| POST /auth/organizador/registro | ✅ | Público |
| POST /auth/registro-capitan | ✅ | Público |
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
| POST /partidos/:id/registrar-default | ✅ | auth + escritura partido |
| POST /partidos/:id/cerrar (foto opcional) | ✅ | auth + escritura partido |
| GET /partidos/:id/acta | ✅ | auth + lectura |
| GET /partidos/:id/acta/pdf | ✅ | auth + lectura |
| GET /liga/panel | ✅ | auth + lectura |
| GET /liga/equipos-estadisticas | ✅ | auth + lectura |
| GET/PUT /liga/reglas | ✅ | auth + admin_liga (lectura/escritura) |
| POST /equipos/registro-capitan, GET /equipos/mis | ✅ | auth + capturista_roster |
| PUT/DELETE /equipos/:id | ✅ | auth + admin_liga |
| POST/PUT/DELETE /jugadores | ✅ | auth + admin_liga/capturista_roster (según operación) |
| GET/POST/PATCH /sedes | ✅ | auth + admin_liga |
| GET/POST/PATCH /canchas | ✅ | auth + admin_liga |

### 2.3 Pendiente en backend

- Gestión de **membresías/roles** (invitar anotadores/capitanes/ayudantes, activar/desactivar) desde UI/endpoints sin depender de seed o secretos de desarrollo.
- Regla de cierre por empate: si el marcador final es empate, no permitir cerrar y forzar tiempos extra (ya aplicado).
- Storage real para fotos (S3/R2/etc.). Hoy en dev se sirve desde `/uploads`.

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
| Captura | /partido/:id/captura | ✅ | Local/Visitante, dorsales, +2/+3/TL, falta (Normal/Técnica/Antideportiva), expulsado no seleccionable + modal, deshacer |
| Resumen | /partido/:id/resumen | ✅ | Marcador, puntos/faltas personales (F máx. 5), Ganador: [nombre equipo]; carga partido desde API si no en Dexie; Hooks en orden fijo (consulta puede abrir sin error) |
| Acta | /partido/:id/acta | ✅ | Vista de acta con folio; exportar PDF y compartir (Web Share API con fallback). |

### 3.3 Sincronización

| Funcionalidad | Estado |
|---------------|--------|
| Guardar partidos y eventos en IndexedDB (synced flag) | ✅ |
| Botón "Sincronizar" en header | ✅ |
| Estado: Sin conexión / N pendientes / Sincronizando / Sincronizado | ✅ |
| Envío de partidos pendientes y luego eventos por partido | ✅ |
| Cierre con foto: sync previo + POST cerrar con FormData | ✅ |
| Cierre 100% offline (cola de cierres; foto opcional) | ✅ |

### 3.4 Pendiente en frontend

- **Acta:** ✅ exportar PDF y compartir (Web Share API con fallback).
- **Captura:** ✅ Falta con 3 opciones (Normal, Técnica, Antideportiva). Jugador expulsado no seleccionable; modal; bloqueo +2/+3/TL y faltas. Incidencia al expulsar. (Antes: alerta explícita para 5.ª falta (“debe salir”); alerta y registro de incidencia en expulsión (2 antideportivas / 2 técnicas).
- **Cronómetro:** ✅ Persistente (puede seguir corriendo tras recarga), tiempos extra OT (5 min) y alarmas sonoras a 10s y 0:00; auto-advance Q1→Q4 en pausa y OT→OT solo si sigue empate.
- **Partidos del día:** flujo "Registrar default" ✅ (modal, elegir ganador, motivo; estado default_local/default_visitante + incidencia; lista y acta muestran "Ganador por default: Local/Visitante").
- **Panel liga / Historial:** ✅ vista con partidos finalizados/default, filtro por incidencias, y por equipo (PJ, PG, PP, PF, PC, DIF).
- **Editar / eliminar partidos:** no implementado; añadido al backlog (solo partidos en estado programado o en_curso; eliminar con confirmación).
- **Ocultar/mostrar por rol:** deshabilitar o ocultar "Crear partido" y captura/cierre para rol solo **consulta** (usar `hasRole`). (Si ya está aplicado, revisar que todas las rutas sensibles lo respeten.)
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
| U2.4 Registrar partido por default | ✅ |

### Epic 3: Captura rápida

| Historia / Tarea | Estado |
|------------------|--------|
| U3.1 Jugadores en cancha con dorsal, selección por tap | ✅ |
| U3.2 +2, +3, TL, falta, sustitución | ✅ |
| U3.3 Deshacer último evento | ✅ |
| U3.4 Alertas 4 y 5 faltas | ✅ (alerta 4 y 5; jugador expulsado bloqueado para nuevos eventos; modal) |
| U3.5 Alerta expulsión (2 antideportivas/2 técnicas) e incidencia | ✅ (3 tipos de falta; incidencia en Dexie al expulsar) |

### Epic 4: Cierre y acta

| Historia / Tarea | Estado |
|------------------|--------|
| U4.1 Cierre (foto opcional) | ✅ |
| U4.2 Ver acta y exportar/compartir | ✅ |
| U4.3 Folio único y compartir | ✅ |

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
| U6.1 Listado partidos finalizados y filtro incidencias | ✅ |
| U6.2 Historial por equipo (W-L, PF, PC) | ✅ |

### Sprint 3 — PWA y cierre offline

| Tarea | Estado |
|-------|--------|
| 3.10 PWA instalable y offline básico | ✅ (manifest + Workbox) |
| 3.3 Cierre offline (foto opcional en local, subir al sincronizar) | ✅ |

---

## 5. Resumen ejecutivo

### Listo

- **Documentación:** PRD, pantallas, modelo, sincronización, validaciones, stack/roadmap, Play Store, sprints/historias, checklist RBAC y estado del proyecto.
- **Backend:** API REST con auth JWT, RBAC (Usuario global + MembresiaLiga), roles por liga, migración de datos, CRUD de partidos/plantilla/eventos/incidencias, cierre con foto y folio, acta.
- **Frontend:** Login, partidos del día, crear partido, configuración de mesa (5 en cancha, capitán, coach), captura (eventos + deshacer), resumen y cierre con foto, vista de acta, sincronización con indicador y botón, PWA básica, tipos y store con soporte de roles.

### Falta (MVP)

1. ~~**Registrar default**~~ ✅ Hecho.
2. ~~**Alertas y tipos de falta**~~ ✅ Hecho (3 tipos; expulsado bloqueado + modal; incidencia). Antes: 5.ª falta (“debe salir”) y expulsión (2 antideportivas/2 técnicas) con incidencia.
3. ~~**Acta:** exportar PDF y compartir (WhatsApp / Web Share).~~ ✅ Hecho.
4. ~~**Panel liga:** vista partidos finalizados, filtro incidencias, historial por equipo (W-L, PF, PC).~~ ✅ Hecho.
5. ~~**Cierre offline:** guardar foto en local y enviar al tener red sin perder cierre.~~ ✅ Hecho.
6. **Empates:** tiempos extra (OT de 5 min) hasta romper empate antes de cerrar. ✅ Backend/Resumen/Cronómetro soportan OT.
7. ~~**UX por rol**~~ ✅ Hecho (consulta sin crear/editar; botón atrás en header).
8. ~~**Carga partido desde API**~~ ✅ Hecho (Captura/Resumen cargan desde API si no en Dexie).
9. **Editar / eliminar partidos:** en backlog (solo programado/en_curso; con confirmación).
10. **Docs**: mantener `docs/10` y `docs/07` sincronizados con cambios de endpoints/modelo.

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

*Pendientes no contemplados en bloques actuales: ver [pendientes.md](../pendientes.md) en la raíz del proyecto.*
