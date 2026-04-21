# Captura Partidos — Basketball Amateur México

Aplicación **offline-first** para anotación y gestión de estadísticas de basketball amateur en México. Operable por una sola persona en mesa; funciona sin internet y sincroniza cuando hay señal. Se ejecuta como **PWA (React/Vite)** y está lista para empaquetarse con **Capacitor**.

---

## Stack actual (código)

- **Frontend**: Vite + React + TypeScript + Tailwind + Zustand + Dexie (IndexedDB) + PWA (`vite-plugin-pwa`)
- **Backend**: Node.js + Fastify + TypeScript + Prisma + SQLite
- **Auth**: JWT (`Authorization: Bearer <token>`) + RBAC por liga (`MembresiaLiga`)
- **Uploads (dev)**: estáticos desde `backend/uploads` en `/uploads`

> Requisito recomendado: **Node 18+** (Vite 5 requiere Node 18+).

---

## Cómo ejecutar (rápido)

Guía completa en [`DESARROLLO.md`](DESARROLLO.md).

### Backend (API)

```bash
cd backend
cp .env.example .env
npm install
npx prisma db push
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

---

*Documentación y código evolucionan juntos: si hay diferencias, manda el código.*
