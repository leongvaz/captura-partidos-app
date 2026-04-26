import {
  deriveLegacyMatchState,
  getPeriodInfoFromLegacyCuarto,
  mapLegacyEventToDomainEvent,
} from '../../../shared/match-domain/legacy-adapter.js';
import { applyEvent } from '../../../shared/match-domain/apply-event.js';
import { canFinishMatch, getFinishBlockReasons } from '../../../shared/match-domain/closing.js';
import { validateEvent } from '../../../shared/match-domain/event-validation.js';
import { defaultLeagueRules } from '../../../shared/match-domain/rules-config.js';
import { shouldStartOvertime } from '../../../shared/match-domain/overtime.js';
import type { MatchState } from '../../../shared/match-domain/types.js';
import type { RuleViolation } from '../../../shared/match-domain/errors.js';

type BackendPlantillaLike = {
  equipoId: string;
  jugadorId: string;
  enCanchaInicial: boolean;
  jugador?: {
    numero: number;
    nombre: string;
    apellido: string;
  };
};

type BackendEventoLike = {
  id: string;
  tipo: string;
  jugadorId: string;
  jugadorEntraId?: string | null;
  cuarto: number;
  orden: number;
  createdAt: Date;
  segundosRestantesCuarto?: number | null;
};

type BackendPartidoLike = {
  id: string;
  estado: string;
  localEquipoId: string;
  visitanteEquipoId: string;
  plantilla: BackendPlantillaLike[];
  eventos: BackendEventoLike[];
};

export type CloseClockSnapshot = {
  cuartoActual?: number | null;
  segundosRestantesCuarto?: number | null;
};

function inferClock(partido: BackendPartidoLike, snapshot?: CloseClockSnapshot) {
  if (snapshot?.cuartoActual != null && snapshot?.segundosRestantesCuarto != null) {
    return {
      cuartoActual: Number(snapshot.cuartoActual),
      segundosRestantesCuarto: Number(snapshot.segundosRestantesCuarto),
      cronoRunning: false,
    };
  }

  const lastEvent = [...partido.eventos].sort((a, b) => a.orden - b.orden).at(-1);
  if (lastEvent) {
    const period = getPeriodInfoFromLegacyCuarto(lastEvent.cuarto || 1, defaultLeagueRules);
    return {
      cuartoActual: lastEvent.cuarto || 1,
      segundosRestantesCuarto:
        lastEvent.segundosRestantesCuarto != null
          ? Number(lastEvent.segundosRestantesCuarto)
          : period.durationSeconds,
      cronoRunning: false,
    };
  }

  return {
    cuartoActual: 1,
    segundosRestantesCuarto: defaultLeagueRules.regularPeriodDurationSeconds,
    cronoRunning: false,
  };
}

export function deriveBackendMatchState(
  partido: BackendPartidoLike,
  options?: {
    closingPhotoProvided?: boolean;
    closingClockSnapshot?: CloseClockSnapshot;
  }
): MatchState {
  const playersById = Object.fromEntries(
    partido.plantilla
      .filter((item) => item.jugador)
      .map((item) => [item.jugadorId, { id: item.jugadorId, numero: item.jugador!.numero }])
  );

  return deriveLegacyMatchState(
    partido,
    partido.plantilla,
    partido.eventos.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    inferClock(partido, options?.closingClockSnapshot),
    defaultLeagueRules,
    {
      closingPhotoProvided: options?.closingPhotoProvided ?? false,
      playersById,
    }
  );
}

export function validateIncomingBackendEvents(
  partido: BackendPartidoLike,
  incomingEvents: BackendEventoLike[]
): { eventId: string; violations: RuleViolation[] } | null {
  const playersById = Object.fromEntries(
    partido.plantilla
      .filter((item) => item.jugador)
      .map((item) => [item.jugadorId, { id: item.jugadorId, numero: item.jugador!.numero }])
  );
  const currentClock = inferClock(partido);
  const initialClock = partido.eventos.length
    ? {
        cuartoActual: 1,
        segundosRestantesCuarto: defaultLeagueRules.regularPeriodDurationSeconds,
        cronoRunning: false,
      }
    : currentClock;

  let state = deriveLegacyMatchState(
    { ...partido, estado: partido.eventos.length > 0 ? 'en_curso' : partido.estado },
    partido.plantilla,
    partido.eventos.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    initialClock,
    defaultLeagueRules,
    {
      playersById,
    }
  );

  for (const event of [...incomingEvents].sort((a, b) => a.orden - b.orden)) {
    const mapped = mapLegacyEventToDomainEvent(
      partido,
      partido.plantilla,
      { ...event, createdAt: event.createdAt.toISOString() },
      defaultLeagueRules
    );
    if (!mapped) continue;
    const violations = validateEvent(mapped, state, defaultLeagueRules, { mode: 'replay' });
    if (violations.length > 0) {
      return { eventId: event.id, violations };
    }
    state = applyEvent(state, mapped, defaultLeagueRules);
    state.finishBlockReasons = getFinishBlockReasons(state, defaultLeagueRules);
    state.canFinish = canFinishMatch(state, defaultLeagueRules);
    state.needsOvertime = shouldStartOvertime(state, defaultLeagueRules);
    state.winnerTeamSide = state.canFinish
      ? state.score.home > state.score.away
        ? 'home'
        : 'away'
      : null;
  }

  return null;
}
