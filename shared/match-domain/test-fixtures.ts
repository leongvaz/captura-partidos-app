import { createInitialMatchState } from './factories.js';
import { defaultLeagueRules } from './rules-config.js';

export function createBasicMatchFixture() {
  return {
    rules: defaultLeagueRules,
    initialState: createInitialMatchState({
      matchId: 'match-1',
      status: 'in_progress',
      currentPeriod: {
        number: 4,
        type: 'regular',
        durationSeconds: defaultLeagueRules.regularPeriodDurationSeconds,
      },
      clock: {
        remainingSeconds: 0,
        isRunning: false,
      },
      players: [
        { playerId: 'home-1', teamSide: 'home', isStarter: true, isOnCourt: true, jerseyNumber: '4' },
        { playerId: 'home-2', teamSide: 'home', isStarter: true, isOnCourt: true, jerseyNumber: '5' },
        { playerId: 'away-1', teamSide: 'away', isStarter: true, isOnCourt: true, jerseyNumber: '6' },
        { playerId: 'away-2', teamSide: 'away', isStarter: true, isOnCourt: true, jerseyNumber: '7' },
      ],
    }),
  };
}
