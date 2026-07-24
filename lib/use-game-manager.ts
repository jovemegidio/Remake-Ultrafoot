// Hook centralizado que integra save-system com game-engine
// Gerencia a progressao da temporada, classificacao dinamica e simulacao de partidas

"use client"

import { safeLocalSet } from "@/lib/safe-storage"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createCareerId, createFreshCareerState, setActiveCareerId, useGameState, type CoachSkillId, type GameState } from "@/lib/save-system"
import { getLeagueTeams, generateSeasonFixtures, initStandings } from "@/lib/career-engine"
import { useGameEngine, getContractStatus, type StandingsEntry, type MatchResult, type MatchEvent } from "@/lib/game-engine"
import { getTeamsByDivision, getTeamByShort, setClubDivisions, effectiveDivision, allBrazilianTeams, allPoolTeams, allTeams, type Team } from "@/lib/teams-data"
import { getPlayersForTeam } from "@/lib/players-data"
import { simulateWorldTransferWindow } from "@/lib/world-market"
import { competitionsByLeague, type Competition } from "@/lib/international-competitions"
import { caminhoDaCopa, passouNoConfronto, passouNoGrupo, type FaseCopa, type PlacarDaCopa } from "@/lib/cup-bracket"
import { COMPETITION_REGULATIONS_2026, type CompetitionRegulation2026 } from "@/lib/competition-regulations-2026"
// Propostas de outros clubes: o motor existia mas nunca era chamado (codigo morto).
import { generateJobOffers, computeBoardConfidence, calcSeasonObjective, shouldFireManager } from "@/lib/board-engine"
import { addJobOffers, clearJobOffers } from "@/lib/career-moves"
import { hardNavigate } from "@/lib/hard-navigation"
// Acesso/rebaixamento: a posicao final muda a divisao do clube na proxima temporada.
import { resolveDivisionChange, evolvePyramids, type PyramidClub } from "@/lib/league-pyramid"
import { processDebtMonth } from "@/lib/debt-engine"
import { advanceScoutingWeek } from "@/lib/scout-engine"
import { useNotifications } from "@/components/notifications-system"
import { isSeasonOver, selectOverdueUserFixtures } from "@/lib/fixture-catchup"
import { calcMatchdayRevenue, countCareerTitles, fanBaseGrowth, stadiumCapacity } from "@/lib/stadium-economy"
import { leaguePrizeMoney } from "@/lib/club-economy"
import { calcSeasonAwards } from "@/lib/awards-engine"
import { berthsForSeason, continentalTitleBerth, type SuperCupBerth } from "@/lib/super-cups"
import { regionalCupForState } from "@/lib/regional-cups"

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
  // Auditoria 2026-07-20 (scripts/audit-estados.ts): MS e AC têm 4 clubes cada
  // no dado real e estavam FORA do mapa — jogadores desses estados ficavam sem
  // estadual. MT/RO/AP continuam mapeados mas com <4 clubes: o
  // getStateChampionshipTeams devolve [] e o estadual não acontece; para
  // resolver esses é preciso importar mais clubes, não mudar código.
  MS: "Campeonato Sul-Mato-Grossense",
  AC: "Campeonato Acreano",
  // Auditoria 2026-07-23: RR (8 clubes na base) e TO (7) tinham clubes e
  // NENHUM estadual mapeado — eram os dois ultimos estados de fora. Com eles,
  // os 27 estados estao cobertos.
  RR: "Campeonato Roraimense",
  TO: "Campeonato Tocantinense",
}

const BRAZILIAN_DIVISIONS = ["serie_a", "serie_b", "serie_c", "serie_d"]

function isBrazilianDivision(division: string): boolean {
  return BRAZILIAN_DIVISIONS.includes(division)
}

// Clube brasileiro para efeito de ESTADUAL. Diferente de isBrazilianDivision,
// que responde "esta em uma das quatro Series" e governa a geracao das LIGAS
// nacionais — ali `pool:Brasil` nao entra mesmo.
//
// O estadual, porem, nao depende de divisao: clube de varzea disputa estadual.
// Barrar por divisao deixava SEM estadual todo clube que existe apenas no pool
// (MS e AC inteiros, e qualquer clube pool-only dos outros 25 estados).
function disputaEstadual(division: string): boolean {
  return isBrazilianDivision(division) || division === "pool:Brasil"
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

const normalizeCompetitionClub = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
const STATE_RULE_IDS: Record<string, readonly string[]> = {
  SP: ["paulistao_a1", "paulistao_a2", "paulistao_a3"],
  RJ: ["carioca_a1"],
  MG: ["mineiro_modulo_i"],
  RS: ["gaucho_a1"],
  BA: ["baiano"],
  PR: ["paranaense"],
  PE: ["pernambucano"],
  CE: ["cearense"],
  GO: ["goiano"],
  SC: ["catarinense"],
  AL: ["alagoano"],
  PA: ["paraense"],
  AM: ["amazonense"],
  DF: ["brasiliense"],
  ES: ["capixaba"],
  MT: ["mato_grossense"],
  RN: ["potiguar"],
  PB: ["paraibano"],
  MA: ["maranhense"],
  PI: ["piauiense"],
  SE: ["sergipano"],
  RO: ["rondoniense"],
  AP: ["amapaense"],
  MS: ["sul_mato_grossense"],
  AC: ["acreano"],
  RR: ["roraimense"],
  TO: ["tocantinense"],
}

export function getStateCompetitionRule(userTeamShort: string): CompetitionRegulation2026 | undefined {
  const userTeam = getTeamByShort(userTeamShort)
  if (!userTeam) return undefined
  const normalized = normalizeCompetitionClub(userTeam.nome)
  const candidates = (STATE_RULE_IDS[userTeam.estado] ?? []).map(id => COMPETITION_REGULATIONS_2026[id]).filter(Boolean)
  return candidates.find(rule => rule.clubs?.some(name => {
    const club = normalizeCompetitionClub(name)
    return club === normalized || club.includes(normalized) || normalized.includes(club)
  })) ?? candidates[0]
}

// Retorna TODOS os times do estado que disputam o estadual (minimo 4).
// Antes havia um cap fixo de 8 -> SP (13 times) ficava com 5 clubes de fora.
export function getStateChampionshipTeams(userTeamShort: string): Team[] {
  const userTeam = getTeamByShort(userTeamShort)
  if (!userTeam || !disputaEstadual(userTeam.divisao)) return []
  const estado = userTeam.estado
  if (!ESTADO_CAMPEONATO[estado]) return []
  // Curados + clubes do POOL do mesmo estado (o pool ganhou `estado` via
  // assign-pool-br-states.mjs), para estaduais de BA/RS/CE/PR/etc. deixarem de ficar vazios.
  // Dedup por file_key/curto; ordena por prestigio (mais forte primeiro).
  // Dedup por file_key E POR `curto`. O codigo curto NAO e unico na base (134
  // codigos para ~400 clubes): Rio Branco-ES e Rio Branco VN, por exemplo, tem
  // file_keys diferentes e o mesmo RIOBRANC. Como o motor de partidas identifica
  // time por `curto`, os dois no mesmo estadual faziam o clube jogar duas vezes
  // na mesma rodada. Dois clubes com o mesmo codigo nao podem dividir a mesma
  // competicao — fica o de maior prestigio, que entra primeiro na ordenacao.
  const seen = new Set<string>()
  const codigosUsados = new Set<string>()
  const stateTeams = [...allBrazilianTeams, ...allPoolTeams]
    .filter(t => t.estado === estado)
    .sort((a, b) => b.prestigio - a.prestigio || a.nome.localeCompare(b.nome))
    .filter(t => {
      const k = (t.file_key || t.curto || t.nome).toLowerCase()
      const codigo = (t.curto || "").toLowerCase()
      if (seen.has(k) || (codigo && codigosUsados.has(codigo))) return false
      seen.add(k)
      if (codigo) codigosUsados.add(codigo)
      return true
    })
    .sort((a, b) => b.prestigio - a.prestigio || a.nome.localeCompare(b.nome))
  if (stateTeams.length < 4) return []

  const regulation = getStateCompetitionRule(userTeamShort)
  if (regulation?.clubs?.length) {
    // Alguns clubes importados chegam sem `estado` (ou com a UF no campo `pais`).
    // Procurar somente em `stateTeams` deixava regulamentos oficiais incompletos:
    // a A2 paulista, por exemplo, podia ficar com 5 equipes e ainda tentar disputar
    // 15 rodadas, reiniciando o algoritmo e repetindo os mesmos confrontos.
    const globalCandidates = [...allBrazilianTeams, ...allPoolTeams]
    const selected = regulation.clubs.map(name => {
      const expected = normalizeCompetitionClub(name)
      const exact = [...stateTeams, ...globalCandidates].find(team =>
        normalizeCompetitionClub(team.nome) === expected,
      )
      if (exact) return exact
      return stateTeams.find(team => {
        const actual = normalizeCompetitionClub(team.nome)
        return actual.includes(expected) || expected.includes(actual)
      })
    }).filter((team): team is Team => Boolean(team))

    const completed: Team[] = []
    const completedKeys = new Set<string>()
    const completedCodes = new Set<string>()
    const addUnique = (team: Team) => {
      const key = (team.file_key || team.curto || team.nome).toLowerCase()
      const codigo = (team.curto || "").toLowerCase()
      if (completedKeys.has(key) || (codigo && completedCodes.has(codigo))) return
      completedKeys.add(key)
      if (codigo) completedCodes.add(codigo)
      completed.push(team)
    }
    selected.forEach(addUnique)
    if (!completed.some(team => team.curto === userTeamShort)) addUnique(userTeam)
    // Se algum participante oficial ainda não existe na base, completa a quantidade
    // com clubes reais da mesma UF. O calendário nunca recebe menos equipes do que o
    // formato exige quando há alternativas locais disponíveis.
    stateTeams.forEach(team => {
      if (completed.length < regulation.participants) addUnique(team)
    })
    if (completed.length >= 4) return completed.slice(0, regulation.participants)
  }

  // Sem lista nominal de participantes, o teto era sempre STATE_MAX_TEAMS (20).
  // Isso ignorava o `participants` do regulamento: Paranaense e Catarinense sao
  // formatos de 12 e entravam com 15 e 14 clubes, e o Goiano de 12 com 16 — o
  // numero de rodadas do regulamento deixa de fechar com o numero de times, e a
  // fase de grupos fica torta. Quando ha regulamento, ele manda no tamanho.
  const limite = regulation?.participants ?? STATE_MAX_TEAMS
  const teams = stateTeams.slice(0, Math.min(limite, STATE_MAX_TEAMS))
  if (!teams.some(t => t.curto === userTeamShort)) teams[0] = userTeam
  return teams
}

/** Campos grandes rodam em turno unico; campos pequenos em ida e volta. */
function stateChampIsDoubleRound(teamCount: number): boolean {
  return teamCount <= STATE_SINGLE_ROUND_THRESHOLD
}

/** Um turno com quantidade ímpar precisa de N rodadas (uma folga por clube). */
function getRoundRobinHalfRounds(teamCount: number): number {
  return teamCount % 2 === 0 ? teamCount - 1 : teamCount
}

// Retorna o numero de rodadas do campeonato estadual
export function getStateChampRounds(userTeamShort: string): number {
  const teams = getStateChampionshipTeams(userTeamShort)
  if (teams.length < 4) return 0
  const regulation = getStateCompetitionRule(userTeamShort)
  const officialRounds = regulation?.firstPhaseRounds
  const half = getRoundRobinHalfRounds(teams.length)
  // O teto do turno unico (`half`) impedia um regulamento de TURNO E RETURNO de
  // acontecer: o Rondoniense (7 clubes, 42 jogos) ficava com 7 rodadas em vez de
  // 14 — meio campeonato. Se o proprio regulamento pede mais rodadas do que um
  // turno do seu campo comporta, ele e de returno, e o teto passa a ser dois
  // turnos. Quando faltam clubes na base para o formato oficial (Brasiliense e
  // Roraimense hoje), o clamp continua valendo: melhor um turno curto do que
  // rodadas que o campo nao tem como jogar.
  const regulationIsDoubleRound = Boolean(
    officialRounds && regulation && officialRounds > getRoundRobinHalfRounds(regulation.participants),
  )
  const maxJogavel = regulationIsDoubleRound ? half * 2 : half
  const firstPhase = officialRounds
    ? Math.min(officialRounds, maxJogavel)
    : stateChampIsDoubleRound(teams.length) ? half * 2 : half
  const finalPhases = regulation
    ? (regulation.knockout ?? []).reduce((total, stage) =>
        total + (regulation.stageRounds?.[stage] ?? regulation.knockoutLegs?.[stage] ?? (stage === "final" ? regulation.finalLegs : 1) ?? 1), 0)
    : 0
  return firstPhase + finalPhases
}

/**
 * Premio em dinheiro por conquistar um titulo, por peso da competicao. Valores
 * na moeda do jogo (saldo inicial ~27,5M; receita semanal 0,8-4,5M), calibrados
 * para o titulo pesar sem quebrar a economia: uma Libertadores paga varias
 * semanas de operacao, um estadual e simbolico.
 */
export function cupTitlePrize(competitionName: string): number {
  const c = competitionName
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  if (/champions league|libertadores/.test(c)) return 45_000_000
  if (/europa league|sul-?americana|sudamericana/.test(c)) return 18_000_000
  if (/conference league/.test(c)) return 9_000_000
  if (/copa do brasil/.test(c)) return 12_000_000
  if (/supercopa|recopa|super cup|mundial/.test(c)) return 8_000_000
  // Estaduais e demais copas regionais: simbolico.
  return 1_500_000
}

// Retorna o total de rodadas da liga principal
export function getLeagueRounds(division: string): number {
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

export interface CupCompetitionPlan {
  competition: Competition
  competitionType: "cup" | "continental"
  matchCount: number
  /** Copas regionais: restringe os adversários a estas UFs (ver lib/regional-cups.ts). */
  opponentStates?: readonly string[]
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
export function getUserCupPlan(
  userTeam: Team,
  superCups: readonly SuperCupBerth[] = [],
  continentalBerth: "primary" | null = null,
): CupCompetitionPlan[] {
  const division = String(userTeam.divisao)
  const comps = competitionsByLeague[division as keyof typeof competitionsByLeague] ?? []
  const plans: CupCompetitionPlan[] = []

  // ── Supercopas ─────────────────────────────────────────────────────────
  // Decisões entre campeões da temporada anterior. Vêm primeiro porque são
  // disputadas antes do calendário regular. Só existem quando o clube conquistou
  // a vaga — ver lib/super-cups.ts.
  for (const vaga of superCups) {
    // A REGIAO decide de onde sai o adversario. Todas as supercopas nasciam como
    // "nacional", entao getOpponentPool sorteava um clube do MESMO PAIS: o
    // Mundial de Clubes e a Recopa eram disputados contra times brasileiros.
    // Supercopa do Brasil e nacional de verdade; as outras sao internacionais.
    // Regioes validas em getOpponentPool: "america_sul", "europa" e qualquer
    // outra = pool GLOBAL (que e justamente o certo para o Mundial de Clubes).
    const regiao = vaga.id === "supercopa_brasil" ? "nacional"
      : vaga.id === "recopa_sulamericana" ? "america_sul"
      : vaga.id === "supercopa_uefa" ? "europa"
      : "mundo" // mundial_clubes -> adversario de qualquer confederacao
    plans.push({
      competition: makeComp(vaga.id, vaga.name, 75, regiao, vaga.id === "supercopa_brasil" ? "cup" : "continental"),
      competitionType: "cup",
      matchCount: vaga.matchCount,
    })
  }

  // ── Copa regional (Nordeste / Verde) ───────────────────────────────────
  // Elegibilidade pelo ESTADO do clube, como no regulamento da CBF. Estados do
  // eixo Sul/Sudeste (menos ES) não disputam nenhuma — igual à vida real.
  if (isBrazilianDivision(division)) {
    const regional = regionalCupForState(userTeam.estado)
    if (regional) {
      plans.push({
        competition: makeComp(regional.id, regional.name, 55, "nacional", "cup"),
        competitionType: "cup",
        matchCount: regional.matchCount,
        opponentStates: regional.states,
      })
    }
  }

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
    // Titulo continental na temporada anterior garante a PRINCIPAL (Libertadores/
    // Champions) independentemente da posicao na liga — campeao da Sul-Americana
    // sobe para a Libertadores, campeao da Europa League para a Champions.
    if (continentalBerth === "primary") chosen = continentals[0]
    else if (rank >= 0 && rank < 4) chosen = continentals[0]
    else if (rank >= 0 && rank < 10) chosen = continentals[1] ?? continentals[0]
    else if (continentals.length >= 3) chosen = continentals[2]
    // Times de elite (prestigio alto) garantem ao menos a continental secundaria
    if (!chosen && userTeam.prestigio >= 75) chosen = continentals[continentals.length - 1]
    if (chosen) {
      const matchCount = chosen.prestige >= 90 ? 8 : 6
      plans.push({ competition: chosen, competitionType: "continental", matchCount })
    }
  }

  // O tamanho de cada campanha vem do REGULAMENTO, nao mais de um numero fixo
  // (5 para copa nacional, 6/8 para continental). E o caminho ate a final: as
  // semanas ficam reservadas mesmo que o clube caia antes.
  return plans.map(plan => ({ ...plan, matchCount: tamanhoDoCaminho(userTeam, plan) }))
}

// Conta deterministicamente quantos jogos de copa/continental o usuario tem na temporada
function getUserCupMatchCount(userTeamShort: string, superCups: readonly SuperCupBerth[] = []): number {
  const userTeam = getTeamByShort(userTeamShort)
  if (!userTeam) return 0
  return getUserCupPlan(userTeam, superCups).reduce((sum, p) => sum + p.matchCount, 0)
}

/** Partidas do caminho COMPLETO (ate a final) — e o que reserva as semanas. */
export function tamanhoDoCaminho(userTeam: Team, plan: CupCompetitionPlan): number {
  const entraTarde = TOP_FLIGHT_DIVISIONS.has(String(userTeam.divisao))
  return caminhoDaCopa(plan.competition.id, plan.competition.name, plan.competitionType, entraTarde)
    .reduce((soma, etapa) => soma + etapa.jogos, 0)
}

// Monta o pool de adversarios para uma competicao
export function getOpponentPool(userTeam: Team, plan: CupCompetitionPlan): Team[] {
  const userShort = userTeam.curto
  // Copa regional: só clubes das UFs elegíveis. Sem este filtro a Copa do
  // Nordeste sortearia adversário paulista.
  if (plan.opponentStates?.length) {
    const seen = new Set<string>()
    return [...allBrazilianTeams, ...allPoolTeams]
      .filter(t => t.curto !== userShort && t.estado && plan.opponentStates!.includes(t.estado))
      .filter(team => {
        const key = (team.file_key || team.curto).trim().toLocaleLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
  }
  if (plan.competitionType === "cup") {
    // Copa nacional: todas as divisoes do MESMO pais. O código antigo usava somente
    // a liga atual; como os 19 rivais já estavam marcados como usados, o sorteio
    // liberava esses clubes novamente e criava um 3º/4º confronto na temporada.
    const country = normalizeCompetitionClub(userTeam.pais ?? "")
    const nationalPool = allPoolTeams.filter(t =>
      t.curto !== userShort && country.length > 0 && normalizeCompetitionClub(t.pais ?? "") === country,
    )
    const fallback = isBrazilianDivision(userTeam.divisao)
      ? allBrazilianTeams.filter(t => t.curto !== userShort)
      : getTeamsByDivision(userTeam.divisao).filter(t => t.curto !== userShort)
    const source = nationalPool.length >= 4 ? nationalPool : fallback
    const seen = new Set<string>()
    return source.filter(team => {
      const key = team.curto.trim().toLocaleLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
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
  /** Fase do regulamento — e o que o calendario destaca. */
  stage: FaseCopa
}

/**
 * Partidas do usuario na copa, FASE A FASE e com eliminacao.
 *
 * Devolve uma posicao por partida do caminho maximo (ate a final). `null` marca
 * a partida que NAO acontece porque o clube ja foi eliminado. Devolver o vetor
 * do mesmo tamanho sempre e proposital: as semanas da temporada sao distribuidas
 * a partir dele, e encolher o vetor no meio da campanha deslocaria todas as
 * rodadas de liga seguintes, fazendo o calendario pular partidas ja agendadas.
 * Sem confronto, a semana simplesmente fica livre — o clube esta fora da copa.
 */
export function generateUserCupMatches(
  userTeam: Team,
  plan: CupCompetitionPlan,
  season: number,
  usedOpponents = new Set<string>(),
  resultados: readonly MatchResult[] = [],
): Array<CupMatchDescriptor | null> {
  const pool = getOpponentPool(userTeam, plan)
  if (pool.length === 0) return []

  const entraTarde = TOP_FLIGHT_DIVISIONS.has(String(userTeam.divisao))
  const etapas = caminhoDaCopa(plan.competition.id, plan.competition.name, plan.competitionType, entraTarde)

  // Placares do usuario NESTA copa, em ordem de disputa.
  const placares: PlacarDaCopa[] = resultados
    .filter(r => r.season === season && r.competition === plan.competition.name
      && (r.homeTeam === userTeam.curto || r.awayTeam === userTeam.curto))
    .sort((a, b) => a.week - b.week)
    .map(r => r.homeTeam === userTeam.curto
      ? { golsPro: r.homeScore, golsContra: r.awayScore }
      : { golsPro: r.awayScore, golsContra: r.homeScore })

  // Adversario fica mais forte a cada fase: quem chega a semifinal nao pega o
  // lanterna da segunda divisao.
  const porForca = [...pool].sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0))
  const escolher = (indiceDaEtapa: number, quantos: number, semente: string): Team[] => {
    const rng = seededRandom(semente)
    const fatia = Math.max(1, Math.floor(porForca.length / Math.max(1, etapas.length)))
    // Ultimas fases sorteiam do topo da lista; as primeiras, do fundo.
    const restantes = etapas.length - indiceDaEtapa
    const inicio = Math.min(porForca.length - 1, Math.max(0, (restantes - 1) * fatia))
    const janela = porForca.slice(inicio, inicio + Math.max(fatia, quantos * 3))
    const candidatos = (janela.length >= quantos ? janela : porForca)
      .filter(t => !usedOpponents.has(t.curto))
    const base = candidatos.length >= quantos ? candidatos : porForca
    const saida: Team[] = []
    const vistos = new Set<string>()
    while (saida.length < quantos && vistos.size < base.length) {
      const t = base[Math.floor(rng() * base.length)]
      if (!t || vistos.has(t.curto)) { vistos.add(t?.curto ?? String(vistos.size)); continue }
      vistos.add(t.curto)
      usedOpponents.add(t.curto)
      saida.push(t)
    }
    return saida
  }

  const partidas: Array<CupMatchDescriptor | null> = []
  let consumidos = 0
  let eliminado = false
  // A fase seguinte so aparece depois que a atual termina. Sem isto o calendario
  // ja mostrava a FINAL da Copa do Brasil antes de o clube passar pelas oitavas.
  let aguardando = false

  for (const [indice, etapa] of etapas.entries()) {
    const semente = `${userTeam.curto}:${plan.competition.id}:${season}:${etapa.stage}`

    if (eliminado || aguardando) {
      for (let i = 0; i < etapa.jogos; i++) partidas.push(null)
      continue
    }

    if (etapa.tipo === "grupo") {
      const rivais = escolher(indice, 3, semente)
      if (rivais.length < 3) { for (let i = 0; i < etapa.jogos; i++) partidas.push(null); continue }
      // Turno e returno contra os tres do grupo.
      for (let i = 0; i < etapa.jogos; i++) {
        const rival = rivais[i % rivais.length]
        const emCasa = i < rivais.length
        partidas.push({
          competition: plan.competition.name,
          competitionType: plan.competitionType,
          homeTeam: emCasa ? userTeam : rival,
          awayTeam: emCasa ? rival : userTeam,
          stage: etapa.stage,
        })
      }
      const passou = passouNoGrupo(placares.slice(consumidos, consumidos + etapa.jogos), etapa.jogos, rivais, userTeam.prestigio ?? 60, semente)
      consumidos += etapa.jogos
      if (passou === false) eliminado = true
      else if (passou === null) aguardando = true
      continue
    }

    const [rival] = escolher(indice, 1, semente)
    if (!rival) { for (let i = 0; i < etapa.jogos; i++) partidas.push(null); continue }
    for (let i = 0; i < etapa.jogos; i++) {
      // Ida fora, volta em casa — quem tem melhor campanha decide em casa.
      const emCasa = etapa.jogos === 1 ? (userTeam.prestigio ?? 0) >= (rival.prestigio ?? 0) : i === 1
      partidas.push({
        competition: plan.competition.name,
        competitionType: plan.competitionType,
        homeTeam: emCasa ? userTeam : rival,
        awayTeam: emCasa ? rival : userTeam,
        stage: etapa.stage,
      })
    }
    const passou = passouNoConfronto(placares.slice(consumidos, consumidos + etapa.jogos), etapa.jogos, semente)
    consumidos += etapa.jogos
    if (passou === false) eliminado = true
    else if (passou === null) aguardando = true   // confronto em aberto: para por aqui
  }

  return partidas
}

// Decompoe um conjunto de confrontos em rodadas onde todo mundo joga uma vez.
// Backtracking: escolhe o primeiro time sem adversario e testa cada aresta livre.
function dividirEmRodadas(teams: Team[], arestas: Array<[Team, Team]>, roundCount: number): Array<Array<[Team, Team]>> {
  const rounds: Array<Array<[Team, Team]>> = []
  let restantes = arestas
  const chave = (a: Team, b: Team) => [a.curto, b.curto].sort().join(":")

  for (let round = 0; round < roundCount; round++) {
    const disponiveis = restantes
    const buscar = (semAdversario: Team[], escolhidas: Array<[Team, Team]>): Array<[Team, Team]> | null => {
      if (!semAdversario.length) return escolhidas
      const casa = semAdversario[0]
      for (const par of disponiveis) {
        const [a, b] = par
        const ehDele = a.curto === casa.curto || b.curto === casa.curto
        if (!ehDele) continue
        const fora = a.curto === casa.curto ? b : a
        if (!semAdversario.some(t => t.curto === fora.curto)) continue
        if (escolhidas.some(([x, y]) => chave(x, y) === chave(a, b))) continue
        const r = buscar(semAdversario.filter(t => t.curto !== casa.curto && t.curto !== fora.curto), [...escolhidas, par])
        if (r) return r
      }
      return null
    }
    const rodada = buscar(teams, [])
    if (!rodada) return []   // deu no que nao dava: quem chama volta ao sorteio simples
    rounds.push(rodada.map(par => [par[0], par[1]] as [Team, Team]))
    const usadas = new Set(rodada.map(([a, b]) => chave(a, b)))
    restantes = restantes.filter(([a, b]) => !usadas.has(chave(a, b)))
  }
  return equilibrarMando(rounds)
}

/**
 * Distribui o mando de campo. Sem isto o alternar ingenuo por indice de rodada
 * deixava clube com 7 jogos em casa e outro com 1 — o regulamento prevê metade
 * e metade. Passa varias vezes invertendo o confronto sempre que o mandante ja
 * tem mais jogos em casa do que o visitante.
 */
function equilibrarMando(rounds: Array<Array<[Team, Team]>>): Array<Array<[Team, Team]>> {
  const emCasa = new Map<string, number>()
  for (const rodada of rounds) for (const [casa] of rodada) emCasa.set(casa.curto, (emCasa.get(casa.curto) ?? 0) + 1)
  const conta = (t: Team) => emCasa.get(t.curto) ?? 0

  for (let passo = 0; passo < 12; passo++) {
    let mudou = false
    for (const rodada of rounds) {
      for (let i = 0; i < rodada.length; i++) {
        const [casa, fora] = rodada[i]
        if (conta(casa) - conta(fora) < 2) continue
        rodada[i] = [fora, casa]
        emCasa.set(casa.curto, conta(casa) - 1)
        emCasa.set(fora.curto, conta(fora) + 1)
        mudou = true
      }
    }
    if (!mudou) break
  }
  return rounds
}

/**
 * Formato de POTES (Paulistao 2026, inspirado na Champions): 4 potes de 4, cada
 * clube enfrenta os 3 do proprio pote e mais 5 de fora, em turno unico.
 *
 * Os 5 cruzados nao dividem por igual entre os 3 outros potes, entao a distribuicao
 * e 2+2+1, rotacionada para que os dois lados de cada par de potes fechem a conta.
 * Devolve [] se os nomes do regulamento nao casarem com os times em jogo — quem
 * chama entao cai no sorteio simples, que e melhor do que um calendario torto.
 */
function generatePotRounds(
  teams: Team[],
  pots: readonly (readonly string[])[],
  roundCount: number,
): Array<Array<[Team, Team]>> {
  if (pots.length !== 4 || teams.length !== 16) return []
  const doPote = new Map<string, number>()
  for (const [indice, pote] of pots.entries()) {
    for (const nome of pote) {
      const alvo = normalizeCompetitionClub(nome)
      const time = teams.find(t => {
        const n = normalizeCompetitionClub(t.nome)
        return n === alvo || n.includes(alvo) || alvo.includes(n)
      })
      if (!time || doPote.has(time.curto)) return []
      doPote.set(time.curto, indice)
    }
  }
  if (doPote.size !== 16) return []

  const porPote = Array.from({ length: 4 }, (_, p) => teams.filter(t => doPote.get(t.curto) === p))
  if (porPote.some(p => p.length !== 4)) return []

  const arestas: Array<[Team, Team]> = []
  // Dentro do pote: todos contra todos (3 jogos para cada um).
  for (const pote of porPote) {
    for (let i = 0; i < pote.length; i++) for (let j = i + 1; j < pote.length; j++) arestas.push([pote[i], pote[j]])
  }
  // Entre potes: 2 jogos nos pares "fortes" e 1 no par restante, somando 5 por clube.
  const doisJogos: Array<[number, number]> = [[0, 1], [0, 2], [1, 3], [2, 3]]
  const umJogo: Array<[number, number]> = [[0, 3], [1, 2]]
  for (const [p, q] of doisJogos) {
    for (let i = 0; i < 4; i++) for (const desloc of [0, 1]) arestas.push([porPote[p][i], porPote[q][(i + desloc) % 4]])
  }
  for (const [p, q] of umJogo) {
    for (let i = 0; i < 4; i++) arestas.push([porPote[p][i], porPote[q][i]])
  }

  return dividirEmRodadas(teams, arestas, roundCount)
}

// Gera fixtures do campeonato estadual (Jan-Mar)
function generateCrossGroupRounds(teams: Team[], groupCount: number, roundCount: number): Array<Array<[Team, Team]>> {
  if (groupCount < 2 || teams.length % groupCount !== 0) return []
  // Distribuição determinística em potes: evita que a composição mude ao recarregar.
  const groups = Array.from({ length: groupCount }, () => [] as Team[])
  teams.forEach((team, index) => groups[index % groupCount].push(team))
  const groupOf = new Map(groups.flatMap((group, groupIndex) => group.map(team => [team.curto, groupIndex] as const)))
  let remaining = teams.flatMap((home, i) => teams.slice(i + 1)
    .filter(away => groupOf.get(home.curto) !== groupOf.get(away.curto))
    .map(away => [home, away] as [Team, Team]))
  const rounds: Array<Array<[Team, Team]>> = []

  const findPerfectRound = (available: Array<[Team, Team]>): Array<[Team, Team]> | null => {
    const search = (unmatched: Team[], chosen: Array<[Team, Team]>): Array<[Team, Team]> | null => {
      if (!unmatched.length) return chosen
      const home = unmatched[0]
      const opponents = available.filter(([a, b]) => (a.curto === home.curto && unmatched.some(t => t.curto === b.curto)) || (b.curto === home.curto && unmatched.some(t => t.curto === a.curto)))
      for (const edge of opponents) {
        const away = edge[0].curto === home.curto ? edge[1] : edge[0]
        const result = search(unmatched.filter(team => team.curto !== home.curto && team.curto !== away.curto), [...chosen, [home, away]])
        if (result) return result
      }
      return null
    }
    return search(teams, [])
  }

  for (let round = 0; round < roundCount; round++) {
    const matches = findPerfectRound(remaining)
    if (!matches) return []
    rounds.push(matches.map(([home, away], index) => (round + index) % 2 ? [away, home] : [home, away]))
    const used = new Set(matches.map(([a, b]) => [a.curto, b.curto].sort().join(":")))
    remaining = remaining.filter(([a, b]) => !used.has([a.curto, b.curto].sort().join(":")))
  }
  return rounds
}

export function generateStateChampionshipFixtures(
  stateTeams: Team[],
  userTeamShort: string,
  competition: string,
  knownResults: MatchResult[] = [],
  season = 2026,
): Fixture[] {
  const fixtures: Fixture[] = []
  let fixtureId = 10000
  const officialRounds = getStateCompetitionRule(userTeamShort)?.firstPhaseRounds
  // Nunca solicita mais rodadas do que um ciclo round-robin comporta. Quando a
  // base antiga tem menos participantes do que o regulamento, repetir o array de
  // confrontos seria pior do que encerrar a fase disponível sem duplicatas.
  const roundRobinRounds = getRoundRobinHalfRounds(stateTeams.length)
  const halfSeason = officialRounds ? Math.min(officialRounds, roundRobinRounds) : roundRobinRounds
  const isDouble = officialRounds ? false : stateChampIsDoubleRound(stateTeams.length)
  const totalRounds = isDouble ? halfSeason * 2 : halfSeason

  const regulation = getStateCompetitionRule(userTeamShort)
  // Formato de GRUPOS/POTES exige clubes suficientes. O Amazonense preve 2 grupos
  // mas o AM tem 5 clubes na base: dividir 5 em 2 grupos gerava pareamento
  // invalido e o clube chegava a enfrentar A SI MESMO. Sem gente para o formato
  // oficial, cai no returno simples — melhor um formato mais simples do que uma
  // tabela quebrada.
  const grupos = regulation?.groups ?? 0
  const cabeNosGrupos = grupos > 0 && stateTeams.length >= grupos * 3
  const cabemOsPotes = Boolean(regulation?.pots) && stateTeams.length >= (regulation?.pots?.length ?? 0) * 2
  const crossGroupRounds = cabemOsPotes && regulation?.pots
    ? generatePotRounds(stateTeams, regulation.pots, halfSeason)
    : cabeNosGrupos ? generateCrossGroupRounds(stateTeams, grupos, halfSeason) : []
  for (let round = 1; round <= halfSeason; round++) {
    const matchups = crossGroupRounds[round - 1] ?? generateRoundMatchups(stateTeams, round)
    matchups.forEach(([home, away]) => {
      // Blindagem final: nenhum confronto pode ter o mesmo clube dos dois lados.
      if (!home || !away || home.curto === away.curto) return
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
        stage: "fase_classificatoria",
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
          stage: "fase_classificatoria",
        })
      })
    }
  }

  // As versões anteriores terminavam o estadual na fase classificatória. A liga
  // nacional era liberada sem quartas/semifinais/final e, portanto, nunca existia
  // campeão estadual no calendário oficial da carreira. A partir daqui as fases
  // finais são parte do mesmo calendário e usam os resultados já persistidos para
  // recalcular classificados e vencedores sem um segundo estado paralelo.
  const rule = getStateCompetitionRule(userTeamShort)
  if (!rule?.knockout?.length) return fixtures

  const teamByShort = new Map(stateTeams.map(team => [team.curto, team]))
  const prestige = (short: string) => teamByShort.get(short)?.prestigio ?? 0
  const hydratedRegular = reconcilePlayedFixtures(fixtures, knownResults, season)
  const rowByShort = new Map(computeStandingsFromFixtures(hydratedRegular, competition).map(row => [row.teamShort, row]))
  const compareShort = (a: string, b: string) => {
    const x = rowByShort.get(a)
    const y = rowByShort.get(b)
    if (x && y) {
      const diff = y.points - x.points ||
        (y.goalsFor - y.goalsAgainst) - (x.goalsFor - x.goalsAgainst) ||
        y.goalsFor - x.goalsFor
      if (diff) return diff
    }
    return prestige(b) - prestige(a) || a.localeCompare(b)
  }

  const groupIndex = new Map(stateTeams.map((team, index) => [team.curto, rule.groups ? index % rule.groups : 0]))
  const qualify = (count: number): string[] => {
    if (!rule.groups) return stateTeams.map(team => team.curto).sort(compareShort).slice(0, count)
    const groups = Array.from({ length: rule.groups }, (_, index) =>
      stateTeams.filter(team => groupIndex.get(team.curto) === index).map(team => team.curto).sort(compareShort),
    )
    if (rule.groups === 3 && count === 4) {
      const leaders = groups.map(group => group[0]).filter(Boolean)
      const bestRunnerUp = groups.flatMap(group => group.slice(1)).sort(compareShort)[0]
      return [...leaders, ...(bestRunnerUp ? [bestRunnerUp] : [])].sort(compareShort)
    }
    const perGroup = Math.max(1, Math.floor(count / rule.groups))
    return groups.flatMap(group => group.slice(0, perGroup)).sort(compareShort).slice(0, count)
  }

  let nextWeek = totalRounds + 1
  const addPairStage = (stage: string, entrants: string[], legs: number): Fixture[] => {
    const created: Fixture[] = []
    const pairs: Array<[string, string]> = []
    // Math.FLOOR e o par (a, b) tem de ser distinto. Com numero IMPAR de
    // classificados (estadual pequeno, ex.: Amazonense com 5 clubes na base),
    // `i < length/2` chegava ao meio e casava entrants[2] com entrants[2] — o
    // clube enfrentava A SI MESMO. O do meio agora passa direto (bye).
    for (let i = 0; i < Math.floor(entrants.length / 2); i++) {
      const casa = entrants[i], fora = entrants[entrants.length - 1 - i]
      if (casa && fora && casa !== fora) pairs.push([casa, fora])
    }
    for (let leg = 0; leg < legs; leg++) {
      for (const [seededHome, seededAway] of pairs) {
        const first = teamByShort.get(leg % 2 === 0 ? seededHome : seededAway)
        const second = teamByShort.get(leg % 2 === 0 ? seededAway : seededHome)
        if (!first || !second) continue
        created.push({
          id: fixtureId++, round: nextWeek, week: nextWeek,
          homeTeam: first, awayTeam: second, competition,
          played: false,
          isUserMatch: first.curto === userTeamShort || second.curto === userTeamShort,
          month: Math.min(4, Math.floor((nextWeek - 1) / 4)),
          competitionType: "state", stage,
        })
      }
      nextWeek++
    }
    fixtures.push(...created)
    return created
  }

  const winners = (entrants: string[], stageFixtures: Fixture[]): string[] => {
    const hydrated = reconcilePlayedFixtures(stageFixtures, knownResults, season)
    const output: string[] = []
    for (let i = 0; i < entrants.length / 2; i++) {
      const a = entrants[i]
      const b = entrants[entrants.length - 1 - i]
      let goalsA = 0
      let goalsB = 0
      let complete = false
      for (const match of hydrated.filter(item =>
        (item.homeTeam.curto === a && item.awayTeam.curto === b) ||
        (item.homeTeam.curto === b && item.awayTeam.curto === a),
      )) {
        if (!match.played || match.homeScore === undefined || match.awayScore === undefined) continue
        complete = true
        if (match.homeTeam.curto === a) { goalsA += match.homeScore; goalsB += match.awayScore }
        else { goalsA += match.awayScore; goalsB += match.homeScore }
      }
      output.push(complete && goalsA !== goalsB ? (goalsA > goalsB ? a : b) : [a, b].sort(compareShort)[0])
    }
    return output.sort(compareShort)
  }

  /**
   * A fase so esta decidida quando TODOS os confrontos dela foram disputados.
   * Sem isto o calendario montava quartas, semifinal e final de uma vez — e como
   * `winners()` chuta um vencedor quando o confronto ainda nao aconteceu, a
   * final aparecia com finalista definido antes de a semi ser jogada.
   */
  const faseDecidida = (stageFixtures: Fixture[]): boolean => {
    if (!stageFixtures.length) return false
    const hidratada = reconcilePlayedFixtures(stageFixtures, knownResults, season)
    return hidratada.every(m => m.played && m.homeScore !== undefined && m.awayScore !== undefined)
  }

  let entrants: string[] = []
  for (const stage of rule.knockout) {
    if (stage === "segunda_fase") {
      entrants = qualify(8)
      const groups = [
        [entrants[0], entrants[2], entrants[5], entrants[7]],
        [entrants[1], entrants[3], entrants[4], entrants[6]],
      ].map(group => group.filter(Boolean))
      const secondPhaseFixtures: Fixture[] = []
      for (let round = 1; round <= 6; round++) {
        for (const group of groups) {
          const teams = group.map(short => teamByShort.get(short)).filter((team): team is Team => Boolean(team))
          for (const [home, away] of generateRoundMatchups(teams, round)) {
            secondPhaseFixtures.push({
              id: fixtureId++, round: nextWeek, week: nextWeek, homeTeam: home, awayTeam: away,
              competition, played: false,
              isUserMatch: home.curto === userTeamShort || away.curto === userTeamShort,
              month: Math.min(4, Math.floor((nextWeek - 1) / 4)), competitionType: "state", stage,
            })
          }
        }
        nextWeek++
      }
      fixtures.push(...secondPhaseFixtures)
      if (!faseDecidida(secondPhaseFixtures)) break
      const hydrated = reconcilePlayedFixtures(secondPhaseFixtures, knownResults, season)
      entrants = groups.flatMap(group => {
        const mini = computeStandingsFromFixtures(hydrated, competition)
          .filter(row => group.includes(row.teamShort))
          .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || compareShort(a.teamShort, b.teamShort))
        return (mini.length ? mini.map(row => row.teamShort) : group.sort(compareShort)).slice(0, 2)
      }).sort(compareShort)
      continue
    }

    const required = stage === "quartas" ? 8 : stage === "semifinal" ? 4 : 2
    if (!entrants.length || entrants.length !== required) entrants = qualify(required)
    const legs = rule.stageRounds?.[stage] ?? rule.knockoutLegs?.[stage] ?? (stage === "final" ? rule.finalLegs : 1) ?? 1
    const stageFixtures = addPairStage(stage, entrants, legs)
    // A proxima fase so entra no calendario depois que esta terminar. E assim
    // que o jogador ve a semifinal sem ja ter a final marcada ao lado.
    if (!faseDecidida(stageFixtures)) break
    entrants = winners(entrants, stageFixtures)
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
  if (!hasUser) return [userTeam, ...divisionTeams.slice(0, Math.max(3, Math.ceil(getLeagueRounds(division) / 2)) - 1)]
  return divisionTeams
}

export function getLeagueName(teamShort: string, divisionOverride?: string): string {
  const userTeam = getTeamByShort(teamShort)
  if (!userTeam) return "Liga"
  return LEAGUE_NAMES[divisionOverride ?? userTeam.divisao] ?? "Liga"
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
  stage?: string
  /**
   * Jogo de MEIO DE SEMANA: divide a semana com a rodada de liga, como no
   * futebol de verdade. Sem isto cada partida de copa consumia uma semana
   * inteira e a temporada 2026 do Flamengo terminava em maio de 2027.
   */
  midweek?: boolean
}

export interface SeasonCalendar {
  fixtures: Fixture[]
  currentRound: number
  nextUserMatch: Fixture | null
  previousUserMatch: Fixture | null
}

/** Chave persistente e determinística de uma partida. O ID sozinho não basta,
 * pois estadual, liga e copa usam faixas próprias que podem mudar em saves antigos. */
export function getCalendarFixtureKey(fixture: Fixture, season: number): string {
  return [
    season,
    fixture.competitionType,
    fixture.competition,
    fixture.week,
    fixture.id,
    fixture.homeTeam.curto,
    fixture.awayTeam.curto,
  ].join("::")
}

/** Aplica resultados ao calendário em relação 1:1. O `find` antigo reutilizava o
 * mesmo placar em toda fixture com os mesmos clubes/competição. */
export function reconcilePlayedFixtures(
  fixtures: Fixture[],
  results: MatchResult[],
  season: number,
  completedFixtureKeys: readonly string[] = [],
): Fixture[] {
  const completed = new Set(completedFixtureKeys)
  const seasonResults = results.filter(result => result.season === season)
  const consumedResults = new Set<number>()

  return fixtures.map(fixture => {
    const key = getCalendarFixtureKey(fixture, season)
    let resultIndex = seasonResults.findIndex((result, index) =>
      !consumedResults.has(index) && result.fixtureKey === key,
    )

    // Compatibilidade com saves antigos e também com calendários regenerados por
    // uma correção de regulamento. Nesses casos o resultado pode ter fixtureKey,
    // porém a chave contém semana/ID do calendário anterior. O pareamento continua
    // seguro porque é direcional, inclui competição e consome cada resultado uma vez.
    if (resultIndex < 0) {
      const compatible = (result: MatchResult, index: number) =>
        !consumedResults.has(index) &&
        result.homeTeam === fixture.homeTeam.curto &&
        result.awayTeam === fixture.awayTeam.curto &&
        result.competition === fixture.competition
      resultIndex = seasonResults.findIndex((result, index) => compatible(result, index) && result.week === fixture.week)
      if (resultIndex < 0) resultIndex = seasonResults.findIndex(compatible)
    }

    if (resultIndex >= 0) consumedResults.add(resultIndex)
    const result = resultIndex >= 0 ? seasonResults[resultIndex] : undefined
    if (!completed.has(key) && !result) return fixture
    return {
      ...fixture,
      played: true,
      homeScore: result?.homeScore ?? fixture.homeScore,
      awayScore: result?.awayScore ?? fixture.awayScore,
    }
  })
}

// Gera confrontos da liga (todos contra todos, turno e returno) — dinamico por qtd de times
// weekOffset: deslocamento de semanas para colocar a liga apos o estadual (para times brasileiros)
export function generateBrasileirao(teams: Team[], userTeamShort: string, competition: string, division: string, weekOffset = 0): Fixture[] {
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
  const homePlayers = getPlayersForTeam(homeTeam)
  const awayPlayers = getPlayersForTeam(awayTeam)
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
  const { state: saveState, setState: setSaveState, replaceState: replaceSaveState, hydrated } = useGameState()
  const gameEngine = useGameEngine()
  const [engineHydrated, setEngineHydrated] = useState(() => useGameEngine.persist.hasHydrated())

  // Refs always pointing at latest values — prevents stale closures in callbacks called in loops
  const saveStateRef = useRef(saveState)
  saveStateRef.current = saveState
  const seasonCalendarRef = useRef<SeasonCalendar>({ fixtures: [], currentRound: 1, nextUserMatch: null, previousUserMatch: null })
  const lastCompletedFixtureWeekRef = useRef<number | null>(null)
  // Ref para não entrar nas deps do advanceWeek (o provider recria addNotification
  // a cada render e isso invalidaria o callback a cada ciclo).
  const { addNotification } = useNotifications()
  const addNotificationRef = useRef(addNotification)
  addNotificationRef.current = addNotification

  useEffect(() => {
    setEngineHydrated(useGameEngine.persist.hasHydrated())
    const unsub = useGameEngine.persist.onFinishHydration(() => {
      setEngineHydrated(true)
    })
    return unsub
  }, [])

  // MIGRACAO de save antigo para o relogio ABSOLUTO de contrato. Ate a 1.0.136 o
  // endDate era comparado com a semana da temporada (que zera todo ano) e nenhum
  // contrato vencia. Sem esta migracao, um save em andamento veria o elenco
  // inteiro como "vencido" de uma vez ao abrir a versao corrigida.
  useEffect(() => {
    if (!hydrated || !engineHydrated) return
    if (!saveState.selectedTeamShort) return
    gameEngine.migrarContratosParaSemanaAbsoluta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, engineHydrated, saveState.selectedTeamShort])

  // Auto-reinit: engine resetou (versão nova) mas save tem time selecionado
  useEffect(() => {
    if (!hydrated) return
    if (!engineHydrated) return
    if (!saveState.selectedTeamShort) return
    // Reinit se standings ou squad estiverem vazios (initialPlayers tem 1 jogador default)
    if (gameEngine.squadPlayers.length > 1 && gameEngine.serieAStandings.length > 0) return
    const teamShort = saveState.selectedTeamShort
    setClubDivisions(saveState.clubDivisions) // piramide viva antes de montar a liga
    const leagueTeams = getUserLeagueTeams(teamShort, saveState.divisionOverride)
    gameEngine.initializeGame(teamShort)
    useGameEngine.setState({
      serieAStandings: initializeStandings(leagueTeams),
      currentWeek: saveState.week,
      currentSeason: saveState.season,
    })
  }, [hydrated, engineHydrated, saveState.selectedTeamShort, saveState.week, saveState.season, gameEngine.squadPlayers.length, gameEngine.serieAStandings.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Inicializa o jogo quando o usuario seleciona um time
  const initializeNewGame = useCallback((teamShort: string, managerName?: string, initialCareerState: Partial<GameState> = {}) => {
    // Define a identidade ANTES de inicializar o Zustand. Assim o elenco/tatica
    // nasce no arquivo da nova carreira, nunca no slot que estava ativo antes.
    const careerId = createCareerId()
    setActiveCareerId(careerId)
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

    // Nova carreira e uma SUBSTITUICAO, nao merge. O merge antigo mantinha squadPlayers,
    // selectedTeam e outros campos opcionais do primeiro save.
    clearJobOffers()
    if (typeof window !== "undefined") {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("ultrafoot-competitions:")) localStorage.removeItem(key)
      }
    }
    replaceSaveState(createFreshCareerState(saveState, {
      careerId,
      saveName: `Carreira de ${(managerName?.trim() || "Tecnico")} - ${userTeam?.nome || teamShort}`,
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...initialCareerState,
    }))
  }, [gameEngine, replaceSaveState, saveState.language, saveState.controllerType, saveState.controllerBindings, saveState.commentaryEnabled, saveState.commentaryVoice, saveState.commentaryVolume, saveState.autoSaveInterval])
  
  // Calendario da temporada — ref is updated after useMemo so advanceWeek loop calls see latest fixtures
  const seasonCalendar = useMemo((): SeasonCalendar => {
    if (!saveState.selectedTeamShort) {
      return { fixtures: [], currentRound: 1, nextUserMatch: null, previousUserMatch: null }
    }

    const userTeamShort = saveState.selectedTeamShort
    const currentWeek = saveState.week
    // PIRAMIDE VIVA: aplica os acessos/rebaixamentos acumulados ANTES de montar a
    // liga, para os rivais desta divisao ja serem os clubes que realmente subiram.
    setClubDivisions(saveState.clubDivisions)
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
        const stateFixtures = generateStateChampionshipFixtures(
          stateTeams,
          userTeamShort,
          stateName,
          gameEngine.matchResults.filter(result => result.season === saveState.season),
          saveState.season,
        )
        stateChampRoundsCount = Math.max(0, ...stateFixtures.map(fixture => fixture.week))
        allFixtures.push(...stateFixtures)
      }
    }

    // Supercopas conquistadas na temporada anterior (Supercopa do Brasil,
    // Recopa, Supercopa da UEFA, Mundial). Vazio quando o clube não foi campeão
    // de nada — a maioria das temporadas.
    const superCupBerths = berthsForSeason(saveState.seasonHistory, userTeamShort, saveState.season)
    // Vaga na continental principal por titulo continental do ano anterior
    // (Sul-Americana -> Libertadores, Europa League -> Champions).
    const continentalBerth = continentalTitleBerth(saveState.seasonHistory, userTeamShort, saveState.season)

    const leagueTeams = getUserLeagueTeams(userTeamShort, saveState.divisionOverride)
    const competition = LEAGUE_NAMES[division] ?? getLeagueName(userTeamShort)
    // Gera a liga com round=1..L (semana sera reatribuida ao intercalar as copas)
    const leagueFixtures = generateBrasileirao(leagueTeams, userTeamShort, competition, division, stateChampRoundsCount)

    // ── Intercala copas nacionais e competicoes continentais ────────────────
    // Cada partida do usuario ocupa uma semana unica (1 jogo por semana). As
    // partidas de copa entram em "meios de semana" distribuidos ao longo da liga.
    const leagueRoundCount = (leagueTeams.length - 1) * 2
    const cupMatches: Array<CupMatchDescriptor | null> = []
    if (userTeam) {
      // Um rival da mesma liga ja aparece em ida e volta. Prioriza adversarios externos
      // nas copas para nao criar o relato confuso de tres jogos contra o mesmo clube.
      const cupOpponents = new Set(leagueTeams.filter(t => t.curto !== userTeam.curto).map(t => t.curto))
      for (const plan of getUserCupPlan(userTeam, superCupBerths, continentalBerth)) {
        cupMatches.push(...generateUserCupMatches(
          userTeam, plan, saveState.season, cupOpponents,
          gameEngine.matchResults.filter(r => r.season === saveState.season),
        ))
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
        // Copa entra no MEIO DA SEMANA da rodada de liga — sem consumir semana
        // propria. `if` e nao `while`: no maximo um jogo de copa por rodada,
        // senao tres partidas do usuario cairiam na mesma semana.
        if (cupIdx < C && r >= Math.round(((cupIdx + 1) * leagueRoundCount) / (C + 1))) {
          const cm = cupMatches[cupIdx]
          // `null` = clube eliminado: a semana existe, o jogo nao.
          if (cm) allFixtures.push({
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
            stage: cm.stage,
            midweek: true,
          })
          cupIdx++
        }
      }
      // Partidas de copa restantes vao para o fim da temporada
      while (cupIdx < C) {
        week++
        const cm = cupMatches[cupIdx]
        if (cm) allFixtures.push({
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
          stage: cm.stage,
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
    allFixtures = reconcilePlayedFixtures(
      allFixtures,
      gameEngine.matchResults,
      seasonNow,
      saveState.completedFixtureKeys ?? [],
    )

    // Encontra rodada atual — total inclui estadual + liga + copas/continentais
    // As copas agora dividem a semana com a liga, entao NAO somam semanas. O que
    // ainda pode alongar a temporada e a sobra que nao coube em nenhuma rodada,
    // e essa ja aparece na maior semana dos fixtures.
    const totalWeeks = Math.max(
      stateChampRoundsCount + (leagueTeams.length - 1) * 2,
      ...allFixtures.map(f => f.week),
    )
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
  }, [saveState.selectedTeamShort, saveState.week, saveState.season, saveState.divisionOverride, saveState.completedFixtureKeys, gameEngine.matchResults])
  
  // Avanca uma semana/rodada
  // Uses refs so sequential calls within a loop always read the latest week (fixes stale closure bug)
  const advanceWeek = useCallback(async () => {
    const currentState = saveStateRef.current
    const currentWeek = currentState.week
    // Se a partida estava numa semana futura (transição estadual -> liga ou copa),
    // avança até a semana REAL dela. Incrementar apenas +1 deixava o calendário e o
    // resultado em linhas de tempo diferentes e podia reapresentar o confronto.
    const newWeek = Math.max(currentWeek + 1, lastCompletedFixtureWeekRef.current ?? currentWeek + 1)
    lastCompletedFixtureWeekRef.current = null

    // Verifica fim de temporada — total inclui estadual + liga + copas/continentais
    const userShort = currentState.selectedTeamShort ?? ""
    const divOverride = currentState.divisionOverride
    setClubDivisions(currentState.clubDivisions) // piramide viva antes de montar ligas
    const leagueTeamsForEnd = getUserLeagueTeams(userShort, divOverride)
    const stateRoundsForEnd = getStateChampRounds(userShort)
    // A temporada de liga jamais pode acabar por ter menos confrontos do que o
    // regulamento cadastrado. Em saves antigos havia bancos parciais e o cálculo
    // por `times.length` podia encerrar uma campanha antes do returno completo.
    const leagueRoundsForEnd = Math.max(
      getLeagueRounds(divOverride ?? getTeamByShort(userShort)?.divisao ?? "serie_a"),
      (leagueTeamsForEnd.length - 1) * 2,
    )
    // Copa em meio de semana nao alonga a temporada; o Math.max abaixo cobre a
    // sobra que porventura tenha ido para o fim.
    const computedSeasonEndWeek = stateRoundsForEnd + leagueRoundsForEnd
    const seasonEndWeek = Math.max(
      computedSeasonEndWeek,
      ...seasonCalendarRef.current.fixtures.map(fixture => fixture.week),
    )

    const leagueUserFixtures = seasonCalendarRef.current.fixtures.filter(
      fixture => fixture.isUserMatch && fixture.competitionType === "league",
    )
    // Quantas partidas de liga a temporada REALMENTE tem, pelo turno-returno dos
    // times inscritos — que é exatamente o que generateSeasonFixtures produz.
    //
    // Antes esta comparação usava `leagueRoundsForEnd`, que embute o valor
    // declarado em LEAGUE_CALENDAR. Quando a constante superava o calendário real
    // a condição ficava impossível e a temporada NUNCA terminava. Auditoria de
    // 2026-07-20 (scripts/audit-competicoes.ts) pegou quatro ligas nesse estado:
    //   Série C (30 partidas x 38 declaradas), Série D (36 x 38),
    //   Scottish Premiership (22 x 38) e Pro League BEL (30 x 34).
    // Quem escolhesse esses clubes ficava presa no fim da temporada para sempre.
    const expectedLeagueFixtures = Math.max(1, (leagueTeamsForEnd.length - 1) * 2)
    const leagueFixturesComplete = leagueUserFixtures.length >= expectedLeagueFixtures &&
      leagueUserFixtures.every(fixture => fixture.played)

    // O clube ainda tem algum compromisso? Cobre liga, estadual, copas e
    // continentais de uma vez.
    //
    // Sem isto a temporada só fechava quando o CONTADOR DE SEMANAS ultrapassava
    // seasonEndWeek, mesmo com o time sem absolutamente nada para jogar: quem
    // caía cedo nas copas terminava a liga e ficava clicando "avançar" em
    // semanas vazias até o contador alcançar um fim de temporada teórico.
    // Agora, acabou a última partida do clube, acabou a temporada.
    const allUserFixtures = seasonCalendarRef.current.fixtures.filter(fixture => fixture.isUserMatch)

    // Mesmo que uma semana tenha sido avançada rapidamente, não permite que o
    // save processe acesso/rebaixamento enquanto a liga do usuário estiver
    // incompleta. Isto impede o caso reportado de rebaixamento após 15 jogos.
    if (isSeasonOver({
      leagueComplete: leagueFixturesComplete,
      currentWeek: newWeek,
      seasonEndWeek,
      userFixtures: allUserFixtures,
    })) {
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

      // PIRAMIDE VIVA: evolui TODOS os clubes de todas as piramides. A divisao do
      // usuario sai da classificacao real; as demais, do prestigio com ruido.
      setClubDivisions(currentState.clubDivisions)
      const staticDiv = new Map(allTeams.map(t => [t.curto, String(t.divisao)]))
      const pyramidClubs: PyramidClub[] = allTeams.map(t => ({
        curto: t.curto,
        division: effectiveDivision(t),
        prestige: t.prestigio ?? 60,
      }))
      const moved = evolvePyramids({
        clubs: pyramidClubs,
        userDivision: currentDivision,
        userFinalOrder: sortedForChampion.map(s => s.teamShort),
        seed: currentState.season,
      })
      // Mapa absoluto atualizado: aplica quem mudou; limpa quem voltou a estatica.
      const nextClubDivisions: Record<string, string> = { ...(currentState.clubDivisions ?? {}) }
      for (const [curto, div] of Object.entries(moved)) {
        if (div === staticDiv.get(curto)) delete nextClubDivisions[curto]
        else nextClubDivisions[curto] = div
      }

      // PREMIACAO DE LIGA (creditada de verdade — antes so aparecia no painel).
      // Campeao leva muito mais; todo mundo leva a cota de participacao. Escala
      // com a divisao (Serie A paga muito mais que a D).
      if (userFinalPos > 0) {
        const premio = leaguePrizeMoney(currentDivision, userFinalPos, sortedForChampion.length)
        if (premio > 0) gameEngine.addClubRevenue(premio)
      }

      // Divisao do usuario na proxima temporada, do MESMO resultado da piramide.
      const userNextDivision = nextClubDivisions[userShort] ?? staticDiv.get(userShort) ?? currentDivision
      let nextDivisionOverride = userNextDivision === userTeamStatic?.divisao ? undefined : userNextDivision
      let divisionMovement = currentState.divisionMovement
      if (userFinalPos > 0 && userNextDivision !== currentDivision) {
        const outcome = resolveDivisionChange(
          currentDivision, userFinalPos, sortedForChampion.length, userTeamStatic?.nome ?? "Seu clube",
        )
        divisionMovement = {
          movement: outcome.movement === "stay"
            ? "promoted" : outcome.movement, // seguranca: mudou de divisao => houve movimento
          message: outcome.message, season: nextSeason,
        }
      }

      // Registro da temporada encerrada.
      //
      // `seasonHistory` era inicializado como [] e NUNCA recebia nada. Tudo que
      // depende dele lia um array vazio para sempre: hall da fama (carreira do
      // técnico), museu do clube, contagem de títulos da bilheteria e os
      // desafios que checam promoção/posição final. A carreira não acumulava
      // história nenhuma entre temporadas.
      const userStanding = sortedForChampion.find(entry => entry.teamShort === userShort)
      const seasonRecord = userStanding && userFinalPos > 0 ? {
        season: currentState.season,
        competition: getLeagueName(userShort, divOverride),
        position: userFinalPos,
        points: userStanding.points,
        won: userStanding.won,
        drawn: userStanding.drawn,
        lost: userStanding.lost,
        goalsFor: userStanding.goalsFor,
        goalsAgainst: userStanding.goalsAgainst,
        champion: champion ?? "",
        managerName: currentState.managerName || "Técnico",
        promoted: divisionMovement?.movement === "promoted" && divisionMovement.season === nextSeason,
        relegated: divisionMovement?.movement === "relegated" && divisionMovement.season === nextSeason,
        teamCurto: userShort,
        teamNome: userTeamStatic?.nome ?? userShort,
      } : null

      // Adversarios da PROXIMA temporada: da divisao ja atualizada E com a
      // piramide nova aplicada (rivais que subiram/cairam ja no lugar certo).
      setClubDivisions(nextClubDivisions)

      // CONTRATO VENCENDO: agora dispara de verdade. Antes o relogio comparava o
      // endDate absoluto com a semana da temporada (que zera), entao nenhum
      // contrato chegava a "expiring" — o aviso nunca saia. Ver absoluteWeek.
      try {
        const elenco = useGameEngine.getState().squadPlayers
        const vencendo = elenco.filter(p => getContractStatus(p, 0, nextSeason) === "expiring")
        const vencidos = elenco.filter(p => getContractStatus(p, 0, nextSeason) === "expired")
        if (vencendo.length > 0 || vencidos.length > 0) {
          const nomes = [...vencidos, ...vencendo].slice(0, 4).map(p => p.name).join(", ")
          addNotificationRef.current({
            type: "system", priority: "high",
            title: vencidos.length > 0
              ? `${vencidos.length} contrato${vencidos.length === 1 ? "" : "s"} vencido${vencidos.length === 1 ? "" : "s"}`
              : `${vencendo.length} contrato${vencendo.length === 1 ? "" : "s"} perto do fim`,
            message: `${nomes}${(vencendo.length + vencidos.length) > 4 ? " e outros" : ""}. Renove antes de perder o atleta de graça.`,
            href: "/contratos",
          })
        }
      } catch { /* aviso e extra */ }

      // MERCADO DO MUNDO: a IA negocia entre si na virada da temporada. Sem isto
      // os elencos adversarios eram os mesmos do seed para sempre. Deterministico
      // pela temporada; conservador (poucos negocios, sempre rumo a clube maior).
      try {
        const noticias = simulateWorldTransferWindow({
          clubes: allTeams.map(t => ({ nome: t.nome, curto: t.curto, prestigio: t.prestigio ?? 60, divisao: String(t.divisao) })),
          squadOf: (curto) => {
            const t = getTeamByShort(curto)
            return t ? getPlayersForTeam(t).map(p => ({ nome: p.nome, pos: String(p.pos), idade: p.idade, base: p.base, nac: p.nac })) : []
          },
          clubeDoUsuario: userShort,
          temporada: currentState.season,
        })
        if (noticias.length > 0) {
          const destaque = noticias.slice(0, 3).map(n => `${n.atleta} (${n.de} → ${n.para})`).join("; ")
          addNotificationRef.current({
            type: "transfer", priority: "medium",
            title: `Mercado movimentado: ${noticias.length} transferências`,
            message: `A janela mexeu com os elencos rivais. Destaques: ${destaque}.`,
            href: "/mercado",
          })
        }
      } catch { /* o mercado do mundo e um extra: nunca derruba a virada de temporada */ }
      const teamsForReset = getUserLeagueTeams(userShort, nextDivisionOverride)
      const newStandings = initializeStandings(teamsForReset)

      // Prêmios individuais — apurados ANTES do processSeasonEnd, que zera as
      // estatísticas da temporada e faz aposentadorias.
      const squadForAwards = useGameEngine.getState().squadPlayers
      const seasonAwards = champion ? calcSeasonAwards(
        currentState.season,
        getLeagueName(userShort, divOverride),
        champion,
        currentState.managerName || "Técnico",
        squadForAwards.map(player => ({
          playerId: player.id,
          playerName: player.name,
          teamShort: userShort,
          position: player.position,
          age: player.age,
          overall: player.overall,
          goals: player.seasonStats?.goals ?? 0,
          assists: player.seasonStats?.assists ?? 0,
          matches: player.seasonStats?.matchesPlayed ?? 0,
          cleanSheets: player.seasonStats?.cleanSheets ?? 0,
        })),
      ) : null

      // Processa fim de temporada: envelhece jogadores, aposentadorias, jovens da base, reseta standings
      gameEngine.processSeasonEnd(nextSeason, newStandings, currentStandings)

      const patch = {
        week: 0, season: nextSeason,
        divisionOverride: nextDivisionOverride,
        clubDivisions: nextClubDivisions,
        divisionMovement,
        completedFixtureKeys: [],
        seasonAwards: seasonAwards
          ? [...(currentState.seasonAwards ?? []), seasonAwards]
          : currentState.seasonAwards,
        seasonHistory: seasonRecord
          ? [...(currentState.seasonHistory ?? []), seasonRecord]
          : currentState.seasonHistory,
      }
      saveStateRef.current = { ...currentState, ...patch }
      setSaveState(patch)

      return { newSeason: true, champion }
    }

    // Simula partidas de outros times desta rodada
    const roundFixtures = seasonCalendarRef.current.fixtures.filter(
      f => f.week > currentWeek && f.week <= newWeek && !f.isUserMatch && !f.played
    )

    // Partidas do USUÁRIO que ficaram para trás.
    //
    // Antes só os adversários eram simulados: uma partida do usuário não
    // disputada permanecia pendente para sempre enquanto o resto da liga seguia.
    // O clube acumulava jogos a menos (relato: 15 partidas contra 38 dos rivais)
    // e era rebaixado por pontos que nunca teve chance de somar. A 1.0.98 tentou
    // conter isso travando o fim de temporada até o usuário completar a liga —
    // o que só trocou o rebaixamento indevido por uma carreira presa em
    // "aguardando sorteio", porque as partidas continuavam sem nunca acontecer.
    //
    // `week < newWeek` (estritamente no passado) é intencional: a partida da
    // semana que está começando ainda é do jogador para disputar; só o que ficou
    // para trás é resolvido automaticamente.
    const overdueUserFixtures = selectOverdueUserFixtures(seasonCalendarRef.current.fixtures, newWeek)

    // Atualiza fixtures no gameState para rastreamento de fim de temporada
    const prevFixtures = (saveStateRef.current as unknown as Record<string, unknown>).fixtures as import("@/lib/career-types").MatchFixture[] | undefined ?? []
    let updatedStateFixtures = [...prevFixtures]

    for (const fixture of roundFixtures) {
      const simulated = simulateMatchResult(
        fixture.homeTeam,
        fixture.awayTeam,
        newWeek,
        currentState.season,
        fixture.competition
      )
      const result: MatchResult = {
        ...simulated,
        fixtureKey: getCalendarFixtureKey(fixture, currentState.season),
        fixtureId: fixture.id,
        week: fixture.week,
      }
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

    // Resolve as partidas do usuário que ficaram para trás, pelo mesmo motor que
    // simula os adversários. Sem isto o clube fica com jogos a menos que o resto
    // da liga e a temporada nunca fecha.
    const autoPlayed: string[] = []
    const completedKeysFromAuto: string[] = []
    for (const fixture of overdueUserFixtures) {
      const simulated = simulateMatchResult(
        fixture.homeTeam,
        fixture.awayTeam,
        fixture.week,
        currentState.season,
        fixture.competition,
      )
      const fixtureKey = getCalendarFixtureKey(fixture, currentState.season)
      // Não reprocessa o que já foi registrado (ex.: partida disputada cujo
      // fixture em memória ainda não recebeu played=true neste tick).
      const already = useGameEngine.getState().matchResults.some(r => r.fixtureKey === fixtureKey)
        || (currentState.completedFixtureKeys ?? []).includes(fixtureKey)
      if (already) continue

      const result: MatchResult = {
        ...simulated,
        fixtureKey,
        fixtureId: fixture.id,
        week: fixture.week,
      }
      if (fixture.competitionType === "league") {
        gameEngine.updateStandings(result)
      } else {
        gameEngine.addMatchResultOnly(result)
      }
      completedKeysFromAuto.push(fixtureKey)
      // Partida do usuario SIMULADA (nao jogada ao vivo): rola a chance de lesao
      // no elenco, para uma temporada simulada nao sair sem nenhuma lesao.
      gameEngine.rolarLesaoSimulada(1)
      // E acumula as estatisticas da temporada (JOGOS/GOLS/ASSIST/cartoes) no XI
      // titular. Sem isto, simular a carreira deixava o perfil de todos zerado.
      const usuarioEmCasa = fixture.homeTeam.curto === (currentState.selectedTeamShort ?? "")
      gameEngine.acumularEstatisticasSimuladas(
        usuarioEmCasa ? result.homeScore : result.awayScore,
        usuarioEmCasa ? result.awayScore : result.homeScore,
      )

      const idx = updatedStateFixtures.findIndex(
        f => f.isUserMatch && !f.played && f.round === (fixture.round ?? fixture.week)
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

      const userIsHome = fixture.homeTeam.curto === userShort
      const userGoals = userIsHome ? result.homeScore : result.awayScore
      const rivalGoals = userIsHome ? result.awayScore : result.homeScore
      autoPlayed.push(
        `${fixture.homeTeam.curto} ${result.homeScore}x${result.awayScore} ${fixture.awayTeam.curto}` +
        ` (${userGoals > rivalGoals ? "vitória" : userGoals < rivalGoals ? "derrota" : "empate"})`,
      )
    }

    // Avanca game engine
    gameEngine.advanceWeek()

    // Update ref immediately so the next loop iteration sees the incremented week
    let debt=currentState.debt
    if(debt?.enabled&&newWeek>=debt.nextPaymentWeek){
      const antesMissed=debt.missedPayments
      const payment=processDebtMonth(debt,useGameEngine.getState().balance);gameEngine.payClubDebt(payment.paid);debt=payment.debt
      // CONSEQUENCIA da inadimplencia (antes missedPayments so era contado, nunca
      // usado): a diretoria pressiona, e ao atrasar a 3a parcela o mercado congela.
      if(debt.missedPayments>antesMissed){
        const congelou=debt.missedPayments>=3
        addNotificationRef.current({
          type:"system",priority:"high",
          title:congelou?"Mercado congelado pela dívida":"Parcela da dívida em atraso",
          message:congelou
            ?`A diretoria não conseguiu quitar a parcela (${debt.missedPayments}ª em atraso) e SUSPENDEU as contratações até regularizar as finanças.`
            :`O caixa não cobriu a parcela da dívida deste mês (multa de 2% somada ao saldo devedor). Regularize antes que a diretoria corte o mercado.`,
        })
      }
    }
    if(newWeek%4===0){const sponsorship=(currentState.activeSponsors??[]).reduce((sum,sponsor)=>sum+sponsor.monthlyValue,0);if(sponsorship>0)gameEngine.addClubRevenue(sponsorship);if(currentState.stadiumPitch?.monthlyMaintenance)gameEngine.spendClubFunds(currentState.stadiumPitch.monthlyMaintenance)}
    const scoutingDepartment=currentState.scoutingDepartment?advanceScoutingWeek(currentState.scoutingDepartment,newWeek):undefined
    // As chaves das partidas resolvidas automaticamente entram no save junto com
    // a semana: sem isso elas voltariam a ser candidatas na próxima chamada.
    const completedFixtureKeys = completedKeysFromAuto.length > 0
      ? Array.from(new Set([...(currentState.completedFixtureKeys ?? []), ...completedKeysFromAuto]))
      : currentState.completedFixtureKeys
    saveStateRef.current = { ...currentState, week: newWeek, fixtures: updatedStateFixtures, debt, scoutingDepartment, completedFixtureKeys } as typeof currentState & { fixtures: unknown }
    setSaveState({ week: newWeek, fixtures: updatedStateFixtures, debt, scoutingDepartment, completedFixtureKeys } as Partial<typeof currentState> & { fixtures: unknown })

    // O jogador precisa saber que uma partida dele foi resolvida sem ele.
    if (autoPlayed.length > 0) {
      addNotificationRef.current({
        type: "system",
        title: autoPlayed.length === 1 ? "Partida simulada" : `${autoPlayed.length} partidas simuladas`,
        message: `Você avançou o calendário sem disputar. Resultado: ${autoPlayed.join(" · ")}`,
        priority: "high",
      })
    }

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
          .map((t) => ({ curto: t.curto, nome: t.nome, prestigio: t.prestigio ?? 60, divisao: String(t.divisao) }))

        const ofertas = generateJobOffers(
          confianca,
          posNow,
          teamNow.prestigio ?? 60,
          candidatos,
          {
            allowNationalTeam: true,
            experienceSeasons: Math.max(st.coachLegacy.totalSeasons, Math.max(0, st.season - 2026)),
            careerTitles: st.coachTotalTitles + st.coachLegacy.totalTitles,
            currentWeek: newWeek,
            currentDivision: String(st.divisionOverride ?? teamNow.divisao ?? ""),
          },
        )
        if (ofertas.length) addJobOffers(ofertas, st.season, newWeek)

        // ── DEMISSAO PELA DIRETORIA ──────────────────────────────────────────
        //
        // shouldFireManager (board-engine) existia mas nunca era chamada — por
        // pior que fosse a campanha, o jogo jamais te tirava do clube. Agora a
        // diretoria demite em estado CRITICO (confianca < 25) e, ainda assim,
        // por chance, com mais paciencia no comeco da temporada. Poupamos o
        // comeco absoluto (semana <= 4) para nao demitir antes de o time jogar.
        const progressoTemporada = Math.min(1, newWeek / Math.max(1, seasonEndWeek))
        if (newWeek > 4 && shouldFireManager(confianca, progressoTemporada)) {
          addNotificationRef.current({
            type: "system",
            title: "Você foi demitido",
            message: `A diretoria do ${teamNow.nome} decidiu encerrar seu ciclo após a sequência de resultados. Você está livre no mercado de treinadores.`,
            priority: "high",
          })
          clearJobOffers()
          setSaveState({ selectedTeamShort: null } as Partial<typeof currentState>)
          // Demitido vai para a Area do Treinador, onde as propostas aparecem.
          if (typeof window !== "undefined") hardNavigate("/treinador")
          // Encerra o avanco: sem clube, nao ha ceremonia de campeao a checar.
          return { newSeason: false, simulatedMatches: roundFixtures.length, nextUserMatch: seasonCalendarRef.current.nextUserMatch, leagueChampion: null }
        }
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
    const orderedPending = seasonCalendarRef.current.fixtures
      .filter(fixture => fixture.isUserMatch && !fixture.played)
      .sort((a, b) => a.week - b.week || a.id - b.id)
    /**
     * A qual confronto do calendario este placar pertence.
     *
     * ⚠️ O fallback era `?? nextUserMatch` INCONDICIONAL, e ele atribuia o placar
     * a um jogo entre OUTROS clubes. Relato: o jogador venceu COR 2x0 SAN e o
     * jogo anunciou "PON 1x1 COR simulada" — o resultado tinha sido gravado sob
     * a chave de PON x COR, entao o confronto real nunca foi marcado como
     * disputado e voltou como pendente para o motor resolver sozinho. O clube
     * aparecia duas vezes na mesma rodada.
     *
     * Agora: par exato, depois o mesmo par invertido (mando trocado), e o
     * fallback so vale se envolver OS MESMOS DOIS CLUBES. Sem isso preferimos
     * uma chave avulsa a atribuir o jogo a quem nao o disputou.
     */
    const mesmoConfronto = (f: { homeTeam: { curto: string }; awayTeam: { curto: string } }) => {
      const par = new Set([f.homeTeam.curto, f.awayTeam.curto])
      return par.has(homeTeam) && par.has(awayTeam)
    }
    const fixtureForWeek =
      orderedPending.find(f => f.homeTeam.curto === homeTeam && f.awayTeam.curto === awayTeam)
      ?? orderedPending.find(mesmoConfronto)
      ?? (seasonCalendarRef.current.nextUserMatch && mesmoConfronto(seasonCalendarRef.current.nextUserMatch)
        ? seasonCalendarRef.current.nextUserMatch
        : null)
    const targetWeek = fixtureForWeek?.week ?? currentState.week + 1
    const fixtureKey = fixtureForWeek
      ? getCalendarFixtureKey(fixtureForWeek, currentState.season)
      : `${currentState.season}::legacy::${targetWeek}::${homeTeam}::${awayTeam}`

    // Guard idempotente por fixture. Semana + clubes não diferencia liga/copa e
    // causava tanto duplo registro quanto bloqueio de uma partida válida.
    const alreadyRegistered = useGameEngine.getState().matchResults.some(
      r => r.fixtureKey === fixtureKey || (
        !r.fixtureKey && r.week === targetWeek && r.season === currentState.season &&
        r.homeTeam === homeTeam && r.awayTeam === awayTeam
      ),
    ) || (currentState.completedFixtureKeys ?? []).includes(fixtureKey)
    if (alreadyRegistered) return

    const leagueName = getLeagueName(currentState.selectedTeamShort ?? "", currentState.divisionOverride)
    const stateRounds = getStateChampRounds(currentState.selectedTeamShort ?? "")
    const userTeamForComp = getTeamByShort(currentState.selectedTeamShort ?? "")

    // Usa a fixture corrente (não week+1) para saber a competição exata.
    const competitionType = fixtureForWeek?.competitionType
      ?? (targetWeek > stateRounds ? "league" : "state")
    const isLeagueMatch = competitionType === "league"

    const fallbackName = isLeagueMatch
      ? leagueName
      : (ESTADO_CAMPEONATO[userTeamForComp?.estado ?? ""] ?? leagueName)
    const competitionName = fixtureForWeek?.competition ?? fallbackName

    const result: MatchResult = {
      fixtureKey,
      fixtureId: fixtureForWeek?.id,
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

    // Título de mata-mata (estadual/copa): a cerimônia de campeão só disparava
    // para a LIGA (leagueChampion no fim de temporada). Relato real: ganhou o
    // Gauchão e "nem percebeu". Regra: esta era a ÚLTIMA partida do usuário
    // nessa competição não-liga e ele venceu → campeão. A página /campeao lê
    // "ultrafoot-pending-champion" (contrato já existente).
    // Registro do titulo de copa (continental/nacional/estadual) e premiacao.
    // Antes a cerimonia era so uma tela: o titulo NAO entrava no seasonHistory,
    // entao nao virava trofeu na carreira, nao dava vaga na Recopa/Supercopa nem
    // classificava para a Libertadores/Champions, e nao rendia premio. Tudo isso
    // lia o seasonHistory, que so tinha a liga. Aqui o titulo passa a existir.
    let cupTitleRecord: import("@/lib/career-types").SeasonRecord | null = null
    let cupPrize = 0
    if (won && !isLeagueMatch && typeof window !== "undefined") {
      // A partida precisa ser a FINAL. "Nao restam partidas no calendario" nao
      // basta mais: as fases de mata-mata agora so entram DEPOIS da classificacao,
      // entao logo apos vencer as quartas nao ha semifinal agendada ainda — e o
      // criterio antigo disparava a cerimonia de campeao nas quartas (relato).
      const ehFinal = String(fixtureForWeek?.stage ?? "").toLowerCase() === "final"
      const restantes = seasonCalendarRef.current.fixtures.filter(f =>
        f.isUserMatch && !f.played && f.competition === competitionName &&
        getCalendarFixtureKey(f, currentState.season) !== fixtureKey,
      ).length
      if (ehFinal && restantes === 0) {
        safeLocalSet("ultrafoot-pending-champion", JSON.stringify({
          competition: competitionName,
          season: String(currentState.season),
          type: "cup",
          stats: null,
        }))
        // Um registro de copa no seasonHistory: posicao 1 e champion = usuario.
        // Distinto do registro da liga (que entra no fim da temporada) — cada
        // competicao e uma linha. berthsForSeason, o hall da fama e a contagem de
        // titulos passam a enxergar a conquista.
        cupTitleRecord = {
          season: currentState.season,
          competition: competitionName,
          position: 1,
          points: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
          champion: userShort,
          managerName: currentState.managerName || "Técnico",
          promoted: false,
          relegated: false,
          teamCurto: userShort,
          teamNome: userTeamForComp?.nome ?? userShort,
        }
        cupPrize = cupTitlePrize(competitionName)
        if (cupPrize > 0) gameEngine.addClubRevenue(cupPrize)
      }
    }
    const lost = userScore < oppScore

    // === Bilheteria ===
    // Antes a renda de jogo em casa era só uma estimativa exibida em /financas:
    // nada entrava no caixa e as obras do estádio não mudavam nada. Agora cada
    // mando de campo credita a renda real e move a torcida.
    let fanBase = currentState.fanBase ?? userTeamForComp?.torcida ?? 50000
    if (userIsHome && userTeamForComp) {
      const engineState = useGameEngine.getState()
      const capacity = stadiumCapacity(
        userTeamForComp.estadio_cap ?? 30000,
        engineState.clubInfrastructure?.stadium ?? 2,
      )
      const matchday = calcMatchdayRevenue({
        capacity,
        prestige: userTeamForComp.prestigio,
        fanBase,
        ticketTier: engineState.ticketTier ?? "normal",
        titles: countCareerTitles(currentState.seasonHistory, userTeamForComp.curto),
        result: won ? "win" : lost ? "loss" : "draw",
        competitionWeight: isLeagueMatch ? 1 : 1.12,
      })
      gameEngine.addClubRevenue(matchday.revenue)
      fanBase = fanBaseGrowth(fanBase, matchday, won ? "win" : lost ? "loss" : "draw", engineState.ticketTier ?? "normal")
    }

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

    const completedFixtureKeys = Array.from(new Set([
      ...(currentState.completedFixtureKeys ?? []),
      fixtureKey,
    ]))
    const patch = {
      coachXP: newXP,
      coachWinStreak: newStreak,
      coachSkills: updatedSkills,
      completedFixtureKeys,
      fanBase,
      // Titulo de copa entra no historico ja aqui (a liga entra no fim da
      // temporada). Sem duplicar: o guard idempotente no topo garante um registro.
      ...(cupTitleRecord
        ? { seasonHistory: [...(currentState.seasonHistory ?? []), cupTitleRecord] }
        : {}),
    }
    saveStateRef.current = { ...currentState, ...patch }
    lastCompletedFixtureWeekRef.current = targetWeek
    setSaveState(patch)

    // Atualiza o calendário em memória no mesmo tick. Assim advanceWeek e um clique
    // rápido em Continuar já enxergam a próxima partida, sem esperar o React renderizar.
    const updatedFixtures = seasonCalendarRef.current.fixtures.map(fixture =>
      getCalendarFixtureKey(fixture, currentState.season) === fixtureKey
        ? { ...fixture, played: true, homeScore, awayScore }
        : fixture,
    )
    const pending = updatedFixtures
      .filter(fixture => fixture.isUserMatch && !fixture.played)
      .sort((a, b) => a.week - b.week || a.id - b.id)
    const played = updatedFixtures
      .filter(fixture => fixture.isUserMatch && fixture.played)
      .sort((a, b) => a.week - b.week || a.id - b.id)
    seasonCalendarRef.current = {
      ...seasonCalendarRef.current,
      fixtures: updatedFixtures,
      nextUserMatch: pending[0] ?? null,
      previousUserMatch: played.at(-1) ?? fixtureForWeek ?? null,
    }
  }, [gameEngine, setSaveState])
  
  // Classificacao atual ordenada
  const engineStandings = useMemo(() => {
    return [...gameEngine.serieAStandings].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const sgA = a.goalsFor - a.goalsAgainst
      const sgB = b.goalsFor - b.goalsAgainst
      if (sgB !== sgA) return sgB - sgA
      return b.goalsFor - a.goalsFor
    })
  }, [gameEngine.serieAStandings])

  // A tabela exibida é sempre reconstituída dos placares persistidos no calendário.
  // `serieAStandings` continua sendo mantida pelo motor por compatibilidade, mas não é
  // mais a fonte visual: isso elimina divergências após carregar save, migrar calendário
  // ou concluir uma partida enquanto o Zustand ainda estava propagando a atualização.
  const leagueCompetition = saveState.selectedTeamShort ? getLeagueName(saveState.selectedTeamShort, saveState.divisionOverride) : ""
  const standings = useMemo(() => {
    const derived = leagueCompetition
      ? computeStandingsFromFixtures(seasonCalendar.fixtures, leagueCompetition)
      : []
    return derived.length ? derived : engineStandings
  }, [engineStandings, leagueCompetition, seasonCalendar.fixtures])
  
  // Competicao que esta sendo disputada agora (ex: "Campeonato Paulista").
  const currentCompetition = useMemo(
    () => seasonCalendar.nextUserMatch?.competition ?? seasonCalendar.previousUserMatch?.competition ?? null,
    [seasonCalendar.nextUserMatch, seasonCalendar.previousUserMatch],
  )
  const currentCompetitionType = useMemo(
    () => seasonCalendar.nextUserMatch?.competitionType ?? seasonCalendar.previousUserMatch?.competitionType ?? "league",
    [seasonCalendar.nextUserMatch, seasonCalendar.previousUserMatch],
  )

  // Tabela do campeonato EM DISPUTA. O engine so mantem a tabela da liga, entao
  // para estadual/copa a tabela e derivada dos fixtures da propria competicao.
  const currentStandings = useMemo(() => {
    if (!currentCompetition) return standings
    const derived = computeStandingsFromFixtures(seasonCalendar.fixtures, currentCompetition)
    return derived.length ? derived : standings
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
