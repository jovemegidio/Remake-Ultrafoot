// Motor de simulação de partida - Ultrafoot 26 v2
// Usa atributos individuais dos jogadores (shooting, defending, passing, stamina),
// sistema de momentum, impacto de cartões vermelhos e fadiga para resultados realistas.

import type { Team } from "@/lib/teams-data"

// ─────────────────────────────────────────────────────────────────────────────
// Tipos base
// ─────────────────────────────────────────────────────────────────────────────

export type MatchSpeed = "slow" | "normal" | "fast" | "ultra" | "hyper"

export const SPEED_TICKS_PER_SEC: Record<MatchSpeed, number> = {
  slow: 1,
  normal: 2,
  fast: 5,
  ultra: 12,
  hyper: 30,
}

export type MatchPhase =
  | "pre"
  | "first"
  | "halftime"
  | "second"
  | "fulltime"

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
  possession: number
  passes: number
  passAccuracy: number
}

export interface BallPosition {
  x: number // 0-100
  y: number // 0-100
  side: Side
}

export interface MatchState {
  phase: MatchPhase
  minute: number
  addedTime: number
  home: TeamStats
  away: TeamStats
  events: MatchEvent[]
  ball: BallPosition
  flash: { side: Side; type: "goal" | "card" | "chance"; cardColor?: "yellow" | "red" } | null
  // v2: momentum e controle de vermelhos
  momentum: number  // -50 a +50 (positivo = mandante dominando)
  homeReds: number  // quantos vermelhos o mandante tem
  awayReds: number
}

// Jogador do elenco — nome+pos obrigatórios, atributos opcionais (retrocompat)
export interface SquadPlayer {
  nome: string
  pos: string
  rating?: number
  shooting?: number
  passing?: number
  dribbling?: number
  defending?: number
  physical?: number
  pace?: number
  stamina?: number  // energia atual 0-100; undefined = não fornecida (trata como 100)
}

export interface MatchConfig {
  homeTeam: Team
  awayTeam: Team
  homeRating: number  // 50-95
  awayRating: number  // 50-95
  durationMinutes?: number
  weatherFactor?: number
  homeSquad?: SquadPlayer[]
  awaySquad?: SquadPlayer[]
  modifiers?: MatchModifiers
}

export interface MatchModifiers {
  homeAdvantageBoost: number
  crowdPressure: number
  weather: "sol" | "nublado" | "chuva" | "tempestade"
  temperature: number
  altitude: number
  isDerby: boolean
  derbyIntensity: number
  matchImportance: "normal" | "decisivo" | "final"
  pitchQuality: number
  pitchHeight: "baixo" | "medio" | "alto"
  staminaDrainMultiplier: number
  technicalPenalty: number
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
    momentum: 0,
    homeReds: 0,
    awayReds: 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────

function rnd(): number { return Math.random() }
function nameId(): string { return Math.random().toString(36).slice(2, 9) }

// ─────────────────────────────────────────────────────────────────────────────
// Seleção de jogadores
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_HOME = ["Silva", "Santos", "Oliveira", "Costa", "Pereira", "Lima", "Almeida", "Rodrigues", "Souza", "Ferreira"]
const FALLBACK_AWAY = ["Martins", "Gomes", "Carvalho", "Ribeiro", "Araujo", "Barbosa", "Rocha", "Dias", "Cardoso", "Teixeira"]

function pickPlayerFull(side: Side, config: MatchConfig, posFilter?: string[]): SquadPlayer | null {
  const squad = side === "home" ? config.homeSquad : config.awaySquad
  if (!squad || squad.length === 0) return null
  const pool = posFilter ? squad.filter(p => posFilter.includes(p.pos)) : squad
  const src = pool.length > 0 ? pool : squad
  return src[Math.floor(rnd() * src.length)]
}

function pickPlayer(side: Side, config: MatchConfig, posFilter?: string[]): string {
  return pickPlayerFull(side, config, posFilter)?.nome
    ?? (FALLBACK_HOME.concat(FALLBACK_AWAY))[Math.floor(rnd() * 10) + (side === "away" ? 10 : 0)]
}

// ─────────────────────────────────────────────────────────────────────────────
// Força do elenco por linha (com fallback para rating bruto)
// ─────────────────────────────────────────────────────────────────────────────

interface SquadStrengths {
  attack: number    // shooting médio dos atacantes (ATA/PE/PD)
  defense: number   // defending médio dos defensores (ZAG/LD/LE/GOL)
  midfield: number  // passing médio dos meias (VOL/MEI)
  gkRating: number  // defending do goleiro
  avgStamina: number // energia atual média (0-100)
}

function deriveStrengths(squad: SquadPlayer[] | undefined, fallback: number): SquadStrengths {
  if (!squad || squad.length === 0) {
    return { attack: fallback, defense: fallback, midfield: fallback, gkRating: fallback, avgStamina: 100 }
  }

  const byPos = (positions: string[]) => squad.filter(p => positions.includes(p.pos))

  const avgAttr = (players: SquadPlayer[], attr: keyof SquadPlayer): number => {
    if (players.length === 0) return fallback
    return players.reduce((s, p) => s + ((p[attr] as number | undefined) ?? fallback), 0) / players.length
  }

  const attackers = byPos(["ATA", "PE", "PD"])
  const defenders = byPos(["ZAG", "LD", "LE"])
  const gks = byPos(["GOL"])
  const midfielders = byPos(["VOL", "MEI"])

  // Stamina usa 100 como padrão quando não fornecida (undefined ≠ zero)
  const providedStaminas = squad.map(p => p.stamina).filter((v): v is number => v !== undefined)
  const avgStamina = providedStaminas.length > 0
    ? providedStaminas.reduce((s, v) => s + v, 0) / providedStaminas.length
    : 100

  return {
    attack: avgAttr(attackers.length > 0 ? attackers : squad, "shooting"),
    defense: avgAttr([...defenders, ...gks].length > 0 ? [...defenders, ...gks] : squad, "defending"),
    midfield: avgAttr(midfielders.length > 0 ? midfielders : squad, "passing"),
    gkRating: avgAttr(gks.length > 0 ? gks : squad, "defending"),
    avgStamina,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Probabilidades dinâmicas: usa atributos, momentum e estado da partida
// ─────────────────────────────────────────────────────────────────────────────

interface DynamicProbs {
  homeShotChance: number
  awayShotChance: number
  homeAdvantage: number   // 0..1
  homeFoulChance: number
  awayFoulChance: number
  cardChance: number
  staminaDrain: number
  technicalPenalty: number
  // Forças exportadas para uso no xG e resolução de lance
  homeAttStr: number
  awayAttStr: number
  homeDefStr: number
  awayDefStr: number
  homeGKStr: number
  awayGKStr: number
}

function calcDynamicProbs(config: MatchConfig, state: MatchState): DynamicProbs {
  const homeSt = deriveStrengths(config.homeSquad, config.homeRating)
  const awaySt = deriveStrengths(config.awaySquad, config.awayRating)
  const mods = config.modifiers
  const total = config.homeRating + config.awayRating
  const minute = state.minute

  // ── Vantagem em casa ─────────────────────────────────────────────────────
  let homeBoost = 5
  if (mods) {
    homeBoost += (mods.homeAdvantageBoost || 0) * 0.4
    homeBoost += (mods.crowdPressure || 0) * 0.3
    if (mods.isDerby) homeBoost += 3
    if (mods.matchImportance === "decisivo") homeBoost += 2
    if (mods.matchImportance === "final") homeBoost += 4
  }
  const rawHomeAdv = (config.homeRating + homeBoost) / (total + homeBoost)

  // Vermelhos deslocam o equilíbrio significativamente
  const homeRedPen = state.homeReds * 0.14
  const awayRedPen = state.awayReds * 0.14

  // Momentum desloca a vantagem levemente
  const momentumShift = state.momentum * 0.0004

  const homeAdvantage = Math.max(0.22, Math.min(0.80,
    rawHomeAdv - homeRedPen + awayRedPen + momentumShift
  ))

  // ── Stamina ───────────────────────────────────────────────────────────────
  const homeStFactor = Math.max(0.72, homeSt.avgStamina / 100)
  const awayStFactor = Math.max(0.72, awaySt.avgStamina / 100)

  // ── Forças efetivas (atributo × stamina) ────────────────────────────────
  const homeAttEff = homeSt.attack * homeStFactor
  const awayAttEff = awaySt.attack * awayStFactor
  const homeDefEff = homeSt.defense * homeStFactor
  const awayDefEff = awaySt.defense * awayStFactor

  // ── Chance de finalização por time ────────────────────────────────────────
  // Calibrado para ~11-15 chutes por time (jogo realista). Como resolveShot roda
  // no maximo 1x por minuto/time (~90 ticks), a probabilidade base deve ficar
  // proxima de 0.13-0.18, nao acima de 0.35 (senao estoura para 30+ chutes e xG irreal).
  const avg = total / 2
  const baseShot = Math.min(0.15, 0.075 + (avg - 60) * 0.0022)

  // Diferencial ataque vs defesa adversária
  const homeAttDiff = (homeAttEff - awayDefEff) * 0.0010
  const awayAttDiff = (awayAttEff - homeDefEff) * 0.0010

  // Bônus de momentum para o time dominante
  const homeMomBonus = state.momentum > 0 ? Math.min(0.06, state.momentum * 0.0012) : 0
  const awayMomBonus = state.momentum < 0 ? Math.min(0.06, -state.momentum * 0.0012) : 0

  // Penalidade por time com 10 jogadores
  const homeRedShotPen = state.homeReds * 0.09
  const awayRedShotPen = state.awayReds * 0.09

  // Desespero nos minutos finais do time que está perdendo
  let homeLateBonus = 0
  let awayLateBonus = 0
  if (minute >= 75) {
    const diff = state.home.goals - state.away.goals
    if (diff < 0) homeLateBonus = Math.min(0.10, Math.abs(diff) * 0.04 + (minute - 75) * 0.003)
    if (diff > 0) awayLateBonus = Math.min(0.10, diff * 0.04 + (minute - 75) * 0.003)
    if (diff === 0 && minute >= 85) { homeLateBonus += 0.02; awayLateBonus += 0.02 }
  }

  const homeShotChance = Math.max(0.04, Math.min(0.22,
    baseShot + homeAttDiff + homeMomBonus - homeRedShotPen + homeLateBonus
  ))
  const awayShotChance = Math.max(0.04, Math.min(0.22,
    baseShot + awayAttDiff + awayMomBonus - awayRedShotPen + awayLateBonus
  ))

  // ── Faltas e cartões ──────────────────────────────────────────────────────
  // baseFoul calibrado para ~12-14 faltas por time (jogo realista ~24-28 no total).
  let baseFoul = 0.11
  if (mods?.isDerby) baseFoul = 0.15
  if (mods?.matchImportance === "final") baseFoul = 0.13
  if (state.phase === "second") baseFoul *= 1.15

  // Jogadores cansados faltam um pouco mais (efeito sutil para nao estourar o total)
  const homeFatigue = Math.max(0, (80 - homeSt.avgStamina) * 0.0011)
  const awayFatigue = Math.max(0, (80 - awaySt.avgStamina) * 0.0011)

  let cardChance = 0.038
  if (mods?.isDerby) cardChance = 0.072
  if (mods?.matchImportance === "final") cardChance = 0.055
  if (state.phase === "second") cardChance *= 1.25
  if (minute >= 80) cardChance *= 1.3

  // ── Clima e gramado ───────────────────────────────────────────────────────
  let technicalPenalty = 0
  let staminaDrain = 1
  if (mods) {
    technicalPenalty = mods.technicalPenalty || 0
    if (mods.weather === "chuva") technicalPenalty += 8
    if (mods.weather === "tempestade") technicalPenalty += 15
    if (mods.pitchQuality < 3) technicalPenalty += (3 - mods.pitchQuality) * 4
    if (mods.pitchHeight === "alto") technicalPenalty += 5
    staminaDrain = mods.staminaDrainMultiplier || 1
    if (mods.altitude > 2500) staminaDrain = Math.max(staminaDrain, 1.5)
    else if (mods.altitude > 1500) staminaDrain = Math.max(staminaDrain, 1.25)
    else if (mods.altitude > 800) staminaDrain = Math.max(staminaDrain, 1.1)
    if (mods.temperature > 35) staminaDrain *= 1.2
    else if (mods.temperature > 30) staminaDrain *= 1.1
  }

  return {
    homeShotChance,
    awayShotChance,
    homeAdvantage,
    homeFoulChance: Math.min(0.22, baseFoul + homeFatigue),
    awayFoulChance: Math.min(0.22, baseFoul + awayFatigue),
    cardChance: Math.min(0.15, cardChance),
    staminaDrain,
    technicalPenalty,
    homeAttStr: homeAttEff,
    awayAttStr: awayAttEff,
    homeDefStr: homeDefEff,
    awayDefStr: awayDefEff,
    homeGKStr: homeSt.gkRating,
    awayGKStr: awaySt.gkRating,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// xG baseado em atributos reais do chutador vs goleiro
// ─────────────────────────────────────────────────────────────────────────────

function computeXG(shooterShooting: number, gkDefending: number, minute: number): number {
  // Calibrado para xG/chute medio ~0.11 (realista). Total ~2.6-2.9 por jogo.
  const base = 0.04 + rnd() * 0.145
  const shooterBonus = (shooterShooting - 70) * 0.002   // bom chutador aumenta
  const gkPenalty = (gkDefending - 70) * 0.0018         // bom goleiro reduz
  const lateBonus = minute >= 85 ? 0.03 : minute >= 78 ? 0.015 : 0
  return Math.max(0.02, Math.min(0.55, base + shooterBonus - gkPenalty + lateBonus))
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolução de finalização
// ─────────────────────────────────────────────────────────────────────────────

function resolveShot(side: Side, state: MatchState, config: MatchConfig, probs: DynamicProbs): void {
  const isHome = side === "home"
  const teamStats = isHome ? state.home : state.away
  const minute = state.minute

  const shooterData = pickPlayerFull(side, config, ["ATA", "MEI", "PD", "PE"])
  const shooterShooting = shooterData?.shooting ?? (isHome ? probs.homeAttStr : probs.awayAttStr)
  const shooterName = shooterData?.nome ?? pickPlayer(side, config, ["ATA", "MEI", "PD", "PE"])

  const gkSide: Side = isHome ? "away" : "home"
  const gkData = pickPlayerFull(gkSide, config, ["GOL"])
  const gkDefending = gkData?.defending ?? (isHome ? probs.awayGKStr : probs.homeGKStr)
  const gkName = gkData?.nome ?? pickPlayer(gkSide, config, ["GOL"])

  teamStats.shots += 1

  const xg = computeXG(shooterShooting, gkDefending, minute)
  teamStats.xG += xg

  // Pressão defensiva reduz chance de acertar o alvo
  const defStr = isHome ? probs.awayDefStr : probs.homeDefStr
  const defPressure = Math.max(0, (defStr - 65) * 0.003)
  const onTarget = rnd() < Math.max(0.28, Math.min(0.62, 0.42 - defPressure))

  if (onTarget) {
    teamStats.shotsOnTarget += 1

    if (rnd() < Math.min(0.60, xg * 1.35)) {
      // GOL
      teamStats.goals += 1
      const team = isHome ? config.homeTeam : config.awayTeam
      state.events = [{
        id: nameId(), minute, type: "goal", side,
        text: `GOOOOL! ${shooterName} marca para o ${team.curto}!`,
        player: shooterName, important: true,
      }, ...state.events]
      state.flash = { side, type: "goal" }
      state.ball = { x: 50, y: 50, side: isHome ? "away" : "home" }
      // Quem marcou fica com momentum leve (o adversário vai pressionar para empatar)
      state.momentum = isHome ? 18 : -18
      return
    }

    // Defesa do goleiro
    state.events = [{
      id: nameId(), minute, type: "save", side,
      text: `${shooterName} finaliza, ${gkName} defende`,
      player: shooterName,
    }, ...state.events]
    state.flash = { side, type: "chance" }
    state.momentum += isHome ? -10 : 10  // defesa dá momentum para quem defendeu

  } else {
    if (rnd() < 0.09) {
      // Trave
      state.events = [{
        id: nameId(), minute, type: "post", side,
        text: `${shooterName} acerta a trave!`,
        player: shooterName, important: true,
      }, ...state.events]
      state.flash = { side, type: "chance" }
      state.momentum += isHome ? 14 : -14
    } else if (rnd() < 0.28) {
      // Escanteio
      teamStats.corners += 1
      const team = isHome ? config.homeTeam : config.awayTeam
      state.events = [{
        id: nameId(), minute, type: "corner", side,
        text: `Escanteio para ${team.curto}`,
      }, ...state.events]
      state.momentum += isHome ? 6 : -6
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolução de falta / cartão
// ─────────────────────────────────────────────────────────────────────────────

function resolveFoul(side: Side, state: MatchState, config: MatchConfig, probs: DynamicProbs): void {
  const isHome = side === "home"
  const teamStats = isHome ? state.home : state.away
  const minute = state.minute
  teamStats.fouls += 1

  if (rnd() < probs.cardChance * 1.4) {
    // Time com muitos amarelos tem chance maior de ver segundo amarelo = vermelho
    const doubleYellowChance = teamStats.yellows >= 2 ? 0.12 : 0.05
    const isRed = rnd() < doubleYellowChance
    const player = pickPlayer(side, config, ["ZAG", "VOL", "LD", "LE"])

    if (isRed) {
      teamStats.reds += 1
      if (isHome) state.homeReds += 1
      else state.awayReds += 1
      state.events = [{
        id: nameId(), minute, type: "red_card", side,
        text: `Cartão VERMELHO para ${player}`,
        player, important: true,
      }, ...state.events]
      state.flash = { side, type: "card", cardColor: "red" }
      // Vermelho é golpe pesado no momentum
      state.momentum += isHome ? -25 : 25
    } else {
      teamStats.yellows += 1
      state.events = [{
        id: nameId(), minute, type: "yellow_card", side,
        text: `Cartão amarelo para ${player}`,
        player,
      }, ...state.events]
      state.flash = { side, type: "card", cardColor: "yellow" }
    }
  } else if (rnd() < 0.22) {
    const player = pickPlayer(side, config)
    state.events = [{
      id: nameId(), minute, type: "foul", side,
      text: `Falta de ${player}`,
      player,
    }, ...state.events]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Geração de eventos por minuto
// ─────────────────────────────────────────────────────────────────────────────

function generateMinuteEvents(state: MatchState, config: MatchConfig): void {
  const probs = calcDynamicProbs(config, state)
  const minute = state.minute

  // Finalizações verificadas independentemente para cada time
  if (rnd() < probs.homeShotChance) resolveShot("home", state, config, probs)
  if (rnd() < probs.awayShotChance) resolveShot("away", state, config, probs)

  // Faltas verificadas independentemente
  if (rnd() < probs.homeFoulChance) resolveFoul("home", state, config, probs)
  if (rnd() < probs.awayFoulChance) resolveFoul("away", state, config, probs)

  // Lesão — mais frequente no 2º tempo e nos minutos finais
  const baseInjury = state.phase === "second" ? 0.007 : 0.003
  const lateMulti = minute >= 75 ? 1.5 : 1.0
  if (rnd() < baseInjury * lateMulti) {
    const injSide: Side = rnd() < probs.homeAdvantage ? "away" : "home"
    const injured = pickPlayer(injSide, config, ["ZAG", "VOL", "MEI", "ATA", "LD", "LE"])
    state.events = [{
      id: nameId(), minute, type: "injury", side: injSide,
      text: `${injured} fica no chão — possível lesão`,
      player: injured, important: true,
    }, ...state.events]
    state.flash = { side: injSide, type: "chance" }
  }

  // Pênalti (raro — ~1% por minuto)
  if (rnd() < 0.011) {
    // Time que está atacando mais (momentum) tem mais chance de sofrer falta na área
    const isHome = rnd() < probs.homeAdvantage
    const side: Side = isHome ? "home" : "away"
    const gkSide: Side = isHome ? "away" : "home"
    const teamStats = isHome ? state.home : state.away
    const oppStats = isHome ? state.away : state.home
    const team = isHome ? config.homeTeam : config.awayTeam
    oppStats.fouls += 1

    state.events = [{
      id: nameId(), minute, type: "penalty", side,
      text: `Pênalti para ${team.curto}!`,
      important: true,
    }, ...state.events]

    // Taxa de conversão influenciada pelo shooting do batedor
    const takerData = pickPlayerFull(side, config, ["ATA", "MEI"])
    const takerShooting = takerData?.shooting ?? (isHome ? probs.homeAttStr : probs.awayAttStr)
    const takerName = takerData?.nome ?? pickPlayer(side, config, ["ATA"])
    const gkData = pickPlayerFull(gkSide, config, ["GOL"])
    const gkName = gkData?.nome ?? pickPlayer(gkSide, config, ["GOL"])

    const convRate = Math.min(0.88, 0.72 + (takerShooting - 70) * 0.003)
    if (rnd() < convRate) {
      teamStats.goals += 1
      teamStats.shots += 1
      teamStats.shotsOnTarget += 1
      teamStats.xG += 0.78
      state.events = [{
        id: nameId(), minute, type: "goal", side,
        text: `GOOOL! ${takerName} converte o pênalti`,
        player: takerName, important: true,
      }, ...state.events]
      state.flash = { side, type: "goal" }
      state.momentum = isHome ? 18 : -18
    } else {
      state.events = [{
        id: nameId(), minute, type: "save", side,
        text: `${gkName} defende o pênalti de ${takerName}!`,
        important: true,
      }, ...state.events]
      state.flash = { side, type: "chance" }
      state.momentum += isHome ? -20 : 20
    }
  }
}

// ──────���──────────────────────────────────────────────────────────────────────
// Atualização de posse (baseada em midfield + momentum)
// ──────────────────────────────────────���──────────────────────────────────────

function updatePossession(state: MatchState, config: MatchConfig): void {
  const homeSt = deriveStrengths(config.homeSquad, config.homeRating)
  const awaySt = deriveStrengths(config.awaySquad, config.awayRating)

  const midTotal = homeSt.midfield + awaySt.midfield
  const midBase = midTotal > 0 ? (homeSt.midfield / midTotal) * 100 : 50

  const rTotal = config.homeRating + config.awayRating
  const ratingBase = rTotal > 0 ? (config.homeRating / rTotal) * 100 : 50

  // 60% do midfield, 40% rating bruto
  let target = midBase * 0.6 + ratingBase * 0.4

  // Momentum e vermelhos afetam a posse
  target += state.momentum * 0.08
  target -= state.homeReds * 5
  target += state.awayReds * 5

  const noise = (rnd() - 0.5) * 6
  const homeTarget = Math.max(28, Math.min(72, target + noise))

  // Garante que possession nunca seja NaN
  const prevPossession = isNaN(state.home.possession) ? 50 : state.home.possession
  const newPossession = Math.round(prevPossession * 0.93 + homeTarget * 0.07)
  
  state.home.possession = isNaN(newPossession) ? 50 : newPossession
  state.away.possession = 100 - state.home.possession

  const passes = 10 + Math.floor(rnd() * 10)
  const homePasses = Math.round(passes * (state.home.possession / 100))
  state.home.passes += homePasses
  state.away.passes += passes - homePasses
}

// ─────────────────────────────────────────────────────────────────────────────
// Movimento da bola (influenciado pelo momentum e vermelhos)
// ─────────────────────────────────────────────────────────────────────────────

function moveBall(state: MatchState): void {
  const homePossProb = Math.max(0.25, Math.min(0.80,
    0.5 + state.momentum * 0.004 + state.awayReds * 0.08 - state.homeReds * 0.08
  ))
  const homePossess = rnd() < homePossProb
  const side: Side = homePossess ? "home" : "away"

  const targetX = side === "home" ? 72 + rnd() * 22 : 6 + rnd() * 22
  const targetY = 18 + rnd() * 64
  const newX = state.ball.x * 0.68 + targetX * 0.32
  const newY = state.ball.y * 0.68 + targetY * 0.32
  state.ball = {
    x: Math.max(2, Math.min(98, newX)),
    y: Math.max(5, Math.min(95, newY)),
    side,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tick: avança 1 minuto de partida
// ─────────────────────────────────────────────────────────────────────────────

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
    // Decaimento natural do momentum a cada minuto
    momentum: Math.round(state.momentum * 0.88),
  }

  const halfDuration = Math.floor(durationMinutes / 2)
  next.minute = state.minute + 1

  // Transições de fase
  if (next.minute === halfDuration && state.phase === "first") {
    next.phase = "halftime"
    next.events = [{
      id: nameId(),
      minute: halfDuration,
      type: "halftime",
      side: "home",
      text: "Fim do 1º tempo",
      important: true,
    }, ...next.events]
    next.ball = { x: 50, y: 50, side: "away" }
    return next
  }

  if (state.phase === "halftime") {
    next.phase = "second"
    next.momentum = 0  // intervalo reseta o momentum
  }

  if (next.minute >= durationMinutes && state.phase === "second") {
    next.phase = "fulltime"
    next.events = [{
      id: nameId(),
      minute: durationMinutes,
      type: "fulltime",
      side: "home",
      text: `Fim de jogo. ${config.homeTeam.curto} ${state.home.goals} x ${state.away.goals} ${config.awayTeam.curto}`,
      important: true,
    }, ...next.events]
    return next
  }

  if (next.minute === 1 && state.phase === "first") {
    next.events = [{
      id: nameId(),
      minute: 1,
      type: "kickoff",
      side: "home",
      text: "Bola rolando! Mandante começa o jogo",
    }, ...next.events]
  }

  generateMinuteEvents(next, config)
  updatePossession(next, config)
  moveBall(next)

  // Clamp do momentum
  next.momentum = Math.max(-50, Math.min(50, next.momentum))

  return next
}

// ─────────────────────────────────────────────────────────────────────────────
// Inicia primeiro tempo
// ─────────────────────────────────────────────────────────────────────────────

export function startMatch(state: MatchState): MatchState {
  if (state.phase !== "pre") return state
  return { ...state, phase: "first", minute: 0 }
}

// ────────────────────────────────────────���────────────────────────────────────
// Simulação rápida (sem ticks visuais)
// ───────────────────────────────��─────────────────────────────────────────────

export function simulateFullMatch(config: MatchConfig): MatchState {
  let state = startMatch(createInitialState())
  while (state.phase !== "fulltime") {
    if (state.phase === "halftime") {
      state = { ...state, phase: "second", momentum: 0 }
    }
    state = tickMinute(state, config)
  }
  return state
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para UI
// ─────────────────────────────────────────────────────────────────────────────

export function formatPossession(s: MatchState): { home: string; away: string } {
  return { home: `${s.home.possession}%`, away: `${s.away.possession}%` }
}

export function formatStat(value: number, decimals = 0): string {
  return value.toFixed(decimals)
}

// ─────────────────────────────────────────────────────────────────────────────
// Criação de modificadores
// ─────────────────────────────────────────────────────────────────────────────

interface InfrastructureInput {
  acousticsLevel?: number
  soundSystemLevel?: number
  stadiumLevel?: number
  pitchQuality?: number
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
    acousticsLevel = 1, soundSystemLevel = 1, stadiumLevel = 1,
    pitchQuality = 3, pitchHeight = "medio",
  } = homeInfra
  const {
    weather = "sol", temperature = 25, altitude = 0,
    isDerby = false, derbyIntensity = 0, matchImportance = "normal",
  } = options

  let homeAdvantageBoost = (stadiumLevel * 2) + (acousticsLevel * 2) + soundSystemLevel
  let crowdPressure = (acousticsLevel * 3) + (soundSystemLevel * 2)

  if (isDerby) { homeAdvantageBoost += 5; crowdPressure += 8 }
  if (matchImportance === "decisivo") { crowdPressure += 5; homeAdvantageBoost += 2 }
  else if (matchImportance === "final") { crowdPressure += 10; homeAdvantageBoost += 4 }

  let technicalPenalty = 0
  if (weather === "chuva") technicalPenalty += 8
  if (weather === "tempestade") technicalPenalty += 15
  if (pitchQuality < 3) technicalPenalty += (3 - pitchQuality) * 4
  if (pitchHeight === "alto") technicalPenalty += 5

  let staminaDrainMultiplier = 1
  if (altitude > 2500) staminaDrainMultiplier = 1.5
  else if (altitude > 1500) staminaDrainMultiplier = 1.25
  else if (altitude > 800) staminaDrainMultiplier = 1.1
  if (temperature > 35) staminaDrainMultiplier *= 1.2
  else if (temperature > 30) staminaDrainMultiplier *= 1.1

  return {
    homeAdvantageBoost: Math.min(homeAdvantageBoost, 25),
    crowdPressure: Math.min(crowdPressure, 25),
    weather, temperature, altitude, isDerby, derbyIntensity,
    matchImportance, pitchQuality, pitchHeight,
    staminaDrainMultiplier, technicalPenalty,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Clássicos e altitudes
// ─────────────────────────────────────────────────────────────────────────────

export const BRAZILIAN_DERBIES: [string, string, number][] = [
  ["FLA", "FLU", 95], ["FLA", "VAS", 98], ["FLA", "BOT", 80],
  ["COR", "PAL", 100], ["COR", "SAO", 95], ["PAL", "SAO", 90],
  ["GRE", "INT", 98], ["CAM", "CRU", 95], ["BAH", "VIT", 90],
  ["SAN", "COR", 85], ["SAN", "PAL", 82], ["BGT", "PAL", 60], ["BGT", "COR", 60],
]

export function isDerbyMatch(team1: string, team2: string): { isDerby: boolean; intensity: number } {
  for (const [t1, t2, intensity] of BRAZILIAN_DERBIES) {
    if ((team1 === t1 && team2 === t2) || (team1 === t2 && team2 === t1)) {
      return { isDerby: true, intensity }
    }
  }
  return { isDerby: false, intensity: 0 }
}

export const STADIUM_ALTITUDES: Record<string, number> = {
  "LP": 3640, "COC": 2500, "BOG": 2640, "QUI": 2850,
  "CUS": 3400, "LIM": 150, "DEFAULT": 100,
}

export function getStadiumAltitude(teamShort: string): number {
  return STADIUM_ALTITUDES[teamShort] || STADIUM_ALTITUDES["DEFAULT"]
}
