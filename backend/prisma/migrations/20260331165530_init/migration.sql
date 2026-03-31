-- CreateTable
CREATE TABLE "Liga" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "temporada" TEXT NOT NULL,
    "categorias" TEXT NOT NULL DEFAULT '["primera","segunda","veteranos","femenil","varonil"]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "pinHash" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MembresiaLiga" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ligaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembresiaLiga_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembresiaLiga_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Equipo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ligaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipo_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Jugador" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "invitado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Jugador_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cancha" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ligaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cancha_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Partido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ligaId" TEXT NOT NULL,
    "localEquipoId" TEXT NOT NULL,
    "visitanteEquipoId" TEXT NOT NULL,
    "canchaId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'programado',
    "folio" TEXT,
    "anotadorId" TEXT NOT NULL,
    "marcadorLocalFinal" INTEGER,
    "marcadorVisitanteFinal" INTEGER,
    "fotoMarcadorUrl" TEXT,
    "fotosOpcionales" TEXT DEFAULT '[]',
    "cerradoAt" DATETIME,
    "localVersion" INTEGER NOT NULL DEFAULT 1,
    "serverVersion" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Partido_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Partido_localEquipoId_fkey" FOREIGN KEY ("localEquipoId") REFERENCES "Equipo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Partido_visitanteEquipoId_fkey" FOREIGN KEY ("visitanteEquipoId") REFERENCES "Equipo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Partido_canchaId_fkey" FOREIGN KEY ("canchaId") REFERENCES "Cancha" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Partido_anotadorId_fkey" FOREIGN KEY ("anotadorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CierrePartido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partidoId" TEXT NOT NULL,
    "clientClosureId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CierrePartido_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlantillaPartido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partidoId" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "enCanchaInicial" BOOLEAN NOT NULL DEFAULT false,
    "esCapitan" BOOLEAN NOT NULL DEFAULT false,
    "esCoach" BOOLEAN NOT NULL DEFAULT false,
    "invitado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlantillaPartido_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlantillaPartido_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlantillaPartido_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partidoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "jugadorEntraId" TEXT,
    "minutoPartido" REAL NOT NULL,
    "cuarto" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "segundosRestantesCuarto" INTEGER,
    "tiempoPartidoSegundos" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverReceivedAt" DATETIME,
    CONSTRAINT "Evento_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Evento_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Evento_jugadorEntraId_fkey" FOREIGN KEY ("jugadorEntraId") REFERENCES "Jugador" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Incidencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partidoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "equipoId" TEXT,
    "jugadorId" TEXT,
    "motivo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Incidencia_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Incidencia_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incidencia_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invitacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ligaId" TEXT NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invitacion_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MembresiaLiga_ligaId_idx" ON "MembresiaLiga"("ligaId");

-- CreateIndex
CREATE INDEX "MembresiaLiga_usuarioId_idx" ON "MembresiaLiga"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "MembresiaLiga_ligaId_usuarioId_rol_key" ON "MembresiaLiga"("ligaId", "usuarioId", "rol");

-- CreateIndex
CREATE UNIQUE INDEX "Jugador_equipoId_numero_key" ON "Jugador"("equipoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Partido_folio_key" ON "Partido"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "CierrePartido_partidoId_key" ON "CierrePartido"("partidoId");

-- CreateIndex
CREATE UNIQUE INDEX "CierrePartido_clientClosureId_key" ON "CierrePartido"("clientClosureId");

-- CreateIndex
CREATE UNIQUE INDEX "PlantillaPartido_partidoId_jugadorId_key" ON "PlantillaPartido"("partidoId", "jugadorId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitacion_token_key" ON "Invitacion"("token");

-- CreateIndex
CREATE INDEX "Invitacion_ligaId_idx" ON "Invitacion"("ligaId");
