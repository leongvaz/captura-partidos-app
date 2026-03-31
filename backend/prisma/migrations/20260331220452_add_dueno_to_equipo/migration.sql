-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Equipo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ligaId" TEXT NOT NULL,
    "duenoId" TEXT,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipo_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Equipo_duenoId_fkey" FOREIGN KEY ("duenoId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Equipo" ("activo", "categoria", "createdAt", "id", "ligaId", "nombre", "updatedAt") SELECT "activo", "categoria", "createdAt", "id", "ligaId", "nombre", "updatedAt" FROM "Equipo";
DROP TABLE "Equipo";
ALTER TABLE "new_Equipo" RENAME TO "Equipo";
CREATE INDEX "Equipo_duenoId_idx" ON "Equipo"("duenoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
