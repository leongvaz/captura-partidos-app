# Pruebas de Anotacion Real FIBA

## Suite automatizada

- `frontend`: `npm run test:run`
  - Dominio: score, faltas, expulsiones, bonus, timeouts, replay, overtime, cierre y sustituciones.
- `frontend`: `npm run build`
  - Verifica TypeScript y build PWA.
- `backend`: `npm run build`
  - Verifica TypeScript y Prisma. Si Prisma falla con `EPERM` en Windows, cerrar procesos Node/Prisma que tengan bloqueado `query_engine-windows.dll.node` y repetir.

## Escenario Mesa A: online todo el partido

1. Crear o abrir partido.
2. Configurar mesa con 5 jugadores por equipo y capitanes.
3. Registrar puntos, tiros libres, faltas, sustituciones y tiempos fuera.
4. Verificar indicador de sincronizacion en verde.
5. Ir a resumen y cerrar.
6. Verificar que resumen, acta JSON y PDF tengan el mismo marcador.

## Escenario Mesa B: captura offline y cierre al volver red

1. Abrir partido y configurar mesa con red.
2. Cortar red.
3. Registrar eventos hasta terminar el partido.
4. Ir a resumen: debe advertir pendientes de sincronizacion.
5. Recuperar red o pulsar sincronizar.
6. Cerrar solo cuando pendientes y errores esten en cero.
7. Verificar acta/PDF.

## Escenario Mesa C: perdida de red y deshacer

1. Registrar eventos online hasta que algunos sincronicen.
2. Cortar red.
3. Deshacer el ultimo evento sincronizado.
4. Confirmar que el resumen local ya no lo cuenta y que hay anulacion pendiente.
5. Recuperar red.
6. Sincronizar: el evento debe eliminarse del servidor antes de cerrar.
7. Verificar que marcador local = servidor = acta = PDF.

## Reglas FIBA criticas

- `personales + antideportivas >= 5` expulsa.
- `antideportivas >= 2` expulsa.
- `tecnicas >= 2` expulsa.
- `tecnica >= 1 && antideportiva >= 1` expulsa.
- Falta descalificante directa expulsa.
- `4 personales + 1 tecnica` no expulsa.
- El jugador expulsado no puede registrar nuevos eventos activos ni reingresar.
- El bonus se activa al llegar al umbral de faltas de equipo por periodo.
- Timeouts: 2 primera mitad, 3 segunda mitad, 1 por overtime.
