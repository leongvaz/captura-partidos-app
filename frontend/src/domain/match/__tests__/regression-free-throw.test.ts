import { describe, expect, it } from 'vitest';
import { deriveLegacyMatchState } from '../legacy-adapter';
import { defaultLeagueRules } from '../rules-config';

describe('free throw regression', () => {
  it('free_throw_missed no suma puntos al score oficial', () => {
    const state = deriveLegacyMatchState(
      {
        id: 'match-legacy-ft',
        estado: 'en_curso',
        localEquipoId: 'home-team',
        visitanteEquipoId: 'away-team',
      },
      [
        { equipoId: 'home-team', jugadorId: 'home-1', enCanchaInicial: true },
        { equipoId: 'away-team', jugadorId: 'away-1', enCanchaInicial: true },
      ],
      [
        {
          id: 'ev-1',
          tipo: 'tiro_libre_fallado',
          jugadorId: 'home-1',
          cuarto: 4,
          orden: 1,
          createdAt: new Date().toISOString(),
          segundosRestantesCuarto: 0,
        },
      ],
      {
        cuartoActual: 4,
        segundosRestantesCuarto: 0,
        cronoRunning: false,
      },
      defaultLeagueRules
    );

    expect(state.score).toEqual({ home: 0, away: 0 });
    expect(state.players['home-1'].freeThrowsMissed).toBe(1);
  });
});
