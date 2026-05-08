// Hook centralizado que integra save-system com game-engine
// Gerencia a progressao da temporada, classificacao dinamica e simulacao de partidas

"use client"

import { useCallback, useEffect, useMemo } from "react"
import { useGameState, type GameState } from "@/lib/save-system"
import { useGameEngine, type StandingsEntry, type MatchResult, type MatchEvent } from "@/lib/game-engine"
import { serieATeams, serieBTeams, getTeamByShort, type Team } from "@/lib/teams-data"

// Calendario base do Brasileirao - 38 rodadas
const SEASON_START_WEEK = 1
const SEASON_END_WEEK = 38
const TOTAL_ROUNDS = 38

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

// Gera confrontos do Brasileirao (todos contra todos, turno e returno)
function generateBrasileirao(teams: Team[], userTeamShort: string): Fixture[] {
  const fixtures: Fixture[] = []
  let fixtureId = 1
  
  // Primeira fase - turno
  for (let round = 1; round <= 19; round++) {
    // Algoritmo de circulo para gerar confrontos
    const matchups = generateRoundMatchups(teams, round)
    matchups.forEach(([home, away]) => {
      fixtures.push({
        id: fixtureId++,
        round,
        week: round,
        homeTeam: home,
        awayTeam: away,
        competition: "Brasileirao Serie A",
        played: false,
        isUserMatch: home.curto === userTeamShort || away.curto === userTeamShort
      })
    })
  }
  
  // Segunda fase - returno (inverte mando)
  for (let round = 20; round <= 38; round++) {
    const turnoRound = round - 19
    const turnoFixtures = fixtures.filter(f => f.round === turnoRound)
    turnoFixtures.forEach(f => {
      fixtures.push({
        id: fixtureId++,
        round,
        week: round,
        homeTeam: f.awayTeam,
        awayTeam: f.homeTeam,
        competition: "Brasileirao Serie A",
        played: false,
        isUserMatch: f.awayTeam.curto === userTeamShort || f.homeTeam.curto === userTeamShort
      })
    })
  }
  
  return fixtures
}

// Algoritmo de circulo para gerar confrontos de uma rodada
function generateRoundMatchups(teams: Team[], round: number): [Team, Team][] {
  const n = teams.length
  const matchups: [Team, Team][] = []
  
  // Cria array rotativo (primeiro time fica fixo)
  const fixed = teams[0]
  const rotating = teams.slice(1)
  
  // Rotaciona para a rodada correta
  const rotated = [...rotating]
  for (let i = 1; i < round; i++) {
    const last = rotated.pop()!
    rotated.unshift(last)
  }
  
  // Gera confrontos
  const allTeams = [fixed, ...rotated]
  for (let i = 0; i < n / 2; i++) {
    const home = allTeams[i]
    const away = allTeams[n - 1 - i]
    // Alterna mando de campo por rodada
    if (round % 2 === 0) {
      matchups.push([away, home])
    } else {
      matchups.push([home, away])
    }
  }
  
  return matchups
}

// Nomes de jogadores por posicao para simulacao
const PLAYER_NAMES_BY_TEAM: Record<string, string[]> = {
  "FLA": ["Gabigol", "Pedro", "Everton Ribeiro", "Arrascaeta", "De La Cruz", "Gerson", "Pulgar", "Ayrton Lucas"],
  "PAL": ["Endrick", "Dudu", "Raphael Veiga", "Gustavo Scarpa", "Zé Rafael", "Murilo", "Weverton"],
  "COR": ["Yuri Alberto", "Róger Guedes", "Renato Augusto", "Fagner", "Cássio", "Gil", "Fausto Vera"],
  "SAO": ["Luciano", "Calleri", "Alisson", "Rodrigo Nestor", "Rafinha", "Diego Costa", "Jandrei"],
  "FLU": ["Cano", "Ganso", "Jhon Arias", "André", "Marcelo", "Nino", "Fábio"],
  "BOT": ["Tiquinho", "Júnior Santos", "Eduardo", "Tchê Tchê", "Marlon Freitas", "Adryelson"],
  "INT": ["Enner Valencia", "Alan Patrick", "Mauricio", "De Pena", "Fernando", "Rochet"],
  "GRE": ["Suárez", "Cristaldo", "Pepê", "Villasanti", "Kannemann", "Marchesín"],
  "CAM": ["Hulk", "Paulinho", "Scarpa", "Otávio", "Zaracho", "Junior Alonso", "Everson"],
  "VAS": ["Vegetti", "Payet", "Praxedes", "Galdames", "Léo", "Maicon"],
  "BAH": ["Everaldo", "Thaciano", "Cauly", "Everton Ribeiro", "Kanu", "Marcos Felipe"],
  "CRU": ["Rafael Silva", "Arthur Gomes", "Matheus Pereira", "Lucas Romero", "João Marcelo"],
  "FOR": ["Lucero", "Moisés", "Pochettino", "Hércules", "Brítez", "João Ricardo"],
  "CAP": ["Pablo", "Vitor Roque", "Fernandinho", "Terans", "Thiago Heleno", "Bento"],
  "BGT": ["Eduardo Sasha", "Helinho", "Lincoln", "Eric Ramires", "Jadsom", "Cleiton"],
  "SAN": ["Marcos Leonardo", "Soteldo", "Lucas Lima", "Camacho", "Messias", "João Paulo"],
  "SPT": ["Michael", "Alan Patrick", "Yago", "Alisson", "Lucas André"],
  "CEA": ["Erick Pulga", "Vina", "Mendoza", "Richard", "David Ricardo"],
  "VIT": ["Alerrandro", "Matheuzinho", "Willian Oliveira", "Wagner Leonardo"],
  "JUV": ["Nenê", "Pitta", "Chico", "Zé Marcos", "Gabriel"],
  "MIR": ["Rómulo", "Sávio", "Gustavo Coutinho", "Dudu"]
}

// Obtem nome de jogador aleatorio do time
function getRandomPlayerName(teamShort: string): string {
  const names = PLAYER_NAMES_BY_TEAM[teamShort] || ["Jogador"]
  return names[Math.floor(Math.random() * names.length)]
}

// Simula resultado de uma partida entre dois times
function simulateMatchResult(homeTeam: Team, awayTeam: Team, week: number, season: number): MatchResult {
  // Fator de forca baseado em prestigio
  const homeStrength = homeTeam.prestigio + 5 // Bonus de mando
  const awayStrength = awayTeam.prestigio
  
  // Calcula probabilidades com mais variancia
  const totalStrength = homeStrength + awayStrength
  const homeChance = homeStrength / totalStrength
  
  // Simula gols com distribuicao Poisson simplificada
  const homeExpectedGoals = 1.2 + (homeChance * 1.2)
  const awayExpectedGoals = 0.9 + ((1 - homeChance) * 1.2)
  
  // Funcao para gerar gols com distribuicao mais realista
  const generateGoals = (expected: number): number => {
    let goals = 0
    const random = Math.random()
    
    if (random < 0.15) goals = 0
    else if (random < 0.35) goals = 1
    else if (random < 0.60) goals = 2
    else if (random < 0.80) goals = 3
    else if (random < 0.92) goals = 4
    else goals = 5
    
    // Ajusta baseado na forca
    if (expected > 2) goals = Math.min(goals + 1, 6)
    if (expected < 1.2) goals = Math.max(goals - 1, 0)
    
    return goals
  }
  
  const homeScore = generateGoals(homeExpectedGoals)
  const awayScore = generateGoals(awayExpectedGoals)
  
  // Gera eventos detalhados
  const events: MatchEvent[] = []
  const usedMinutes = new Set<number>()
  
  const getUniqueMinute = (): number => {
    let minute = Math.floor(Math.random() * 90) + 1
    while (usedMinutes.has(minute)) {
      minute = Math.floor(Math.random() * 90) + 1
    }
    usedMinutes.add(minute)
    return minute
  }
  
  // Gols do time da casa
  for (let i = 0; i < homeScore; i++) {
    const scorerName = getRandomPlayerName(homeTeam.curto)
    const hasAssist = Math.random() > 0.3
    
    events.push({
      minute: getUniqueMinute(),
      type: "goal",
      playerId: Math.floor(Math.random() * 1000) + 1,
      playerName: scorerName,
      ...(hasAssist && {
        assistPlayerId: Math.floor(Math.random() * 1000) + 1,
        assistPlayerName: getRandomPlayerName(homeTeam.curto)
      })
    })
  }
  
  // Gols do time visitante
  for (let i = 0; i < awayScore; i++) {
    const scorerName = getRandomPlayerName(awayTeam.curto)
    const hasAssist = Math.random() > 0.3
    
    events.push({
      minute: getUniqueMinute(),
      type: "goal",
      playerId: Math.floor(Math.random() * 1000) + 1,
      playerName: scorerName,
      ...(hasAssist && {
        assistPlayerId: Math.floor(Math.random() * 1000) + 1,
        assistPlayerName: getRandomPlayerName(awayTeam.curto)
      })
    })
  }
  
  // Cartoes (2-6 por partida em media)
  const yellowCards = Math.floor(Math.random() * 4) + 2
  for (let i = 0; i < yellowCards; i++) {
    const isHome = Math.random() > 0.5
    events.push({
      minute: getUniqueMinute(),
      type: "yellow",
      playerId: Math.floor(Math.random() * 1000) + 1,
      playerName: getRandomPlayerName(isHome ? homeTeam.curto : awayTeam.curto)
    })
  }
  
  // Chance de cartao vermelho (10%)
  if (Math.random() > 0.9) {
    const isHome = Math.random() > 0.5
    events.push({
      minute: getUniqueMinute(),
      type: "red",
      playerId: Math.floor(Math.random() * 1000) + 1,
      playerName: getRandomPlayerName(isHome ? homeTeam.curto : awayTeam.curto)
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
  
  // Inicializa o jogo quando o usuario seleciona um time
  const initializeNewGame = useCallback((teamShort: string) => {
    // Inicializa classificacao da Serie A
    const standings = initializeStandings(serieATeams)
    
    // Inicializa no game engine
    gameEngine.initializeGame(teamShort)
    
    // Atualiza standings
    useGameEngine.setState({ 
      serieAStandings: standings,
      currentWeek: 0,
      currentSeason: 2026
    })
    
    // Atualiza save state
    setSaveState({
      selectedTeamShort: teamShort,
      week: 0,
      season: 2026
    })
  }, [gameEngine, setSaveState])
  
  // Calendario da temporada
  const seasonCalendar = useMemo((): SeasonCalendar => {
    if (!saveState.selectedTeamShort) {
      return { fixtures: [], currentRound: 1, nextUserMatch: null, previousUserMatch: null }
    }
    
    const userTeamShort = saveState.selectedTeamShort
    const currentWeek = saveState.week
    
    // Gera todos os confrontos
    const fixtures = generateBrasileirao(serieATeams, userTeamShort)
    
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
    
    return { fixtures, currentRound, nextUserMatch, previousUserMatch }
  }, [saveState.selectedTeamShort, saveState.week, gameEngine.matchResults])
  
  // Avanca uma semana/rodada
  const advanceWeek = useCallback(async () => {
    const currentWeek = saveState.week
    const newWeek = currentWeek + 1
    
    // Verifica fim de temporada
    if (newWeek > SEASON_END_WEEK) {
      // Nova temporada
      setSaveState({
        week: 0,
        season: saveState.season + 1
      })
      
      // Reseta classificacao
      const newStandings = initializeStandings(serieATeams)
      useGameEngine.setState({
        serieAStandings: newStandings,
        currentWeek: 0,
        currentSeason: saveState.season + 1,
        matchResults: []
      })
      
      return { newSeason: true }
    }
    
    // Simula partidas de outros times desta rodada
    const roundFixtures = seasonCalendar.fixtures.filter(
      f => f.week === newWeek && !f.isUserMatch
    )
    
    for (const fixture of roundFixtures) {
      const result = simulateMatchResult(
        fixture.homeTeam, 
        fixture.awayTeam, 
        newWeek, 
        saveState.season
      )
      gameEngine.updateStandings(result)
    }
    
    // Avanca game engine
    gameEngine.advanceWeek()
    
    // Atualiza save state
    setSaveState({ week: newWeek })
    
    return { 
      newSeason: false, 
      simulatedMatches: roundFixtures.length,
      nextUserMatch: seasonCalendar.nextUserMatch
    }
  }, [saveState, setSaveState, gameEngine, seasonCalendar])
  
  // Registra resultado da partida do usuario
  const registerUserMatchResult = useCallback((
    homeTeam: string,
    awayTeam: string,
    homeScore: number,
    awayScore: number,
    events: MatchEvent[]
  ) => {
    const result: MatchResult = {
      week: saveState.week,
      season: saveState.season,
      competition: "Brasileirao Serie A",
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      events
    }
    
    gameEngine.updateStandings(result)
  }, [saveState.week, saveState.season, gameEngine])
  
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
