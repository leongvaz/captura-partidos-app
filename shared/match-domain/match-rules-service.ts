import { applyEvent } from './apply-event';
import { canFinishMatch, getFinishBlockReasons } from './closing';
import { deriveMatchState } from './derive-match-state';
import type { MatchEvent } from './event-types';
import { MatchRuleError } from './errors';
import { validateEvent } from './event-validation';
import { getTeamFoulsByPeriod as cloneTeamFoulsByPeriod } from './fouls';
import type { LeagueRulesConfig } from './rules-config';
import { getOfficialScore as cloneOfficialScore } from './score';
import { shouldStartOvertime as shouldStartOvertimeRule } from './overtime';
import type { MatchState, TeamSide } from './types';

export function registerGameEvent(
  state: MatchState,
  event: MatchEvent,
  rules: LeagueRulesConfig
): MatchState {
  const violations = validateEvent(event, state, rules);
  if (violations.length > 0) {
    throw new MatchRuleError('No se pudo registrar el evento.', violations);
  }

  const nextState = applyEvent(state, event, rules);
  nextState.finishBlockReasons = getFinishBlockReasons(nextState, rules);
  nextState.canFinish = canFinishMatch(nextState, rules);
  nextState.needsOvertime = shouldStartOvertimeRule(nextState, rules);
  nextState.winnerTeamSide = nextState.canFinish
    ? nextState.score.home > nextState.score.away
      ? 'home'
      : 'away'
    : null;
  return nextState;
}

export function getOfficialScore(state: MatchState) {
  return cloneOfficialScore(state.score);
}

export function getTeamFoulsByPeriod(state: MatchState, teamSide: TeamSide) {
  return cloneTeamFoulsByPeriod(
    teamSide === 'home' ? state.home.teamFoulsByPeriod : state.away.teamFoulsByPeriod
  );
}

export function canFinish(state: MatchState, rules: LeagueRulesConfig) {
  return canFinishMatch(state, rules);
}

export function getFinishBlockReasonsForState(state: MatchState, rules: LeagueRulesConfig) {
  return getFinishBlockReasons(state, rules);
}

export function shouldStartOvertime(state: MatchState, rules: LeagueRulesConfig) {
  return shouldStartOvertimeRule(state, rules);
}

export class MatchRulesService {
  constructor(private readonly rules: LeagueRulesConfig) {}

  validateNewEvent(state: MatchState, event: MatchEvent) {
    return validateEvent(event, state, this.rules);
  }

  rebuildState(initialState: MatchState, events: MatchEvent[]) {
    return deriveMatchState(initialState, events, this.rules);
  }

  registerGameEvent(state: MatchState, event: MatchEvent) {
    return registerGameEvent(state, event, this.rules);
  }

  canFinish(state: MatchState) {
    return canFinish(state, this.rules);
  }

  shouldStartOvertime(state: MatchState) {
    return shouldStartOvertime(state, this.rules);
  }

  getFinishBlockReasons(state: MatchState) {
    return getFinishBlockReasonsForState(state, this.rules);
  }

  getOfficialScore(state: MatchState) {
    return getOfficialScore(state);
  }

  getTeamFoulsByPeriod(state: MatchState, teamSide: TeamSide) {
    return getTeamFoulsByPeriod(state, teamSide);
  }
}
