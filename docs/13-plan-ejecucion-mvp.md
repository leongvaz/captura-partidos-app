# 13. Plan de ejecución MVP — archivo por archivo

Plan concreto: qué archivo crear, qué archivo editar, qué cambios hacer, en qué orden y qué probar al final de cada bloque. Solo MVP obligatorio.

---

## Convenciones y decisiones previas

### Estados default (una sola convención)

- **`default_local`** = el equipo **local** perdió por default (no presentación). El **visitante** gana. Marcador estándar: local 0, visitante 20.
- **`default_visitante`** = el equipo **visitante** perdió por default. El **local** gana. Marcador estándar: local 20, visitante 0.

Regla al registrar: si el usuario elige "ganador = local" → el visitante perdió → `estado = 'default_visitante'`. Si elige "ganador = visitante" → el local perdió → `estado = 'default_local'`. Usar esta convención en backend (registrar-default), frontend (PartidosList, acta), acta PDF y panel.

### Marcador final almacenado (recomendación)

Conviene guardar **`marcadorLocalFinal`** y **`marcadorVisitanteFinal`** en Partido al cerrar (normal o default), para no recalcular siempre desde eventos en panel e historial. Backend: campos opcionales en Partido; al cerrar (POST cerrar o registrar-default) asignar estos valores. Acta y panel leen de ahí cuando existan. Se puede implementar en Bloque 5 (cierre) y en el endpoint registrar-default del Bloque 2.

---

## Orden de bloques

| Bloque | Contenido                                                        | Archivos                                                |
|--------|------------------------------------------------------------------|---------------------------------------------------------|
| 1      | UX por rol consulta                                              | App, PartidosList, Resumen, Layout (opcional)          |
| 2      | Registrar default                                                | partidos.ts, PartidosList                              |
| 3      | Alertas disciplinarias (offline-first + idempotencia incidencias) | partidoStore, db.ts, syncStore, Captura               |
| 5      | Cierre offline con foto (closurePending)                         | schema Prisma, partidos.ts, db.ts, syncStore, Resumen, PartidosList |
| 7      | Cronómetro de partido (4×10 min, pausable, editable y persistente) | partidoStore, db.ts, Captura, CronometroPartido       |
| 4      | Exportar PDF y compartir acta                                    | partidos.ts, package backend, Acta                     |
| 6      | Panel liga MVP                                                   | liga.ts, index.ts, PanelLiga, App, Layout              |

---

## Bloque 1: UX por rol consulta

**Objetivo:** El rol `consulta` no ve "Nuevo partido", no puede entrar a **config** ni **captura** (se redirige a `/`), pero **sí** puede entrar a **resumen** en solo lectura (ver marcador y datos; no cerrar ni editar). En resumen, ocultar/deshabilitar los botones de cierre para consulta.

### Archivos a editar

- `frontend/src/App.tsx`
- `frontend/src/pages/PartidosList.tsx`
- `frontend/src/pages/Resumen.tsx`
- `frontend/src/components/Layout.tsx` (opcional: enlace Panel; si no, Bloque 6)

### Cambios exactos

**1. `frontend/src/App.tsx`**

- Importar: `import { useLocation, Navigate } from 'react-router-dom';` y `import { useAuthStore, ROLES_PARTIDO } from '@/store/authStore';`
- Crear guard que bloquee **solo** config y captura (no resumen):
  ```tsx
  function RequirePartidoConfigCaptura({ children }: { children: React.ReactNode }) {
    const canWrite = useAuthStore((s) => s.hasRole(...ROLES_PARTIDO));
    const loc = useLocation();
    const isConfigOrCaptura = /^\/partido\/[^/]+\/(config|captura)$/.test(loc.pathname);
    if (!canWrite && isConfigOrCaptura) return <Navigate to="/" replace />;
    return <>{children}</>;
  }
  ```
- Envolver **solo** las rutas `partido/:partidoId/config` y `partido/:partidoId/captura` con este guard. La ruta `partido/:partidoId/resumen` **no** se envuelve (consulta puede acceder).
- Ejemplo: `<Route path="partido/:partidoId/config" element={<RequirePartidoConfigCaptura><ConfigMesa /></RequirePartidoConfigCaptura>} />`, `<Route path="partido/:partidoId/captura" element={<RequirePartidoConfigCaptura><Captura /></RequirePartidoConfigCaptura>} />`, `<Route path="partido/:partidoId/resumen" element={<Resumen />} />` (sin guard).

**2. `frontend/src/pages/PartidosList.tsx`**

- `import { useAuthStore, ROLES_PARTIDO } from '@/store/authStore';`
- `const canWritePartido = useAuthStore((s) => s.hasRole(...ROLES_PARTIDO));`
- Botón "+ Nuevo partido": envolver en `{canWritePartido && ( <button ...>+ Nuevo partido</button> )}`.
- En el `<Link to={...}>` del partido: si `canWritePartido === true`, mantener lógica actual (config si programado, captura si en_curso, resumen si finalizado/default; acta para finalizado/default). Si `canWritePartido === false`: `to={ p.estado === 'finalizado' || p.estado === 'default_local' || p.estado === 'default_visitante' ? \`/partido/${p.id}/acta\` : \`/partido/${p.id}/resumen\` }` — consulta puede abrir resumen (solo lectura) o acta según estado.

**3. `frontend/src/pages/Resumen.tsx`**

- Importar: `import { useAuthStore, ROLES_PARTIDO } from '@/store/authStore';`
- `const canWritePartido = useAuthStore((s) => s.hasRole(...ROLES_PARTIDO));`
- El input de foto del marcador y los botones "Cerrar partido y generar acta" / "Cerrar localmente" deben mostrarse **solo si** `canWritePartido` es true. Si `canWritePartido` es false: no mostrar input de foto ni botones de cierre; opcionalmente texto "Solo lectura". El marcador y la lista de jugadores se muestran siempre.

**4. `frontend/src/components/Layout.tsx`**

- Opcional: añadir `import { Link } from 'react-router-dom';` y `<Link to="/panel">Panel</Link>` en el header. Si lo dejas para Bloque 6, no modificar Layout aquí.

### Orden de implementación

1. `frontend/src/App.tsx` — guard solo para config y captura; resumen sin guard.
2. `frontend/src/pages/PartidosList.tsx` — canWritePartido, ocultar "Nuevo partido", links para consulta a resumen/acta.
3. `frontend/src/pages/Resumen.tsx` — canWritePartido; ocultar input foto y botones de cierre para consulta.
4. `frontend/src/components/Layout.tsx` — (opcional) enlace Panel.

### Pruebas al final del Bloque 1

- Usuario con rol `anotador_partido` o `admin_liga`: ve "Nuevo partido", puede entrar a config, captura y resumen; en resumen ve botones de cierre.
- Usuario con solo rol `consulta`: no ve "Nuevo partido"; al entrar por URL a `/partido/:id/config` o `/partido/:id/captura` es redirigido a `/`; **sí** puede entrar a `/partido/:id/resumen` y ve marcador y jugadores pero **no** ve input de foto ni botones de cierre (solo lectura).
- Desde la lista, con consulta: al tocar partido programado o en_curso va a resumen; al tocar finalizado o default va a acta.

---

## Bloque 2: Registrar default

**Objetivo:** Poder marcar un partido como ganado por default (no presentación): botón/acción, elegir ganador, motivo, resultado 20-0, incidencia automática. Estado según convención: **default_local** = local perdió (visitante gana 20-0); **default_visitante** = visitante perdió (local gana 20-0).

### Archivos a editar

- `backend/src/routes/partidos.ts`
- `frontend/src/pages/PartidosList.tsx`

### Cambios exactos

**1. `backend/src/routes/partidos.ts`**

- Después de `app.patch('/partidos/:id', ...)`, añadir POST `/partidos/:id/registrar-default`.
- Body: `{ ganador: 'local' | 'visitante'; motivo?: string }`. `ganador` = quién gana el partido por default.
- Lógica:
  - Obtener partido; verificar ligaId; si estado ya es `finalizado`, `default_local` o `default_visitante` → 400.
  - **Convención:** Si `ganador === 'local'` → el visitante perdió → `estado = 'default_visitante'`; equipo perdedor = visitanteEquipoId; marcador final local 20, visitante 0. Si `ganador === 'visitante'` → el local perdió → `estado = 'default_local'`; equipo perdedor = localEquipoId; marcador final local 0, visitante 20.
  - Crear incidencia: tipo `default_no_presentacion`, equipoId = equipo que perdió, motivo = body.motivo || 'No presentación'.
  - Actualizar partido: estado, folio = generateFolio(ligaId), cerradoAt = new Date(). Si en el schema existen ya `marcadorLocalFinal` y `marcadorVisitanteFinal`, asignarlos (20-0 o 0-20 según ganador); si no, omitir por ahora.
  - Usar `prisma.$transaction([prisma.incidencia.create(...), prisma.partido.update(...)])`; luego findUnique del partido y devolver partidoToJson(updated).

**2. `frontend/src/pages/PartidosList.tsx`**

- Estado: `const [modalDefault, setModalDefault] = useState<{ partidoId: string; partido: Partido | PartidoLocal } | null>(null);`
- Para cada partido con `p.estado === 'programado'` y `canWritePartido`, mostrar botón "Registrar default" que hace `setModalDefault({ partidoId: p.id, partido: p })`.
- Modal cuando `modalDefault`: título "Registrar partido por default"; "¿Quién gana?" con dos botones "Local" y "Visitante"; input opcional "Motivo"; botón "Confirmar". Al confirmar: `api('/partidos/' + modalDefault.partidoId + '/registrar-default', { method: 'POST', body: { ganador, motivo } })`; al éxito: actualizar lista (setPartidos con el partido devuelto o volver a cargar), `db.partidos.put(partidoDevuelto)` para tenerlo en Dexie, cerrar modal.
- Links: partidos con estado `default_local` o `default_visitante` deben llevar a acta (igual que `finalizado`).

### Orden de implementación

1. `backend/src/routes/partidos.ts` — POST `/partidos/:id/registrar-default` con convención default_local/default_visitante y marcador 20-0.
2. `frontend/src/pages/PartidosList.tsx` — modal, botón "Registrar default", llamada API, actualización lista y Dexie.

### Pruebas al final del Bloque 2

- Partido en programado: ves "Registrar default". Eliges "Local gana" → partido queda en estado `default_visitante` (visitante perdió), folio asignado, incidencia default_no_presentacion con equipoId del visitante. Eliges "Visitante gana" → estado `default_local`, incidencia con equipoId del local.
- En lista, al tocar ese partido vas a acta. Acta (y luego PDF/panel) deben interpretar igual: default_local = local 0, visitante 20; default_visitante = local 20, visitante 0.

---

## Bloque 3: Alertas disciplinarias (offline-first + idempotencia incidencias)

**Objetivo:** 5.ª falta y expulsión (2 antideportivas o 2 técnicas) con **solo alerta y banner** en MVP; **sin bloqueo automático** de acciones. Incidencias de expulsión con **una sola regla**: siempre guardar en local con `synced: false` y siempre subir mediante `runSync()` (no hay POST inmediato al detectar expulsión). Backend acepta `id` de incidencia generado en cliente para idempotencia.

### Política MVP: 5.ª falta y expulsión

- **Solo alerta + banner.** No se bloquea ni se deshabilitan botones (ej. no se impide registrar más eventos para ese jugador hasta sustitución). Decisión explícita: en MVP el sistema **informa** (alerta "debe salir", alerta "Expulsado", banner si expulsado sigue en cancha) y el anotador actúa en consecuencia; el bloqueo automático queda para una fase posterior.

### Archivos a editar

- `backend/src/routes/partidos.ts` (POST incidencias: aceptar `id` y ser idempotente)
- `frontend/src/store/partidoStore.ts`
- `frontend/src/lib/db.ts` (IncidenciaLocal con synced)
- `frontend/src/store/syncStore.ts` (enviar incidencias no synced en runSync; body con `id`)
- `frontend/src/pages/Captura.tsx`

### Cambios exactos

**1. `backend/src/routes/partidos.ts` — idempotencia en incidencias**

- En POST `/partidos/:id/incidencias`: aceptar en el body un campo opcional **`id`** (UUID generado en cliente). Si se envía `id`: buscar `prisma.incidencia.findUnique({ where: { id } })`; si ya existe, devolver **200** con esa incidencia (no duplicar). Si no existe, crear la incidencia con ese `id` y devolver 201. Si no se envía `id`, comportamiento actual (generar id en servidor). Así el cliente puede reenviar la misma incidencia en reintentos de runSync sin duplicar.

**2. `frontend/src/store/partidoStore.ts`**

- Añadir en la interfaz e implementar: `getFaltasAntideportivasJugador(jugadorId: string): number`, `getFaltasTecnicasJugador(jugadorId: string): number`, `isJugadorExpulsado(jugadorId: string): boolean` (true si antideportivas >= 2 o técnicas >= 2).

**3. `frontend/src/lib/db.ts`**

- Definir `export interface IncidenciaLocal extends Incidencia { synced?: boolean }`.
- En la clase CapturaDB usar `IncidenciaLocal` para la tabla `incidencias`. Los objetos guardados incluyen `synced`.

**4. `frontend/src/store/syncStore.ts`**

- En `runSync`, después de **eventos** y **antes** de cierres: obtener incidencias con `synced === false`. Por cada una: `POST /partidos/:partidoId/incidencias` con body **`{ id: incidencia.id, tipo, equipoId?, jugadorId?, motivo? }`** (incluir el `id` generado en cliente para idempotencia). En 200/201: `await db.incidencias.update(incidencia.id, { synced: true });`. Orden runSync: 1) partidos, 2) eventos, 3) incidencias pendientes, 4) cierres pendientes.

**5. `frontend/src/pages/Captura.tsx`**

- Importar del store: `getFaltasAntideportivasJugador`, `getFaltasTecnicasJugador`, `isJugadorExpulsado`. Importar `db`.
- En `handleEvento`, después de `agregarEvento(tipo)`:
  - Si `tipo === 'falta_personal'` y `getFaltasJugador(jugadorSeleccionadoId) === 5`: mostrar **solo alerta**: "[Nombre] (#[dorsal]) tiene 5 faltas – debe salir." (sin bloquear ninguna acción).
  - Si `tipo === 'falta_antideportiva'` o `'falta_tecnica'` y tras agregar `isJugadorExpulsado(jugadorSeleccionadoId)`: determinar `tipoIncidencia` ('expulsion_antideportivas' o 'expulsion_tecnicas'); **solo** guardar en local: `await db.incidencias.add({ id: crypto.randomUUID(), partidoId, tipo: tipoIncidencia, jugadorId: jugadorSeleccionadoId, motivo: null, createdAt: ..., updatedAt: ..., synced: false });`; mostrar alert "Expulsado (2 antideportivas/técnicas)". **No** llamar a la API aquí; la subida es únicamente vía runSync.
- Banner "expulsado aún en cancha": para cada jugador en `enCancha`, si `isJugadorExpulsado(j.id)` mostrar banner arriba: "Jugador expulsado aún en cancha: [nombre] (#dorsal)". Solo informativo; sin bloqueo.

### Orden de implementación

1. `backend/src/routes/partidos.ts` — POST incidencias: aceptar `id` en body; si existe, 200 sin duplicar; si no, crear con ese id.
2. `frontend/src/store/partidoStore.ts` — getFaltasAntideportivasJugador, getFaltasTecnicasJugador, isJugadorExpulsado.
3. `frontend/src/lib/db.ts` — IncidenciaLocal con synced; tabla incidencias tipada como IncidenciaLocal.
4. `frontend/src/store/syncStore.ts` — en runSync, después de eventos, bucle incidencias con synced false; body con `id`; al 200/201 marcar synced true.
5. `frontend/src/pages/Captura.tsx` — alerta 5.ª falta; al expulsar solo guardar en Dexie con synced false (sin POST); banner expulsado en cancha.

### Pruebas al final del Bloque 3

- 5.ª falta: aparece alerta "debe salir"; no se bloquea ningún botón.
- 2.ª antideportiva o 2.ª técnica: alerta de expulsión; incidencia se guarda solo en Dexie con synced false. runSync la envía; GET incidencias del partido la muestra. Reintento de runSync no duplica la incidencia (idempotencia por id cliente).
- Jugador expulsado aún en cancha: se muestra el banner (informativo).

---

## Bloque 4: Exportar PDF y compartir acta

**Objetivo:** Botón Exportar PDF (descarga), botón Compartir (Web Share API con fallback descarga). Backend genera el PDF.

### 4.1 Archivos a crear

- Ninguno.

### 4.2 Archivos a editar

**`backend/package.json`**

- Añadir dependencia: `"pdfkit": "^0.15.0"` (y `"@types/pdfkit": "^0.13.0"` en devDependencies si aplica). Ejecutar `npm install` en backend.

**`backend/src/routes/partidos.ts`**

- Importar PDFDocument de 'pdfkit' (y Buffer si hace falta).
- Añadir ruta GET `/partidos/:id/acta/pdf`: misma autorización que GET acta (preRead). Obtener partido con include (localEquipo, visitanteEquipo, cancha, plantilla.jugador, eventos, incidencias). Calcular puntosPorJugador y faltasPorJugador como en GET acta; localTotal, visitanteTotal. Si partido.estado es default_local o default_visitante, usar marcador 20-0 (local 20 visitante 0 o al revés según quién ganó por default). Crear PDF con PDFDocument; añadir texto: folio, fecha, cancha, categoría, equipos, marcador, tablas de jugadores (número, nombre, puntos, faltas), incidencias, y si es default una línea "Partido ganado por default (no presentación)". Devolver con `reply.header('Content-Type', 'application/pdf').send(stream)` (o buffer si usas doc.end() y buffer). Para PDFKit en Node: crear doc = new PDFDocument, pipe a un buffer (ej. chunks.push), on 'end' reply.send(Buffer.concat(chunks)).

Ejemplo mínimo de generación con PDFKit:
- `const PDFDocument = require('pdfkit');` o `import PDFDocument from 'pdfkit';`
- `const doc = new PDFDocument(); const chunks: Buffer[] = []; doc.on('data', (c: Buffer) => chunks.push(c)); doc.on('end', () => reply.header('Content-Type', 'application/pdf').send(Buffer.concat(chunks)));`
- `doc.text('Acta ' + partido.folio); doc.text(partido.localEquipo.nombre + ' ' + localTotal + ' - ' + visitanteTotal + ' ' + partido.visitanteEquipo.nombre);` etc. Luego `doc.end();`

**`frontend/src/pages/Acta.tsx`**

- Añadir estado para loading de PDF/share: `const [downloading, setDownloading] = useState(false);`
- Botón "Exportar PDF": al pulsar, setDownloading(true); fetch con Authorization al endpoint `/partidos/${partidoId}/acta/pdf`, obtener blob; crear enlace de descarga (URL.createObjectURL(blob), a.href, a.download = 'acta-' + folio + '.pdf', a.click()); setDownloading(false).
- Botón "Compartir": si `navigator.share` existe, fetch del PDF blob, crear File con el blob, llamar `navigator.share({ title: 'Acta ' + acta.folio, files: [new File([blob], 'acta.pdf', { type: 'application/pdf' })] })`. Si no existe share o falla, fallback: mismo flujo de descarga que Exportar PDF.
- Mostrar ambos botones debajo del contenido del acta (o en la parte superior). Deshabilitar mientras downloading.

### 4.3 Orden de edición

1. `backend/package.json` — añadir pdfkit; `npm install` en backend.
2. `backend/src/routes/partidos.ts` — GET `/partidos/:id/acta/pdf` con lógica default 20-0 y generación PDF.
3. `frontend/src/pages/Acta.tsx` — botones Exportar PDF y Compartir, fetch con token (getToken() y poner en Authorization), descarga y share.

### 4.4 Qué probar al final del Bloque 4

- En vista acta: "Exportar PDF" descarga un PDF con folio, equipos, marcador, jugadores, incidencias.
- "Compartir" abre el diálogo nativo de compartir (en móvil) o fallback a descarga.
- Partido por default: el PDF muestra 20-0 y texto de default.

---

## Bloque 5: Cierre offline con foto (closurePending)

**Objetivo:** Cerrar partido offline-first, con **foto opcional**. Guardar foto en local (IndexedDB) cuando exista, cerrar partido en local sin red, cola de cierres; al haber red subir (foto si existe) y cerrar con idempotencia (clientClosureId). Diferenciar en local: partido **finalizado localmente pero pendiente de sincronizar** (`closurePending: true`) vs partido **ya sincronizado** (tiene folio y no pendiente). **Nomenclatura:** lo que se muestra sin folio **no** se llama "acta oficial". Usar en la UI un nombre explícito: **"Resumen de cierre pendiente"** (o alternativamente "Acta preliminar"). La vista/contenido sin folio debe etiquetarse siempre con uno de estos nombres; "acta" con folio queda para el documento oficial tras sincronizar.

### Archivos a editar

- `backend/prisma/schema.prisma`
- `backend/src/routes/partidos.ts`
- `frontend/src/lib/db.ts` (PartidoLocal con closurePending; tablas fotosCierre, cierresPendientes)
- `frontend/src/store/syncStore.ts`
- `frontend/src/pages/Resumen.tsx`
- `frontend/src/pages/PartidosList.tsx` (badge "Pendiente sync" si aplica)

### Cambios exactos

**1. Convención local: `closurePending`**

- **PartidoLocal** (en `frontend/src/lib/db.ts`): añadir `closurePending?: boolean`.
- Significado: `closurePending === true` = partido cerrado en local (estado finalizado, cerradoAt rellenado) pero **aún no sincronizado** (sin folio o cola no procesada). Tras runSync con éxito: actualizar partido en Dexie con folio y **closurePending = false** (o borrar la propiedad).
- Partido "con folio" = ya sincronizado; lo que se muestra sin folio es **Resumen de cierre pendiente** / **Acta preliminar**, no acta oficial.

**2. `backend/prisma/schema.prisma`**

- Añadir modelo `CierrePartido` (id, partidoId @unique, clientClosureId @unique, createdAt) y relación en Partido. Ejecutar `npx prisma db push` y `npx prisma generate`.

**3. `backend/src/routes/partidos.ts`**

- En POST cerrar: leer header `X-Client-Closure-Id`. Si existe y ya hay `prisma.cierrePartido.findUnique({ where: { clientClosureId } })`, devolver 200 con partido y folio (idempotente). Tras cerrar, crear `CierrePartido` con partidoId y clientClosureId.
- **Regla nueva (empates):** si el marcador final es **empate**, el backend debe responder 400: **no se permite cerrar**. Se debe registrar tiempo extra hasta que haya ganador.

**4. `frontend/src/lib/db.ts`**

- PartidoLocal con `closurePending?: boolean`.
- Tablas Dexie version 2: `fotosCierre: 'partidoId'`, `cierresPendientes: 'id, partidoId'`. Tipos `FotoCierre { partidoId: string; blob: Blob }` y `CierrePendiente { id: string; partidoId: string; clientClosureId: string; createdAt: string }`.
  - **Nota:** la foto es opcional. Si no hay foto, `fotosCierre` no tendrá registro para ese partido y el sync debe cerrar enviando el formulario sin archivo.

**5. `frontend/src/store/syncStore.ts`**

- En runSync, después de incidencias: procesar `db.cierresPendientes` (foto + X-Client-Closure-Id, POST cerrar). Al 200: actualizar partido en Dexie con partido devuelto, **closurePending: false**, synced true; borrar de fotosCierre y cierresPendientes.
  - Si no hay foto en `fotosCierre`, igual se debe intentar cerrar (con FormData vacío).
- Opcional: en updateCounts contar cierres pendientes para UI.

**6. `frontend/src/pages/Resumen.tsx`**

- Al "Cerrar localmente" (sin red): guardar en fotosCierre y cierresPendientes; actualizar partido en Dexie con `estado: 'finalizado', cerradoAt: ..., folio: null, closurePending: true`. **No** navegar a una pantalla titulada "Acta"; mostrar mensaje: **"Resumen de cierre pendiente. Conecta a internet y pulsa Sincronizar para obtener el folio y el acta oficial."** Opcional: botón "Ir a inicio" o **"Ver resumen de cierre pendiente"** (o "Ver acta preliminar") que muestre el mismo contenido de resumen pero con título/encabezado **"Resumen de cierre pendiente"** o **"Acta preliminar"**, nunca "Acta" a secas.
- Si el partido tiene `closurePending === true`: banner **"Pendiente de sincronizar"** con el texto anterior. En ningún caso usar "Acta oficial" ni "Acta" para el contenido sin folio.
- Con red: flujo actual (POST cerrar); no usar closurePending.
- Con red: cerrar con o sin foto.

**7. `frontend/src/pages/PartidosList.tsx`**

- Si `(p as PartidoLocal).closurePending === true`: badge **"Pendiente sync"** junto al estado, para distinguirlo de partidos ya sincronizados (con folio).

### Orden de implementación

1. `frontend/src/lib/db.ts` — PartidoLocal con `closurePending`; tablas fotosCierre y cierresPendientes (version 2).
2. `backend/prisma/schema.prisma` — CierrePartido; db push y generate.
3. `backend/src/routes/partidos.ts` — idempotencia por X-Client-Closure-Id.
4. `frontend/src/store/syncStore.ts` — procesar cierres en runSync; al éxito closurePending false.
5. `frontend/src/pages/Resumen.tsx` — "Cerrar localmente" con closurePending true; mensaje y opción "Ver resumen de cierre pendiente" / "Acta preliminar"; banner cuando closurePending; nunca "acta oficial" sin folio.
6. `frontend/src/pages/PartidosList.tsx` — badge "Pendiente sync" para closurePending.

### Pruebas al final del Bloque 5

- Con red: cerrar con foto igual; no aparece closurePending.
- Sin red: "Cerrar localmente" → partido con **closurePending true**; en Resumen texto "Resumen de cierre pendiente" / "Acta preliminar" y mensaje de sincronizar; en lista badge "Pendiente sync". Tras Sincronizar: folio asignado, closurePending false, badge desaparece; idempotencia correcta.

---

## Bloque 7: Cronómetro de partido (4×10 min, pausable, editable y persistente)

**Objetivo:** Añadir un cronómetro operativo dentro de la pantalla de captura que permita llevar **4 cuartos de 10 minutos**, con **inicio/pausa/reanudación**, **edición manual del tiempo**, **cambio manual de cuarto** y **persistencia local**. Cada evento debe guardar de forma consistente: `cuarto`, `segundosRestantesCuarto` y `tiempoPartidoSegundos` (segundos jugados acumulados desde el inicio del partido), de acuerdo con la fórmula definida y el crono visible. El cronómetro es una **herramienta práctica para captura**, no un cronómetro oficial de arbitraje.

**Nota de alcance (MVP):** En este bloque, los campos de cronómetro de cada evento (`cuarto`, `segundosRestantesCuarto`, `tiempoPartidoSegundos`) viven solo en el **frontend / almacenamiento local (IndexedDB)**. El backend **no se modifica** para persistirlos; se podrá extender el modelo y los endpoints en una fase posterior si se decide conservar estos datos también en servidor.

### Política UX MVP

- **Cronómetro por periodos hacia atrás**
  - Q1–Q4 se juegan de 10:00 → 0:00.
  - Si al terminar Q4 hay empate, se generan **tiempos extra**: OT1, OT2… de **5:00 → 0:00** hasta que haya ganador.
  - Regla de cierre: **no se puede cerrar** un partido con empate.
- **Cambio de cuarto manual (solo en pausa)**
  - El usuario elige manualmente el cuarto actual (Q1–Q4).
  - Si el crono está corriendo y se intenta cambiar de cuarto:
    - Primero se pausa explícitamente el crono.
  - Si el cuarto actual tiene `segundosRestantesCuarto > 0` y se quiere cambiar:
    - Mostrar confirmación: "El cuarto actual aún no está en 0:00. ¿Cambiar de todos modos?"
- **Edición de tiempo solo en pausa**
  - Si el usuario pulsa "Editar tiempo" mientras el crono corre:
    - Primero se pausa explícitamente el crono.
    - Luego se abre el editor de tiempo (inputs MM:SS).
  - Al guardar el nuevo tiempo, el crono queda en pausa.
- **Eventos permitidos aunque el crono esté pausado**
  - Si el crono está pausado, al registrar un evento se usa el tiempo visible actual del crono.
  - No se bloquea la creación de eventos por estar el crono en pausa.
- **Persistencia y recarga**
  - El estado del crono (cuarto, segundos restantes, si está corriendo o no, `lastTickAt`) se guarda en `PartidoLocal` en Dexie.
  - Tras recargar la página de captura:
    - Se restaura el cuarto y el tiempo desde Dexie.
    - El crono se restaura siempre en pausa (aunque antes estuviera corriendo).
- **Sin cierre automático de partido**
  - Al llegar a 0:00 en el 4º cuarto:
    - El crono se pone en pausa.
    - No se cierra el partido automáticamente.
  - El cierre real sigue siendo responsabilidad de Bloques 4–5.
- **Nota de naming de acciones**
  - `toggleCrono()` se usa para el **botón Play/Pausa** (interacción del usuario).
  - `pausarCronoSiCorriendo()` se usa en **flujos internos** como editar tiempo y cambiar cuarto, cuando se necesita una pausa explícita sin ambigüedad.

### Archivos a crear/editar

- **Crear**
  - `frontend/src/components/CronometroPartido.tsx`

- **Editar**
  - `frontend/src/store/partidoStore.ts`
  - `frontend/src/lib/db.ts`
  - `frontend/src/pages/Captura.tsx`

### Cambios exactos

#### 1. `frontend/src/store/partidoStore.ts` — estado y acciones de crono

**Estado nuevo del crono** en el store del partido actual:

- `cuartoActual: number` (>=1; Q1–Q4 y luego OT1=5, OT2=6…).
- `segundosRestantesCuarto: number` (0–600 en Q1–Q4; 0–300 en OT).
- `cronoRunning: boolean` (por defecto `false`).
- `lastTickAt: string | null` (ISO).

Aclara en el código que `lastTickAt` se guarda para poder calcular correctamente los ticks mientras el crono está corriendo, pero **tras recarga** el crono siempre se restaura en pausa y se puede ignorar `lastTickAt` en ese caso (MVP simple).

**Nuevas acciones sugeridas (API del store):**

- `inicializarCronoSiHaceFalta()`
  - Si `cuartoActual` o `segundosRestantesCuarto` están indefinidos:
    - Poner `cuartoActual = 1`, `segundosRestantesCuarto = 600`, `cronoRunning = false`, `lastTickAt = null`.
- `hidratarCronoDesdePartidoLocal(partidoLocal: PartidoLocal)`
  - Cargar en el store los campos de crono (`cuartoActual`, `segundosRestantesCuarto`, `cronoRunning`, `lastTickAt`) desde el partido local.
  - Si faltan, llamar `inicializarCronoSiHaceFalta()` para aplicar defaults.
  - Al hidratar tras recarga, forzar:
    - `cronoRunning = false`
    - `lastTickAt = null`
- `persistirCronoEnPartidoLocal(partidoId: string)`
  - Leer del estado actual del store:
    - `cuartoActual`, `segundosRestantesCuarto`, `cronoRunning`, `lastTickAt`.
  - Hacer un `db.partidos.update(partidoId, { cuartoActual, segundosRestantesCuarto, cronoRunning, lastTickAt })`.
  - Usar esta función en **momentos clave**:
    - Al pulsar Play.
    - Al pulsar Pausa.
    - Al editar tiempo y guardar.
    - Al cambiar de cuarto y confirmar.
    - Al desmontar/salir de la pantalla de captura.
    - (Opcional) Cada X segundos si se deseara robustez extra.

- `toggleCrono()`
  - Encapsula el comportamiento de Play/Pausa (usado por el botón principal):
    - Si `cronoRunning` es `false`:
      - Asegurar que el crono está inicializado (`inicializarCronoSiHaceFalta()`).
      - Poner `cronoRunning = true` y `lastTickAt = new Date().toISOString()`.
    - Si `cronoRunning` es `true`:
      - Calcular tiempo transcurrido desde `lastTickAt` (en segundos, truncado).
      - Restar ese valor de `segundosRestantesCuarto`, sin bajar de 0.
      - Poner `cronoRunning = false` y `lastTickAt = null`.

- `pausarCronoSiCorriendo()`
  - Si `cronoRunning` es `true`:
    - Aplicar internamente la misma lógica de pausa que en `toggleCrono()` (normalizar `segundosRestantesCuarto` y limpiar `lastTickAt`).
  - Si `cronoRunning` es `false`, no hace nada.
  - Esta acción se usa en flujos internos como:
    - Editar tiempo.
    - Cambiar de cuarto.
    - Desmontar la pantalla de captura.

- `tickCrono()`
  - Si `cronoRunning` es `false`, no hace nada.
  - Si es `true`:
    - Calcular segundos transcurridos desde `lastTickAt`.
    - Restar ese delta de `segundosRestantesCuarto`.
    - Si `segundosRestantesCuarto` llega a 0 o menos:
      - Poner `segundosRestantesCuarto = 0`.
      - `cronoRunning = false`.
      - `lastTickAt = null`.
    - Si aún queda tiempo positivo:
      - Actualizar `lastTickAt = new Date().toISOString()` para el siguiente tick.
  - `tickCrono()` se llamará desde un `setInterval` en `CronometroPartido`.

- `cambiarCuarto(nuevoCuarto: number)`
  - Flujo recomendado:
    - Llamar primero a `pausarCronoSiCorriendo()` para normalizar tiempo y dejarlo en pausa.
    - Si `nuevoCuarto !== cuartoActual`:
      - La UI debe haber pedido confirmación si el cuarto actual tiene `segundosRestantesCuarto > 0`.
      - Al confirmar:
        - Poner `cuartoActual = nuevoCuarto`.
        - Poner `segundosRestantesCuarto = 600`.
        - `cronoRunning = false`.
        - `lastTickAt = null`.

- `editarTiempoManual(minutos: number, segundos: number)`
  - Flujo:
    - Llamar primero a `pausarCronoSiCorriendo()` (si estaba corriendo).
    - Validar y normalizar:
      - `minutos` debe estar en el rango **0–10**.
      - `segundos` debe estar en el rango **0–59**.
      - Si se ingresa algo fuera de rango:
        - O se normaliza (por ejemplo, `minutos = clamp(minutos, 0, 10)`, `segundos = clamp(segundos, 0, 59)`),
        - O se rechaza mostrando un mensaje y no se modifica el estado.
      - En cualquier caso, el valor final **nunca puede superar 10:00 ni ser negativo**.
    - Convertir a segundos:
      - `nuevoTotal = minutos * 60 + segundos`.
      - Limitar a rango [0, 600].
    - Guardar:
      - `segundosRestantesCuarto = nuevoTotal`.
      - `cronoRunning = false`.
      - `lastTickAt = null`.

- `getCronoSnapshot()`
  - Devuelve un objeto con:
    - `cuartoActual`
    - `segundosRestantesCuarto`
    - `tiempoPartidoSegundos`
  - Convención para `tiempoPartidoSegundos` (segundos jugados acumulados desde el inicio del partido):

```ts
tiempoPartidoSegundos =
  suma(duración(periodo i), i=1..cuartoActual-1) +
  (duración(cuartoActual) - segundosRestantesCuarto);

duración(Q1..Q4)=600; duración(OT)=300.
```

  - `tiempoPartidoSegundos` debe ser **consistente con el crono visible y con esta fórmula**. Si el tiempo se corrige manualmente, tanto el tiempo visible como `tiempoPartidoSegundos` se recalculan coherentemente a partir del nuevo estado; pueden cambiar respecto a valores anteriores, pero siempre deben reflejar el estado del crono en el momento de registrar cada evento.

#### 2. `frontend/src/lib/db.ts` — extender `PartidoLocal` y `EventoLocal`

- Extender `PartidoLocal` con los campos de crono:

```ts
export interface PartidoLocal extends Partido {
  // ...campos existentes...
  cuartoActual?: number;
  segundosRestantesCuarto?: number;
  cronoRunning?: boolean;
  lastTickAt?: string | null;
}
```

- Extender `EventoLocal` (o el tipo equivalente de eventos locales):

```ts
export interface EventoLocal extends Evento {
  // ...campos existentes...
  cuarto: number;
  segundosRestantesCuarto: number;
  tiempoPartidoSegundos: number;
}
```

- Asegurarse de que:
  - La tabla `eventos` en Dexie está tipada como `EventoLocal`.
  - Todos los creadores de eventos en el frontend rellenan estos campos usando `getCronoSnapshot()`.

#### 3. `frontend/src/components/CronometroPartido.tsx` — componente obligatorio

- Propósito:
  - Mostrar estado del crono (cuarto + tiempo).
  - Controlar Play/Pausa (`toggleCrono()`), edición de tiempo (`editarTiempoManual` + `pausarCronoSiCorriendo`), y cambio de cuarto (`cambiarCuarto` + `pausarCronoSiCorriendo`).
  - Ejecutar `tickCrono()` con un `setInterval` mientras el crono está corriendo.
  - Coordinar llamadas a `persistirCronoEnPartidoLocal(partidoId)` en los momentos clave.

- Props mínimas:
  - `partidoId: string`.

- Render esperado:
  - Mostrar algo como `Q1 · 10:00` (formateando `segundosRestantesCuarto` a `MM:SS`).
  - Botones:
    - Play/Pausa → `toggleCrono()` + `persistirCronoEnPartidoLocal(partidoId)`.
    - Editar tiempo → `pausarCronoSiCorriendo()` + editor MM:SS + `editarTiempoManual` + `persistirCronoEnPartidoLocal(partidoId)`.
    - Selector de cuarto (Q1–Q4) → `pausarCronoSiCorriendo()` + confirmación si queda tiempo + `cambiarCuarto` + `persistirCronoEnPartidoLocal(partidoId)`.

- Gestión de `tick`:
  - `useEffect` con `setInterval` (p. ej. cada 500–1000 ms):
    - Mientras `cronoRunning` sea `true`, llamar `tickCrono()` periódicamente.
    - Limpiar el intervalo al desmontar.
  - No persistir en Dexie en cada tick; solo en los eventos clave anteriores.

- Persistencia al desmontar:
  - En un `useEffect` con limpieza:
    - `pausarCronoSiCorriendo()`.
    - `persistirCronoEnPartidoLocal(partidoId)`.

#### 4. `frontend/src/pages/Captura.tsx` — integrar cronómetro y tiempos en eventos

- Integrar `CronometroPartido` en la UI:

```tsx
<CronometroPartido partidoId={partidoId} />
```

- En el `useEffect` que carga el partido (`loadPartido(partidoId)`), tras obtener el `PartidoLocal`:
  - Llamar `hidratarCronoDesdePartidoLocal(partidoLocal)`.

- Al crear eventos:
  - Antes de construir el `EventoLocal`, llamar:

```ts
const { cuartoActual, segundosRestantesCuarto, tiempoPartidoSegundos } = getCronoSnapshot();
```

  - Incluir estos valores en el evento:

```ts
const evento: EventoLocal = {
  // ...campos existentes...
  cuarto: cuartoActual,
  segundosRestantesCuarto,
  tiempoPartidoSegundos,
};
```

### Orden de implementación (Bloque 7)

1. `frontend/src/lib/db.ts` — extender `PartidoLocal` y `EventoLocal` con los campos de crono.
2. `frontend/src/store/partidoStore.ts` — añadir estado y acciones de crono.
3. `frontend/src/components/CronometroPartido.tsx` — crear el componente con UI, `setInterval` y persistencia en momentos clave.
4. `frontend/src/pages/Captura.tsx` — integrar el componente, hidratar el crono al cargar y rellenar los tres campos de tiempo en cada `EventoLocal`.

### Pruebas al final del Bloque 7

- Flujo básico del cronómetro (Play/Pausa).
- Edición de tiempo (validación 0–10 min, 0–59 s, sin salir del rango lógico).
- Cambio de cuarto con confirmación si queda tiempo.
- Persistencia tras recarga (se mantiene cuarto y tiempo, en pausa).
- Eventos con tiempo (`cuarto`, `segundosRestantesCuarto`, `tiempoPartidoSegundos` coherentes con el crono visible).
- Sin cierre automático al llegar a 0:00 en Q4.

---

## Bloque 6: Panel liga MVP

**Objetivo:** Vista con partidos finalizados (y default), filtro por incidencias, y tabla por equipo con PJ, PG, PP, PF, PC, DIF. **Regla de marcador:** usar **`marcadorLocalFinal`** y **`marcadorVisitanteFinal`** del partido cuando existan; recalcular desde eventos **solo** cuando esos campos no existan (null/undefined).

### 6.1 Archivos a crear

**`backend/src/routes/liga.ts`**

- Exportar función `ligaRoutes(app)`.
- GET `/liga/panel`: query ligaId (obligatorio), fechaDesde, fechaHasta, conIncidencia (boolean opcional). preHandler: authenticate, requireRole(...ROLES_LECTURA_ROSTER). Buscar partidos con estado finalizado, default_local, default_visitante; filtrar por ligaId y fecha; si conIncidencia true, partidos con al menos una incidencia. Devolver array de partidos con datos básicos. **Marcador por partido:** si el partido tiene `marcadorLocalFinal` y `marcadorVisitanteFinal` no nulos, usarlos para el resultado mostrado; si no, calcular desde eventos (suma de canastas).
- GET `/liga/equipos-estadisticas`: query ligaId. Misma auth. Para cada equipo de la liga: PJ, PG, PP, PF, PC, DIF desde partidos finalizados/default. **Marcador por partido:** si el partido tiene `marcadorLocalFinal` y `marcadorVisitanteFinal`, usar esos valores para PF/PC de local y visitante; **solo si no existen**, recalcular desde eventos del partido. Default: 20-0 (ganador 20, perdedor 0). Estructura: array de { equipoId, nombre, PJ, PG, PP, PF, PC, DIF }. Implementación: partidos con estado in ['finalizado','default_local','default_visitante'], incluir eventos y equipos; por cada partido, obtener marcador con la regla anterior; por cada equipo sumar PJ, PG, PP, PF, PC y DIF.

**`frontend/src/pages/PanelLiga.tsx`**

- Página con useAuthStore para ligaId. Estado: partidos, equiposStats, loading, filtro conIncidencia.
- useEffect: GET `/liga/panel?ligaId=...` (y `?conIncidencia=true` si filtro); GET `/liga/equipos-estadisticas?ligaId=...`. El backend ya devuelve resultado/marcadores usando marcadorLocalFinal/marcadorVisitanteFinal cuando existan.
- Render: título "Panel de liga"; filtro "Solo con incidencias"; tabla partidos (fecha, equipos, resultado, folio, estado); tabla equipos (PJ, PG, PP, PF, PC, DIF).

### 6.2 Archivos a editar

**`backend/src/index.ts`**

- Importar `ligaRoutes` desde `./routes/liga.js`.
- Registrar: `app.register(ligaRoutes, { prefix: '/api/v1' });`

**`frontend/src/App.tsx`**

- Importar PanelLiga; ruta `<Route path="panel" element={<PanelLiga />} />` dentro del Layout.

**`frontend/src/components/Layout.tsx`**

- Enlace "Panel" en el header (si no en Bloque 1): `<Link to="/panel">Panel</Link>`.

### 6.3 Orden de edición

1. `backend/src/routes/liga.ts` — GET panel y GET equipos-estadisticas; en ambos, usar marcadorLocalFinal/marcadorVisitanteFinal cuando existan, sino recalcular desde eventos.
2. `backend/src/index.ts` — registrar ligaRoutes.
3. `frontend/src/pages/PanelLiga.tsx` — página con tabla partidos y tabla equipos.
4. `frontend/src/App.tsx` — ruta /panel.
5. `frontend/src/components/Layout.tsx` — enlace Panel.

### 6.4 Qué probar al final del Bloque 6

- /panel muestra partidos finalizados (y default) de la liga; filtro "Solo con incidencias" funciona. Tabla de equipos con PJ, PG, PP, PF, PC, DIF correctos. Partidos con marcador final guardado usan ese valor; partidos sin él usan cálculo desde eventos.

---

## Resumen de archivos por bloque

| Bloque | Crear                                                     | Editar                                                     |
|--------|-----------------------------------------------------------|------------------------------------------------------------|
| 1      | —                                                         | App.tsx, PartidosList.tsx, Resumen.tsx, Layout.tsx (opcional) |
| 2      | —                                                         | partidos.ts (backend), PartidosList.tsx                   |
| 3      | —                                                         | partidos.ts (backend), partidoStore.ts, db.ts, syncStore.ts, Captura.tsx |
| 5      | —                                                         | schema.prisma, partidos.ts, db.ts, syncStore.ts, Resumen.tsx, PartidosList.tsx |
| 7      | frontend/src/components/CronometroPartido.tsx             | partidoStore.ts, db.ts, Captura.tsx                       |
| 4      | —                                                         | package.json (backend), partidos.ts, Acta.tsx             |
| 6      | backend/src/routes/liga.ts, frontend/src/pages/PanelLiga.tsx | backend/src/index.ts, App.tsx, Layout.tsx               |

Orden global: 1 → 2 → 3 → 5 → 7 → 4 → 6. Al final de cada bloque ejecutar las pruebas indicadas antes de seguir.
