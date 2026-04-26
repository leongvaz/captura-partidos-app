# GAME RULES

## Principio rector

La fuente oficial de verdad del partido es el conjunto ordenado de eventos de juego validos, procesados por el motor de dominio.

## Score oficial

- El score oficial depende solo de eventos validos de anotacion.
- Los unicos eventos que alteran el score oficial son:
  - `point_2`
  - `point_3`
  - `free_throw_made`
- `free_throw_missed` no suma puntos.
- Las faltas no suman puntos.
- Las faltas de equipo no suman puntos.
- Las sustituciones no alteran puntos ya anotados.
- Las expulsiones o descalificaciones no eliminan puntos previos.
- El score del equipo incluye puntos anotados por cualquier jugador que haya participado, este o no actualmente en cancha.

## Faltas

- Las faltas de jugador se derivan por tipo de evento.
- Las faltas de equipo se derivan por periodo.
- Las faltas de equipo por periodo son independientes del score.
- La visualizacion de faltas del acta es configurable por liga.
- La configuracion por defecto del motor muestra personales + tecnicas + antideportivas en la columna `F`.
- La situacion de bonus se deriva por equipo y periodo cuando las faltas de equipo llegan a `teamFoulPenaltyStartsAt`.

## Sustituciones

- `substitution_out` saca un jugador de cancha.
- `substitution_in` mete un jugador de banca a cancha.
- Una sustitucion no modifica ni revierte eventos previos del jugador.
- Un jugador sustituido conserva todos sus puntos y estadisticas previas.

## Descalificacion / expulsion

- Un jugador descalificado no puede registrar nuevos eventos activos.
- La descalificacion no elimina puntos o estadisticas registradas antes de la expulsion.
- La configuracion FIBA por defecto descalifica cuando:
  - `personales + antideportivas >= 5`
  - `antideportivas >= 2`
  - `tecnicas >= 2`
  - `tecnicas >= 1 && antideportivas >= 1`
  - existe una falta descalificante directa

## Tiempos fuera

- La configuracion FIBA por defecto permite 2 tiempos fuera en la primera mitad.
- La configuracion FIBA por defecto permite 3 tiempos fuera en la segunda mitad.
- La configuracion FIBA por defecto permite 1 tiempo fuera por cada overtime.
- La app registra la decision de la mesa/arbitro; no decide si el momento reglamentario de solicitud es valido.

## Periodos y overtime

- El tiempo reglamentario se compone de `regularPeriods`.
- Si al terminar el tiempo reglamentario hay empate, el partido no puede finalizarse.
- Debe jugarse overtime hasta que exista un ganador si `allowOvertime` y `overtimeUntilWinner` estan activos.
- Cada overtime usa `overtimeDurationSeconds`.

## Reglas manuales vs automatizadas

- Automatizado: score, faltas por jugador, faltas de equipo, bonus, descalificacion, elegibilidad, sustituciones basicas, overtime y cierre.
- Manual/de criterio arbitral: si una falta es personal/tecnica/antideportiva/descalificante, administracion exacta de tiros libres, flecha de posesion, errores corregibles y situaciones especiales complejas.

## Cierre del partido

- El partido solo puede cerrarse cuando el reloj del periodo correspondiente termino y existe diferencia en el score.
- Si el score esta empatado, el cierre queda bloqueado con `TIED_SCORE_REQUIRES_OVERTIME`.
- Si el reloj no termino, el cierre queda bloqueado con `CLOCK_NOT_EXPIRED`.
- Si la liga exige foto final y no fue provista, el cierre queda bloqueado con `CLOSING_PHOTO_REQUIRED`.
- Si se intenta cerrar antes de completar el periodo reglamentario u overtime correspondiente, el cierre queda bloqueado con `REGULATION_NOT_COMPLETED`.

## Separacion de responsabilidades

- El dominio decide:
  - score oficial
  - faltas por jugador
  - faltas por equipo por periodo
  - elegibilidad del jugador
  - overtime
  - posibilidad de cierre
  - razones de bloqueo de cierre
- La UI solo muestra estado derivado y emite intenciones del usuario.
- El backend no debe recalcular score con logica duplicada fuera del motor de dominio.
