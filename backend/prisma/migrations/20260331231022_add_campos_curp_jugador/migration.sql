-- AlterTable
ALTER TABLE "Jugador" ADD COLUMN "curp" TEXT;
ALTER TABLE "Jugador" ADD COLUMN "fechaNacimiento" TEXT;
ALTER TABLE "Jugador" ADD COLUMN "fotoUrl" TEXT;
ALTER TABLE "Jugador" ADD COLUMN "sexo" TEXT;

-- CreateIndex
CREATE INDEX "Jugador_curp_idx" ON "Jugador"("curp");
