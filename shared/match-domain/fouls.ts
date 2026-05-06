import type { LeagueRulesConfig } from './rules-config.js';
import type { PeriodType, PlayerGameState, TeamFoulsByPeriod } from './types.js';

export function isFoulEvent(type: string): boolean {
  return (
    type === 'personal_foul' ||
    type === 'technical_foul' ||
    type === 'unsportsmanlike_foul' ||
    type === 'disqualifying_foul'
  );
}

export function getPeriodKey(periodNumber: number, periodType: PeriodType): string {
  return periodType === 'regular' ? `R${periodNumber}` : `OT${periodNumber}`;
}

export function countsAsTeamFoul(type: string): boolean {
  return isFoulEvent(type);
}

export function countsAsPersonalFoul(type: string): boolean {
  return type === 'personal_foul';
}

export function countsAsDisqualificationProgress(type: string, rules: LeagueRulesConfig): boolean {
  if (type === 'personal_foul') return true;
  if (type === 'technical_foul') return rules.countTechnicalTowardsDisqualification;
  if (type === 'unsportsmanlike_foul') return rules.countUnsportsmanlikeTowardsDisqualification;
  return false;
}

export function getDisplayFouls(player: PlayerGameState, rules: LeagueRulesConfig): number {
  if (rules.foulsDisplayMode === 'personal_only') {
    return player.personalFouls;
  }
  return (
    player.personalFouls +
    player.technicalFouls +
    player.unsportsmanlikeFouls +
    player.disqualifyingFouls
  );
}

export function getTeamFoulsByPeriod(teamFoulsByPeriod: TeamFoulsByPeriod): TeamFoulsByPeriod {
  return { ...teamFoulsByPeriod };
}
