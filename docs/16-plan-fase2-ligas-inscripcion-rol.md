# 16. Plan Fase 2 — Ligas, inscripción, invitaciones y rol de juegos

Documento de planificación (sin código) para la evolución del sistema: alta de ligas por superadmin, invitaciones (organizador, ayudantes, representantes), inscripción de equipos, configuración de liga, generación de rol de juegos (torneo regular + eliminación) y entrega de la misma experiencia en **app** y en **página web**.

**Referencia visual del rol de juegos:** Ver imagen de ejemplo (rol tipo “Domingo 15 de marzo 2026 – Torneo Regular Fecha 7”) con sedes, canchas, horarios y equipos. El sistema generará una imagen/PDF similar con el **estilo del frontend actual** (colores, tipografía, layout).

---

## 1. Hosting y despliegue

- **Hostinger:** Permite montar **React** y **Node.js** (planes Business/Cloud); se puede desplegar la misma app (front + API). Hostinger suele ofrecer **MySQL**; si se decidiera cambiar de motor (hoy **PostgreSQL**) habría que ajustar `provider` en Prisma, migraciones y estrategia de exportación/importación de datos.
- **Alternativas ya citadas (doc 05):** Railway, Render, Fly.io, Vercel (front) + API en otro servicio.
- **Página web vs app:** El frontend actual será **app** (PWA/Capacitor), pero **no todos tendrán la app al inicio**. Se debe ofrecer una **página web** con la **misma funcionalidad** (anotar, ver partidos asignados, inscripción, etc.) para que anotadores y representantes puedan usarla desde el navegador. Mismo código base (React), montado como web para unos y como app para otros.

---

## 2. Alta de liga y organizador (superadmin)

- **Superadmin crea:** liga, temporada, categorías.
- **Organizador por invitación:** link de invitación. Al abrirlo, el futuro organizador registra: **correo**, **celular**, **nombre**, **nombre de la liga** (o solo datos personales si la liga ya está creada).
- **Organizador crea:** todas las **canchas** de la liga. Por cada cancha debe definir **horarios utilizables** (ej. Lunes 18:00–22:00, Sábado 8:00–14:00), porque las canchas pueden compartirse con otras ligas o eventos y tienen ventanas de uso limitadas.

---

## 3. Ayudantes (organizador designa por link)

- El organizador envía **link de invitación** para ayudantes.
- El invitado **crea su cuenta** (email, contraseña, nombre, etc.) y queda como **ayudante** de esa liga con permisos definidos (ver/editar equipos, jugadores, solicitudes, rol de juegos, etc.).

---

## 4. Representantes e inscripción de equipos (link por liga)

- **Link de invitación por liga** para representantes. El representante abre el link (desde la **página web** o la app), se registra como **representante** y da datos del equipo e inscripción.
- **Datos del representante:** nombre, correo, teléfono, **CURP** (del representante). Puede o no ser jugador.
- **Datos del equipo:** **nombre** (único en la liga), **rama** (varonil / femenil / mixto, según lo que el organizador haya habilitado), **categoría** en la que participa (ej. primera, intermedia, segunda A).
- **Jugadores:** hasta **N** (máximo definido por el organizador en la config de la liga, ej. 20). Por jugador: **número**, **nombre**, **CURP**, **foto**.
- **Un representante puede tener 1 o más equipos** si el organizador lo aprueba. Al aprobar una inscripción de alguien que ya tiene equipo(s), el sistema debe **señalar** que es un representante inscribiendo dos o más equipos (para que el organizador lo sepa).
- **Solicitudes de inscripción:** el organizador ve las solicitudes y **aprueba o rechaza**. Dejar **preparado** que en el futuro se pueda activar **auto-aprobación**.
- Organizador y ayudantes pueden **crear / editar / eliminar** equipos y jugadores **manualmente**; debe quedar **registro en BD** (audit log) de quién hizo qué y cuándo.

---

## 5. Configuración de la liga (organizador)

El organizador define **antes de iniciar el torneo** (para futuras generaciones automáticas de rol):

- **Categorías** de la liga (ej. primera, intermedia, segunda A).
- **Ramas** habilitadas (varonil, femenil, mixto) y **categorías por rama** (ej. femenil primera, femenil intermedia).
- **Canchas** y **horarios utilizables** por cancha (días y franjas horarias).
- **Días y horarios** generales de la liga (ej. domingos 8:00–16:00).
- **Número de fechas del torneo regular** (ej. 15 o 16 fechas) antes del torneo de eliminación.
- **Máximo de equipos por categoría** (para no sobrepasar capacidad).
- **Máximo de jugadores por equipo** (ej. 20).
- **Cuántos equipos pasan por categoría** al final del torneo regular (ej. 8 en primera si hay 15 equipos, 16 en intermedia). Sirve para armar el bracket de eliminación.

---

## 6. Reglas de emparejamiento (rol de juegos)

- **Solo misma categoría y misma rama:** Un equipo inscrito en **femenil primera** no se puede enfrentar a varonil primera, ni a femenil intermedia o segunda A. Femenil intermedia solo vs femenil intermedia. Es decir: **categoría + rama** deben coincidir.
- **No enfrentar dos veces al mismo equipo** durante la liga cuando sea posible (salvo que haya pocos participantes y no quede otra opción).
- **Fechas dobles:** Un equipo puede tener **fecha doble** (dos partidos en la misma fecha). **No fecha triple**.
- **Descansos:** Cada equipo debe **descansar al menos una vez** a lo largo de la temporada. En la **imagen/PDF del rol** debe **mencionarse debajo del rol** qué equipos descansan en esa fecha.
- **Organizador define:** cuántas fechas hay (ej. 15, 16), cuántos equipos pasan por categoría al playoff. El sistema debe **avisar** en qué fecha estamos (ej. “Fecha 7 de 15”) y **ir avisando** cuando se acerquen las últimas fechas.

---

## 7. Torneo de eliminación (bracket por siembra)

- Al terminar el torneo regular, los equipos que pasan por categoría se ordenan por **posición** (más partidos ganados = mejor posición).
- **Emparejamiento tipo bracket por siembra:**  
  - 1° vs último clasificado (ej. 16°), 8° vs 9°, 4° vs 13°, 5° vs 12°, 2° vs 15°, 7° vs 10°, 3° vs 14°, 6° vs 11°.  
  - Es decir: 1 vs 16, 8 vs 9, 4 vs 13, 5 vs 12, 2 vs 15, 7 vs 10, 3 vs 14, 6 vs 11 (ejemplo para 16 equipos).
- El **rol de juegos** debe indicar si es **Torneo Regular** o **Torneo de Eliminación** (y en qué ronda, si aplica).

---

## 8. Imagen / PDF del rol de juegos

- **Formato:** Similar a la imagen de referencia compartida (rol “Domingo 15 de marzo 2026 – Torneo Regular Fecha 7”): **fecha**, **tipo** (torneo regular o eliminación), **número de fecha** (ej. Fecha 7 de 15), **sedes** (complejos), **canchas** y **horarios** (ej. 08:00, 09:00…) con **Equipo A vs Equipo B** en cada celda.
- **Estilo:** Misma línea visual que el frontend actual (colores, tipografía, bordes).
- **Debajo del rol:** listado de **equipos que descansan** en esa fecha.
- **Visible para:** organizador, ayudantes, representantes de equipo (y superadmin si se desea). Anotadores ven solo los partidos a los que fueron asignados.

---

## 9. Asignación de anotadores y vista por rol

- **Anotador:** Debe **ver solo los partidos a los que fue asignado** (por el organizador o ayudante). Preferentemente asignar juegos **seguidos en la misma sede** para reducir desplazamientos.
- **Representante:** En su pantalla (app o web) ve el **partido o partidos** asignados a su(s) equipo(s). Un representante puede tener **1 o más equipos** si el organizador lo aprobó; se debe indicar cuando un organizador aprueba a alguien que inscribe 2+ equipos.

---

## 10. Crear partido (ocultar por ahora)

- **Quitar el botón “Crear partido”** en la UI actual, porque a futuro los partidos se generarán **en automático** a partir del rol de juegos.
- El **organizador** (y ayudantes) podrán anotar partidos y hacer todo lo ya definido; el organizador puede administrar **varias ligas** y ver solo las que gestiona. **Superadmin** ve todas las ligas.

---

## 11. Disponibilidad de equipos

- Algún mecanismo (botón o pantalla) para que el organizador o el representante marquen **disponibilidad** del equipo (ej. “este fin de semana no podemos”). El **cálculo del rol** debe considerar solo equipos **disponibles** en cada fecha (junto con canchas y horarios utilizables).

---

## 12. Cálculo del rol (sin IA)

- Es **posible sin IA**: es un problema de asignación con reglas (round-robin o todas contra todas dentro de categoría/rama, respetar descansos, evitar doble enfrentamiento cuando haya suficientes equipos, respetar horarios de canchas y disponibilidad). El algoritmo genera la tabla de partidos por fecha, sede, cancha y hora.

---

## 13. Equipos de prueba (nombres de referencia)

Para futuras pruebas con rol de juegos y liga ficticia, usar nombres de equipos como los del ejemplo de rol:

- ESCUADRON METE LA PATA, VENOMPOOLS, LYNCES, CALACOS, OOZMA KAPPA, CAPITANAS, MEZTLI, LUNAS, BASTARD, STORM B, RUTHLEES, TUNE SQUAT, WILD RACOONS, NEW LEGENDS ELITE, RAPTORS FEM, FEVER, WINNERS, TEPORINGOS, GHOSTS, GOLDEN BEARS, THUNDERS, WIZARDS, JAGUARES, TITANES, CLUB CUERVOS, TOSCOS, C/TIME, CELTAS, RAINBOW, CUERVOS, BLOODY ROAR, LEONES, STARK, LA RETA, STORM V, 90KG+, RAINMEN, KRATOS, TROLAZOS, SIN NOMBRE, CIRCE, GRIZZLIES, STORM F, AMAZONAS, DREAM TEAM, MUSTANGS, HUSKIES, TOYS, LAKERS, LAGARTOS, RANGERS V, TRES CORONAS, CHOCHOLTECOS, THUNDERCATS, RED HAWKS, HARLEM, UB CARBA, BULLS, PLUMAS, KAOS, NERDS, CHAPINGO JUVENIL, CHAPINGO INTER, CHAPINGO MAYOR, INGES, AVENGERS, COSMOS 2.1, GOATS, RAPTORS, FARAONES, BORSHITAS, QUETZALES, IGUANOS, IUSTITIA HORSES, LOBOS, CELTICS, STARS, MAGICS, LUCIERNAGAS, NOXUS, OCOPULCO, OLLIN, SAY, MARINES, NEMESIS, AMIGOS DEL GALLO, MALA INFLUENCIA, DIMA, COLPOS, CHARLOTTE, OSITAS HOT, OXELOTL, VIEJOS SABROSOS.

(Se pueden crear en seed o datos de prueba para una liga ficticia con varias categorías/ramas.)

---

## 14. Resumen de documentos relacionados

- **Invitaciones (links):** organizador (superadmin → organizador), ayudantes (organizador → ayudante), representantes (link por liga).
- **Roles:** superadmin, organizador (puede varias ligas), ayudante, representante (1+ equipos si se aprueba), anotador_partido, consulta.
- **Web y app:** misma experiencia; página web para quien no use la app al inicio.

*Actualizado: Marzo 2026. Referencia: docs 05 (stack/roadmap), 10 (estado), pendientes.md.*
