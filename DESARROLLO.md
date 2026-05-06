# Cómo ejecutar el desarrollo

## Requisitos

- Node.js **18+** (Vite 5 requiere Node 18+)
- npm (o pnpm/yarn)

## Backend (API)

La base de datos es **PostgreSQL** (local o gestionada, p. ej. Render PostgreSQL). Define `DATABASE_URL` en `backend/.env` (ver `backend/.env.example`).

### Instalación limpia

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

La API queda en `http://localhost:3001/api/v1`.

### Migración RBAC (si ya tenías DB con Usuario.ligaId)

1. **Backup** de `prisma/dev.db` (o el archivo en `DATABASE_URL`).
2. Ejecutar migración:
   ```bash
   npm run db:migrate-rbac
   ```
3. Regenerar cliente:
   ```bash
   npx prisma generate
   ```
4. Reiniciar el servidor.

- **Seed:** Liga demo `00000000-0000-0000-0000-000000000001`, usuario anotador con **PIN 1234**, rol `anotador_partido`.

## Frontend (PWA)

```bash
cd frontend
npm install
npm run dev
```

La app quedará en **http://localhost:5173** con proxy a la API en `/api`.

## Notas para Windows (PowerShell)

### Reinstalación limpia de dependencias

En `frontend` o `backend` (según aplique):

```powershell
Remove-Item -Recurse -Force .\node_modules -ErrorAction SilentlyContinue
Remove-Item -Force .\package-lock.json -ErrorAction SilentlyContinue
npm install
```

### Error 401 / “Token inválido” en dev

Si te logueaste contra un backend distinto (p. ej. Render) y luego cambiaste a backend local (proxy a `127.0.0.1:3001`), el token puede fallar por `JWT_SECRET` distinto.

- Solución rápida: borrar `localStorage` (`token`, `usuario`, `liga`) y volver a iniciar sesión.

## Uso rápido

1. Iniciar backend y frontend.
2. Abrir http://localhost:5173.
3. Login: **ID de Liga** `00000000-0000-0000-0000-000000000001`, **PIN** `1234`.
4. Crear un partido del día → Configurar mesa (5 en cancha por equipo, capitán y coach) → Iniciar partido.
5. Captura: elegir equipo (Local/Visitante), tocar dorsal, luego +2, +3, TL, Falta.
6. Ir a Resumen → Subir foto del marcador → Cerrar partido → Ver acta.

## Estructura

- **backend:** Fastify, Prisma (SQLite), auth JWT, partidos, plantilla, eventos, cerrar con foto, acta.
- **frontend:** Vite + React, Tailwind, Zustand, Dexie (IndexedDB), PWA. Pantallas: Login, Partidos, Config Mesa, Captura, Resumen, Acta.
- **Sincronización:** Eventos y partidos se guardan en local; al haber red se envían a la API (botón "Sincronizar" en header).
