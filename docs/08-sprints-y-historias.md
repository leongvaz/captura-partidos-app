# 8. Sprints e historias de usuario — Implementación

Historias de usuario (As a… I want… So that…) agrupadas por epic, y desglose en **sprints** con tareas concretas para empezar a desarrollar. Enfoque en **MVP** (Sprints 1–3) y referencias a Fase 2 y Fase 3.

---

## 8.1 Historias de usuario por epic

### Epic 1: Autenticación y contexto de liga

| ID | Historia | Criterios de aceptación |
|----|----------|--------------------------|
| U1.1 | **Como** anotador **quiero** iniciar sesión con mi liga y PIN **para** acceder solo a los partidos de mi liga. | Dado que tengo ligaId y PIN correctos, cuando envío el formulario entonces recibo un token y veo el nombre de la liga y mi nombre. Si el PIN es incorrecto, veo mensaje de error y no accedo. |
| U1.2 | **Como** anotador **quiero** que mi sesión se guarde localmente **para** no tener que ingresar PIN cada vez (opcional: hasta cerrar sesión). | Al reabrir la app, si hay token válido en almacenamiento local, entro directo al listado de partidos del día. |
| U1.3 | **Como** anotador **quiero** ver si estoy online u offline **para** saber si los datos se sincronizarán. | En el header o barra de estado se muestra un indicador: "Sin conexión" / "Pendiente de sincronizar (N)" / "Sincronizando" / "Todo sincronizado". |

---

### Epic 2: Partidos del día e inicio de partido

| ID | Historia | Criterios de aceptación |
|----|----------|--------------------------|
| U2.1 | **Como** anotador **quiero** ver los partidos del día por liga y fecha **para** elegir cuál voy a anotar. | Veo una lista de partidos con: Local vs Visitante, categoría, cancha, hora, estado (Pendiente / En curso / Finalizado). Puedo filtrar por categoría o cancha (opcional). |
| U2.2 | **Como** anotador **quiero** iniciar un partido solo si ambos equipos tienen 5 jugadores en cancha **para** cumplir la regla. | En "Configuración de mesa" debo marcar exactamente 5 jugadores "En cancha" por equipo. El botón "Iniciar partido" está deshabilitado hasta cumplir esto; si intento iniciar con menos de 5, veo mensaje "Se requieren al menos 5 jugadores por equipo". |
| U2.3 | **Como** anotador **quiero** definir coach y capitán por equipo, con el capitán en cancha **para** cumplir el reglamento. | En configuración de mesa elijo Coach y Capitán por equipo. El capitán debe estar entre los 5 en cancha; si elijo como capitán a alguien que no está en cancha, veo error y no puedo iniciar. |
| U2.4 | **Como** anotador **quiero** registrar un partido perdido por default **para** dejar constancia. | Si un equipo no presenta 5 jugadores en tiempo, puedo elegir "Registrar default" e indicar qué equipo pierde; se crea incidencia y el partido queda en estado default_local o default_visitante. |

---

### Epic 3: Captura rápida durante el partido

| ID | Historia | Criterios de aceptación |
|----|----------|--------------------------|
| U3.1 | **Como** anotador **quiero** ver los jugadores en cancha por equipo con su dorsal **para** registrar eventos con un tap. | En pantalla de captura elijo equipo (Local/Visitante) y veo los 5 jugadores en cancha con dorsal grande; al tocar un dorsal lo selecciono (resaltado). |
| U3.2 | **Como** anotador **quiero** registrar +2, +3, TL (anotado/fallado), falta y sustitución con botones grandes **para** no equivocarme en mesa. | Tras seleccionar jugador, al tocar +2 o +3 se registra el evento con minuto actual. Al tocar TL se muestra "Anotado" / "Fallado" y se registra. Falta y Sustitución (sale/entra) se registran con el minuto del partido. |
| U3.3 | **Como** anotador **quiero** deshacer el último evento **para** corregir un error sin borrar todo. | Hay un botón "Deshacer último evento" que elimina el último evento registrado (solo uno). |
| U3.4 | **Como** anotador **quiero** recibir alertas cuando un jugador llega a 4 o 5 faltas **para** cumplir el reglamento. | Al registrar la 4ª falta personal: toast/banner "⚠ [Nombre] (#[dorsal]) tiene 4 faltas". Al registrar la 5ª: "🚫 [Nombre] tiene 5 faltas – debe salir." Opcional: bloquear más eventos para ese jugador hasta registrar sustitución. |
| U3.5 | **Como** anotador **quiero** recibir alerta al expulsar por 2 antideportivas o 2 técnicas **para** dejar constancia. | Al registrar la 2ª antideportiva o 2ª técnica: alerta "🚫 [Nombre] expulsado (2 antideportivas/técnicas)" y se registra incidencia; el jugador debe salir (sustitución). |

---

### Epic 4: Cierre del partido y acta

| ID | Historia | Criterios de aceptación |
|----|----------|--------------------------|
| U4.1 | **Como** anotador **quiero** cerrar el partido con una foto obligatoria del marcador **para** tener evidencia. | En "Resumen / Cierre" no puedo pulsar "Cerrar partido" hasta haber tomado/subido al menos una foto del marcador. Al confirmar cierre se genera folio único y el partido queda finalizado. |
| U4.2 | **Como** anotador **quiero** ver y exportar el acta oficial (PDF o imagen) **para** entregarla a la liga o compartirla. | Tras cerrar el partido puedo "Ver acta" con: marcador final, puntos y faltas por jugador, categoría, cancha, fecha, folio, foto del marcador, nombre del anotador. Puedo exportar como PDF o compartir por WhatsApp. |
| U4.3 | **Como** anotador **quiero** ver el folio único del partido y compartirlo **para** que cualquiera pueda referenciar el acta. | Tras cerrar se muestra el folio (ej. CPT-2026-00234); puedo copiarlo o compartir enlace/acta por WhatsApp. |

---

### Epic 5: Sincronización offline/online

| ID | Historia | Criterios de aceptación |
|----|----------|--------------------------|
| U5.1 | **Como** anotador **quiero** que todos los eventos se guarden en mi dispositivo aunque no haya internet **para** no perder datos. | Cada evento (puntos, faltas, etc.) se persiste en IndexedDB de inmediato; la UI se actualiza sin esperar al servidor. |
| U5.2 | **Como** anotador **quiero** que al haber conexión se envíen automáticamente los datos pendientes **para** que el servidor tenga el partido actualizado. | Cuando hay red, la app envía partidos y eventos pendientes en orden; al completar se marca "Todo sincronizado" y opcionalmente se muestra última fecha de sync. |
| U5.3 | **Como** anotador **quiero** un botón "Sincronizar ahora" **para** forzar el envío cuando haya señal. | Si hay eventos pendientes, hay un botón visible "Sincronizar ahora"; al pulsarlo se intenta enviar la cola; se muestra estado "Sincronizando" y luego resultado. |
| U5.4 | **Como** anotador **quiero** ver cuántos eventos o partidos están pendientes de enviar **para** saber si debo esperar conexión. | Se muestra "N eventos pendientes" o "N partidos pendientes" (o ambos) cuando hay datos sin sincronizar. |

---

### Epic 6: Panel liga (MVP básico)

| ID | Historia | Criterios de aceptación |
|----|----------|--------------------------|
| U6.1 | **Como** organizador **quiero** ver partidos finalizados e incidencias **para** revisar defaults y expulsiones. | En panel liga (o vista "Historial") veo listado de partidos finalizados con estado; puedo filtrar por incidencias (default, expulsiones). |
| U6.2 | **Como** organizador **quiero** ver historial por equipo: partidos jugados, victorias/derrotas, puntos a favor/en contra **para** armar tabla general. | Por equipo se muestran: partidos jugados, W-L, puntos a favor, puntos en contra (y opcional diferencia). |

---

### Epic 7: Fase 2 — Jugador invitado, pagos, rankings

| ID | Historia | Criterios de aceptación |
|----|----------|--------------------------|
| U7.1 | **Como** anotador **quiero** agregar un jugador invitado con validación en línea **para** cumplir el reglamento. | Si hay internet, al agregar invitado el sistema valida: no otro equipo categoría superior, no mismo horario, no doble partido ese día. Si no hay internet, se permite con aviso "Validación al sincronizar". |
| U7.2 | **Como** organizador **quiero** administrar pagos por equipo (inscripción, multa) y marcar adeudos **para** aplicar regla "pagar antes del 5to partido". | CRUD pagos; marcar pagado; listado de equipos con adeudo; filtro por liga. |
| U7.3 | **Como** jugador **quiero** ver mi perfil con promedios y últimos partidos **para** seguir mi rendimiento. | Perfil: puntos por partido, promedio, triples, faltas; últimos 5 partidos (tabla o mini gráfica). |
| U7.4 | **Como** jugador u organizador **quiero** ver rankings (top scorers, top triples por categoría) **para** reconocer rendimiento. | Rankings por categoría: top N anotadores, top N triples; actualizados con partidos sincronizados. |

---

### Epic 8: Fase 3 — Rol de juegos, playoffs, premios

| ID | Historia | Criterios de aceptación |
|----|----------|--------------------------|
| U8.1 | **Como** organizador **quiero** generar y ver el rol de juegos por categoría **para** tener calendario y canchas. | Calendario con fechas, horarios, canchas; asignación de partidos por categoría. |
| U8.2 | **Como** organizador **quiero** gestionar playoffs (bracket, partidos de eliminatoria) **para** definir campeón. | Bracket de playoffs; partidos de eliminatoria integrados con actas y folios. |
| U8.3 | **Como** organizador **quiero** registrar premios o menciones (MVP partido, mejor anotador temporada) **para** reconocer a jugadores. | Menciones por partido o temporada; integración con rankings. |

---

## 8.2 Sprints — MVP (Fase 1)

Sprints de **2–3 semanas** cada uno (1 dev full stack). Las tareas son implementables y comprobables.

---

### Sprint 1 — Base y autenticación (semanas 1–2)

**Objetivo:** Proyecto creado, auth funcionando, datos de liga/equipos/jugadores/canchas disponibles (online y caché local).

| # | Tarea | Tipo | Criterio de done |
|---|-------|------|------------------|
| 1.1 | Inicializar proyecto frontend (Vite + React + TypeScript + Tailwind) | Setup | `npm run build` pasa; estructura de carpetas (pages, components, store, services, types). |
| 1.2 | Añadir tipos compartidos (entidades, DTOs) desde spec técnica | Dev | Carpeta `shared/types` o `src/types` con entities, api-dtos, local-sync. |
| 1.3 | Inicializar proyecto backend (Fastify o Express + TypeScript) | Setup | `npm run build` pasa; estructura (routes, services, db). |
| 1.4 | Definir esquema BD (Prisma o Drizzle) y migraciones | Dev | Migración aplicada; tablas ligas, usuarios, equipos, jugadores, canchas, partidos, plantilla_partido, eventos, incidencias. |
| 1.5 | Implementar POST /auth/anotador (ligaId + PIN, bcrypt, JWT) | Dev | Login devuelve token y usuario+liga; 401 si PIN incorrecto. |
| 1.6 | Implementar GET /equipos?ligaId=, GET /jugadores?equipoId=, GET /canchas?ligaId= | Dev | Endpoints devuelven JSON tipado; scope por liga del token. |
| 1.7 | Pantalla de login (liga selector + PIN); guardar token en localStorage | Dev | Formulario funcional; redirección a listado de partidos al éxito. |
| 1.8 | Configurar IndexedDB (Dexie): tablas ligas, equipos, jugadores, canchas, usuarios (sesión) | Dev | Al hacer login, opcionalmente guardar liga/equipos/jugadores en IDB para uso offline. |
| 1.9 | Detección online/offline (navigator.onLine + evento) y estado en UI | Dev | Indicador visible en header: "Sin conexión" / "Conectado". |
| 1.10 | Listado de partidos del día (GET /partidos?ligaId=&fecha=); pantalla básica | Dev | Pantalla muestra partidos; fecha por defecto = hoy; si no hay datos, mensaje amigable. |

---

### Sprint 2 — Configuración de mesa y captura (semanas 3–5)

**Objetivo:** Poder iniciar un partido con 5 jugadores por equipo, capitán y coach; captura de eventos en vivo con persistencia local.

| # | Tarea | Tipo | Criterio de done |
|---|-------|------|------------------|
| 2.1 | POST /partidos, PATCH /partidos/:id; GET /partidos/:id | Dev | Crear partido desde app (id generado en cliente); actualizar estado. |
| 2.2 | Pantalla "Configuración de mesa": equipos, jugadores, check "En cancha" (máx. 5), coach y capitán | Dev | Validación: 5 en cancha por equipo; capitán debe estar en cancha; botón "Iniciar partido" solo si se cumple. |
| 2.3 | POST /partidos/:id/plantilla (batch); validación en servidor (5 en cancha, capitán en cancha) | Dev | Al iniciar partido se envía plantilla; servidor rechaza si no cumple reglas. |
| 2.4 | Persistir partido y plantilla en IndexedDB; flujo "Iniciar partido" guarda en local y opcionalmente en servidor | Dev | Partido y plantilla se guardan en IDB; si hay red se envían; si no, quedan pendientes. |
| 2.5 | Pantalla "Captura rápida": selector Local/Visitante, lista de jugadores en cancha con dorsal, selección por tap | Dev | UI funcional; al seleccionar jugador se resalta; crono o minuto aproximado visible. |
| 2.6 | Botones +2, +3, TL (Anotado/Fallado), Falta, Sustitución; creación de evento local con partidoId, jugadorId, tipo, minuto, cuarto, orden | Dev | Cada acción crea registro Evento en IndexedDB con orden incremental; UI actualiza marcador y faltas por jugador. |
| 2.7 | POST /partidos/:id/eventos (batch); idempotencia por id de evento en servidor | Dev | Servidor acepta array de eventos; guarda por id sin duplicar; devuelve 200 con eventos guardados. |
| 2.8 | Deshacer último evento: eliminar último evento de IDB y actualizar UI; opcionalmente eliminar en servidor si ya se había sincronizado (o marcar como anulado) | Dev | Botón "Deshacer último evento" quita el último evento local; si ya estaba en servidor, decisión: solo local hasta siguiente sync o endpoint anulación. |
| 2.9 | Alertas 4 y 5 faltas personales; alerta expulsión (2 antideportivas / 2 técnicas); registrar incidencia en local | Dev | Conteo de faltas por jugador desde eventos; toast/banner al llegar a 4 y 5; al expulsar se crea incidencia en IDB. |
| 2.10 | Flujo "Registrar default": incidencia default_no_presentacion, estado partido default_local o default_visitante | Dev | Pantalla o modal para marcar default; guardar incidencia y actualizar estado del partido en local (y servidor si hay red). |

---

### Sprint 3 — Cierre, acta, sincronización y panel liga (semanas 6–8)

**Objetivo:** Cerrar partido con foto, folio y acta exportable; cola de sincronización fiable; panel básico para liga.

| # | Tarea | Tipo | Criterio de done |
|---|-------|------|------------------|
| 3.1 | Pantalla "Resumen / Cierre": marcador, puntos y faltas por jugador; botón "Tomar foto del marcador" (obligatoria) | Dev | No se puede cerrar sin foto; preview de foto; botón "Cerrar partido" habilitado solo con foto. |
| 3.2 | Subir foto a servidor (multipart o base64); POST /partidos/:id/cerrar con foto; generación de folio único en servidor | Dev | Endpoint cerrar recibe foto; guarda en storage (S3 o disco); genera folio (ej. CPT-2026-XXXXX); actualiza partido estado=finalizado, cerradoAt, fotoMarcadorUrl. |
| 3.3 | Cierre offline: guardar foto en local (blob/IDB o Filesystem); al sincronizar subir foto y llamar a cerrar | Dev | Si no hay red al cerrar, se guarda partido como "pendiente_cierre" con foto local; al haber red se sube foto y se llama a cerrar. |
| 3.4 | Generación de acta (PDF o imagen): marcador, tabla puntos/faltas por jugador, categoría, cancha, fecha, folio, foto, nombre anotador | Dev | GET /partidos/:id/acta devuelve PDF o URL; en frontend se puede generar con jsPDF + datos + imagen. |
| 3.5 | Exportar acta (descargar PDF o compartir por WhatsApp) | Dev | Botón "Exportar PDF" y "Compartir"; Web Share API o descarga según dispositivo. |
| 3.6 | Cola de sincronización: enviar partidos pendientes, luego eventos por partido ordenados por orden; marcar synced tras 200 | Dev | Al detectar red: obtener partidos y eventos con synced=false; enviar en orden; actualizar synced y lastSyncedAt. |
| 3.7 | Estado visual: "N eventos pendientes", "Sincronizando...", "Todo sincronizado"; botón "Sincronizar ahora" | Dev | UI muestra estado y botón; al pulsar "Sincronizar ahora" se ejecuta cola. |
| 3.8 | Panel liga: listado partidos finalizados; filtro por incidencias (default, expulsiones) | Dev | Vista "Historial" o "Panel liga" con tabla o lista de partidos; filtros opcionales. |
| 3.9 | Historial por equipo: partidos jugados, W-L, puntos a favor/en contra | Dev | Por equipo se calculan o consultan partidos jugados, victorias, derrotas, PF, PC. |
| 3.10 | PWA: service worker (vite-plugin-pwa), manifest; instalable y funcionamiento offline básico | Dev | App instalable; precache de assets; rutas críticas funcionan sin red. |

---

## 8.3 Resumen de sprints MVP

| Sprint | Semanas | Entregable principal |
|--------|---------|----------------------|
| **Sprint 1** | 1–2 | Login, datos de liga/equipos/jugadores, listado de partidos del día, BD y API base. |
| **Sprint 2** | 3–5 | Configuración de mesa (5 jugadores, capitán, coach), captura rápida (eventos en local + servidor), alertas faltas/expulsión, default. |
| **Sprint 3** | 6–8 | Cierre con foto y folio, acta exportable, sincronización completa, panel liga e historial por equipo, PWA. |

---

## 8.4 Fase 2 y Fase 3 — Sprints de referencia

**Fase 2 (aprox. 2 sprints):**  
- Jugador invitado con validación en servidor.  
- CRUD equipos/jugadores desde panel liga.  
- Pagos (inscripción, adeudos, regla 5to partido).  
- Perfil jugador y rankings (top scorers, top triples).  
- Audit log y bloqueo partido cerrado con correcciones justificadas.  

**Fase 3 (aprox. 2–3 sprints):**  
- Rol de juegos (calendario, canchas).  
- Playoffs (bracket, partidos eliminatoria).  
- Premios y menciones (MVP, mejor anotador temporada).  
- Notificaciones push (opcional).  

---

## 8.5 Checklist de inicio de desarrollo

- [ ] Repositorio creado (monorepo o front + back separados).  
- [ ] Documentación técnica (doc 07) y este doc (08) en `docs/`.  
- [ ] Tipos TypeScript compartidos disponibles (copiar o paquete `@captura-partidos/types`).  
- [ ] Backend: esquema BD aplicado, auth y endpoints MVP listados en 7.1 implementados.  
- [ ] Frontend: rutas (login, partidos, config mesa, captura, resumen, acta, historial) y estado global definidos.  
- [ ] Primer sprint planificado con tareas 1.1–1.10 asignadas y fechas.  

Con esto tienes **especificación técnica** (endpoints, BD, tipos) y **tareas de implementación** (historias de usuario y sprints) para arrancar el desarrollo.
