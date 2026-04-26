import { describe, expect, it } from 'vitest';
import { createInitialMatchState } from '../../../../../shared/match-domain/factories';
import type { MatchEvent } from '../../../../../shared/match-domain/event-types';
import { MatchRulesService } from '../match-rules-service';
import { defaultLeagueRules } from '../rules-config';

const service = new MatchRulesService(defaultLeagueRules);

function createState(overrides?: { remainingSeconds?: number; periodNumber?: number; periodType?: 'regular' | 'overtime' }) {
  return createInitialMatchState({
    matchId: 'match-closing',
    status: 'in_progress',
    currentPeriod: {
      number: overrides?.periodNumber ?? 4,
      type: overrides?.periodType ?? 'regular',
      durationSeconds: (overrides?.periodType ?? 'regular') === 'regular' ? 600 : 300,
    },
    clock: { remainingSeconds: overrides?.remainingSeconds ?? 0, isRunning: false },
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
    matchId: 'match-closing',
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

describe('closing domain', () => {
  it('permite cerrar 13-12 con faltas registradas', () => {
    let state = createState();
    for (let i = 0; i < 4; i += 1) state = service.registerGameEvent(state, event({ type: 'point_3' }));
    state = service.registerGameEvent(state, event({ type: 'free_throw_made' }));
    for (let i = 0; i < 4; i += 1) {
      state = service.registerGameEvent(
        state,
        event({ id: crypto.randomUUID(), type: 'point_3', teamSide: 'away', playerId: 'away-1' })
      );
    }
    state = service.registerGameEvent(
      state,
      event({ id: crypto.randomUUID(), type: 'personal_foul', teamSide: 'away', playerId: 'away-1' })
    );

    expect(state.score).toEqual({ home: 13, away: 12 });
    expect(service.canFinish(state)).toBe(true);
  });

  it('bloquea el cierre si el reloj no expiro aunque el score sea distinto', () => {
    let state = createState({ remainingSeconds: 8 });
    state = service.registerGameEvent(state, event({ type: 'point_2', clockRemainingSeconds: 8 }));

    expect(service.canFinish(state)).toBe(false);
    expect(service.getFinishBlockReasons(state)).toContain('CLOCK_NOT_EXPIRED');
  });

  it('bloquea el cierre si el partido sigue empatado aunque existan faltas', () => {
    let state = createState();
    state = service.registerGameEvent(state, event({ type: 'point_3' }));
    state = service.registerGameEvent(
      state,
      event({ id: crypto.randomUUID(), type: 'point_3', teamSide: 'away', playerId: 'away-1' })
    );
    state = service.registerGameEvent(
      state,
      event({ id: crypto.randomUUID(), type: 'personal_foul', teamSide: 'away', playerId: 'away-1' })
    );

    expect(state.score).toEqual({ home: 3, away: 3 });
    expect(service.canFinish(state)).toBe(false);
    expect(service.getFinishBlockReasons(state)).toContain('TIED_SCORE_REQUIRES_OVERTIME');
  });

  it('permite cerrar despues de overtime con ganador', () => {
    let state = createState({ periodNumber: 1, periodType: 'overtime' });
    state = service.registerGameEvent(
      state,
      event({
        type: 'point_2',
        periodNumber: 1,
        periodType: 'overtime',
        clockRemainingSeconds: 0,
      })
    );

    expect(state.score).toEqual({ home: 2, away: 0 });
    expect(service.canFinish(state)).toBe(true);
  });

  it('permite cerrar aunque el anotador previo ya este descalificado', () => {
    let state = createState();
    for (let i = 0; i < 5; i += 1) {
      state = service.registerGameEvent(state, event({ type: 'point_2' }));
    }
    for (let i = 0; i < 5; i += 1) {
      state = service.registerGameEvent(
        state,
        event({ id: crypto.randomUUID(), type: 'personal_foul' })
      );
    }
    state = service.registerGameEvent(
      state,
      event({ id: crypto.randomUUID(), type: 'point_3', teamSide: 'away', playerId: 'away-1' })
    );

    expect(state.players['home-1'].isDisqualified).toBe(true);
    expect(state.players['home-1'].points).toBe(10);
    expect(state.score).toEqual({ home: 10, away: 3 });
    expect(service.canFinish(state)).toBe(true);
  });
});
