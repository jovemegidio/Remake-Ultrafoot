// Hook centralizado que integra save-system com game-engine
// Gerencia a progressao da temporada, classificacao dinamica e simulacao de partidas

"use client"

import { useCallback, useMemo, useRef } from "react"
import { useGameState } from "@/lib/save-system"
import { useGameEngine, type StandingsEntry, type MatchResult, type MatchEvent } from "@/lib/game-engine"
import { getTeamsByDivision, getTeamByShort, type Team } from "@/lib/teams-data"
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
}

export interface SeasonCalendar {
  fixtures: Fixture[]
  currentRound: number
  nextUserMatch: Fixture | null
  previousUserMatch: Fixture | null
}

// Gera confrontos da liga (todos contra todos, turno e returno) — dinamico por qtd de times
function generateBrasileirao(teams: Team[], userTeamShort: string, competition: string): Fixture[] {
  const fixtures: Fixture[] = []
  let fixtureId = 1
  const halfSeason = teams.length - 1

  // Primeira fase - turno
  for (let round = 1; round <= halfSeason; round++) {
    const matchups = generateRoundMatchups(teams, round)
    matchups.forEach(([home, away]) => {
      fixtures.push({
        id: fixtureId++,
        round,
        week: round,
        homeTeam: home,
        awayTeam: away,
        competition,
        played: false,
        isUserMatch: home.curto === userTeamShort || away.curto === userTeamShort
      })
    })
  }

  // Segunda fase - returno (inverte mando)
  for (let round = halfSeason + 1; round <= halfSeason * 2; round++) {
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
        isUserMatch: f.awayTeam.curto === userTeamShort || f.homeTeam.curto === userTeamShort
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
    competition: "Brasileirao Serie A",
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

  // Refs always pointing at latest values — prevents stale closures in callbacks called in loops
  const saveStateRef = useRef(saveState)
  saveStateRef.current = saveState
  const seasonCalendarRef = useRef<SeasonCalendar>({ fixtures: [], currentRound: 1, nextUserMatch: null, previousUserMatch: null })

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

    const leagueTeams = getUserLeagueTeams(userTeamShort)
    const competition = getLeagueName(userTeamShort)
    const fixtures = generateBrasileirao(leagueTeams, userTeamShort, competition)
    
    // Marca partidas ja jogadas
    fixtures.forEach(f => {
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
    const currentRound = Math.max(1, Math.min(38, currentWeek))
    
    // Proxima partida do usuario
    const nextUserMatch = fixtures.find(f => f.isUserMatch && !f.played) || null
    
    // Ultima partida do usuario
    const playedUserMatches = fixtures.filter(f => f.isUserMatch && f.played)
    const previousUserMatch = playedUserMatches.length > 0 
      ? playedUserMatches[playedUserMatches.length - 1] 
      : null
    
    const result = { fixtures, currentRound, nextUserMatch, previousUserMatch }
    seasonCalendarRef.current = result
    return result
  }, [saveState.selectedTeamShort, saveState.week, gameEngine.matchResults])
  
  // Avanca uma semana/rodada
  // Uses refs so sequential calls within a loop always read the latest week (fixes stale closure bug)
  const advanceWeek = useCallback(async () => {
    const currentState = saveStateRef.current
    const currentWeek = currentState.week
    const newWeek = currentWeek + 1

    // Verifica fim de temporada — total de rodadas depende do tamanho da liga
    const userShort = currentState.selectedTeamShort ?? ""
    const leagueTeamsForEnd = getUserLeagueTeams(userShort)
    const seasonEndWeek = (leagueTeamsForEnd.length - 1) * 2

    if (newWeek > seasonEndWeek) {
      const currentStandings = useGameEngine.getState().serieAStandings
      const nextSeason = currentState.season + 1

      const teamsForReset = getUserLeagueTeams(userShort)
      const newStandings = initializeStandings(teamsForReset)
      useGameEngine.setState({
        serieAStandings: newStandings,
        lastSeasonStandings: currentStandings,
        currentWeek: 0,
        currentSeason: nextSeason,
        matchResults: []
      })

      saveStateRef.current = { ...currentState, week: 0, season: nextSeason }
      setSaveState({ week: 0, season: nextSeason })

      return { newSeason: true }
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
      gameEngine.updateStandings(result)
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

    const result: MatchResult = {
      week: targetWeek,
      season: currentState.season,
      competition: getLeagueName(currentState.selectedTeamShort ?? ""),
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      events
    }

    gameEngine.updateStandings(result)
  }, [gameEngine])
  
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
  
  return {
    // Estado
    hydrated,
    userTeam,
    userPosition,
    standings,
    seasonCalendar,
    currentWeek: saveState.week,
    currentSeason: saveState.season,
    
    // Game Engine direto
    gameEngine,
    
    // Acoes
    initializeNewGame,
    advanceWeek,
    registerUserMatchResult,
    
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
