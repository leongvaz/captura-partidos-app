import { describe, expect, it } from 'vitest';
import { createInitialMatchState } from '../../../../../shared/match-domain/factories';
import type { MatchEvent } from '../../../../../shared/match-domain/event-types';
import { deriveMatchState } from '../derive-match-state';
import { MatchRulesService } from '../match-rules-service';
import { defaultLeagueRules } from '../rules-config';

function createState() {
  return createInitialMatchState({
    matchId: 'match-fiba-table',
    status: 'in_progress',
    currentPeriod: { number: 1, type: 'regular', durationSeconds: 600 },
    clock: { remainingSeconds: 600, isRunning: false },
    players: [
      { playerId: 'home-1', teamSide: 'home', isStarter: true, isOnCourt: true },
      { playerId: 'away-1', teamSide: 'away', isStarter: true, isOnCourt: true },
    ],
  });
}

function event(overrides: Partial<MatchEvent>): MatchEvent {
  return {
    id: crypto.randomUUID(),
    matchId: 'match-fiba-table',
    type: 'point_2',
    teamSide: 'home',
    playerId: 'home-1',
    periodNumber: 1,
    periodType: 'regular',
    clockRemainingSeconds: 500,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('FIBA table rules', () => {
  it('marca bonus al llegar al umbral de faltas de equipo por periodo', () => {
    const service = new MatchRulesService(defaultLeagueRules);
    let state = createState();
    for (let i = 0; i < defaultLeagueRules.teamFoulPenaltyStartsAt; i += 1) {
      state = service.registerGameEvent(state, event({ id: crypto.randomUUID(), type: 'personal_foul' }));
    }
    expect(state.home.teamFoulsByPeriod.R1).toBe(defaultLeagueRules.teamFoulPenaltyStartsAt);
    expect(state.home.bonusByPeriod.R1).toBe(true);
  });

  it('valida límite de tiempos fuera FIBA por primera mitad', () => {
    const service = new MatchRulesService(defaultLeagueRules);
    let state = createState();
    state = service.registerGameEvent(state, event({ type: 'timeout' }));
    state = service.registerGameEvent(state, event({ id: crypto.randomUUID(), type: 'timeout' }));
    const violations = service.validateNewEvent(state, event({ id: crypto.randomUUID(), type: 'timeout' }));
    expect(violations.map((item) => item.code)).toContain('TEAM_TIMEOUT_LIMIT_REACHED');
  });

  it('usa valores de score desde la configuración', () => {
    const rules = {
      ...defaultLeagueRules,
      scoreEventValues: { point_2: 2, point_3: 4, free_throw_made: 1 } as const,
    };
    const service = new MatchRulesService(rules);
    const state = service.registerGameEvent(createState(), event({ type: 'point_3' }));
    expect(state.score.home).toBe(4);
  });

  it('reproduce eventos históricos aunque el periodo baje en modo replay', () => {
    const initial = createInitialMatchState({
      matchId: 'match-fiba-table',
      status: 'in_progress',
      currentPeriod: { number: 1, type: 'regular', durationSeconds: 600 },
      clock: { remainingSeconds: 600, isRunning: false },
      players: [
        { playerId: 'home-1', teamSide: 'home', isStarter: true, isOnCourt: true },
        { playerId: 'away-1', teamSide: 'away', isStarter: true, isOnCourt: true },
      ],
    });
    const state = deriveMatchState(
      initial,
      [
        event({ id: 'q2', type: 'point_2', periodNumber: 2, clockRemainingSeconds: 400 }),
        event({ id: 'q1', type: 'point_2', periodNumber: 1, clockRemainingSeconds: 300 }),
      ],
      defaultLeagueRules,
      { validationMode: 'replay' }
    );
    expect(state.score.home).toBe(4);
  });
});
