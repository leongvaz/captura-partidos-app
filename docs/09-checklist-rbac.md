# Checklist de pruebas RBAC

Verificación de roles y permisos tras la refactorización RBAC (Usuario global + MembresiaLiga).

---

## Flujo de migración (DB existente)

1. **Backup** de `backend/prisma/dev.db` (o el archivo indicado en `DATABASE_URL`).
2. **Ejecutar migración**:
   ```bash
   cd backend
   npm run db:migrate-rbac
   ```
3. **Regenerar cliente**:
   ```bash
   npx prisma generate
   ```
4. Si el seed falla (clave única), recrear datos:
   ```bash
   rm prisma/dev.db  # opcional: resetear DB
   npx prisma db push
   npm run db:seed
   ```

---

## Casos de prueba

### 1. Superadmin puede todo

- [ ] Usuario con `isSuperAdmin: true` puede:
  - [ ] Login con ligaId + PIN (de cualquier liga donde tenga membresía).
  - [ ] GET /ligas, /equipos, /jugadores, /canchas, /partidos.
  - [ ] POST /partidos, PATCH /partidos/:id.
  - [ ] POST /partidos/:id/plantilla, /eventos, /incidencias, /cerrar.
  - [ ] GET /partidos/:id/acta.
- [ ] JWT incluye `isSuperAdmin: true` y `requireRole` no bloquea.

### 2. admin_liga puede gestionar roster y partidos de su liga

- [ ] Usuario con rol `admin_liga` en liga X puede:
  - [ ] Crear partidos en liga X.
  - [ ] Configurar mesa, capturar eventos, cerrar partido.
  - [ ] Leer equipos, jugadores, canchas de liga X.
- [ ] No puede acceder a datos de otra liga (403 si ligaId ≠ token).

### 3. capturista_roster solo roster (lectura)

- [ ] Usuario con rol `capturista_roster` puede:
  - [ ] GET equipos, jugadores, canchas, partidos, acta.
- [ ] No puede POST/PATCH partidos ni plantilla/eventos/cerrar (403).

### 4. anotador_partido solo partidos (no edita roster)

- [ ] Usuario con rol `anotador_partido` puede:
  - [ ] GET equipos, jugadores, canchas (para config mesa).
  - [ ] Crear partidos, config mesa, captura, cerrar.
  - [ ] GET acta.
- [ ] No puede crear/editar equipos ni jugadores (si existieran endpoints).

### 5. consulta solo lectura

- [ ] Usuario con rol `consulta` puede:
  - [ ] GET ligas, equipos, jugadores, canchas, partidos, acta.
- [ ] No puede POST/PATCH partidos ni plantilla/eventos/cerrar (403).

### 6. Usuario sin membresía → 403

- [ ] Usuario con membresía solo en liga A recibe 403 al:
  - [ ] GET /partidos?ligaId=B (liga B).
  - [ ] GET /partidos/:id donde el partido pertenece a liga B.
- [ ] Mensaje: "No tienes membresía en esta liga" o "No autorizado".

### 7. Login por PIN funciona y emite roles

- [ ] Login con ligaId + PIN devuelve:
  - [ ] JWT con `usuarioId`, `ligaId`, `isSuperAdmin`, `roles[]`.
  - [ ] `usuario.roles` array (ej. `["anotador_partido"]`).
- [ ] Usuario con múltiples roles en la misma liga recibe todos (ej. `["admin_liga", "capturista_roster"]`).

### 8. Validación anotadorId

- [ ] POST /partidos con `anotadorId` de usuario sin membresía activa en la liga → 400.
- [ ] POST /partidos con `anotadorId` de usuario con rol `anotador_partido` o `admin_liga` en la liga → 201.

### 9. Sincronización y eventos siguen funcionando

- [ ] Captura de eventos offline → sync cuando hay red → eventos se guardan en servidor.
- [ ] Cierre con foto → sync → partido finalizado con folio.
- [ ] Token con roles válidos permite todas las operaciones de sync.

---

## Roles MVP

| Rol               | Lectura | Partidos (crear/config/captura/cerrar) | Roster (CRUD) |
|-------------------|---------|----------------------------------------|---------------|
| superadmin        | ✓       | ✓                                       | ✓             |
| admin_liga        | ✓       | ✓                                       | ✓             |
| capturista_roster | ✓       | ✗                                       | ✓ (MVP: solo lectura) |
| anotador_partido  | ✓       | ✓                                       | ✗             |
| consulta          | ✓       | ✗                                       | ✗             |
