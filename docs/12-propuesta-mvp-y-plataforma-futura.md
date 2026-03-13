# 12. Propuesta MVP + Plataforma futura — Separación en dos capas

**Documento:** Lo que se hace YA para validar con una liga local vs lo que se deja preparado para crecer a plataforma de ligas/jugadores. Incluye hosting, Android/APK/Play Store y Top 10 de esta semana.

**Complementa:** [11-propuesta-mvp-android.md](./11-propuesta-mvp-android.md) (diseño técnico detallado D, ejemplos de código, plan de implementación).

---

## Separación en dos capas (instrucción clave)

### Capa 1 — Hacer YA: terminar MVP y validar con liga local

- Objetivo: Una liga pueda usar la app en cancha: captura, cierre (incluso offline), acta con PDF y compartir, default, alertas disciplinarias, panel básico, roles claros.
- No incluye: descubrimiento de ligas, mapas, cola de jugadores, elegibilidad avanzada, marketplace.
- Criterio de éxito: Un anotador real cierra partidos un domingo con o sin internet y obtiene actas compartibles; el organizador ve partidos e incidencias en un panel simple.

### Capa 2 — Preparar sin construir: arquitectura lista para el futuro

- Objetivo: Que el modelo de datos, la estructura de backend/frontend y las decisiones de despliegue no impidan después añadir: ligas con ubicación, canchas con mapa, búsqueda de ligas cercanas, cola de jugadores, reglas de elegibilidad, refuerzos.
- No incluye: Implementar esas funciones en el MVP. Solo nombres de entidades, relaciones y extensiones de schema que no rompan nada hoy.
- Criterio: Cuando llegue Fase 2, no haya que rehacer auth, ni modelo de partido/evento, ni sync; solo añadir tablas/campos y nuevos endpoints.

---

## A. Decisión técnica final recomendada

*(Resumen; detalle en doc 11.)*

- **Frontend:** React + Vite + TypeScript + Tailwind + Zustand + Dexie. PWA hoy; Capacitor para APK.
- **Backend:** Fastify + Prisma + TypeScript. SQLite en desarrollo; PostgreSQL cuando escale.
- **Auth:** JWT + RBAC por liga (Usuario + MembresiaLiga). Un anotador por partido; sin tiempo real.
- **Offline:** IndexedDB (Dexie) como fuente operativa; sync por cola e idempotencia (clientEventId, clientClosureId).
- **Android:** Capacitor (Camera, Filesystem, Share) sobre el mismo build web.

No reescritura a Flutter/RN; no Firebase como núcleo; no WebSockets en MVP; no arquitectura multiusuario colaborativa.

---

## B. Qué conservar, qué ajustar y qué NO tocar

*(Resumen; detalle en doc 11 sección B.)*

- **Conservar:** Estructura de carpetas, login liga+PIN, RBAC, CRUD partidos/plantilla/eventos/incidencias, cierre con foto, GET acta, Dexie, stores, pantallas actuales, PWA.
- **Ajustar:** Partido con estados default_*; evento con tiempoManual/snapshots opcionales; cierre idempotente con clientClosureId; syncStore con cola de cierres; acta con default y PDF; UX rol consulta; panel liga.
- **Añadir:** Flujo registrar default, alertas 5.ª falta y expulsión, cierre offline con foto local, PDF y compartir acta, panel liga MVP, rutas protegidas por rol, preparación Capacitor.
- **NO tocar:** Modelo de Partido/Evento/Incidencia en su núcleo; flujo de login; estructura de MembresiaLiga.

---

## C. Backlog priorizado

### MVP obligatorio (Capa 1)

1. Registrar default / no presentación  
2. Alertas disciplinarias (5.ª falta “debe salir”; expulsión 2 técnicas/2 antideportivas + incidencia)  
3. Acta: exportar PDF y compartir (Web Share + fallback descarga; preparado Capacitor Share)  
4. Cierre offline real (foto local, cola, sync posterior, idempotencia)  
5. Panel de liga MVP (partidos finalizados, filtro incidencias, PJ/PG/PP/PF/PC/DIF por equipo)  
6. UX por rol consulta (ocultar/bloquear crear partido, config, captura, cerrar; rutas protegidas)  

### MVP plus (antes de Fase 2)

7. Tiempo manual en eventos; snapshots jugador en evento  
8. Configuración resultado default (20-0) por liga o global  
9. Documentación técnica alineada con RBAC y flujos nuevos  

### Fase 2 (después de validar MVP)

- CRUD equipos/jugadores desde app  
- Jugador invitado con validación en servidor  
- Pagos (inscripción, adeudos)  
- Perfil jugador y rankings  
- Audit log y correcciones justificadas  

### Fase 3 (plataforma)

- Ligas con ubicación y canchas con mapa  
- Descubrimiento de ligas cercanas  
- Cola de jugadores y refuerzos  
- Reglas de elegibilidad por categoría/rama  
- Marketplace / red de ligas  

---

## D. Diseño técnico detallado

*(Completo en doc 11: entidades, Prisma, endpoints, stores, colas de sync, foto offline, PDF, compartir, RBAC, panel liga, default, alertas. Aquí solo índice.)*

- **Entidades / Prisma:** Partido (estados default_*); Evento (tiempoManual, snapshots, reverted); opcional CierrePartido (clientClosureId) para idempotencia.  
- **Endpoints:** POST `/partidos/:id/registrar-default`; POST cerrar con clientClosureId; GET `/partidos/:id/acta/pdf`; GET liga/panel y liga/equipos-estadisticas.  
- **Stores:** syncStore con cola cierresPendientes; partidoStore con getFaltasAntideportivas/Tecnicas e isJugadorExpulsado.  
- **Default:** Ganador + motivo + incidencia default_no_presentacion + estado default_local | default_visitante + resultado 20-0.  
- **Alertas:** 5.ª falta → mensaje “debe salir” + opcional bloqueo hasta sustitución; 2 antideportivas/2 técnicas → incidencia automática + alerta si expulsado sigue en cancha.  
- **RBAC:** UI y rutas según hasRole; API con requireRole(ROLES_PARTIDO) para escritura.  

Ver doc 11 secciones D.1–D.10 e “Entregables de código” para pseudocódigo y ejemplos.

---

## E. Arquitectura futura sin romper MVP (Capa 2)

Objetivo: poder añadir después descubrimiento de ligas, ubicaciones, canchas con mapa, cola de jugadores y elegibilidad **sin rehacer** el núcleo actual.

### E.1 Ligas con ubicación y sedes (futuro)

- **Hoy (MVP):** `Liga` tiene nombre, temporada, categorías. `Cancha` tiene nombre y ligaId.  
- **Preparación:** No añadir campos de ubicación todavía. Cuando llegue Fase 3:  
  - `Liga`: añadir `ubicacionBase` (texto o lat/lng), `ciudad`, `estado` (opcional).  
  - `Cancha`: añadir `direccion`, `lat`, `lng`, `referencias`, `urlMaps` (opcional).  
- **No rompe MVP:** Son campos opcionales; las pantallas actuales no los usan. Prisma: migración add column nullable.

### E.2 Descubrimiento de ligas (futuro)

- **Hoy:** El usuario entra con ligaId + PIN; no hay “buscar ligas”.  
- **Preparación:** Mantener auth por ligaId. En Fase 3:  
  - Nuevo flujo opcional: pantalla “Buscar ligas” (solo si no hay sesión o si el producto es multi-liga).  
  - Endpoint público o con token limitado: `GET /ligas/disponibles?ciudad=&categoria=` que devuelva ligas con ubicación (y luego con coordenadas para “cercanas”).  
  - La app actual sigue funcionando: quien tiene PIN entra directo a su liga.  
- **No rompe MVP:** No exponer ningún endpoint de descubrimiento en MVP; el modelo Liga ya existe y luego se extiende.

### E.3 Canchas con mapa y “cómo llegar” (futuro)

- **Preparación:** Cancha con lat/lng y urlMaps. En la vista de partido (o de cancha) futura: botón “Ver en mapa” que abre Google Maps con la URL.  
- **No rompe MVP:** Cero cambios en MVP; solo extensión de modelo y nueva pantalla en Fase 3.

### E.4 Cola de jugadores y refuerzos (futuro)

- **Hoy:** Jugador pertenece a un Equipo; plantilla por partido; “invitado” es un flag.  
- **Preparación:**  
  - Mantener `Jugador.equipoId` (puede ser null en futuro si el jugador está “solo en cola”).  
  - En Fase 3: tabla `JugadorPerfil` o ampliar Jugador con `userId` (opcional) para vincular a usuario app; tabla `ColaLiga` (ligaId, jugadorId, categoria, fechaAlta) para “me interesa jugar en esta liga”.  
  - Equipos podrían tener “solicitudes” o “refuerzos” desde esa cola.  
- **No rompe MVP:** No crear ColaLiga ni perfiles públicos en MVP; el modelo actual de Jugador + PlantillaPartido.invitado sigue igual.

### E.5 Reglas de elegibilidad (futuro)

- **Hoy:** Validación básica 5 en cancha, capitán en cancha. Invitado sin reglas complejas.  
- **Preparación:**  
  - En Fase 3: tabla `ReglaLiga` (ligaId, tipo: 'rama_superior' | 'mismo_dia' | 'max_extras', config JSON) o campos en Liga.  
  - Servidor al aceptar plantilla con invitado: consulta partidos del día, categorías, y aplica reglas.  
- **No rompe MVP:** No añadir ReglaLiga ni validación de invitados compleja; solo documentar que “invitado” se validará después en servidor.

### E.6 Resumen Capa 2

- **Hacer ahora en código:** Nada de descubrimiento, mapas ni cola.  
- **Hacer ahora en diseño:** Evitar decisiones que lo impidan: por ejemplo, no asumir “un usuario = una liga fija para siempre”; mantener ligaId en token pero permitir en el futuro que el mismo usuario vea varias ligas o que exista un “modo visitante” para buscar ligas.  
- **Schema:** Mantener Prisma con migraciones reversibles; cuando llegue Fase 3, añadir tablas nuevas (ColaLiga, ReglaLiga) y columnas opcionales (Liga ubicación, Cancha lat/lng) sin borrar nada del MVP.

---

## F. Hosting y despliegue

### F.1 Dónde alojar primero (opción simple y barata)

- **Frontend:**  
  - **Recomendación inicial:** Vercel o Netlify (build desde GitHub; HTTPS; gratis o muy barato para tráfico bajo).  
  - Alternativa: mismo servidor que el backend si es un VPS (nginx sirve el `dist`).  
- **Backend:**  
  - **Recomendación inicial:** Railway o Render (deploy desde repo; Node; variable DATABASE_URL). Railway suele ser muy sencillo; Render tiene tier gratis con límites.  
  - Alternativa: VPS (DigitalOcean, Linode, etc.) con Node + PM2; más control, más trabajo.  
- **Base de datos:**  
  - **Para empezar:** SQLite en el mismo servicio que el backend (archivo en disco). Railway/Render permiten volumen persistente para el archivo .db.  
  - **Cuando crezca:** PostgreSQL gestionado (Railway, Render, Supabase, Neon). Cambiar DATABASE_URL y ejecutar migraciones Prisma.  
- **Fotos:**  
  - **Para empezar:** Disco local en el servidor (carpeta `uploads/`); la API guarda el archivo y devuelve URL relativa (ej. `/uploads/marcador-xxx.jpg`). El frontend usa la misma base URL que la API.  
  - **Cuando crezca:** S3-compatible (AWS S3, Cloudflare R2, MinIO). Subir el blob a un bucket y guardar la URL en Partido.fotoMarcadorUrl. No cambiar la lógica de “subir en cierre”; solo el destino del archivo.

### F.2 Costos / criterio aproximado

- **Mínimo viable:** Frontend en Vercel (free), Backend + SQLite en Railway (plan bajo ~5–7 USD/mes) o Render (free tier con sleep). Fotos en disco. Total ~0–10 USD/mes.  
- **Un poco más estable:** Backend en Railway/Render pagado, PostgreSQL gestionado (Railway/Render/Supabase ~0–25 USD/mes según uso). Fotos siguen en disco o se pasa a R2/S3 (~pocos USD/mes). Total ~15–40 USD/mes.  
- **Si crece:** VPS o instancia dedicada, PostgreSQL en servicio gestionado, S3/R2 para fotos, CDN opcional. Escalar según usuarios y ligas.

### F.3 Stack de despliegue recomendado (inicio)

1. Repo en GitHub.  
2. Frontend: `npm run build`; conectar Vercel al repo, build command `npm run build`, output `dist`. Variable de entorno `VITE_API_URL` = URL del backend.  
3. Backend: Conectar Railway (o Render) al repo; root del backend; build `npm install && npx prisma generate`; start `node dist/index.js` (o `tsx src/index.ts` si usas tsx). Variables: `DATABASE_URL` (para SQLite: `file:./prisma/dev.db` o path en volumen), `JWT_SECRET`, `UPLOAD_DIR` si aplica.  
4. Volumen persistente para SQLite y carpeta uploads en el mismo servicio del backend.  
5. CORS en Fastify permitiendo el origen del frontend (Vercel URL).  

### F.4 Migración futura a PostgreSQL

- Cambiar `provider` en schema.prisma a `postgresql` y `url` a conexión Postgres.  
- Crear migraciones con `prisma migrate dev` (en un entorno con Postgres).  
- Exportar datos de SQLite (script que lea tablas y genere inserts o use herramienta de migración).  
- Desplegar con `DATABASE_URL` de Postgres; ejecutar `prisma migrate deploy`.  
- No tocar la lógica de negocio; solo el datasource y posibles ajustes de tipos (ej. Boolean en SQLite ya es compatible).

---

## G. Android / APK / Play Store

### G.1 ¿Tu app actual puede convertirse en APK?

Sí. Es una web app (React) que se empaqueta con Capacitor. El mismo código corre en navegador (PWA) y dentro del WebView de Capacitor en Android. No hace falta reescribir nada.

### G.2 Qué necesitas

- Node.js y npm (ya lo tienes).  
- Android Studio (para compilar el proyecto Android y tener SDK/emulador).  
- Cuenta de desarrollador en Google Play (pago único ~25 USD) solo cuando vayas a publicar.  
- Capacitor en el proyecto frontend: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`; plugins `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/share`.

### G.3 Pasos con Capacitor (resumen)

1. En el frontend: `npm run build`.  
2. `npx cap init "Captura Partidos" com.tudominio.capturapartidos` (usa un package name único).  
3. `npx cap add android`.  
4. En `capacitor.config.ts`: `webDir: 'dist'`.  
5. Después de cada cambio en la web: `npm run build` y `npx cap sync android` (o `copy android`).  
6. `npx cap open android` → se abre Android Studio; desde ahí compilar y ejecutar en emulador o dispositivo.  
7. Para APK de debug: Build → Build Bundle(s) / APK(s) → Build APK(s). El APK queda en `android/app/build/outputs/apk/`.  
8. Para AAB (requerido por Play Store): Build → Generate Signed Bundle / APK → Android App Bundle.

### G.4 Probar en Android sin publicar

- Conectar un teléfono con USB (depuración USB activada) o usar emulador.  
- En Android Studio: Run. La app se instala y se puede usar.  
- Puedes distribuir el APK de debug por correo o enlace para que otros lo instalen (sin Play Store). No es para producción pero sirve para validar con la liga.  
- Para que la API funcione en el teléfono: el backend debe ser accesible por red (no localhost). Usar la URL del backend desplegado (Railway/Render) en `VITE_API_URL`.

### G.5 Publicar en Google Play

- Crear cuenta Google Play Console; pagar tarifa única.  
- Crear una “aplicación”; subir AAB (no APK) generado con firma de release.  
- Completar ficha: descripción, capturas, política de privacidad (URL), clasificación de contenido.  
- Configurar “Producción” o “Prueba interna/cerrada” y enviar a revisión.  
- Requisitos típicos: política de privacidad, que la app no crashee, permisos justificados (cámara, almacenamiento si usas Filesystem).

### G.6 Qué preparar desde ya para no sufrir después

- **Package name:** Elegir uno definitivo (ej. `com.tudominio.capturapartidos`) desde el `cap init`; cambiarlo después es engorroso.  
- **Firma de release:** Crear keystore para firmar el AAB y guardarlo seguro; sin él no podrás actualizar la misma app en Play Store.  
- **Permisos:** En AndroidManifest solo los necesarios (cámara para foto de marcador; almacenamiento si usas Filesystem para guardar foto/PDF).  
- **Base URL de API:** Tener la API en un dominio/URL estable (no cambiar cada semana) para que la app empaquetada siempre apunte al mismo backend.

### G.7 iPhone / App Store (después)

- Requiere Mac con Xcode y cuenta Apple Developer (~99 USD/año).  
- `npx cap add ios`; abrir proyecto en Xcode, configurar signing, compilar y subir a App Store Connect.  
- Mismo código web; solo la capa nativa es distinta. No priorizar hasta validar MVP en Android y tal vez en PWA.

---

## H. Plan de implementación (orden realista)

*(Lista completa en doc 11 sección I; aquí el orden ejecutable.)*

1. **RBAC UX (rol consulta):** Ocultar/deshabilitar botones y enlaces; guard de rutas para config, captura, resumen.  
2. **Registrar default:** Backend POST `registrar-default`; frontend modal/botón desde partidos del día (o config).  
3. **Acta default:** Backend GET acta con esDefault y resultado 20-0 cuando aplique.  
4. **Alertas 5.ª falta y expulsión:** Conteo en Captura; mensaje “debe salir”; 2 antideportivas/2 técnicas → incidencia + alerta; banner si expulsado sigue en cancha.  
5. **Acta PDF y compartir:** Backend GET acta/pdf; frontend botón Exportar PDF y Compartir (Web Share + fallback descarga).  
6. **Cierre offline:** Dexie fotosCierre + cierresPendientes; syncStore procesa cola; backend cerrar con clientClosureId idempotente; Resumen “Cerrar localmente” cuando no hay red.  
7. **Panel liga:** Backend GET liga/panel y liga/equipos-estadisticas; frontend página Panel con partidos finalizados y tabla equipos (PJ, PG, PP, PF, PC, DIF).  
8. **Documentación:** Actualizar doc 07 (o equivalente) con RBAC y flujos default/cierre offline.  
9. **Tiempo manual / snapshots en evento:** Opcional; campos en Prisma/Dexie y en acta si hay tiempo.  
10. **Capacitor Android:** Init, add android, plugins Camera/Filesystem/Share; abstracción foto (IndexedDB vs Filesystem); probar cierre y compartir en dispositivo.

---

## I. Entregables de código

*(Detalle y ejemplos en doc 11 sección F. Aquí solo lista.)*

**Backend:**  
- `prisma/schema.prisma`: estados default; opcional CierrePartido(clientClosureId); Evento con tiempoManual, snapshots, reverted.  
- `routes/partidos.ts`: POST registrar-default; POST cerrar con clientClosureId; GET acta/pdf.  
- `routes/liga.ts` (nuevo): GET panel, GET equipos-estadisticas.  
- Dependencia: pdfkit (y tipos).  

**Frontend:**  
- `lib/db.ts`: tablas Dexie fotosCierre, cierresPendientes (versión 2).  
- `store/syncStore.ts`: cola pendingCierres; en runSync subir foto y cerrar con clientClosureId.  
- `store/partidoStore.ts`: getFaltasAntideportivasJugador, getFaltasTecnicasJugador, isJugadorExpulsado.  
- `pages/PartidosList.tsx`: botón/modal Registrar default.  
- `pages/Captura.tsx`: alertas 5.ª falta y expulsión; incidencia automática; banner expulsado en cancha.  
- `pages/Resumen.tsx`: cierre offline (guardar foto en Dexie, cola, “Cerrar localmente”).  
- `pages/Acta.tsx`: Exportar PDF, Compartir (Web Share / descarga).  
- `pages/PanelLiga.tsx`: nueva; partidos finalizados + tabla equipos.  
- `App.tsx`: ruta /panel; guard rutas para config/captura/resumen (redirigir consulta).  
- `components/Layout.tsx`: ocultar “Nuevo partido” y enlaces de escritura si rol solo consulta.  
- `lib/api.ts`: clientClosureId en cerrar; opcional uploadFotoMarcador.  

---

## J. Implementación inmediata — Top 10 esta semana

Objetivo: dejar el producto mucho más cerca de poder probarse con una liga real en un domingo. Orden sugerido.

1. **Rol consulta en UI**  
   En Layout: si el usuario tiene solo rol `consulta`, ocultar el botón “Nuevo partido” y los enlaces a Config / Captura / Resumen (o mostrarlos deshabilitados con tooltip “Solo lectura”). En App, guard que redirige a `/` si un usuario consulta intenta entrar a `/partido/:id/config`, `/captura`, `/resumen`. Tiempo: ~1–2 h.

2. **Backend: POST registrar-default**  
   Endpoint `POST /partidos/:id/registrar-default` con body `{ ganador: 'local'|'visitante', motivo?: string }`. Crear incidencia default_no_presentacion, actualizar partido a estado default_visitante o default_local, generar folio y cerradoAt. Respuesta partido actualizado. Tiempo: ~1–2 h.

3. **Frontend: flujo Registrar default**  
   En PartidosList (o en la tarjeta del partido), botón “Registrar default” visible solo para ROLES_PARTIDO. Al pulsar: modal o pantalla simple “¿Quién gana?” (Local / Visitante), campo motivo opcional. Llamar al endpoint y actualizar lista; mostrar estado “default” y enlace a acta. Tiempo: ~2 h.

4. **Acta con default**  
   En backend GET acta (y luego GET acta/pdf): si partido.estado es default_local o default_visitante, incluir en la respuesta `esDefault: true`, `resultadoLocal: 20`, `resultadoVisitante: 0` (o los que guardes). En frontend Acta.tsx mostrar un aviso “Partido ganado por default” y el resultado. Tiempo: ~1 h.

5. **Alerta 5.ª falta**  
   En Captura, tras agregar falta_personal: si getFaltasJugador(jugadorId) === 5, mostrar alert (o toast) claro: “[Nombre] (#[dorsal]) tiene 5 faltas – debe salir.” Opcional: deshabilitar +2/+3/TL/falta para ese jugador hasta que se registre sustitucion_sale + sustitucion_entra. Tiempo: ~1 h.

6. **Expulsión 2 antideportivas / 2 técnicas**  
   En partidoStore: getFaltasAntideportivasJugador, getFaltasTecnicasJugador; isJugadorExpulsado = (antideportivas >= 2 || tecnicas >= 2). En Captura, al registrar falta_antideportiva o falta_tecnica: si el jugador llega a 2, mostrar “Expulsado (2 antideportivas/técnicas)”, crear incidencia en backend (o guardar en Dexie y sincronizar) con tipo expulsion_antideportivas o expulsion_tecnicas. Si el jugador sigue en cancha (está en getJugadoresEnCancha), mostrar un banner “Jugador expulsado aún en cancha”. Tiempo: ~2–3 h.

7. **Exportar PDF del acta**  
   Backend: instalar pdfkit; endpoint GET `/partidos/:id/acta/pdf` que genera PDF con folio, equipos, marcador, jugadores (puntos/faltas), incidencias, y texto “Partido por default” si aplica. Content-Type application/pdf. Frontend: en Acta, botón “Exportar PDF” que hace fetch a esa URL (con token), obtiene blob y dispara descarga (o abre en nueva pestaña). Tiempo: ~2–3 h.

8. **Compartir acta**  
   En Acta: botón “Compartir”. Si `navigator.share` existe, construir archivo del PDF (o del HTML de la acta como alternativa) y llamar `navigator.share({ title: 'Acta ...', files: [file] })`. Si no, fallback: mismo enlace de descarga del PDF. Tiempo: ~1 h.

9. **Panel liga mínimo**  
   Backend: GET `/liga/panel?ligaId=&fechaDesde=&fechaHasta=&conIncidencia=` que devuelve partidos finalizados (y default) con filtros. GET `/liga/equipos-estadisticas?ligaId=` que calcula por equipo: PJ, PG, PP, PF, PC, DIF desde partidos finalizados. Frontend: página `/panel` con lista de partidos y tabla de equipos con esas columnas. Enlace “Panel” en Layout. Tiempo: ~3–4 h.

10. **Cierre offline (base)**  
    Dexie: añadir tabla `fotosCierre` (partidoId, blob) y `cierresPendientes` (id, partidoId, clientClosureId, createdAt). En Resumen: si no hay red (navigator.onLine === false), permitir “Cerrar localmente”: guardar foto en fotosCierre, crear registro en cierresPendientes con clientClosureId (UUID), actualizar partido en Dexie a estado finalizado y folio null. Mostrar mensaje “Se sincronizará cuando haya internet.” En syncStore.runSync: después de partidos y eventos, para cada cierre pendiente: obtener blob, POST multipart a cerrar (con header X-Client-Closure-Id), al 200 actualizar partido con folio y borrar de cierresPendientes. Backend: en POST cerrar, leer header X-Client-Closure-Id; si existe y ya se procesó ese id, devolver 200 con el partido actual (idempotencia). Tiempo: ~4–5 h.

Con estos 10 ítems tendrás: default operativo, alertas disciplinarias, acta en PDF y compartir, panel para el organizador, rol consulta respetado y cierre offline funcional. Lo que puede quedar para la semana siguiente: pulir reintentos de sync, Capacitor (APK) y documentación técnica formal.

---

*Documento 12: separación Capa 1 (MVP ahora) vs Capa 2 (preparar futuro); hosting, Android/APK/Play Store; Top 10 esta semana. Para diseño técnico completo y ejemplos de código ver doc 11.*
