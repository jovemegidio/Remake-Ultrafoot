import { WORLD_CUP_2026_GROUPS } from "@/lib/national-competitions"
import { getNationalStrength, getNationalTeamById, type NationalTeam } from "@/lib/national-teams"

export interface WorldCupSpectatorMatch {
  homeId: string
  awayId: string
  home: string
  away: string
  homeCode: string
  awayCode: string
  homeScore: number
  awayScore: number
  penalties?: [number, number]
  group?: string
}

export interface WorldCupSpectatorStage {
  index: number
  name: string
  shortName: string
  matches: WorldCupSpectatorMatch[]
}

interface TableRow {
  id: string
  points: number
  gf: number
  ga: number
}

function hash(value: string): number {
  let result = 2166136261
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619)
  return result >>> 0
}

function team(id: string): NationalTeam {
  return getNationalTeamById(id) ?? {
    id,
    name: id.replaceAll("_", " "),
    code: id.slice(0, 3).toUpperCase(),
    confederation: "UEFA",
    cor1: "#ffffff",
    cor2: "#111111",
    countryKey: "",
    baselineStrength: 72,
  }
}

function play(homeId: string, awayId: string, seed: string, knockout = false): WorldCupSpectatorMatch {
  const home = team(homeId)
  const away = team(awayId)
  const homeStrength = getNationalStrength(home) + 2
  const awayStrength = getNationalStrength(away)
  const rollHome = hash(`${seed}:h`) % 100
  const rollAway = hash(`${seed}:a`) % 100
  let homeScore = Math.min(5, Math.floor((homeStrength - 60) / 18) + (rollHome < 55 ? 1 : 0) + (rollHome < 13 ? 1 : 0))
  let awayScore = Math.min(5, Math.floor((awayStrength - 60) / 20) + (rollAway < 48 ? 1 : 0) + (rollAway < 10 ? 1 : 0))
  homeScore = Math.max(0, homeScore)
  awayScore = Math.max(0, awayScore)

  let penalties: [number, number] | undefined
  if (knockout && homeScore === awayScore) {
    const homeWins = (hash(`${seed}:pens`) + homeStrength) % 100 >= 50
    penalties = homeWins ? [5, 4] : [3, 4]
  }
  return {
    homeId,
    awayId,
    home: home.name,
    away: away.name,
    homeCode: home.code,
    awayCode: away.code,
    homeScore,
    awayScore,
    penalties,
  }
}

function winner(match: WorldCupSpectatorMatch): string {
  if (match.homeScore !== match.awayScore) return match.homeScore > match.awayScore ? match.homeId : match.awayId
  return (match.penalties?.[0] ?? 0) > (match.penalties?.[1] ?? 0) ? match.homeId : match.awayId
}

/** Torneio determinístico: recarregar o Office nunca troca resultados ou campeão. */
export function buildWorldCupSpectator(season: number): WorldCupSpectatorStage[] {
  const groupStages: WorldCupSpectatorStage[] = [0, 1, 2].map(index => ({
    index,
    name: `Fase de grupos · Rodada ${index + 1}`,
    shortName: `Grupos ${index + 1}/3`,
    matches: [],
  }))
  const tables = new Map<string, TableRow>()

  WORLD_CUP_2026_GROUPS.forEach((ids, groupIndex) => {
    const letter = String.fromCharCode(65 + groupIndex)
    ids.forEach(id => tables.set(id, { id, points: 0, gf: 0, ga: 0 }))
    const rounds: Array<Array<[number, number]>> = [
      [[0, 3], [1, 2]],
      [[0, 2], [3, 1]],
      [[1, 0], [2, 3]],
    ]
    rounds.forEach((pairs, roundIndex) => {
      pairs.forEach(([homeIndex, awayIndex], matchIndex) => {
        const result = {
          ...play(ids[homeIndex], ids[awayIndex], `${season}:group:${letter}:${roundIndex}:${matchIndex}`),
          group: letter,
        }
        groupStages[roundIndex].matches.push(result)
        const homeRow = tables.get(result.homeId)!
        const awayRow = tables.get(result.awayId)!
        homeRow.gf += result.homeScore
        homeRow.ga += result.awayScore
        awayRow.gf += result.awayScore
        awayRow.ga += result.homeScore
        if (result.homeScore > result.awayScore) homeRow.points += 3
        else if (result.awayScore > result.homeScore) awayRow.points += 3
        else {
          homeRow.points += 1
          awayRow.points += 1
        }
      })
    })
  })

  const compareRows = (a: TableRow, b: TableRow) =>
    b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.id.localeCompare(b.id)
  const qualified: TableRow[] = []
  const thirdPlaced: TableRow[] = []
  WORLD_CUP_2026_GROUPS.forEach(ids => {
    const rows = ids.map(id => tables.get(id)!).sort(compareRows)
    qualified.push(...rows.slice(0, 2))
    thirdPlaced.push(rows[2])
  })
  qualified.push(...thirdPlaced.sort(compareRows).slice(0, 8))

  const playRound = (ids: string[], label: string, index: number): WorldCupSpectatorStage => {
    const matches: WorldCupSpectatorMatch[] = []
    for (let i = 0; i < ids.length / 2; i++) {
      matches.push(play(ids[i], ids[ids.length - 1 - i], `${season}:${label}:${i}`, true))
    }
    return { index, name: label, shortName: label, matches }
  }

  const round32 = playRound(qualified.map(row => row.id), "16 avos de final", 3)
  const round16 = playRound(round32.matches.map(winner), "Oitavas de final", 3)
  const quarters = playRound(round16.matches.map(winner), "Quartas de final", 4)
  const semifinals = playRound(quarters.matches.map(winner), "Semifinais", 4)
  const final = playRound(semifinals.matches.map(winner), "Final da Copa do Mundo", 5)

  return [
    ...groupStages,
    { index: 3, name: "Mata-mata · 16 avos e oitavas", shortName: "Mata-mata", matches: [...round32.matches, ...round16.matches] },
    { index: 4, name: "Quartas e semifinais", shortName: "Finais", matches: [...quarters.matches, ...semifinals.matches] },
    final,
  ]
}

