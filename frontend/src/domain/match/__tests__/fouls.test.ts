import { describe, expect, it } from 'vitest';
import { createInitialMatchState } from '../../../../../shared/match-domain/factories';
import type { MatchEvent } from '../../../../../shared/match-domain/event-types';
import { getPeriodKey } from '../fouls';
import { MatchRulesService } from '../match-rules-service';
import { defaultLeagueRules } from '../rules-config';

const service = new MatchRulesService(defaultLeagueRules);

function createState() {
  return createInitialMatchState({
    matchId: 'match-fouls',
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
    matchId: 'match-fouls',
    type: 'personal_foul',
    teamSide: 'away',
    playerId: 'away-1',
    periodNumber: 4,
    periodType: 'regular',
    clockRemainingSeconds: 0,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('fouls domain', () => {
  it('separates fouls de score y acumula faltas de equipo por periodo', () => {
    let state = createState();
    state = service.registerGameEvent(
      state,
      event({ type: 'point_3', teamSide: 'home', playerId: 'home-1' })
    );
    state = service.registerGameEvent(state, event({ type: 'personal_foul' }));

    expect(state.score).toEqual({ home: 3, away: 0 });
    expect(state.away.teamFoulsByPeriod[getPeriodKey(4, 'regular')]).toBe(1);
    expect(state.players['away-1'].personalFouls).toBe(1);
    expect(state.players['away-1'].totalFoulsForDisplay).toBe(1);
  });
});
