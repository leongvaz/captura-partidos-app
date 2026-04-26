import { describe, expect, it } from 'vitest';
import { createInitialMatchState } from '../../../../../shared/match-domain/factories';
import type { MatchEvent } from '../../../../../shared/match-domain/event-types';
import { MatchRulesService } from '../match-rules-service';
import { defaultLeagueRules } from '../rules-config';

const service = new MatchRulesService(defaultLeagueRules);

function createState() {
  return createInitialMatchState({
    matchId: 'match-subs',
    status: 'in_progress',
    currentPeriod: { number: 4, type: 'regular', durationSeconds: 600 },
    clock: { remainingSeconds: 0, isRunning: false },
    players: [
      { playerId: 'home-1', teamSide: 'home', isStarter: true, isOnCourt: true },
      { playerId: 'home-2', teamSide: 'home', isStarter: false, isOnCourt: false },
      { playerId: 'away-1', teamSide: 'away', isStarter: true, isOnCourt: true },
    ],
  });
}

function event(overrides: Partial<MatchEvent>): MatchEvent {
  return {
    id: crypto.randomUUID(),
    matchId: 'match-subs',
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

describe('substitutions domain', () => {
  it('conserva los puntos previos de un jugador sustituido', () => {
    let state = createState();
    for (let i = 0; i < 5; i += 1) {
      state = service.registerGameEvent(state, event({ type: 'point_2' }));
    }
    state = service.registerGameEvent(state, event({ type: 'substitution_out' }));
    state = service.registerGameEvent(
      state,
      event({
        id: crypto.randomUUID(),
        type: 'substitution_in',
        playerId: 'home-2',
      })
    );

    expect(state.players['home-1'].points).toBe(10);
    expect(state.score.home).toBe(10);
    expect(state.home.playersOnCourt).toContain('home-2');
    expect(state.home.playersOnCourt).not.toContain('home-1');
  });
});
