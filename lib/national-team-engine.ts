// PHASE 26 — Seleções
// Status: skeleton — convocações, eliminatórias, copa, amistosos, ranking fictício.

export interface NationalTeam {
  countryCode: string              // "BRA", "ARG", etc
  countryName: string
  prestigio: number
  rankingPosition: number          // ranking fictício UF
  rankingPoints: number
  squad: string[]                  // playerIds convocados
  manager: string                  // técnico
}

export type CallUpReason =
  | "form"                         // forma boa no clube
  | "regular_starter"
  | "promising_youth"
  | "veteran_experience"
  | "injury_replacement"

export interface CallUp {
  playerId: string
  countryCode: string
  competition: "amistoso" | "eliminatorias" | "copa" | "copa_continental"
  reason: CallUpReason
  matches: number                  // jogos previstos no período
  weekStart: number
  weekEnd: number
}

/** Convoca jogadores de acordo com forma e tipo de competição. */
export function callUpSquad(
  _country: NationalTeam,
  _competition: CallUp["competition"],
  _eligiblePlayers: { playerId: string; overall: number; form: number; nationality: string }[],
): CallUp[] {
  throw new Error("national-team-engine.callUpSquad: not implemented")
}

/** Simula partida de seleção. */
export function simulateNationalMatch(
  _home: NationalTeam,
  _away: NationalTeam,
): { homeGoals: number; awayGoals: number } {
  throw new Error("national-team-engine.simulateNationalMatch: not implemented")
}

/** Atualiza ranking após resultado. */
export function updateRanking(
  _all: NationalTeam[],
  _result: { homeCode: string; awayCode: string; homeGoals: number; awayGoals: number },
): NationalTeam[] {
  throw new Error("national-team-engine.updateRanking: not implemented")
}
