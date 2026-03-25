# Pendientes — Captura Partidos

Elementos **no contemplados** en los bloques actuales del plan MVP (docs 08, 13) o que quedaron como seguimiento. Se implementan cuando haya prioridad.

---

## Sincronización y backend

- ~~**Sincronizar incidencias**~~ ✅ Hecho: `runSync` envía incidencias `synced === false` a `POST /partidos/:id/incidencias` con `id` idempotente y marca `synced: true`.
- **Tabla Sancion (suspensiones):** Modelo en backend (jugadorId, partidosSuspendidos, desdePartidoId, motivo, activa) y lógica para aplicar “no puede jugar los próximos N partidos” cuando se registra expulsión por 2 técnicas (1 partido) o 2 antideportivas (2 partidos). Opcional: endpoint para que el frontend consulte si un jugador está sancionado.

---

## Partidos

- **Editar partidos:** Permitir editar datos básicos (equipos, cancha, fecha, hora) solo para partidos en estado `programado` o `en_curso`. Endpoint PATCH ya existe; falta UI (p. ej. botón “Editar” en detalle o lista). Restricción: solo el **anotador del partido** o el **dueño de la liga** (admin_liga) pueden editar.
- **Eliminar partidos:** Permitir eliminar (o anular) partidos en estado `programado`, con confirmación. Definir si es borrado lógico (estado `cancelado`) o borrado físico. Solo el **anotador del partido** o el **dueño de la liga** pueden eliminar.
- **Cerrar partido / editar o eliminar después de terminado:** Solo el anotador del partido o admin_liga pueden cerrar (ya aplicado en Resumen). Si en el futuro se permite editar o eliminar partidos finalizados, aplicar la misma restricción.

---

## Acta y exportación

- ~~**Exportar acta en PDF**~~ ✅ Hecho: backend `GET /partidos/:id/acta/pdf` + botón “Exportar PDF”.
- ~~**Compartir acta**~~ ✅ Hecho: Web Share API con fallback a descarga.
- **Refinar acta del partido:** Mejorar contenido y presentación del acta generada (marcador, tablas, folio, foto): maquetación, tipografía, datos opcionales (incidencias, tiempos), firma digital o sello si aplica.

---

## Cierre offline

- ~~**Cierre 100% offline**~~ ✅ Hecho: cierre local con `closurePending`, cola `cierresPendientes`, subida en `runSync` con `X-Client-Closure-Id`.

---

## Panel liga

- ~~**Vista panel liga**~~ ✅ Hecho: endpoints `GET /liga/panel` y `GET /liga/equipos-estadisticas`; página `/panel`.

---

## Reglas de partido (nuevo)

- **Empates y tiempos extra:** No se puede cerrar un partido con empate. Si al terminar Q4 queda empate, se debe generar un **tiempo extra de 5:00**; si sigue empate, OT2, OT3… hasta que haya ganador.
- **Foto de cierre:** La foto del marcador es **opcional** al cerrar (online u offline).

---

## Consulta y UX

- **Partido “en curso” para consulta:** Ya se puede abrir Resumen en solo lectura (corregido orden de Hooks). Opcional: indicador “En curso” más visible en la tarjeta del partido; o “Ver en vivo” si el anotador tiene conexión (los datos se cargan desde API).
- **Vista programación:** La lista de partidos del día con selector de fecha ya permite a consulta ver partidos pasados (finalizados), del día (en curso/finalizados) y futuros (programados). No requiere cambio salvo mejora de etiquetas si se desea.

---

---

## Fase 2 — Ligas, inscripción y rol de juegos

- Plan detallado en **[docs/16-plan-fase2-ligas-inscripcion-rol.md](docs/16-plan-fase2-ligas-inscripcion-rol.md)**: invitaciones (organizador, ayudantes, representantes), inscripción por link, config de liga (fechas, categorías, ramas, canchas con horarios), reglas de emparejamiento, torneo regular + eliminación (bracket por siembra), imagen/PDF del rol al estilo del front, descansos, asignación de anotadores, representante con 1+ equipos, página web misma funcionalidad que la app, equipos de prueba (nombres de referencia).

---

*Actualizado: Marzo 2026. Referencia: docs 10 (estado del proyecto), 11–13 (propuestas y plan), 16 (plan Fase 2).*
