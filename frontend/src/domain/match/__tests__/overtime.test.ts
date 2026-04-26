import { describe, expect, it } from 'vitest';
import { createInitialMatchState } from '../../../../../shared/match-domain/factories';
import type { MatchEvent } from '../../../../../shared/match-domain/event-types';
import { MatchRulesService } from '../match-rules-service';
import { defaultLeagueRules } from '../rules-config';

const service = new MatchRulesService(defaultLeagueRules);

function createRegulationTieState() {
  return createInitialMatchState({
    matchId: 'match-ot',
    status: 'in_progress',
    currentPeriod: { number: 4, type: 'regular', durationSeconds: 600 },
    clock: { remainingSeconds: 0, isRunning: false },
    players: [
      { playerId: 'home-1', teamSide: 'home', isStarter: true, isOnCourt: true },
      { playerId: 'away-1', teamSide: 'away', isStarter: true, isOnCourt: true },
    ],
  });
}

function scoringEvent(type: MatchEvent['type'], teamSide: MatchEvent['teamSide'], playerId: string): MatchEvent {
  return {
    id: crypto.randomUUID(),
    matchId: 'match-ot',
    type,
    teamSide,
    playerId,
    periodNumber: 4,
    periodType: 'regular',
    clockRemainingSeconds: 0,
    timestamp: new Date().toISOString(),
  };
}

describe('overtime domain', () => {
  it('marca needsOvertime cuando termina reglamentario empatado', () => {
    let state = createRegulationTieState();
    state = service.registerGameEvent(state, scoringEvent('point_2', 'home', 'home-1'));
    state = service.registerGameEvent(state, scoringEvent('point_2', 'away', 'away-1'));

    expect(state.needsOvertime).toBe(true);
    expect(service.canFinish(state)).toBe(false);
    expect(service.getFinishBlockReasons(state)).toContain('TIED_SCORE_REQUIRES_OVERTIME');
  });
});
