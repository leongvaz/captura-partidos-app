import type { MatchEvent } from './event-types.js';
import type { RuleViolation } from './errors.js';
import type { LeagueRulesConfig } from './rules-config.js';
import type { MatchState } from './types.js';

export interface ValidateEventOptions {
  mode?: 'strict' | 'replay';
}

const ACTIVE_PLAYER_EVENT_TYPES = new Set<MatchEvent['type']>([
  'point_2',
  'point_3',
  'free_throw_made',
  'free_throw_missed',
  'personal_foul',
  'technical_foul',
  'unsportsmanlike_foul',
  'disqualifying_foul',
  'rebound_offensive',
  'rebound_defensive',
  'assist',
  'steal',
  'block',
  'turnover',
  'timeout',
]);

const SKIP_PERIOD_VALIDATION = new Set<MatchEvent['type']>([
  'period_started',
  'overtime_started',
  'match_started',
  'match_finished',
]);

function getTimeoutAllowance(event: MatchEvent, rules: LeagueRulesConfig): number {
  if (event.periodType === 'overtime') return rules.timeoutsPerOvertime;
  return event.periodNumber <= 2 ? rules.timeoutsFirstHalf : rules.timeoutsSecondHalf;
}

function getTimeoutsUsedInWindow(event: MatchEvent, state: MatchState): number {
  const team = event.teamSide === 'home' ? state.home : state.away;
  if (event.periodType === 'overtime') {
    return team.timeoutsByPeriod[`OT${event.periodNumber}`] ?? 0;
  }
  const periodKeys = event.periodNumber <= 2 ? ['R1', 'R2'] : ['R3', 'R4'];
  return periodKeys.reduce((total, key) => total + (team.timeoutsByPeriod[key] ?? 0), 0);
}

function periodOrder(periodNumber: number, periodType: MatchEvent['periodType'], rules: LeagueRulesConfig) {
  return periodType === 'regular' ? periodNumber : rules.regularPeriods + periodNumber;
}

export function validateEvent(
  event: MatchEvent,
  state: MatchState,
  rules: LeagueRulesConfig,
  options?: ValidateEventOptions
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const mode = options?.mode ?? 'strict';
  const strictOnCourtValidation = mode === 'strict';

  if (state.status === 'finished') {
    violations.push({ code: 'MATCH_ALREADY_FINISHED', message: 'El partido ya terminó.' });
  }

  if (state.eventIdsApplied.includes(event.id)) {
    violations.push({ code: 'DUPLICATE_EVENT_ID', message: 'El evento ya fue aplicado.' });
  }

  // En modo replay, aceptamos eventos históricos aunque el "cuarto" no sea monotónico
  // (por ejemplo, correcciones o capturas fuera de orden por periodo).
  if (mode === 'strict' && !SKIP_PERIOD_VALIDATION.has(event.type)) {
    const eventOrder = periodOrder(event.periodNumber, event.periodType, rules);
    const currentOrder = periodOrder(
      state.currentPeriod.number,
      state.currentPeriod.type,
      rules
    );

    if (eventOrder < currentOrder) {
      violations.push({
        code: 'INVALID_PERIOD',
        message: 'El evento pertenece a un periodo anterior al estado actual.',
      });
    }
  }

  if (event.playerId) {
    const player = state.players[event.playerId];
    if (!player) {
      violations.push({ code: 'PLAYER_NOT_FOUND', message: 'Jugador no encontrado.' });
    } else {
      if (strictOnCourtValidation && ACTIVE_PLAYER_EVENT_TYPES.has(event.type) && !player.isOnCourt) {
        violations.push({
          code: 'PLAYER_NOT_ON_COURT',
          message: 'El jugador debe estar en cancha para registrar este evento.',
        });
      }

      if (strictOnCourtValidation && ACTIVE_PLAYER_EVENT_TYPES.has(event.type) && player.isDisqualified) {
        violations.push({
          code: 'PLAYER_DISQUALIFIED',
          message: 'Jugador descalificado no puede registrar nuevos eventos activos.',
        });
      }
    }
  }

  if (event.type === 'substitution_out' && event.playerId) {
    const player = state.players[event.playerId];
    if (strictOnCourtValidation && player && !player.isOnCourt) {
      violations.push({
        code: 'PLAYER_NOT_ON_COURT',
        message: 'No se puede sacar a un jugador que ya está fuera de cancha.',
      });
    }
  }

  if (event.type === 'substitution_in' && event.playerId) {
    const player = state.players[event.playerId];
    if (player) {
      if (strictOnCourtValidation && player.isOnCourt) {
        violations.push({
          code: 'PLAYER_ALREADY_ON_COURT',
          message: 'No se puede ingresar a un jugador que ya está en cancha.',
        });
      }
      if (strictOnCourtValidation && player.isDisqualified) {
        violations.push({
          code: 'PLAYER_DISQUALIFIED',
          message: 'Jugador descalificado no puede regresar a cancha.',
        });
      }
    }

    const team = event.teamSide === 'home' ? state.home : state.away;
    if (strictOnCourtValidation && team.playersOnCourt.length >= rules.maxPlayersOnCourt) {
      violations.push({
        code: 'TEAM_ON_COURT_LIMIT_REACHED',
        message: 'El equipo ya tiene el máximo de jugadores en cancha.',
      });
    }
  }

  if (event.type === 'timeout') {
    const used = getTimeoutsUsedInWindow(event, state);
    const allowed = getTimeoutAllowance(event, rules);
    if (mode === 'strict' && used >= allowed) {
      violations.push({
        code: 'TEAM_TIMEOUT_LIMIT_REACHED',
        message: 'El equipo ya agotó sus tiempos fuera para esta ventana del partido.',
      });
    }
  }

  return violations;
}
