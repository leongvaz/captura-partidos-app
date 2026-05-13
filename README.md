# Captura Partidos — Basketball Amateur México

Aplicación **offline-first** para anotación y gestión de estadísticas de basketball amateur en México. Operable por una sola persona en mesa; funciona sin internet y sincroniza cuando hay señal. Hoy el cliente principal es una **PWA (React/Vite)**; el backend expone una **API REST** lista para otros clientes (p. ej. escritorio).

---

## Lenguajes y partes del repositorio

| Área | Lenguaje / runtime | Rol |
|------|-------------------|-----|
| Frontend | **TypeScript** (React, Vite) | PWA de captura, UI, almacenamiento local (Dexie) |
| Backend | **TypeScript** (Node.js, Fastify) | API, auth, reglas de negocio |
| ORM / migraciones | **Prisma** (schema y migraciones en el repo) | Acceso a PostgreSQL |
| Paquetes compartidos | **TypeScript** (`shared`) | Tipos/contratos reutilizables |
| Documentación | **Markdown** (`docs/`, guías) | PRD, modelo de datos, sincronización, etc. |
| Base de datos | **PostgreSQL** (servidor, no “código” del repo) | Fuente de verdad en servidor |

> **Python**: no forma parte del monorepo actual. La [dirección de producto](#dirección-tablets-windows--anotación-python) contempla un cliente de anotación en Python para tablets Windows; cuando exista, este cuadro y el stack se actualizarán.

**Requisito recomendado**: **Node 18+** (Vite 5 requiere Node 18+).

---

## Stack actual (código)

- **Frontend**: Vite + React + TypeScript + Tailwind + Zustand + Dexie (IndexedDB) + PWA (`vite-plugin-pwa`); listo para empaquetarse con **Capacitor** si se despliega como app móvil.
- **Backend**: Node.js + Fastify + TypeScript + Prisma + PostgreSQL
- **Auth**: JWT (`Authorization: Bearer <token>`) + RBAC por liga (`MembresiaLiga`)
- **Uploads (dev)**: estáticos desde `backend/uploads` en `/uploads`

---

## Dirección: tablets Windows + anotación Python (roadmap)

Objetivo operativo: **entregar tablets Windows** a anotadores en gimnasios **sin internet fijo**, con opción de conectar por **WiFi del recinto** o **datos compartidos desde el celular**. En ese escenario se plantea:

1. **Modo quiosco (kiosko)** en Windows para limitar el uso a la aplicación de anotación (p. ej. acceso asignado / políticas + app empaquetada).
2. **Cliente de anotación en Python** (escritorio): trabajo **offline** con partidos y catálogos guardados en **almacenamiento local** (p. ej. SQLite).
3. **Con conexión**: descargar los **partidos programados para el día** (y cambios relevantes) desde la misma API/BD; **subir** anotaciones y eventos en cola con reintentos y reglas de sincronización (alineado con [`docs/03-sincronizacion.md`](docs/03-sincronizacion.md)).

El backend y PostgreSQL pueden seguir siendo la **fuente de verdad**; el cliente Python sería una vía más de consumo de la API, no un reemplazo obligatorio del frontend web en la misma fase.

---

## Cómo ejecutar (rápido)

Guía completa en [`DESARROLLO.md`](DESARROLLO.md).

### Backend (API)

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

API: `http://localhost:3001/api/v1`

### Frontend (PWA)

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173` (proxy a la API en `/api`).

---

## Documentación

| # | Documento | Contenido |
|---|-----------|-----------|
| 0 | [PRD Maestro](docs/00-PRD-maestro.md) | Visión, problema, usuarios, reglas e índice |
| 1 | [Pantallas clave](docs/01-pantallas-clave.md) | Diseño de pantallas (captura, resumen, acta) |
| 2 | [Modelo de datos](docs/02-modelo-datos.md) | Modelo de referencia (fuente real: `backend/prisma/schema.prisma`) |
| 3 | [Sincronización](docs/03-sincronizacion.md) | Offline/online y cola de eventos |
| 4 | [Validaciones](docs/04-validaciones.md) | Validaciones críticas |
| 5 | [Stack y roadmap](docs/05-stack-y-roadmap.md) | Roadmap MVP / Fase 2 / Fase 3 |
| 6 | [Play Store](docs/06-play-store.md) | Consideraciones de publicación |
| 7 | [Especificación técnica](docs/07-especificacion-tecnica.md) | Endpoints actuales y contratos (base `/api/v1`) |
| 8 | [Sprints e historias](docs/08-sprints-y-historias.md) | Historias y sprints |
| 10 | [Estado del proyecto](docs/10-estado-del-proyecto.md) | Qué está listo / qué falta (referencia viva) |

Pendientes fuera del plan MVP: [`pendientes.md`](pendientes.md).

---

## Troubleshooting

### `SyntaxError: Unexpected token '??='` al correr Vite

- Causa: **Node antiguo**.
- Solución: instalar **Node 18+** y reinstalar dependencias.

### 401 `Unauthorized` / “Token inválido” en el frontend

- Causa típica: token emitido por **otro backend** (Render vs local) o token viejo en `localStorage`.
- Solución: cerrar sesión o borrar `localStorage` (`token`, `usuario`, `liga`) y volver a iniciar sesión.

---

## Resumen rápido

- **Problema**: hoy se anota en papel; no hay historial digital ni actas oficiales.
- **Solución**: captura rápida, cierre con folio/acta, historial y sincronización.
- **Evolución**: PWA actual + visión de **tablets Windows en kiosko** con **cliente Python** offline y sync contra la misma API/BD.

---

*Documentación y código evolucionan juntos: si hay diferencias, manda el código.*
