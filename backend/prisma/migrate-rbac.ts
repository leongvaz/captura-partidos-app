/**
 * Script de migración RBAC: Usuario con ligaId -> Usuario global + MembresiaLiga
 *
 * Ejecutar UNA vez cuando se tenga el schema antiguo (Usuario con ligaId, rol).
 *
 * Pasos:
 * 1. Hacer backup de prisma/dev.db
 * 2. npx tsx prisma/migrate-rbac.ts
 *
 * Este script asume que Usuario tiene ligaId y rol (schema legacy).
 * Si ya existe MembresiaLiga, se considera migrado y no hace nada.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function tableExists(name: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    name
  );
  return r.length > 0;
}

async function usuarioHasLigaId(): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `PRAGMA table_info(Usuario)`
  );
  return r.some((c) => c.name === 'ligaId');
}

async function main() {
  const hasMembresia = await tableExists('MembresiaLiga');
  if (hasMembresia) {
    console.log('MembresiaLiga ya existe. Migración RBAC ya aplicada.');
    return;
  }

  const hasLigaId = await usuarioHasLigaId();
  if (!hasLigaId) {
    console.log('Usuario ya no tiene ligaId. Esquema nuevo detectado.');
    console.log('Si necesitas migrar datos legacy, restaura el backup y ejecuta de nuevo.');
    return;
  }

  console.log('Iniciando migración RBAC...');

  // 1. Crear tabla MembresiaLiga
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "MembresiaLiga" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "ligaId" TEXT NOT NULL,
      "usuarioId" TEXT NOT NULL,
      "rol" TEXT NOT NULL,
      "activo" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "MembresiaLiga_ligaId_fkey" FOREIGN KEY ("ligaId") REFERENCES "Liga" ("id") ON DELETE CASCADE,
      CONSTRAINT "MembresiaLiga_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "MembresiaLiga_ligaId_usuarioId_rol_key" ON "MembresiaLiga"("ligaId", "usuarioId", "rol")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX "MembresiaLiga_ligaId_idx" ON "MembresiaLiga"("ligaId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX "MembresiaLiga_usuarioId_idx" ON "MembresiaLiga"("usuarioId")`);
  console.log('Tabla MembresiaLiga creada.');

  // 2. Mapeo rol legacy -> nuevo
  const rolMap: Record<string, string> = {
    anotador: 'anotador_partido',
    admin: 'admin_liga',
    capturista: 'capturista_roster',
    capturista_roster: 'capturista_roster',
    admin_liga: 'admin_liga',
    anotador_partido: 'anotador_partido',
    consulta: 'consulta',
  };

  // 3. Poblar MembresiaLiga desde Usuario
  const usuarios = await prisma.$queryRawUnsafe<
    { id: string; ligaId: string; rol: string; activo: number; createdAt: Date; updatedAt: Date }[]
  >(`SELECT id, ligaId, rol, activo, createdAt, updatedAt FROM Usuario`);
  for (const u of usuarios) {
    const rolNuevo = rolMap[u.rol?.toLowerCase()] || 'anotador_partido';
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO MembresiaLiga (id, ligaId, usuarioId, rol, activo, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      u.ligaId,
      u.id,
      rolNuevo,
      u.activo ? 1 : 0,
      u.createdAt.toISOString(),
      u.updatedAt.toISOString()
    );
  }
  console.log(`${usuarios.length} membresías creadas.`);

  // 4. Recrear Usuario sin ligaId ni rol (SQLite no soporta DROP COLUMN en versiones antiguas)
  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Usuario_new" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "nombre" TEXT NOT NULL,
      "pinHash" TEXT,
      "email" TEXT,
      "passwordHash" TEXT,
      "isSuperAdmin" INTEGER NOT NULL DEFAULT 0,
      "activo" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Usuario_new" ("id", "nombre", "pinHash", "email", "passwordHash", "isSuperAdmin", "activo", "createdAt", "updatedAt")
    SELECT "id", "nombre", "pinHash", NULL, NULL, 0, "activo", "createdAt", "updatedAt" FROM "Usuario"
  `);
  await prisma.$executeRawUnsafe(`DROP TABLE "Usuario"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Usuario_new" RENAME TO "Usuario"`);
  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);
  console.log('Usuario actualizado (sin ligaId, rol).');

  console.log('Migración RBAC completada.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
