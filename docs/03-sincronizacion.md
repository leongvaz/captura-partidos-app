# 3. Flujo exacto de sincronización offline/online

Sincronización **offline-first**: todo se guarda localmente primero; cuando hay conexión se sube en cola y se evitan duplicados. El servidor reconstruye el partido aplicando eventos en orden.

---

## 3.1 Principios

1. **Escribir siempre en local:** Partidos, plantilla, eventos e incidencias se crean/actualizan primero en IndexedDB (o SQLite en app empaquetada).
2. **Cola de envío:** Entidades con `synced = false` (o equivalentes) se envían al servidor en orden cuando hay red.
3. **Idempotencia:** IDs generados en cliente (UUID). El servidor acepta `POST` con el mismo `id` y devuelve 200 sin duplicar.
4. **Orden de eventos:** Los eventos de un partido se envían ordenados por `orden` (o `createdAt`) para reconstruir el marcador y las faltas en el servidor.
5. **Cortes de conexión:** Reintentos con backoff; no se borra la cola hasta confirmar 2xx. En caso de error 4xx/5xx se reintenta más tarde.

---

## 3.2 Flujo al registrar un evento (en mesa)

```
[Anotador toca +2 para jugador 12]
    → App calcula minuto actual (crono del partido) y cuarto
    → Crea registro Evento local:
        id: UUID nuevo
        partidoId, jugadorId, tipo: punto_2, minutoPartido, cuarto, orden: N
        synced: false, createdAt: now
    → Guarda en IndexedDB
    → Actualiza vista (marcador, estadísticas en memoria)
    → Si hay conexión: añade evento a cola de sync (no bloquea UI)
```

No se espera respuesta del servidor para seguir capturando. La sincronización es asíncrona.

---

## 3.3 Cola de sincronización (cliente)

**Contenido de la cola (qué subir):**

1. **Partidos nuevos o modificados**  
   Partidos con `estado` cambiado o datos editados y `serverVersion` null o menor que `localVersion`.  
   Orden: por `updatedAt` o por dependencias (partido antes que plantilla y eventos).

2. **Plantilla del partido**  
   Si el partido tiene plantilla y aún no está sincronizada (`synced = false` en plantilla o se envía junto con el partido).

3. **Eventos no sincronizados**  
   Eventos con `synced = false`, ordenados por `partidoId`, luego por `orden` (o `createdAt`).

4. **Incidencias**  
   Incidencias del partido no enviadas.

5. **Cierre de partido**  
   Llamada a `POST /partidos/:id/cerrar` con foto del marcador (upload de archivo) y generación de folio en servidor.

**Estado visual para el anotador:**

- **Offline:** Icono "sin conexión"; texto "Los datos se guardan en tu dispositivo. Se sincronizarán cuando haya internet."
- **Pendiente de enviar:** "N eventos / N partidos pendientes de sincronizar" + botón "Sincronizar ahora".
- **Sincronizando:** Spinner o barra; "Sincronizando..."
- **Enviado:** "Todo sincronizado" (o última fecha de sync).

---

## 3.4 Flujo de envío al servidor (cuando hay red)

```
1. Detección de red: navigator.onLine / evento online
2. Obtener de IndexedDB:
   - Partidos con localVersion > serverVersion (o serverVersion null)
   - Eventos con synced = false, ordenados por partidoId, orden
   - Incidencias no sincronizadas
3. Por cada partido no sincronizado o con cambios:
   - POST o PATCH /partidos (idempotente por id)
   - POST /partidos/:id/plantilla (batch)
4. Por cada evento no sincronizado (agrupados por partidoId, orden):
   - POST /partidos/:id/eventos (batch recomendado) con array de eventos en orden
   - Servidor responde 200 y devuelve serverReceivedAt o equivalente
5. Marcar en local: partidos y eventos como synced = true, serverVersion = X, lastSyncedAt = now
6. Si hay partido cerrado pendiente:
   - Upload foto marcador (multipart)
   - POST /partidos/:id/cerrar (con fotoMarcadorUrl o file)
   - Servidor genera folio y guarda; responde con folio
   - Actualizar partido local con folio y fotoMarcadorUrl
```

**Manejo de errores:**

- **4xx (ej. 400 validación):** No marcar como synced; registrar en log; opcionalmente mostrar "Error de validación" y qué partido/evento falló (para corrección manual o soporte).
- **5xx / red caída:** Reintentar con backoff (ej. 1s, 2s, 4s…) hasta un máximo de reintentos; cola se mantiene.
- **Conflictos (409):** Si el servidor implementa versionado optimista, devolver 409 cuando `serverVersion` sea mayor que el que el cliente envió; entonces el cliente puede refrescar datos del servidor (en MVP se puede evitar conflictos permitiendo solo "última escritura gana" con timestamp).

---

## 3.5 Reconstrucción en servidor

- El servidor **no** depende del orden de llegada de requests; recibe batches de eventos por partido ya ordenados.
- Al recibir `POST /partidos/:id/eventos` con array `[e1, e2, ...]`:
  - Guarda cada evento con el `id` del cliente (evita duplicados si se reenvía).
  - Recalcula o actualiza: puntos por jugador, faltas por jugador, marcador del partido (vista derivada o tabla de resumen).
- Al cerrar partido: genera folio único (ej. secuencia por liga + año), guarda URL de la foto del marcador y marca partido como `finalizado`.

---

## 3.6 Descarga inicial (opcional para MVP)

Para que el anotador tenga equipos y jugadores en offline:

- Al iniciar sesión (con red): `GET /equipos?ligaId=`, `GET /jugadores?equipoId=...` (o un único endpoint que devuelva equipos con jugadores) y guardar en IndexedDB.
- Periódicamente (cuando hay red) refrescar listados de equipos/jugadores para esa liga.
- Si no hay red al iniciar sesión: permitir solo partidos ya descargados o datos en caché (mostrar aviso "Sin conexión; datos limitados a lo ya cargado").

---

## 3.7 Resumen del flujo

| Momento | Cliente | Servidor |
|---------|---------|----------|
| Registro de evento | Guarda evento en IndexedDB con `synced = false` | — |
| Hay conexión | Envía partidos/eventos pendientes en orden; marca `synced = true` al recibir 200 | Recibe eventos; guarda por id; reconstruye estadísticas |
| Corte de conexión | Sigue guardando en local; cola sigue creciendo | — |
| Reconexión | Vuelve a intentar envío de cola; reintentos con backoff | Idem |
| Cierre de partido | Sube foto + `POST /partidos/:id/cerrar`; guarda folio en local | Genera folio; guarda foto; marca partido finalizado |

Con esto la app es **confiable en mesa** sin depender de la red y **sincroniza automáticamente** cuando hay señal, sin duplicados y manejando cortes de conexión.
