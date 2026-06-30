// PHASE 31 — Museu do clube
// Status: skeleton — títulos, ídolos, recordes, campanhas, temporadas históricas.
// Usa SeasonRecord do career-types como base.

import type { SeasonRecord } from "@/lib/career-types"

export interface ClubTitle {
  competition: string
  season: number
  managerName: string
  topScorer?: string
}

export interface ClubLegend {
  playerId: string
  playerName: string
  position: string
  yearsAtClub: number
  goals: number
  assists: number
  apps: number
  trophies: number
  inductedSeason: number
}

export interface ClubRecord {
  category: "biggest_win" | "biggest_loss" | "most_goals" | "longest_unbeaten" | "transfer_record_buy" | "transfer_record_sell"
  description: string
  value: number
  season: number
}

export interface MuseumData {
  titles: ClubTitle[]
  legends: ClubLegend[]
  records: ClubRecord[]
  seasonHistory: SeasonRecord[]    // re-uso do career-types
  bestSeasons: SeasonRecord[]      // top 5 da história
  worstSeasons: SeasonRecord[]
}

/** Constrói dados do museu a partir do histórico do save. */
export function buildMuseum(_seasonHistory: SeasonRecord[], _clubCurto: string): MuseumData {
  throw new Error("museum-engine.buildMuseum: not implemented")
}

/** Insere ídolo no museu (via critério: 200 jogos, 50 gols, 5 anos, ou título). */
export function nominateLegend(_legend: ClubLegend, _existing: ClubLegend[]): ClubLegend[] {
  throw new Error("museum-engine.nominateLegend: not implemented")
}

/** Atualiza records quando uma marca é batida. */
export function updateRecords(_records: ClubRecord[], _newRecord: ClubRecord): ClubRecord[] {
  throw new Error("museum-engine.updateRecords: not implemented")
}
