// PHASE 1 — Tabela dinâmica
// Re-exports de career-engine + implementações de tiebreaker, ranking e artilharia.

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

/**
 * Aplica tiebreakers do Brasileirão:
 * 1. Pontos  2. Vitórias  3. Saldo de Gols  4. Gols Pró
 * 5. Confronto direto (pontos, GS, SG)  6. Nome alfabético
 */
export function applyBRTiebreakers(
  standings: StandingEntry[],
  results: { homeCurto: string; awayCurto: string; homeGoals: number; awayGoals: number }[]
): StandingEntry[] {
  const sorted = [...standings]

  // Build head-to-head mini-table between pairs
  const h2h = new Map<string, { pts: number; gf: number; ga: number }>()
  const key = (a: string, b: string) => [a, b].sort().join("|")

  for (const r of results) {
    const k = key(r.homeCurto, r.awayCurto)
    if (!h2h.has(`${k}:${r.homeCurto}`)) {
      h2h.set(`${k}:${r.homeCurto}`, { pts: 0, gf: 0, ga: 0 })
      h2h.set(`${k}:${r.awayCurto}`, { pts: 0, gf: 0, ga: 0 })
    }
    const home = h2h.get(`${k}:${r.homeCurto}`)!
    const away = h2h.get(`${k}:${r.awayCurto}`)!
    home.gf += r.homeGoals; home.ga += r.awayGoals
    away.gf += r.awayGoals; away.ga += r.homeGoals
    if (r.homeGoals > r.awayGoals) { home.pts += 3 }
    else if (r.homeGoals === r.awayGoals) { home.pts += 1; away.pts += 1 }
    else { away.pts += 3 }
    h2h.set(`${k}:${r.homeCurto}`, home)
    h2h.set(`${k}:${r.awayCurto}`, away)
  }

  sorted.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.won !== a.won) return b.won - a.won
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    // Confronto direto
    const k = key(a.curto, b.curto)
    const ha = h2h.get(`${k}:${a.curto}`) ?? { pts: 0, gf: 0, ga: 0 }
    const hb = h2h.get(`${k}:${b.curto}`) ?? { pts: 0, gf: 0, ga: 0 }
    if (ha.pts !== hb.pts) return hb.pts - ha.pts
    const sgA = ha.gf - ha.ga
    const sgB = hb.gf - hb.ga
    if (sgA !== sgB) return sgB - sgA
    if (ha.gf !== hb.gf) return hb.gf - ha.gf
    return a.nome.localeCompare(b.nome)
  })

  return sorted
}

/** Constrói ranking histórico de clubes a partir de SeasonRecord[]. */
export function buildClubRanking(history: SeasonRecord[]): ClubRanking[] {
  const map = new Map<string, ClubRanking>()
  for (const r of history) {
    const existing = map.get(r.teamCurto) ?? {
      curto: r.teamCurto,
      nome: r.teamNome,
      totalPoints: 0,
      totalTitles: 0,
      seasons: 0,
    }
    existing.totalPoints += r.points
    existing.seasons += 1
    if (r.position === 1) existing.totalTitles += 1
    map.set(r.teamCurto, existing)
  }
  return [...map.values()].sort((a, b) => b.totalTitles - a.totalTitles || b.totalPoints - a.totalPoints)
}

/** Constrói ranking de técnicos a partir do histórico. */
export function buildManagerRanking(history: SeasonRecord[]): ManagerRanking[] {
  const map = new Map<string, ManagerRanking>()
  for (const r of history) {
    const existing = map.get(r.managerName) ?? {
      managerName: r.managerName,
      totalPoints: 0,
      totalTitles: 0,
      seasons: 0,
      clubs: [],
    }
    existing.totalPoints += r.points
    existing.seasons += 1
    if (r.position === 1) existing.totalTitles += 1
    if (!existing.clubs.includes(r.teamCurto)) existing.clubs.push(r.teamCurto)
    map.set(r.managerName, existing)
  }
  return [...map.values()].sort((a, b) => b.totalTitles - a.totalTitles || b.totalPoints - a.totalPoints)
}

/**
 * Top artilheiros da temporada.
 * Requer dados de gols por jogador que ainda não são rastreados no motor de partida.
 * Retorna lista vazia até o rastreamento ser implementado.
 */
export function calcTopScorers(_season: number): TopScorer[] {
  return []
}

/**
 * Top assistentes da temporada.
 * Requer dados de assistências por jogador que ainda não são rastreados no motor de partida.
 * Retorna lista vazia até o rastreamento ser implementado.
 */
export function calcTopAssisters(_season: number): TopAssister[] {
  return []
}
