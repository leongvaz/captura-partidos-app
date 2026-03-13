# 5. Recomendación tecnológica y roadmap

Recomendación concreta de stack para PWA offline-first, empaquetado futuro con Capacitor y publicación en Play Store. Roadmap en tres fases: MVP, Fase 2 y Fase 3 (rol de juegos, playoffs, premios).

---

## 5.1 Recomendación tecnológica

### Frontend (PWA / app móvil)

| Capa | Tecnología recomendada | Motivo |
|------|------------------------|--------|
| **Framework** | **React** (o **Vite + React**) | Ecosistema maduro, buen soporte PWA, fácil empaquetado con Capacitor. Alternativa: Vue 3 + Vite. |
| **UI / componentes** | **Tailwind CSS** + componentes mínimos (o **shadcn/ui** si se quiere consistencia rápida) | Rápido, adaptable a móvil, buen contraste para uso en cancha. |
| **Estado global** | **Zustand** o **React Context + useReducer** | Ligero; suficiente para partido en curso, plantilla, eventos y estado de sync. |
| **Offline / persistencia** | **IndexedDB** vía **Dexie.js** o **idb** | Dexie simplifica esquemas y consultas; idb es wrapper mínimo. Ambos funcionan en PWA y en Capacitor. |
| **Sincronización** | Cola propia (ver doc 03) + **fetch** con reintentos; opcional **Workbox** para background sync | Control explícito del orden de eventos; Workbox permite reintentos en segundo plano. |
| **Routing** | **React Router** (v6) | Rutas para: login, partidos del día, configuración mesa, captura, resumen, acta, historial. |
| **Formularios** | **React Hook Form** + validación (Zod o Yup) | Menos re-renders; validaciones alineadas con doc 04. |
| **PWA** | **Vite PWA** (vite-plugin-pwa) | Service worker, precache, manifest; configurable para offline-first. |
| **Empaquetado Android** | **Capacitor** (recomendado sobre Cordova) | Mantenido por Ionic; mejor integración con cámara, storage y notificaciones; mismo código base que PWA. |

### Backend (API REST)

| Capa | Tecnología recomendada | Motivo |
|------|------------------------|--------|
| **Runtime** | **Node.js** (LTS) | Mismo lenguaje que frontend; despliegue sencillo. |
| **Framework API** | **Fastify** o **Express** | Fastify: rápido, tipado; Express: más documentación. |
| **Base de datos** | **PostgreSQL** (o **SQLite** para MVP muy pequeño) | PostgreSQL: relaciones, JSON, buen soporte para actas y audit; SQLite si se prioriza simplicidad inicial. |
| **ORM / consultas** | **Drizzle** o **Prisma** | Drizzle: ligero, SQL-like; Prisma: migraciones y DX muy buenas. |
| **Autenticación** | Sesión por **ligaId + PIN** (hash con bcrypt); token JWT opcional para API | Simple; no requiere OAuth en MVP. |
| **Almacenamiento fotos** | **S3-compatible** (AWS S3, MinIO, Cloudflare R2) o disco local con path configurable | Fotos de marcador; URL en partido. |
| **Hosting** | **Railway**, **Render**, **Fly.io** o VPS | API + PostgreSQL; variables de entorno para DB y storage. |

### Herramientas

- **TypeScript** en frontend y backend.
- **ESLint** + **Prettier** para estilo.
- **Vitest** (frontend) y **Node test** o **Jest** (backend) para pruebas unitarias e integración.
- **Git** + **GitHub/GitLab**; CI básico (lint, test, build).

---

## 5.2 Roadmap

### MVP (Fase 1) — “Anotar y cerrar con acta”

**Objetivo:** Una persona en mesa puede anotar un partido offline, cerrar con foto del marcador y obtener acta con folio. Ligas pueden ver partidos e incidencias básicas.

**Alcance:**

- Login anotador (liga + PIN).
- Listado de partidos del día (programados); filtro por categoría/cancha (opcional).
- Configuración de mesa: equipos, jugadores en cancha (5), coach y capitán; validación 5 jugadores y capitán en cancha.
- Captura rápida: eventos +2, +3, TL (anotado/fallado), falta, sustitución; minuto aproximado; alertas 4/5 faltas y expulsión; deshacer último evento.
- Cierre: foto obligatoria del marcador; generación de folio; acta exportable (PDF o imagen) con marcador, puntos/faltas por jugador, categoría, cancha, fecha, folio, nombre anotador.
- Sincronización: guardar todo en IndexedDB; cola de eventos; subida cuando hay red; estado visual (pendiente / sincronizado).
- Panel liga (básico): partidos finalizados, incidencias (default, expulsiones), historial por equipo (partidos, W/L, puntos a favor/en contra).
- Validaciones críticas: 5 jugadores, capitán en cancha, 5 faltas, 2 antideportivas/2 técnicas, foto para cerrar (ver doc 04).

**No en MVP:** Jugador invitado con validación online; pagos; rankings; comparador jugador; audit log completo (se puede dejar solo registro básico de cierre).

**Duración orientativa:** 8–12 semanas (1 dev full stack).

---

### Fase 2 — “Ligas y jugadores”

**Objetivo:** Ligas administran equipos, categorías y pagos; jugadores ven su perfil y rankings; anotadores tienen validación de invitados.

**Alcance:**

- CRUD equipos y jugadores por liga; categorías y canchas.
- Jugador invitado: flujo con validación en servidor (no otro equipo conflicto, mismo horario, no doble partido ese día); aviso en app si se agrega invitado offline.
- Administración de pagos: inscripción por equipo; regla “pagar antes del 5to partido”; marcar equipos con adeudo; listado de pagos.
- Panel de incidencias: partidos por default, expulsiones, protestas (flag manual); historial.
- Perfil jugador: puntos por partido, promedio, triples por partido, promedio de faltas.
- Rankings: top scorers por categoría; top triples por categoría.
- Comparador: últimos 5 partidos del jugador; evolución simple (tabla o mini gráfica).
- Sanciones automáticas: 5 faltas → fuera del partido (ya en MVP); expulsión → registro histórico; suspensión por acumulación (opcional/configurable).
- Audit log: correcciones realizadas; quién, cuándo, motivo; bloqueo del partido cerrado con correcciones justificadas.
- Mejoras UX: fotos opcionales por cuarto; QR o enlace del acta para compartir por WhatsApp.

**Duración orientativa:** 6–8 semanas tras MVP.

---

### Fase 3 — “Rol de juegos, playoffs, premios”

**Objetivo:** Calendario completo, playoffs y reconocimiento (premios, menciones).

**Alcance:**

- Rol de juegos: generación de calendario por categoría; fechas y horarios; asignación de canchas.
- Playoffs: bracket; partidos de eliminatoria; integración con actas y folios.
- Premios y menciones: MVP del partido (opcional); mejor anotador de la temporada; integración con rankings.
- Reportes para organizadores: resumen por fecha, por categoría, incidencias acumuladas.
- Opcional: notificaciones push (resultados, recordatorios) vía Capacitor/FCM.

**Duración orientativa:** 6–10 semanas tras Fase 2.

---

## 5.3 Resumen del stack recomendado

| Componente | Recomendación |
|------------|----------------|
| **Frontend** | React + Vite + TypeScript + Tailwind + Dexie (IndexedDB) + React Router + React Hook Form |
| **PWA** | vite-plugin-pwa (Workbox); offline-first |
| **Empaquetado Android** | Capacitor |
| **Backend** | Node.js + Fastify (o Express) + TypeScript + PostgreSQL + Drizzle/Prisma |
| **Auth** | Liga + PIN (hash bcrypt); JWT opcional |
| **Fotos** | S3-compatible o disco local; URL en partido |
| **Hosting API** | Railway / Render / Fly.io o VPS |

Con este stack se cumple: **PWA inicial**, **offline-first**, **arquitectura lista para Capacitor** y **publicación en Play Store**, sin matar el MVP y con camino claro para Fase 2 y Fase 3.
