"use client"

import { useEffect, useState, useCallback } from "react"
import { useGameState, useUserTeam } from "@/lib/save-system"
import { getPlayersByTeam } from "@/lib/players-data"
import {
  type PlayerCareerData,
  type SeasonData,
  createInitialPlayerCareerData,
  createInitialSeasonData,
  advanceWeek as advanceWeekFn,
  applyMatchResult as applyMatchResultFn,
  canPlayerPlay,
  calculateEffectiveOverall,
} from "@/lib/season-system"

const CAREER_STORAGE_KEY = "ultrafoot:career"

interface CareerState {
  teamShort: string
  players: PlayerCareerData[]
  season: SeasonData
  teamMorale: number
  boardSatisfaction: number
}

function loadCareerState(): CareerState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CAREER_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CareerState
  } catch {
    return null
  }
}

function saveCareerState(state: CareerState): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(state))
}

export function useCareerData() {
  const { state: gameState } = useGameState()
  const { team } = useUserTeam()
  
  const [careerState, setCareerState] = useState<CareerState | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [events, setEvents] = useState<string[]>([])

  // Inicializa ou carrega career data
  useEffect(() => {
    const saved = loadCareerState()
    
    // Verifica se os dados salvos sao do mesmo time
    if (saved && saved.teamShort === team.curto) {
      setCareerState(saved)
    } else if (team.curto) {
      // Inicializa novo career state para o time
      const teamPlayers = getPlayersByTeam(team.nome)
      const initialPlayers = teamPlayers.map(p => 
        createInitialPlayerCareerData(p, team.prestigio / 70)
      )
      
      const newState: CareerState = {
        teamShort: team.curto,
        players: initialPlayers,
        season: createInitialSeasonData(gameState.season || 2026),
        teamMorale: 60 + Math.floor(Math.random() * 20),
        boardSatisfaction: 50,
      }
      
      setCareerState(newState)
      saveCareerState(newState)
    }
    
    setHydrated(true)
  }, [team.curto, team.nome, team.prestigio, gameState.season])

  // Avanca semana
  const advanceWeek = useCallback(() => {
    if (!careerState) return
    
    const { updatedPlayers, events: weekEvents } = advanceWeekFn(
      careerState.players,
      careerState.teamMorale
    )
    
    const newSeason = { ...careerState.season }
    newSeason.week += 1
    
    // Verifica fim de temporada
    if (newSeason.week >= 52) {
      newSeason.year += 1
      newSeason.week = 0
      
      // Envelhece jogadores
      const agedPlayers = updatedPlayers.map(p => ({
        ...p,
        age: p.age + 1,
        // Jogadores velhos podem declinar
        potential: p.age > 32 
          ? Math.max(p.overall - 5, p.potential - 2) 
          : p.potential,
      }))
      
      weekEvents.push(`Nova temporada: ${newSeason.year}`)
      
      const newState = {
        ...careerState,
        players: agedPlayers,
        season: newSeason,
      }
      
      setCareerState(newState)
      saveCareerState(newState)
      setEvents(prev => [...weekEvents, ...prev].slice(0, 20))
      return
    }
    
    const newState = {
      ...careerState,
      players: updatedPlayers,
      season: newSeason,
    }
    
    setCareerState(newState)
    saveCareerState(newState)
    setEvents(prev => [...weekEvents, ...prev].slice(0, 20))
  }, [careerState])

  // Aplica resultado de partida
  const applyMatchResult = useCallback((matchData: Parameters<typeof applyMatchResultFn>[1]) => {
    if (!careerState) return
    
    const { updatedPlayers, events: matchEvents } = applyMatchResultFn(
      careerState.players,
      matchData
    )
    
    // Atualiza moral do time baseado no resultado
    const moraleDelta = matchData.won ? 5 : -3
    
    const newState = {
      ...careerState,
      players: updatedPlayers,
      teamMorale: Math.max(10, Math.min(100, careerState.teamMorale + moraleDelta)),
    }
    
    setCareerState(newState)
    saveCareerState(newState)
    setEvents(prev => [...matchEvents, ...prev].slice(0, 20))
  }, [careerState])

  // Define foco de treino para um jogador
  const setTrainingFocus = useCallback((playerId: string, focus: PlayerCareerData["trainingFocus"]) => {
    if (!careerState) return
    
    const updatedPlayers = careerState.players.map(p => 
      p.playerId === playerId ? { ...p, trainingFocus: focus } : p
    )
    
    const newState = { ...careerState, players: updatedPlayers }
    setCareerState(newState)
    saveCareerState(newState)
  }, [careerState])

  // Renova contrato de jogador
  const renewContract = useCallback((playerId: string, weeksToAdd: number, newSalary: number) => {
    if (!careerState) return
    
    const updatedPlayers = careerState.players.map(p => {
      if (p.playerId !== playerId) return p
      return {
        ...p,
        contract: {
          ...p.contract,
          weeksRemaining: p.contract.weeksRemaining + weeksToAdd,
          weeklySalary: newSalary,
        },
        morale: Math.min(100, p.morale + 15),
      }
    })
    
    const newState = { ...careerState, players: updatedPlayers }
    setCareerState(newState)
    saveCareerState(newState)
    setEvents(prev => ["Contrato renovado!", ...prev].slice(0, 20))
  }, [careerState])

  // Adiciona novo jogador ao elenco (contratacao)
  const addPlayer = useCallback((player: { nome: string; pos: string; idade: number; base: number }, fee: number) => {
    if (!careerState) return
    
    const newPlayer = createInitialPlayerCareerData(player, team.prestigio / 70)
    
    const newSeason = { ...careerState.season }
    newSeason.transfersIn.push({
      player: player.nome,
      fee,
      week: careerState.season.week,
    })
    
    const newState = {
      ...careerState,
      players: [...careerState.players, newPlayer],
      season: newSeason,
    }
    
    setCareerState(newState)
    saveCareerState(newState)
    setEvents(prev => [`${player.nome} contratado!`, ...prev].slice(0, 20))
  }, [careerState, team.prestigio])

  // Remove jogador do elenco (venda)
  const removePlayer = useCallback((playerId: string, fee: number) => {
    if (!careerState) return
    
    const player = careerState.players.find(p => p.playerId === playerId)
    if (!player) return
    
    const newSeason = { ...careerState.season }
    newSeason.transfersOut.push({
      player: player.name,
      fee,
      week: careerState.season.week,
    })
    
    const newState = {
      ...careerState,
      players: careerState.players.filter(p => p.playerId !== playerId),
      season: newSeason,
    }
    
    setCareerState(newState)
    saveCareerState(newState)
    setEvents(prev => [`${player.name} vendido por R$ ${(fee / 1000000).toFixed(1)}M`, ...prev].slice(0, 20))
  }, [careerState])

  // Reseta career data
  const resetCareer = useCallback(() => {
    localStorage.removeItem(CAREER_STORAGE_KEY)
    setCareerState(null)
    setEvents([])
  }, [])

  // Helpers
  const getAvailablePlayers = useCallback(() => {
    if (!careerState) return []
    return careerState.players.filter(p => canPlayerPlay(p).canPlay)
  }, [careerState])

  const getInjuredPlayers = useCallback(() => {
    if (!careerState) return []
    return careerState.players.filter(p => p.injury !== null)
  }, [careerState])

  const getSuspendedPlayers = useCallback(() => {
    if (!careerState) return []
    return careerState.players.filter(p => p.suspension !== null)
  }, [careerState])

  const getExpiringContracts = useCallback(() => {
    if (!careerState) return []
    return careerState.players.filter(p => p.contract.weeksRemaining <= 26)
  }, [careerState])

  const getWeeklySalaryBill = useCallback(() => {
    if (!careerState) return 0
    return careerState.players.reduce((sum, p) => sum + p.contract.weeklySalary, 0)
  }, [careerState])

  const getSquadAverageOverall = useCallback(() => {
    if (!careerState || careerState.players.length === 0) return 0
    const sum = careerState.players.reduce((s, p) => s + p.overall, 0)
    return Math.round(sum / careerState.players.length)
  }, [careerState])

  return {
    // State
    players: careerState?.players ?? [],
    season: careerState?.season ?? createInitialSeasonData(2026),
    teamMorale: careerState?.teamMorale ?? 50,
    boardSatisfaction: careerState?.boardSatisfaction ?? 50,
    events,
    hydrated,
    
    // Actions
    advanceWeek,
    applyMatchResult,
    setTrainingFocus,
    renewContract,
    addPlayer,
    removePlayer,
    resetCareer,
    
    // Helpers
    getAvailablePlayers,
    getInjuredPlayers,
    getSuspendedPlayers,
    getExpiringContracts,
    getWeeklySalaryBill,
    getSquadAverageOverall,
    
    // Utils
    canPlayerPlay,
    calculateEffectiveOverall,
  }
}
