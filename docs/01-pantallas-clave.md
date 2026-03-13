# 1. Diseño de pantallas clave

Pantallas principales para **captura en mesa**, **resumen del partido** y **acta oficial**, con foco en una sola persona operando y uso offline.

---

## 1.1 Flujo global (alto nivel)

```
[Selección de partido] → [Configuración mesa: plantilla, coach, capitán]
    → [Captura en vivo: eventos por minuto]
    → [Resumen / Cierre] → [Foto marcador] → [Acta exportable]
```

---

## 1.2 Pantalla: Selección / Inicio de partido

**Objetivo:** Elegir partido del día (o crear uno si se programa ahí) y validar que ambos equipos tengan al menos 5 jugadores antes de iniciar.

| Zona | Contenido |
|------|------------|
| **Header** | Logo liga, nombre del anotador (si hay sesión). Indicador de conexión (online / offline / pendiente sync). |
| **Lista de partidos del día** | Tarjetas por horario/cancha: Local vs Visitante, categoría, cancha, hora. Estado: Pendiente / En curso / Finalizado. Tap para abrir. |
| **Filtros** | Por categoría, cancha (opcional en MVP). |
| **Acción** | Botón "Iniciar partido" en la tarjeta del partido (o dentro del detalle). |
| **Validación visible** | Antes de "Iniciar": "Equipo Local: 5/5 ✓" y "Equipo Visitante: 5/5 ✓". Si alguno &lt; 5: botón deshabilitado y mensaje "Se requieren al menos 5 jugadores por equipo". |
| **Default** | Si tiempo expira sin 5 jugadores: opción "Registrar default" con motivo (no presentación, etc.). |

**UX:** Lista scrolleable, tarjetas grandes para tap con dedo. Colores discretos por estado (pendiente=neutral, en curso=acento, finalizado=gris).

---

## 1.3 Pantalla: Configuración de mesa (pre-partido)

**Objetivo:** Confirmar jugadores, número de dorsal, plantilla inicial, coach y capitán. El capitán debe estar en cancha.

| Zona | Contenido |
|------|------------|
| **Tabs o secciones** | "Local" | "Visitante". |
| **Por equipo** | Lista de jugadores con: foto/avatar (opcional), nombre, apellido, número. Checkbox "En cancha" (máx. 5). Selectores "Coach" y "Capitán" (dropdown o tap); validación: capitán ∈ plantilla inicial. |
| **Jugador invitado** | Botón "Agregar invitado". Si hay internet: formulario + validaciones (no otro equipo conflicto, mismo horario, no doble partido). Si offline: aviso "Validación de invitado al sincronizar". |
| **Navegación** | "Atrás" (vuelve a selección). "Iniciar partido" (solo si plantilla inicial Local y Visitante = 5 y capitán definido en cada lado). |

**UX:** Vista por equipo clara; dorsales grandes; una mano para marcar "en cancha" y elegir coach/capitán.

---

## 1.4 Pantalla: Captura rápida (durante el partido)

**Objetivo:** Registrar eventos con un tap por jugador + un tap por tipo de evento. Minimizar pasos y errores.

| Zona | Contenido |
|------|------------|
| **Header** | Marcador: Local XX - XX Visitante. Minuto actual (ej. Q2 5:32). Crono corrido. Botón "Pausa" solo para tiempo muerto/medio tiempo (opcional). |
| **Selector de equipo** | Tabs o botones grandes: "Local" | "Visitante". |
| **Área principal** | Lista de jugadores **en cancha** con dorsal grande. Tap en dorsal = selecciona jugador (resaltado). |
| **Botones de evento** | Siempre visibles (sticky footer o barra fija): **[+2]** **[+3]** **[TL]** **[Falta]** **[Sustitución]**. Tamaño grande (min 44px touch target). |
| **TL** | Al pulsar TL: pequeño modal "Anotado" / "Fallado" (o dos botones igual de grandes). |
| **Sustitución** | "Sale" [jugador seleccionado] → elegir "Entra" de banquillo (lista de no-en-cancha). |
| **Deshacer** | Botón "Deshacer último evento" visible (icono + texto). Un solo nivel de deshacer para el último evento. |
| **Alertas** | Toast o banner no intrusivo: "⚠ Juan Pérez (12) tiene 4 faltas". "🚫 María López expulsada (2 técnicas)". |
| **Navegación** | "Finalizar cuarto" cuando corresponda (o automático por tiempo si se implementa crono). Al terminar 4to: ir a Resumen/Cierre. |

**UX:** 
- Modo "captura rápida": sin scroll innecesario; dorsales y botones prioritarios.
- Contraste alto para uso bajo sol/techo.
- Opción de vibración corta en cada registro (configurable).

---

## 1.5 Pantalla: Resumen y cierre del partido

**Objetivo:** Revisar resultado, subir foto obligatoria del marcador, cerrar partido y generar folio.

| Zona | Contenido |
|------|------------|
| **Resumen** | Marcador final. Tabla de puntos por jugador (Local y Visitante). Faltas por jugador. Triples y TL por jugador (opcional en misma vista o pestaña). |
| **Foto del marcador** | Área "Tomar foto del marcador (obligatoria)". Abre cámara. Preview de la foto tomada. Botón "Otra foto" si se equivocó. Fotos opcionales por cuarto: "Añadir foto Q1/Q2/..." (secundario). |
| **Cierre** | Botón "Cerrar partido". Confirmación: "Se generará el acta y el folio. ¿Cerrar?" → Sí. |
| **Post-cierre** | Mensaje de éxito con **folio único** (ej. CPT-2026-00234). Botones: "Ver acta", "Compartir por WhatsApp" (enlace o PDF). Estado: "Partido cerrado - Solo correcciones justificadas". |

**UX:** Flujo lineal; no se puede cerrar sin foto del marcador. Folio copiable al portapapeles.

---

## 1.6 Pantalla: Acta oficial (vista / exportación)

**Objetivo:** Mostrar acta lista para imprimir o compartir (PDF o imagen).

| Elemento en acta | Contenido |
|------------------|------------|
| Encabezado | Nombre de la liga, categoría, fecha y hora. Cancha. |
| Partido | Local vs Visitante. Marcador final. |
| Tabla por equipo | Jugador, número, puntos, faltas, triples, tiros libres (anotados/intentos si se captura). |
| Incidencias | Partido por default, expulsiones, protestas (si hay). |
| Evidencia | Foto del marcador final embebida o enlazada. |
| Pie | Folio único. Nombre y firma (o ID) del anotador. Fecha de cierre. |

**Exportación:** Botón "Exportar PDF" y/o "Compartir imagen". En PWA/Android: uso de APIs de generación de PDF (ej. jsPDF + imagen de la foto) y Web Share o descarga.

---

## 1.7 Otras pantallas mínimas (MVP)

- **Login / acceso:** Liga + PIN del anotador (pantalla simple, guardar sesión offline).
- **Sincronización:** Barra o pantalla de estado: "Pendiente de enviar: N eventos" / "Sincronizando..." / "Todo sincronizado". Botón "Sincronizar ahora".
- **Listado de partidos históricos:** Por equipo o por fecha; tap para ver acta o resumen.
- **Perfil jugador (vista liga/jugador):** Puntos por partido, promedios, triples, faltas; últimos 5 partidos (tabla o mini gráfica).

---

## 1.8 Wireframes de referencia (descripción)

- **Captura rápida:**  
  `[ Header: Local 42 - 38 Visitante | Q2 5:32 ]`  
  `[ Local (tab activo) ] [ Visitante ]`  
  `[ 7 ] [ 12 ] [ 23 ] [ 34 ] [ 55 ]  ← dorsales en cancha`  
  `[ +2 ] [ +3 ] [ TL ] [ Falta ] [ Sustitución ]`  
  `[ Deshacer último evento ]`  
  `[ Sincronizar (3 pendientes) ]`

- **Resumen pre-cierre:**  
  `[ Marcador: 72 - 68 ]`  
  `[ Tabla puntos Local | Visitante ]`  
  `[ 📷 Tomar foto del marcador (obligatoria) ]`  
  `[ Cerrar partido ]`

Estos diseños priorizan **simplicidad**, **una sola persona en mesa** y **uso offline-first** con indicadores claros de estado de sincronización.
