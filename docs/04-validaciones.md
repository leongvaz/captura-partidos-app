# 4. Validaciones críticas

Reglas de negocio que la app debe aplicar **siempre en cliente** (y el servidor debe revalidar). Incluyen: inicio con 5 jugadores, faltas, expulsiones, invitados (solo con internet) y cierre del partido.

---

## 4.1 Inicio del partido (5 jugadores)

- **Regla:** Un partido NO puede iniciar si algún equipo tiene menos de 5 jugadores presentes (en plantilla inicial).
- **Implementación:**
  - En pantalla "Configuración de mesa": cada equipo debe tener exactamente 5 jugadores con "En cancha" = true (plantilla inicial).
  - El botón "Iniciar partido" está **deshabilitado** hasta que:
    - Local: 5 jugadores en cancha.
    - Visitante: 5 jugadores en cancha.
  - Mensaje visible: "Se requieren al menos 5 jugadores por equipo" si alguno tiene &lt; 5.
- **Default por no presentación:**
  - Si la liga define un tiempo máximo para completar el 5to jugador y no se cumple, se permite "Registrar default" (equipo que pierde por no presentación).
  - Crear incidencia tipo `default_no_presentacion` y marcar partido como `default_local` o `default_visitante` según quién no se presentó.

---

## 4.2 Capitán y coach

- **Regla:** Debe definirse coach y capitán por equipo; el capitán debe estar **en la cancha** (en plantilla inicial).
- **Implementación:**
  - En "Configuración de mesa": selectores "Coach" y "Capitán" por equipo.
  - Validación: el jugador elegido como capitán debe tener "En cancha" = true.
  - Si el usuario intenta marcar como capitán a alguien que no está en cancha: mensaje "El capitán debe estar en la cancha" y no permitir iniciar partido hasta corregir.

---

## 4.3 Tipos de falta y faltas personales (máx. 5)

- **Regla:** En captura se ofrecen **tres tipos de falta:** Normal (personal), Técnica, Antideportiva.
- **Falta personal (normal):** Máximo 5 por jugador; al llegar a 5 el jugador debe salir y ser sustituido. No generan suspensión de partidos posteriores.
- **Implementación:**
  - Por cada evento `falta_personal` del jugador, el cliente cuenta solo `falta_personal` (no antideportivas/técnicas para el límite de 5).
  - Al llegar a **4** personales: alerta "⚠ [Nombre] (#[dorsal]) tiene 4 faltas".
  - Al llegar a **5** personales: alerta "🚫 [Nombre] tiene 5 faltas – debe salir."; jugador considerado expulsado para ese partido (bloquear nuevos eventos salvo sustitución).
  - En acta y resumen, la columna **F** muestra solo faltas personales, con máximo 5.

---

## 4.4 Expulsión (2 antideportivas, 2 técnicas o 1+1) y suspensiones

- **Regla:** Expulsión por: 2 faltas antideportivas, O 2 faltas técnicas, O 1 antideportiva + 1 técnica. También por 5 faltas personales (solo salida, sin suspensión).
- **Suspensiones (para futuras referencias en BD):**
  - 2 técnicas → expulsión + **1 partido de descanso**.
  - 2 antideportivas → expulsión + **2 partidos de descanso**.
  - 1 antideportiva + 1 técnica → expulsión + **1 partido de descanso**.
  - 4 personales + 1 técnica o 1 antideportiva → expulsión, **sin** suspensión (solo sale de ese partido).
- **Implementación:**
  - Cliente mantiene conteo por jugador: `faltas_personales`, `faltas_antideportivas`, `faltas_tecnicas`.
  - Jugador **expulsado** (5 personales, o 2 antideportivas, o 2 técnicas, o 1+1, o 4+1): no permitir nuevos eventos de puntos ni faltas para ese jugador; mostrar modal informativo; solo permitir "Sustitución - Sale".
  - Al registrar la falta que provoca expulsión: crear incidencia `expulsion_antideportivas` o `expulsion_tecnicas` según corresponda (para 1+1 se usa expulsion_tecnicas / 1 partido).
  - En BD se puede registrar tabla Sancion (jugadorId, partidosSuspendidos, motivo) para aplicar suspensiones en partidos futuros (Fase 2).

---

## 4.5 Jugador invitado (solo con internet)

- **Regla:**  
  - No puede estar inscrito en otro equipo de la misma liga en categoría superior (o si está, debe ser misma categoría o menor).  
  - No puede jugar dos partidos en el mismo horario.  
  - No puede haber jugado otro partido previamente ese día.
- **Implementación:**
  - Estas validaciones requieren datos de otros equipos y partidos del día; por tanto se ejecutan **solo si hay conexión**.
  - Si hay internet: al agregar "Jugador invitado", la app (o el servidor vía API) valida:
    - Consulta jugadores por equipo/categoría y partidos del día.
    - Si está en otro equipo de categoría superior → rechazar.
    - Si tiene partido a la misma hora → rechazar.
    - Si ya jugó otro partido ese día → rechazar.
  - Si **no** hay internet: permitir agregar invitado con aviso: "La validación del jugador invitado se realizará al sincronizar. Si no cumple las reglas, el partido podría ser objeto de incidencia."

---

## 4.6 Cierre del partido (foto obligatoria, folio)

- **Regla:** Al terminar el 4to cuarto se cierra el partido; se solicita foto **obligatoria** del marcador final; se genera folio único.
- **Implementación:**
  - Botón "Cerrar partido" solo habilitado cuando:
    - Estado del partido es "en_curso" y se ha marcado como "Fin del 4to cuarto" (o crono llegó a 40 min si está implementado).
    - Hay una foto del marcador cargada (obligatoria).
  - Al confirmar cierre:
    - Si hay red: `POST /partidos/:id/cerrar` con foto; servidor genera folio y devuelve; cliente guarda folio y `estado = finalizado`, `cerradoAt = now`.
    - Si no hay red: guardar localmente `estado = pendiente_cierre`, foto en local; al sincronizar, subir foto y llamar a cerrar; entonces recibir folio y actualizar local.
  - No permitir nuevos eventos una vez cerrado; solo correcciones justificadas vía audit log (ver siguiente sección).

---

## 4.7 Bloqueo del partido cerrado y audit log

- **Regla:** Una vez cerrado el partido, solo se permiten correcciones justificadas; se registra quién, cuándo y motivo.
- **Implementación:**
  - Partido con `estado = finalizado` y `cerradoAt` no null: en cliente no se permiten nuevos eventos ni edición de eventos (o se ocultan botones de captura).
  - Si el organizador/admin permite "corrección":
    - Flujo específico: desbloqueo temporal o pantalla de corrección que pide motivo y registra en `audit_log` (partidoId, usuarioId, accion: correccion_evento, detalle, createdAt).
    - Servidor: endpoint protegido (ej. solo admin_liga) para PATCH de evento o anulación; siempre escribir en audit_log.

---

## 4.8 Resumen de validaciones por capa

| Validación | Cliente | Servidor |
|------------|---------|----------|
| 5 jugadores para iniciar | ✓ Botón deshabilitado + mensaje | ✓ Revalidar al recibir partido/plantilla |
| Capitán en cancha | ✓ No permitir iniciar si no cumple | ✓ Revalidar |
| 5 faltas → salir | ✓ Conteo + alerta + opcional bloqueo | ✓ Conteo desde eventos; rechazar 6ª |
| 2 antideportivas/2 técnicas → expulsión | ✓ Conteo + alerta + incidencia | ✓ Conteo + incidencia |
| Jugador invitado | ✓ Solo si hay red; aviso si offline | ✓ Siempre revalidar al recibir plantilla |
| Foto marcador para cerrar | ✓ Obligatoria para habilitar "Cerrar" | ✓ Obligatoria en POST cerrar |
| Partido cerrado sin edición | ✓ No permitir nuevos eventos | ✓ Rechazar nuevos eventos; audit en correcciones |

Con esto se cubren las reglas críticas para **confiabilidad** y **validez** del partido sin matar el MVP.
