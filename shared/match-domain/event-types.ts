import type { PeriodType, TeamSide } from './types';

export type MatchEventType =
  | 'match_started'
  | 'period_started'
  | 'period_ended'
  | 'clock_set'
  | 'clock_started'
  | 'clock_stopped'
  | 'point_2'
  | 'point_3'
  | 'free_throw_made'
  | 'free_throw_missed'
  | 'personal_foul'
  | 'technical_foul'
  | 'unsportsmanlike_foul'
  | 'disqualifying_foul'
  | 'substitution_in'
  | 'substitution_out'
  | 'player_disqualified'
  | 'timeout'
  | 'overtime_started'
  | 'match_finished'
  | 'rebound_offensive'
  | 'rebound_defensive'
  | 'assist'
  | 'steal'
  | 'block'
  | 'turnover';

export interface MatchEvent {
  id: string;
  matchId: string;
  type: MatchEventType;
  teamSide: TeamSide;
  playerId?: string;
  relatedPlayerId?: string;
  periodNumber: number;
  periodType: PeriodType;
  clockRemainingSeconds: number;
  timestamp: string;
  payload?: Record<string, unknown>;
}
