import type { LeagueRulesConfig } from './rules-config.js';
import type { MatchPeriod, MatchState } from './types.js';

export function isTie(state: MatchState): boolean {
  return state.score.home === state.score.away;
}

export function hasCompletedRegulation(state: MatchState, rules: LeagueRulesConfig): boolean {
  return (
    state.currentPeriod.type === 'regular' &&
    state.currentPeriod.number === rules.regularPeriods &&
    state.clock.remainingSeconds === 0
  );
}

export function hasCompletedOvertime(state: MatchState): boolean {
  return state.currentPeriod.type === 'overtime' && state.clock.remainingSeconds === 0;
}

export function shouldStartOvertime(state: MatchState, rules: LeagueRulesConfig): boolean {
  if (!rules.allowOvertime) return false;
  if (hasCompletedRegulation(state, rules) && isTie(state)) return true;
  if (hasCompletedOvertime(state) && isTie(state) && rules.overtimeUntilWinner) return true;
  return false;
}

export function createNextOvertimePeriod(
  state: MatchState,
  rules: LeagueRulesConfig
): MatchPeriod {
  return {
    number: state.overtimeCount + 1,
    type: 'overtime',
    durationSeconds: rules.overtimeDurationSeconds,
  };
}
