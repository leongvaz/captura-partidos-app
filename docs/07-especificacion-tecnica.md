# 7. Especificación técnica

Especificación para implementación: **endpoints REST**, **esquema de base de datos** (PostgreSQL) y **tipos TypeScript** compartidos entre frontend y backend.

---

## 7.1 API REST — Endpoints

Base URL: `https://api.captura-partidos.example.com/v1` (o variable de entorno `VITE_API_URL` / `API_BASE_URL`).

Autenticación: header `Authorization: Bearer <token>` tras `POST /auth/anotador`. Todas las rutas (excepto auth) requieren token válido.

---

### Auth

| Método | Ruta | Body | Respuesta | Notas |
|--------|------|------|-----------|--------|
| POST | `/auth/anotador` | `{ ligaId: string, pin: string }` | `{ token: string, usuario: Usuario, liga: Liga }` | 200 OK; 401 si PIN incorrecto. |

---

### Ligas

| Método | Ruta | Query / Body | Respuesta | Notas |
|--------|------|--------------|-----------|--------|
| GET | `/ligas` | — | `Liga[]` | Solo admin o listado público si aplica. |
| GET | `/ligas/:id` | — | `Liga` | 404 si no existe. |
| POST | `/ligas` | `CreateLigaDto` | `Liga` | Solo admin; fuera de MVP anotador. |

---

### Equipos

| Método | Ruta | Query / Body | Respuesta | Notas |
|--------|------|--------------|-----------|--------|
| GET | `/equipos` | `?ligaId=uuid` | `Equipo[]` | Filtro obligatorio por liga (scope del token). |
| GET | `/equipos/:id` | — | `Equipo` | 404 si no existe o no pertenece a la liga. |
| POST | `/equipos` | `CreateEquipoDto` | `Equipo` | ligaId del token. |
| PATCH | `/equipos/:id` | `UpdateEquipoDto` | `Equipo` | Parcial. |

---

### Jugadores

| Método | Ruta | Query / Body | Respuesta | Notas |
|--------|------|--------------|-----------|--------|
| GET | `/jugadores` | `?equipoId=uuid` | `Jugador[]` | Filtro por equipo. |
| GET | `/jugadores/:id` | — | `Jugador` | 404 si no existe. |
| POST | `/jugadores` | `CreateJugadorDto` | `Jugador` | equipoId debe ser de la liga del token. |
| PATCH | `/jugadores/:id` | `UpdateJugadorDto` | `Jugador` | Parcial. |

---

### Canchas

| Método | Ruta | Query / Body | Respuesta | Notas |
|--------|------|--------------|-----------|--------|
| GET | `/canchas` | `?ligaId=uuid` | `Cancha[]` | ligaId del token si no se pasa. |
| GET | `/canchas/:id` | — | `Cancha` | 404 si no existe. |
| POST | `/canchas` | `CreateCanchaDto` | `Cancha` | MVP: solo lectura desde app si ya existen en BD. |

---

### Partidos

| Método | Ruta | Query / Body | Respuesta | Notas |
|--------|------|--------------|-----------|--------|
| GET | `/partidos` | `?ligaId=uuid&fecha=YYYY-MM-DD&estado=...` | `Partido[]` | ligaId obligatorio (scope token); fecha opcional. |
| GET | `/partidos/:id` | — | `Partido` | 404 si no existe o no es de la liga. |
| POST | `/partidos` | `CreatePartidoDto` | `Partido` | Idempotente por `id` (cliente envía id). |
| PATCH | `/partidos/:id` | `UpdatePartidoDto` | `Partido` | Solo campos permitidos (estado, etc.); no modificar si cerrado. |
| POST | `/partidos/:id/cerrar` | `FormData: { fotoMarcador: File }` o `{ fotoMarcadorUrl?: string }` | `{ partido: Partido, folio: string }` | Genera folio único; guarda URL de foto; estado → finalizado. 400 si ya cerrado o sin foto. |
| GET | `/partidos/:id/acta` | — | `{ url?: string, pdfBase64?: string }` o generación on-demand | Acta en PDF o URL; opcional base64 para offline. |

---

### Plantilla del partido

| Método | Ruta | Query / Body | Respuesta | Notas |
|--------|------|--------------|-----------|--------|
| GET | `/partidos/:id/plantilla` | — | `PlantillaPartido[]` | Lista de jugadores del partido con enCanchaInicial, esCapitan, esCoach, invitado. |
| POST | `/partidos/:id/plantilla` | `PlantillaPartido[]` (batch) o `{ items: PlantillaPartido[] }` | `PlantillaPartido[]` | Reemplaza o upsert por (partidoId, jugadorId). Validar 5 en cancha por equipo y capitán en cancha. |
| PATCH | `/partidos/:id/plantilla` | `{ items: Partial<PlantillaPartido>[] }` | `PlantillaPartido[]` | Parcial; mismo validaciones. |

---

### Eventos del partido

| Método | Ruta | Query / Body | Respuesta | Notas |
|--------|------|--------------|-----------|--------|
| GET | `/partidos/:id/eventos` | — | `Evento[]` | Ordenados por `orden` o `createdAt`. |
| POST | `/partidos/:id/eventos` | `Evento[]` o `{ eventos: Evento[] }` | `{ recibidos: number, eventos: Evento[] }` | Batch; idempotente por `id` de cada evento. Servidor ordena por `orden` y persiste; recalcula estadísticas. 400 si partido cerrado. |
| POST | `/partidos/:id/eventos/single` | `Evento` | `Evento` | Un solo evento; mismo idempotencia. |

---

### Incidencias

| Método | Ruta | Query / Body | Respuesta | Notas |
|--------|------|--------------|-----------|--------|
| GET | `/partidos/:id/incidencias` | — | `Incidencia[]` | |
| POST | `/partidos/:id/incidencias` | `CreateIncidenciaDto` | `Incidencia` | tipo, equipoId, jugadorId?, motivo. |

---

### Audit log

| Método | Ruta | Query / Body | Respuesta | Notas |
|--------|------|--------------|-----------|--------|
| POST | `/audit-log` | `CreateAuditLogDto` | `AuditLog` | partidoId, accion, detalle; usuarioId del token. |
| GET | `/partidos/:id/audit-log` | — | `AuditLog[]` | Solo admin o organizador. Fase 2. |

---

### Pagos (Fase 2)

| Método | Ruta | Query / Body | Respuesta | Notas |
|--------|------|--------------|-----------|--------|
| GET | `/pagos` | `?ligaId=uuid&equipoId=uuid` | `Pago[]` | |
| POST | `/pagos` | `CreatePagoDto` | `Pago` | |
| PATCH | `/pagos/:id` | `{ pagado: boolean }` | `Pago` | |

---

### Códigos HTTP y errores

- **200** OK con body.
- **201** Created (POST que crea recurso; opcional usar 200 + body).
- **400** Bad Request: validación (body inválido, partido ya cerrado, etc.). Body: `{ code: string, message: string }`.
- **401** Unauthorized: token faltante o inválido.
- **403** Forbidden: recurso de otra liga.
- **404** Not Found: recurso no existe.
- **409** Conflict: versión optimista (opcional).
- **500** Internal Server Error.

---

## 7.2 Esquema de base de datos (PostgreSQL)

Enums y tablas en SQL; compatible con Prisma/Drizzle.

```sql
-- Enums
CREATE TYPE rol_usuario AS ENUM ('anotador', 'admin_liga');
CREATE TYPE estado_partido AS ENUM (
  'programado', 'en_curso', 'finalizado',
  'default_local', 'default_visitante', 'cancelado'
);
CREATE TYPE tipo_evento AS ENUM (
  'punto_2', 'punto_3',
  'tiro_libre_anotado', 'tiro_libre_fallado',
  'falta_personal', 'falta_antideportiva', 'falta_tecnica',
  'sustitucion_entra', 'sustitucion_sale'
);
CREATE TYPE tipo_incidencia AS ENUM (
  'default_no_presentacion', 'expulsion_antideportivas',
  'expulsion_tecnicas', 'protesta'
);
CREATE TYPE tipo_pago AS ENUM ('inscripcion', 'multa', 'otro');
CREATE TYPE accion_audit AS ENUM ('correccion_evento', 'desbloqueo_parcial', 'anulacion_evento');

-- Tablas
CREATE TABLE ligas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  temporada VARCHAR(50) NOT NULL,
  categorias TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liga_id UUID NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  rol rol_usuario NOT NULL DEFAULT 'anotador',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usuarios_liga ON usuarios(liga_id);

CREATE TABLE equipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liga_id UUID NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_equipos_liga ON equipos(liga_id);

CREATE TABLE jugadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  apellido VARCHAR(255) NOT NULL,
  numero SMALLINT NOT NULL,
  invitado BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(equipo_id, numero)
);
CREATE INDEX idx_jugadores_equipo ON jugadores(equipo_id);

CREATE TABLE canchas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liga_id UUID NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_canchas_liga ON canchas(liga_id);

CREATE TABLE partidos (
  id UUID PRIMARY KEY,
  liga_id UUID NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
  local_equipo_id UUID NOT NULL REFERENCES equipos(id),
  visitante_equipo_id UUID NOT NULL REFERENCES equipos(id),
  cancha_id UUID NOT NULL REFERENCES canchas(id),
  categoria VARCHAR(100) NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  estado estado_partido NOT NULL DEFAULT 'programado',
  folio VARCHAR(50) UNIQUE,
  anotador_id UUID NOT NULL REFERENCES usuarios(id),
  foto_marcador_url TEXT,
  fotos_opcionales TEXT[] DEFAULT '{}',
  cerrado_at TIMESTAMPTZ,
  local_version INTEGER DEFAULT 1,
  server_version INTEGER DEFAULT 1,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_partidos_liga_fecha ON partidos(liga_id, fecha);
CREATE INDEX idx_partidos_estado ON partidos(estado);

CREATE TABLE plantilla_partido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partido_id UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  equipo_id UUID NOT NULL REFERENCES equipos(id),
  jugador_id UUID NOT NULL REFERENCES jugadores(id),
  en_cancha_inicial BOOLEAN NOT NULL DEFAULT false,
  es_capitan BOOLEAN NOT NULL DEFAULT false,
  es_coach BOOLEAN NOT NULL DEFAULT false,
  invitado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(partido_id, jugador_id)
);
CREATE INDEX idx_plantilla_partido ON plantilla_partido(partido_id);

CREATE TABLE eventos (
  id UUID PRIMARY KEY,
  partido_id UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  tipo tipo_evento NOT NULL,
  jugador_id UUID NOT NULL REFERENCES jugadores(id),
  jugador_entra_id UUID REFERENCES jugadores(id),
  minuto_partido NUMERIC(5,2) NOT NULL,
  cuarto SMALLINT NOT NULL,
  orden INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_received_at TIMESTAMPTZ
);
CREATE INDEX idx_eventos_partido_orden ON eventos(partido_id, orden);

CREATE TABLE incidencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partido_id UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  tipo tipo_incidencia NOT NULL,
  equipo_id UUID REFERENCES equipos(id),
  jugador_id UUID REFERENCES jugadores(id),
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incidencias_partido ON incidencias(partido_id);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partido_id UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  accion accion_audit NOT NULL,
  detalle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_partido ON audit_log(partido_id);

CREATE TABLE actas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partido_id UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE UNIQUE,
  documento_url TEXT,
  generado_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  liga_id UUID NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
  tipo tipo_pago NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  pagado BOOLEAN NOT NULL DEFAULT false,
  fecha_limite DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pagos_equipo ON pagos(equipo_id);
CREATE INDEX idx_pagos_liga ON pagos(liga_id);
```

---

## 7.3 Tipos TypeScript (compartidos)

Carpeta sugerida: `shared/types` o paquete `@captura-partidos/types` (monorepo). Nombres en camelCase para JSON/API; snake_case solo en BD si se prefiere.

```typescript
// shared/types/entities.ts

export type RolUsuario = 'anotador' | 'admin_liga';
export type EstadoPartido =
  | 'programado'
  | 'en_curso'
  | 'finalizado'
  | 'default_local'
  | 'default_visitante'
  | 'cancelado';
export type TipoEvento =
  | 'punto_2'
  | 'punto_3'
  | 'tiro_libre_anotado'
  | 'tiro_libre_fallado'
  | 'falta_personal'
  | 'falta_antideportiva'
  | 'falta_tecnica'
  | 'sustitucion_entra'
  | 'sustitucion_sale';
export type TipoIncidencia =
  | 'default_no_presentacion'
  | 'expulsion_antideportivas'
  | 'expulsion_tecnicas'
  | 'protesta';
export type TipoPago = 'inscripcion' | 'multa' | 'otro';
export type AccionAudit = 'correccion_evento' | 'desbloqueo_parcial' | 'anulacion_evento';

export interface Liga {
  id: string;
  nombre: string;
  temporada: string;
  categorias: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Usuario {
  id: string;
  ligaId: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Equipo {
  id: string;
  ligaId: string;
  nombre: string;
  categoria: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Jugador {
  id: string;
  equipoId: string;
  nombre: string;
  apellido: string;
  numero: number;
  invitado: boolean;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Cancha {
  id: string;
  ligaId: string;
  nombre: string;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Partido {
  id: string;
  ligaId: string;
  localEquipoId: string;
  visitanteEquipoId: string;
  canchaId: string;
  categoria: string;
  fecha: string; // YYYY-MM-DD
  horaInicio: string; // HH:mm
  estado: EstadoPartido;
  folio?: string | null;
  anotadorId: string;
  fotoMarcadorUrl?: string | null;
  fotosOpcionales?: string[];
  cerradoAt?: string | null;
  localVersion?: number;
  serverVersion?: number | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlantillaPartido {
  id: string;
  partidoId: string;
  equipoId: string;
  jugadorId: string;
  enCanchaInicial: boolean;
  esCapitan: boolean;
  esCoach: boolean;
  invitado: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Evento {
  id: string;
  partidoId: string;
  tipo: TipoEvento;
  jugadorId: string;
  jugadorEntraId?: string | null;
  minutoPartido: number;
  cuarto: number;
  orden: number;
  createdAt: string;
  serverReceivedAt?: string | null;
}

export interface Incidencia {
  id: string;
  partidoId: string;
  tipo: TipoIncidencia;
  equipoId?: string | null;
  jugadorId?: string | null;
  motivo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  partidoId: string;
  usuarioId: string;
  accion: AccionAudit;
  detalle?: string | null;
  createdAt: string;
}

export interface Pago {
  id: string;
  equipoId: string;
  ligaId: string;
  tipo: TipoPago;
  monto: number;
  pagado: boolean;
  fechaLimite?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

```typescript
// shared/types/api-dtos.ts

import type {
  Liga,
  Usuario,
  Equipo,
  Jugador,
  Cancha,
  Partido,
  PlantillaPartido,
  Evento,
  Incidencia,
  AuditLog,
  Pago,
} from './entities';

// Auth
export interface AuthAnotadorRequest {
  ligaId: string;
  pin: string;
}
export interface AuthAnotadorResponse {
  token: string;
  usuario: Usuario;
  liga: Liga;
}

// Create/Update DTOs (campos requeridos o permitidos)
export type CreateLigaDto = Pick<Liga, 'nombre' | 'temporada'> & { categorias?: string[] };
export type UpdateLigaDto = Partial<CreateLigaDto>;

export type CreateEquipoDto = Pick<Equipo, 'nombre' | 'categoria'> & { ligaId?: string };
export type UpdateEquipoDto = Partial<Pick<Equipo, 'nombre' | 'categoria' | 'activo'>>;

export type CreateJugadorDto = Pick<Jugador, 'nombre' | 'apellido' | 'numero'> & { equipoId: string };
export type UpdateJugadorDto = Partial<Pick<Jugador, 'nombre' | 'apellido' | 'numero' | 'activo'>>;

export type CreateCanchaDto = Pick<Cancha, 'nombre'> & { ligaId?: string };

export type CreatePartidoDto = Pick<
  Partido,
  | 'id'
  | 'localEquipoId'
  | 'visitanteEquipoId'
  | 'canchaId'
  | 'categoria'
  | 'fecha'
  | 'horaInicio'
> & { ligaId?: string; anotadorId?: string };
export type UpdatePartidoDto = Partial<Pick<Partido, 'estado' | 'fotoMarcadorUrl' | 'fotosOpcionales'>>;

export type CreatePlantillaPartidoDto = Omit<PlantillaPartido, 'id' | 'createdAt' | 'updatedAt'>;
export type CreatePlantillaPartidoBatchDto = { items: CreatePlantillaPartidoDto[] };

export type CreateEventoDto = Omit<Evento, 'createdAt' | 'serverReceivedAt'>;
export type CreateEventosBatchDto = { eventos: CreateEventoDto[] };

export type CreateIncidenciaDto = Pick<Incidencia, 'tipo'> & {
  equipoId?: string | null;
  jugadorId?: string | null;
  motivo?: string | null;
};

export type CreateAuditLogDto = Pick<AuditLog, 'partidoId' | 'accion'> & { detalle?: string | null };

export type CreatePagoDto = Pick<Pago, 'equipoId' | 'ligaId' | 'tipo' | 'monto'> & {
  fechaLimite?: string | null;
};
```

```typescript
// shared/types/api-responses.ts (opcional, para respuestas tipadas)

import type { Partido, Evento } from './entities';

export interface PartidoCerrarResponse {
  partido: Partido;
  folio: string;
}

export interface PartidoEventosBatchResponse {
  recibidos: number;
  eventos: Evento[];
}

export interface ActaResponse {
  url?: string;
  pdfBase64?: string;
}
```

```typescript
// shared/types/local-sync.ts (cliente: IndexedDB + cola)

import type { Partido, Evento, PlantillaPartido, Incidencia } from './entities';

export interface PartidoLocal extends Partido {
  synced?: boolean;
}

export interface EventoLocal extends Evento {
  synced?: boolean;
}

export interface SyncState {
  status: 'offline' | 'pending' | 'syncing' | 'synced';
  pendingPartidos: number;
  pendingEventos: number;
  lastSyncedAt: string | null;
}

export interface SyncPayload {
  partidos: PartidoLocal[];
  plantillas: Record<string, PlantillaPartido[]>;
  eventos: Record<string, EventoLocal[]>;
  incidencias: Record<string, Incidencia[]>;
  cerrarPartidos: { partidoId: string; fotoMarcadorUrl?: string; file?: File }[];
}
```

---

## 7.4 Índice de la especificación técnica

| Sección | Contenido |
|---------|-----------|
| 7.1 | Endpoints REST (auth, ligas, equipos, jugadores, canchas, partidos, plantilla, eventos, incidencias, audit, pagos). |
| 7.2 | Esquema PostgreSQL (enums, tablas, índices). |
| 7.3 | Tipos TypeScript: entidades, DTOs de API, respuestas, tipos locales para sync. |

Con esto se puede implementar el backend (Fastify/Express + Prisma o Drizzle) y el frontend (React + Zustand + Dexie) con contratos claros y tipado compartido.
