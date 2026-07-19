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
export function buildCareerStats(history: SeasonRecord[]): ManagerCareerStats {
  const matches=history.reduce((n,s)=>n+s.won+s.drawn+s.lost,0), wins=history.reduce((n,s)=>n+s.won,0), draws=history.reduce((n,s)=>n+s.drawn,0), losses=history.reduce((n,s)=>n+s.lost,0)
  const trophies=history.filter(s=>s.champion === s.teamCurto || s.position === 1).map(s=>({competition:s.competition,season:s.season,clubCurto:s.teamCurto,clubNome:s.teamNome}))
  const clubs = new Map<string,ClubTenure>()
  for(const s of history){ const c=clubs.get(s.teamCurto)??{clubCurto:s.teamCurto,clubNome:s.teamNome,fromSeason:s.season,toSeason:s.season,matches:0,wins:0,trophies:0,endReason:"contract_ended" as const}; c.fromSeason=Math.min(c.fromSeason,s.season);c.toSeason=Math.max(c.toSeason,s.season);c.matches+=s.won+s.drawn+s.lost;c.wins+=s.won;c.trophies+=s.position===1?1:0;clubs.set(s.teamCurto,c) }
  const reputation=Math.min(100,Math.round(trophies.length*12+(matches? wins/matches*35:0)+history.filter(s=>s.promoted).length*5))
  return {managerName:history.at(-1)?.managerName??"Técnico",startedAt:history[0]?.season??new Date().getFullYear(),totalSeasons:new Set(history.map(s=>s.season)).size,totalMatches:matches,totalWins:wins,totalDraws:draws,totalLosses:losses,winRate:matches?Math.round(wins/matches*1000)/10:0,totalPoints:wins*3+draws,trophies,clubs:[...clubs.values()],reputation,rankingPosition:rankInHistory({reputation,totalSeasons:history.length,totalMatches:matches,totalWins:wins,totalDraws:draws,totalLosses:losses,winRate:matches?wins/matches*100:0,totalPoints:wins*3+draws,trophies,clubs:[...clubs.values()],managerName:history.at(-1)?.managerName??"Técnico",startedAt:history[0]?.season??2026,rankingPosition:0}).position}
}

/** Compara técnico com ranking global (lendas da história). */
export function rankInHistory(stats: ManagerCareerStats): {
  position: number
  similarTo: string[]              // técnicos lendários comparáveis
} {
  const score=stats.reputation+stats.trophies.length*10+stats.winRate/4
  const position=score>=180?1:score>=145?10:score>=110?50:score>=75?150:500
  const similarTo=score>=180?["Alex Ferguson","Pep Guardiola"]:score>=145?["Carlo Ancelotti","José Mourinho"]:score>=110?["Telê Santana","Marcelo Gallardo"]:["Técnicos em ascensão"]
  return {position,similarTo}
}
