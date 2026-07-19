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
export function buildMuseum(seasonHistory: SeasonRecord[], clubCurto: string): MuseumData {
  const own=seasonHistory.filter(s=>s.teamCurto===clubCurto),score=(s:SeasonRecord)=>s.points+(s.position===1?100:0)+(s.promoted?30:0)-(s.relegated?30:0)
  return{titles:own.filter(s=>s.position===1||s.champion===clubCurto).map(s=>({competition:s.competition,season:s.season,managerName:s.managerName})),legends:[],records:[],seasonHistory:own,bestSeasons:own.toSorted((a,b)=>score(b)-score(a)).slice(0,5),worstSeasons:own.toSorted((a,b)=>score(a)-score(b)).slice(0,5)}
}

/** Insere ídolo no museu (via critério: 200 jogos, 50 gols, 5 anos, ou título). */
export function nominateLegend(legend: ClubLegend, existing: ClubLegend[]): ClubLegend[] {
  if(legend.apps<200&&legend.goals<50&&legend.yearsAtClub<5&&legend.trophies<1)return [...existing]
  return [...existing.filter(l=>l.playerId!==legend.playerId),structuredClone(legend)].toSorted((a,b)=>b.apps-a.apps)
}

/** Atualiza records quando uma marca é batida. */
export function updateRecords(records: ClubRecord[], newRecord: ClubRecord): ClubRecord[] {
  const current=records.find(r=>r.category===newRecord.category),lowerWins=newRecord.category==="biggest_loss"
  if(current&&!(lowerWins?newRecord.value<current.value:newRecord.value>current.value))return [...records]
  return [...records.filter(r=>r.category!==newRecord.category),structuredClone(newRecord)]
}
