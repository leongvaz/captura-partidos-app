import { describe, expect, it } from 'vitest';
import { createInitialMatchState } from '../../../../../shared/match-domain/factories';
import type { MatchEvent } from '../../../../../shared/match-domain/event-types';
import { MatchRulesService } from '../match-rules-service';
import { defaultLeagueRules } from '../rules-config';

const service = new MatchRulesService(defaultLeagueRules);

function createState() {
  return createInitialMatchState({
    matchId: 'match-dq',
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
    matchId: 'match-dq',
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

describe('disqualification domain', () => {
  it('bloquea nuevos eventos activos para un jugador descalificado y conserva sus puntos previos', () => {
    let state = createState();
    state = service.registerGameEvent(state, event({ type: 'point_2' }));
    for (let i = 0; i < 5; i += 1) {
      state = service.registerGameEvent(
        state,
        event({ id: crypto.randomUUID(), type: 'personal_foul' })
      );
    }

    const violations = service.validateNewEvent(
      state,
      event({ id: crypto.randomUUID(), type: 'point_2' })
    );

    expect(state.players['home-1'].isDisqualified).toBe(true);
    expect(state.players['home-1'].points).toBe(2);
    expect(violations.map((item) => item.code)).toContain('PLAYER_DISQUALIFIED');
  });

  it('descalifica con 2 faltas técnicas (FIBA)', () => {
    let state = createState();
    state = service.registerGameEvent(state, event({ type: 'technical_foul' }));
    state = service.registerGameEvent(state, event({ id: crypto.randomUUID(), type: 'technical_foul' }));
    expect(state.players['home-1'].isDisqualified).toBe(true);
  });

  it('descalifica con 2 faltas antideportivas (FIBA)', () => {
    let state = createState();
    state = service.registerGameEvent(state, event({ type: 'unsportsmanlike_foul' }));
    state = service.registerGameEvent(state, event({ id: crypto.randomUUID(), type: 'unsportsmanlike_foul' }));
    expect(state.players['home-1'].isDisqualified).toBe(true);
  });

  it('descalifica con 1 técnica + 1 antideportiva (FIBA)', () => {
    let state = createState();
    state = service.registerGameEvent(state, event({ type: 'technical_foul' }));
    state = service.registerGameEvent(state, event({ id: crypto.randomUUID(), type: 'unsportsmanlike_foul' }));
    expect(state.players['home-1'].isDisqualified).toBe(true);
  });

  it('descalifica si personales + antideportivas >= 5', () => {
    let state = createState();
    for (let i = 0; i < 4; i += 1) {
      state = service.registerGameEvent(state, event({ id: crypto.randomUUID(), type: 'personal_foul' }));
    }
    state = service.registerGameEvent(state, event({ id: crypto.randomUUID(), type: 'unsportsmanlike_foul' }));
    expect(state.players['home-1'].isDisqualified).toBe(true);
  });

  it('no descalifica con 4 personales + 1 técnica', () => {
    let state = createState();
    for (let i = 0; i < 4; i += 1) {
      state = service.registerGameEvent(state, event({ id: crypto.randomUUID(), type: 'personal_foul' }));
    }
    state = service.registerGameEvent(state, event({ id: crypto.randomUUID(), type: 'technical_foul' }));
    expect(state.players['home-1'].isDisqualified).toBe(false);
  });

  it('descalifica con una falta descalificante directa', () => {
    let state = createState();
    state = service.registerGameEvent(state, event({ type: 'disqualifying_foul' }));
    expect(state.players['home-1'].isDisqualified).toBe(true);
  });
});
