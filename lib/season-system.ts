// Sistema de temporada e progressao semanal para modo carreira
// Gerencia avanco de tempo, lesoes, suspensoes, moral e contratos

import type { Team } from "@/lib/teams-data"

// Tipos de lesao
export type InjuryType = 
  | "muscle_strain"      // Distensao muscular (1-3 semanas)
  | "sprain"             // Entorse (2-4 semanas)
  | "ligament"           // Ligamento (4-8 semanas)
  | "fracture"           // Fratura (8-16 semanas)
  | "concussion"         // Concussao (1-2 semanas)
  | "fatigue"            // Fadiga (1 semana)

export interface Injury {
  type: InjuryType
  weeksRemaining: number
  description: string
}

export interface Suspension {
  reason: "yellow_accumulation" | "red_card" | "other"
  matchesRemaining: number
  description: string
}

export interface Contract {
  weeksRemaining: number
  weeklySalary: number
  releaseClause: number | null
  bonuses: {
    goalBonus: number
    cleanSheetBonus: number
    winBonus: number
  }
}

export interface PlayerStats {
  goals: number
  assists: number
  cleanSheets: number
  yellowCards: number
  redCards: number
  matchesPlayed: number
  minutesPlayed: number
  avgRating: number
  totalRatings: number
}

export interface PlayerCareerData {
  playerId: string
  name: string
  position: string
  age: number
  overall: number
  potential: number
  baseAttributes: {
    pace: number
    shooting: number
    passing: number
    dribbling: number
    defending: number
    physical: number
  }
  currentAttributes: {
    pace: number
    shooting: number
    passing: number
    dribbling: number
    defending: number
    physical: number
  }
  condition: number       // 0-100 (stamina/fadiga)
  morale: number          // 0-100
  form: number            // 0-100 (forma recente)
  sharpness: number       // 0-100 (entrosamento)
  injury: Injury | null
  suspension: Suspension | null
  contract: Contract
  stats: PlayerStats
  trainingFocus: "balanced" | "pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical" | null
}

export interface SeasonData {
  year: number
  week: number
  competitionResults: {
    brasileirao: {
      position: number
      points: number
      wins: number
      draws: number
      losses: number
      goalsFor: number
      goalsAgainst: number
    }
    copaDoBrasil: {
      eliminated: boolean
      currentRound: string
    }
    libertadores: {
      qualified: boolean
      eliminated: boolean
      currentRound: string
    }
    estadual: {
      champion: boolean
      currentRound: string
    }
  }
  transfersIn: { player: string; fee: number; week: number }[]
  transfersOut: { player: string; fee: number; week: number }[]
  matchHistory: MatchRecord[]
}

export interface MatchRecord {
  week: number
  competition: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  wasUserMatch: boolean
  goalScorers: { player: string; minute: number }[]
  cards: { player: string; type: "yellow" | "red"; minute: number }[]
  injuries: { player: string; type: InjuryType }[]
}

// Constantes do sistema
export const INJURY_DURATIONS: Record<InjuryType, [number, number]> = {
  muscle_strain: [1, 3],
  sprain: [2, 4],
  ligament: [4, 8],
  fracture: [8, 16],
  concussion: [1, 2],
  fatigue: [1, 1],
}

export const INJURY_LABELS: Record<InjuryType, string> = {
  muscle_strain: "Distensao muscular",
  sprain: "Entorse",
  ligament: "Lesao ligamentar",
  fracture: "Fratura",
  concussion: "Concussao",
  fatigue: "Fadiga extrema",
}

export const SUSPENSION_YELLOW_THRESHOLD = 5 // Cartoes amarelos para suspensao

// Funcoes do sistema de temporada

export function createInitialPlayerCareerData(
  player: { nome: string; pos: string; idade: number; base: number },
  teamSalaryFactor: number = 1
): PlayerCareerData {
  const overall = player.base
  const potential = Math.min(99, overall + Math.floor(Math.random() * 10) + (player.idade < 23 ? 5 : 0))
  
  // Gera atributos baseados na posicao e overall
  const baseAttrs = generateAttributesForPosition(player.pos, overall)
  
  // Calcula salario baseado no overall
  const weeklySalary = Math.floor((overall * overall * 50 + Math.random() * 10000) * teamSalaryFactor)
  
  // Contrato inicial de 1-4 anos
  const contractYears = Math.floor(Math.random() * 4) + 1
  
  return {
    playerId: `${player.nome.replace(/\s/g, "_").toLowerCase()}_${Date.now()}`,
    name: player.nome,
    position: player.pos,
    age: player.idade,
    overall,
    potential,
    baseAttributes: { ...baseAttrs },
    currentAttributes: { ...baseAttrs },
    condition: 85 + Math.floor(Math.random() * 15),
    morale: 60 + Math.floor(Math.random() * 30),
    form: 50 + Math.floor(Math.random() * 30),
    sharpness: 40 + Math.floor(Math.random() * 40),
    injury: null,
    suspension: null,
    contract: {
      weeksRemaining: contractYears * 52,
      weeklySalary,
      releaseClause: overall >= 80 ? weeklySalary * 200 : null,
      bonuses: {
        goalBonus: Math.floor(weeklySalary * 0.1),
        cleanSheetBonus: Math.floor(weeklySalary * 0.05),
        winBonus: Math.floor(weeklySalary * 0.02),
      },
    },
    stats: {
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      matchesPlayed: 0,
      minutesPlayed: 0,
      avgRating: 0,
      totalRatings: 0,
    },
    trainingFocus: null,
  }
}

function generateAttributesForPosition(position: string, overall: number): {
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
} {
  const variance = () => Math.floor(Math.random() * 15) - 7
  
  switch (position) {
    case "GOL":
      return {
        pace: Math.max(30, Math.min(90, overall - 25 + variance())),
        shooting: Math.max(20, Math.min(50, overall - 40 + variance())),
        passing: Math.max(40, Math.min(80, overall - 10 + variance())),
        dribbling: Math.max(30, Math.min(70, overall - 20 + variance())),
        defending: Math.max(50, Math.min(95, overall + 5 + variance())),
        physical: Math.max(50, Math.min(90, overall - 5 + variance())),
      }
    case "ZAG":
    case "LD":
    case "LE":
      return {
        pace: Math.max(50, Math.min(90, overall - 5 + variance())),
        shooting: Math.max(30, Math.min(70, overall - 15 + variance())),
        passing: Math.max(50, Math.min(85, overall - 5 + variance())),
        dribbling: Math.max(40, Math.min(80, overall - 10 + variance())),
        defending: Math.max(60, Math.min(95, overall + 5 + variance())),
        physical: Math.max(60, Math.min(95, overall + variance())),
      }
    case "VOL":
      return {
        pace: Math.max(50, Math.min(85, overall - 5 + variance())),
        shooting: Math.max(45, Math.min(80, overall - 5 + variance())),
        passing: Math.max(60, Math.min(90, overall + variance())),
        dribbling: Math.max(55, Math.min(85, overall - 5 + variance())),
        defending: Math.max(60, Math.min(90, overall + variance())),
        physical: Math.max(60, Math.min(90, overall + variance())),
      }
    case "MEI":
      return {
        pace: Math.max(55, Math.min(90, overall - 5 + variance())),
        shooting: Math.max(55, Math.min(90, overall + variance())),
        passing: Math.max(65, Math.min(95, overall + 5 + variance())),
        dribbling: Math.max(65, Math.min(95, overall + 5 + variance())),
        defending: Math.max(40, Math.min(75, overall - 15 + variance())),
        physical: Math.max(50, Math.min(85, overall - 5 + variance())),
      }
    case "ATA":
    case "PD":
    case "PE":
    default:
      return {
        pace: Math.max(65, Math.min(99, overall + 5 + variance())),
        shooting: Math.max(65, Math.min(99, overall + 5 + variance())),
        passing: Math.max(50, Math.min(85, overall - 5 + variance())),
        dribbling: Math.max(65, Math.min(95, overall + variance())),
        defending: Math.max(25, Math.min(60, overall - 25 + variance())),
        physical: Math.max(50, Math.min(85, overall - 5 + variance())),
      }
  }
}

// Avanca uma semana no jogo
export function advanceWeek(
  players: PlayerCareerData[],
  teamMorale: number
): { updatedPlayers: PlayerCareerData[]; events: string[] } {
  const events: string[] = []
  
  const updatedPlayers = players.map(player => {
    const updated = { ...player }
    
    // Reduz tempo de lesao
    if (updated.injury) {
      updated.injury = { ...updated.injury }
      updated.injury.weeksRemaining -= 1
      if (updated.injury.weeksRemaining <= 0) {
        events.push(`${player.name} se recuperou da lesao`)
        updated.injury = null
        updated.condition = 60 // Volta com condicao reduzida
      }
    }
    
    // Reduz tempo de suspensao
    if (updated.suspension) {
      updated.suspension = { ...updated.suspension }
      updated.suspension.matchesRemaining -= 1
      if (updated.suspension.matchesRemaining <= 0) {
        events.push(`${player.name} cumpriu suspensao`)
        updated.suspension = null
      }
    }
    
    // Reduz tempo de contrato
    updated.contract = { ...updated.contract }
    updated.contract.weeksRemaining -= 1
    if (updated.contract.weeksRemaining <= 26 && updated.contract.weeksRemaining % 4 === 0) {
      events.push(`Contrato de ${player.name} expira em ${Math.floor(updated.contract.weeksRemaining / 4)} meses`)
    }
    
    // Recuperacao de condicao (se nao lesionado)
    if (!updated.injury) {
      updated.condition = Math.min(100, updated.condition + 15)
    }
    
    // Efeito do treino
    if (updated.trainingFocus && !updated.injury) {
      const improvement = Math.random() < 0.3 ? 1 : 0 // 30% de chance de melhoria
      if (improvement > 0 && updated.trainingFocus !== "balanced") {
        const attr = updated.trainingFocus as keyof typeof updated.currentAttributes
        updated.currentAttributes = { ...updated.currentAttributes }
        updated.currentAttributes[attr] = Math.min(99, updated.currentAttributes[attr] + 1)
        
        // Chance de lesao durante treino intenso
        if (Math.random() < 0.02) { // 2% de chance
          const injuryType: InjuryType = Math.random() < 0.7 ? "muscle_strain" : "fatigue"
          const [min, max] = INJURY_DURATIONS[injuryType]
          updated.injury = {
            type: injuryType,
            weeksRemaining: min + Math.floor(Math.random() * (max - min + 1)),
            description: INJURY_LABELS[injuryType],
          }
          events.push(`${player.name} sofreu ${INJURY_LABELS[injuryType]} durante o treino`)
        }
      }
    }
    
    // Ajuste de moral baseado no time
    const moraleDiff = (teamMorale - 50) * 0.1
    updated.morale = Math.max(10, Math.min(100, updated.morale + moraleDiff + (Math.random() - 0.5) * 5))
    
    // Envelhecimento anual (na semana 1)
    // Isso sera tratado separadamente no sistema de temporada
    
    return updated
  })
  
  return { updatedPlayers, events }
}

// Aplica resultado de partida aos jogadores
export function applyMatchResult(
  players: PlayerCareerData[],
  matchData: {
    playersUsed: string[]       // IDs dos jogadores que jogaram
    minutesPlayed: Record<string, number>
    goals: Record<string, number>
    assists: Record<string, number>
    yellowCards: string[]
    redCards: string[]
    cleanSheet: boolean
    won: boolean
    ratings: Record<string, number>
  }
): { updatedPlayers: PlayerCareerData[]; events: string[] } {
  const events: string[] = []
  
  const updatedPlayers = players.map(player => {
    if (!matchData.playersUsed.includes(player.playerId)) {
      return player
    }
    
    const updated = { ...player }
    updated.stats = { ...updated.stats }
    
    const minutes = matchData.minutesPlayed[player.playerId] || 0
    updated.stats.matchesPlayed += 1
    updated.stats.minutesPlayed += minutes
    updated.stats.goals += matchData.goals[player.playerId] || 0
    updated.stats.assists += matchData.assists[player.playerId] || 0
    
    // Cartoes
    if (matchData.yellowCards.includes(player.playerId)) {
      updated.stats.yellowCards += 1
      
      // Verifica acumulo de amarelos
      if (updated.stats.yellowCards >= SUSPENSION_YELLOW_THRESHOLD && 
          updated.stats.yellowCards % SUSPENSION_YELLOW_THRESHOLD === 0) {
        updated.suspension = {
          reason: "yellow_accumulation",
          matchesRemaining: 1,
          description: "Suspensao por acumulo de cartoes amarelos",
        }
        events.push(`${player.name} suspenso por acumulo de cartoes`)
      }
    }
    
    if (matchData.redCards.includes(player.playerId)) {
      updated.stats.redCards += 1
      updated.suspension = {
        reason: "red_card",
        matchesRemaining: 1 + Math.floor(Math.random() * 2), // 1-2 jogos
        description: "Suspensao por cartao vermelho",
      }
      events.push(`${player.name} suspenso por cartao vermelho`)
    }
    
    // Clean sheet para goleiros/defensores
    if (matchData.cleanSheet && ["GOL", "ZAG", "LD", "LE"].includes(updated.position)) {
      updated.stats.cleanSheets += 1
    }
    
    // Rating da partida
    const rating = matchData.ratings[player.playerId] || 6.5
    updated.stats.totalRatings += rating
    updated.stats.avgRating = updated.stats.totalRatings / updated.stats.matchesPlayed
    
    // Atualiza forma baseada no rating
    const formDelta = (rating - 6.5) * 5
    updated.form = Math.max(0, Math.min(100, updated.form + formDelta))
    
    // Atualiza condicao baseada nos minutos jogados
    const conditionLoss = Math.floor(minutes * 0.3)
    updated.condition = Math.max(0, updated.condition - conditionLoss)
    
    // Moral baseado no resultado
    if (matchData.won) {
      updated.morale = Math.min(100, updated.morale + 5)
    } else {
      updated.morale = Math.max(0, updated.morale - 3)
    }
    
    // Chance de lesao durante a partida
    if (Math.random() < 0.03) { // 3% por jogador
      const injuryRoll = Math.random()
      let injuryType: InjuryType
      if (injuryRoll < 0.5) injuryType = "muscle_strain"
      else if (injuryRoll < 0.75) injuryType = "sprain"
      else if (injuryRoll < 0.9) injuryType = "ligament"
      else injuryType = "fracture"
      
      const [min, max] = INJURY_DURATIONS[injuryType]
      updated.injury = {
        type: injuryType,
        weeksRemaining: min + Math.floor(Math.random() * (max - min + 1)),
        description: INJURY_LABELS[injuryType],
      }
      events.push(`${player.name} sofreu ${INJURY_LABELS[injuryType]}!`)
    }
    
    return updated
  })
  
  return { updatedPlayers, events }
}

// Verifica se jogador pode jogar
export function canPlayerPlay(player: PlayerCareerData): {
  canPlay: boolean
  reason?: string
} {
  if (player.injury) {
    return { canPlay: false, reason: `Lesionado: ${player.injury.description} (${player.injury.weeksRemaining} semanas)` }
  }
  if (player.suspension) {
    return { canPlay: false, reason: `Suspenso: ${player.suspension.description} (${player.suspension.matchesRemaining} jogos)` }
  }
  if (player.condition < 30) {
    return { canPlay: false, reason: "Condicao fisica muito baixa" }
  }
  return { canPlay: true }
}

// Calcula overall dinamico baseado em condicao/forma/moral
export function calculateEffectiveOverall(player: PlayerCareerData): number {
  const base = player.overall
  
  // Modificadores
  const conditionMod = (player.condition - 70) * 0.05 // -1.5 a +1.5
  const formMod = (player.form - 50) * 0.1           // -5 a +5
  const moraleMod = (player.morale - 50) * 0.05     // -2.5 a +2.5
  const sharpnessMod = (player.sharpness - 50) * 0.03 // -1.5 a +1.5
  
  const effective = base + conditionMod + formMod + moraleMod + sharpnessMod
  
  return Math.max(40, Math.min(99, Math.round(effective)))
}

// Inicializa dados de temporada
export function createInitialSeasonData(year: number): SeasonData {
  return {
    year,
    week: 0,
    competitionResults: {
      brasileirao: {
        position: 0,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      },
      copaDoBrasil: {
        eliminated: false,
        currentRound: "Primeira Fase",
      },
      libertadores: {
        qualified: false,
        eliminated: false,
        currentRound: "Fase de Grupos",
      },
      estadual: {
        champion: false,
        currentRound: "Fase de Grupos",
      },
    },
    transfersIn: [],
    transfersOut: [],
    matchHistory: [],
  }
}
