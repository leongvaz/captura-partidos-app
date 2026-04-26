import type { LeagueRulesConfig } from './rules-config';
import type {
  MatchState,
  PlayerGameState,
  TeamGameState,
  TeamSide,
} from './types';

export interface InitialPlayerSeed {
  playerId: string;
  teamSide: TeamSide;
  jerseyNumber?: string;
  isStarter: boolean;
  isOnCourt: boolean;
  isExcluded?: boolean;
}

export interface InitialMatchStateSeed {
  matchId: string;
  status?: MatchState['status'];
  currentPeriod: MatchState['currentPeriod'];
  clock: MatchState['clock'];
  players: InitialPlayerSeed[];
  closingPhotoProvided?: boolean;
  closingPhotoRequired?: boolean;
}

function createEmptyTeam(teamSide: TeamSide): TeamGameState {
  return {
    teamSide,
    score: 0,
    teamFoulsByPeriod: {},
    bonusByPeriod: {},
    timeoutsByPeriod: {},
    playersOnCourt: [],
    benchPlayers: [],
    disqualifiedPlayers: [],
  };
}

function createPlayer(seed: InitialPlayerSeed): PlayerGameState {
  return {
    playerId: seed.playerId,
    teamSide: seed.teamSide,
    jerseyNumber: seed.jerseyNumber,
    isStarter: seed.isStarter,
    isOnCourt: seed.isOnCourt,
    isBench: !seed.isOnCourt,
    isExcluded: seed.isExcluded ?? false,
    isDisqualified: false,
    points: 0,
    fieldGoals2Made: 0,
    fieldGoals3Made: 0,
    freeThrowsMade: 0,
    freeThrowsMissed: 0,
    personalFouls: 0,
    technicalFouls: 0,
    unsportsmanlikeFouls: 0,
    disqualifyingFouls: 0,
    totalFoulsForDisplay: 0,
  };
}

export function createInitialMatchState(seed: InitialMatchStateSeed): MatchState {
  const home = createEmptyTeam('home');
  const away = createEmptyTeam('away');
  const players: Record<string, PlayerGameState> = {};

  for (const playerSeed of seed.players) {
    const player = createPlayer(playerSeed);
    players[player.playerId] = player;
    const team = player.teamSide === 'home' ? home : away;
    if (player.isOnCourt) team.playersOnCourt.push(player.playerId);
    else team.benchPlayers.push(player.playerId);
  }

  return {
    matchId: seed.matchId,
    status: seed.status ?? 'scheduled',
    currentPeriod: seed.currentPeriod,
    clock: seed.clock,
    score: { home: 0, away: 0 },
    home,
    away,
    players,
    eventIdsApplied: [],
    winnerTeamSide: null,
    canFinish: false,
    finishBlockReasons: [],
    needsOvertime: false,
    overtimeCount: seed.currentPeriod.type === 'overtime' ? seed.currentPeriod.number : 0,
    metadata: {
      closingPhotoRequired: seed.closingPhotoRequired ?? false,
      closingPhotoProvided: seed.closingPhotoProvided ?? false,
    },
  };
}

export function getDefaultCurrentPeriod(rules: LeagueRulesConfig) {
  return {
    number: 1,
    type: 'regular' as const,
    durationSeconds: rules.regularPeriodDurationSeconds,
  };
}
