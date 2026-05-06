import { applyEvent } from './apply-event.js';
import { canFinishMatch, getFinishBlockReasons } from './closing.js';
import type { MatchEvent } from './event-types.js';
import { MatchRuleError, type RuleViolation } from './errors.js';
import { validateEvent } from './event-validation.js';
import type { LeagueRulesConfig } from './rules-config.js';
import { shouldStartOvertime } from './overtime.js';
import type { MatchState } from './types.js';

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
        `Evento inválido ${event.id}: ${violations.map((violation: RuleViolation) => violation.code).join(', ')}`,
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
