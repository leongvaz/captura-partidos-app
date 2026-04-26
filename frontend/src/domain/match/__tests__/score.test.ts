import { describe, expect, it } from 'vitest';
import { createInitialMatchState } from '../../../../../shared/match-domain/factories';
import type { MatchEvent } from '../../../../../shared/match-domain/event-types';
import { MatchRulesService } from '../match-rules-service';
import { defaultLeagueRules } from '../rules-config';

const service = new MatchRulesService(defaultLeagueRules);

function createState() {
  return createInitialMatchState({
    matchId: 'match-score',
    status: 'in_progress',
    currentPeriod: { number: 4, type: 'regular', durationSeconds: 600 },
    clock: { remainingSeconds: 0, isRunning: false },
    players: [
      { playerId: 'home-1', teamSide: 'home', isStarter: true, isOnCourt: true },
      { playerId: 'away-1', teamSide: 'away', isStarter: true, isOnCourt: true },
    ],
  });
}

function event(overrides: Partial<MatchEvent>): MatchEvent {
  return {
    id: crypto.randomUUID(),
    matchId: 'match-score',
    type: 'point_2',
    teamSide: 'home',
    playerId: 'home-1',
    periodNumber: 4,
    periodType: 'regular',
    clockRemainingSeconds: 0,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('score domain', () => {
  it('solo suma score con eventos de anotacion validos', () => {
    let state = createState();
    state = service.registerGameEvent(state, event({ type: 'point_2' }));
    state = service.registerGameEvent(state, event({ id: crypto.randomUUID(), type: 'point_3' }));
    state = service.registerGameEvent(
      state,
      event({ id: crypto.randomUUID(), type: 'free_throw_made' })
    );
    state = service.registerGameEvent(
      state,
      event({ id: crypto.randomUUID(), type: 'personal_foul' })
    );

    expect(state.score).toEqual({ home: 6, away: 0 });
    expect(state.players['home-1'].points).toBe(6);
    expect(state.players['home-1'].personalFouls).toBe(1);
  });
});
