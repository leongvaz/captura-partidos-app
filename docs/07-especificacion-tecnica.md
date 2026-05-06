# 7. Especificación técnica (proyecto actual)

Esta especificación describe **el API que existe hoy** y las bases del contrato entre frontend y backend.

Si hay diferencias, la fuente de verdad es:

- `backend/src/routes/*` (rutas y validaciones)
- `backend/prisma/schema.prisma` (modelo de datos)

---

## 7.1 Base URL y autenticación

- **Base URL (dev)**: `http://localhost:3001/api/v1`
- **Base URL (frontend dev)**: el frontend usa `/api/v1/*` y Vite hace proxy a `127.0.0.1:3001`.
- **Auth**: `Authorization: Bearer <token>` (JWT).

El JWT incluye `ligaId`, `usuarioId`, `roles[]` e `isSuperAdmin`. La autorización es por:

- **membresía en liga** (`MembresiaLiga.activo`)
- **rol** (RBAC) por ruta

Roles usados hoy: `admin_liga`, `capturista_roster`, `anotador_partido`, `consulta` (+ `isSuperAdmin`).

---

## 7.2 Endpoints (resumen)

> Prefijo común: `/api/v1`

### Auth

- `POST /auth/anotador` (ligaId + pin)
- `POST /auth/login-email` (email + passwordOrPin)
- `POST /auth/organizador/registro` (registro directo de organizador por liga; flujo “sencillo”)
- `POST /auth/registro-capitan` (registro de capitán/capturista de roster)
- `POST /auth/invitaciones` (DEV: requiere `SEED_INVITE_SECRET`)
- `POST /auth/invitaciones/:token/registro` (registro mediante invitación; hoy tipo `organizador`)

### Ligas / reglas / panel

- `GET /ligas`
- `GET /liga/public-info?ligaId=...`
- `GET /liga/reglas?ligaId=...`
- `PUT /liga/reglas`
- `GET /liga/panel`
- `GET /liga/equipos-estadisticas`

### Equipos

- `GET /equipos?ligaId=...`
- `GET /equipos/:id`
- `POST /equipos/registro-capitan`
- `GET /equipos/mis`
- `PUT /equipos/:id` (admin)
- `DELETE /equipos/:id` (admin, baja lógica)
- `GET /admin/equipos/:equipoId` (solo superadmin)

### Jugadores

- `GET /jugadores?equipoId=...`
- `POST /jugadores`
- `PUT /jugadores/:id`
- `DELETE /jugadores/:id` (baja lógica)

### Sedes / canchas

- `GET /sedes?ligaId=...`
- `POST /sedes`
- `PATCH /sedes/:sedeId`
- `GET /canchas?ligaId=...`
- `POST /canchas`
- `PATCH /canchas/:canchaId`

### Partidos / captura / acta

- `GET /partidos?ligaId=...&fecha=YYYY-MM-DD`
- `GET /partidos/:id`
- `POST /partidos`
- `PATCH /partidos/:id`
- `POST /partidos/:id/registrar-default`
- `GET /partidos/:id/plantilla`
- `POST /partidos/:id/plantilla`
- `GET /partidos/:id/eventos`
- `POST /partidos/:id/eventos`
- `GET /partidos/:id/incidencias`
- `POST /partidos/:id/incidencias`
- `POST /partidos/:id/cerrar` (foto opcional; soporta idempotencia de cierre con `X-Client-Closure-Id`)
- `GET /partidos/:id/acta`
- `GET /partidos/:id/acta/pdf`

### Personas (superadmin)

- `GET /admin/personas/historial?curp=...`

---

## 7.3 Modelo de datos

En dev se usa **PostgreSQL** vía Prisma (ver `backend/.env.example`).

- Modelo: `backend/prisma/schema.prisma`
- La conexión se define en `DATABASE_URL` (PostgreSQL).

---

## 7.4 Códigos HTTP y formato de error

- **200** OK con body.
- **204** OK sin body.
- **400** Validación. Body típico: `{ code: string, message: string }`.
- **401** Token faltante o inválido.
- **403** No autorizado por rol o liga.
- **404** Recurso no existe.
- **409** Conflicto (duplicados / restricciones de negocio).

