export type TeamSide = 'home' | 'away';

export type MatchStatus =
  | 'scheduled'
  | 'in_progress'
  | 'period_break'
  | 'overtime_break'
  | 'finished'
  | 'cancelled';

export type PeriodType = 'regular' | 'overtime';

export type FinishBlockReason =
  | 'CLOCK_NOT_EXPIRED'
  | 'TIED_SCORE_REQUIRES_OVERTIME'
  | 'CLOSING_PHOTO_REQUIRED'
  | 'MATCH_ALREADY_FINISHED'
  | 'REGULATION_NOT_COMPLETED';

export type BonusStatusByPeriod = {
  [periodKey: string]: boolean;
};

export interface MatchPeriod {
  number: number;
  type: PeriodType;
  durationSeconds: number;
}

export interface MatchClockState {
  remainingSeconds: number;
  isRunning: boolean;
}

export interface MatchScore {
  home: number;
  away: number;
}

export interface TeamFoulsByPeriod {
  [periodKey: string]: number;
}

export interface TeamTimeoutsByPeriod {
  [periodKey: string]: number;
}

export interface PlayerGameState {
  playerId: string;
  teamSide: TeamSide;
  jerseyNumber?: string;
  isStarter: boolean;
  isOnCourt: boolean;
  isBench: boolean;
  isExcluded: boolean;
  isDisqualified: boolean;

  points: number;
  fieldGoals2Made: number;
  fieldGoals3Made: number;
  freeThrowsMade: number;
  freeThrowsMissed: number;

  personalFouls: number;
  technicalFouls: number;
  unsportsmanlikeFouls: number;
  disqualifyingFouls: number;

  totalFoulsForDisplay: number;
  plusMinus?: number;
}

export interface TeamGameState {
  teamSide: TeamSide;
  score: number;
  teamFoulsByPeriod: TeamFoulsByPeriod;
  bonusByPeriod: BonusStatusByPeriod;
  timeoutsByPeriod: TeamTimeoutsByPeriod;
  playersOnCourt: string[];
  benchPlayers: string[];
  disqualifiedPlayers: string[];
}

export interface MatchState {
  matchId: string;
  status: MatchStatus;
  currentPeriod: MatchPeriod;
  clock: MatchClockState;
  score: MatchScore;
  home: TeamGameState;
  away: TeamGameState;
  players: Record<string, PlayerGameState>;
  eventIdsApplied: string[];
  winnerTeamSide: TeamSide | null;
  canFinish: boolean;
  finishBlockReasons: FinishBlockReason[];
  needsOvertime: boolean;
  overtimeCount: number;
  metadata: {
    closingPhotoRequired: boolean;
    closingPhotoProvided: boolean;
  };
}
