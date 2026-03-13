# 11. Propuesta MVP + Android — Principal Engineer + PM + Arquitecto

**Documento:** Decisión técnica final, arquitectura, backlog priorizado, diseño detallado y plan de implementación para terminar el MVP y dejarlo listo para Android.

---

## A. Decisión técnica final recomendada

### Stack que se reafirma

| Capa | Decisión | Razón |
|------|----------|--------|
| **Frontend** | React + Vite + TypeScript + Tailwind + Zustand | Ya montado; PWA y camino a Capacitor sin reescritura. |
| **Offline** | Dexie / IndexedDB | Fuente operativa en cancha; no cambiar a SQLite en cliente por ahora. |
| **Backend** | Fastify + Prisma + TypeScript | API REST suficiente; un solo anotador elimina necesidad de tiempo real. |
| **Auth** | JWT + RBAC por liga (Usuario + MembresiaLiga) | Ya implementado; roles claros por pantalla y endpoint. |
| **Event log** | Eventos por partido con `id` cliente, `orden`, `synced` | Idempotencia por `id`; sin WebSockets en MVP. |
| **Android** | Capacitor (Camera, Filesystem, Share) | Sobre el mismo build web; plugins solo donde haga falta. |
| **BD producción** | PostgreSQL (desarrollo: SQLite) | Prisma con `provider` y URL; migración con cuidado a tipos. |

### Lo que NO se hace

- **Flutter / React Native:** No reescritura; se mantiene web + Capacitor.
- **Firebase como núcleo:** No; backend propio con Fastify.
- **WebSockets en MVP:** No; sync por polling/colas y POST idempotentes.
- **Edición simultánea multiusuario:** No; un anotador por partido.
- **Cronómetro FIBA complejo:** No; período + tiempo manual opcional en eventos.
- **Sobreingeniería enterprise:** Backlog acotado a liga amateur y monetización realista.

### Riesgos asumidos y mitigación

1. **SQLite en backend:** Limitaciones de tipos y concurrencia. Mitigación: esquema y queries pensados para PostgreSQL; migración con script y pruebas.
2. **Cierre offline con foto:** Complejidad de cola (foto + cierre). Mitigación: `clientClosureId` + foto en IndexedDB o Capacitor Filesystem; endpoint cerrar idempotente.
3. **PDF en navegador:** Limitaciones de algunas plataformas. Mitigación: Web Share API primero; fallback descarga; en Android Capacitor Share.

---

## B. Qué cambios hacer sobre el proyecto actual

### Conservar sin tocar

- Estructura de carpetas actual backend y frontend.
- Login liga + PIN y JWT con `ligaId`, `roles`, `isSuperAdmin`.
- RBAC: `ROLES_LECTURA_ROSTER`, `ROLES_PARTIDO`, `requireRole`, `ensureMembership`.
- CRUD partidos, plantilla, eventos, incidencias y cierre con foto (multipart).
- Endpoint GET acta (JSON).
- Dexie: tablas partidos, plantilla, eventos, incidencias, session, ligas, equipos, jugadores, canchas.
- Stores: authStore (`hasRole`), partidoStore (eventos, deshacer), syncStore (runSync, pendingPartidos/Eventos).
- Pantallas: Login, PartidosList, ConfigMesa, Captura, Resumen, Acta.
- PWA (vite-plugin-pwa, Workbox).

### Ajustar (cambios concretos)

- **Partido:** Aceptar `estado` `default_local` / `default_visitante` en PATCH; validar en cerrar que partidos default no exijan foto ni eventos.
- **Evento (Prisma y cliente):** Añadir `jugadorNombreSnapshot`, `dorsalSnapshot` (opcionales), `tiempoManual` (nullable); en SQLite como String/Int; preparar para PostgreSQL.
- **Evento idempotencia:** Ya se usa `id` cliente; documentar como `clientEventId`; opcional `@@unique` en Prisma si el provider lo permite.
- **Cierre:** Endpoint aceptar `clientClosureId` y body con `fotoMarcadorUrl` (tras subir foto por separado) o multipart; idempotencia por `clientClosureId` si se reenvía.
- **SyncStore:** Incluir cola de “cierres pendientes” (partidoId + foto local/key + clientClosureId); al tener red: subir foto → POST cerrar → marcar partido synced.
- **Acta:** Soporte en backend para partido default (marcador configurable, ej. 20-0); frontend: botón Exportar PDF y Compartir (Web Share / Capacitor).
- **RBAC consulta:** En frontend ocultar/deshabilitar crear partido, config, captura, cerrar; en backend ya está con `ROLES_PARTIDO` (consulta no está en ROLES_PARTIDO).
- **Panel liga:** Nueva ruta/vista (ej. `/liga` o `/panel`) con partidos finalizados, filtro incidencias, tabla por equipo (PJ, PG, PP, PF, PC, DIF).

### Añadir (nuevo)

- Flujo **Registrar default:** pantalla/modal desde partidos del día o desde config; elegir ganador (local/visitante); motivo; resultado por defecto 20-0 (configurable); incidencia automática; estado default_local/default_visitante.
- **Alertas disciplinarias:** 5.ª falta “debe salir” (mensaje + opcional bloqueo hasta sustitución); expulsión 2 antideportivas/2 técnicas con incidencia automática y alerta si el jugador sigue en cancha.
- **Cierre offline real:** Guardar foto en IndexedDB (blob) o en Capacitor Filesystem; cerrar local (estado finalizado en local, folio pendiente); cola de cierre; al sync: subir foto → POST cerrar con clientClosureId → actualizar folio.
- **Acta PDF:** Generación en backend (ej. PDFKit o similar) o en frontend (jsPDF + html2canvas); folio, datos partido, marcador, incidencias, default si aplica; opción compartir (Web Share / Capacitor Share).
- **Panel liga MVP:** Vista partidos finalizados, filtro por incidencias, por equipo; métricas PJ, PG, PP, PF, PC, DIF.
- **Rutas protegidas por rol:** Componente o guard que redirige a consulta si intenta acceder a config/captura/cerrar; ocultar botones Crear partido, Config, Captura, Cerrar para rol consulta.
- **Capacitor:** Proyecto Android; plugins Camera, Filesystem, Share; build web → cap copy; rutas y assets correctos.

---

## C. Backlog priorizado

### MVP obligatorio (para “terminar” MVP y uso en cancha)

1. **Registrar default / no presentación** — Flujo completo: botón/acción, elegir ganador, motivo, resultado 20-0, incidencia, estado default_*; acta y listado.
2. **Alertas disciplinarias completas** — 5.ª falta “debe salir”; expulsión 2 antideportivas/2 técnicas con incidencia; alerta si expulsado sigue en cancha; configurable (solo alerta vs bloqueo).
3. **Acta: exportar PDF y compartir** — PDF con folio, partido, marcador, incidencias, default; Web Share API; fallback descarga; preparado para Capacitor Share.
4. **Cierre offline real con foto** — Foto local (IndexedDB o Filesystem); cierre local sin red; cola de cierre; sync: subir foto + cerrar idempotente; reintentos.
5. **Panel de liga MVP** — Partidos finalizados, filtro incidencias, historial por equipo (PJ, PG, PP, PF, PC, DIF).
6. **UX por rol consulta** — Ocultar/deshabilitar crear partido, config, captura, cerrar; rutas protegidas; API ya restringe por ROLES_PARTIDO.

### MVP plus (antes de considerar “Fase 2”)

7. **Tiempo manual en eventos** — Campo `tiempoManual` opcional en evento; mostrar en acta si existe.
8. **Snapshot jugador en evento** — `jugadorNombreSnapshot`, `dorsalSnapshot` para actas offline o historial sin depender de jugador actual.
9. **Configuración resultado default** — Liga o global: marcador por defecto (20-0) para default; guardar en liga o env.

### Fase 2

- CRUD equipos/jugadores desde app.
- Jugador invitado con validación en servidor.
- Pagos (inscripción, adeudos).
- Perfil jugador y rankings.
- Audit log explícito y correcciones justificadas.

### Fase 3

- Rol de juegos, playoffs, premios.
- Notificaciones push (Capacitor).
- Migración SQLite → PostgreSQL en producción (si no se hizo en MVP plus).

---

## D. Diseño técnico detallado

### D.1 Entidades y modelo Prisma (cambios)

**Partido** (ya existe; solo uso de estados):

- `estado`: `programado | en_curso | finalizado | default_local | default_visitante | cancelado`
- Para default: `defaultLocalPuntos`, `defaultVisitantePuntos` (opcionales, ej. 20 y 0) o derivar de config liga.

**Evento** (ampliación sugerida):

```prisma
model Evento {
  id                   String    @id
  partidoId            String
  tipo                 String
  jugadorId            String
  jugadorEntraId       String?
  jugadorNombreSnapshot String?  // opcional, para acta offline
  dorsalSnapshot       Int?      // opcional
  minutoPartido        Float
  cuarto               Int
  orden                Int
  tiempoManual         String?   // "8:32" o null
  payload              String?   // JSON opcional
  createdAt            DateTime  @default(now())
  serverReceivedAt     DateTime?
  reverted             Boolean   @default(false) // deshacer lógico si se quiere
  partido              Partido   @relation(...)
  jugador              Jugador   @relation(...)
  jugadorEntra         Jugador?  @relation(...)
}
```

En SQLite: `jugadorNombreSnapshot String?`, `dorsalSnapshot Int?`, `tiempoManual String?`, `payload String?`, `reverted Boolean`. Índice `partidoId, orden`.

**Incidencia** — Ya existe; tipos incluyen `default_no_presentacion`, `expulsion_antideportivas`, `expulsion_tecnicas`, `protesta`.

**Nueva tabla opcional: CierrePendiente (solo cliente / cola local)**

En el cliente (Dexie) se puede tener una tabla `cierresPendientes`:

- `id` (UUID, clientClosureId)
- `partidoId`
- `fotoKey` (key en IndexedDB o path en Filesystem)
- `createdAt`
- `synced` boolean

No es obligatorio en backend; el backend solo recibe POST cerrar con foto (multipart o URL si ya se subió).

**Configuración default (marcador):**

- Opción A: En tabla `Liga` añadir `defaultResultadoLocal Int?`, `defaultResultadoVisitante Int?` (ej. 20, 0).
- Opción B: Constante en backend (ej. 20-0) y en frontend; sin migración.

Recomendación MVP: constante 20-0; Fase 2 o plus: campo en Liga.

### D.2 Endpoints necesarios

| Método | Ruta | Body / Query | Respuesta | Notas |
|--------|------|--------------|-----------|--------|
| PATCH | `/partidos/:id` | `{ estado, defaultLocalPuntos?, defaultVisitantePuntos? }` | Partido | Permitir `default_local`, `default_visitante`. Si estado default, opcional no exigir foto en cerrar. |
| POST | `/partidos/:id/registrar-default` | `{ ganador: 'local' \| 'visitante', motivo: string, resultadoLocal?: number, resultadoVisitante?: number }` | Partido, Incidencia | Crea incidencia default_no_presentacion; marca estado; resultado por defecto 20-0 si no se envía. Idempotente por partidoId si ya está en default. |
| POST | `/partidos/:id/cerrar` | FormData `fotoMarcador` o `{ fotoMarcadorUrl?, clientClosureId? }` | `{ partido, folio }` | Si `clientClosureId` se envía y ya existe cierre con ese id, devolver 200 y mismo folio (idempotente). |
| POST | `/partidos/:id/upload-foto-marcador` | FormData `fotoMarcador` | `{ url: string }` | Opcional: subir foto primero; luego cerrar con `fotoMarcadorUrl`. Evita enviar foto dos veces. |
| GET | `/partidos/:id/acta` | — | JSON acta (ya existe) | Incluir en respuesta flag `esDefault` y `resultadoLocal`, `resultadoVisitante` si aplica. |
| GET | `/partidos/:id/acta/pdf` | — | PDF binary o base64 | Generar PDF; Content-Type application/pdf. Para compartir, el cliente puede obtener blob y usar Share. |
| GET | `/liga/panel` o `/partidos?ligaId=&estado=finalizado&...` | `ligaId`, `estado`, `conIncidencia?`, `equipoId?` | Partido[] o DTO panel | Panel: partidos finalizados; filtros; para métricas por equipo otro endpoint. |
| GET | `/liga/equipos-estadisticas` | `ligaId`, `temporada?` | `{ equipoId, nombre, PJ, PG, PP, PF, PC, DIF }[]` | Calculado desde partidos finalizados. |

**RBAC:** Todos los de escritura (PATCH partido, registrar-default, cerrar, incidencias) con `requireRole(...ROLES_PARTIDO)`; lectura con `ROLES_LECTURA_ROSTER`. Panel liga: mismo rol lectura o admin_liga.

### D.3 Stores y cola de sync (frontend)

- **syncStore:** Mantener `pendingPartidos`, `pendingEventos`; añadir `pendingCierres: { partidoId, clientClosureId, fotoKey }[]`. En `runSync`: después de eventos, por cada cierre pendiente: 1) subir foto (POST upload o multipart en cerrar), 2) POST cerrar con clientClosureId, 3) actualizar partido local con folio y synced, 4) eliminar de cola.
- **partidoStore:** Añadir helpers `getFaltasAntideportivasJugador(jugadorId)`, `getFaltasTecnicasJugador(jugadorId)` para alertas de expulsión; y `isJugadorExpulsado(jugadorId)` (2 antideportivas o 2 técnicas).
- **authStore:** Ya tiene `hasRole`; usarlo en Layout y rutas para ocultar botones y redirigir.

### D.4 Estrategia de sincronización e idempotencia

- **Eventos:** El cliente envía eventos con `id` (UUID generado en cliente). El servidor hace upsert por `id`: si el evento ya existe, responde 200 sin duplicar. Orden de envío: por `partidoId`, luego por `orden`.
- **Partidos:** POST /partidos con `id` en body; si el partido ya existe, el servidor devuelve 200 con el existente (ya implementado).
- **Cierre:** Se introduce `clientClosureId` (UUID generado en cliente). El servidor mantiene una tabla o campo que asocia `clientClosureId` → partido cerrado; si llega un segundo request con el mismo `clientClosureId`, responde 200 con el mismo folio sin volver a cerrar.
- **Unique constraints:** En Prisma, `Evento.id` es PK (un evento por id). Para cierre idempotente: tabla `CierrePartido` con `clientClosureId String? @unique` o un campo `clientClosureId` en Partido (nullable, unique cuando no null).
- **Reintentos:** En el cliente, no marcar como synced hasta recibir 2xx; en 4xx/5xx no borrar de la cola; reintentos con backoff (ej. 1s, 2s, 4s) con un máximo (ej. 5 intentos) antes de dejar en “error” visible para el usuario.

### D.5 Flujo offline-first exacto

1. **Eventos:** Al capturar, se escribe en Dexie con `synced: false`; UI se actualiza al instante. Al haber red, syncStore envía eventos por partido en orden; servidor responde 200; se marca `synced: true`.
2. **Partido nuevo:** Se crea en Dexie con `synced: false`; al sync se hace POST /partidos (idempotente por id).
3. **Cierre offline:**
   - Usuario toma foto → se guarda en IndexedDB como blob en tabla `fotosCierre` (partidoId, blob) o en Capacitor Filesystem con path conocido.
   - Usuario pulsa “Cerrar partido” → se marca partido local como `estado: 'finalizado'`, `folio: null`, `cerradoAt: now`; se añade a cola `cierresPendientes` con partidoId, clientClosureId (UUID), fotoKey.
   - Al tener red: para cada cierre pendiente, subir foto (POST upload-foto-marcador o multipart en cerrar), luego POST /partidos/:id/cerrar con clientClosureId; respuesta con folio → actualizar partido en Dexie (folio, fotoMarcadorUrl, synced), quitar de cola.
4. **Idempotencia:** Eventos por `id`; cierre por `clientClosureId` (servidor guarda clientClosureId en tabla Cierre o en Partido.metadata; si llega mismo clientClosureId, devolver 200 sin duplicar).

### D.6 Foto local: IndexedDB vs Filesystem

- **IndexedDB (Dexie):** Guardar blob en tabla `fotosCierre(partidoId, blob, createdAt)`. Pros: mismo almacén que el resto; sin permisos extra. Contras: tamaño IndexedDB en móvil.
- **Capacitor Filesystem:** Guardar en directorio de app (ej. `fotosCierre/{partidoId}.jpg`). Pros: mejor para Android y no inflar IndexedDB. Contras: solo disponible cuando la app está empaquetada con Capacitor.

**Recomendación:** En web PWA usar IndexedDB (tabla `fotosCierre`). En build Capacitor, usar Filesystem cuando `Capacitor.isNativePlatform()`; clave única partidoId o clientClosureId. Una capa de abstracción en frontend: `saveFotoCierre(partidoId, blob)` y `getFotoCierre(partidoId)` que eligen IndexedDB o Filesystem según plataforma.

### D.7 Generación PDF acta

- **Backend:** Endpoint GET `/partidos/:id/acta/pdf` que construye el PDF (ej. con `pdfkit` o `puppeteer` si se prefiere HTML→PDF). Incluir: folio, equipos, marcador, jugadores con puntos/faltas, incidencias, si es default indicarlo; foto del marcador (URL o embed si es base64). Devolver stream o buffer con Content-Type application/pdf.
- **Frontend (alternativa):** Si se quiere acta sin depender de red: con datos de acta en memoria o desde Dexie, generar PDF en cliente con jsPDF + html2canvas a partir del mismo layout que la vista Acta; luego compartir o descargar. Para offline después del cierre, tener acta en cache (JSON) y generar PDF en cliente.

Recomendación: **Backend** para consistencia y folio oficial; **cliente** como fallback para “compartir sin red” usando datos ya cargados.

### D.8 Compartir acta

- **Web:** `navigator.share({ title, text, files: [pdfFile] })` si está disponible; si no, enlace de descarga del PDF (GET acta/pdf) o descarga directa.
- **Android (Capacitor):** Plugin Share: guardar PDF en Filesystem temporal y pasar URI a `Share.share({ files: [uri] })`.

### D.9 Estructura de carpetas recomendada

```
Captura Partidos/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/        # cuando uses PostgreSQL
│   │   ├── seed.ts
│   │   └── migrate-rbac.ts
│   ├── src/
│   │   ├── index.ts
│   │   ├── lib/
│   │   │   ├── auth.ts
│   │   │   ├── prisma.ts
│   │   │   └── rbac.ts
│   │   └── routes/
│   │       ├── auth.ts
│   │       ├── partidos.ts    # incluir registrar-default, acta/pdf, cerrar idempotente
│   │       ├── ligas.ts
│   │       ├── equipos.ts
│   │       ├── jugadores.ts
│   │       ├── canchas.ts
│   │       └── liga.ts       # nuevo: panel, equipos-estadisticas
│   ├── uploads/               # fotos marcador (desarrollo)
│   ├── package.json
│   └── .env
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── SyncStatus.tsx
│   │   │   └── RoleGuard.tsx  # nuevo: redirige consulta en rutas de escritura
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── db.ts          # Dexie + fotosCierre, cierresPendientes
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── PartidosList.tsx
│   │   │   ├── ConfigMesa.tsx
│   │   │   ├── Captura.tsx
│   │   │   ├── Resumen.tsx
│   │   │   ├── Acta.tsx
│   │   │   └── PanelLiga.tsx  # nuevo
│   │   ├── store/
│   │   │   ├── authStore.ts
│   │   │   ├── partidoStore.ts
│   │   │   └── syncStore.ts
│   │   ├── types/
│   │   │   └── entities.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── capacitor.config.ts    # tras cap init
├── docs/
│   ├── 00-PRD-maestro.md
│   ├── ...
│   └── 11-propuesta-mvp-android.md
├── README.md
└── DESARROLLO.md
```

No hace falta monorepo con paquetes compartidos para MVP; tipos se pueden duplicar o tener un `shared/` mínimo si se quiere.

### D.10 RBAC por pantalla y endpoint

| Pantalla / Acción | consulta | anotador_partido | admin_liga | capturista_roster | superadmin |
|-------------------|----------|------------------|------------|-------------------|------------|
| Ver partidos, acta, resumen (lectura) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Crear partido | ✗ | ✓ | ✓ | ✗ | ✓ |
| Config mesa, Captura, Cerrar | ✗ | ✓ | ✓ | ✗ | ✓ |
| Panel liga (ver) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Editar roster (CRUD equipos/jugadores) | ✗ | ✗ | ✓ | ✓* | ✓ |

*En MVP capturista_roster solo lectura según doc 09.

**API:** Lectura (GET partidos, acta, plantilla, eventos, incidencias): `ROLES_LECTURA_ROSTER`. Escritura (POST/PATCH partidos, plantilla, eventos, incidencias, cerrar, registrar-default): `ROLES_PARTIDO` (admin_liga, anotador_partido). Backend ya usa `requireRole`; frontend debe ocultar/deshabilitar y proteger rutas con guard que compruebe `hasRole('admin_liga','anotador_partido')` para config, captura, resumen (cerrar), y no permitir “Crear partido” a solo consulta.

---

## E. Plan de implementación (orden sugerido)

1. **RBAC UX (consulta)** — Ocultar/deshabilitar botones y enlaces para rol consulta; guard de rutas para /partido/:id/config, captura, resumen; mensaje “Solo lectura” si entra por URL. (Backend ya rechaza 403.)
2. **Registrar default** — Backend: POST `/partidos/:id/registrar-default` o PATCH partido con estado + incidencia; frontend: botón/modal en PartidosList o en ConfigMesa; elegir ganador, motivo; resultado 20-0 por defecto; actualizar acta para mostrar default.
3. **Alertas 5.ª falta y expulsión** — En Captura: al agregar falta, comprobar 5 personales → mensaje “debe salir” y opcionalmente deshabilitar +2/+3/TL/falta para ese jugador hasta que se registre sustitución; comprobar 2 antideportivas o 2 técnicas → crear incidencia automática (en cliente guardar en Dexie y sync; o llamar API si hay red) y alerta “expulsado”; si el jugador sigue en cancha (en cancha actual), mostrar banner.
4. **Acta PDF y compartir** — Backend: GET `/partidos/:id/acta/pdf` con PDFKit (o similar); frontend: botón “Exportar PDF” que obtiene blob y “Compartir” con Web Share API o descarga; preparar llamada a Capacitor Share cuando exista proyecto Android.
5. **Cierre offline** — Frontend: guardar foto en IndexedDB (tabla fotosCierre); cola cierresPendientes en syncStore; en Resumen permitir “Cerrar localmente” si no hay red (guardar estado finalizado en local, folio null, cola de cierre); en runSync procesar cola (subir foto + POST cerrar con clientClosureId); Backend: aceptar clientClosureId en cerrar e idempotencia.
6. **Panel liga** — Backend: GET partidos finalizados con filtros; endpoint equipos-estadisticas (PJ, PG, PP, PF, PC, DIF); Frontend: vista Panel con tabla partidos y tabla por equipo.
7. **Evento con tiempoManual y snapshots** — Prisma y Dexie: campos opcionales; UI opcional en captura (tiempo manual); acta puede mostrar tiempo si existe.
8. **Capacitor Android** — Añadir Capacitor al proyecto; build web → cap add android; plugins Camera, Filesystem, Share; abstracción foto (IndexedDB vs Filesystem); probar cierre y compartir en dispositivo.

---

## F. Entregables de código (archivos a crear o modificar)

### Backend

- **`backend/prisma/schema.prisma`** — Añadir en Evento (opcional): `jugadorNombreSnapshot String?`, `dorsalSnapshot Int?`, `tiempoManual String?`, `payload String?`, `reverted Boolean @default(false)`. Si se usa tabla de cierres idempotentes: `model CierrePartido { id String @id; partidoId String @unique; clientClosureId String? @unique; ... }`.
- **`backend/src/routes/partidos.ts`** — Nuevo endpoint POST `/partidos/:id/registrar-default` (body: ganador, motivo, resultadoLocal, resultadoVisitante); crear incidencia default_no_presentacion; PATCH partido estado default_local/default_visitante; opcional POST `/partidos/:id/upload-foto-marcador`; en POST cerrar aceptar `clientClosureId` y ser idempotente; GET `/partidos/:id/acta` incluir `esDefault`, `defaultLocalPuntos`, `defaultVisitantePuntos` cuando estado sea default_*.
- **`backend/src/routes/partidos.ts`** — GET `/partidos/:id/acta/pdf`: generar PDF (pdfkit) con folio, equipos, marcador, jugadores, incidencias, aviso si default; devolver buffer con type application/pdf.
- **`backend/src/routes/liga.ts`** (nuevo) — GET `/liga/panel` (partidos finalizados, filtros); GET `/liga/equipos-estadisticas` (PJ, PG, PP, PF, PC, DIF por equipo desde partidos finalizados). Protección con auth + ROLES_LECTURA_ROSTER o ROLES_PARTIDO según criterio.
- **`backend/package.json`** — Añadir dependencia `pdfkit` (y `@types/pdfkit` si aplica).

### Frontend

- **`frontend/src/lib/db.ts`** — Nueva tabla Dexie `fotosCierre: 'partidoId'` y/o `cierresPendientes: 'id, partidoId'`; versión 2 del schema.
- **`frontend/src/store/syncStore.ts`** — Cola `pendingCierres`; en runSync: después de eventos, procesar cierres (obtener foto, subir, POST cerrar con clientClosureId, actualizar partido, limpiar cola).
- **`frontend/src/store/partidoStore.ts`** — `getFaltasAntideportivasJugador`, `getFaltasTecnicasJugador`, `isJugadorExpulsado`; opcional bloqueo de eventos para jugador con 5 faltas hasta sustitución.
- **`frontend/src/pages/PartidosList.tsx`** — Botón “Registrar default” (visible para ROLES_PARTIDO); modal o navegación a flujo: elegir partido (o desde tarjeta), ganador, motivo, resultado; llamar API y actualizar lista.
- **`frontend/src/pages/Captura.tsx`** — Tras agregar falta: si 5 personales → alerta “debe salir” y opcional deshabilitar botones de punto/falta para ese jugador; si 2 antideportivas o 2 técnicas → registrar incidencia (store o API), alerta “expulsado”, comprobar si sigue en cancha y mostrar banner.
- **`frontend/src/pages/Resumen.tsx`** — Si no hay red: permitir “Cerrar localmente” (guardar foto en Dexie, marcar partido finalizado en local, añadir a cola cierresPendientes); si hay red, flujo actual (sync + cerrar con foto). Mostrar estado “Cierre pendiente de sincronizar” si hay cierre en cola.
- **`frontend/src/pages/Acta.tsx`** — Botón “Exportar PDF” (fetch GET acta/pdf, blob, descarga o share); botón “Compartir” (navigator.share o Capacitor Share); mostrar “Partido ganado por default” si aplica.
- **`frontend/src/pages/PanelLiga.tsx`** (nuevo) — Lista partidos finalizados (filtro fecha, incidencias); tabla equipos con PJ, PG, PP, PF, PC, DIF; GET liga/panel y liga/equipos-estadisticas.
- **`frontend/src/App.tsx`** — Ruta `/panel` o `/liga` con PanelLiga; guard para rutas partido/config, partido/captura, partido/resumen: si solo consulta, redirigir a home o mostrar “Solo lectura”.
- **`frontend/src/components/Layout.tsx`** — Ocultar “Nuevo partido” y enlaces a config/captura/resumen si `!hasRole('admin_liga','anotador_partido')`; enlace “Panel liga” visible para todos los autenticados.
- **`frontend/src/lib/api.ts`** — Ajustar llamada a cerrar para enviar `clientClosureId` cuando exista; opcional helper `uploadFotoMarcador(partidoId, file)`.

### Ejemplo de código (fragmentos)

**Registrar default (backend):**

```typescript
// POST /partidos/:id/registrar-default
app.post<{
  Params: { id: string };
  Body: { ganador: 'local' | 'visitante'; motivo?: string; resultadoLocal?: number; resultadoVisitante?: number };
}>('/partidos/:id/registrar-default', { preHandler: [app.authenticate, ...preWrite] }, async (request, reply) => {
  const partidoId = request.params.id;
  const partido = await prisma.partido.findUnique({ where: { id: partidoId } });
  if (!partido) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Partido no encontrado' });
  if (partido.ligaId !== (request as AuthRequest).ligaId) return reply.status(403).send({ code: 'FORBIDDEN', message: 'No autorizado' });
  if (['finalizado', 'default_local', 'default_visitante'].includes(partido.estado))
    return reply.status(400).send({ code: 'VALIDATION', message: 'Partido ya cerrado o en default' });

  const { ganador, motivo, resultadoLocal = 20, resultadoVisitante = 0 } = request.body || {};
  if (!ganador) return reply.status(400).send({ code: 'VALIDATION', message: 'ganador es requerido' });

  const estado = ganador === 'local' ? 'default_visitante' : 'default_local';
  const equipoPerdedorId = ganador === 'local' ? partido.visitanteEquipoId : partido.localEquipoId;

  await prisma.$transaction([
    prisma.incidencia.create({
      data: {
        partidoId,
        tipo: 'default_no_presentacion',
        equipoId: equipoPerdedorId,
        motivo: motivo || 'No presentación',
      },
    }),
    prisma.partido.update({
      where: { id: partidoId },
      data: {
        estado,
        folio: await generateFolio(partido.ligaId),
        cerradoAt: new Date(),
        // Opcional: defaultLocalPuntos, defaultVisitantePuntos si añades campos
      },
    }),
  ]);

  const updated = await prisma.partido.findUnique({ where: { id: partidoId } });
  return reply.send(partidoToJson(updated!));
});
```

**Cierre idempotente con clientClosureId (backend):**

```typescript
// En POST /partidos/:id/cerrar
const clientClosureId = (request.body as { clientClosureId?: string })?.clientClosureId;
if (clientClosureId) {
  const existing = await prisma.cierrePartido.findUnique({ where: { clientClosureId } });
  if (existing) {
    const partido = await prisma.partido.findUnique({ where: { id: existing.partidoId } });
    return reply.send({ partido: partidoToJson(partido!), folio: partido!.folio! });
  }
}
// ... subir foto y cerrar ...
// Tras update partido: si clientClosureId, insertar en CierrePartido(partidoId, clientClosureId).
```

**Sync cola de cierres (frontend syncStore):**

```typescript
// En runSync, después de eventos:
const cierres = await db.cierresPendientes.filter(c => !c.synced).toArray();
for (const c of cierres) {
  try {
    const fotoBlob = await db.fotosCierre.get(c.partidoId);
    if (!fotoBlob?.blob) continue;
    const form = new FormData();
    form.append('fotoMarcador', new Blob([fotoBlob.blob]), 'marcador.jpg');
    const res = await api<{ partido: Partido; folio: string }>(`/partidos/${c.partidoId}/cerrar`, {
      method: 'POST',
      body: form,
      headers: { 'X-Client-Closure-Id': c.clientClosureId },
    });
    await db.partidos.update(c.partidoId, { ...res.partido, synced: true });
    await db.cierresPendientes.delete(c.id);
  } catch (e) {
    console.warn('Sync cierre', c.partidoId, e);
  }
}
```

---

## G. Plan de migración SQLite → PostgreSQL

1. **Esquema:** Mantener nombres de modelo Prisma en camelCase; en PostgreSQL usar `@@map("snake_case")` si se desea snake_case en tablas. Tipos: en SQLite no hay enum nativo (String); en PostgreSQL se pueden crear enums con `db.ExecuteRaw` o mantener String.
2. **Provider:** En `schema.prisma`, `datasource db { provider = "postgresql" | "sqlite" url = env("DATABASE_URL") }`. Desarrollo: `.env` con SQLite; producción: DATABASE_URL postgres.
3. **Migraciones:** `npx prisma migrate dev` con PostgreSQL crea migraciones; para SQLite las migraciones son distintas. Estrategia: mantener migraciones separadas por provider o usar `db push` en desarrollo SQLite y `migrate deploy` en producción PostgreSQL.
4. **Datos:** Exportar SQLite (seed o dump) e importar a PostgreSQL con script que mapee tipos (ej. fechas, booleanos). Probar seed en ambos.
5. **No reventar modelo:** Evitar tipos o constraints que solo existan en PostgreSQL en el mismo schema que se usa con SQLite; usar campos opcionales o comprobar provider en código si fuera necesario.

---

## H. Plan de empaquetado Android (Capacitor)

1. **Inicialización:** En raíz del frontend: `npm run build`, `npx cap init "Captura Partidos" "com.capturapartidos.app"`, `npx cap add android`.
2. **Config:** `capacitor.config.ts`: `webDir: 'dist'`, `server.url` solo para live reload en dev.
3. **Build:** `npm run build` → `npx cap copy android` (o `sync`). Abrir Android Studio con `npx cap open android` y compilar/run.
4. **Plugins:** `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/share`. Permisos en AndroidManifest (cámara, almacenamiento si aplica).
5. **Rutas y assets:** Base href y rutas React Router en modo no-browser: usar rutas relativas o HashRouter si hay problemas con deep links.
6. **Abstracción foto:** Servicio que en `Capacitor.getPlatform() === 'android'` use Filesystem para guardar/leer foto de cierre; en web use IndexedDB.
7. **Share:** Tras generar o descargar PDF, guardar en Filesystem temporal y llamar `Share.share({ files: [uri] })`.

---

## I. Lista de tareas concretas (orden de implementación)

1. [ ] RBAC UX: ocultar botones y enlaces para rol consulta; guard rutas config/captura/resumen.
2. [ ] Backend: POST `/partidos/:id/registrar-default`; PATCH partido aceptar estado default_*.
3. [ ] Frontend: flujo Registrar default (modal/botón, elegir ganador, motivo, 20-0).
4. [ ] Backend: GET acta incluir esDefault y resultado cuando sea default.
5. [ ] Captura: alerta 5.ª falta “debe salir”; opcional bloqueo hasta sustitución.
6. [ ] Captura: conteo 2 antideportivas/2 técnicas; incidencia automática; alerta expulsado; banner si sigue en cancha.
7. [ ] Backend: GET `/partidos/:id/acta/pdf` (pdfkit).
8. [ ] Frontend Acta: botón Exportar PDF y Compartir (Web Share / descarga).
9. [ ] Dexie: tabla fotosCierre y cierresPendientes; syncStore: cola de cierres.
10. [ ] Backend: POST cerrar aceptar clientClosureId; idempotencia; opcional POST upload-foto-marcador.
11. [ ] Resumen: cierre offline (guardar foto local, cola cierre, “Cerrar localmente”).
12. [ ] Backend: GET liga/panel y liga/equipos-estadisticas.
13. [ ] Frontend: página Panel liga con partidos y tabla equipos.
14. [ ] Prisma/Dexie: campos opcionales evento (tiempoManual, snapshots) si se desea.
15. [ ] Capacitor: init, add android, plugins Camera/Filesystem/Share; abstracción foto; Share acta.

---

*Este documento es la referencia única para cerrar el MVP y preparar Android sin reescrituras ni sobreingeniería.*
