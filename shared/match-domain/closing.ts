import type { LeagueRulesConfig } from './rules-config';
import type { FinishBlockReason, MatchState } from './types';

function hasCompletedFinishablePeriod(state: MatchState, rules: LeagueRulesConfig): boolean {
  if (state.currentPeriod.type === 'regular') {
    return state.currentPeriod.number >= rules.regularPeriods;
  }
  return state.currentPeriod.number >= 1;
}

export function getFinishBlockReasons(
  state: MatchState,
  rules: LeagueRulesConfig
): FinishBlockReason[] {
  const reasons: FinishBlockReason[] = [];

  if (state.status === 'finished') reasons.push('MATCH_ALREADY_FINISHED');

  if (!hasCompletedFinishablePeriod(state, rules)) {
    reasons.push('REGULATION_NOT_COMPLETED');
  }

  if (rules.validateClockOnFinish && state.clock.remainingSeconds > 0) {
    reasons.push('CLOCK_NOT_EXPIRED');
  }

  if (state.score.home === state.score.away) {
    reasons.push('TIED_SCORE_REQUIRES_OVERTIME');
  }

  if (rules.closingPhotoRequired && !state.metadata.closingPhotoProvided) {
    reasons.push('CLOSING_PHOTO_REQUIRED');
  }

  return reasons;
}

export function canFinishMatch(state: MatchState, rules: LeagueRulesConfig): boolean {
  return getFinishBlockReasons(state, rules).length === 0;
}
