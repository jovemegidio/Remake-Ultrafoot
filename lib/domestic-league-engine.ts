import { competitionsByLeague, type Competition } from "./international-competitions"

/**
 * Motor puro dos campeonatos nacionais.
 *
 * O calendário da carreira nasceu como um gerador do Brasileirão e, durante a
 * expansão internacional, passou a ser reutilizado por todas as ligas. Este
 * módulo mantém o algoritmo de confrontos fora do React e transforma o formato
 * declarado pela competição em partidas executáveis.
 */

export interface LeagueScheduleTeam {
  id: string
  name: string
}

export interface LeaguePairing {
  round: number
  homeId: string
  awayId: string
  stage: string
  group?: string
  segment?: number
}

export type LeagueSeasonKind = "round_robin" | "conferences" | "split"

export interface LeagueSeasonPlan {
  division: string
  competitionId: string
  competitionName: string
  kind: LeagueSeasonKind
  regularCycles: number
  seasonSegments: number
  /** Quantidade de clubes em cada bloco depois da fase regular. */
  splitGroups?: readonly number[]
  /** Turnos dentro de cada bloco. Aceita um valor diferente por bloco. */
  splitCycles?: readonly number[]
  /** Partidas de fase regular por clube. */
  regularMatches: number
  /** Máximo de partidas de liga por clube, contando a fase final. */
  maximumMatches: number
}

const SPLIT_RULES: Record<string, {
  regularCycles: number
  groups: readonly number[]
  splitCycles: readonly number[]
}> = {
  // 33 rodadas e divisão 6/6 para mais cinco partidas.
  scottish_prem: { regularCycles: 3, groups: [6, 6], splitCycles: [1, 1] },
  // Três turnos e grupos Final A/Final B.
  k_league_1: { regularCycles: 3, groups: [6, 6], splitCycles: [1, 1] },
  // 22 rodadas e dois grupos de seis em turno e returno.
  superliga_den: { regularCycles: 2, groups: [6, 6], splitCycles: [2, 2] },
  betinia_liga: { regularCycles: 2, groups: [6, 6], splitCycles: [2, 2] },
  // Os seis primeiros jogam dez; os oito últimos, sete.
  protathlima_cyp: { regularCycles: 2, groups: [6, 8], splitCycles: [2, 1] },
  // Primeira fase de turno único e dois grupos de oito em ida e volta.
  second_div_cyp: { regularCycles: 1, groups: [8, 8], splitCycles: [2, 2] },
  // Três blocos finais. Os grupos menores terminam antes do playout 9º-14º.
  super_league_gre: { regularCycles: 2, groups: [4, 4, 6], splitCycles: [2, 2, 2] },
  // Após 30 rodadas: seis pelo título, quatro no playoff europeu eliminatório
  // (não gera pontos de liga) e seis pela permanência. Os dois blocos de liga
  // fazem mais um turno; o mata-mata europeu continua tratado como copa.
  fortuna_liga_cze: { regularCycles: 2, groups: [6, 4, 6], splitCycles: [1, 0, 1] },
}

const MLS_EAST = new Set([
  "atlanta united", "charlotte", "chicago fire", "cincinnati", "columbus crew",
  "dc united", "inter miami", "montreal", "nashville", "new england",
  "new york city", "new york red bulls", "orlando city", "philadelphia union", "toronto",
])

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim()
}

export function leagueCompetitionForDivision(division: string): Competition | undefined {
  return competitionsByLeague[division]?.find(competition => competition.type === "league")
}

export function leagueNameForDivision(division: string): string {
  return leagueCompetitionForDivision(division)?.name ?? "Liga"
}

function inferredCycles(competition: Competition | undefined, teamCount: number): number {
  if (competition?.roundRobinCycles && competition.roundRobinCycles > 0) {
    return competition.roundRobinCycles
  }
  const baseRounds = Math.max(1, teamCount - 1)
  const declared = competition?.rounds ?? baseRounds * 2
  const cycles = declared / baseRounds
  // Só convertemos rodadas em turnos quando a conta é exata. Formatos com split
  // são tratados por SPLIT_RULES e não devem inventar confrontos para preencher.
  return Number.isInteger(cycles) && cycles > 0 ? cycles : 2
}

export function leagueSeasonPlan(division: string, teamCount: number): LeagueSeasonPlan {
  const competition = leagueCompetitionForDivision(division)
  const competitionName = competition?.name ?? "Liga"
  const competitionId = competition?.id ?? division

  if (division === "mls" && teamCount >= 20) {
    return {
      division, competitionId, competitionName, kind: "conferences",
      regularCycles: 0, seasonSegments: 1, regularMatches: 34, maximumMatches: 34,
    }
  }

  const split = SPLIT_RULES[division]
  if (split && split.groups.reduce((sum, size) => sum + size, 0) === teamCount) {
    const regularMatches = Math.max(0, teamCount - 1) * split.regularCycles
    const maximumSplit = Math.max(...split.groups.map((size, index) =>
      Math.max(0, size - 1) * (split.splitCycles[index] ?? split.splitCycles[0] ?? 1)))
    return {
      division, competitionId, competitionName, kind: "split",
      regularCycles: split.regularCycles,
      seasonSegments: 1,
      splitGroups: split.groups,
      splitCycles: split.splitCycles,
      regularMatches,
      maximumMatches: regularMatches + maximumSplit,
    }
  }

  const cycles = inferredCycles(competition, teamCount)
  const segments = Math.max(1, competition?.seasonSegments ?? 1)
  const matches = Math.max(0, teamCount - 1) * cycles
  return {
    division, competitionId, competitionName, kind: "round_robin",
    regularCycles: cycles, seasonSegments: segments,
    regularMatches: matches, maximumMatches: matches,
  }
}

/** Um turno completo pelo algoritmo do círculo, incluindo número ímpar. */
function roundRobinCycle(
  teams: readonly LeagueScheduleTeam[],
  cycle: number,
  roundOffset: number,
  stage: string,
  group?: string,
  segment?: number,
): LeaguePairing[] {
  const list: Array<LeagueScheduleTeam | null> = teams.length % 2 === 0
    ? [...teams]
    : [...teams, null]
  if (list.length < 2) return []

  const fixed = list[0]
  let rotating = list.slice(1)
  const pairings: LeaguePairing[] = []

  for (let roundIndex = 0; roundIndex < list.length - 1; roundIndex++) {
    const arranged = [fixed, ...rotating]
    for (let match = 0; match < list.length / 2; match++) {
      const first = arranged[match]
      const second = arranged[list.length - 1 - match]
      if (!first || !second) continue
      const invert = (roundIndex + cycle) % 2 === 1
      pairings.push({
        round: roundOffset + roundIndex + 1,
        homeId: invert ? second.id : first.id,
        awayId: invert ? first.id : second.id,
        stage, group, segment,
      })
    }
    // `null` é a folga de uma liga ímpar e também precisa girar. Testar o valor
    // como booleano congelava a rotação justamente quando a folga estava no fim.
    const last = rotating[rotating.length - 1]
    rotating = [last, ...rotating.slice(0, -1)]
  }
  return pairings
}

function repeatedRoundRobin(
  teams: readonly LeagueScheduleTeam[],
  cycles: number,
  stage: string,
  roundOffset = 0,
  group?: string,
  segmentCount = 1,
): LeaguePairing[] {
  const roundsPerCycle = teams.length % 2 === 0 ? teams.length - 1 : teams.length
  const perSegment = Math.max(1, Math.ceil(cycles / Math.max(1, segmentCount)))
  return Array.from({ length: cycles }, (_, cycle) => {
    const segment = Math.min(segmentCount, Math.floor(cycle / perSegment) + 1)
    const segmentStage = segmentCount > 1
      ? (segment === 1 ? "apertura" : segment === 2 ? "clausura" : `segmento_${segment}`)
      : stage
    return roundRobinCycle(
      teams, cycle, roundOffset + cycle * roundsPerCycle,
      segmentStage, group, segmentCount > 1 ? segment : undefined,
    )
  }).flat()
}

function mlsGroups(teams: readonly LeagueScheduleTeam[]): [LeagueScheduleTeam[], LeagueScheduleTeam[]] {
  const east: LeagueScheduleTeam[] = []
  const undecided: LeagueScheduleTeam[] = []
  for (const team of teams) {
    const name = normalize(team.name)
    if ([...MLS_EAST].some(key => name.includes(key))) east.push(team)
    else undecided.push(team)
  }
  const target = Math.floor(teams.length / 2)
  // Bases antigas ou editadas podem não ter todos os nomes oficiais. Completa
  // deterministicamente sem deixar uma conferência com tamanho diferente.
  undecided.sort((a, b) => a.id.localeCompare(b.id))
  while (east.length < target && undecided.length) east.push(undecided.shift()!)
  const west = undecided
  while (east.length > target) west.push(east.pop()!)
  return [east, west]
}

function conferenceSchedule(teams: readonly LeagueScheduleTeam[]): LeaguePairing[] {
  const [east, west] = mlsGroups(teams)
  const eastGames = repeatedRoundRobin(east, 2, "temporada_regular", 0, "Leste")
  const westGames = repeatedRoundRobin(west, 2, "temporada_regular", 0, "Oeste")
  const conferenceRounds = Math.max(east.length, west.length) - 1
  const cross: LeaguePairing[] = []
  const crossRounds = Math.max(0, 34 - (east.length - 1) * 2)
  for (let round = 0; round < crossRounds; round++) {
    for (let index = 0; index < Math.min(east.length, west.length); index++) {
      const first = east[index]
      const second = west[(index + round) % west.length]
      const invert = (index + round) % 2 === 1
      cross.push({
        round: conferenceRounds * 2 + round + 1,
        homeId: invert ? second.id : first.id,
        awayId: invert ? first.id : second.id,
        stage: "temporada_regular",
        group: "Interconferência",
      })
    }
  }
  return [...eastGames, ...westGames, ...cross]
}

export function generateLeaguePairings(input: {
  division: string
  teams: readonly LeagueScheduleTeam[]
  /** Ordem final da fase regular. Sem ela, o split ainda não é criado. */
  regularRanking?: readonly string[]
}): LeaguePairing[] {
  const plan = leagueSeasonPlan(input.division, input.teams.length)
  if (plan.kind === "conferences") return conferenceSchedule(input.teams)

  const regular = repeatedRoundRobin(
    input.teams,
    plan.regularCycles,
    "temporada_regular",
    0,
    undefined,
    plan.seasonSegments,
  )
  if (plan.kind !== "split" || !plan.splitGroups || !input.regularRanking?.length) {
    return regular
  }

  const byId = new Map(input.teams.map(team => [team.id, team]))
  let cursor = 0
  const splitStart = Math.max(0, ...regular.map(pairing => pairing.round))
  const finalStages: LeaguePairing[] = []
  for (const [index, size] of plan.splitGroups.entries()) {
    const group = input.regularRanking.slice(cursor, cursor + size)
      .map(id => byId.get(id)).filter((team): team is LeagueScheduleTeam => Boolean(team))
    cursor += size
    const label = index === 0 ? "grupo_titulo" : index === plan.splitGroups.length - 1 ? "grupo_permanencia" : `grupo_${index + 1}`
    finalStages.push(...repeatedRoundRobin(
      group,
      plan.splitCycles?.[index] ?? plan.splitCycles?.[0] ?? 1,
      label,
      splitStart,
      label,
    ))
  }
  return [...regular, ...finalStages]
}

/** Janela de calendário usada quando a divisão não possui override histórico. */
export function calendarWindowForDivision(division: string): { startMonth: number; monthsInSeason: number } {
  const competition = leagueCompetitionForDivision(division)
  const region = normalize(competition?.region ?? "")
  const summer = /noruega|suecia|finlandia|islandia|irlanda|faroe|estonia|letonia|lituania|belarus|georgia|cazaquistao/.test(region)
  if (summer) return { startMonth: 2, monthsInSeason: 9 }
  if (/japao|coreia|china|usa|argentina|colombia|chile|uruguai|equador|peru|bolivia|paraguai|venezuela/.test(region)) {
    return { startMonth: region === "usa" ? 2 : 1, monthsInSeason: 10 }
  }
  // Europa e ligas do Golfo seguem temporada que cruza o ano.
  return { startMonth: 7, monthsInSeason: 10 }
}
