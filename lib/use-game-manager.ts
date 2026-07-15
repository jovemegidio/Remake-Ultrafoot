// Hook centralizado que integra save-system com game-engine
// Gerencia a progressao da temporada, classificacao dinamica e simulacao de partidas

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useGameState, type CoachSkillId } from "@/lib/save-system"
import { getLeagueTeams, generateSeasonFixtures, initStandings } from "@/lib/career-engine"
import { useGameEngine, type StandingsEntry, type MatchResult, type MatchEvent } from "@/lib/game-engine"
import { getTeamsByDivision, getTeamByShort, allBrazilianTeams, allTeams, type Team } from "@/lib/teams-data"
import { getPlayersByTeam } from "@/lib/players-data"
import { competitionsByLeague, type Competition } from "@/lib/international-competitions"
// Propostas de outros clubes: o motor existia mas nunca era chamado (codigo morto).
import { generateJobOffers, computeBoardConfidence, calcSeasonObjective } from "@/lib/board-engine"
import { addJobOffers } from "@/lib/career-moves"
// Acesso/rebaixamento: a posicao final muda a divisao do clube na proxima temporada.
import { resolveDivisionChange } from "@/lib/promotion-relegation"

const LEAGUE_NAMES: Record<string, string> = {
  serie_a: "Brasileirao Serie A",
  serie_b: "Brasileirao Serie B",
  serie_c: "Brasileirao Serie C",
  serie_d: "Brasileirao Serie D",
  premier_league: "Premier League",
  la_liga: "La Liga",
  serie_a_ita: "Serie A",
  bundesliga: "Bundesliga",
  ligue_1: "Ligue 1",
  saudi_pro: "Saudi Pro League",
  mls: "Major League Soccer",
  liga_mx: "Liga MX",
  primeira_liga: "Primeira Liga",
  j_league: "J-League",
  paulistao: "Campeonato Paulista",
  carioca: "Campeonato Carioca",
  mineiro: "Campeonato Mineiro",
  gaucho: "Campeonato Gaucho",
}

// Configuracao do calendario de cada liga: mes de inicio (0=Jan) e duracao em meses
interface LeagueCalendarConfig {
  startMonth: number
  monthsInSeason: number
  rounds: number
}

const LEAGUE_CALENDAR: Record<string, LeagueCalendarConfig> = {
  // Ligas brasileiras: parte nacional comeca em abril
  serie_a:        { startMonth: 3,  monthsInSeason: 8,  rounds: 38 },
  serie_b:        { startMonth: 3,  monthsInSeason: 8,  rounds: 38 },
  serie_c:        { startMonth: 3,  monthsInSeason: 8,  rounds: 38 },
  serie_d:        { startMonth: 3,  monthsInSeason: 8,  rounds: 38 },
  // Estaduais isolados (divisao propria)
  paulistao:      { startMonth: 0,  monthsInSeason: 3,  rounds: 14 },
  carioca:        { startMonth: 0,  monthsInSeason: 3,  rounds: 12 },
  mineiro:        { startMonth: 0,  monthsInSeason: 3,  rounds: 12 },
  gaucho:         { startMonth: 0,  monthsInSeason: 3,  rounds: 12 },
  // Europa: agosto a maio
  premier_league: { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  la_liga:        { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  serie_a_ita:    { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  bundesliga:     { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  ligue_1:        { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  primeira_liga:  { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  eredivisie:     { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  scottish_prem:  { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  super_lig:      { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  pro_league_bel: { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  russian_prem:   { startMonth: 6,  monthsInSeason: 11, rounds: 30 },
  // Americas nao-Brasil
  mls:            { startMonth: 2,  monthsInSeason: 9,  rounds: 34 },
  liga_mx:        { startMonth: 6,  monthsInSeason: 11, rounds: 34 },
  liga_argentina: { startMonth: 0,  monthsInSeason: 12, rounds: 46 },
  primera_a_col:  { startMonth: 1,  monthsInSeason: 11, rounds: 40 },
  primera_div_chi:{ startMonth: 1,  monthsInSeason: 10, rounds: 30 },
  primera_div_ury:{ startMonth: 1,  monthsInSeason: 10, rounds: 30 },
  // Asia
  saudi_pro:      { startMonth: 7,  monthsInSeason: 10, rounds: 30 },
  j_league:       { startMonth: 1,  monthsInSeason: 11, rounds: 34 },
  k_league_1:     { startMonth: 1,  monthsInSeason: 11, rounds: 38 },
  chinese_super:  { startMonth: 1,  monthsInSeason: 10, rounds: 30 },
  // 2as divisoes Europa
  championship:   { startMonth: 7,  monthsInSeason: 10, rounds: 46 },
  la_liga_2:      { startMonth: 7,  monthsInSeason: 10, rounds: 42 },
  serie_b_ita:    { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  bundesliga_2:   { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  ligue_2:        { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  liga_portugal_2:{ startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  eerste_divisie: { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  challenger_pro: { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  tff_1_lig:      { startMonth: 7,  monthsInSeason: 10, rounds: 36 },
  russian_first:  { startMonth: 6,  monthsInSeason: 11, rounds: 30 },
  // 2as divisoes Americas
  primera_b_arg:  { startMonth: 0,  monthsInSeason: 12, rounds: 46 },
  torneo_betplay: { startMonth: 1,  monthsInSeason: 11, rounds: 40 },
  primera_b_chi:  { startMonth: 1,  monthsInSeason: 10, rounds: 30 },
  segunda_div_ury:{ startMonth: 1,  monthsInSeason: 10, rounds: 30 },
  // 2as divisoes Asia
  saudi_first_div:{ startMonth: 7,  monthsInSeason: 10, rounds: 30 },
  j2_league:      { startMonth: 1,  monthsInSeason: 11, rounds: 40 },
  k_league_2:     { startMonth: 1,  monthsInSeason: 11, rounds: 36 },
  china_league_one:{ startMonth: 1, monthsInSeason: 10, rounds: 30 },
}

export const ESTADO_CAMPEONATO: Record<string, string> = {
  SP: "Campeonato Paulista",
  RJ: "Campeonato Carioca",
  RS: "Campeonato Gaucho",
  MG: "Campeonato Mineiro",
  BA: "Campeonato Baiano",
  PR: "Campeonato Paranaense",
  PE: "Campeonato Pernambucano",
  CE: "Campeonato Cearense",
  GO: "Campeonato Goiano",
  SC: "Campeonato Catarinense",
  AL: "Campeonato Alagoano",
  PA: "Campeonato Paraense",
  AM: "Campeonato Amazonense",
  DF: "Campeonato Brasiliense",
  ES: "Campeonato Capixaba",
  MT: "Campeonato Mato-Grossense",
  RN: "Campeonato Potiguar",
  PB: "Campeonato Paraibano",
  MA: "Campeonato Maranhense",
  PI: "Campeonato Piauiense",
  SE: "Campeonato Sergipano",
  RO: "Campeonato Rondoniense",
  AP: "Campeonato Amapaense",
}

const BRAZILIAN_DIVISIONS = ["serie_a", "serie_b", "serie_c", "serie_d"]

function isBrazilianDivision(division: string): boolean {
  return BRAZILIAN_DIVISIONS.includes(division)
}

// Mapeia rodada para mes com base na config do calendario da liga
function getRoundMonth(round: number, startMonth: number, monthsInSeason: number, totalRounds: number): number {
  const monthOffset = Math.floor((round - 1) * monthsInSeason / totalRounds)
  return (startMonth + monthOffset) % 12
}

// Acima deste numero de times o estadual roda em TURNO UNICO, para nao virar um
// campeonato de 24+ rodadas (o Paulista real tem ~12 rodadas de fase de grupos).
const STATE_SINGLE_ROUND_THRESHOLD = 8
const STATE_MAX_TEAMS = 20

// Retorna TODOS os times do estado que disputam o estadual (minimo 4).
// Antes havia um cap fixo de 8 -> SP (13 times) ficava com 5 clubes de fora.
export function getStateChampionshipTeams(userTeamShort: string): Team[] {
  const userTeam = getTeamByShort(userTeamShort)
  if (!userTeam || !isBrazilianDivision(userTeam.divisao)) return []
  const estado = userTeam.estado
  if (!ESTADO_CAMPEONATO[estado]) return []
  const stateTeams = allBrazilianTeams.filter(t => t.estado === estado)
  if (stateTeams.length < 4) return []

  const teams = stateTeams.slice(0, STATE_MAX_TEAMS)
  if (!teams.some(t => t.curto === userTeamShort)) teams[0] = userTeam
  return teams
}

/** Campos grandes rodam em turno unico; campos pequenos em ida e volta. */
function stateChampIsDoubleRound(teamCount: number): boolean {
  return teamCount <= STATE_SINGLE_ROUND_THRESHOLD
}

// Retorna o numero de rodadas do campeonato estadual
export function getStateChampRounds(userTeamShort: string): number {
  const teams = getStateChampionshipTeams(userTeamShort)
  if (teams.length < 4) return 0
  const half = teams.length - 1
  return stateChampIsDoubleRound(teams.length) ? half * 2 : half
}

// Retorna o total de rodadas da liga principal
function getLeagueRounds(division: string): number {
  return LEAGUE_CALENDAR[division]?.rounds ?? 38
}

// ── Copas e competicoes continentais ─────────────────────────────────────────
// O calendario jogavel inclui, alem da liga (e do estadual no Brasil), as copas
// nacionais e as competicoes continentais que o time do usuario disputa. Apenas
// as partidas do usuario sao geradas (acompanhamos a campanha dele); os
// resultados nao alteram a classificacao da liga.

// Divisoes por confederacao (para sortear adversarios continentais coerentes)
const SOUTH_AMERICAN_DIVISIONS = new Set([
  "serie_a", "serie_b", "serie_c", "serie_d",
  "liga_argentina", "primera_a_col", "primera_div_chi", "primera_div_ury",
  "primera_b_arg", "torneo_betplay", "primera_b_chi", "segunda_div_ury",
])
const EUROPEAN_DIVISIONS = new Set([
  "premier_league", "la_liga", "serie_a_ita", "bundesliga", "ligue_1",
  "primeira_liga", "eredivisie", "scottish_prem", "super_lig", "pro_league_bel",
  "russian_prem", "championship", "la_liga_2", "serie_b_ita", "bundesliga_2",
  "ligue_2", "liga_portugal_2", "eerste_divisie", "challenger_pro", "tff_1_lig",
  "russian_first",
])

// RNG deterministico por seed (mantém adversarios estaveis entre re-renders)
function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return () => {
    h += 0x6d2b79f5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Confederacao por divisao (para derivar competicoes continentais quando os
// dados da liga nao as declaram explicitamente)
function getConfederation(division: string): "uefa" | "conmebol" | "afc" | "concacaf" | null {
  if (EUROPEAN_DIVISIONS.has(division)) return "uefa"
  if (division === "liga_argentina" || division === "primera_a_col" ||
      division === "primera_div_chi" || division === "primera_div_ury" ||
      division === "primera_b_arg" || division === "torneo_betplay" ||
      division === "primera_b_chi" || division === "segunda_div_ury") return "conmebol"
  if (division === "saudi_pro" || division === "saudi_first_div" ||
      division === "j_league" || division === "j2_league" ||
      division === "k_league_1" || division === "k_league_2" ||
      division === "chinese_super" || division === "china_league_one") return "afc"
  if (division === "mls" || division === "liga_mx") return "concacaf"
  return null
}

// Cria um Competition sintetico (usado nos fallbacks por confederacao)
function makeComp(id: string, name: string, prestige: number, region: string, type: "cup" | "continental"): Competition {
  return { id, name, shortName: name, type, region, format: type === "cup" ? "knockout" : "group_knockout", teams: 32, prize: 0, prestige }
}

// Competicoes continentais por confederacao, da mais para a menos prestigiada
const CONTINENTAL_FALLBACK: Record<string, Competition[]> = {
  uefa: [
    makeComp("champions_league", "UEFA Champions League", 100, "europa", "continental"),
    makeComp("europa_league", "UEFA Europa League", 80, "europa", "continental"),
    makeComp("conference_league", "UEFA Conference League", 65, "europa", "continental"),
  ],
  conmebol: [
    makeComp("libertadores", "CONMEBOL Libertadores", 95, "america_sul", "continental"),
    makeComp("sulamericana", "CONMEBOL Sul-Americana", 70, "america_sul", "continental"),
  ],
  afc: [makeComp("afc_champions", "AFC Champions League Elite", 78, "asia", "continental")],
  concacaf: [makeComp("concacaf_champions", "CONCACAF Champions Cup", 72, "concacaf", "continental")],
}

// Copa nacional por divisao quando a liga nao declara uma copa (principais ligas)
const NATIONAL_CUP_FALLBACK: Record<string, string> = {
  eredivisie: "KNVB Beker",
  scottish_prem: "Scottish Cup",
  super_lig: "Turkiye Kupasi",
  pro_league_bel: "Croky Cup",
  russian_prem: "Copa da Russia",
  liga_argentina: "Copa Argentina",
  primera_a_col: "Copa Colombia",
  primera_div_chi: "Copa Chile",
  primera_div_ury: "Copa Uruguay",
  j_league: "Copa do Imperador",
  k_league_1: "Copa da Coreia",
  chinese_super: "Copa da China",
}

interface CupCompetitionPlan {
  competition: Competition
  competitionType: "cup" | "continental"
  matchCount: number
}

// Define se uma divisao e de primeiro nivel (top flight) — so o top flight tem
// vaga continental; copas nacionais valem para 1a e 2a divisao.
const TOP_FLIGHT_DIVISIONS = new Set([
  "serie_a", "premier_league", "la_liga", "serie_a_ita", "bundesliga", "ligue_1",
  "primeira_liga", "eredivisie", "scottish_prem", "super_lig", "pro_league_bel",
  "russian_prem", "saudi_pro", "mls", "liga_mx", "j_league", "k_league_1",
  "chinese_super", "liga_argentina", "primera_a_col", "primera_div_chi", "primera_div_ury",
])

// Determina quais copas/continentais o time do usuario disputa e quantos jogos.
// Usa os dados de competitionsByLeague e, quando faltam, deriva por confederacao.
function getUserCupPlan(userTeam: Team): CupCompetitionPlan[] {
  const division = String(userTeam.divisao)
  const comps = competitionsByLeague[division as keyof typeof competitionsByLeague] ?? []
  const plans: CupCompetitionPlan[] = []

  // ── Copa nacional ──────────────────────────────────────────────────────
  const nationalCups = comps.filter(c => c.type === "cup").sort((a, b) => b.prestige - a.prestige)
  if (nationalCups.length > 0) {
    plans.push({ competition: nationalCups[0], competitionType: "cup", matchCount: 5 })
  } else if (NATIONAL_CUP_FALLBACK[division]) {
    plans.push({
      competition: makeComp(`${division}_cup`, NATIONAL_CUP_FALLBACK[division], 60, "nacional", "cup"),
      competitionType: "cup",
      matchCount: 5,
    })
  }

  // ── Competicao continental (apenas top flight) ─────────────────────────
  let continentals = comps.filter(c => c.type === "continental").sort((a, b) => b.prestige - a.prestige)
  if (continentals.length === 0 && TOP_FLIGHT_DIVISIONS.has(division)) {
    const conf = getConfederation(division)
    if (conf) continentals = CONTINENTAL_FALLBACK[conf] ?? []
  }
  if (continentals.length > 0 && TOP_FLIGHT_DIVISIONS.has(division)) {
    const leagueTeams = [...getUserLeagueTeams(userTeam.curto)].sort((a, b) => b.prestigio - a.prestigio)
    const rank = leagueTeams.findIndex(t => t.curto === userTeam.curto)
    let chosen: Competition | null = null
    if (rank >= 0 && rank < 4) chosen = continentals[0]
    else if (rank >= 0 && rank < 10) chosen = continentals[1] ?? continentals[0]
    else if (continentals.length >= 3) chosen = continentals[2]
    // Times de elite (prestigio alto) garantem ao menos a continental secundaria
    if (!chosen && userTeam.prestigio >= 75) chosen = continentals[continentals.length - 1]
    if (chosen) {
      const matchCount = chosen.prestige >= 90 ? 8 : 6
      plans.push({ competition: chosen, competitionType: "continental", matchCount })
    }
  }

  return plans
}

// Conta deterministicamente quantos jogos de copa/continental o usuario tem na temporada
function getUserCupMatchCount(userTeamShort: string): number {
  const userTeam = getTeamByShort(userTeamShort)
  if (!userTeam) return 0
  return getUserCupPlan(userTeam).reduce((sum, p) => sum + p.matchCount, 0)
}

// Monta o pool de adversarios para uma competicao
function getOpponentPool(userTeam: Team, plan: CupCompetitionPlan): Team[] {
  const userShort = userTeam.curto
  if (plan.competitionType === "cup") {
    // Copa nacional: times do mesmo pais/divisao
    if (isBrazilianDivision(userTeam.divisao)) {
      return allBrazilianTeams.filter(t => t.curto !== userShort)
    }
    const sameLeague = getTeamsByDivision(userTeam.divisao).filter(t => t.curto !== userShort)
    return sameLeague.length >= 4 ? sameLeague : allTeams.filter(t => t.curto !== userShort)
  }
  // Continental: times da mesma confederacao
  const region = plan.competition.region
  let divisionSet: Set<string> | null = null
  if (region === "america_sul") divisionSet = SOUTH_AMERICAN_DIVISIONS
  else if (region === "europa") divisionSet = EUROPEAN_DIVISIONS
  const pool = divisionSet
    ? allTeams.filter(t => t.curto !== userShort && divisionSet!.has(String(t.divisao)))
    : allTeams.filter(t => t.curto !== userShort)
  // Prioriza times mais fortes (campeonato continental reune a elite)
  return [...pool].sort((a, b) => b.prestigio - a.prestigio).slice(0, 60)
}

// Gera as partidas do usuario em uma copa/continental (somente o time do usuario joga)
interface CupMatchDescriptor {
  competition: string
  competitionType: "cup" | "continental"
  homeTeam: Team
  awayTeam: Team
}

function generateUserCupMatches(userTeam: Team, plan: CupCompetitionPlan, season: number): CupMatchDescriptor[] {
  const rng = seededRandom(`${userTeam.curto}:${plan.competition.id}:${season}`)
  const pool = getOpponentPool(userTeam, plan)
  if (pool.length === 0) return []

  const matches: CupMatchDescriptor[] = []
  const used = new Set<string>()
  for (let i = 0; i < plan.matchCount; i++) {
    // Escolhe adversario evitando repeticao imediata quando possivel
    let opponent: Team | null = null
    for (let attempt = 0; attempt < 8; attempt++) {
      const cand = pool[Math.floor(rng() * pool.length)]
      if (!used.has(cand.curto) || used.size >= pool.length) {
        opponent = cand
        break
      }
    }
    if (!opponent) opponent = pool[Math.floor(rng() * pool.length)]
    used.add(opponent.curto)

    // Mando alterna por jogo (ida/volta)
    const userIsHome = i % 2 === 0
    matches.push({
      competition: plan.competition.name,
      competitionType: plan.competitionType,
      homeTeam: userIsHome ? userTeam : opponent,
      awayTeam: userIsHome ? opponent : userTeam,
    })
  }
  return matches
}

// Gera fixtures do campeonato estadual (Jan-Mar)
function generateStateChampionshipFixtures(stateTeams: Team[], userTeamShort: string, competition: string): Fixture[] {
  const fixtures: Fixture[] = []
  let fixtureId = 10000
  const halfSeason = stateTeams.length - 1
  const isDouble = stateChampIsDoubleRound(stateTeams.length)
  const totalRounds = isDouble ? halfSeason * 2 : halfSeason

  for (let round = 1; round <= halfSeason; round++) {
    const matchups = generateRoundMatchups(stateTeams, round)
    matchups.forEach(([home, away]) => {
      fixtures.push({
        id: fixtureId++,
        round,
        week: round,
        homeTeam: home,
        awayTeam: away,
        competition,
        played: false,
        isUserMatch: home.curto === userTeamShort || away.curto === userTeamShort,
        month: getRoundMonth(round, 0, 3, totalRounds),
        competitionType: "state",
      })
    })
  }

  // Returno so existe em campos pequenos (ida e volta). Campos grandes (ex: SP com
  // 13 clubes) rodam turno unico para o estadual nao virar 24+ rodadas.
  if (isDouble) {
    for (let round = halfSeason + 1; round <= totalRounds; round++) {
      const turnoRound = round - halfSeason
      const turnoFixtures = fixtures.filter(f => f.round === turnoRound)
      turnoFixtures.forEach(f => {
        fixtures.push({
          id: fixtureId++,
          round,
          week: round,
          homeTeam: f.awayTeam,
          awayTeam: f.homeTeam,
          competition,
          played: false,
          isUserMatch: f.awayTeam.curto === userTeamShort || f.homeTeam.curto === userTeamShort,
          month: getRoundMonth(round, 0, 3, totalRounds),
          competitionType: "state",
        })
      })
    }
  }

  return fixtures
}

// divisionOverride: divisao ATUAL do usuario apos acesso/rebaixamento (do save). Quando
// presente, os adversarios da liga vem dela — e nao da divisao estatica do time.
function getUserLeagueTeams(teamShort: string, divisionOverride?: string): Team[] {
  const userTeam = getTeamByShort(teamShort)
  if (!userTeam) return []
  const division = divisionOverride ?? userTeam.divisao
  const divisionTeams = getTeamsByDivision(division)
  // Guarda: divisao sem times (nunca deveria) -> cai na estatica para nao quebrar a liga.
  if (divisionTeams.length < 4) return getTeamsByDivision(userTeam.divisao)
  // Garante que o time do usuario esta na lista (ele sobe/cai levando o proprio clube).
  const hasUser = divisionTeams.some(t => t.curto === teamShort)
  if (!hasUser) return [userTeam, ...divisionTeams.slice(0, 19)]
  return divisionTeams
}

export function getLeagueName(teamShort: string): string {
  const userTeam = getTeamByShort(teamShort)
  if (!userTeam) return "Liga"
  return LEAGUE_NAMES[userTeam.divisao] ?? "Liga"
}

export function getDivisionLeagueTeams(teamShort: string): Team[] {
  return getUserLeagueTeams(teamShort)
}

export interface Fixture {
  id: number
  round: number
  week: number
  homeTeam: Team
  awayTeam: Team
  competition: string
  played: boolean
  homeScore?: number
  awayScore?: number
  isUserMatch: boolean
  month: number
  competitionType: "state" | "league" | "cup" | "continental"
}

export interface SeasonCalendar {
  fixtures: Fixture[]
  currentRound: number
  nextUserMatch: Fixture | null
  previousUserMatch: Fixture | null
}

// Gera confrontos da liga (todos contra todos, turno e returno) — dinamico por qtd de times
// weekOffset: deslocamento de semanas para colocar a liga apos o estadual (para times brasileiros)
function generateBrasileirao(teams: Team[], userTeamShort: string, competition: string, division: string, weekOffset = 0): Fixture[] {
  const fixtures: Fixture[] = []
  let fixtureId = 1
  const halfSeason = teams.length - 1
  const totalRounds = halfSeason * 2
  const calCfg = LEAGUE_CALENDAR[division] ?? { startMonth: 3, monthsInSeason: 8, rounds: 38 }

  // Primeira fase - turno
  for (let round = 1; round <= halfSeason; round++) {
    const matchups = generateRoundMatchups(teams, round)
    matchups.forEach(([home, away]) => {
      fixtures.push({
        id: fixtureId++,
        round,
        week: round + weekOffset,
        homeTeam: home,
        awayTeam: away,
        competition,
        played: false,
        isUserMatch: home.curto === userTeamShort || away.curto === userTeamShort,
        month: getRoundMonth(round, calCfg.startMonth, calCfg.monthsInSeason, totalRounds),
        competitionType: "league",
      })
    })
  }

  // Segunda fase - returno (inverte mando)
  for (let round = halfSeason + 1; round <= totalRounds; round++) {
    const turnoRound = round - halfSeason
    const turnoFixtures = fixtures.filter(f => f.round === turnoRound)
    turnoFixtures.forEach(f => {
      fixtures.push({
        id: fixtureId++,
        round,
        week: round + weekOffset,
        homeTeam: f.awayTeam,
        awayTeam: f.homeTeam,
        competition,
        played: false,
        isUserMatch: f.awayTeam.curto === userTeamShort || f.homeTeam.curto === userTeamShort,
        month: getRoundMonth(round, calCfg.startMonth, calCfg.monthsInSeason, totalRounds),
        competitionType: "league",
      })
    })
  }

  return fixtures
}

// Algoritmo de circulo para gerar confrontos de uma rodada
// Suporta numero impar de times adicionando um "bye" virtual como ultimo time
function generateRoundMatchups(teams: Team[], round: number): [Team, Team][] {
  const matchups: [Team, Team][] = []

  // Se impar, adiciona um time fantasma (bye) para completar o par
  const list: (Team | null)[] = teams.length % 2 === 0 ? [...teams] : [...teams, null]
  const n = list.length

  // Time fixo = list[0]; restante rotaciona
  const fixed = list[0]
  const rotating = list.slice(1)

  const rotated = [...rotating]
  for (let i = 1; i < round; i++) {
    const last = rotated.pop()!
    rotated.unshift(last)
  }

  const allTeams = [fixed, ...rotated]
  for (let i = 0; i < n / 2; i++) {
    const home = allTeams[i]
    const away = allTeams[n - 1 - i]
    // Ignora partidas envolvendo o time fantasma (bye)
    if (!home || !away) continue
    if (round % 2 === 0) {
      matchups.push([away as Team, home as Team])
    } else {
      matchups.push([home as Team, away as Team])
    }
  }

  return matchups
}

// Simula resultado de uma partida entre dois times
// competition: nome REAL da competicao do fixture (estadual/liga/copa/continental).
// Antes caia sempre em getLeagueName(mandante), o que rotulava jogos de estadual/copa
// como se fossem da liga e quebrava o agrupamento por competicao.
function simulateMatchResult(homeTeam: Team, awayTeam: Team, week: number, season: number, competition?: string): MatchResult {
  // Fator de forca baseado em prestigio
  const homeStrength = homeTeam.prestigio + 5 // Bonus de mando
  const awayStrength = awayTeam.prestigio
  
  // Calcula probabilidades
  const totalStrength = homeStrength + awayStrength
  const homeChance = homeStrength / totalStrength
  
  // Simula gols baseado em forca
  const homeExpectedGoals = 1.3 + (homeChance * 1.5)
  const awayExpectedGoals = 1.1 + ((1 - homeChance) * 1.5)
  
  const homeScore = Math.floor(Math.random() * 4 * (homeExpectedGoals / 2))
  const awayScore = Math.floor(Math.random() * 4 * (awayExpectedGoals / 2))
  
  // Gera eventos basicos com nomes reais dos jogadores
  const homePlayers = getPlayersByTeam(homeTeam.nome)
  const awayPlayers = getPlayersByTeam(awayTeam.nome)
  const attackers = (players: typeof homePlayers) =>
    players.filter(p => ["ATA", "MEI", "PE", "PD"].includes(p.pos))
  const homeAttackers = attackers(homePlayers)
  const awayAttackers = attackers(awayPlayers)
  const pickScorer = (list: typeof homePlayers, fallback: string) => {
    if (!list.length) return fallback
    return list[Math.floor(Math.random() * list.length)].nome
  }
  const events: MatchEvent[] = []
  for (let i = 0; i < homeScore; i++) {
    events.push({
      minute: Math.floor(Math.random() * 90) + 1,
      type: "goal",
      playerId: 0,
      playerName: pickScorer(homeAttackers, homeTeam.curto)
    })
  }
  for (let i = 0; i < awayScore; i++) {
    events.push({
      minute: Math.floor(Math.random() * 90) + 1,
      type: "goal",
      playerId: 0,
      playerName: pickScorer(awayAttackers, awayTeam.curto)
    })
  }
  
  return {
    week,
    season,
    competition: competition ?? getLeagueName(homeTeam.curto),
    homeTeam: homeTeam.curto,
    awayTeam: awayTeam.curto,
    homeScore,
    awayScore,
    events: events.sort((a, b) => a.minute - b.minute)
  }
}

// Inicializa classificacao com times da Serie A
function initializeStandings(teams: Team[]): StandingsEntry[] {
  return teams.map(team => ({
    teamShort: team.curto,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    form: []
  }))
}

/**
 * Calcula a classificacao de UMA competicao a partir dos fixtures dela (estadual,
 * liga, etc.). Inclui todos os times que a disputam, mesmo sem jogos, e ordena por
 * pontos > saldo > gols pro. Necessario porque o engine so mantem a tabela da liga
 * (serieAStandings) — durante o estadual o dashboard mostrava a tabela errada.
 */
export function computeStandingsFromFixtures(fixtures: Fixture[], competition: string): StandingsEntry[] {
  const rows = new Map<string, StandingsEntry>()
  const ensure = (curto: string): StandingsEntry => {
    let r = rows.get(curto)
    if (!r) {
      r = { teamShort: curto, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] }
      rows.set(curto, r)
    }
    return r
  }

  for (const f of fixtures) {
    if (f.competition !== competition) continue
    const home = ensure(f.homeTeam.curto)
    const away = ensure(f.awayTeam.curto)
    if (!f.played || f.homeScore === undefined || f.awayScore === undefined) continue

    const hg = f.homeScore
    const ag = f.awayScore
    home.played++; away.played++
    home.goalsFor += hg; home.goalsAgainst += ag
    away.goalsFor += ag; away.goalsAgainst += hg

    if (hg > ag) { home.won++; home.points += 3; away.lost++ }
    else if (hg < ag) { away.won++; away.points += 3; home.lost++ }
    else { home.drawn++; away.drawn++; home.points++; away.points++ }
  }

  return [...rows.values()].sort((a, b) =>
    b.points - a.points ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor ||
    a.teamShort.localeCompare(b.teamShort),
  )
}

export function useGameManager() {
  const { state: saveState, setState: setSaveState, hydrated } = useGameState()
  const gameEngine = useGameEngine()
  const [engineHydrated, setEngineHydrated] = useState(() => useGameEngine.persist.hasHydrated())

  // Refs always pointing at latest values — prevents stale closures in callbacks called in loops
  const saveStateRef = useRef(saveState)
  saveStateRef.current = saveState
  const seasonCalendarRef = useRef<SeasonCalendar>({ fixtures: [], currentRound: 1, nextUserMatch: null, previousUserMatch: null })

  useEffect(() => {
    setEngineHydrated(useGameEngine.persist.hasHydrated())
    const unsub = useGameEngine.persist.onFinishHydration(() => {
      setEngineHydrated(true)
    })
    return unsub
  }, [])

  // Auto-reinit: engine resetou (versão nova) mas save tem time selecionado
  useEffect(() => {
    if (!hydrated) return
    if (!engineHydrated) return
    if (!saveState.selectedTeamShort) return
    // Reinit se standings ou squad estiverem vazios (initialPlayers tem 1 jogador default)
    if (gameEngine.squadPlayers.length > 1 && gameEngine.serieAStandings.length > 0) return
    const teamShort = saveState.selectedTeamShort
    const leagueTeams = getUserLeagueTeams(teamShort, saveState.divisionOverride)
    gameEngine.initializeGame(teamShort)
    useGameEngine.setState({
      serieAStandings: initializeStandings(leagueTeams),
      currentWeek: saveState.week,
      currentSeason: saveState.season,
    })
  }, [hydrated, engineHydrated, saveState.selectedTeamShort, saveState.week, saveState.season, gameEngine.squadPlayers.length, gameEngine.serieAStandings.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Inicializa o jogo quando o usuario seleciona um time
  const initializeNewGame = useCallback((teamShort: string, managerName?: string) => {
    const leagueTeams = getUserLeagueTeams(teamShort)
    const standings = initializeStandings(leagueTeams)
    const userTeam = getTeamByShort(teamShort)

    // Inicializa no game engine (carrega elenco do seed para o time)
    gameEngine.initializeGame(teamShort)

    // Reseta standings e semana no game engine
    useGameEngine.setState({
      serieAStandings: standings,
      currentWeek: 0,
      currentSeason: 2026,
      matchResults: [],
    })

    // Gera fixtures de carreira para persistir no save state
    // Isso permite que ao-vivo/client.tsx rastreie quais partidas foram jogadas
    // e detecte fim de temporada corretamente.
    const careerTeam = userTeam
      ? {
          nome: userTeam.nome, curto: userTeam.curto,
          cor1: userTeam.cor1, cor2: userTeam.cor2,
          prestigio: userTeam.prestigio, saldo: userTeam.saldo,
          divisao: userTeam.divisao, pais: userTeam.pais ?? "",
          cidade: userTeam.cidade, estado: userTeam.estado,
          torcida: userTeam.torcida, estadio_cap: userTeam.estadio_cap,
          fileKey: userTeam.file_key, estadio: userTeam.estadio_nome ?? "",
          patrocinador: userTeam.patrocinador, escudo: userTeam.escudo_url,
        }
      : null
    let initialFixtures: import("@/lib/career-types").MatchFixture[] = []
    let initialStandings: import("@/lib/career-types").StandingEntry[] = []
    if (careerTeam) {
      const cLeagueTeams = getLeagueTeams(careerTeam)
      initialFixtures = generateSeasonFixtures(cLeagueTeams, teamShort, 2026)
      initialStandings = initStandings(cLeagueTeams)
    }

    // Atualiza save state (reseta progresso, preserva nome do tecnico)
    setSaveState({
      selectedTeamShort: teamShort,
      week: 0,
      season: 2026,
      ...(managerName ? { managerName: managerName.trim() || "Tecnico" } : {}),
      // Fixtures semeadas para rastreamento de fim de temporada
      fixtures: initialFixtures,
      standings: initialStandings,
      results: [],
      finances: [],
      seasonHistory: [],
      injuries: [],
      playerFatigue: {},
      teamMorale: 70,
    })
  }, [gameEngine, setSaveState])
  
  // Calendario da temporada — ref is updated after useMemo so advanceWeek loop calls see latest fixtures
  const seasonCalendar = useMemo((): SeasonCalendar => {
    if (!saveState.selectedTeamShort) {
      return { fixtures: [], currentRound: 1, nextUserMatch: null, previousUserMatch: null }
    }

    const userTeamShort = saveState.selectedTeamShort
    const currentWeek = saveState.week
    const userTeam = getTeamByShort(userTeamShort)
    // Divisao ATUAL (override de acesso/rebaixamento) — define o campeonato desta temporada.
    const division = saveState.divisionOverride ?? userTeam?.divisao ?? "serie_a"

    // Para times brasileiros: gera campeonato estadual (Jan-Mar) + liga nacional (Abr+)
    let allFixtures: Fixture[] = []
    let stateChampRoundsCount = 0

    if (isBrazilianDivision(division)) {
      const stateTeams = getStateChampionshipTeams(userTeamShort)
      if (stateTeams.length >= 4) {
        const stateName = ESTADO_CAMPEONATO[userTeam?.estado ?? ""] ?? "Campeonato Estadual"
        const stateFixtures = generateStateChampionshipFixtures(stateTeams, userTeamShort, stateName)
        stateChampRoundsCount = (stateTeams.length - 1) * 2
        allFixtures.push(...stateFixtures)
      }
    }

    const leagueTeams = getUserLeagueTeams(userTeamShort, saveState.divisionOverride)
    const competition = LEAGUE_NAMES[division] ?? getLeagueName(userTeamShort)
    // Gera a liga com round=1..L (semana sera reatribuida ao intercalar as copas)
    const leagueFixtures = generateBrasileirao(leagueTeams, userTeamShort, competition, division, stateChampRoundsCount)

    // ── Intercala copas nacionais e competicoes continentais ────────────────
    // Cada partida do usuario ocupa uma semana unica (1 jogo por semana). As
    // partidas de copa entram em "meios de semana" distribuidos ao longo da liga.
    const leagueRoundCount = (leagueTeams.length - 1) * 2
    const cupMatches: CupMatchDescriptor[] = []
    if (userTeam) {
      for (const plan of getUserCupPlan(userTeam)) {
        cupMatches.push(...generateUserCupMatches(userTeam, plan, saveState.season))
      }
    }

    if (cupMatches.length === 0) {
      // Sem copas: comportamento original (liga apos o estadual)
      allFixtures.push(...leagueFixtures)
    } else {
      // Agrupa fixtures da liga por rodada para reatribuir semanas
      const leagueByRound = new Map<number, Fixture[]>()
      for (const f of leagueFixtures) {
        const arr = leagueByRound.get(f.round)
        if (arr) arr.push(f)
        else leagueByRound.set(f.round, [f])
      }

      const C = cupMatches.length
      let week = stateChampRoundsCount
      let cupIdx = 0
      let cupFixtureId = 50000

      for (let r = 1; r <= leagueRoundCount; r++) {
        week++
        const roundFixtures = leagueByRound.get(r) ?? []
        const roundMonth = roundFixtures[0]?.month ?? 0
        for (const f of roundFixtures) {
          f.week = week
          allFixtures.push(f)
        }
        // Insere as partidas de copa devidas ate aqui (distribuidas uniformemente)
        while (cupIdx < C && r >= Math.round(((cupIdx + 1) * leagueRoundCount) / (C + 1))) {
          week++
          const cm = cupMatches[cupIdx]
          allFixtures.push({
            id: cupFixtureId++,
            round: cupIdx + 1,
            week,
            homeTeam: cm.homeTeam,
            awayTeam: cm.awayTeam,
            competition: cm.competition,
            played: false,
            isUserMatch: true,
            month: roundMonth,
            competitionType: cm.competitionType,
          })
          cupIdx++
        }
      }
      // Partidas de copa restantes vao para o fim da temporada
      while (cupIdx < C) {
        week++
        const cm = cupMatches[cupIdx]
        allFixtures.push({
          id: cupFixtureId++,
          round: cupIdx + 1,
          week,
          homeTeam: cm.homeTeam,
          awayTeam: cm.awayTeam,
          competition: cm.competition,
          played: false,
          isUserMatch: true,
          month: 11,
          competitionType: cm.competitionType,
        })
        cupIdx++
      }
    }

    // Marca partidas ja jogadas. IMPORTANTE: casa por par DIRECIONAL (mandante x
    // visitante) + temporada, SEM exigir que a semana do resultado seja igual a do
    // fixture. Antes exigia r.week === f.week; qualquer deriva de semana (ex.: uma
    // rodada em que o usuario nao joga, ou o resultado gravado em week+1) fazia o
    // fixture NUNCA ser marcado como jogado -> nextUserMatch travava na mesma
    // partida ("termino e continua a mesma"). Cada par home/away e unico no ida-volta,
    // entao casar so pela direcao + temporada e seguro.
    const seasonNow = saveState.season
    allFixtures.forEach(f => {
      const result = gameEngine.matchResults.find(
        r => r.season === seasonNow &&
             r.homeTeam === f.homeTeam.curto && r.awayTeam === f.awayTeam.curto &&
             r.competition === f.competition
      )
      if (result) {
        f.played = true
        f.homeScore = result.homeScore
        f.awayScore = result.awayScore
      }
    })

    // Encontra rodada atual — total inclui estadual + liga + copas/continentais
    const cupMatchCount = getUserCupMatchCount(userTeamShort)
    const totalWeeks = stateChampRoundsCount + (leagueTeams.length - 1) * 2 + cupMatchCount
    const currentRound = Math.max(1, Math.min(totalWeeks, currentWeek))

    // Proxima partida do usuario (a de menor semana ainda nao jogada)
    const nextUserMatch = allFixtures
      .filter(f => f.isUserMatch && !f.played)
      .sort((a, b) => a.week - b.week)[0] || null

    // Ultima partida do usuario (a de maior semana ja jogada)
    const playedUserMatches = allFixtures
      .filter(f => f.isUserMatch && f.played)
      .sort((a, b) => a.week - b.week)
    const previousUserMatch = playedUserMatches.length > 0
      ? playedUserMatches[playedUserMatches.length - 1]
      : null

    const result = { fixtures: allFixtures, currentRound, nextUserMatch, previousUserMatch }
    seasonCalendarRef.current = result
    return result
    // divisionOverride nas deps: ao subir/cair, o calendario e os adversarios da liga
    // precisam ser recalculados para a divisao nova.
  }, [saveState.selectedTeamShort, saveState.week, saveState.divisionOverride, gameEngine.matchResults])
  
  // Avanca uma semana/rodada
  // Uses refs so sequential calls within a loop always read the latest week (fixes stale closure bug)
  const advanceWeek = useCallback(async () => {
    const currentState = saveStateRef.current
    const currentWeek = currentState.week
    const newWeek = currentWeek + 1

    // Verifica fim de temporada — total inclui estadual + liga + copas/continentais
    const userShort = currentState.selectedTeamShort ?? ""
    const divOverride = currentState.divisionOverride
    const leagueTeamsForEnd = getUserLeagueTeams(userShort, divOverride)
    const stateRoundsForEnd = getStateChampRounds(userShort)
    const leagueRoundsForEnd = (leagueTeamsForEnd.length - 1) * 2
    const cupMatchesForEnd = getUserCupMatchCount(userShort)
    const seasonEndWeek = stateRoundsForEnd + leagueRoundsForEnd + cupMatchesForEnd

    if (newWeek > seasonEndWeek) {
      const currentStandings = useGameEngine.getState().serieAStandings
      const nextSeason = currentState.season + 1

      // Determina o campeao ANTES de resetar as standings
      const sortedForChampion = [...currentStandings].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        const sgA = a.goalsFor - a.goalsAgainst
        const sgB = b.goalsFor - b.goalsAgainst
        if (sgB !== sgA) return sgB - sgA
        return b.goalsFor - a.goalsFor
      })
      const champion = sortedForChampion[0]?.teamShort ?? null

      // ── ACESSO / REBAIXAMENTO ────────────────────────────────────────────
      // A auditoria mostrou que isto era CALCULADO mas nunca aplicado. Agora a
      // posicao final decide a divisao do clube na proxima temporada, e os adversarios
      // do reset ja vem da divisao nova.
      const userTeamStatic = getTeamByShort(userShort)
      const currentDivision = divOverride ?? userTeamStatic?.divisao ?? "serie_a"
      const userFinalPos = sortedForChampion.findIndex(s => s.teamShort === userShort) + 1

      let nextDivisionOverride = divOverride
      let divisionMovement = currentState.divisionMovement
      if (userFinalPos > 0) {
        const outcome = resolveDivisionChange(
          currentDivision, userFinalPos, userTeamStatic?.nome ?? "Seu clube",
        )
        if (outcome.movement !== "stay") {
          // undefined quando volta a divisao estatica original (limpa o override).
          nextDivisionOverride =
            outcome.nextDivision === userTeamStatic?.divisao ? undefined : outcome.nextDivision
          divisionMovement = {
            movement: outcome.movement, message: outcome.message, season: nextSeason,
          }
        }
      }

      // Adversarios da PROXIMA temporada: da divisao ja atualizada.
      const teamsForReset = getUserLeagueTeams(userShort, nextDivisionOverride)
      const newStandings = initializeStandings(teamsForReset)

      // Processa fim de temporada: envelhece jogadores, aposentadorias, jovens da base, reseta standings
      gameEngine.processSeasonEnd(nextSeason, newStandings, currentStandings)

      const patch = {
        week: 0, season: nextSeason,
        divisionOverride: nextDivisionOverride,
        divisionMovement,
      }
      saveStateRef.current = { ...currentState, ...patch }
      setSaveState(patch)

      return { newSeason: true, champion }
    }

    // Simula partidas de outros times desta rodada
    const roundFixtures = seasonCalendarRef.current.fixtures.filter(
      f => f.week === newWeek && !f.isUserMatch
    )

    // Atualiza fixtures no gameState para rastreamento de fim de temporada
    const prevFixtures = (saveStateRef.current as unknown as Record<string, unknown>).fixtures as import("@/lib/career-types").MatchFixture[] | undefined ?? []
    let updatedStateFixtures = [...prevFixtures]

    for (const fixture of roundFixtures) {
      const result = simulateMatchResult(
        fixture.homeTeam,
        fixture.awayTeam,
        newWeek,
        currentState.season,
        fixture.competition
      )
      // Apenas atualiza standings da liga principal (nao do estadual)
      if (fixture.competitionType === "league") {
        gameEngine.updateStandings(result)
      } else {
        gameEngine.addMatchResultOnly(result)
      }
      // Marca fixture correspondente como jogada no gameState
      const idx = updatedStateFixtures.findIndex(
        f => !f.isUserMatch && f.round === (fixture.round ?? newWeek)
          && f.homeCurto === fixture.homeTeam.curto && f.awayCurto === fixture.awayTeam.curto
      )
      if (idx !== -1) {
        updatedStateFixtures[idx] = {
          ...updatedStateFixtures[idx],
          played: true,
          homeGoals: result.homeScore,
          awayGoals: result.awayScore,
        }
      }
    }

    // Avanca game engine
    gameEngine.advanceWeek()

    // Update ref immediately so the next loop iteration sees the incremented week
    saveStateRef.current = { ...currentState, week: newWeek, fixtures: updatedStateFixtures } as typeof currentState & { fixtures: unknown }
    setSaveState({ week: newWeek, fixtures: updatedStateFixtures } as Partial<typeof currentState> & { fixtures: unknown })

    // Detecta campeao da liga apenas ao final da ultima rodada
    let leagueChampion: { competition: string; season: string; stats: { won: number; drawn: number; lost: number; goalsFor: number } } | null = null
    if (newWeek === seasonEndWeek) {
      const finalStandings = useGameEngine.getState().serieAStandings
      const sorted = [...finalStandings].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        const sgA = a.goalsFor - a.goalsAgainst
        const sgB = b.goalsFor - b.goalsAgainst
        if (sgB !== sgA) return sgB - sgA
        return b.goalsFor - a.goalsFor
      })
      const userEntry = finalStandings.find(s => s.teamShort === userShort)
      if (sorted[0]?.teamShort === userShort && userEntry) {
        leagueChampion = {
          competition: getLeagueName(userShort),
          season: `${currentState.season}/${String(currentState.season + 1).slice(-2)}`,
          stats: {
            won: userEntry.won,
            drawn: userEntry.drawn,
            lost: userEntry.lost,
            goalsFor: userEntry.goalsFor,
          },
        }
      }
    }

    // ── PROPOSTAS DE OUTROS CLUBES ──────────────────────────────────────────
    //
    // BUG que isto corrige: `generateJobOffers()` (lib/board-engine.ts) existia completa
    // e NUNCA era chamada. Codigo morto — nenhum clube jamais procurava o tecnico, por
    // melhor que fosse a campanha, e o ciclo "performar -> ser cortejado -> subir de
    // patamar" nunca fechava.
    //
    // Agora ele roda a cada semana. O proprio motor ja e conservador (so procura quem
    // tem confianca >= 70 e esta no top 6), entao nao vira spam.
    try {
      const st = saveStateRef.current
      const shortNow = st.selectedTeamShort ?? ""
      const teamNow = getTeamByShort(shortNow)
      if (teamNow) {
        const tabela = [...useGameEngine.getState().serieAStandings].sort(
          (a, b) => b.points - a.points,
        )
        const posNow = tabela.findIndex((s) => s.teamShort === shortNow) + 1 || 20

        // Forma recente do usuario (mais recente primeiro), a partir dos resultados dele.
        const recentForm = [...useGameEngine.getState().matchResults]
          .filter((r) => r.homeTeam === shortNow || r.awayTeam === shortNow)
          .slice(-5)
          .reverse()
          .map((r) => {
            const isHome = r.homeTeam === shortNow
            const pro = isHome ? r.homeScore : r.awayScore
            const contra = isHome ? r.awayScore : r.homeScore
            return pro > contra ? "V" : pro === contra ? "E" : "D"
          }) as ("V" | "E" | "D")[]

        const confianca = computeBoardConfidence({
          currentPosition: posNow,
          // calcSeasonObjective so le prestigio/nome/divisao, presentes em Team; cast e seguro.
          objective: calcSeasonObjective(teamNow as unknown as Parameters<typeof calcSeasonObjective>[0]),
          recentForm,
          seasonProgress: Math.min(1, newWeek / Math.max(1, seasonEndWeek)),
        })

        const candidatos = allTeams
          .filter((t) => t.curto !== shortNow)
          .map((t) => ({ curto: t.curto, nome: t.nome, prestigio: t.prestigio ?? 60 }))

        const ofertas = generateJobOffers(
          confianca,
          posNow,
          teamNow.prestigio ?? 60,
          candidatos,
          { allowNationalTeam: true },
        )
        if (ofertas.length) addJobOffers(ofertas, st.season, newWeek)
      }
    } catch {
      // Propostas sao um extra: se algo falhar aqui, o avanco de semana NAO pode quebrar.
    }

    return {
      newSeason: false,
      simulatedMatches: roundFixtures.length,
      nextUserMatch: seasonCalendarRef.current.nextUserMatch,
      leagueChampion,
    }
  }, [setSaveState, gameEngine])
  
  // Registra resultado da partida do usuario
  // week+1 porque saveState.week é a rodada anterior — o usuario acabou de jogar a rodada atual (week+1)
  const registerUserMatchResult = useCallback((
    homeTeam: string,
    awayTeam: string,
    homeScore: number,
    awayScore: number,
    events: MatchEvent[]
  ) => {
    const currentState = saveStateRef.current
    const targetWeek = currentState.week + 1

    // Guard: evita duplo registro da mesma rodada (ex: quick-sim + ao-vivo)
    const alreadyRegistered = useGameEngine.getState().matchResults.some(
      r => r.week === targetWeek && r.season === currentState.season &&
           ((r.homeTeam === homeTeam && r.awayTeam === awayTeam) ||
            (r.homeTeam === awayTeam && r.awayTeam === homeTeam))
    )
    if (alreadyRegistered) return

    const leagueName = getLeagueName(currentState.selectedTeamShort ?? "")
    const stateRounds = getStateChampRounds(currentState.selectedTeamShort ?? "")
    const userTeamForComp = getTeamByShort(currentState.selectedTeamShort ?? "")

    // Busca o fixture real desta semana para saber a competicao exata (liga,
    // estadual, copa ou continental). Copas/continentais NAO alteram a classificacao.
    const fixtureForWeek = seasonCalendarRef.current.fixtures.find(
      f => f.week === targetWeek && f.isUserMatch &&
           ((f.homeTeam.curto === homeTeam && f.awayTeam.curto === awayTeam) ||
            (f.homeTeam.curto === awayTeam && f.awayTeam.curto === homeTeam))
    )
    const competitionType = fixtureForWeek?.competitionType
      ?? (targetWeek > stateRounds ? "league" : "state")
    const isLeagueMatch = competitionType === "league"

    const fallbackName = isLeagueMatch
      ? leagueName
      : (ESTADO_CAMPEONATO[userTeamForComp?.estado ?? ""] ?? leagueName)
    const competitionName = fixtureForWeek?.competition ?? fallbackName

    const result: MatchResult = {
      week: targetWeek,
      season: currentState.season,
      competition: competitionName,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      events
    }

    // So atualiza standings da liga principal (nao do estadual/copas/continentais)
    if (isLeagueMatch) {
      gameEngine.updateStandings(result)
    } else {
      gameEngine.addMatchResultOnly(result)
    }

    // === XP e habilidades do treinador ===
    const userShort = currentState.selectedTeamShort ?? ""
    const userIsHome = homeTeam === userShort
    const userScore = userIsHome ? homeScore : awayScore
    const oppScore = userIsHome ? awayScore : homeScore
    const won = userScore > oppScore
    const lost = userScore < oppScore

    // XP: +10 por jogo, +15 por vitoria, +5 por empate
    const xpGain = 10 + (won ? 15 : userScore === oppScore ? 5 : 0)
    const newXP = currentState.coachXP + xpGain

    // Sequencia de vitorias
    const newStreak = won ? currentState.coachWinStreak + 1 : 0

    // Verifica desbloqueio de habilidades Just-in-Time
    const skillsToUnlock: CoachSkillId[] = []
    const updatedSkills = currentState.coachSkills.map(skill => {
      if (skill.unlocked) return skill
      if (skill.unlockTrigger.type === "win_streak" && newStreak >= skill.unlockTrigger.threshold) {
        skillsToUnlock.push(skill.id)
        return { ...skill, unlocked: true, unlockedSeason: currentState.season }
      }
      return skill
    })

    setSaveState({
      coachXP: newXP,
      coachWinStreak: newStreak,
      coachSkills: updatedSkills,
    })
  }, [gameEngine, setSaveState])
  
  // Classificacao atual ordenada
  const standings = useMemo(() => {
    return [...gameEngine.serieAStandings].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const sgA = a.goalsFor - a.goalsAgainst
      const sgB = b.goalsFor - b.goalsAgainst
      if (sgB !== sgA) return sgB - sgA
      return b.goalsFor - a.goalsFor
    })
  }, [gameEngine.serieAStandings])
  
  // Competicao que esta sendo disputada agora (ex: "Campeonato Paulista").
  const currentCompetition = useMemo(
    () => seasonCalendar.nextUserMatch?.competition ?? null,
    [seasonCalendar.nextUserMatch],
  )
  const currentCompetitionType = useMemo(
    () => seasonCalendar.nextUserMatch?.competitionType ?? "league",
    [seasonCalendar.nextUserMatch],
  )

  // Tabela do campeonato EM DISPUTA. O engine so mantem a tabela da liga, entao
  // para estadual/copa a tabela e derivada dos fixtures da propria competicao.
  const currentStandings = useMemo(() => {
    if (!currentCompetition || currentCompetitionType === "league") return standings
    return computeStandingsFromFixtures(seasonCalendar.fixtures, currentCompetition)
  }, [currentCompetition, currentCompetitionType, seasonCalendar.fixtures, standings])

  // Posicao do usuario na tabela do campeonato em disputa
  const userPosition = useMemo(() => {
    if (!saveState.selectedTeamShort) return 0
    const index = currentStandings.findIndex(s => s.teamShort === saveState.selectedTeamShort)
    return index + 1
  }, [currentStandings, saveState.selectedTeamShort])
  
  // Time do usuario — com a divisao ATUAL (override de acesso/rebaixamento) aplicada, para
  // que TUDO que deriva de userTeam.divisao (copas, competicoes, nome da liga) acompanhe.
  const userTeam = useMemo(() => {
    if (!saveState.selectedTeamShort) return null
    const base = getTeamByShort(saveState.selectedTeamShort)
    if (!base) return null
    return saveState.divisionOverride && saveState.divisionOverride !== base.divisao
      ? { ...base, divisao: saveState.divisionOverride }
      : base
  }, [saveState.selectedTeamShort, saveState.divisionOverride])
  
  // Desbloqueia habilidade do treinador manualmente (crise resolvida, titulo, etc)
  const unlockCoachSkill = useCallback((skillId: CoachSkillId) => {
    const currentState = saveStateRef.current
    setSaveState({
      coachSkills: currentState.coachSkills.map(s =>
        s.id === skillId && !s.unlocked
          ? { ...s, unlocked: true, unlockedSeason: currentState.season }
          : s
      )
    })
  }, [setSaveState])

  // Incrementa contador de crises e verifica desbloqueio de habilidades por crise
  const recordCrisisResolved = useCallback(() => {
    const currentState = saveStateRef.current
    const newCount = currentState.coachCrisisCount + 1
    const updatedSkills = currentState.coachSkills.map(skill => {
      if (skill.unlocked) return skill
      if (skill.unlockTrigger.type === "crisis_resolved" && newCount >= skill.unlockTrigger.threshold) {
        return { ...skill, unlocked: true, unlockedSeason: currentState.season }
      }
      return skill
    })
    setSaveState({ coachCrisisCount: newCount, coachSkills: updatedSkills })
  }, [setSaveState])

  // Salva historico de carreira (chamado quando treinador e demitido ou muda de clube)
  const saveCareerRecord = useCallback((params: {
    teamShort: string, teamName: string, titles: string[],
    bestPosition: number, youthAcademyLevelLeft: number,
    endReason: "demitido" | "aposentado" | "novo_desafio"
  }) => {
    const currentState = saveStateRef.current
    const record = {
      ...params,
      seasons: currentState.season - (currentState.coachLegacy.careerRecords.length > 0
        ? (currentState.coachLegacy.careerRecords[currentState.coachLegacy.careerRecords.length - 1].endedSeason + 1)
        : 2026),
      startedSeason: 2026,
      endedSeason: currentState.season,
    }
    // Habilidades desbloqueadas nessa carreira ficam no legado
    const newLegacySkills = Array.from(new Set([
      ...currentState.coachLegacy.legacySkills,
      ...currentState.coachSkills.filter(s => s.unlocked).map(s => s.id),
    ])) as CoachSkillId[]
    const newRep = Math.min(5, currentState.coachLegacy.reputationLevel + (params.titles.length > 0 ? 1 : 0))
    setSaveState({
      coachLegacy: {
        ...currentState.coachLegacy,
        totalSeasons: currentState.coachLegacy.totalSeasons + record.seasons,
        totalTitles: currentState.coachLegacy.totalTitles + params.titles.length,
        careerRecords: [...currentState.coachLegacy.careerRecords, record],
        legacySkills: newLegacySkills,
        reputationLevel: newRep,
        legacyXP: currentState.coachLegacy.legacyXP + currentState.coachXP,
      }
    })
  }, [setSaveState])

  const league = useMemo(
    () => getTeamByShort(saveState.selectedTeamShort ?? "")?.divisao ?? "serie_a",
    [saveState.selectedTeamShort]
  )

  return {
    // Estado
    hydrated,
    userTeam,
    userPosition,
    standings,
    // Tabela + nome do campeonato que esta sendo disputado (estadual, liga, copa...)
    currentStandings,
    currentCompetition,
    currentCompetitionType,
    seasonCalendar,
    currentWeek: saveState.week,
    currentSeason: saveState.season,

    // Convenências derivadas (usadas por /partida e /partida/ao-vivo)
    league,
    currentMatch: seasonCalendar.nextUserMatch ?? null,
    currentRound: seasonCalendar.currentRound,

    // Game Engine direto
    gameEngine,

    // Acoes
    initializeNewGame,
    advanceWeek,
    registerUserMatchResult,
    unlockCoachSkill,
    recordCrisisResolved,
    saveCareerRecord,

    // Save state
    saveState,
    setSaveState
  }
}

// Hook para obter proxima partida do usuario
export function useNextMatch() {
  const { seasonCalendar, userTeam } = useGameManager()
  return {
    nextMatch: seasonCalendar.nextUserMatch,
    userTeam
  }
}

// Hook para obter classificacao com destaques
export function useStandings() {
  const { standings, userPosition, userTeam } = useGameManager()
  
  return {
    standings: standings.map((entry, index) => ({
      ...entry,
      position: index + 1,
      team: getTeamByShort(entry.teamShort),
      isUserTeam: entry.teamShort === userTeam?.curto,
      zone: index < 4 ? "libertadores" : 
            index < 6 ? "sulamericana" : 
            index < 12 ? "meio" : 
            index < 16 ? "danger" : "rebaixamento"
    })),
    userPosition,
    userTeam
  }
}
