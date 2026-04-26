import type { LeagueRulesConfig } from './rules-config';
import type { PlayerGameState } from './types';

export function isPlayerDisqualified(player: PlayerGameState): boolean {
  return player.isDisqualified;
}

export function shouldDisqualifyPlayer(
  player: PlayerGameState,
  rules: LeagueRulesConfig
): boolean {
  if (player.disqualifyingFouls > 0) return true;

  // Regla FIBA (según criterio del proyecto):
  // - personales + antideportivas >= 5 => descalificación
  // - antideportivas >= 2 => descalificación
  // - técnicas >= 2 => descalificación
  // - 1 técnica + 1 antideportiva => descalificación
  if (player.personalFouls + player.unsportsmanlikeFouls >= rules.playerDisqualificationPersonalFouls) return true;

  if (rules.playerDisqualificationTechnicalFouls > 0 && player.technicalFouls >= rules.playerDisqualificationTechnicalFouls) {
    return true;
  }
  if (
    rules.playerDisqualificationUnsportsmanlikeFouls > 0 &&
    player.unsportsmanlikeFouls >= rules.playerDisqualificationUnsportsmanlikeFouls
  ) {
    return true;
  }
  if (
    rules.playerDisqualificationTechPlusUnsportsmanlike &&
    player.technicalFouls >= 1 &&
    player.unsportsmanlikeFouls >= 1
  ) {
    return true;
  }

  // Compat: algunas ligas cuentan técnicas/antideportivas como “progreso” hacia el límite de personales.
  const foulProgress =
    player.personalFouls +
    (rules.countTechnicalTowardsDisqualification ? player.technicalFouls : 0) +
    (rules.countUnsportsmanlikeTowardsDisqualification ? player.unsportsmanlikeFouls : 0);

  return foulProgress >= rules.playerDisqualificationPersonalFouls;
}
