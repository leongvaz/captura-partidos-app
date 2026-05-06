# 2. Modelo de datos completo (local + servidor)

Modelo pensado para **offline-first** (réplica local en IndexedDB) y **sincronización** con servidor (API REST).

**Fuente de verdad (implementación actual):**

- **Modelo**: `backend/prisma/schema.prisma`
- **Base de datos servidor**: **PostgreSQL** (`provider = "postgresql"`, `DATABASE_URL`)
- **RBAC**: `Usuario` + `MembresiaLiga` (roles por liga)

> Nota: las tablas de este documento son **conceptuales**. Si ves discrepancias, prioriza `schema.prisma`.

### Diferencias clave vs schema actual (abril/mayo 2026)

- **Liga vs temporada**: en el código existe `Temporada` (una `Liga` tiene varias temporadas).
- **Usuario ya no “pertenece” a una sola liga**: la relación es por `MembresiaLiga` (múltiples roles por liga).
- **Persona**: existe entidad `Persona` (CURP único) para historial deportivo, y `Jugador` puede apuntar a `personaId`.
- **Partido**: incluye `temporadaId`, marcadores finales, versionado local/servidor y soporte de idempotencia de cierre (`CierrePartido`).

---

## 2.1 Entidades principales

### Liga
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK. |
| nombre | string | Nombre de la liga. |
| temporada | string | Ej. "2025-2026". |
| categorias | string[] | segunda, intermedia, primera, veteranos, femenil, varonil, mixto. |
| createdAt, updatedAt | datetime | Auditoría. |

---

### Usuario / Anotador
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK. |
| ligaId | UUID | FK Liga. |
| nombre | string | Nombre del anotador. |
| pinHash | string | Hash del PIN (no almacenar PIN en claro). |
| rol | enum | anotador, admin_liga. |
| activo | boolean | |
| createdAt, updatedAt | datetime | |

---

### Equipo
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK. |
| ligaId | UUID | FK Liga. |
| nombre | string | |
| categoria | string | Una de las categorías de la liga. |
| activo | boolean | |
| createdAt, updatedAt | datetime | |

---

### Jugador
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK. |
| equipoId | UUID | FK Equipo. |
| nombre | string | |
| apellido | string | |
| numero | number | Dorsal (único por equipo). |
| invitado | boolean | true si es invitado para un partido. |
| activo | boolean | |
| createdAt, updatedAt | datetime | |

**Nota:** Jugador "invitado" puede ser un registro temporal por partido (JugadorPartido con flag invitado) según diseño; aquí se asume que un jugador puede estar en un equipo y ser marcado como invitado en otro partido (registro cruzado). Alternativa: entidad **JugadorInvitado** por partido con equipoOrigenId, validado al sincronizar.

---

### Cancha
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK. |
| ligaId | UUID | FK Liga. |
| nombre | string | Ej. "Cancha 1". |
| activo | boolean | |

---

### Partido (cabecera)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK. |
| ligaId | UUID | FK Liga. |
| localEquipoId | UUID | FK Equipo. |
| visitanteEquipoId | UUID | FK Equipo. |
| canchaId | UUID | FK Cancha. |
| categoria | string | |
| fecha | date | |
| horaInicio | time | Ej. 10:00. |
| estado | enum | programado, en_curso, finalizado, default_local, default_visitante, cancelado. |
| folio | string | Único, generado al cerrar. Ej. CPT-2026-00234. |
| anotadorId | UUID | FK Usuario. |
| fotoMarcadorUrl | string | URL o blob key de la foto del marcador (obligatoria al cerrar). |
| fotosOpcionales | string[] | URLs o keys de fotos por cuarto (opcional). |
| cerradoAt | datetime | Null hasta cierre. |
| createdAt, updatedAt | datetime | |
| **sync** | | |
| localVersion | number | Versión local para conflictos. |
| serverVersion | number | Versión en servidor (null si no sincronizado). |
| lastSyncedAt | datetime | Última sincronización exitosa. |

---

### Plantilla por partido (jugadores que participan)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK. |
| partidoId | UUID | FK Partido. |
| equipoId | UUID | FK Equipo (redundante pero útil). |
| jugadorId | UUID | FK Jugador. |
| enCanchaInicial | boolean | Si estuvo en plantilla inicial. |
| esCapitan | boolean | |
| esCoach | boolean | (puede ser mismo que capitán). |
| invitado | boolean | Jugador invitado para este partido. |
| createdAt, updatedAt | datetime | |

---

### Evento (log de acciones durante el partido)
Cada acción en mesa (puntos, faltas, TL, sustitución) es un **evento** con minuto aproximado. La app guarda eventos locales y los envía en cola al servidor; el servidor reconstruye el partido aplicando eventos en orden.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK (generado en cliente para idempotencia). |
| partidoId | UUID | FK Partido. |
| tipo | enum | punto_2, punto_3, tiro_libre_anotado, tiro_libre_fallado, falta_personal, falta_antideportiva, falta_tecnica, sustitucion_entra, sustitucion_sale. |
| jugadorId | UUID | FK Jugador (quien anota, quien comete falta, quien sale). |
| jugadorEntraId | UUID | FK Jugador (solo en sustitucion_entra). |
| minutoPartido | number | Minuto aproximado (0–40+). |
| cuarto | number | 1–4 (o 5 si tiempo extra). |
| createdAt | datetime | Momento real del registro (cliente). |
| **sync** | | |
| orden | number | Orden local en el partido (para aplicar en servidor). |
| synced | boolean | Si ya se subió al servidor. |
| serverReceivedAt | datetime | Null hasta sync. |

**Nota:** Para "TL" se pueden registrar dos eventos (anotado/fallado) o un evento con cantidad; en MVP: un evento por tiro libre (tiro_libre_anotado o tiro_libre_fallado). Si la regla es "1+1" o "2+1", se envían varios eventos.

---

### Incidencia (default, expulsión, protesta)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK. |
| partidoId | UUID | FK Partido. |
| tipo | enum | default_no_presentacion, expulsion_antideportivas, expulsion_tecnicas, protesta. |
| equipoId | UUID | FK Equipo (afectado o que pierde por default). |
| jugadorId | UUID | FK Jugador (opcional; para expulsiones). |
| motivo | string | Texto libre o predefinido. |
| createdAt, updatedAt | datetime | |

---

### Acta (vista derivada / caché)
Puede generarse al vuelo desde Partido + Eventos + Plantilla, o guardarse como documento generado (PDF/imagen) con URL o blob key.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK. |
| partidoId | UUID | FK Partido. |
| documentoUrl | string | URL o key del PDF/imagen. |
| generadoAt | datetime | |

---

### Audit log (correcciones y cambios sensibles)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK. |
| partidoId | UUID | FK Partido. |
| usuarioId | UUID | Quién hizo el cambio. |
| accion | enum | correccion_evento, desbloqueo_parcial, anulacion_evento. |
| detalle | string | Descripción o payload (ej. evento anterior vs nuevo). |
| createdAt | datetime | |

---

### Pago / Adeudo (ligas)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK. |
| equipoId | UUID | FK Equipo. |
| ligaId | UUID | FK Liga. |
| tipo | enum | inscripcion, multa, otro. |
| monto | decimal | |
| pagado | boolean | |
| fechaLimite | date | Ej. antes del 5to partido. |
| createdAt, updatedAt | datetime | |

---

### Sancion (suspensión por acumulación, opcional)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK. |
| jugadorId | UUID | FK Jugador. |
| partidosSuspendidos | number | |
| desdePartidoId | UUID | FK Partido (opcional). |
| motivo | string | |
| activa | boolean | |
| createdAt, updatedAt | datetime | |

---

## 2.2 Modelo local (offline)

En el cliente (PWA / app empaquetada):

- **Almacén:** IndexedDB (o SQLite vía Capacitor si se prefiere).
- **Colecciones/tablas mínimas:**  
  `ligas`, `usuarios`, `equipos`, `jugadores`, `canchas`, `partidos`, `plantilla_partido`, `eventos`, `incidencias`, `audit_log`, `pagos`, `sanciones` (estas dos últimas opcionales en MVP).
- **Metadatos de sync por entidad:**  
  En `partidos` y `eventos`: `localVersion`, `serverVersion`, `synced`, `lastSyncedAt`, `orden` (en eventos).
- **Cola de eventos:**  
  Los `eventos` con `synced = false` se envían en orden (`orden`, `createdAt`) al servidor cuando hay conexión.

---

## 2.3 Modelo servidor (API REST)

- Misma estructura de entidades; IDs generados en cliente (UUID) para evitar colisiones y permitir idempotencia.
- **Endpoints sugeridos (MVP):**
  - `GET/POST /ligas`, `GET /ligas/:id`
  - `POST /auth/anotador` (ligaId + PIN → token o sesión)
  - `GET /equipos?ligaId=`, `GET /jugadores?equipoId=`
  - `GET /partidos?ligaId=&fecha=`, `POST /partidos`, `PATCH /partidos/:id`
  - `POST /partidos/:id/plantilla`, `PATCH /partidos/:id/plantilla`
  - `POST /partidos/:id/eventos` (batch o uno a uno), `GET /partidos/:id/eventos`
  - `POST /partidos/:id/incidencias`
  - `POST /partidos/:id/cerrar` (con foto marcador, genera folio)
  - `GET /partidos/:id/acta` (genera o devuelve URL del acta)
  - `POST /audit-log`
  - `GET /pagos?equipoId=`, `PATCH /pagos/:id`
- **Reglas:** Autenticación por liga + PIN; autorización por liga (anotador solo ve su liga). Validación de invitados (no otro equipo conflicto, mismo horario, no doble partido) solo en servidor cuando hay datos completos.

---

## 2.4 Relaciones resumidas

```
Liga 1──* Usuario, Equipo, Cancha, Partido, Pago
Equipo 1──* Jugador
Partido N──1 Local Equipo, N──1 Visitante Equipo, N──1 Cancha, N──1 Anotador
Partido 1──* PlantillaPartido, Evento, Incidencia, AuditLog
PlantillaPartido N──1 Jugador
Evento N──1 Jugador [, JugadorEntra]
Incidencia N──1 Equipo [, Jugador]
```

Este modelo soporta **offline-first**, **sincronización por eventos** y **actas oficiales** con folio y foto del marcador, sin matar el MVP.
