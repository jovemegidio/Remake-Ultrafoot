// Competicoes de selecao: Copa America, Eurocopa, Liga das Nacoes,
// Eliminatorias e Copa do Mundo. Inclui geracao de tabela, chaveamento e
// simulacao de partidas. Tudo puro/offline para persistir no save.

import {
  type Confederation,
  type NationalTeam,
  getNationalTeamsByConfederation,
  getAllNationalStrengths,
  NATIONAL_TEAMS,
} from "@/lib/national-teams"

// ============================================================
// DEFINICOES
// ============================================================

export interface NationalCompetitionDef {
  id: string
  name: string
  shortName: string
  confederations: Confederation[]
  format: "group_knockout" | "league"
  kind: "title" | "qualifier"
  prestige: number
  groupSize?: number
  qualifyFromGroup?: number
  knockoutStages?: string[]
  leagueTeams?: number
  leagueQualify?: number
}

export const NATIONAL_COMPETITIONS: NationalCompetitionDef[] = [
  {
    id: "copa_america",
    name: "Copa America",
    shortName: "Copa America",
    confederations: ["CONMEBOL"],
    format: "group_knockout",
    kind: "title",
    prestige: 90,
    groupSize: 4,
    qualifyFromGroup: 2,
    knockoutStages: ["Quartas de Final", "Semifinal", "Final"],
  },
  {
    id: "eurocopa",
    name: "Eurocopa",
    shortName: "Euro",
    confederations: ["UEFA"],
    format: "group_knockout",
    kind: "title",
    prestige: 94,
    groupSize: 4,
    qualifyFromGroup: 2,
    knockoutStages: ["Oitavas de Final", "Quartas de Final", "Semifinal", "Final"],
  },
  {
    id: "nations_league",
    name: "Liga das Nacoes",
    shortName: "Nations League",
    confederations: ["UEFA", "CONCACAF"],
    format: "league",
    kind: "title",
    prestige: 78,
    leagueTeams: 4,
    leagueQualify: 1,
  },
  {
    id: "eliminatorias",
    name: "Eliminatorias da Copa",
    shortName: "Eliminatorias",
    confederations: ["CONMEBOL", "UEFA", "CONCACAF", "AFC"],
    format: "league",
    kind: "qualifier",
    prestige: 70,
    leagueTeams: 6,
    leagueQualify: 4,
  },
  {
    id: "copa_mundo",
    name: "Copa do Mundo",
    shortName: "Copa do Mundo",
    confederations: ["CONMEBOL", "UEFA", "CONCACAF", "AFC"],
    format: "group_knockout",
    kind: "title",
    prestige: 100,
    groupSize: 4,
    qualifyFromGroup: 2,
    knockoutStages: ["Oitavas de Final", "Quartas de Final", "Semifinal", "Final"],
  },
]

const COMP_BY_ID = new Map(NATIONAL_COMPETITIONS.map(c => [c.id, c]))

export function getCompetitionDef(id: string): NationalCompetitionDef | undefined {
  return COMP_BY_ID.get(id)
}

export function getCompetitionsForConfederation(conf: Confederation): NationalCompetitionDef[] {
  return NATIONAL_COMPETITIONS.filter(c => c.confederations.includes(conf))
}

// ============================================================
// TIPOS DE ESTADO (persistidos no save)
// ============================================================

export interface NationalFixture {
  id: number
  round: number
  stage: string
  homeId: string
  homeName: string
  homeCode: string
  awayId: string
  awayName: string
  awayCode: string
  isUserMatch: boolean
  played: boolean
  homeScore?: number
  awayScore?: number
  decidedOnPens?: boolean
  userAdvanced?: boolean
}

export interface GroupRow {
  teamId: string
  teamName: string
  code: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points: number
  isUser: boolean
}

export type NationalCompStatus = "active" | "eliminated" | "champion" | "qualified" | "finished"

export interface NationalCompetitionState {
  competitionId: string
  competitionName: string
  shortName: string
  kind: "title" | "qualifier"
  format: "group_knockout" | "league"
  season: number
  participants: { id: string; name: string; code: string }[]
  fixtures: NationalFixture[]
  table: GroupRow[]
  totalGroupRounds: number
  knockoutStages: string[]
  currentRound: number
  stage: string
  status: NationalCompStatus
  lastSummary: string
}

// ============================================================
// RNG SEMEADO (resultados estaveis por temporada/competicao)
// ============================================================

function makeRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let state = h >>> 0
  return () => {
    state = (Math.imul(state ^ (state >>> 15), state | 1)) >>> 0
    let t = (state + 0x6d2b79f5) >>> 0
    t = Math.imul(t ^ (t >>> 7), t | 61)
    t ^= t + Math.imul(t ^ (t >>> 14), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ============================================================
// GERACAO
// ============================================================

// Algoritmo do circulo: rounds[r] = pares [homeIdx, awayIdx]
function roundRobinSchedule(n: number): number[][][] {
  const list: number[] = Array.from({ length: n }, (_, i) => i)
  if (list.length % 2 !== 0) list.push(-1)
  const m = list.length
  const arr = [...list]
  const rounds: number[][][] = []
  for (let r = 0; r < m - 1; r++) {
    const pairs: number[][] = []
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i]
      const b = arr[m - 1 - i]
      if (a !== -1 && b !== -1) {
        pairs.push(r % 2 === 0 ? [a, b] : [b, a])
      }
    }
    rounds.push(pairs)
    const fixed = arr[0]
    const rest = arr.slice(1)
    rest.unshift(rest.pop() as number)
    arr.splice(0, arr.length, fixed, ...rest)
  }
  return rounds
}

function pickOpponents(userNT: NationalTeam, count: number, rng: () => number): NationalTeam[] {
  const sameConf = getNationalTeamsByConfederation(userNT.confederation).filter(nt => nt.id !== userNT.id)
  let pool = [...sameConf]
  // Completa com outras confederacoes se faltar (ex.: CONCACAF com poucos times)
  if (pool.length < count) {
    const others = NATIONAL_TEAMS.filter(nt => nt.id !== userNT.id && !pool.some(p => p.id === nt.id))
    pool = [...pool, ...others]
  }
  // embaralha
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

function emptyRow(nt: { id: string; name: string; code: string }, isUser: boolean): GroupRow {
  return {
    teamId: nt.id, teamName: nt.name, code: nt.code,
    played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, isUser,
  }
}

export function createNationalCompetition(
  def: NationalCompetitionDef,
  userNT: NationalTeam,
  season: number,
): NationalCompetitionState {
  const rng = makeRng(`${def.id}-${userNT.id}-${season}`)
  const size = def.format === "league" ? (def.leagueTeams ?? 6) : (def.groupSize ?? 4)
  const opponents = pickOpponents(userNT, size - 1, rng)
  const participants = [
    { id: userNT.id, name: userNT.name, code: userNT.code },
    ...opponents.map(o => ({ id: o.id, name: o.name, code: o.code })),
  ]

  const stageLabel = def.format === "league"
    ? (def.kind === "qualifier" ? "Eliminatorias" : "Fase de Grupos")
    : "Fase de Grupos"

  const schedule = roundRobinSchedule(participants.length)
  const fixtures: NationalFixture[] = []
  let fid = 1
  schedule.forEach((pairs, rIdx) => {
    pairs.forEach(([h, a]) => {
      const home = participants[h]
      const away = participants[a]
      fixtures.push({
        id: fid++,
        round: rIdx + 1,
        stage: stageLabel,
        homeId: home.id, homeName: home.name, homeCode: home.code,
        awayId: away.id, awayName: away.name, awayCode: away.code,
        isUserMatch: home.id === userNT.id || away.id === userNT.id,
        played: false,
      })
    })
  })

  return {
    competitionId: def.id,
    competitionName: def.name,
    shortName: def.shortName,
    kind: def.kind,
    format: def.format,
    season,
    participants,
    fixtures,
    table: participants.map((p, i) => emptyRow(p, i === 0)),
    totalGroupRounds: schedule.length,
    knockoutStages: def.format === "group_knockout" ? [...(def.knockoutStages ?? [])] : [],
    currentRound: 1,
    stage: stageLabel,
    status: "active",
    lastSummary: "",
  }
}

// ============================================================
// SIMULACAO
// ============================================================

function simulateScore(sFor: number, sAgainst: number, rng: () => number): [number, number] {
  const diff = sFor - sAgainst
  const expFor = Math.max(0.25, 1.35 + diff * 0.05)
  const expAgainst = Math.max(0.25, 1.35 - diff * 0.05)
  const sample = (exp: number) => {
    // soma de chances tipo poisson simplificado (0..5)
    let goals = 0
    for (let i = 0; i < 6; i++) {
      if (rng() < exp / 6) goals++
    }
    return goals
  }
  return [sample(expFor), sample(expAgainst)]
}

function applyResult(row: GroupRow, gf: number, ga: number) {
  row.played++
  row.gf += gf
  row.ga += ga
  if (gf > ga) { row.won++; row.points += 3 }
  else if (gf === ga) { row.drawn++; row.points += 1 }
  else row.lost++
}

function sortTable(table: GroupRow[]): GroupRow[] {
  return [...table].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const sgA = a.gf - a.ga
    const sgB = b.gf - b.ga
    if (sgB !== sgA) return sgB - sgA
    return b.gf - a.gf
  })
}

// Avanca uma rodada da competicao. Retorna novo estado (imutavel).
export function advanceNationalRound(state: NationalCompetitionState, userId: string): NationalCompetitionState {
  if (state.status !== "active") return state
  const strengths = getAllNationalStrengths()
  const next: NationalCompetitionState = JSON.parse(JSON.stringify(state))
  const rng = makeRng(`${next.competitionId}-${userId}-${next.season}-r${next.currentRound}-${Date.now() % 100000}`)

  const strengthOf = (id: string) => strengths[id] ?? 60

  const roundFixtures = next.fixtures.filter(f => f.round === next.currentRound && !f.played)
  let userResult = ""

  for (const f of roundFixtures) {
    let [hs, as] = simulateScore(strengthOf(f.homeId), strengthOf(f.awayId), rng)
    const isKnockout = next.currentRound > next.totalGroupRounds
    let decidedOnPens = false
    if (isKnockout && hs === as) {
      // penaltis: favorece o mais forte, mas com sorte
      decidedOnPens = true
      const homeChance = strengthOf(f.homeId) / (strengthOf(f.homeId) + strengthOf(f.awayId))
      if (rng() < homeChance) hs += 0
      // marca quem avanca via flag userAdvanced abaixo
      f.decidedOnPens = true
      const homeWins = rng() < homeChance
      f.userAdvanced = (homeWins && f.homeId === userId) || (!homeWins && f.awayId === userId)
    }
    f.played = true
    f.homeScore = hs
    f.awayScore = as

    if (next.currentRound <= next.totalGroupRounds) {
      const homeRow = next.table.find(r => r.teamId === f.homeId)
      const awayRow = next.table.find(r => r.teamId === f.awayId)
      if (homeRow && awayRow) {
        applyResult(homeRow, hs, as)
        applyResult(awayRow, as, hs)
      }
    }

    if (f.isUserMatch) {
      const userIsHome = f.homeId === userId
      const ug = userIsHome ? hs : as
      const og = userIsHome ? as : hs
      const opp = userIsHome ? f.awayName : f.homeName
      if (decidedOnPens) {
        userResult = `${ug} x ${og} vs ${opp} (${f.userAdvanced ? "venceu" : "perdeu"} nos penaltis)`
      } else {
        userResult = `${ug} x ${og} vs ${opp}`
      }
    }
  }

  next.table = sortTable(next.table)

  const isLastGroupRound = next.currentRound === next.totalGroupRounds
  const isKnockoutRound = next.currentRound > next.totalGroupRounds

  if (!isLastGroupRound && !isKnockoutRound) {
    // ainda fase de grupos/liga
    next.currentRound++
    next.lastSummary = userResult || "Rodada simulada."
    return next
  }

  if (isLastGroupRound && next.format === "league") {
    // Liga / Eliminatorias: define classificacao final
    const sorted = sortTable(next.table)
    const userPos = sorted.findIndex(r => r.teamId === userId) + 1
    const def = getCompetitionDef(next.competitionId)
    if (next.kind === "qualifier") {
      const qualify = def?.leagueQualify ?? 4
      if (userPos <= qualify) {
        next.status = "qualified"
        next.lastSummary = `Classificado para a Copa do Mundo! (${userPos}o lugar)`
      } else {
        next.status = "finished"
        next.lastSummary = `Fora da Copa: terminou em ${userPos}o lugar.`
      }
    } else {
      if (userPos === 1) {
        next.status = "champion"
        next.lastSummary = `Campeao da ${next.competitionName}!`
      } else {
        next.status = "finished"
        next.lastSummary = `Terminou em ${userPos}o lugar.`
      }
    }
    next.stage = "Encerrada"
    return next
  }

  if (isLastGroupRound && next.format === "group_knockout") {
    // Fase de grupos acabou: top N avancam
    const def = getCompetitionDef(next.competitionId)
    const qualify = def?.qualifyFromGroup ?? 2
    const sorted = sortTable(next.table)
    const userPos = sorted.findIndex(r => r.teamId === userId) + 1
    if (userPos > qualify) {
      next.status = "eliminated"
      next.stage = "Eliminado na fase de grupos"
      next.lastSummary = `Eliminado na fase de grupos (${userPos}o lugar).`
      return next
    }
    // Gera o mata-mata: um adversario por fase
    const userNT = NATIONAL_TEAMS.find(n => n.id === userId)
    const koRng = makeRng(`${next.competitionId}-${userId}-${next.season}-ko`)
    const opponents = userNT ? pickOpponents(userNT, next.knockoutStages.length, koRng) : []
    let fid = next.fixtures.length + 1
    next.knockoutStages.forEach((stage, i) => {
      const opp = opponents[i] ?? { id: "tbd", name: "Adversario", code: "TBD" }
      next.fixtures.push({
        id: fid++,
        round: next.totalGroupRounds + 1 + i,
        stage,
        homeId: userId,
        homeName: userNT?.name ?? "Selecao",
        homeCode: userNT?.code ?? "SEL",
        awayId: opp.id,
        awayName: opp.name,
        awayCode: opp.code,
        isUserMatch: true,
        played: false,
      })
    })
    next.currentRound = next.totalGroupRounds + 1
    next.stage = next.knockoutStages[0]
    next.status = "active"
    next.lastSummary = `Classificado em ${userPos}o! Proxima fase: ${next.knockoutStages[0]}.`
    return next
  }

  // Rodada de mata-mata
  if (isKnockoutRound) {
    const koIndex = next.currentRound - next.totalGroupRounds - 1
    const stageName = next.knockoutStages[koIndex] ?? next.stage
    const userFixture = next.fixtures.find(f => f.round === next.currentRound && f.isUserMatch)
    let userWon = false
    if (userFixture) {
      if (userFixture.decidedOnPens) {
        userWon = !!userFixture.userAdvanced
      } else {
        const userIsHome = userFixture.homeId === userId
        const ug = userIsHome ? (userFixture.homeScore ?? 0) : (userFixture.awayScore ?? 0)
        const og = userIsHome ? (userFixture.awayScore ?? 0) : (userFixture.homeScore ?? 0)
        userWon = ug > og
      }
    }

    if (!userWon) {
      next.status = "eliminated"
      next.stage = `Eliminado: ${stageName}`
      next.lastSummary = `Eliminado na ${stageName}. ${userResult}`
      return next
    }

    const isFinal = koIndex === next.knockoutStages.length - 1
    if (isFinal) {
      next.status = "champion"
      next.stage = "Campeao"
      next.lastSummary = `CAMPEAO da ${next.competitionName}! ${userResult}`
      return next
    }

    next.currentRound++
    next.stage = next.knockoutStages[koIndex + 1]
    next.lastSummary = `Venceu a ${stageName}! Proxima: ${next.stage}. ${userResult}`
    return next
  }

  return next
}

// Proxima partida do usuario na competicao
export function getUserNextFixture(state: NationalCompetitionState): NationalFixture | null {
  return state.fixtures.find(f => f.round === state.currentRound && f.isUserMatch && !f.played) ?? null
}
