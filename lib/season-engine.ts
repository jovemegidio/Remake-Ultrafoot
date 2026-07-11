// PHASE 1 — Core do modo carreira: motor de temporada
// Orquestra career-engine (fixtures, tabela, finanças, mensagens) com o save-system (GameState).
// Nota arquitetural: fixtures e tabela NÃO residem em GameState — ficam no game-engine.ts
// (zustand). Estas funções recebem o contexto de carreira explicitamente via CareerContext.

import type {
  StandingEntry,
  MatchFixture,
  MatchResult,
  SeasonRecord,
} from "@/lib/career-types"
import type { GameState, SavedTeam } from "@/lib/save-system"
import {
  getLeagueTeams,
  generateSeasonFixtures,
  initStandings,
  simulateCPURound,
  updateStandings,
  sortStandings,
  endSeason,
  generateEndSeasonMessage,
  generateWelcomeMessages,
  calcRoundFinances,
  calcBalanceFromFinances,
} from "@/lib/career-engine"

export type SeasonPhase =
  | "pre_temporada"
  | "estadual"
  | "regular"
  | "mata_mata"
  | "fim_temporada"

export interface SeasonContext {
  season: number
  round: number
  phase: SeasonPhase
  fixtures: MatchFixture[]
  standings: StandingEntry[]
  results: MatchResult[]
}

export interface SeasonAdvanceResult {
  state: GameState
  newResults: MatchResult[]
  seasonEnded: boolean
  nextSeason?: number
}

/** Contexto de carreira passado pelo chamador (game-engine ou ao-vivo/client). */
export interface CareerContext {
  userTeam: SavedTeam
  leagueTeams: ReturnType<typeof getLeagueTeams>
  fixtures: MatchFixture[]
  standings: StandingEntry[]
  results: MatchResult[]
}

/**
 * Avança 1 rodada: simula partidas CPU da rodada atual e atualiza estado.
 * A partida do usuário já deve ter sido registrada antes de chamar esta função.
 */
export function advanceRound(state: GameState, ctx: CareerContext): SeasonAdvanceResult {
  const round = state.week
  const totalRounds = ctx.fixtures.reduce((max, f) => Math.max(max, f.round), 0)

  // Simula rodadas CPU (exclui partida do usuário)
  const { fixtures: updatedFixtures, results: cpuResults } = simulateCPURound(
    ctx.fixtures,
    round,
    ctx.userTeam.curto,
    ctx.leagueTeams,
    state.season
  )

  // Atualiza tabela com resultados CPU
  let updatedStandings = ctx.standings
  for (const r of cpuResults) {
    updatedStandings = updateStandings(updatedStandings, r.homeCurto, r.awayCurto, r.homeGoals, r.awayGoals)
  }
  updatedStandings = sortStandings(updatedStandings)

  const seasonEnded = round >= totalRounds
  const newState: GameState = { ...state, week: seasonEnded ? round : round + 1 }

  return {
    state: newState,
    newResults: cpuResults,
    seasonEnded,
    nextSeason: seasonEnded ? state.season + 1 : undefined,
  }
}

/**
 * Encerra a temporada: define campeão, promovidos, rebaixados, gera SeasonRecord.
 * standings deve ser a tabela final ordenada.
 */
export function finalizeSeason(
  state: GameState,
  standings: StandingEntry[],
  userTeam: SavedTeam
): {
  record: SeasonRecord
  championCurto: string
  promotedCurtos: string[]
  relegatedCurtos: string[]
  endMessage: ReturnType<typeof generateEndSeasonMessage>
} {
  const sorted = sortStandings(standings)
  const { champion, promoted, relegated } = endSeason(sorted)

  const userEntry = sorted.find(s => s.curto === userTeam.curto)
  const userPosition = userEntry ? sorted.indexOf(userEntry) + 1 : sorted.length
  const isPromoted = promoted.includes(userTeam.curto) && userPosition > 1
  const isRelegated = relegated.includes(userTeam.curto)

  const record: SeasonRecord = {
    season: state.season,
    competition: "Campeonato",
    position: userPosition,
    points: userEntry?.points ?? 0,
    won: userEntry?.won ?? 0,
    drawn: userEntry?.drawn ?? 0,
    lost: userEntry?.lost ?? 0,
    goalsFor: userEntry?.goalsFor ?? 0,
    goalsAgainst: userEntry?.goalsAgainst ?? 0,
    champion,
    managerName: state.managerName,
    promoted: isPromoted,
    relegated: isRelegated,
    teamCurto: userTeam.curto,
    teamNome: userTeam.nome,
  }

  const endMessage = generateEndSeasonMessage(
    userTeam.nome,
    userPosition,
    userEntry?.points ?? 0,
    champion,
    isRelegated,
    isPromoted,
    state.season
  )

  return { record, championCurto: champion, promotedCurtos: promoted, relegatedCurtos: relegated, endMessage }
}

/**
 * Inicializa nova temporada: incrementa season, reseta week, gera fixtures e tabela zerada.
 * Retorna o novo GameState E o contexto de carreira para o chamador persistir no game-engine.
 */
export function startNewSeason(
  state: GameState,
  userTeam: SavedTeam
): {
  state: GameState
  fixtures: MatchFixture[]
  standings: StandingEntry[]
  welcomeMessages: ReturnType<typeof generateWelcomeMessages>
} {
  const newSeason = state.season + 1
  const leagueTeams = getLeagueTeams(userTeam)
  const fixtures = generateSeasonFixtures(leagueTeams, userTeam.curto, newSeason)
  const standings = initStandings(leagueTeams)
  const welcomeMessages = generateWelcomeMessages(userTeam.nome, state.managerName, newSeason)

  const newState: GameState = {
    ...state,
    season: newSeason,
    week: 1,
  }

  return { state: newState, fixtures, standings, welcomeMessages }
}

/** Calcula a fase atual da temporada com base no calendário. */
export function getSeasonPhase(round: number, totalRounds = 38): SeasonPhase {
  if (round <= 0) return "pre_temporada"
  if (round >= totalRounds) return "fim_temporada"
  return "regular"
}

/**
 * Helper: gera o CareerContext inicial para uma nova carreira ou ao carregar save.
 * Útil para inicializar o estado quando game-engine ainda não tem dados de carreira.
 */
export function buildInitialCareerContext(state: GameState, userTeam: SavedTeam): {
  leagueTeams: ReturnType<typeof getLeagueTeams>
  fixtures: MatchFixture[]
  standings: StandingEntry[]
} {
  const leagueTeams = getLeagueTeams(userTeam)
  const fixtures = generateSeasonFixtures(leagueTeams, userTeam.curto, state.season)
  const standings = initStandings(leagueTeams)
  return { leagueTeams, fixtures, standings }
}
