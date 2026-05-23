// Motor de simulação de partida em tempo real - Ultrafoot 26
// Gera eventos probabilísticos baseados em rating dos times,
// atualiza placar, posse, finalizações, xG, escanteios, faltas, etc.

import type { Team } from "@/lib/teams-data"

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type MatchSpeed = "slow" | "normal" | "fast" | "ultra" | "hyper"

export const SPEED_TICKS_PER_SEC: Record<MatchSpeed, number> = {
  slow: 1,    // 1 minuto de jogo / segundo
  normal: 2,  // 2 min / s
  fast: 5,    // 5 min / s
  ultra: 12,  // 12 min / s
  hyper: 30,  // partida termina em ~3s
}

export type MatchPhase =
  | "pre"       // antes do apito
  | "first"     // 1º tempo (0-45)
  | "halftime"  // intervalo
  | "second"    // 2º tempo (45-90)
  | "fulltime"  // partida encerrada

export type EventType =
  | "kickoff"
  | "goal"
  | "shot"
  | "shot_on_target"
  | "miss"
  | "post"
  | "corner"
  | "foul"
  | "yellow_card"
  | "red_card"
  | "penalty"
  | "save"
  | "sub"
  | "halftime"
  | "fulltime"
  | "var"

export type Side = "home" | "away"

export interface MatchEvent {
  id: string
  minute: number
  addedTime?: number
  type: EventType
  side: Side
  text: string
  player?: string
  // Para destaque visual
  important?: boolean
}

export interface TeamStats {
  goals: number
  shots: number
  shotsOnTarget: number
  xG: number
  corners: number
  fouls: number
  yellows: number
  reds: number
  possession: number // 0-100 (somam ~100 com adversário)
  passes: number
  passAccuracy: number
}

export interface BallPosition {
  x: number // 0-100 (0=gol mandante, 100=gol visitante)
  y: number // 0-100
  side: Side // qual time tem a bola
}

export interface MatchState {
  phase: MatchPhase
  minute: number
  addedTime: number
  home: TeamStats
  away: TeamStats
  events: MatchEvent[]
  ball: BallPosition
  // Highlight visual transitório
  flash: { side: Side; type: "goal" | "card" | "chance"; cardColor?: "yellow" | "red" } | null
}

export interface MatchConfig {
  homeTeam: Team
  awayTeam: Team
  homeRating: number  // 50-95
  awayRating: number  // 50-95
  durationMinutes?: number // padrao 90
  weatherFactor?: number // 0.8-1.2 (chuva reduz precisao)
  // Squads (opcional, para nomear eventos)
  homeSquad?: { nome: string; pos: string }[]
  awaySquad?: { nome: string; pos: string }[]
  
  // Novos modificadores de partida
  modifiers?: MatchModifiers
}

// Modificadores que afetam a partida
export interface MatchModifiers {
  // Fator casa/fora
  homeAdvantageBoost: number // 0-25 pontos extras para mandante (baseado em infraestrutura)
  crowdPressure: number // 0-25 pressao da torcida (debuff visitante)
  
  // Clima
  weather: "sol" | "nublado" | "chuva" | "tempestade"
  temperature: number // celsius (extremos afetam desempenho)
  
  // Altitude (metros)
  altitude: number // >2500 = severo, >1500 = moderado
  
  // Rivalidade
  isDerby: boolean
  derbyIntensity: number // 0-100 (afeta cartoes e intensidade)
  
  // Importancia
  matchImportance: "normal" | "decisivo" | "final"
  
  // Gramado
  pitchQuality: number // 1-5 (afeta passe e drible)
  pitchHeight: "baixo" | "medio" | "alto"
  
  // Efeitos calculados
  staminaDrainMultiplier: number // >1 = drena mais rapido
  technicalPenalty: number // reducao em passe/drible
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado inicial
// ─────────────────────────────────────────────────────────────────────────────

const emptyTeamStats = (): TeamStats => ({
  goals: 0,
  shots: 0,
  shotsOnTarget: 0,
  xG: 0,
  corners: 0,
  fouls: 0,
  yellows: 0,
  reds: 0,
  possession: 50,
  passes: 0,
  passAccuracy: 80,
})

export function createInitialState(): MatchState {
  return {
    phase: "pre",
    minute: 0,
    addedTime: 0,
    home: emptyTeamStats(),
    away: emptyTeamStats(),
    events: [],
    ball: { x: 50, y: 50, side: "home" },
    flash: null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RNG
// ─────────────────────────────────────────────────────────────────────────────

function rnd(): number {
  return Math.random()
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)]
}

function nameId(): string {
  return Math.random().toString(36).slice(2, 9)
}

// ─────────────────────────────────────────────────────────────────────────────
// Geração de eventos
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_HOME_NAMES = [
  "Silva", "Santos", "Oliveira", "Costa", "Pereira",
  "Lima", "Almeida", "Rodrigues", "Souza", "Ferreira",
]
const FALLBACK_AWAY_NAMES = [
  "Martins", "Gomes", "Carvalho", "Ribeiro", "Araujo",
  "Barbosa", "Rocha", "Dias", "Cardoso", "Teixeira",
]

function pickPlayer(side: Side, config: MatchConfig, posFilter?: string[]): string {
  const squad = side === "home" ? config.homeSquad : config.awaySquad
  if (squad && squad.length > 0) {
    const pool = posFilter
      ? squad.filter(p => posFilter.includes(p.pos))
      : squad
    if (pool.length > 0) return pick(pool).nome
    return pick(squad).nome
  }
  return pick(side === "home" ? FALLBACK_HOME_NAMES : FALLBACK_AWAY_NAMES)
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo de probabilidades por minuto
// ─────────────────────────────────────────────────────────────────────────────

interface MinuteProbs {
  shotChance: number       // chance de finalizacao (qualquer time)
  homeAdvantage: number    // 0..1, % chance de o evento ser do mandante
  cornerChance: number
  foulChance: number
  cardChance: number
  technicalPenalty: number // reducao em precisao (clima, gramado)
  staminaDrain: number     // multiplicador de desgaste
}

function calcProbs(config: MatchConfig): MinuteProbs {
  const mods = config.modifiers
  const total = config.homeRating + config.awayRating
  
  // Calcula vantagem em casa baseada em infraestrutura e modificadores
  let homeBoost = 5 // base
  
  if (mods) {
    // Infraestrutura do estadio aumenta vantagem
    homeBoost += (mods.homeAdvantageBoost || 0) * 0.4
    
    // Pressao da torcida reduz performance visitante (aumenta chance do mandante)
    homeBoost += (mods.crowdPressure || 0) * 0.3
    
    // Derby aumenta volatilidade
    if (mods.isDerby) {
      homeBoost += 3
    }
    
    // Partidas decisivas aumentam pressao
    if (mods.matchImportance === "decisivo") homeBoost += 2
    if (mods.matchImportance === "final") homeBoost += 4
  }
  
  const homeAdvantage = Math.min(0.7, (config.homeRating + homeBoost) / (total + homeBoost))

  // Times fortes finalizam mais
  const avg = total / 2
  const shotChance = Math.min(0.55, 0.18 + (avg - 60) * 0.012)
  
  // Calcula penalidade tecnica (clima, gramado)
  let technicalPenalty = 0
  if (mods) {
    technicalPenalty = mods.technicalPenalty || 0
    
    // Clima afeta precisao
    if (mods.weather === "chuva") technicalPenalty += 8
    if (mods.weather === "tempestade") technicalPenalty += 15
    
    // Gramado ruim afeta toque de bola
    if (mods.pitchQuality && mods.pitchQuality < 3) {
      technicalPenalty += (3 - mods.pitchQuality) * 4
    }
    if (mods.pitchHeight === "alto") {
      technicalPenalty += 5
    }
  }
  
  // Multiplicador de desgaste (altitude, calor)
  let staminaDrain = 1
  if (mods) {
    staminaDrain = mods.staminaDrainMultiplier || 1
    
    // Altitude afeta muito o desgaste
    if (mods.altitude > 2500) staminaDrain = Math.max(staminaDrain, 1.5)
    else if (mods.altitude > 1500) staminaDrain = Math.max(staminaDrain, 1.25)
    
    // Calor extremo
    if (mods.temperature > 35) staminaDrain *= 1.2
    else if (mods.temperature > 30) staminaDrain *= 1.1
  }
  
  // Derby aumenta faltas e cartoes
  let foulChance = 0.22
  let cardChance = 0.04
  if (mods?.isDerby) {
    foulChance = 0.30
    cardChance = 0.08
  }
  if (mods?.matchImportance === "final") {
    foulChance = 0.28
    cardChance = 0.06
  }

  return {
    shotChance,
    homeAdvantage,
    cornerChance: 0.16,
    foulChance,
    cardChance,
    technicalPenalty,
    staminaDrain,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tick: avança 1 minuto de partida
// ──────────────────────────────────────────────────────────────────────���──────

export function tickMinute(state: MatchState, config: MatchConfig): MatchState {
  if (state.phase === "fulltime" || state.phase === "pre") return state
  const durationMinutes =
    Number.isFinite(config.durationMinutes) && (config.durationMinutes ?? 0) > 0
      ? config.durationMinutes!
      : 90

  const next: MatchState = {
    ...state,
    home: { ...state.home },
    away: { ...state.away },
    events: state.events.slice(),
    flash: null,
  }

  const halfDuration = Math.floor(durationMinutes / 2)

  // Avança minuto
  next.minute = state.minute + 1

  // Transições de fase
  if (next.minute === halfDuration && state.phase === "first") {
    next.phase = "halftime"
    next.events = [
      {
        id: nameId(),
        minute: halfDuration,
        type: "halftime",
        side: "home",
        text: "Fim do 1º tempo",
        important: true,
      },
      ...next.events,
    ]
    next.ball = { x: 50, y: 50, side: "away" }
    return next
  }

  if (state.phase === "halftime") {
    next.phase = "second"
  }

  if (next.minute >= durationMinutes && state.phase === "second") {
    next.phase = "fulltime"
    next.events = [
      {
        id: nameId(),
        minute: durationMinutes,
        type: "fulltime",
        side: "home",
        text: `Fim de jogo. ${config.homeTeam.curto} ${state.home.goals} x ${state.away.goals} ${config.awayTeam.curto}`,
        important: true,
      },
      ...next.events,
    ]
    return next
  }

  // Kickoff
  if (next.minute === 1 && state.phase === "first") {
    next.events = [
      {
        id: nameId(),
        minute: 1,
        type: "kickoff",
        side: "home",
        text: "Bola rolando! Mandante começa o jogo",
      },
      ...next.events,
    ]
  }

  // Eventos do minuto
  generateMinuteEvents(next, config)

  // Atualiza posse acumulada (ponderada)
  updatePossession(next, config)

  // Movimenta a bola
  moveBall(next, config)

  return next
}

function generateMinuteEvents(state: MatchState, config: MatchConfig): void {
  const probs = calcProbs(config)
  const minute = state.minute

  // Possibilidade de finalização
  if (rnd() < probs.shotChance) {
    const isHome = rnd() < probs.homeAdvantage
    const side: Side = isHome ? "home" : "away"
    const teamStats = isHome ? state.home : state.away
    const oppStats = isHome ? state.away : state.home
    const teamRating = isHome ? config.homeRating : config.awayRating
    const oppRating = isHome ? config.awayRating : config.homeRating

    teamStats.shots += 1

    // xG por chute (0.05 - 0.45)
    const baseXg = 0.05 + rnd() * 0.25
    const ratingBoost = (teamRating - 70) * 0.003
    const xg = Math.max(0.02, Math.min(0.7, baseXg + ratingBoost))
    teamStats.xG += xg

    // Resolução
    const onTargetProb = 0.42 + (teamRating - oppRating) * 0.004
    const onTarget = rnd() < onTargetProb
    const goalProb = onTarget ? Math.min(0.55, xg * 1.4) : 0.02

    if (rnd() < goalProb) {
      // GOL!
      teamStats.shotsOnTarget += 1
      teamStats.goals += 1
      const scorer = pickPlayer(side, config, ["ATA", "MEI", "PD", "PE"])
      state.events = [
        {
          id: nameId(),
          minute,
          type: "goal",
          side,
          text: `GOOOOL! ${scorer} marca para o ${(isHome ? config.homeTeam : config.awayTeam).curto}!`,
          player: scorer,
          important: true,
        },
        ...state.events,
      ]
      state.flash = { side, type: "goal" }
      state.ball = { x: 50, y: 50, side: isHome ? "away" : "home" }
      return
    }

    if (onTarget) {
      teamStats.shotsOnTarget += 1
      const shooter = pickPlayer(side, config, ["ATA", "MEI", "PD", "PE"])
      const goalkeeper = pickPlayer(isHome ? "away" : "home", config, ["GOL"])
      state.events = [
        {
          id: nameId(),
          minute,
          type: "save",
          side,
          text: `${shooter} finaliza, ${goalkeeper} defende`,
          player: shooter,
        },
        ...state.events,
      ]
      state.flash = { side, type: "chance" }
    } else {
      // Trave ou para fora
      if (rnd() < 0.08) {
        const shooter = pickPlayer(side, config, ["ATA", "MEI"])
        state.events = [
          {
            id: nameId(),
            minute,
            type: "post",
            side,
            text: `${shooter} acerta a trave!`,
            player: shooter,
            important: true,
          },
          ...state.events,
        ]
        state.flash = { side, type: "chance" }
      } else {
        // Possível escanteio
        if (rnd() < 0.3) {
          teamStats.corners += 1
          state.events = [
            {
              id: nameId(),
              minute,
              type: "corner",
              side,
              text: `Escanteio para ${(isHome ? config.homeTeam : config.awayTeam).curto}`,
            },
            ...state.events,
          ]
        }
      }
    }
  }

  // Falta
  if (rnd() < probs.foulChance) {
    const isHome = rnd() < 0.5
    const side: Side = isHome ? "home" : "away"
    const teamStats = isHome ? state.home : state.away
    teamStats.fouls += 1

    // Cartão?
    if (rnd() < probs.cardChance * 1.5) {
      const isRed = rnd() < 0.06
      const player = pickPlayer(side, config, ["ZAG", "VOL", "LD", "LE"])
      if (isRed) {
        teamStats.reds += 1
        state.events = [
          {
            id: nameId(),
            minute,
            type: "red_card",
            side,
            text: `Cartão VERMELHO para ${player}`,
            player,
            important: true,
          },
          ...state.events,
        ]
        state.flash = { side, type: "card", cardColor: "red" }
      } else {
        teamStats.yellows += 1
        state.events = [
          {
            id: nameId(),
            minute,
            type: "yellow_card",
            side,
            text: `Cartão amarelo para ${player}`,
            player,
          },
          ...state.events,
        ]
        state.flash = { side, type: "card", cardColor: "yellow" }
      }
    } else {
      // Falta sem cartão (apenas registra, sem evento textual a cada uma)
      if (rnd() < 0.25) {
        const player = pickPlayer(side, config)
        state.events = [
          {
            id: nameId(),
            minute,
            type: "foul",
            side,
            text: `Falta de ${player}`,
            player,
          },
          ...state.events,
        ]
      }
    }
  }

  // Pênalti raro
  if (rnd() < 0.012) {
    const isHome = rnd() < 0.5
    const side: Side = isHome ? "home" : "away"
    const teamStats = isHome ? state.home : state.away
    const oppStats = isHome ? state.away : state.home
    oppStats.fouls += 1
    state.events = [
      {
        id: nameId(),
        minute,
        type: "penalty",
        side,
        text: `Pênalti para ${(isHome ? config.homeTeam : config.awayTeam).curto}!`,
        important: true,
      },
      ...state.events,
    ]
    // Cobrança
    if (rnd() < 0.78) {
      teamStats.goals += 1
      teamStats.shots += 1
      teamStats.shotsOnTarget += 1
      teamStats.xG += 0.76
      const scorer = pickPlayer(side, config, ["ATA", "MEI"])
      state.events = [
        {
          id: nameId(),
          minute,
          type: "goal",
          side,
          text: `GOOOL! ${scorer} converte o pênalti`,
          player: scorer,
          important: true,
        },
        ...state.events,
      ]
      state.flash = { side, type: "goal" }
    } else {
      const taker = pickPlayer(side, config, ["ATA"])
      const gk = pickPlayer(isHome ? "away" : "home", config, ["GOL"])
      state.events = [
        {
          id: nameId(),
          minute,
          type: "save",
          side,
          text: `${gk} defende o pênalti de ${taker}!`,
          important: true,
        },
        ...state.events,
      ]
      state.flash = { side, type: "chance" }
    }
  }
}

function updatePossession(state: MatchState, config: MatchConfig): void {
  // Posse tende ao rating relativo, com ruído
  const target = (config.homeRating / (config.homeRating + config.awayRating)) * 100
  const noise = (rnd() - 0.5) * 6
  const homeTarget = Math.max(30, Math.min(70, target + noise))
  // suavização
  const alpha = 0.08
  state.home.possession = Math.round(state.home.possession * (1 - alpha) + homeTarget * alpha)
  state.away.possession = 100 - state.home.possession

  // Passes acumulados (~10-20 passes/min)
  const passes = 10 + Math.floor(rnd() * 10)
  const homePasses = Math.round(passes * (state.home.possession / 100))
  state.home.passes += homePasses
  state.away.passes += passes - homePasses
}

function moveBall(state: MatchState, config: MatchConfig): void {
  // Quem tem a posse atual?
  const probs = calcProbs(config)
  const homePossess = rnd() < probs.homeAdvantage
  const side: Side = homePossess ? "home" : "away"

  // Movimento aleatório com tendência ao gol adversário
  const targetX = side === "home" ? 75 + rnd() * 20 : 5 + rnd() * 20
  const targetY = 20 + rnd() * 60
  // suaviza
  const alpha = 0.35
  const newX = state.ball.x * (1 - alpha) + targetX * alpha
  const newY = state.ball.y * (1 - alpha) + targetY * alpha
  state.ball = {
    x: Math.max(2, Math.min(98, newX)),
    y: Math.max(5, Math.min(95, newY)),
    side,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inicia primeiro tempo
// ─────────────────────────────────────────────────────────────────────────────

export function startMatch(state: MatchState): MatchState {
  if (state.phase !== "pre") return state
  return { ...state, phase: "first", minute: 0 }
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulação rápida (sem ticks visuais)
// ─────────────────────────────────────────────────────────────────────────────

export function simulateFullMatch(config: MatchConfig): MatchState {
  let state = startMatch(createInitialState())
  while (state.phase !== "fulltime") {
    if (state.phase === "halftime") {
      state = { ...state, phase: "second" }
    }
    state = tickMinute(state, config)
  }
  return state
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para UI
// ─────────────────────────────────────────────────────────────────────────────

export function formatPossession(s: MatchState): { home: string; away: string } {
  return {
    home: `${s.home.possession}%`,
    away: `${s.away.possession}%`,
  }
}

export function formatStat(value: number, decimals = 0): string {
  return value.toFixed(decimals)
}

// ─────────────────────────────────────────────────────────────────────────────
// Funcao auxiliar para criar modificadores de partida
// ─────────────────────────────────────────────────────────────────────────────

interface InfrastructureInput {
  acousticsLevel?: number  // 1-5
  soundSystemLevel?: number // 1-5
  stadiumLevel?: number // 1-5
  pitchQuality?: number // 1-5
  pitchHeight?: "baixo" | "medio" | "alto"
}

export function createMatchModifiers(
  homeInfra: InfrastructureInput = {},
  options: {
    weather?: MatchModifiers["weather"]
    temperature?: number
    altitude?: number
    isDerby?: boolean
    derbyIntensity?: number
    matchImportance?: MatchModifiers["matchImportance"]
  } = {}
): MatchModifiers {
  const {
    acousticsLevel = 1,
    soundSystemLevel = 1,
    stadiumLevel = 1,
    pitchQuality = 3,
    pitchHeight = "medio"
  } = homeInfra

  const {
    weather = "sol",
    temperature = 25,
    altitude = 0,
    isDerby = false,
    derbyIntensity = 0,
    matchImportance = "normal"
  } = options

  // Calcula vantagem em casa baseada em infraestrutura
  let homeAdvantageBoost = (stadiumLevel * 2) + (acousticsLevel * 2) + soundSystemLevel
  
  // Calcula pressao da torcida
  let crowdPressure = (acousticsLevel * 3) + (soundSystemLevel * 2)
  
  // Derby aumenta tudo
  if (isDerby) {
    homeAdvantageBoost += 5
    crowdPressure += 8
  }
  
  // Partidas importantes
  if (matchImportance === "decisivo") {
    crowdPressure += 5
    homeAdvantageBoost += 2
  } else if (matchImportance === "final") {
    crowdPressure += 10
    homeAdvantageBoost += 4
  }
  
  // Calcula penalidade tecnica
  let technicalPenalty = 0
  
  // Clima
  if (weather === "chuva") technicalPenalty += 8
  if (weather === "tempestade") technicalPenalty += 15
  
  // Gramado
  if (pitchQuality < 3) technicalPenalty += (3 - pitchQuality) * 4
  if (pitchHeight === "alto") technicalPenalty += 5
  
  // Multiplicador de desgaste
  let staminaDrainMultiplier = 1
  
  // Altitude
  if (altitude > 2500) staminaDrainMultiplier = 1.5
  else if (altitude > 1500) staminaDrainMultiplier = 1.25
  else if (altitude > 800) staminaDrainMultiplier = 1.1
  
  // Temperatura
  if (temperature > 35) staminaDrainMultiplier *= 1.2
  else if (temperature > 30) staminaDrainMultiplier *= 1.1

  return {
    homeAdvantageBoost: Math.min(homeAdvantageBoost, 25),
    crowdPressure: Math.min(crowdPressure, 25),
    weather,
    temperature,
    altitude,
    isDerby,
    derbyIntensity,
    matchImportance,
    pitchQuality,
    pitchHeight,
    staminaDrainMultiplier,
    technicalPenalty
  }
}

// Classicos brasileiros conhecidos
export const BRAZILIAN_DERBIES: [string, string, number][] = [
  // [time1, time2, intensidade]
  ["FLA", "FLU", 95], // Fla-Flu
  ["FLA", "VAS", 98], // Classico dos Milhoes
  ["FLA", "BOT", 80], // Classico Carioca
  ["COR", "PAL", 100], // Derby Paulista
  ["COR", "SAO", 95], // Majestoso
  ["PAL", "SAO", 90], // Choque-Rei
  ["GRE", "INT", 98], // Gre-Nal
  ["CAM", "CRU", 95], // Classico Mineiro
  ["BAH", "VIT", 90], // Ba-Vi
  ["SAN", "COR", 85], // Classico Alvinegro
  ["SAN", "PAL", 82], // Classico da Saudade
  ["BGT", "PAL", 60], // Confronto paulista
  ["BGT", "COR", 60], // Confronto paulista
]

export function isDerbyMatch(team1: string, team2: string): { isDerby: boolean; intensity: number } {
  for (const [t1, t2, intensity] of BRAZILIAN_DERBIES) {
    if ((team1 === t1 && team2 === t2) || (team1 === t2 && team2 === t1)) {
      return { isDerby: true, intensity }
    }
  }
  return { isDerby: false, intensity: 0 }
}

// Altitudes de estadios brasileiros e sul-americanos
export const STADIUM_ALTITUDES: Record<string, number> = {
  // Bolivia
  "LP": 3640, // La Paz
  "COC": 2500, // Cochabamba
  // Colombia
  "BOG": 2640, // Bogota
  // Equador
  "QUI": 2850, // Quito
  // Peru
  "CUS": 3400, // Cusco
  "LIM": 150, // Lima
  // Brasil (maioria ao nivel do mar)
  "DEFAULT": 100,
}

export function getStadiumAltitude(teamShort: string): number {
  return STADIUM_ALTITUDES[teamShort] || STADIUM_ALTITUDES["DEFAULT"]
}
