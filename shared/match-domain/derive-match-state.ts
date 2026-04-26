import { applyEvent } from './apply-event';
import { canFinishMatch, getFinishBlockReasons } from './closing';
import type { MatchEvent } from './event-types';
import { MatchRuleError } from './errors';
import { validateEvent } from './event-validation';
import type { LeagueRulesConfig } from './rules-config';
import { shouldStartOvertime } from './overtime';
import type { MatchState } from './types';

export interface DeriveMatchStateOptions {
  validationMode?: 'strict' | 'replay';
}

export function deriveMatchState(
  initialState: MatchState,
  events: MatchEvent[],
  rules: LeagueRulesConfig,
  options?: DeriveMatchStateOptions
): MatchState {
  let state = structuredClone(initialState);

  for (const event of events) {
    const violations = validateEvent(event, state, rules, {
      mode: options?.validationMode ?? 'strict',
    });
    if (violations.length > 0) {
      throw new MatchRuleError(
        `Evento inválido ${event.id}: ${violations.map((violation) => violation.code).join(', ')}`,
        violations
      );
    }

    state = applyEvent(state, event, rules);
  }

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
