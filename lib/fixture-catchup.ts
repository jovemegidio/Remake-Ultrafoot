// Quais partidas do usuário ficaram para trás e precisam ser resolvidas.
//
// Extraído de `advanceWeek` (lib/use-game-manager.ts) para poder ser testado
// sem React: a regressão da 1.0.98 passou despercebida justamente porque a
// decisão estava presa dentro de um hook e ninguém conseguia exercitá-la.

export interface CatchupFixture {
  week: number
  played?: boolean
  isUserMatch?: boolean
}

/**
 * Decide se uma partida do usuário deve ser simulada automaticamente.
 *
 * `week < newWeek` (estritamente no passado) é a regra central: a partida da
 * semana que está começando ainda pertence ao jogador para disputar. Só o que
 * ficou para trás é resolvido pelo motor.
 */
export function isOverdueUserFixture(
  fixture: CatchupFixture,
  newWeek: number,
  completedKeys: readonly string[] = [],
  fixtureKey?: string,
): boolean {
  if (!fixture.isUserMatch) return false
  if (fixture.played) return false
  if (fixture.week >= newWeek) return false
  if (fixtureKey && completedKeys.includes(fixtureKey)) return false
  return true
}

/** Aplica a regra a um calendário inteiro, preservando a ordem cronológica. */
export function selectOverdueUserFixtures<T extends CatchupFixture>(
  fixtures: readonly T[],
  newWeek: number,
): T[] {
  return fixtures
    .filter(fixture => isOverdueUserFixture(fixture, newWeek))
    .sort((a, b) => a.week - b.week)
}
