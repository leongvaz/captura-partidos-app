# Captura Partidos — Basketball Amateur México

Aplicación móvil **offline-first** para anotación y gestión de estadísticas de basketball amateur en México. Operable por una sola persona en mesa; funciona sin internet y sincroniza automáticamente cuando hay señal. Pensada como PWA inicial, con arquitectura lista para empaquetarse (Capacitor) y publicarse en Google Play Store.

---

## Documentación de diseño

| # | Documento | Contenido |
|---|-----------|-----------|
| 0 | [PRD Maestro](docs/00-PRD-maestro.md) | Visión, problema, usuarios, reglas y índice de entregables |
| 1 | [Pantallas clave](docs/01-pantallas-clave.md) | Diseño de pantallas: captura, resumen, acta |
| 2 | [Modelo de datos](docs/02-modelo-datos.md) | Modelo completo (local + servidor) |
| 3 | [Sincronización](docs/03-sincronizacion.md) | Flujo offline/online y cola de eventos |
| 4 | [Validaciones](docs/04-validaciones.md) | Validaciones críticas (5 jugadores, faltas, expulsiones) |
| 5 | [Stack y roadmap](docs/05-stack-y-roadmap.md) | Recomendación tecnológica + roadmap MVP / Fase 2 / Fase 3 |
| 6 | [Play Store](docs/06-play-store.md) | Permisos, cámara, storage, UX y políticas |
| 7 | [Especificación técnica](docs/07-especificacion-tecnica.md) | Endpoints REST, esquema BD PostgreSQL, tipos TypeScript |
| 8 | [Sprints e historias](docs/08-sprints-y-historias.md) | Historias de usuario y sprints para implementación |

---

## Resumen rápido

- **Problema:** Hoy se anota en papel; no hay historial digital ni actas oficiales.
- **Solución:** Digitalizar lo que ya se captura (puntos, faltas, tiros libres, triples), actas exportables con folio y foto del marcador, historial por equipo y jugador.
- **Usuarios:** Ligas/organizadores, jugadores, anotadores; confianza mediante foto obligatoria, folio único y audit log.
- **Tecnología:** PWA (React + Vite + TypeScript + IndexedDB) → empaquetado con Capacitor → Play Store. Backend: Node + Fastify/Express + PostgreSQL.

---

*Documentación generada como producto real, no demo. Sin apuestas en alcance actual.*
