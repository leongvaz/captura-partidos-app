import type { MatchEvent } from './event-types.js';
import type { LeagueRulesConfig } from './rules-config.js';
import type { MatchScore } from './types.js';

export function getScoreDelta(event: MatchEvent, rules?: LeagueRulesConfig): number {
  switch (event.type) {
    case 'point_2':
      return rules?.scoreEventValues.point_2 ?? 2;
    case 'point_3':
      return rules?.scoreEventValues.point_3 ?? 3;
    case 'free_throw_made':
      return rules?.scoreEventValues.free_throw_made ?? 1;
    default:
      return 0;
  }
}

export function deriveOfficialScore(events: MatchEvent[], rules?: LeagueRulesConfig): MatchScore {
  return events.reduce<MatchScore>(
    (acc, event) => {
      const delta = getScoreDelta(event, rules);
      if (delta === 0) return acc;
      if (event.teamSide === 'home') acc.home += delta;
      else acc.away += delta;
      return acc;
    },
    { home: 0, away: 0 }
  );
}

export function getOfficialScore(score: MatchScore): MatchScore {
  return { ...score };
}
