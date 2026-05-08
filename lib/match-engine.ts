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
  | "injury"

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
  // Para lesoes
  injuryType?: string
  injurySeverity?: "leve" | "media" | "grave"
  injuryWeeks?: number
}

// Tipos de lesao
export const MATCH_INJURY_TYPES = [
  "Distensao muscular",
  "Entorse de tornozelo",
  "Contusao",
  "Fadiga muscular",
  "Caimbra",
  "Pancada no joelho",
  "Lesao na coxa"
]

export interface MatchInjury {
  player: string
  type: string
  severity: "leve" | "media" | "grave"
  weeksOut: number
  minute: number
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
  injuries: MatchInjury[]
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
  durationMinutes: number // padrão 90
  weatherFactor?: number // 0.8-1.2 (chuva reduz precisão)
  // Squads (opcional, para nomear eventos)
  homeSquad?: { nome: string; pos: string }[]
  awaySquad?: { nome: string; pos: string }[]
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
  injuries: [],
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
  shotChance: number       // chance de finalização (qualquer time)
  homeAdvantage: number    // 0..1, % chance de o evento ser do mandante
  cornerChance: number
  foulChance: number
  cardChance: number
}

function calcProbs(config: MatchConfig): MinuteProbs {
  const total = config.homeRating + config.awayRating
  // Mandante tem +5% de boost (vantagem em casa)
  const homeBoost = 5
  const homeAdvantage = (config.homeRating + homeBoost) / (total + homeBoost)

  // Times fortes finalizam mais
  const avg = total / 2
  const shotChance = Math.min(0.55, 0.18 + (avg - 60) * 0.012)

  return {
    shotChance,
    homeAdvantage,
    cornerChance: 0.16,
    foulChance: 0.22,
    cardChance: 0.04,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tick: avança 1 minuto de partida
// ─────────────────────────────────────────────────────────────────────────────

export function tickMinute(state: MatchState, config: MatchConfig): MatchState {
  if (state.phase === "fulltime" || state.phase === "pre") return state

  const next: MatchState = {
    ...state,
    home: { ...state.home },
    away: { ...state.away },
    events: state.events.slice(),
    flash: null,
  }

  const halfDuration = Math.floor(config.durationMinutes / 2)

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

  if (next.minute >= config.durationMinutes && state.phase === "second") {
    next.phase = "fulltime"
    next.events = [
      {
        id: nameId(),
        minute: config.durationMinutes,
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

  // Lesao durante a partida (2% de chance por minuto - cerca de 1-2 lesoes por partida em media)
  if (rnd() < 0.02) {
    const isHome = rnd() < 0.5
    const side: Side = isHome ? "home" : "away"
    const teamStats = isHome ? state.home : state.away
    const player = pickPlayer(side, config, ["ATA", "MEI", "VOL", "ZAG", "LD", "LE", "PD", "PE"])
    
    // Determina severidade (maioria e leve)
    const sevRoll = rnd()
    let severity: "leve" | "media" | "grave" = "leve"
    let weeksOut = 1
    
    if (sevRoll < 0.70) {
      severity = "leve"
      weeksOut = Math.floor(rnd() * 2) + 1 // 1-2 semanas
    } else if (sevRoll < 0.92) {
      severity = "media"
      weeksOut = Math.floor(rnd() * 3) + 3 // 3-5 semanas
    } else {
      severity = "grave"
      weeksOut = Math.floor(rnd() * 8) + 6 // 6-13 semanas
    }
    
    const injuryType = pick(MATCH_INJURY_TYPES)
    
    // Registra lesao
    teamStats.injuries.push({
      player,
      type: injuryType,
      severity,
      weeksOut,
      minute
    })
    
    state.events = [
      {
        id: nameId(),
        minute,
        type: "injury",
        side,
        text: severity === "grave" 
          ? `${player} sai de maca com ${injuryType}. Fora por ${weeksOut} semanas!`
          : `${player} sentiu ${injuryType}. Deve ficar fora ${weeksOut} semana(s)`,
        player,
        important: severity !== "leve",
        injuryType,
        injurySeverity: severity,
        injuryWeeks: weeksOut
      },
      ...state.events,
    ]
    
    // Flash visual para lesoes graves
    if (severity !== "leve") {
      state.flash = { side, type: "card", cardColor: "red" }
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
