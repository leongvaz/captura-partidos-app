/**
 * RBAC: roles y permisos por liga
 * superadmin (global) | admin_liga | capturista_roster | anotador_partido | consulta
 */

export const ROLES = {
  superadmin: 'superadmin' as const,
  admin_liga: 'admin_liga' as const,
  capturista_roster: 'capturista_roster' as const,
  anotador_partido: 'anotador_partido' as const,
  consulta: 'consulta' as const,
};

export type Rol = (typeof ROLES)[keyof typeof ROLES];

/** Roles que pueden leer roster (equipos, jugadores, canchas) */
export const ROLES_LECTURA_ROSTER: Rol[] = ['consulta', 'admin_liga', 'capturista_roster', 'anotador_partido'];

/** Roles que pueden escribir roster (CRUD equipos/jugadores) */
export const ROLES_ESCRITURA_ROSTER: Rol[] = ['admin_liga', 'capturista_roster'];

/** Roles que pueden operar partidos (crear, config, captura, cerrar) */
export const ROLES_PARTIDO: Rol[] = ['admin_liga', 'anotador_partido'];
