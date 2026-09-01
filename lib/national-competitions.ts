// Competicoes de selecao: Copa America, Eurocopa, Liga das Nacoes,
// Eliminatorias e Copa do Mundo. Inclui geracao de tabela, chaveamento e
// simulacao de partidas. Tudo puro/offline para persistir no save.

import { desempateDaDivisao, ordenarPorCriterios } from "@/lib/desempate"
import {
  type Confederation,
  type NationalTeam,
  getNationalTeamsByConfederation,
  getNationalTeamById,
  getAllNationalStrengths,
  getAllNationalTeams,
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
  kind: "title" | "qualifier" | "friendly"
  prestige: number
  participants?: number
  groups?: number
  groupSize?: number
  qualifyFromGroup?: number
  bestThirdPlaces?: number
  knockoutStages?: string[]
  leagueTeams?: number
  leagueQualify?: number
  /** Fase de grupos em turno e returno. */
  doubleRoundRobin?: boolean
  /** Posicoes seguintes que disputam uma repescagem. */
  playoffFrom?: number
  playoffTo?: number
  /** Nao oferece a definicao legada em novas carreiras. */
  legacy?: boolean
  /** Imagem de tema da competicao (fundo) */
  theme: string
  /** Logo oficial da competicao (exibida no emblema) */
  logo?: string
  /** Cor de destaque para a competicao */
  accent: string
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
    participants: 16,
    groups: 4,
    groupSize: 4,
    qualifyFromGroup: 2,
    knockoutStages: ["Quartas de Final", "Semifinal", "Final"],
    theme: "/competitions/7.webp",
    logo: "/competicoes/copa-america-2028.png",
    accent: "#e11d2a",
  },
  {
    id: "eurocopa",
    name: "Eurocopa",
    shortName: "Euro",
    confederations: ["UEFA"],
    format: "group_knockout",
    kind: "title",
    prestige: 94,
    participants: 24,
    groups: 6,
    groupSize: 4,
    qualifyFromGroup: 2,
    bestThirdPlaces: 4,
    knockoutStages: ["Oitavas de Final", "Quartas de Final", "Semifinal", "Final"],
    theme: "/competitions/8.webp",
    accent: "#1d4ed8",
  },
  {
    id: "nations_league_uefa",
    name: "Liga das Nacoes da UEFA",
    shortName: "UEFA Nations League",
    confederations: ["UEFA"],
    format: "group_knockout",
    kind: "title",
    prestige: 78,
    participants: 16,
    groups: 4,
    groupSize: 4,
    qualifyFromGroup: 2,
    doubleRoundRobin: true,
    knockoutStages: ["Quartas de Final", "Semifinal", "Final"],
    theme: "/competitions/8.webp",
    accent: "#0d9488",
  },
  {
    id: "nations_league_concacaf",
    name: "Liga das Nacoes da Concacaf",
    shortName: "Concacaf Nations League",
    confederations: ["CONCACAF"],
    format: "group_knockout",
    kind: "title",
    prestige: 76,
    participants: 12,
    groups: 2,
    groupSize: 6,
    qualifyFromGroup: 4,
    knockoutStages: ["Quartas de Final", "Semifinal", "Final"],
    theme: "/competitions/8.webp",
    accent: "#0f766e",
  },
  {
    id: "eliminatorias_conmebol",
    name: "Eliminatorias Sul-Americanas",
    shortName: "Eliminatorias CONMEBOL",
    confederations: ["CONMEBOL"], format: "league", kind: "qualifier", prestige: 74,
    leagueTeams: 10, leagueQualify: 6, playoffFrom: 7, playoffTo: 7, doubleRoundRobin: true,
    knockoutStages: ["Repescagem intercontinental"],
    theme: "/competitions/9.webp", accent: "#ca8a04",
  },
  {
    id: "eliminatorias_uefa",
    name: "Eliminatorias Europeias",
    shortName: "Eliminatorias UEFA",
    confederations: ["UEFA"], format: "league", kind: "qualifier", prestige: 74,
    leagueTeams: 5, leagueQualify: 1, playoffFrom: 2, playoffTo: 2, doubleRoundRobin: true,
    knockoutStages: ["Semifinal dos playoffs", "Final dos playoffs"],
    theme: "/competitions/9.webp", accent: "#1d4ed8",
  },
  {
    id: "eliminatorias_afc",
    name: "Eliminatorias Asiaticas",
    shortName: "Eliminatorias AFC",
    confederations: ["AFC"], format: "league", kind: "qualifier", prestige: 70,
    leagueTeams: 6, leagueQualify: 2, playoffFrom: 3, playoffTo: 4, doubleRoundRobin: true,
    knockoutStages: ["4a fase da AFC", "Playoff asiatico", "Repescagem intercontinental"],
    theme: "/competitions/9.webp", accent: "#2563eb",
  },
  {
    id: "eliminatorias_caf",
    name: "Eliminatorias Africanas",
    shortName: "Eliminatorias CAF",
    confederations: ["CAF"], format: "league", kind: "qualifier", prestige: 70,
    leagueTeams: 6, leagueQualify: 1, playoffFrom: 2, playoffTo: 2, doubleRoundRobin: true,
    knockoutStages: ["Playoff africano", "Repescagem intercontinental"],
    theme: "/competitions/9.webp", accent: "#16a34a",
  },
  {
    id: "eliminatorias_concacaf",
    name: "Eliminatorias da Concacaf",
    shortName: "Eliminatorias Concacaf",
    confederations: ["CONCACAF"], format: "league", kind: "qualifier", prestige: 68,
    leagueTeams: 4, leagueQualify: 1, playoffFrom: 2, playoffTo: 2, doubleRoundRobin: true,
    knockoutStages: ["Repescagem intercontinental"],
    theme: "/competitions/9.webp", accent: "#eab308",
  },
  {
    id: "eliminatorias_ofc",
    name: "Eliminatorias da Oceania",
    shortName: "Eliminatorias OFC",
    confederations: ["OFC"], format: "group_knockout", kind: "qualifier", prestige: 64,
    participants: 8, groups: 2, groupSize: 4, qualifyFromGroup: 2,
    knockoutStages: ["Semifinal", "Final"],
    theme: "/competitions/9.webp", accent: "#0891b2",
  },
  {
    id: "eliminatorias",
    name: "Eliminatorias da Copa (save antigo)", shortName: "Eliminatorias",
    confederations: ["CONMEBOL", "UEFA", "CONCACAF", "AFC", "CAF", "OFC"],
    format: "league", kind: "qualifier", prestige: 70, leagueTeams: 6, leagueQualify: 4,
    legacy: true, theme: "/competitions/9.webp", accent: "#ca8a04",
  },
  {
    id: "nations_league",
    name: "Liga das Nacoes (save antigo)", shortName: "Nations League",
    confederations: ["UEFA", "CONCACAF"], format: "league", kind: "title", prestige: 78,
    leagueTeams: 4, leagueQualify: 1, legacy: true,
    theme: "/competitions/8.webp", accent: "#0d9488",
  },
  {
    id: "copa_mundo",
    name: "Copa do Mundo",
    shortName: "Copa do Mundo",
    confederations: ["CONMEBOL", "UEFA", "CONCACAF", "AFC", "CAF", "OFC"],
    format: "group_knockout",
    kind: "title",
    prestige: 100,
    participants: 48,
    groups: 12,
    groupSize: 4,
    qualifyFromGroup: 2,
    bestThirdPlaces: 8,
    knockoutStages: ["Fase de 32", "Oitavas de Final", "Quartas de Final", "Semifinal", "Final"],
    theme: "/competitions/9.webp",
    logo: "/competicoes/copa-do-mundo-2026.png",
    accent: "#1e3a8a",
  },
  {
    id: "amistosos",
    name: "Amistosos Internacionais",
    shortName: "Amistosos",
    confederations: ["CONMEBOL", "UEFA", "CONCACAF", "AFC", "CAF", "OFC"],
    format: "league",
    kind: "friendly",
    prestige: 45,
    leagueTeams: 4,
    leagueQualify: 0,
    theme: "/competitions/8.webp",
    accent: "#64748b",
  },
  {
    id: "copa_africana",
    name: "Copa Africana de Nacoes",
    shortName: "CAN",
    confederations: ["CAF"],
    format: "group_knockout",
    kind: "title",
    prestige: 88,
    participants: 24,
    groups: 6,
    groupSize: 4,
    qualifyFromGroup: 2,
    bestThirdPlaces: 4,
    knockoutStages: ["Oitavas de Final", "Quartas de Final", "Semifinal", "Final"],
    theme: "/competitions/8.webp",
    accent: "#16a34a",
  },
  {
    id: "copa_asia",
    name: "Copa da Asia",
    shortName: "Copa da Asia",
    confederations: ["AFC"],
    format: "group_knockout",
    kind: "title",
    prestige: 84,
    participants: 24,
    groups: 6,
    groupSize: 4,
    qualifyFromGroup: 2,
    bestThirdPlaces: 4,
    knockoutStages: ["Oitavas de Final", "Quartas de Final", "Semifinal", "Final"],
    theme: "/competitions/8.webp",
    accent: "#2563eb",
  },
  {
    id: "copa_ouro",
    name: "Copa Ouro",
    shortName: "Copa Ouro",
    confederations: ["CONCACAF"],
    format: "group_knockout",
    kind: "title",
    prestige: 80,
    participants: 16,
    groups: 4,
    groupSize: 4,
    qualifyFromGroup: 2,
    knockoutStages: ["Quartas de Final", "Semifinal", "Final"],
    theme: "/competitions/8.webp",
    accent: "#eab308",
  },
  {
    id: "copa_oceania",
    name: "Copa das Nacoes da OFC",
    shortName: "OFC Nations Cup",
    confederations: ["OFC"],
    format: "group_knockout",
    kind: "title",
    prestige: 70,
    participants: 8,
    groups: 2,
    groupSize: 4,
    qualifyFromGroup: 2,
    knockoutStages: ["Semifinal", "Final"],
    theme: "/competitions/8.webp",
    accent: "#0891b2",
  },
]

const COMP_BY_ID = new Map(NATIONAL_COMPETITIONS.map(c => [c.id, c]))

export function getCompetitionDef(id: string): NationalCompetitionDef | undefined {
  return COMP_BY_ID.get(id)
}

export function getCompetitionsForConfederation(conf: Confederation): NationalCompetitionDef[] {
  return NATIONAL_COMPETITIONS.filter(c => !c.legacy && c.confederations.includes(conf))
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
  kind: "title" | "qualifier" | "friendly"
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
    const others = getAllNationalTeams().filter(nt => nt.id !== userNT.id && !pool.some(p => p.id === nt.id))
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

// Grupos REAIS do sorteio da Copa do Mundo 2026 (48 selecoes, 12 grupos A-L),
// com os playoffs de marco/2026 ja resolvidos. IDs = os de national-teams.ts.
// Fonte: sorteio final FIFA 05/12/2025 + qualificatorias 31/03/2026.
export const WORLD_CUP_2026_GROUPS: string[][] = [
  ["mexico", "africa_do_sul", "coreia_do_sul", "tchequia"],      // A
  ["canada", "suica", "qatar", "bosnia"],                         // B
  ["brasil", "marrocos", "haiti", "escocia"],                     // C
  ["estados_unidos", "paraguai", "australia", "turquia"],         // D
  ["alemanha", "curacao", "costa_do_marfim", "equador"],          // E
  ["holanda", "japao", "tunisia", "suecia"],                      // F
  ["belgica", "egito", "ira", "nova_zelandia"],                   // G
  ["espanha", "cabo_verde", "arabia_saudita", "uruguai"],         // H
  ["franca", "senegal", "noruega", "iraque"],                     // I
  ["argentina", "argelia", "austria", "jordania"],                // J
  ["portugal", "uzbequistao", "colombia", "congo_dr"],            // K
  ["inglaterra", "croacia", "gana", "panama"],                    // L
]

/** Grupo real do Mundial 2026 que contem a selecao dada (ou null). */
export function worldCupGroupOf(ntId: string): string[] | null {
  return WORLD_CUP_2026_GROUPS.find(g => g.includes(ntId)) ?? null
}

export function createNationalCompetition(
  def: NationalCompetitionDef,
  userNT: NationalTeam,
  season: number,
): NationalCompetitionState {
  const rng = makeRng(`${def.id}-${userNT.id}-${season}`)
  const size = def.format === "league" ? (def.leagueTeams ?? 6) : (def.groupSize ?? 4)
  // Copa do Mundo: a selecao do usuario cai no seu GRUPO REAL do sorteio 2026,
  // com os adversarios reais — nao mais sorteados aleatoriamente por confederacao.
  const wcGroup = def.id === "copa_mundo" ? worldCupGroupOf(userNT.id) : null
  const opponents = wcGroup
    ? wcGroup
        .filter(id => id !== userNT.id)
        .map(id => getNationalTeamById(id))
        .filter((nt): nt is NationalTeam => Boolean(nt))
    : pickOpponents(userNT, size - 1, rng)
  const participants = [
    { id: userNT.id, name: userNT.name, code: userNT.code },
    ...opponents.map(o => ({ id: o.id, name: o.name, code: o.code })),
  ]

  const stageLabel = def.format === "league"
    ? (def.kind === "qualifier" ? "Eliminatorias" : def.kind === "friendly" ? "Amistosos" : "Fase de Grupos")
    : "Fase de Grupos"

  const firstLeg = roundRobinSchedule(participants.length)
  const schedule = def.doubleRoundRobin
    ? [...firstLeg, ...firstLeg.map(round => round.map(([home, away]) => [away, home]))]
    : firstLeg
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
    knockoutStages: [...(def.knockoutStages ?? [])],
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

/**
 * ⚠️ ESTA ERA A SEGUNDA COPIA DA MESMA REGRA ERRADA (ver `lib/desempate.ts`).
 * `GroupRow` nomeia os campos de outro jeito (`gf`/`ga`/`teamName`), entao a
 * linha e adaptada para o formato que o desempate le — o criterio em si mora
 * num lugar so.
 */
function sortTable(table: GroupRow[], divisao?: string): GroupRow[] {
  const adaptadas = table.map(r => ({
    linha: r,
    points: r.points, won: r.won,
    goalsFor: r.gf, goalsAgainst: r.ga,
    nome: r.teamName,
  }))
  return ordenarPorCriterios(adaptadas, desempateDaDivisao(divisao)).map(x => x.linha)
}

// Avanca uma rodada da competicao. Retorna novo estado (imutavel).
export function advanceNationalRound(
  state: NationalCompetitionState,
  userId: string,
  userStrength?: number,
  /**
   * Resumo do jogo do usuario quando ele ja foi DISPUTADO na tela (ver
   * `aplicarPlacarDoUsuario`). Sem isto, a rodada em que o tecnico jogou de
   * verdade era resumida como "Rodada simulada." — o placar dele sumia do
   * escritorio, porque o laco abaixo so gera resumo do que ele mesmo simula.
   */
  resumoDoUsuario?: string,
): NationalCompetitionState {
  if (state.status !== "active") return state
  const strengths = getAllNationalStrengths()
  const next: NationalCompetitionState = JSON.parse(JSON.stringify(state))
  // A rodada deve produzir o mesmo resultado ao recarregar o mesmo save.
  const rng = makeRng(`${next.competitionId}-${userId}-${next.season}-r${next.currentRound}`)

  const strengthOf = (id: string) => id === userId && userStrength != null ? userStrength : (strengths[id] ?? 60)

  const roundFixtures = next.fixtures.filter(f => f.round === next.currentRound && !f.played)
  let userResult = resumoDoUsuario ?? ""

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
    if (next.kind === "friendly") {
      const userRow = next.table.find(r => r.teamId === userId)
      next.status = "finished"
      next.lastSummary = userRow
        ? `Amistosos encerrados: ${userRow.won}V ${userRow.drawn}E ${userRow.lost}D.`
        : "Amistosos encerrados."
    } else if (next.kind === "qualifier") {
      const qualify = def?.leagueQualify ?? 4
      if (userPos <= qualify) {
        next.status = "qualified"
        next.lastSummary = `Classificado para a Copa do Mundo! (${userPos}o lugar)`
      } else if (
        def?.playoffFrom != null && def.playoffTo != null
        && userPos >= def.playoffFrom && userPos <= def.playoffTo
        && next.knockoutStages.length > 0
      ) {
        const userNT = getNationalTeamById(userId)
        const koRng = makeRng(`${next.competitionId}-${userId}-${next.season}-playoff`)
        const opponents = userNT ? pickOpponents(userNT, next.knockoutStages.length, koRng) : []
        let fid = next.fixtures.length + 1
        next.knockoutStages.forEach((stage, index) => {
          const opponent = opponents[index] ?? { id: "tbd", name: "Adversario", code: "TBD" }
          next.fixtures.push({
            id: fid++, round: next.totalGroupRounds + 1 + index, stage,
            homeId: userId, homeName: userNT?.name ?? "Selecao", homeCode: userNT?.code ?? "SEL",
            awayId: opponent.id, awayName: opponent.name, awayCode: opponent.code,
            isUserMatch: true, played: false,
          })
        })
        next.currentRound = next.totalGroupRounds + 1
        next.stage = next.knockoutStages[0]
        next.status = "active"
        next.lastSummary = `Classificado para a ${next.knockoutStages[0]} (${userPos}o lugar).`
        return next
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
    // Torneios de 24 selecoes classificam tambem os quatro melhores terceiros.
    // Como somente o grupo do usuario e simulado em detalhe, comparamos o
    // aproveitamento do terceiro com uma linha de corte deterministica (4 pontos
    // ou saldo nao-negativo), em vez de classifica-lo automaticamente.
    const userRow = sorted.find(r => r.teamId === userId)
    const bestThirdEligible = userPos === qualify + 1 && (def?.bestThirdPlaces ?? 0) > 0
      && !!userRow
      && (userRow.points >= 4 || (userRow.points === 3 && userRow.gf - userRow.ga >= 0))
    if (userPos > qualify && !bestThirdEligible) {
      next.status = "eliminated"
      next.stage = "Eliminado na fase de grupos"
      next.lastSummary = `Eliminado na fase de grupos (${userPos}o lugar).`
      return next
    }
    // Gera o mata-mata: um adversario por fase
    const userNT = getNationalTeamById(userId)
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
    next.lastSummary = bestThirdEligible
      ? `Classificado entre os melhores terceiros! Proxima fase: ${next.knockoutStages[0]}.`
      : `Classificado em ${userPos}o! Proxima fase: ${next.knockoutStages[0]}.`
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
      next.status = next.kind === "qualifier" ? "qualified" : "champion"
      next.stage = next.kind === "qualifier" ? "Classificado" : "Campeao"
      next.lastSummary = next.kind === "qualifier"
        ? `Classificado para a Copa do Mundo! ${userResult}`
        : `CAMPEAO da ${next.competitionName}! ${userResult}`
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

/**
 * Grava na competicao o placar de uma partida da selecao JOGADA DE VERDADE.
 *
 * Ate aqui o jogo da selecao era resolvido por simulacao instantanea dentro de
 * `advanceNationalRound` — o tecnico clicava e ja lia o placar, sem pre-jogo,
 * sem partida ao vivo e sem coletiva, enquanto o clube tinha o fluxo completo.
 * Agora a partida do usuario e disputada no motor normal e o resultado entra por
 * aqui.
 *
 * A funcao NAO avanca a rodada: ela apenas marca o jogo do usuario como jogado.
 * `advanceNationalRound` roda em seguida e, como filtra por `!f.played`, pula
 * este jogo e simula so os outros — o resto (tabela, classificacao, mata-mata)
 * continua sendo responsabilidade dele, sem duplicar regra.
 */
export function aplicarPlacarDoUsuario(
  state: NationalCompetitionState,
  userId: string,
  golsDoUsuario: number,
  golsDoAdversario: number,
  venceuNosPenaltis?: boolean,
): { state: NationalCompetitionState; resumo: string } | null {
  const alvo = getUserNextFixture(state)
  if (!alvo) return null

  const next: NationalCompetitionState = JSON.parse(JSON.stringify(state))
  const f = next.fixtures.find(x => x.id === alvo.id)
  if (!f) return null

  const usuarioEmCasa = f.homeId === userId
  const golsCasa = usuarioEmCasa ? golsDoUsuario : golsDoAdversario
  const golsFora = usuarioEmCasa ? golsDoAdversario : golsDoUsuario

  f.played = true
  f.homeScore = golsCasa
  f.awayScore = golsFora

  // Empate em mata-mata so se decide nos penaltis; quem avanca vem da disputa
  // que o jogador acabou de fazer na tela, nao de um sorteio novo.
  const mataMata = next.currentRound > next.totalGroupRounds
  if (mataMata && golsCasa === golsFora) {
    f.decidedOnPens = true
    f.userAdvanced = venceuNosPenaltis === true
  }

  // Na fase de grupos/liga o placar tambem conta na tabela.
  if (next.currentRound <= next.totalGroupRounds) {
    const linhaCasa = next.table.find(r => r.teamId === f.homeId)
    const linhaFora = next.table.find(r => r.teamId === f.awayId)
    if (linhaCasa && linhaFora) {
      applyResult(linhaCasa, golsCasa, golsFora)
      applyResult(linhaFora, golsFora, golsCasa)
    }
  }

  const adversario = usuarioEmCasa ? f.awayName : f.homeName
  const resumo = f.decidedOnPens
    ? `${golsDoUsuario} x ${golsDoAdversario} vs ${adversario} (${f.userAdvanced ? "venceu" : "perdeu"} nos penaltis)`
    : `${golsDoUsuario} x ${golsDoAdversario} vs ${adversario}`

  return { state: next, resumo }
}
