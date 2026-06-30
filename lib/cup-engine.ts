// Motor de copa eliminatória (Copa do Brasil).
// Single-leg knockout: 16 → 8 → 4 → 2 → 1 (4 rodadas eliminatórias).
// Pareamento 1: top 8 vs bottom 8 por prestígio para chaveamento mais real.

import type { Team } from "@/lib/teams-data"
import { simulateFullMatch } from "@/lib/match-engine"
import type { CupMatch, CupBracket } from "@/lib/career-types"

const CUP_TEAM_COUNT = 16
const CUP_TOTAL_ROUNDS = 4 // 1=oitavas, 2=quartas, 3=semi, 4=final

const CUP_ROUND_NAME: Record<number, string> = {
  1: "Oitavas de Final",
  2: "Quartas de Final",
  3: "Semifinal",
  4: "Final",
}

const LIBER_ROUND_NAME: Record<number, string> = {
  1: "Quartas de Final",
  2: "Semifinal",
  3: "Final",
}

export function cupRoundLabel(r: number, competition = "Copa do Brasil"): string {
  if (competition === "Libertadores") return LIBER_ROUND_NAME[r] ?? `Rodada ${r}`
  return CUP_ROUND_NAME[r] ?? `Rodada ${r}`
}

/** Embaralha um array preservando ordem reprodutível via seed. */
function shuffleSeeded<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed >>> 0
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Gera chaveamento inicial das oitavas com 16 times.
 * Usa os 16 times de maior prestígio dentre `leagueTeams`,
 * complementando com mais times se houver disponíveis.
 */
export function generateCupBracket(
  leagueTeams: Team[],
  userTeamCurto: string,
  season: number,
  competition = "Copa do Brasil",
): CupBracket {
  // Garante usuário no chaveamento
  const sorted = [...leagueTeams].sort((a, b) => b.prestigio - a.prestigio)
  let pool = sorted.slice(0, CUP_TEAM_COUNT)
  if (!pool.some(t => t.curto === userTeamCurto)) {
    const user = leagueTeams.find(t => t.curto === userTeamCurto)
    if (user) {
      pool = [user, ...pool.slice(0, CUP_TEAM_COUNT - 1)]
    }
  }

  // Embaralha e cria 8 confrontos das oitavas (1v16, 2v15, ...) — após shuffle não é seed real, é amistoso
  const shuffled = shuffleSeeded(pool, season * 7919 + 17)
  const matches: CupMatch[] = []
  for (let i = 0; i < 8; i++) {
    const home = shuffled[i]
    const away = shuffled[15 - i]
    matches.push({
      id: `cup_${season}_r1_${i}`,
      cupRound: 1,
      bracketSlot: i,
      homeCurto: home.curto,
      awayCurto: away.curto,
      homeNome: home.nome,
      awayNome: away.nome,
      played: false,
      isUserMatch: home.curto === userTeamCurto || away.curto === userTeamCurto,
    })
  }

  return {
    competition,
    season,
    matches,
    currentCupRound: 1,
  }
}

/**
 * Simula a rodada eliminatória atual da copa.
 * Atualiza partidas, gera próxima rodada se houver, define campeão na final.
 */
export function simulateCupRound(
  bracket: CupBracket,
  userTeamCurto: string,
  leagueTeams: Team[],
): CupBracket {
  const round = bracket.currentCupRound
  if (round < 1 || round > CUP_TOTAL_ROUNDS) return bracket

  const teamMap = new Map(leagueTeams.map(t => [t.curto, t]))
  const roundMatches = bracket.matches.filter(m => m.cupRound === round && !m.played)
  const updated = bracket.matches.map(m => ({ ...m }))
  let userEliminatedAtRound = bracket.userEliminatedAtRound

  for (const m of roundMatches) {
    const home = teamMap.get(m.homeCurto)
    const away = teamMap.get(m.awayCurto)
    if (!home || !away) continue

    const sim = simulateFullMatch({
      homeTeam: home,
      awayTeam: away,
      homeRating: home.prestigio,
      awayRating: away.prestigio,
      durationMinutes: 90,
    })

    let homeGoals = sim.home.goals
    let awayGoals = sim.away.goals
    // Sem empate em mata-mata: cara ou coroa para escolher um vencedor
    if (homeGoals === awayGoals) {
      if (Math.random() < 0.5) homeGoals += 1
      else awayGoals += 1
    }

    const idx = updated.findIndex(x => x.id === m.id)
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], played: true, homeGoals, awayGoals }
    }

    // Se usuário foi eliminado nesta rodada
    if (m.isUserMatch) {
      const userIsHome = m.homeCurto === userTeamCurto
      const userGoals = userIsHome ? homeGoals : awayGoals
      const oppGoals = userIsHome ? awayGoals : homeGoals
      if (userGoals < oppGoals && userEliminatedAtRound === undefined) {
        userEliminatedAtRound = round
      }
    }
  }

  // Avança vencedores para próxima rodada
  const nextRound = round + 1
  let champion = bracket.champion
  if (nextRound <= CUP_TOTAL_ROUNDS) {
    const winnersOfRound: { curto: string; nome: string }[] = []
    const playedThisRound = updated.filter(m => m.cupRound === round && m.played)
      .sort((a, b) => a.bracketSlot - b.bracketSlot)
    for (const m of playedThisRound) {
      const homeWon = (m.homeGoals ?? 0) > (m.awayGoals ?? 0)
      winnersOfRound.push(homeWon
        ? { curto: m.homeCurto, nome: m.homeNome }
        : { curto: m.awayCurto, nome: m.awayNome })
    }
    // Pareia consecutivos: 0v1, 2v3, 4v5, 6v7
    for (let i = 0; i < winnersOfRound.length; i += 2) {
      const a = winnersOfRound[i]
      const b = winnersOfRound[i + 1]
      if (!a || !b) continue
      updated.push({
        id: `cup_${bracket.season}_r${nextRound}_${i / 2}`,
        cupRound: nextRound,
        bracketSlot: i / 2,
        homeCurto: a.curto,
        awayCurto: b.curto,
        homeNome: a.nome,
        awayNome: b.nome,
        played: false,
        isUserMatch: a.curto === userTeamCurto || b.curto === userTeamCurto,
      })
    }
  } else {
    // Final encerrada: define campeão
    const finalMatch = updated.find(m => m.cupRound === CUP_TOTAL_ROUNDS && m.played)
    if (finalMatch) {
      const homeWon = (finalMatch.homeGoals ?? 0) > (finalMatch.awayGoals ?? 0)
      champion = homeWon ? finalMatch.homeNome : finalMatch.awayNome
    }
  }

  return {
    ...bracket,
    matches: updated,
    currentCupRound: nextRound > CUP_TOTAL_ROUNDS ? CUP_TOTAL_ROUNDS : nextRound,
    champion,
    userEliminatedAtRound,
  }
}

/** Rodadas em que a Copa do Brasil avança (entre as 38 rodadas da liga). */
export const CUP_TRIGGER_ROUNDS = [6, 14, 22, 30] as const

/** Rodadas em que a Libertadores avança (intercaladas com a Copa). */
export const LIBER_TRIGGER_ROUNDS = [10, 18, 26] as const

export function isCupTriggerRound(leagueRound: number): boolean {
  return (CUP_TRIGGER_ROUNDS as readonly number[]).includes(leagueRound)
}

export function isLiberTriggerRound(leagueRound: number): boolean {
  return (LIBER_TRIGGER_ROUNDS as readonly number[]).includes(leagueRound)
}

// ─── Libertadores: 8 times, 3 rodadas (quartas → semi → final) ────────────────

const LIBER_TEAM_COUNT = 8
const LIBER_TOTAL_ROUNDS = 3

/**
 * Gera chaveamento Libertadores com 8 times. Usa os top-8 por prestígio
 * e GARANTE que o usuário entra (mesmo se prestígio menor).
 * Em cenário real, classificacao da Libertadores depende do G4 do ano anterior;
 * para MVP, pegamos os 8 mais prestigiados disponiveis.
 */
export function generateLiberBracket(
  leagueTeams: Team[],
  userTeamCurto: string,
  season: number,
): CupBracket {
  const sorted = [...leagueTeams].sort((a, b) => b.prestigio - a.prestigio)
  let pool = sorted.slice(0, LIBER_TEAM_COUNT)
  if (!pool.some(t => t.curto === userTeamCurto)) {
    const user = leagueTeams.find(t => t.curto === userTeamCurto)
    if (user) pool = [user, ...pool.slice(0, LIBER_TEAM_COUNT - 1)]
  }

  const shuffled = shuffleSeeded(pool, season * 4523 + 31)
  const matches: CupMatch[] = []
  for (let i = 0; i < 4; i++) {
    const home = shuffled[i]
    const away = shuffled[7 - i]
    matches.push({
      id: `liber_${season}_r1_${i}`,
      cupRound: 1,
      bracketSlot: i,
      homeCurto: home.curto,
      awayCurto: away.curto,
      homeNome: home.nome,
      awayNome: away.nome,
      played: false,
      isUserMatch: home.curto === userTeamCurto || away.curto === userTeamCurto,
    })
  }

  return {
    competition: "Libertadores",
    season,
    matches,
    currentCupRound: 1,
  }
}

/** Simula a rodada eliminatória atual da Libertadores. */
export function simulateLiberRound(
  bracket: CupBracket,
  userTeamCurto: string,
  leagueTeams: Team[],
): CupBracket {
  const round = bracket.currentCupRound
  if (round < 1 || round > LIBER_TOTAL_ROUNDS) return bracket

  const teamMap = new Map(leagueTeams.map(t => [t.curto, t]))
  const roundMatches = bracket.matches.filter(m => m.cupRound === round && !m.played)
  const updated = bracket.matches.map(m => ({ ...m }))
  let userEliminatedAtRound = bracket.userEliminatedAtRound

  for (const m of roundMatches) {
    const home = teamMap.get(m.homeCurto)
    const away = teamMap.get(m.awayCurto)
    if (!home || !away) continue

    const sim = simulateFullMatch({
      homeTeam: home,
      awayTeam: away,
      homeRating: home.prestigio,
      awayRating: away.prestigio,
      durationMinutes: 90,
    })

    let homeGoals = sim.home.goals
    let awayGoals = sim.away.goals
    if (homeGoals === awayGoals) {
      if (Math.random() < 0.5) homeGoals += 1
      else awayGoals += 1
    }

    const idx = updated.findIndex(x => x.id === m.id)
    if (idx >= 0) updated[idx] = { ...updated[idx], played: true, homeGoals, awayGoals }

    if (m.isUserMatch) {
      const userIsHome = m.homeCurto === userTeamCurto
      const userGoals = userIsHome ? homeGoals : awayGoals
      const oppGoals = userIsHome ? awayGoals : homeGoals
      if (userGoals < oppGoals && userEliminatedAtRound === undefined) {
        userEliminatedAtRound = round
      }
    }
  }

  const nextRound = round + 1
  let champion = bracket.champion
  if (nextRound <= LIBER_TOTAL_ROUNDS) {
    const winners: { curto: string; nome: string }[] = []
    const playedThisRound = updated.filter(m => m.cupRound === round && m.played)
      .sort((a, b) => a.bracketSlot - b.bracketSlot)
    for (const m of playedThisRound) {
      const homeWon = (m.homeGoals ?? 0) > (m.awayGoals ?? 0)
      winners.push(homeWon
        ? { curto: m.homeCurto, nome: m.homeNome }
        : { curto: m.awayCurto, nome: m.awayNome })
    }
    for (let i = 0; i < winners.length; i += 2) {
      const a = winners[i]
      const b = winners[i + 1]
      if (!a || !b) continue
      updated.push({
        id: `liber_${bracket.season}_r${nextRound}_${i / 2}`,
        cupRound: nextRound,
        bracketSlot: i / 2,
        homeCurto: a.curto,
        awayCurto: b.curto,
        homeNome: a.nome,
        awayNome: b.nome,
        played: false,
        isUserMatch: a.curto === userTeamCurto || b.curto === userTeamCurto,
      })
    }
  } else {
    const finalMatch = updated.find(m => m.cupRound === LIBER_TOTAL_ROUNDS && m.played)
    if (finalMatch) {
      const homeWon = (finalMatch.homeGoals ?? 0) > (finalMatch.awayGoals ?? 0)
      champion = homeWon ? finalMatch.homeNome : finalMatch.awayNome
    }
  }

  return {
    ...bracket,
    matches: updated,
    currentCupRound: nextRound > LIBER_TOTAL_ROUNDS ? LIBER_TOTAL_ROUNDS : nextRound,
    champion,
    userEliminatedAtRound,
  }
}
