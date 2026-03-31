-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Liga" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "temporada" TEXT NOT NULL,
    "categorias" TEXT NOT NULL DEFAULT '["primera","segunda","veteranos","femenil","varonil"]',
    "reglasConfig" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Liga" ("categorias", "createdAt", "id", "nombre", "temporada", "updatedAt") SELECT "categorias", "createdAt", "id", "nombre", "temporada", "updatedAt" FROM "Liga";
DROP TABLE "Liga";
ALTER TABLE "new_Liga" RENAME TO "Liga";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
