// PHASE 32 — Hall da Fama (perspectiva do técnico)
// Status: skeleton — clubes treinados, títulos, reputação, aproveitamento, ranking.

import type { SeasonRecord } from "@/lib/career-types"

export interface ManagerCareerStats {
  managerName: string
  startedAt: number                // year
  totalSeasons: number
  totalMatches: number
  totalWins: number
  totalDraws: number
  totalLosses: number
  winRate: number
  totalPoints: number
  trophies: ManagerTrophy[]
  clubs: ClubTenure[]
  reputation: number               // 0..100
  rankingPosition: number
}

export interface ManagerTrophy {
  competition: string
  season: number
  clubCurto: string
  clubNome: string
}

export interface ClubTenure {
  clubCurto: string
  clubNome: string
  fromSeason: number
  toSeason: number
  matches: number
  wins: number
  trophies: number
  endReason: "fired" | "resigned" | "contract_ended" | "still_active"
}

/** Constrói stats da carreira a partir do save. */
export function buildCareerStats(_history: SeasonRecord[]): ManagerCareerStats {
  throw new Error("hall-of-fame-engine.buildCareerStats: not implemented")
}

/** Compara técnico com ranking global (lendas da história). */
export function rankInHistory(_stats: ManagerCareerStats): {
  position: number
  similarTo: string[]              // técnicos lendários comparáveis
} {
  throw new Error("hall-of-fame-engine.rankInHistory: not implemented")
}
