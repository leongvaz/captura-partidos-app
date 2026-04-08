# Pendientes — Captura Partidos

Elementos **no contemplados** en los bloques actuales del plan MVP (docs 08, 13) o que quedaron como seguimiento. Se implementan cuando haya prioridad.

---

## Simulación de liga y construcción por fases

**Objetivo:** poder **simular una liga real** en entorno productivo (o staging) para probar flujos end-to-end, **sin asumir que todo el PRD de Fase 2 ya existe**. Se construye **por fases**; lo que hoy falta queda explícito abajo para no mezclar “ya está en código” con “solo planificado”.

### Estado actual vs. lo que aún no hace el programa (referencia rápida)

| Tema | ¿Ya está? | Nota |
|------|-----------|------|
| **Alta de liga desde API/app** | No | Solo `GET /ligas` y `GET /ligas/:id`. Crear liga hoy implica **seed, script o inserción en BD**. |
| **Asignar “dueño/líder” de la liga** | Parcial | El modelo `MembresiaLiga` y roles (`admin_liga`, `capturista_roster`, `anotador_partido`, `consulta`) existen; **no hay flujo** (UI/endpoints) para invitar o dar de alta membresías desde la app. |
| **Líder asigna colaboradores y anotadores** | No | Mismo criterio: RBAC sí, **gestión de usuarios/membresías por el organizador** no. |
| **Links para capitanes/representantes** (inscripción de equipo/jugadores) | No | Documentado en Fase 2 (`docs/16-…`); **no implementado**. |
| **Registro de jugadores** (segundo nombre opcional, apellido paterno/materno, CURP → edad, rama explícita) | No | Hoy `Jugador` tiene `nombre`, `apellido`, `numero`; **equipo** usa `categoria` (no hay rama/CURP/fecha de nacimiento en modelo). |
| **Vigencia de equipos acotada a la temporada** | No | `Liga.temporada` es texto; `Equipo` tiene `activo` pero **sin fechas ni vínculo de vigencia** al calendario de temporada. |

### Fases sugeridas (orden de trabajo)

1. **Fase simulación (mínimo viable para probar):** una liga + usuarios con PIN y `MembresiaLiga` correcta (seed o herramienta/admin puntual), equipos/jugadores/canchas en BD, partidos creados desde la app como hoy. Objetivo: validar captura, sync, cierre, acta y panel en condiciones cercanas a producción.
2. **Fase administración ligas/usuarios:** CRUD o endpoints protegidos para ligas, equipos, jugadores; asignación de roles sin depender solo de seed.
3. **Fase inscripción e invitaciones:** links, representantes/capitanes, campos legales/identidad (CURP, nombres completos, rama), aprobación de solicitudes, vigencia de temporada según reglas de negocio — alineado a `docs/16-plan-fase2-ligas-inscripcion-rol.md`.

---

## Sincronización y backend

- ~~**Sincronizar incidencias**~~ ✅ Hecho: `runSync` envía incidencias `synced === false` a `POST /partidos/:id/incidencias` con `id` idempotente y marca `synced: true`.
- **Subida y almacenamiento de fotos (pendiente):** hoy los flujos capturan archivo (selfie / foto de jugador) y/o el modelo contempla `fotoUrl`, pero **no existe** implementación real de upload a storage (ni Cloudflare, ni Render, ni otro). Definir un storage (ideal: gratuito o con free tier) y flujo: upload (directo o presigned URL) → obtener URL → guardar `fotoUrl` en BD.
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
- **Backend pendiente (doc 10):** CRUD equipos/jugadores (hoy solo lectura) para que `admin_liga` / `capturista_roster` gestionen roster sin tocar BD a mano.
- Ver también la sección **Simulación de liga y construcción por fases** arriba (gap actual vs. plan).

---

## Nuevos pendientes específicos — Liga Texcoco y flujo de invitaciones

- **Flujo Imelda (organizadora Texcoco):**
  - Pantalla web para que la organizadora configure su liga: duración/fechas, ramas (`varonil`, `femenil`, `mixta`), fuerzas por rama (primera, intermedia, segunda), ventana de inscripción de equipos (fecha/hora límite) y canchas (`Techada 1`, `Techada 2`, `Polideportivo`).
  - Generar y mostrar links de invitación (con expiración) para:
    - Anotadores.
    - Capitanes/representantes de equipo (cada capitán registra su equipo y jugadores).
  - Al cerrar la ventana de inscripción, bloquear la creación de nuevos equipos para esa liga/temporada.

- **Inscripción de equipos por capitán:**
  - Flujo web (no app) donde el capitán, usando su link de invitación, se registra (email, contraseña, CURP, selfie) y da de alta:
  - Nombre de equipo, rama y fuerza (ej. `varonil intermedia`). Solo se puede elegir **una** rama y **una** fuerza por equipo.
    - Hasta 15 jugadores con CURP, evitando que un jugador se registre en más de un equipo de la misma liga.
    - Validar CURP y edad por rama: infantil (5–13 años), veteranos (≥40), varonil/femenil (≥14 años; sexo según rama).
    - Permitir que un email sea dueño de uno o varios equipos, sin duplicar cuentas por correo.

- **Calendario y rol de juegos automatizado:**
  - Generar calendario tomando en cuenta:
    - Todos los equipos de una misma rama/fuerza solo se enfrentan entre sí.
    - Evitar que se repitan enfrentamientos en fines de semana consecutivos (en lo posible).
    - Permitir hasta 2 partidos por fin de semana para un equipo cuando sea necesario para equilibrar partidos jugados.
    - Opción para que la organizadora marque equipos que “descansan” un fin de semana, excluyéndolos del rol de esa jornada.
    - Considerar que no todas las ligas juegan solo en domingo: permitir definir uno o varios días de juego por semana (entre semana, fines de semana o mixto).
  - Pantalla para que la organizadora revise, ajuste (si aplica) y confirme el rol de juegos por fin de semana.

- **Eventos y reglas adicionales de partido:**
  - Capturar tiempos fuera por equipo y por cuarto (como eventos de partido).
  - Disparar un evento automático cuando un equipo acumule 5 faltas en un cuarto (importante para bonus de tiros libres).
  - Extender el registro de eventos para tiempo en cancha: entradas/salidas de jugadores con minuto/segundos, calculando minutos jugados.

- **Rankings y tabla:**
  - Definir con más detalle criterios de desempate en la tabla (más allá de porcentaje de victorias): diferencia de puntos, enfrentamiento directo, etc.
  - Ranking de máximo anotador por equipo y, en el futuro, jugador de la semana/MVP del mes por rama/categoría y global.

- **Bug conocido de cierre de partido:**
  - Investigar partido donde no permitía cerrar aunque no había empate; posible causa: las faltas se están contabilizando como puntos en el cálculo del marcador final.
  - Agregar test/fixtures para evitar que faltas u otros eventos no relacionados modifiquen el marcador.

---

*Actualizado: Marzo 2026. Referencia: docs 10 (estado del proyecto), 11–13 (propuestas y plan), 16 (plan Fase 2).*
