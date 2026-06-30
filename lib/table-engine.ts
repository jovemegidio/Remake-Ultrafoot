// PHASE 1 — Tabela dinâmica
// Status: skeleton — re-exports puros de career-engine (que já implementa) +
// stubs para evolução futura: tiebreaker BR (confronto direto), tabela cumulativa,
// histórico de campeões, artilharia, assistências, ranking de clubes/técnicos.

import type { StandingEntry, SeasonRecord } from "@/lib/career-types"
import {
  initStandings as _initStandings,
  updateStandings as _updateStandings,
  sortStandings as _sortStandings,
} from "@/lib/career-engine"

export const initStandings = _initStandings
export const updateStandings = _updateStandings
export const sortStandings = _sortStandings

export interface TopScorer {
  playerId: string
  playerName: string
  teamCurto: string
  goals: number
  season: number
}

export interface TopAssister {
  playerId: string
  playerName: string
  teamCurto: string
  assists: number
  season: number
}

export interface ClubRanking {
  curto: string
  nome: string
  totalPoints: number
  totalTitles: number
  seasons: number
}

export interface ManagerRanking {
  managerName: string
  totalPoints: number
  totalTitles: number
  seasons: number
  clubs: string[]
}

/** Aplica tiebreakers do Brasileirão (confronto direto, etc). */
export function applyBRTiebreakers(
  _standings: StandingEntry[],
  _resultsThisSeason: { homeCurto: string; awayCurto: string; homeGoals: number; awayGoals: number }[]
): StandingEntry[] {
  throw new Error("table-engine.applyBRTiebreakers: not implemented")
}

/** Constrói ranking histórico de clubes a partir de SeasonRecord[]. */
export function buildClubRanking(_history: SeasonRecord[]): ClubRanking[] {
  throw new Error("table-engine.buildClubRanking: not implemented")
}

/** Constrói ranking de técnicos a partir do histórico do jogador. */
export function buildManagerRanking(_history: SeasonRecord[]): ManagerRanking[] {
  throw new Error("table-engine.buildManagerRanking: not implemented")
}

/** Top artilheiros da temporada. */
export function calcTopScorers(_season: number): TopScorer[] {
  throw new Error("table-engine.calcTopScorers: not implemented")
}

/** Top assistentes da temporada. */
export function calcTopAssisters(_season: number): TopAssister[] {
  throw new Error("table-engine.calcTopAssisters: not implemented")
}
