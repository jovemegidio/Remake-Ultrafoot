// Hook centralizado que integra save-system com game-engine
// Gerencia a progressao da temporada, classificacao dinamica e simulacao de partidas

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useGameState, type CoachSkillId } from "@/lib/save-system"
import { useGameEngine, type StandingsEntry, type MatchResult, type MatchEvent } from "@/lib/game-engine"
import { getTeamsByDivision, getTeamByShort, allBrazilianTeams, type Team } from "@/lib/teams-data"
import { getPlayersByTeam } from "@/lib/players-data"

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

const ESTADO_CAMPEONATO: Record<string, string> = {
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

// Retorna os times do campeonato estadual do usuario (minimo 4, maximo 8)
function getStateChampionshipTeams(userTeamShort: string): Team[] {
  const userTeam = getTeamByShort(userTeamShort)
  if (!userTeam || !isBrazilianDivision(userTeam.divisao)) return []
  const estado = userTeam.estado
  if (!ESTADO_CAMPEONATO[estado]) return []
  const stateTeams = allBrazilianTeams.filter(t => t.estado === estado)
  if (stateTeams.length < 4) return []
  // Cap em 8 para um campeonato de 14 rodadas
  const capped = stateTeams.slice(0, 8)
  const hasUser = capped.some(t => t.curto === userTeamShort)
  if (!hasUser) capped[0] = userTeam
  return capped
}

// Retorna o numero de rodadas do campeonato estadual
function getStateChampRounds(userTeamShort: string): number {
  const teams = getStateChampionshipTeams(userTeamShort)
  if (teams.length < 4) return 0
  return (teams.length - 1) * 2
}

// Retorna o total de rodadas da liga principal
function getLeagueRounds(division: string): number {
  return LEAGUE_CALENDAR[division]?.rounds ?? 38
}

// Gera fixtures do campeonato estadual (Jan-Mar)
function generateStateChampionshipFixtures(stateTeams: Team[], userTeamShort: string, competition: string): Fixture[] {
  const fixtures: Fixture[] = []
  let fixtureId = 10000
  const halfSeason = stateTeams.length - 1
  const totalRounds = halfSeason * 2

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

  return fixtures
}

function getUserLeagueTeams(teamShort: string): Team[] {
  const userTeam = getTeamByShort(teamShort)
  if (!userTeam) return []
  const divisionTeams = getTeamsByDivision(userTeam.divisao)
  // Garante que o time do usuario esta na lista
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
  competitionType: "state" | "league"
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
function simulateMatchResult(homeTeam: Team, awayTeam: Team, week: number, season: number): MatchResult {
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
    competition: getLeagueName(homeTeam.curto),
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
    const leagueTeams = getUserLeagueTeams(teamShort)
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

    // Inicializa no game engine (carrega elenco do seed para o time)
    gameEngine.initializeGame(teamShort)

    // Reseta standings e semana no game engine
    useGameEngine.setState({
      serieAStandings: standings,
      currentWeek: 0,
      currentSeason: 2026,
      matchResults: [],
    })

    // Atualiza save state (reseta progresso, preserva nome do tecnico)
    setSaveState({
      selectedTeamShort: teamShort,
      week: 0,
      season: 2026,
      ...(managerName ? { managerName: managerName.trim() || "Tecnico" } : {}),
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
    const division = userTeam?.divisao ?? "serie_a"

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

    const leagueTeams = getUserLeagueTeams(userTeamShort)
    const competition = getLeagueName(userTeamShort)
    const leagueFixtures = generateBrasileirao(leagueTeams, userTeamShort, competition, division, stateChampRoundsCount)
    allFixtures.push(...leagueFixtures)

    // Marca partidas ja jogadas
    allFixtures.forEach(f => {
      if (f.week <= currentWeek) {
        const result = gameEngine.matchResults.find(
          r => r.week === f.week &&
               ((r.homeTeam === f.homeTeam.curto && r.awayTeam === f.awayTeam.curto) ||
                (r.homeTeam === f.awayTeam.curto && r.awayTeam === f.homeTeam.curto))
        )
        if (result) {
          f.played = true
          if (result.homeTeam === f.homeTeam.curto) {
            f.homeScore = result.homeScore
            f.awayScore = result.awayScore
          } else {
            f.homeScore = result.awayScore
            f.awayScore = result.homeScore
          }
        }
      }
    })

    // Encontra rodada atual
    const totalWeeks = stateChampRoundsCount + (leagueTeams.length - 1) * 2
    const currentRound = Math.max(1, Math.min(totalWeeks, currentWeek))

    // Proxima partida do usuario
    const nextUserMatch = allFixtures.find(f => f.isUserMatch && !f.played) || null

    // Ultima partida do usuario
    const playedUserMatches = allFixtures.filter(f => f.isUserMatch && f.played)
    const previousUserMatch = playedUserMatches.length > 0
      ? playedUserMatches[playedUserMatches.length - 1]
      : null

    const result = { fixtures: allFixtures, currentRound, nextUserMatch, previousUserMatch }
    seasonCalendarRef.current = result
    return result
  }, [saveState.selectedTeamShort, saveState.week, gameEngine.matchResults])
  
  // Avanca uma semana/rodada
  // Uses refs so sequential calls within a loop always read the latest week (fixes stale closure bug)
  const advanceWeek = useCallback(async () => {
    const currentState = saveStateRef.current
    const currentWeek = currentState.week
    const newWeek = currentWeek + 1

    // Verifica fim de temporada — total inclui estadual + liga
    const userShort = currentState.selectedTeamShort ?? ""
    const leagueTeamsForEnd = getUserLeagueTeams(userShort)
    const stateRoundsForEnd = getStateChampRounds(userShort)
    const leagueRoundsForEnd = (leagueTeamsForEnd.length - 1) * 2
    const seasonEndWeek = stateRoundsForEnd + leagueRoundsForEnd

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

      const teamsForReset = getUserLeagueTeams(userShort)
      const newStandings = initializeStandings(teamsForReset)

      // Processa fim de temporada: envelhece jogadores, aposentadorias, jovens da base, reseta standings
      gameEngine.processSeasonEnd(nextSeason, newStandings, currentStandings)

      saveStateRef.current = { ...currentState, week: 0, season: nextSeason }
      setSaveState({ week: 0, season: nextSeason })

      return { newSeason: true, champion }
    }

    // Simula partidas de outros times desta rodada
    const roundFixtures = seasonCalendarRef.current.fixtures.filter(
      f => f.week === newWeek && !f.isUserMatch
    )

    for (const fixture of roundFixtures) {
      const result = simulateMatchResult(
        fixture.homeTeam,
        fixture.awayTeam,
        newWeek,
        currentState.season
      )
      // Apenas atualiza standings da liga principal (nao do estadual)
      if (fixture.competitionType === "league") {
        gameEngine.updateStandings(result)
      } else {
        gameEngine.addMatchResultOnly(result)
      }
    }

    // Avanca game engine
    gameEngine.advanceWeek()

    // Update ref immediately so the next loop iteration sees the incremented week
    saveStateRef.current = { ...currentState, week: newWeek }
    setSaveState({ week: newWeek })

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
    const isLeagueMatch = targetWeek > stateRounds

    // Para o estadual, usa o nome do campeonato estadual; para liga, usa o nome da liga
    const userTeamForComp = getTeamByShort(currentState.selectedTeamShort ?? "")
    const competitionName = isLeagueMatch
      ? leagueName
      : (ESTADO_CAMPEONATO[userTeamForComp?.estado ?? ""] ?? leagueName)

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

    // So atualiza standings da liga principal (nao do estadual)
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
  
  // Posicao do usuario na tabela
  const userPosition = useMemo(() => {
    if (!saveState.selectedTeamShort) return 0
    const index = standings.findIndex(s => s.teamShort === saveState.selectedTeamShort)
    return index + 1
  }, [standings, saveState.selectedTeamShort])
  
  // Time do usuario
  const userTeam = useMemo(() => {
    return saveState.selectedTeamShort 
      ? getTeamByShort(saveState.selectedTeamShort) 
      : null
  }, [saveState.selectedTeamShort])
  
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
