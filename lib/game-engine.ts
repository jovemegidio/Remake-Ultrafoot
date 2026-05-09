// Sistema central do jogo - gerencia jogadores, contratos, lesoes, treinamento, temporada, etc.

"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface ContractBonus {
  type: "goals" | "assists" | "titles" | "appearances" | "cleanSheets" | "nationalTeam"
  threshold: number // Quantidade necessaria
  amount: number // Valor do bonus
  achieved: boolean
}

export interface PlayerContract {
  salary: number // Salario semanal
  endDate: number // Semana de termino (week absoluto)
  releaseClause: number | null
  signedWeek: number
  signedSeason: number
  // Clausulas de bonus
  bonuses: ContractBonus[]
  // Opcao de renovacao automatica
  autoRenewalOption: boolean
  autoRenewalWeeks: number // Semanas adicionais se renovar
  // Clausula de revenda (% para time anterior)
  resaleClause: number // 0-50%
  previousClub: string | null
}

// Historico de confrontos entre times
export interface HeadToHead {
  team1: string
  team2: string
  matches: HeadToHeadMatch[]
  team1Wins: number
  team2Wins: number
  draws: number
  team1Goals: number
  team2Goals: number
}

export interface HeadToHeadMatch {
  season: number
  week: number
  competition: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
}

export interface PlayerInjury {
  type: string
  severity: "leve" | "media" | "grave"
  weeksRemaining: number
  startWeek: number
}

export interface PlayerStats {
  goals: number
  assists: number
  yellowCards: number
  redCards: number
  matchesPlayed: number
  minutesPlayed: number
  cleanSheets: number // para goleiros
  manOfTheMatch: number
}

export interface PlayerTraining {
  currentFocus: string | null // atributo sendo treinado
  weeksTrained: number
  lastTrainingWeek: number
}

export interface Player {
  id: number
  name: string
  position: string
  secondaryPositions?: string[]
  age: number
  overall: number
  potential: number
  nationality: string
  
  // Atributos
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
  
  // Status
  energy: number
  morale: "Feliz" | "Motivado" | "Normal" | "Insatisfeito" | "Infeliz"
  form: number // 0-100
  
  // Contrato
  contract: PlayerContract | null
  
  // Lesao
  injury: PlayerInjury | null
  
  // Estatisticas da temporada
  seasonStats: PlayerStats
  
  // Treinamento
  training: PlayerTraining
  
  // Selecao
  nationalTeam: string | null
  calledUp: boolean
  
  // Valores
  marketValue: number
  
  // Historico
  joinedClubWeek: number
  joinedClubSeason: number
  isLoanedIn: boolean
  loanEndWeek?: number
  parentClub?: string
}

export interface Scout {
  id: number
  name: string
  region: string // "Brasil" | "Europa" | "Americas" | "Asia"
  skill: number // 1-5 estrelas
  salary: number
  isSearching: boolean
  searchProgress: number
  foundPlayers: number[] // IDs dos jogadores descobertos
}

export interface MatchResult {
  week: number
  season: number
  competition: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  events: MatchEvent[]
}

export interface MatchEvent {
  minute: number
  type: "goal" | "assist" | "yellow" | "red" | "sub" | "injury"
  playerId: number
  playerName: string
  assistPlayerId?: number
  assistPlayerName?: string
}

export interface StandingsEntry {
  teamShort: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
  form: ("W" | "D" | "L")[]
}

export interface CopaBracket {
  round: "32avos" | "16avos" | "oitavas" | "quartas" | "semis" | "final"
  matches: CopaBracketMatch[]
}

export interface CopaBracketMatch {
  id: number
  team1: string
  team2: string
  score1: number | null
  score2: number | null
  winner: string | null
  nextMatchId: number | null
}

export interface NationalTeamCall {
  playerId: number
  playerName: string
  country: string
  competition: string
  weeksAway: number
  startWeek: number
}

export interface TopScorer {
  playerId: number
  playerName: string
  teamShort: string
  goals: number
  assists: number
  matches: number
}

// Sistema de Ofertas da IA
export interface TransferOffer {
  id: number
  playerId: number
  playerName: string
  fromTeam: string
  offerType: "compra" | "emprestimo"
  offerAmount: number
  wageCoverage?: number // % do salario coberto no emprestimo
  loanWeeks?: number
  status: "pendente" | "aceita" | "rejeitada" | "expirada"
  createdWeek: number
  expiresWeek: number
}

// Times que podem fazer ofertas
export const AI_TEAMS = [
  { short: "FLA", name: "Flamengo", budget: 80000000, prestige: 90 },
  { short: "PAL", name: "Palmeiras", budget: 75000000, prestige: 88 },
  { short: "COR", name: "Corinthians", budget: 50000000, prestige: 85 },
  { short: "SAO", name: "Sao Paulo", budget: 45000000, prestige: 84 },
  { short: "INT", name: "Internacional", budget: 40000000, prestige: 82 },
  { short: "GRE", name: "Gremio", budget: 38000000, prestige: 81 },
  { short: "CAM", name: "Atletico-MG", budget: 55000000, prestige: 83 },
  { short: "FLU", name: "Fluminense", budget: 35000000, prestige: 80 },
  { short: "BOT", name: "Botafogo", budget: 60000000, prestige: 79 },
  { short: "BAH", name: "Bahia", budget: 25000000, prestige: 75 },
  // Times europeus
  { short: "POR", name: "Porto", budget: 40000000, prestige: 85 },
  { short: "BEN", name: "Benfica", budget: 45000000, prestige: 84 },
  { short: "LEV", name: "Bayer Leverkusen", budget: 60000000, prestige: 82 },
  { short: "SEV", name: "Sevilla", budget: 35000000, prestige: 80 },
  { short: "LYO", name: "Lyon", budget: 30000000, prestige: 78 },
]

// ============================================
// ESTADO GLOBAL DO JOGO
// ============================================

interface GameEngineState {
  // Tempo
  currentWeek: number
  currentSeason: number
  isPaused: boolean
  
  // Jogadores do usuario
  squadPlayers: Player[]
  
  // Olheiros
  scouts: Scout[]
  discoveredPlayers: Player[]
  
  // Classificacoes
  serieAStandings: StandingsEntry[]
  serieBStandings: StandingsEntry[]
  
  // Copa do Brasil
  copaBrasil: CopaBracket[]
  
  // Resultados
  matchResults: MatchResult[]
  
  // Historico de confrontos
  headToHeadRecords: HeadToHead[]
  
  // Selecoes
  nationalTeamCalls: NationalTeamCall[]
  fifaDates: number[] // semanas com datas FIFA
  
  // Artilharia
  topScorers: TopScorer[]
  
  // Ofertas de transferencia
  transferOffers: TransferOffer[]
  
  // Financas
  balance: number
  weeklyIncome: number
  weeklyExpenses: number
  transferBudget: number
  wageBudget: number
  
  // Acoes
  advanceWeek: () => void
  generateAIOffers: () => void
  respondToOffer: (offerId: number, accept: boolean) => void
  trainPlayer: (playerId: number, attribute: string) => void
  renewContract: (playerId: number, newSalary: number, weeks: number) => void
  sellPlayer: (playerId: number) => void
  buyPlayer: (player: Player, fee: number) => void
  loanPlayer: (player: Player, weeks: number, salary: number) => void
  hireScout: (scout: Scout) => void
  startScoutSearch: (scoutId: number, region: string) => void
  simulateOtherMatches: () => void
  drawCopaBracket: () => void
  updateStandings: (result: MatchResult) => void
  callUpPlayer: (playerId: number, call: NationalTeamCall) => void
  returnFromNationalTeam: (playerId: number) => void
  getPlayerById: (playerId: number) => Player | undefined
  updatePlayerStats: (playerId: number, stats: Partial<PlayerStats>) => void
  injurePlayer: (playerId: number, injury: PlayerInjury) => void
  healPlayer: (playerId: number) => void
  initializeGame: (teamShort: string) => void
  updateHeadToHead: (result: MatchResult) => void
  getHeadToHead: (team1: string, team2: string) => HeadToHead | null
  checkContractBonuses: (playerId: number) => void
}

// Jogadores iniciais do Bragantino (exemplo)
const initialPlayers: Player[] = [
  {
    id: 1,
    name: "Cleiton",
    position: "GOL",
    age: 28,
    overall: 78,
    potential: 80,
    nationality: "Brasil",
    pace: 45,
    shooting: 20,
    passing: 55,
    dribbling: 35,
    defending: 25,
    physical: 70,
    energy: 100,
    morale: "Feliz",
    form: 75,
    contract: { 
      salary: 120000, 
      endDate: 156, 
      releaseClause: 15000000, 
      signedWeek: 0, 
      signedSeason: 2026,
      bonuses: [
        { type: "cleanSheets", threshold: 15, amount: 500000, achieved: false }
      ],
      autoRenewalOption: true,
      autoRenewalWeeks: 52,
      resaleClause: 0,
      previousClub: null
    },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 8000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2024,
    isLoanedIn: false,
  },
  {
    id: 2,
    name: "Nathan Mendes",
    position: "LD",
    age: 24,
    overall: 75,
    potential: 82,
    nationality: "Brasil",
    pace: 82,
    shooting: 55,
    passing: 70,
    dribbling: 72,
    defending: 74,
    physical: 70,
    energy: 100,
    morale: "Motivado",
    form: 78,
    contract: { salary: 80000, endDate: 104, releaseClause: 10000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 5000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2025,
    isLoanedIn: false,
  },
  {
    id: 3,
    name: "Pedro Henrique",
    position: "ZAG",
    age: 27,
    overall: 77,
    potential: 78,
    nationality: "Brasil",
    pace: 68,
    shooting: 45,
    passing: 60,
    dribbling: 55,
    defending: 80,
    physical: 82,
    energy: 100,
    morale: "Normal",
    form: 72,
    contract: { salary: 100000, endDate: 130, releaseClause: 12000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 7000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2024,
    isLoanedIn: false,
  },
  {
    id: 4,
    name: "Eduardo Santos",
    position: "ZAG",
    age: 25,
    overall: 76,
    potential: 80,
    nationality: "Brasil",
    pace: 70,
    shooting: 42,
    passing: 58,
    dribbling: 52,
    defending: 78,
    physical: 80,
    energy: 100,
    morale: "Feliz",
    form: 74,
    contract: { salary: 90000, endDate: 156, releaseClause: 11000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 6000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2025,
    isLoanedIn: false,
  },
  {
    id: 5,
    name: "Luan Candido",
    position: "LE",
    age: 23,
    overall: 74,
    potential: 83,
    nationality: "Brasil",
    pace: 85,
    shooting: 58,
    passing: 72,
    dribbling: 75,
    defending: 70,
    physical: 68,
    energy: 100,
    morale: "Motivado",
    form: 80,
    contract: { salary: 75000, endDate: 104, releaseClause: 8000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: "Brasil Sub-23",
    calledUp: false,
    marketValue: 4500000,
    joinedClubWeek: 0,
    joinedClubSeason: 2025,
    isLoanedIn: false,
  },
  {
    id: 6,
    name: "Jadsom Silva",
    position: "VOL",
    age: 22,
    overall: 73,
    potential: 84,
    nationality: "Brasil",
    pace: 72,
    shooting: 60,
    passing: 75,
    dribbling: 72,
    defending: 76,
    physical: 75,
    energy: 100,
    morale: "Normal",
    form: 76,
    contract: { salary: 70000, endDate: 130, releaseClause: 15000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 5500000,
    joinedClubWeek: 0,
    joinedClubSeason: 2024,
    isLoanedIn: false,
  },
  {
    id: 7,
    name: "Eric Ramires",
    position: "MEI",
    age: 26,
    overall: 79,
    potential: 81,
    nationality: "Brasil",
    pace: 75,
    shooting: 72,
    passing: 82,
    dribbling: 80,
    defending: 55,
    physical: 70,
    energy: 100,
    morale: "Feliz",
    form: 79,
    contract: { salary: 130000, endDate: 156, releaseClause: 20000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 12000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2024,
    isLoanedIn: false,
  },
  {
    id: 8,
    name: "Lincoln",
    position: "MEI",
    age: 24,
    overall: 78,
    potential: 85,
    nationality: "Brasil",
    pace: 80,
    shooting: 75,
    passing: 80,
    dribbling: 82,
    defending: 55,
    physical: 68,
    energy: 100,
    morale: "Motivado",
    form: 80,
    contract: { salary: 120000, endDate: 130, releaseClause: 25000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: "Brasil",
    calledUp: false,
    marketValue: 15000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2023,
    isLoanedIn: false,
  },
  {
    id: 9,
    name: "Vitinho",
    position: "PD",
    age: 25,
    overall: 76,
    potential: 80,
    nationality: "Brasil",
    pace: 88,
    shooting: 72,
    passing: 70,
    dribbling: 80,
    defending: 35,
    physical: 65,
    energy: 100,
    morale: "Normal",
    form: 77,
    contract: { salary: 85000, endDate: 104, releaseClause: 10000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 6000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2025,
    isLoanedIn: false,
  },
  {
    id: 10,
    name: "Eduardo Sasha",
    position: "ATA",
    age: 30,
    overall: 81,
    potential: 81,
    nationality: "Brasil",
    pace: 78,
    shooting: 85,
    passing: 68,
    dribbling: 75,
    defending: 38,
    physical: 76,
    energy: 100,
    morale: "Feliz",
    form: 75,
    contract: { salary: 180000, endDate: 78, releaseClause: null, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 8000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2024,
    isLoanedIn: false,
  },
  {
    id: 11,
    name: "Helinho",
    position: "PE",
    age: 22,
    overall: 75,
    potential: 84,
    nationality: "Brasil",
    pace: 90,
    shooting: 70,
    passing: 72,
    dribbling: 82,
    defending: 32,
    physical: 62,
    energy: 100,
    morale: "Motivado",
    form: 82,
    contract: { salary: 75000, endDate: 156, releaseClause: 20000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: "Brasil Sub-23",
    calledUp: false,
    marketValue: 7000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2024,
    isLoanedIn: false,
  },
]

// Datas FIFA 2026 (semanas do ano com jogos de selecao)
const FIFA_DATES_2026 = [10, 11, 22, 23, 36, 37, 40, 41] // Marco, Junho, Setembro, Outubro

// ============================================
// STORE ZUSTAND
// ============================================

export const useGameEngine = create<GameEngineState>()(
  persist(
    (set, get) => ({
      currentWeek: 0,
      currentSeason: 2026,
      isPaused: false,
      
      squadPlayers: initialPlayers,
      
      scouts: [],
      discoveredPlayers: [],
      
      serieAStandings: [],
      serieBStandings: [],
      
      copaBrasil: [],
      
      matchResults: [],
      
      headToHeadRecords: [],
      
      nationalTeamCalls: [],
      fifaDates: FIFA_DATES_2026,
      
      topScorers: [],
      
      transferOffers: [],
      
      balance: 27500000,
      weeklyIncome: 2100000,
      weeklyExpenses: 1800000,
      transferBudget: 15000000,
      wageBudget: 2500000,
      
      advanceWeek: () => {
        const state = get()
        const newWeek = state.currentWeek + 1
        
        set((s) => {
          // Processar recuperacao de lesoes
          const updatedPlayers = s.squadPlayers.map(player => {
            if (player.injury) {
              const weeksRemaining = player.injury.weeksRemaining - 1
              if (weeksRemaining <= 0) {
                return { ...player, injury: null, energy: 70 }
              }
              return { ...player, injury: { ...player.injury, weeksRemaining } }
            }
            
            // Recuperar energia
            const energyGain = player.training.currentFocus ? 5 : 10
            const newEnergy = Math.min(100, player.energy + energyGain)
            
            // Processar treinamento
            if (player.training.currentFocus && player.training.lastTrainingWeek === s.currentWeek) {
              const weeksTrained = player.training.weeksTrained + 1
              
              // A cada 4 semanas, chance de melhoria
              if (weeksTrained >= 4) {
                const attribute = player.training.currentFocus as keyof Player
                const currentValue = player[attribute] as number
                const maxValue = player.potential
                
                if (currentValue < maxValue) {
                  const improvement = Math.random() < 0.7 ? 1 : 0
                  return {
                    ...player,
                    [attribute]: Math.min(99, currentValue + improvement),
                    energy: newEnergy,
                    training: { ...player.training, weeksTrained: 0 }
                  }
                }
              }
              
              return {
                ...player,
                energy: newEnergy,
                training: { ...player.training, weeksTrained }
              }
            }
            
            return { ...player, energy: newEnergy }
          })
          
          // Verificar fim de temporada (semana 48)
          let newSeason = s.currentSeason
          let finalWeek = newWeek
          if (newWeek >= 48) {
            newSeason = s.currentSeason + 1
            finalWeek = 0
            // Reset estatisticas de temporada
            updatedPlayers.forEach(p => {
              p.seasonStats = { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 }
              p.age += 1
            })
          }
          
          // Processar convocacoes de selecao
          const isFifaDate = s.fifaDates.includes(newWeek)
          
          // Atualizar financas
          const weeklyBalance = s.weeklyIncome - s.weeklyExpenses
          
          // Expirar ofertas antigas
          const updatedOffers = s.transferOffers.map(offer => {
            if (offer.status === "pendente" && offer.expiresWeek <= newWeek) {
              return { ...offer, status: "expirada" as const }
            }
            return offer
          })
          
          return {
            ...s,
            currentWeek: finalWeek,
            currentSeason: newSeason,
            squadPlayers: updatedPlayers,
            transferOffers: updatedOffers,
            balance: s.balance + weeklyBalance
          }
        })
        
        // Gera novas ofertas da IA
        get().generateAIOffers()
      },
      
      trainPlayer: (playerId, attribute) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId 
              ? { 
                  ...p, 
                  training: { 
                    currentFocus: attribute, 
                    weeksTrained: 0, 
                    lastTrainingWeek: s.currentWeek 
                  },
                  energy: Math.max(0, p.energy - 10)
                }
              : p
          )
        }))
      },
      
      renewContract: (playerId, newSalary, weeks) => {
        const state = get()
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId 
              ? { 
                  ...p, 
                  contract: {
                    salary: newSalary,
                    endDate: s.currentWeek + weeks,
                    releaseClause: p.contract?.releaseClause || null,
                    signedWeek: s.currentWeek,
                    signedSeason: s.currentSeason
                  },
                  morale: "Feliz"
                }
              : p
          ),
          weeklyExpenses: s.weeklyExpenses + (newSalary - (s.squadPlayers.find(p => p.id === playerId)?.contract?.salary || 0))
        }))
      },
      
      sellPlayer: (playerId) => {
        const state = get()
        const player = state.squadPlayers.find(p => p.id === playerId)
        if (!player) return
        
        set((s) => ({
          squadPlayers: s.squadPlayers.filter(p => p.id !== playerId),
          balance: s.balance + player.marketValue,
          weeklyExpenses: s.weeklyExpenses - (player.contract?.salary || 0)
        }))
      },
      
      buyPlayer: (player, fee) => {
        const state = get()
        if (state.balance < fee) return
        
        const newPlayer: Player = {
          ...player,
          id: Date.now(),
          joinedClubWeek: state.currentWeek,
          joinedClubSeason: state.currentSeason,
          isLoanedIn: false,
          seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
        }
        
        set((s) => ({
          squadPlayers: [...s.squadPlayers, newPlayer],
          balance: s.balance - fee,
          weeklyExpenses: s.weeklyExpenses + (player.contract?.salary || 50000)
        }))
      },
      
      loanPlayer: (player, weeks, salary) => {
        const state = get()
        
        const loanedPlayer: Player = {
          ...player,
          id: Date.now(),
          joinedClubWeek: state.currentWeek,
          joinedClubSeason: state.currentSeason,
          isLoanedIn: true,
          loanEndWeek: state.currentWeek + weeks,
          contract: { salary, endDate: state.currentWeek + weeks, releaseClause: null, signedWeek: state.currentWeek, signedSeason: state.currentSeason },
          seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
        }
        
        set((s) => ({
          squadPlayers: [...s.squadPlayers, loanedPlayer],
          weeklyExpenses: s.weeklyExpenses + salary
        }))
      },
      
      hireScout: (scout) => {
        set((s) => ({
          scouts: [...s.scouts, scout],
          weeklyExpenses: s.weeklyExpenses + scout.salary
        }))
      },
      
      startScoutSearch: (scoutId, region) => {
        set((s) => ({
          scouts: s.scouts.map(scout =>
            scout.id === scoutId
              ? { ...scout, isSearching: true, searchProgress: 0, region }
              : scout
          )
        }))
      },
      
      simulateOtherMatches: () => {
        // Simula partidas de outros times e atualiza classificacao
        // Implementacao simplificada
        set((s) => {
          const updatedStandings = s.serieAStandings.map(entry => ({
            ...entry,
            // Logica de simulacao de resultados
          }))
          return { serieAStandings: updatedStandings }
        })
      },
      
      generateAIOffers: () => {
        const state = get()
        
        // Chance de gerar ofertas (20% por semana)
        if (Math.random() > 0.2) return
        
        // Seleciona jogadores atraentes (overall >= 75, idade < 30)
        const attractivePlayers = state.squadPlayers.filter(p => 
          p.overall >= 75 && p.age < 30 && !p.isLoanedIn
        )
        
        if (attractivePlayers.length === 0) return
        
        // Seleciona um jogador aleatorio
        const targetPlayer = attractivePlayers[Math.floor(Math.random() * attractivePlayers.length)]
        
        // Seleciona um time para fazer oferta
        const possibleTeams = AI_TEAMS.filter(t => t.budget >= targetPlayer.marketValue * 0.5)
        if (possibleTeams.length === 0) return
        
        const buyingTeam = possibleTeams[Math.floor(Math.random() * possibleTeams.length)]
        
        // Determina tipo de oferta
        const isLoan = Math.random() < 0.3 || buyingTeam.budget < targetPlayer.marketValue
        
        // Calcula valor da oferta
        let offerAmount: number
        if (isLoan) {
          // Emprestimo: paga parte do salario
          offerAmount = targetPlayer.contract?.salary ? Math.round(targetPlayer.contract.salary * 4 * (0.5 + Math.random() * 0.5)) : 100000
        } else {
          // Compra: 60-120% do valor de mercado
          const multiplier = 0.6 + Math.random() * 0.6
          offerAmount = Math.round(targetPlayer.marketValue * multiplier)
        }
        
        const newOffer: TransferOffer = {
          id: Date.now(),
          playerId: targetPlayer.id,
          playerName: targetPlayer.name,
          fromTeam: buyingTeam.name,
          offerType: isLoan ? "emprestimo" : "compra",
          offerAmount,
          wageCoverage: isLoan ? Math.round(50 + Math.random() * 50) : undefined,
          loanWeeks: isLoan ? Math.round(26 + Math.random() * 26) : undefined,
          status: "pendente",
          createdWeek: state.currentWeek,
          expiresWeek: state.currentWeek + 3
        }
        
        set((s) => ({
          transferOffers: [...s.transferOffers, newOffer]
        }))
      },
      
      respondToOffer: (offerId: number, accept: boolean) => {
        const state = get()
        const offer = state.transferOffers.find(o => o.id === offerId)
        
        if (!offer || offer.status !== "pendente") return
        
        if (accept) {
          const player = state.squadPlayers.find(p => p.id === offer.playerId)
          if (!player) return
          
          if (offer.offerType === "compra") {
            // Vende o jogador
            set((s) => ({
              squadPlayers: s.squadPlayers.filter(p => p.id !== offer.playerId),
              balance: s.balance + offer.offerAmount,
              transferBudget: s.transferBudget + offer.offerAmount,
              weeklyExpenses: s.weeklyExpenses - (player.contract?.salary || 0),
              transferOffers: s.transferOffers.map(o => 
                o.id === offerId ? { ...o, status: "aceita" as const } : o
              )
            }))
          } else {
            // Empresta o jogador
            const loanedPlayer = {
              ...player,
              isLoanedIn: false, // Saindo por emprestimo
              loanEndWeek: state.currentWeek + (offer.loanWeeks || 26),
              parentClub: offer.fromTeam
            }
            
            set((s) => ({
              squadPlayers: s.squadPlayers.filter(p => p.id !== offer.playerId),
              balance: s.balance + offer.offerAmount,
              weeklyExpenses: s.weeklyExpenses - (player.contract?.salary || 0) * ((offer.wageCoverage || 100) / 100),
              transferOffers: s.transferOffers.map(o => 
                o.id === offerId ? { ...o, status: "aceita" as const } : o
              )
            }))
          }
        } else {
          set((s) => ({
            transferOffers: s.transferOffers.map(o => 
              o.id === offerId ? { ...o, status: "rejeitada" as const } : o
            )
          }))
        }
      },
      
      drawCopaBracket: () => {
        // Sorteia chaves da Copa do Brasil
        set((s) => ({
          copaBrasil: [
            {
              round: "oitavas",
              matches: [
                { id: 1, team1: "FLA", team2: "COR", score1: null, score2: null, winner: null, nextMatchId: 5 },
                { id: 2, team1: "PAL", team2: "SAO", score1: null, score2: null, winner: null, nextMatchId: 5 },
                { id: 3, team1: "GRE", team2: "INT", score1: null, score2: null, winner: null, nextMatchId: 6 },
                { id: 4, team1: "BGT", team2: "BOT", score1: null, score2: null, winner: null, nextMatchId: 6 },
              ]
            }
          ]
        }))
      },
      
      updateStandings: (result) => {
        set((s) => {
          const standings = [...s.serieAStandings]
          
          const homeEntry = standings.find(e => e.teamShort === result.homeTeam)
          const awayEntry = standings.find(e => e.teamShort === result.awayTeam)
          
          if (homeEntry && awayEntry) {
            homeEntry.played++
            awayEntry.played++
            homeEntry.goalsFor += result.homeScore
            homeEntry.goalsAgainst += result.awayScore
            awayEntry.goalsFor += result.awayScore
            awayEntry.goalsAgainst += result.homeScore
            
            if (result.homeScore > result.awayScore) {
              homeEntry.won++
              homeEntry.points += 3
              awayEntry.lost++
              homeEntry.form = [...homeEntry.form.slice(1), "W"]
              awayEntry.form = [...awayEntry.form.slice(1), "L"]
            } else if (result.homeScore < result.awayScore) {
              awayEntry.won++
              awayEntry.points += 3
              homeEntry.lost++
              homeEntry.form = [...homeEntry.form.slice(1), "L"]
              awayEntry.form = [...awayEntry.form.slice(1), "W"]
            } else {
              homeEntry.drawn++
              awayEntry.drawn++
              homeEntry.points++
              awayEntry.points++
              homeEntry.form = [...homeEntry.form.slice(1), "D"]
              awayEntry.form = [...awayEntry.form.slice(1), "D"]
            }
          }
          
          // Ordenar por pontos, saldo de gols, gols marcados
          standings.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points
            const sgA = a.goalsFor - a.goalsAgainst
            const sgB = b.goalsFor - b.goalsAgainst
            if (sgB !== sgA) return sgB - sgA
            return b.goalsFor - a.goalsFor
          })
          
          return { serieAStandings: standings, matchResults: [...s.matchResults, result] }
        })
      },
      
      callUpPlayer: (playerId, call) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId ? { ...p, calledUp: true } : p
          ),
          nationalTeamCalls: [...s.nationalTeamCalls, call]
        }))
      },
      
      returnFromNationalTeam: (playerId) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId ? { ...p, calledUp: false, energy: Math.max(50, p.energy - 20) } : p
          ),
          nationalTeamCalls: s.nationalTeamCalls.filter(c => c.playerId !== playerId)
        }))
      },
      
      getPlayerById: (playerId) => {
        return get().squadPlayers.find(p => p.id === playerId)
      },
      
      updatePlayerStats: (playerId, stats) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId 
              ? { ...p, seasonStats: { ...p.seasonStats, ...stats } }
              : p
          )
        }))
      },
      
      injurePlayer: (playerId, injury) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId 
              ? { ...p, injury, morale: "Infeliz" }
              : p
          )
        }))
      },
      
      healPlayer: (playerId) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId 
              ? { ...p, injury: null, energy: 70 }
              : p
          )
        }))
      },
      
      initializeGame: (teamShort) => {
        // Inicializa classificacoes
        const serieAStandings: StandingsEntry[] = [
          "BOT", "PAL", "FLA", "FOR", "INT", "SAO", "COR", "BAH", "CRU", "CAM",
          "FLU", "VAS", "GRE", "VIT", "CAP", "JUV", "SAN", "MIR", "SPT", "CEA"
        ].map(team => ({
          teamShort: team,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
          form: []
        }))
        
        set({
          currentWeek: 0,
          currentSeason: 2026,
          serieAStandings,
          copaBrasil: [],
          matchResults: [],
          headToHeadRecords: [],
          topScorers: []
        })
      },
      
      updateHeadToHead: (result: MatchResult) => {
        set((s) => {
          const team1 = result.homeTeam < result.awayTeam ? result.homeTeam : result.awayTeam
          const team2 = result.homeTeam < result.awayTeam ? result.awayTeam : result.homeTeam
          
          const existingRecord = s.headToHeadRecords.find(
            h => h.team1 === team1 && h.team2 === team2
          )
          
          const newMatch: HeadToHeadMatch = {
            season: result.season,
            week: result.week,
            competition: result.competition,
            homeTeam: result.homeTeam,
            awayTeam: result.awayTeam,
            homeScore: result.homeScore,
            awayScore: result.awayScore
          }
          
          if (existingRecord) {
            // Atualiza registro existente
            const isTeam1Home = result.homeTeam === team1
            const team1Score = isTeam1Home ? result.homeScore : result.awayScore
            const team2Score = isTeam1Home ? result.awayScore : result.homeScore
            
            return {
              headToHeadRecords: s.headToHeadRecords.map(h => {
                if (h.team1 === team1 && h.team2 === team2) {
                  return {
                    ...h,
                    matches: [...h.matches, newMatch],
                    team1Wins: h.team1Wins + (team1Score > team2Score ? 1 : 0),
                    team2Wins: h.team2Wins + (team2Score > team1Score ? 1 : 0),
                    draws: h.draws + (team1Score === team2Score ? 1 : 0),
                    team1Goals: h.team1Goals + team1Score,
                    team2Goals: h.team2Goals + team2Score
                  }
                }
                return h
              })
            }
          } else {
            // Cria novo registro
            const isTeam1Home = result.homeTeam === team1
            const team1Score = isTeam1Home ? result.homeScore : result.awayScore
            const team2Score = isTeam1Home ? result.awayScore : result.homeScore
            
            const newRecord: HeadToHead = {
              team1,
              team2,
              matches: [newMatch],
              team1Wins: team1Score > team2Score ? 1 : 0,
              team2Wins: team2Score > team1Score ? 1 : 0,
              draws: team1Score === team2Score ? 1 : 0,
              team1Goals: team1Score,
              team2Goals: team2Score
            }
            
            return {
              headToHeadRecords: [...s.headToHeadRecords, newRecord]
            }
          }
        })
      },
      
      getHeadToHead: (team1: string, team2: string) => {
        const state = get()
        const t1 = team1 < team2 ? team1 : team2
        const t2 = team1 < team2 ? team2 : team1
        return state.headToHeadRecords.find(h => h.team1 === t1 && h.team2 === t2) || null
      },
      
      checkContractBonuses: (playerId: number) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => {
            if (p.id !== playerId || !p.contract) return p
            
            const updatedBonuses = p.contract.bonuses.map(bonus => {
              if (bonus.achieved) return bonus
              
              let currentValue = 0
              switch (bonus.type) {
                case "goals":
                  currentValue = p.seasonStats.goals
                  break
                case "assists":
                  currentValue = p.seasonStats.assists
                  break
                case "appearances":
                  currentValue = p.seasonStats.matchesPlayed
                  break
                case "cleanSheets":
                  currentValue = p.seasonStats.cleanSheets
                  break
                case "nationalTeam":
                  currentValue = p.calledUp ? 1 : 0
                  break
                case "titles":
                  // Implementar quando tiver sistema de titulos
                  currentValue = 0
                  break
              }
              
              if (currentValue >= bonus.threshold) {
                return { ...bonus, achieved: true }
              }
              return bonus
            })
            
            // Calcula bonus total a pagar
            const bonusTotal = updatedBonuses
              .filter(b => b.achieved && !p.contract?.bonuses.find(ob => ob.type === b.type)?.achieved)
              .reduce((sum, b) => sum + b.amount, 0)
            
            return {
              ...p,
              contract: {
                ...p.contract,
                bonuses: updatedBonuses
              }
            }
          })
        }))
      }
    }),
    {
      name: 'ultrafoot-game-engine',
    }
  )
)

// ============================================
// HELPERS
// ============================================

export function formatWeeksToDate(weeks: number, startSeason: number): string {
  const totalWeeks = weeks
  const years = Math.floor(totalWeeks / 52)
  const remainingWeeks = totalWeeks % 52
  const season = startSeason + years
  const month = Math.floor((remainingWeeks / 52) * 12)
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${months[month]} ${season}`
}

export function getContractStatus(player: Player, currentWeek: number): "ok" | "expiring" | "expired" {
  if (!player.contract) return "expired"
  const weeksRemaining = player.contract.endDate - currentWeek
  if (weeksRemaining <= 0) return "expired"
  if (weeksRemaining <= 26) return "expiring" // 6 meses
  return "ok"
}

export function calculatePlayerGrowth(player: Player): number {
  // Calcula o crescimento baseado em potencial, idade e treinamento
  const ageFactor = player.age < 24 ? 1.5 : player.age < 28 ? 1.0 : 0.3
  const potentialGap = player.potential - player.overall
  return Math.round(potentialGap * ageFactor)
}

export function getInjuryRecoveryTime(severity: "leve" | "media" | "grave"): number {
  switch (severity) {
    case "leve": return Math.floor(Math.random() * 2) + 1 // 1-2 semanas
    case "media": return Math.floor(Math.random() * 4) + 3 // 3-6 semanas
    case "grave": return Math.floor(Math.random() * 12) + 8 // 8-20 semanas
  }
}

export const INJURY_TYPES = [
  "Distensao muscular",
  "Entorse de tornozelo",
  "Lesao no joelho",
  "Contusao",
  "Fadiga muscular",
  "Lesao no ombro",
  "Fratura"
]
