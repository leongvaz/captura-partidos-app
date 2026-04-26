export interface LeagueRulesConfig {
  regularPeriods: number;
  regularPeriodDurationSeconds: number;
  overtimeDurationSeconds: number;
  maxPlayersOnCourt: number;
  allowOvertime: boolean;
  overtimeUntilWinner: boolean;
  teamFoulPenaltyStartsAt: number;
  timeoutsFirstHalf: number;
  timeoutsSecondHalf: number;
  timeoutsPerOvertime: number;
  playerDisqualificationPersonalFouls: number;
  /**
   * FIBA: 2 técnicas => expulsión.
   * Pon 0 para deshabilitar esta vía.
   */
  playerDisqualificationTechnicalFouls: number;
  /**
   * FIBA: 2 antideportivas => expulsión.
   * Pon 0 para deshabilitar esta vía.
   */
  playerDisqualificationUnsportsmanlikeFouls: number;
  /**
   * FIBA: 1 técnica + 1 antideportiva => expulsión.
   */
  playerDisqualificationTechPlusUnsportsmanlike: boolean;
  countTechnicalTowardsDisqualification: boolean;
  countUnsportsmanlikeTowardsDisqualification: boolean;
  closingPhotoRequired: boolean;
  scoreEventValues: {
    point_2: number;
    point_3: number;
    free_throw_made: number;
  };
  foulsDisplayMode: 'personal_only' | 'personal_plus_technical_plus_unsportsmanlike';
  validateClockOnFinish: boolean;
}

export const defaultLeagueRules: LeagueRulesConfig = {
  regularPeriods: 4,
  regularPeriodDurationSeconds: 600,
  overtimeDurationSeconds: 300,
  maxPlayersOnCourt: 5,
  allowOvertime: true,
  overtimeUntilWinner: true,
  teamFoulPenaltyStartsAt: 5,
  timeoutsFirstHalf: 2,
  timeoutsSecondHalf: 3,
  timeoutsPerOvertime: 1,
  playerDisqualificationPersonalFouls: 5,
  playerDisqualificationTechnicalFouls: 2,
  playerDisqualificationUnsportsmanlikeFouls: 2,
  playerDisqualificationTechPlusUnsportsmanlike: true,
  // Se mantiene por compatibilidad (ligas antiguas), pero FIBA se controla con los umbrales de arriba.
  countTechnicalTowardsDisqualification: false,
  countUnsportsmanlikeTowardsDisqualification: false,
  closingPhotoRequired: false,
  scoreEventValues: {
    point_2: 2,
    point_3: 3,
    free_throw_made: 1,
  },
  foulsDisplayMode: 'personal_plus_technical_plus_unsportsmanlike',
  validateClockOnFinish: true,
};
