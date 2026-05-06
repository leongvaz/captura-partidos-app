-- CreateTable
CREATE TABLE "Liga" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "deporte" TEXT NOT NULL DEFAULT 'baloncesto',
    "categorias" TEXT NOT NULL DEFAULT '["primera","segunda","veteranos","femenil","varonil"]',
    "reglasConfig" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Liga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Temporada" (
    "id" TEXT NOT NULL,
    "ligaId" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Temporada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sede" (
    "id" TEXT NOT NULL,
    "ligaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "curp" TEXT NOT NULL,
    "nombreDisplay" TEXT,
    "apellidoDisplay" TEXT,
    "sexo" TEXT,
    "fechaNacimiento" TEXT,
    "solicitudEliminacionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "curp" TEXT,
    "pinHash" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembresiaLiga" (
    "id" TEXT NOT NULL,
    "ligaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembresiaLiga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipo" (
    "id" TEXT NOT NULL,
    "ligaId" TEXT NOT NULL,
    "temporadaId" TEXT NOT NULL,
    "duenoId" TEXT,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jugador" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "personaId" TEXT,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "curp" TEXT,
    "sexo" TEXT,
    "fechaNacimiento" TEXT,
    "fotoUrl" TEXT,
    "invitado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jugador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cancha" (
    "id" TEXT NOT NULL,
    "ligaId" TEXT NOT NULL,
    "sedeId" TEXT,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cancha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partido" (
    "id" TEXT NOT NULL,
    "ligaId" TEXT NOT NULL,
    "temporadaId" TEXT NOT NULL,
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
    "cerradoAt" TIMESTAMP(3),
    "localVersion" INTEGER NOT NULL DEFAULT 1,
    "serverVersion" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierrePartido" (
    "id" TEXT NOT NULL,
    "partidoId" TEXT NOT NULL,
    "clientClosureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CierrePartido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantillaPartido" (
    "id" TEXT NOT NULL,
    "partidoId" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "enCanchaInicial" BOOLEAN NOT NULL DEFAULT false,
    "esCapitan" BOOLEAN NOT NULL DEFAULT false,
    "esCoach" BOOLEAN NOT NULL DEFAULT false,
    "invitado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantillaPartido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "partidoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "jugadorEntraId" TEXT,
    "minutoPartido" DOUBLE PRECISION NOT NULL,
    "cuarto" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "segundosRestantesCuarto" INTEGER,
    "tiempoPartidoSegundos" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverReceivedAt" TIMESTAMP(3),

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incidencia" (
    "id" TEXT NOT NULL,
    "partidoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "equipoId" TEXT,
    "jugadorId" TEXT,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumenJugadorPartido" (
    "id" TEXT NOT NULL,
    "partidoId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "personaId" TEXT,
    "equipoId" TEXT NOT NULL,
    "puntos" INTEGER NOT NULL DEFAULT 0,
    "canastasDe2" INTEGER NOT NULL DEFAULT 0,
    "canastasDe3" INTEGER NOT NULL DEFAULT 0,
    "tirosLibresAnotados" INTEGER NOT NULL DEFAULT 0,
    "faltas" INTEGER NOT NULL DEFAULT 0,
    "asistencias" INTEGER NOT NULL DEFAULT 0,
    "minutosJugados" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumenJugadorPartido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitacion" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ligaId" TEXT NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Temporada_ligaId_idx" ON "Temporada"("ligaId");

-- CreateIndex
CREATE INDEX "Temporada_ligaId_estado_idx" ON "Temporada"("ligaId", "estado");

-- CreateIndex
CREATE INDEX "Sede_ligaId_idx" ON "Sede"("ligaId");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_curp_key" ON "Persona"("curp");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_curp_key" ON "Usuario"("curp");

-- CreateIndex
CREATE INDEX "MembresiaLiga_ligaId_idx" ON "MembresiaLiga"("ligaId");

-- CreateIndex
CREATE INDEX "MembresiaLiga_usuarioId_idx" ON "MembresiaLiga"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "MembresiaLiga_ligaId_usuarioId_rol_key" ON "MembresiaLiga"("ligaId", "usuarioId", "rol");

-- CreateIndex
CREATE INDEX "Equipo_duenoId_idx" ON "Equipo"("duenoId");

-- CreateIndex
CREATE INDEX "Equipo_ligaId_idx" ON "Equipo"("ligaId");

-- CreateIndex
CREATE INDEX "Equipo_temporadaId_idx" ON "Equipo"("temporadaId");

-- CreateIndex
CREATE INDEX "Jugador_curp_idx" ON "Jugador"("curp");

-- CreateIndex
CREATE INDEX "Jugador_personaId_idx" ON "Jugador"("personaId");

-- CreateIndex
CREATE UNIQUE INDEX "Jugador_equipoId_numero_key" ON "Jugador"("equipoId", "numero");

-- CreateIndex
CREATE INDEX "Cancha_sedeId_idx" ON "Cancha"("sedeId");

-- CreateIndex
CREATE UNIQUE INDEX "Partido_folio_key" ON "Partido"("folio");

-- CreateIndex
CREATE INDEX "Partido_ligaId_idx" ON "Partido"("ligaId");

-- CreateIndex
CREATE INDEX "Partido_temporadaId_idx" ON "Partido"("temporadaId");

-- CreateIndex
CREATE UNIQUE INDEX "CierrePartido_partidoId_key" ON "CierrePartido"("partidoId");

-- CreateIndex
CREATE UNIQUE INDEX "CierrePartido_clientClosureId_key" ON "CierrePartido"("clientClosureId");

-- CreateIndex
CREATE UNIQUE INDEX "PlantillaPartido_partidoId_jugadorId_key" ON "PlantillaPartido"("partidoId", "jugadorId");

-- CreateIndex
CREATE INDEX "ResumenJugadorPartido_personaId_idx" ON "ResumenJugadorPartido"("personaId");

-- CreateIndex
CREATE INDEX "ResumenJugadorPartido_jugadorId_idx" ON "ResumenJugadorPartido"("jugadorId");

-- CreateIndex
CREATE INDEX "ResumenJugadorPartido_partidoId_idx" ON "ResumenJugadorPartido"("partidoId");

-- CreateIndex
CREATE UNIQUE INDEX "ResumenJugadorPartido_partidoId_jugadorId_key" ON "ResumenJugadorPartido"("partidoId", "jugadorId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitacion_token_key" ON "Invitacion"("token");

-- CreateIndex
CREATE INDEX "Invitacion_ligaId_idx" ON "Invitacion"("ligaId");

-- AddForeignKey
ALTER TABLE "Temporada" ADD CONSTRAINT "Temporada_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sede" ADD CONSTRAINT "Sede_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembresiaLiga" ADD CONSTRAINT "MembresiaLiga_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembresiaLiga" ADD CONSTRAINT "MembresiaLiga_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipo" ADD CONSTRAINT "Equipo_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipo" ADD CONSTRAINT "Equipo_temporadaId_fkey" FOREIGN KEY ("temporadaId") REFERENCES "Temporada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipo" ADD CONSTRAINT "Equipo_duenoId_fkey" FOREIGN KEY ("duenoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jugador" ADD CONSTRAINT "Jugador_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jugador" ADD CONSTRAINT "Jugador_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cancha" ADD CONSTRAINT "Cancha_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cancha" ADD CONSTRAINT "Cancha_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partido" ADD CONSTRAINT "Partido_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partido" ADD CONSTRAINT "Partido_temporadaId_fkey" FOREIGN KEY ("temporadaId") REFERENCES "Temporada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partido" ADD CONSTRAINT "Partido_localEquipoId_fkey" FOREIGN KEY ("localEquipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partido" ADD CONSTRAINT "Partido_visitanteEquipoId_fkey" FOREIGN KEY ("visitanteEquipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partido" ADD CONSTRAINT "Partido_canchaId_fkey" FOREIGN KEY ("canchaId") REFERENCES "Cancha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partido" ADD CONSTRAINT "Partido_anotadorId_fkey" FOREIGN KEY ("anotadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierrePartido" ADD CONSTRAINT "CierrePartido_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantillaPartido" ADD CONSTRAINT "PlantillaPartido_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantillaPartido" ADD CONSTRAINT "PlantillaPartido_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantillaPartido" ADD CONSTRAINT "PlantillaPartido_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_jugadorEntraId_fkey" FOREIGN KEY ("jugadorEntraId") REFERENCES "Jugador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidencia" ADD CONSTRAINT "Incidencia_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidencia" ADD CONSTRAINT "Incidencia_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidencia" ADD CONSTRAINT "Incidencia_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumenJugadorPartido" ADD CONSTRAINT "ResumenJugadorPartido_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumenJugadorPartido" ADD CONSTRAINT "ResumenJugadorPartido_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumenJugadorPartido" ADD CONSTRAINT "ResumenJugadorPartido_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumenJugadorPartido" ADD CONSTRAINT "ResumenJugadorPartido_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitacion" ADD CONSTRAINT "Invitacion_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

