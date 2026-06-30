// Tipos de dados da carreira — usados pelo save-system e career-engine
// Sem dependências de outros módulos do jogo para evitar importações circulares.

export interface StandingEntry {
  curto: string
  nome: string
  cor1: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  form: ('W' | 'D' | 'L')[]
}

export interface MatchFixture {
  id: string
  round: number
  homeCurto: string
  awayCurto: string
  homeNome: string
  awayNome: string
  competition: string
  played: boolean
  homeGoals?: number
  awayGoals?: number
  isUserMatch: boolean
}

export interface MatchResult {
  id: string
  round: number
  season: number
  homeCurto: string
  homeNome: string
  awayCurto: string
  awayNome: string
  homeGoals: number
  awayGoals: number
  competition: string
  isUserMatch: boolean
}

export interface FinanceEntry {
  id: string
  type: 'income' | 'expense'
  description: string
  value: number
  week: number
  season: number
  category: 'tv' | 'bilheteria' | 'patrocinio' | 'premiacao' | 'salario' | 'manutencao' | 'transferencia' | 'outros'
}

export interface CareerMessage {
  id: string
  from: string
  subject: string
  preview: string
  fullContent: string
  date: string
  read: boolean
  starred: boolean
  archived: boolean
  deleted: boolean
  category: 'diretoria' | 'staff' | 'mercado' | 'competicao' | 'resultado'
  week: number
  season: number
}

export interface SeasonRecord {
  season: number
  competition: string
  position: number
  points: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  champion: string
  managerName: string
  promoted: boolean
  relegated: boolean
  teamCurto: string
  teamNome: string
}

export interface TransferRecord {
  id: string
  playerName: string
  fromTeam: string
  toTeam: string
  value: number
  type: 'buy' | 'sell' | 'loan'
  week: number
  season: number
}

/** Lesão ativa de um jogador. weeksRemaining decrementa a cada rodada. */
export interface InjuryRecord {
  playerId: string
  playerName: string
  type: 'leve' | 'moderada' | 'grave'
  weeksRemaining: number
  startedRound: number
  startedSeason: number
}

/** Mapa playerId -> stamina atual (0-100). Persistido entre rodadas. */
export type FatigueMap = Record<string, number>

/** Acumulado de envelhecimento e mudança de overall por jogador (relativo ao seed base). */
export interface PlayerProgression {
  ageDelta: number       // anos somados
  overallDelta: number   // pontos somados (pode ser negativo)
}

export type ProgressionMap = Record<string, PlayerProgression>

/** Alvo de transferência exposto ao usuário (vitrine do mercado). */
export interface MarketTarget {
  id: string
  name: string
  position: string
  age: number
  overall: number
  potential: number
  value: number
  teamCurto: string
  teamNome: string
  teamCor1: string
  trend: 'up' | 'down' | 'stable'
}

/** Partida da copa eliminatória (Copa do Brasil / Libertadores). */
export interface CupMatch {
  id: string
  cupRound: number       // 1=oitavas, 2=quartas, 3=semi, 4=final
  bracketSlot: number    // posição no chaveamento (0-7 oitavas, 0-3 quartas, etc)
  homeCurto: string
  awayCurto: string
  homeNome: string
  awayNome: string
  played: boolean
  homeGoals?: number
  awayGoals?: number
  isUserMatch: boolean
}

/** Chaveamento completo de uma copa eliminatória. */
export interface CupBracket {
  competition: string
  season: number
  matches: CupMatch[]
  champion?: string
  userEliminatedAtRound?: number
  /** Round eliminatório atual sendo disputado (1-4). 0 = não iniciado. */
  currentCupRound: number
}

/** Oferta recebida pelo usuário por algum dos seus jogadores. */
export interface IncomingOffer {
  id: string
  playerId: string         // nome do jogador (squadPlayers.name) ou base player name
  playerName: string
  fromTeamCurto: string
  fromTeamNome: string
  fromTeamCor1: string
  value: number
  reservationPrice: number  // valor minimo que CPU aceita (escondido do usuario)
  status: 'pending' | 'accepted' | 'rejected' | 'countered'
  receivedRound: number
  receivedSeason: number
  expiresInRounds: number   // expira apos N rodadas se nao respondida
}
