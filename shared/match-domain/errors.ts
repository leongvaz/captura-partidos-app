export type RuleViolationCode =
  | 'MATCH_ALREADY_FINISHED'
  | 'INVALID_PERIOD'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_DISQUALIFIED'
  | 'PLAYER_NOT_ON_COURT'
  | 'PLAYER_ALREADY_ON_COURT'
  | 'RELATED_PLAYER_REQUIRED'
  | 'RELATED_PLAYER_NOT_FOUND'
  | 'DUPLICATE_EVENT_ID'
  | 'TEAM_ON_COURT_LIMIT_REACHED'
  | 'TEAM_TIMEOUT_LIMIT_REACHED'
  | 'MATCH_CANNOT_FINISH';

export interface RuleViolation {
  code: RuleViolationCode;
  message: string;
}

export class MatchRuleError extends Error {
  violations: RuleViolation[];

  constructor(message: string, violations: RuleViolation[]) {
    super(message);
    this.name = 'MatchRuleError';
    this.violations = violations;
  }
}
