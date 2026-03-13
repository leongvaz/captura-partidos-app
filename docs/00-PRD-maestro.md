# PRD Maestro — Captura Partidos (Basketball Amateur México)

**Versión:** 1.0  
**Fecha:** Febrero 2026  
**Rol:** Product Manager + Arquitecto + UX Designer

---

## 1. Visión del producto

Aplicación móvil **offline-first** para anotación y gestión de estadísticas de basketball amateur en México. Una sola persona en mesa puede operarla; funciona sin internet y sincroniza automáticamente cuando hay señal. Pensada como PWA inicial, con arquitectura lista para empaquetarse (Capacitor) y publicarse en Google Play Store.

---

## 2. Problema que resuelve

- **Hoy:** Se anota en papel; no hay historial digital, actas oficiales ni estadísticas por jugador/equipo.
- **Mañana:** Digitalización de lo que ya se captura (puntos, faltas, tiros libres, triples), actas exportables, historial y confianza en el resultado.

---

## 3. Usuarios y valor

| Usuario | Valor inmediato |
|--------|------------------|
| **Ligas / Organizadores** | Actas oficiales, tabla general, incidencias, pagos, sanciones. |
| **Jugadores** | Perfil con promedios, rankings (scorers, triples), comparador de últimos partidos. |
| **Anotadores** | Captura rápida en mesa, alertas (4 faltas, expulsión), deshacer, sincronización clara. |
| **Confianza** | Foto obligatoria del marcador, folio único, audit log, bloqueo del partido cerrado. |

---

## 4. Contexto de liga

- Ligas dominicales, 8:00–14:00.
- 7+ canchas en paralelo, 50+ equipos.
- Categorías: segunda, intermedia, primera, veteranos, femenil, varonil, mixto.
- Captura actual: faltas, tiros libres, triples, puntos (sin asistencias/robos/pérdidas en MVP).

---

## 5. Reglas del partido (resumen)

- Mínimo 5 jugadores presentes para iniciar; si no se completa en tiempo → default.
- Jugador invitado: validaciones solo con internet (no en otro equipo conflicto, mismo horario, no doble partido ese día).
- Mesa: confirmar nombre, apellido, número; plantilla inicial; coach y capitán (capitán en cancha).
- 4 cuartos × 10 min, tiempo corrido; se detiene solo para tiempo extra.
- Faltas: máx. 5 personales; 5ª = salida; 2 antideportivas o 2 técnicas = expulsión.
- Eventos: +2, +3, TL anotado/fallado, falta, sustitución; cada uno con minuto aproximado.
- Cierre: foto obligatoria del marcador, folio único, acta exportable.

---

## 6. Índice de entregables

| # | Documento | Contenido |
|---|-----------|-----------|
| 1 | [01-pantallas-clave.md](./01-pantallas-clave.md) | Diseño de pantallas: captura, resumen, acta. |
| 2 | [02-modelo-datos.md](./02-modelo-datos.md) | Modelo de datos completo (local + servidor). |
| 3 | [03-sincronizacion.md](./03-sincronizacion.md) | Flujo exacto offline/online y cola de eventos. |
| 4 | [04-validaciones.md](./04-validaciones.md) | Validaciones críticas (5 jugadores, faltas, expulsiones). |
| 5 | [05-stack-y-roadmap.md](./05-stack-y-roadmap.md) | Recomendación tecnológica + roadmap MVP/F2/F3. |
| 6 | [06-play-store.md](./06-play-store.md) | Consideraciones para publicación en Play Store. |
| 7 | [07-especificacion-tecnica.md](./07-especificacion-tecnica.md) | Especificación técnica: endpoints REST, esquema BD, tipos TypeScript. |
| 8 | [08-sprints-y-historias.md](./08-sprints-y-historias.md) | Sprints e historias de usuario para implementación. |
| 9 | [09-checklist-rbac.md](./09-checklist-rbac.md) | Checklist de pruebas RBAC y migración de roles. |
| 10 | [10-estado-del-proyecto.md](./10-estado-del-proyecto.md) | Estado actual: lo implementado y lo pendiente. |
| 11 | [11-propuesta-mvp-android.md](./11-propuesta-mvp-android.md) | Propuesta técnica MVP + Android: diseño detallado, endpoints, sync, plan implementación. |
| 12 | [12-propuesta-mvp-y-plataforma-futura.md](./12-propuesta-mvp-y-plataforma-futura.md) | Separación MVP vs plataforma futura; hosting; Android/APK/Play Store; Top 10 esta semana. |
| 13 | [13-plan-ejecucion-mvp.md](./13-plan-ejecucion-mvp.md) | Plan de ejecución MVP archivo por archivo: bloques 1–6, cambios concretos y qué probar. |

---

*Documento maestro. Detalle en cada entregable listado.*
