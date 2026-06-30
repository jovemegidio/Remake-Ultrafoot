// PHASE 1 — Múltiplas competições simultâneas
// Status: skeleton — define o framework de competições (liga, copa, estadual, continental).
// Cada competição tem seu próprio formato, regras de classificação e prêmios.

import type { MatchFixture, StandingEntry } from "@/lib/career-types"

export type CompetitionFormat =
  | "league"          // Brasileirão Série A/B/C/D — pontos corridos
  | "knockout"        // Copa do Brasil, Libertadores mata-mata
  | "groups_knockout" // Libertadores fase de grupos + mata-mata
  | "state"           // Estaduais (grupos + final)

export type CompetitionScope = "national" | "state" | "continental" | "intercontinental"

export interface CompetitionConfig {
  id: string
  nome: string
  format: CompetitionFormat
  scope: CompetitionScope
  divisao?: string                 // serie_a, serie_b, etc — para ligas
  numTeams: number
  numRounds?: number               // para liga
  numGroups?: number               // para fase de grupos
  promotionSlots?: number          // quantos sobem
  relegationSlots?: number         // quantos caem
  continentalSlots?: number        // vagas pra continental no ano seguinte
  prizePool?: Record<number, number> // posição → prêmio
}

export interface CompetitionState {
  config: CompetitionConfig
  season: number
  fixtures: MatchFixture[]
  standings: StandingEntry[]
  knockoutBracket?: KnockoutNode[]
  champion?: string
  isActive: boolean
}

export interface KnockoutNode {
  id: string
  round: string                    // "oitavas", "quartas", "semi", "final"
  homeCurto?: string
  awayCurto?: string
  legs: { homeGoals: number; awayGoals: number }[]
  winner?: string
  next?: string
}

export const DEFAULT_COMPETITIONS: CompetitionConfig[] = [
  // TODO: popular com Brasileirão A/B/C/D, Copa do Brasil, Estaduais, Libertadores, Sul-Americana
]

/** Inicializa estado de uma competição (fixtures, brackets, etc). */
export function initCompetition(_config: CompetitionConfig, _season: number): CompetitionState {
  throw new Error("competition-engine.initCompetition: not implemented")
}

/** Avança a competição uma rodada/etapa. */
export function advanceCompetition(_state: CompetitionState): CompetitionState {
  throw new Error("competition-engine.advanceCompetition: not implemented")
}

/** Verifica vagas continentais ganhas/perdidas ao final. */
export function calcContinentalQualifiers(_state: CompetitionState): string[] {
  throw new Error("competition-engine.calcContinentalQualifiers: not implemented")
}
