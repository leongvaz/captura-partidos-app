import type { MatchEvent } from './event-types';
import { shouldDisqualifyPlayer } from './eligibility';
import { countsAsTeamFoul, getDisplayFouls, getPeriodKey } from './fouls';
import type { LeagueRulesConfig } from './rules-config';
import { getScoreDelta } from './score';
import type { MatchState, TeamGameState, TeamSide } from './types';

function getTeamState(state: MatchState, teamSide: TeamSide): TeamGameState {
  return teamSide === 'home' ? state.home : state.away;
}

function rebuildTeamCollections(state: MatchState) {
  state.home.playersOnCourt = [];
  state.home.benchPlayers = [];
  state.home.disqualifiedPlayers = [];
  state.away.playersOnCourt = [];
  state.away.benchPlayers = [];
  state.away.disqualifiedPlayers = [];

  for (const player of Object.values(state.players)) {
    const team = getTeamState(state, player.teamSide);
    if (player.isDisqualified) {
      team.disqualifiedPlayers.push(player.playerId);
    } else if (player.isOnCourt) {
      team.playersOnCourt.push(player.playerId);
    } else {
      team.benchPlayers.push(player.playerId);
    }
  }

  state.home.score = state.score.home;
  state.away.score = state.score.away;
}

function updatePlayerFoulDisplay(state: MatchState, rules: LeagueRulesConfig) {
  for (const player of Object.values(state.players)) {
    player.totalFoulsForDisplay = getDisplayFouls(player, rules);
  }
}

export function applyEvent(
  prev: MatchState,
  event: MatchEvent,
  rules: LeagueRulesConfig
): MatchState {
  const next: MatchState = structuredClone(prev);
  const nextDuration =
    event.periodType === 'regular'
      ? rules.regularPeriodDurationSeconds
      : rules.overtimeDurationSeconds;

  next.eventIdsApplied.push(event.id);
  next.currentPeriod = {
    number: event.periodNumber,
    type: event.periodType,
    durationSeconds: nextDuration,
  };
  next.clock.remainingSeconds = event.clockRemainingSeconds;

  if (event.type === 'clock_started') next.clock.isRunning = true;
  if (event.type === 'clock_stopped' || event.type === 'period_ended') next.clock.isRunning = false;
  if (event.type === 'clock_set' && typeof event.payload?.remainingSeconds === 'number') {
    next.clock.remainingSeconds = event.payload.remainingSeconds;
  }

  if (event.type === 'match_started') next.status = 'in_progress';
  if (event.type === 'match_finished') next.status = 'finished';

  if (event.type === 'period_started') {
    next.status = 'in_progress';
    next.currentPeriod = {
      number: event.periodNumber,
      type: event.periodType,
      durationSeconds:
        event.periodType === 'regular'
          ? rules.regularPeriodDurationSeconds
          : rules.overtimeDurationSeconds,
    };
    next.clock.remainingSeconds = next.currentPeriod.durationSeconds;
  }

  if (event.type === 'overtime_started') {
    next.status = 'in_progress';
    next.overtimeCount = Math.max(next.overtimeCount, event.periodNumber);
    next.currentPeriod = {
      number: event.periodNumber,
      type: 'overtime',
      durationSeconds: rules.overtimeDurationSeconds,
    };
    next.clock.remainingSeconds = rules.overtimeDurationSeconds;
  }

  const delta = getScoreDelta(event, rules);
  if (delta > 0) {
    if (event.teamSide === 'home') next.score.home += delta;
    else next.score.away += delta;

    if (event.playerId) {
      const player = next.players[event.playerId];
      if (player) {
        player.points += delta;
        if (event.type === 'point_2') player.fieldGoals2Made += 1;
        if (event.type === 'point_3') player.fieldGoals3Made += 1;
        if (event.type === 'free_throw_made') player.freeThrowsMade += 1;
      }
    }
  }

  if (event.type === 'free_throw_missed' && event.playerId) {
    const player = next.players[event.playerId];
    if (player) player.freeThrowsMissed += 1;
  }

  if (
    event.type === 'personal_foul' ||
    event.type === 'technical_foul' ||
    event.type === 'unsportsmanlike_foul' ||
    event.type === 'disqualifying_foul'
  ) {
    if (event.playerId) {
      const player = next.players[event.playerId];
      if (player) {
        if (event.type === 'personal_foul') player.personalFouls += 1;
        if (event.type === 'technical_foul') player.technicalFouls += 1;
        if (event.type === 'unsportsmanlike_foul') player.unsportsmanlikeFouls += 1;
        if (event.type === 'disqualifying_foul') player.disqualifyingFouls += 1;

        if (shouldDisqualifyPlayer(player, rules)) {
          player.isDisqualified = true;
          player.isOnCourt = false;
          player.isBench = false;
        }
      }
    }

    if (countsAsTeamFoul(event.type)) {
      const key = getPeriodKey(event.periodNumber, event.periodType);
      const team = getTeamState(next, event.teamSide);
      team.teamFoulsByPeriod[key] = (team.teamFoulsByPeriod[key] || 0) + 1;
      team.bonusByPeriod[key] = team.teamFoulsByPeriod[key] >= rules.teamFoulPenaltyStartsAt;
    }
  }

  if (event.type === 'timeout') {
    const key = getPeriodKey(event.periodNumber, event.periodType);
    const team = getTeamState(next, event.teamSide);
    team.timeoutsByPeriod[key] = (team.timeoutsByPeriod[key] || 0) + 1;
  }

  if (event.type === 'substitution_out' && event.playerId) {
    const player = next.players[event.playerId];
    if (player) {
      player.isOnCourt = false;
      player.isBench = !player.isDisqualified;
    }
  }

  if (event.type === 'substitution_in' && event.playerId) {
    const player = next.players[event.playerId];
    if (player) {
      player.isOnCourt = true;
      player.isBench = false;
    }
  }

  if (event.type === 'player_disqualified' && event.playerId) {
    const player = next.players[event.playerId];
    if (player) {
      player.isDisqualified = true;
      player.isOnCourt = false;
      player.isBench = false;
    }
  }

  updatePlayerFoulDisplay(next, rules);
  rebuildTeamCollections(next);
  next.overtimeCount = next.currentPeriod.type === 'overtime' ? next.currentPeriod.number : next.overtimeCount;
  return next;
}
