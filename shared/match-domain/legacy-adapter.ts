import { canFinishMatch, getFinishBlockReasons } from './closing.js';
import { deriveMatchState } from './derive-match-state.js';
import type { MatchEvent, MatchEventType } from './event-types.js';
import { createInitialMatchState } from './factories.js';
import type { LeagueRulesConfig } from './rules-config.js';
import { defaultLeagueRules } from './rules-config.js';
import { shouldStartOvertime } from './overtime.js';
import type { MatchClockState, MatchState, PeriodType, TeamSide } from './types.js';

export interface LegacyPlantillaLike {
  equipoId: string;
  jugadorId: string;
  enCanchaInicial: boolean;
}

export interface LegacyJugadorLike {
  id: string;
  numero?: number | string;
}

export interface LegacyEventoLike {
  id: string;
  tipo: string;
  jugadorId: string;
  jugadorEntraId?: string | null;
  cuarto: number;
  orden: number;
  createdAt: string;
  segundosRestantesCuarto?: number | null;
}

export interface LegacyPartidoLike {
  id: string;
  localEquipoId: string;
  visitanteEquipoId: string;
  estado?: string;
}

export interface LegacyClockLike {
  cuartoActual: number;
  segundosRestantesCuarto: number;
  cronoRunning?: boolean;
}

function mapLegacyStatusToDomainStatus(estado?: string): MatchState['status'] {
  if (estado === 'finalizado' || estado === 'default_local' || estado === 'default_visitante') {
    return 'finished';
  }
  if (estado === 'en_curso') return 'in_progress';
  if (estado === 'cancelado') return 'cancelled';
  return 'scheduled';
}

export function getPeriodInfoFromLegacyCuarto(
  cuarto: number,
  rules: LeagueRulesConfig
): { periodNumber: number; periodType: PeriodType; durationSeconds: number } {
  if (cuarto <= rules.regularPeriods) {
    return {
      periodNumber: cuarto,
      periodType: 'regular',
      durationSeconds: rules.regularPeriodDurationSeconds,
    };
  }

  return {
    periodNumber: cuarto - rules.regularPeriods,
    periodType: 'overtime',
    durationSeconds: rules.overtimeDurationSeconds,
  };
}

export function mapLegacyTipoEventoToDomainType(tipo: string): MatchEventType | null {
  switch (tipo) {
    case 'punto_2':
      return 'point_2';
    case 'punto_3':
      return 'point_3';
    case 'tiro_libre_anotado':
      return 'free_throw_made';
    case 'tiro_libre_fallado':
      return 'free_throw_missed';
    case 'falta_personal':
      return 'personal_foul';
    case 'falta_tecnica':
      return 'technical_foul';
    case 'falta_antideportiva':
      return 'unsportsmanlike_foul';
    case 'falta_descalificante':
      return 'disqualifying_foul';
    case 'sustitucion_sale':
      return 'substitution_out';
    case 'sustitucion_entra':
      return 'substitution_in';
    case 'tiempo_fuera':
      return 'timeout';
    default:
      return null;
  }
}

export function createLegacyTeamSideResolver(
  partido: Pick<LegacyPartidoLike, 'localEquipoId' | 'visitanteEquipoId'>,
  plantilla: LegacyPlantillaLike[]
) {
  const teamByPlayerId = new Map<string, string>();
  for (const item of plantilla) {
    teamByPlayerId.set(item.jugadorId, item.equipoId);
  }

  return (playerId: string): TeamSide => {
    const teamId = teamByPlayerId.get(playerId);
    return teamId === partido.localEquipoId ? 'home' : 'away';
  };
}

export function mapLegacyEventToDomainEvent(
  partido: Pick<LegacyPartidoLike, 'id' | 'localEquipoId' | 'visitanteEquipoId'>,
  plantilla: LegacyPlantillaLike[],
  event: LegacyEventoLike,
  rules: LeagueRulesConfig
): MatchEvent | null {
  const type = mapLegacyTipoEventoToDomainType(event.tipo);
  if (!type) return null;
  const resolveTeamSide = createLegacyTeamSideResolver(partido, plantilla);
  const periodInfo = getPeriodInfoFromLegacyCuarto(event.cuarto || 1, rules);

  return {
    id: event.id,
    matchId: partido.id,
    type,
    teamSide: resolveTeamSide(event.jugadorId),
    playerId: event.jugadorId,
    relatedPlayerId: event.jugadorEntraId ?? undefined,
    periodNumber: periodInfo.periodNumber,
    periodType: periodInfo.periodType,
    clockRemainingSeconds:
      event.segundosRestantesCuarto != null
        ? Number(event.segundosRestantesCuarto)
        : periodInfo.durationSeconds,
    timestamp: event.createdAt,
  };
}

export function buildInitialMatchStateFromLegacy(
  partido: LegacyPartidoLike,
  plantilla: LegacyPlantillaLike[],
  clock: LegacyClockLike,
  rules: LeagueRulesConfig = defaultLeagueRules,
  options?: {
    closingPhotoProvided?: boolean;
    closingPhotoRequired?: boolean;
    playersById?: Record<string, LegacyJugadorLike>;
  }
): MatchState {
  const currentPeriod = getPeriodInfoFromLegacyCuarto(clock.cuartoActual, rules);

  return createInitialMatchState({
    matchId: partido.id,
    status: mapLegacyStatusToDomainStatus(partido.estado),
    currentPeriod: {
      number: currentPeriod.periodNumber,
      type: currentPeriod.periodType,
      durationSeconds: currentPeriod.durationSeconds,
    },
    clock: {
      remainingSeconds: clock.segundosRestantesCuarto,
      isRunning: Boolean(clock.cronoRunning),
    },
    closingPhotoProvided: options?.closingPhotoProvided ?? false,
    closingPhotoRequired: options?.closingPhotoRequired ?? rules.closingPhotoRequired,
    players: plantilla.map((item) => ({
      playerId: item.jugadorId,
      teamSide: item.equipoId === partido.localEquipoId ? 'home' : 'away',
      jerseyNumber:
        options?.playersById?.[item.jugadorId]?.numero != null
          ? String(options.playersById[item.jugadorId].numero)
          : undefined,
      isStarter: item.enCanchaInicial,
      isOnCourt: item.enCanchaInicial,
    })),
  });
}

export function deriveLegacyMatchState(
  partido: LegacyPartidoLike,
  plantilla: LegacyPlantillaLike[],
  eventos: LegacyEventoLike[],
  clock: LegacyClockLike,
  rules: LeagueRulesConfig = defaultLeagueRules,
  options?: {
    closingPhotoProvided?: boolean;
    closingPhotoRequired?: boolean;
    playersById?: Record<string, LegacyJugadorLike>;
  }
): MatchState {
  const mappedEvents = [...eventos]
    .sort((a, b) => a.orden - b.orden)
    .map((event) => mapLegacyEventToDomainEvent(partido, plantilla, event, rules))
    .filter((event): event is MatchEvent => event !== null);
  const initialClock = mappedEvents.length
    ? {
        cuartoActual: 1,
        segundosRestantesCuarto: rules.regularPeriodDurationSeconds,
        cronoRunning: false,
      }
    : clock;
  const initialState = buildInitialMatchStateFromLegacy(
    {
      ...partido,
      estado: mappedEvents.length > 0 ? 'en_curso' : partido.estado,
    },
    plantilla,
    initialClock,
    rules,
    options
  );
  const state = deriveMatchState(initialState, mappedEvents, rules, {
    validationMode: 'replay',
  });
  const currentPeriod = getPeriodInfoFromLegacyCuarto(clock.cuartoActual, rules);
  state.currentPeriod = {
    number: currentPeriod.periodNumber,
    type: currentPeriod.periodType,
    durationSeconds: currentPeriod.durationSeconds,
  };
  state.clock.remainingSeconds = clock.segundosRestantesCuarto;
  state.clock.isRunning = Boolean(clock.cronoRunning);
  state.status = mapLegacyStatusToDomainStatus(partido.estado);
  state.overtimeCount =
    currentPeriod.periodType === 'overtime'
      ? Math.max(state.overtimeCount, currentPeriod.periodNumber)
      : state.overtimeCount;
  state.finishBlockReasons = getFinishBlockReasons(state, rules);
  state.canFinish = canFinishMatch(state, rules);
  state.needsOvertime = shouldStartOvertime(state, rules);
  state.winnerTeamSide = state.canFinish
    ? state.score.home > state.score.away
      ? 'home'
      : 'away'
    : null;
  return state;
}

export function getClockFromLegacyEvents(
  events: LegacyEventoLike[],
  fallback: MatchClockState,
  rules: LeagueRulesConfig = defaultLeagueRules
): LegacyClockLike {
  const sortedEvents = [...events].sort((a, b) => a.orden - b.orden);
  const last = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1] : undefined;
  if (!last || last.segundosRestantesCuarto == null) {
    return {
      cuartoActual:
        fallback.remainingSeconds <= rules.regularPeriodDurationSeconds ? 1 : rules.regularPeriods,
      segundosRestantesCuarto: fallback.remainingSeconds,
      cronoRunning: fallback.isRunning,
    };
  }

  return {
    cuartoActual: last.cuarto || 1,
    segundosRestantesCuarto: Number(last.segundosRestantesCuarto),
    cronoRunning: false,
  };
}
