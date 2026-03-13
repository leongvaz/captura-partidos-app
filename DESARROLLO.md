# Cómo ejecutar el desarrollo

## Requisitos

- Node.js 18+
- npm o pnpm

## Backend (API)

### Instalación limpia

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

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

La API quedará en **http://localhost:3001**.

- **Seed:** Liga demo `00000000-0000-0000-0000-000000000001`, usuario anotador con **PIN 1234**, rol `anotador_partido`.

## Frontend (PWA)

```bash
cd frontend
npm install
npm run dev
```

La app quedará en **http://localhost:5173** con proxy a la API en `/api`.

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
