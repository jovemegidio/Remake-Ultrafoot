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

/**
 * A temporada do usuário acabou?
 *
 * Duas condições, e a segunda é a que faltava: o clube pode não ter mais NADA
 * para jogar (eliminado das copas, liga encerrada) muito antes de o contador de
 * semanas alcançar o fim teórico da temporada. Antes disso o jogador ficava
 * clicando "avançar" em semanas vazias.
 *
 * `leagueComplete` continua sendo pré-requisito em ambos os caminhos: sem ele o
 * save processaria acesso/rebaixamento com a liga pela metade — exatamente o
 * bug do "rebaixado com 15 jogos".
 */
export function isSeasonOver(input: {
  leagueComplete: boolean
  currentWeek: number
  seasonEndWeek: number
  userFixtures: readonly { played?: boolean }[]
}): boolean {
  if (!input.leagueComplete) return false
  const semCompromissos =
    input.userFixtures.length > 0 && input.userFixtures.every(fixture => fixture.played)
  return input.currentWeek > input.seasonEndWeek || semCompromissos
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
