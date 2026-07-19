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
  {id:"serie_a",nome:"Brasileirão Série A",format:"league",scope:"national",divisao:"serie_a",numTeams:20,numRounds:38,relegationSlots:4,continentalSlots:6},
  {id:"serie_b",nome:"Brasileirão Série B",format:"league",scope:"national",divisao:"serie_b",numTeams:20,numRounds:38,promotionSlots:4,relegationSlots:4},
  {id:"serie_c",nome:"Brasileirão Série C",format:"groups_knockout",scope:"national",divisao:"serie_c",numTeams:20,numRounds:19,promotionSlots:4,relegationSlots:2},
  {id:"serie_d",nome:"Brasileirão Série D",format:"groups_knockout",scope:"national",divisao:"serie_d",numTeams:96,promotionSlots:6},
  {id:"copa_brasil",nome:"Copa do Brasil",format:"knockout",scope:"national",numTeams:126},
  {id:"libertadores",nome:"CONMEBOL Libertadores",format:"groups_knockout",scope:"continental",numTeams:47},
  {id:"sulamericana",nome:"CONMEBOL Sul-Americana",format:"groups_knockout",scope:"continental",numTeams:44},
]

/** Inicializa estado de uma competição (fixtures, brackets, etc). */
export function initCompetition(config: CompetitionConfig, season: number): CompetitionState {
  return {config:structuredClone(config),season,fixtures:[],standings:[],knockoutBracket:config.format==="league"?undefined:[],isActive:true}
}

/** Avança a competição uma rodada/etapa. */
export function advanceCompetition(state: CompetitionState): CompetitionState {
  const next=structuredClone(state), pending=next.fixtures.find(f=>!f.played);if(pending)return next
  if(next.fixtures.length&&next.fixtures.every(f=>f.played)){next.isActive=false;next.champion=next.standings.toSorted((a,b)=>b.points-a.points||b.goalDiff-a.goalDiff||b.goalsFor-a.goalsFor)[0]?.curto}
  return next
}

/** Verifica vagas continentais ganhas/perdidas ao final. */
export function calcContinentalQualifiers(state: CompetitionState): string[] {
  const slots=state.config.continentalSlots??0;return state.standings.toSorted((a,b)=>b.points-a.points||b.goalDiff-a.goalDiff||b.goalsFor-a.goalsFor).slice(0,slots).map(t=>t.curto)
}
