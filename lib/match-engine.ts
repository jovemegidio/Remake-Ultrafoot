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
  assist?: string
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
  /** Amarelos por atleta na partida; o segundo sempre gera expulsão. */
  playerYellowCards: Record<string, number>
  playerRedCards: Record<string, boolean>
  /**
   * Penalti do USUARIO aguardando a escolha do batedor.
   *
   * Antes o motor cobrava o penalti no MESMO tick em que o marcava: quando a UI ia
   * reagir, o gol ja estava no placar. O modal de batedor nunca abria (o evento de
   * penalti ficava soterrado sob o de gol) e, se abrisse, a escolha seria decorativa.
   * Agora o motor PARA aqui e espera resolvePenalty() com o batedor escolhido.
   */
  pendingPenalty: { side: Side; minute: number } | null
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
  // Overrides táticos (formação/mentalidade/moral já aplicados pela UI).
  // Quando presentes, substituem as forças derivadas do elenco.
  homeAttack?: number
  homeDefense?: number
  homeMidfield?: number
  awayAttack?: number
  awayDefense?: number
  awayMidfield?: number
  // Mentalidade escolhida pela UI (pode mudar no intervalo). Ofensivo troca solidez por
  // poder de ataque; defensivo o contrario. O motor le config ao vivo, entao vale no 2o tempo.
  homeMentality?: "defensivo" | "equilibrado" | "ofensivo"
  awayMentality?: "defensivo" | "equilibrado" | "ofensivo"
  /**
   * Lado controlado pelo USUARIO. Quando o penalti sai para este lado, o motor para e
   * espera a escolha do batedor (resolvePendingPenalty). Sem isto, ele cobra sozinho.
   */
  userSide?: Side
  /**
   * Cobradores designados do lado do USUÁRIO, por nome.
   *
   * Sem isto o motor sorteia o cobrador por posição a cada lance, então o
   * especialista do elenco batia por acaso. Só vale para `userSide`: a IA
   * continua sorteando.
   */
  userSetPieceTakers?: { freeKick?: string; corner?: string; penalty?: string }
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
    playerYellowCards: {},
    playerRedCards: {},
    pendingPenalty: null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────

function rnd(): number { return Math.random() }
function nameId(): string { return Math.random().toString(36).slice(2, 9) }
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)] }

// Variedade de narracao — os textos eram fixos ("X finaliza, Y defende") e soavam
// artificiais na repeticao. Cada evento agora sorteia entre varias frases.
function goalLine(scorer: string, team: string, assist?: string): string {
  if (assist) {
    return pick([
      `GOOOL! ${scorer} completa o passe de ${assist} e marca para o ${team}!`,
      `É DO ${team.toUpperCase()}! ${assist} serviu, ${scorer} nao desperdicou!`,
      `GOOOOL! Que jogada! ${assist} de calcanhar e ${scorer} empurrou pra rede!`,
      `GOOOL! ${scorer} apareceu na hora certa apos assistencia de ${assist}!`,
    ])
  }
  return pick([
    `GOOOL! ${scorer} marca para o ${team}!`,
    `É DELE! ${scorer} balanca as redes do ${team}!`,
    `GOOOOL! ${scorer} nao perdoou e fez pro ${team}!`,
    `PEGOU DE PRIMEIRA! ${scorer} marca um golaco pro ${team}!`,
  ])
}
function saveLine(shooter: string, gk: string): string {
  return pick([
    `${shooter} finaliza, mas ${gk} defende!`,
    `Que defensa de ${gk}! Negou o gol de ${shooter}!`,
    `${shooter} chutou firme e ${gk} espalmou!`,
    `${gk} se estica todo e evita o gol de ${shooter}!`,
  ])
}
function missLine(shooter: string): string {
  return pick([
    `${shooter} finaliza pra fora!`,
    `Isolou! ${shooter} mandou por cima do gol.`,
    `${shooter} tentou de longe, mas a bola foi longe do alvo.`,
    `Passou raspando! ${shooter} quase abre o placar.`,
  ])
}

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

/**
 * Cobrador de bola parada: o designado pelo técnico quando existe e está em
 * campo; senão cai no sorteio por posição de sempre.
 *
 * Só se aplica ao lado do usuário — a IA continua sorteando. O nome é a chave
 * porque os IDs divergem entre o elenco da tela e o do motor.
 */
export function pickSetPieceTaker(
  side: Side,
  config: MatchConfig,
  tipo: "freeKick" | "corner" | "penalty",
  posFilter: string[],
): SquadPlayer | null {
  if (config.userSide === side) {
    const nome = config.userSetPieceTakers?.[tipo]
    if (nome) {
      const squad = side === "home" ? config.homeSquad : config.awaySquad
      // Precisa estar EM CAMPO: designar alguém que saiu ou nem foi escalado
      // não pode travar a cobrança.
      const designado = squad?.find(p => p.nome === nome)
      if (designado) return designado
    }
  }
  return pickPlayerFull(side, config, posFilter)
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
  // Overrides táticos vindos da UI (formação/mentalidade/estilo/moral aplicados)
  if (config.homeAttack != null) homeSt.attack = config.homeAttack
  if (config.homeDefense != null) homeSt.defense = config.homeDefense
  if (config.homeMidfield != null) homeSt.midfield = config.homeMidfield
  if (config.awayAttack != null) awaySt.attack = config.awayAttack
  if (config.awayDefense != null) awaySt.defense = config.awayDefense
  if (config.awayMidfield != null) awaySt.midfield = config.awayMidfield
  // Mentalidade: desloca ataque<->defesa. Ofensivo cria mais mas concede mais; defensivo
  // o inverso. Aplicado sobre a forca ja derivada (mesma escala de overall).
  const applyMentality = (st: SquadStrengths, m?: "defensivo" | "equilibrado" | "ofensivo") => {
    if (m === "ofensivo") { st.attack += 6; st.defense -= 5 }
    else if (m === "defensivo") { st.attack -= 5; st.defense += 6 }
  }
  applyMentality(homeSt, config.homeMentality)
  applyMentality(awaySt, config.awayMentality)

  // ── Dificuldade da CPU (relatorio #4) ──────────────────────────────────────
  // Quando o USUARIO joga (userSide definido), o adversario controlado pela maquina
  // recebe um reforco MODERADO em ataque/defesa/meio/goleiro. Deixa as partidas mais
  // disputadas e imersivas sem virar impossivel. Jogos IA vs IA (sem userSide) ficam
  // neutros. Como os atributos vivem na escala ~40-99, +6 equivale a um "degrau" de
  // qualidade — perceptivel, porem justo.
  const CPU_DIFFICULTY = 6
  if (config.userSide === "home") {
    awaySt.attack += CPU_DIFFICULTY
    awaySt.defense += CPU_DIFFICULTY
    awaySt.midfield += CPU_DIFFICULTY
    awaySt.gkRating += CPU_DIFFICULTY * 0.7
  } else if (config.userSide === "away") {
    homeSt.attack += CPU_DIFFICULTY
    homeSt.defense += CPU_DIFFICULTY
    homeSt.midfield += CPU_DIFFICULTY
    homeSt.gkRating += CPU_DIFFICULTY * 0.7
  }

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

  // weatherFactor (0.85-1.0): chuva/gramado ruim reduz a criação de chances
  const wf = config.weatherFactor != null ? Math.max(0.75, Math.min(1, config.weatherFactor)) : 1

  const homeShotChance = Math.max(0.04, Math.min(0.22,
    (baseShot + homeAttDiff + homeMomBonus - homeRedShotPen + homeLateBonus) * wf * (0.96 + homeAdvantage * 0.44)
  ))
  const awayShotChance = Math.max(0.04, Math.min(0.22,
    (baseShot + awayAttDiff + awayMomBonus - awayRedShotPen + awayLateBonus) * wf * (1.06 - homeAdvantage * 0.38)
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

  let cardChance = 0.13
  if (mods?.isDerby) cardChance = 0.20
  if (mods?.matchImportance === "final") cardChance = 0.17
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
    cardChance: Math.min(0.32, cardChance),
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
  const base = 0.03 + rnd() * 0.11
  const shooterBonus = (shooterShooting - 70) * 0.0015   // bom chutador aumenta
  const gkPenalty = (gkDefending - 70) * 0.0013          // bom goleiro reduz
  const lateBonus = minute >= 85 ? 0.022 : minute >= 78 ? 0.012 : 0
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

    if (rnd() < Math.min(0.62, xg * 2.0)) {
      // GOL
      teamStats.goals += 1
      const team = isHome ? config.homeTeam : config.awayTeam
      // ~72% dos gols em jogo aberto têm assistência (taxa realista)
      let assistName: string | undefined
      if (rnd() < 0.88) {
        const assistData = pickPlayerFull(side, config, ["MEI", "VOL", "PD", "PE", "LD", "LE"])
        const candidate = assistData?.nome ?? pickPlayer(side, config, ["MEI", "VOL", "PD", "PE", "LD", "LE"])
        if (candidate !== shooterName) assistName = candidate
      }
      state.events = [{
        id: nameId(), minute, type: "goal", side,
        text: goalLine(shooterName, team.curto, assistName),
        player: shooterName, assist: assistName, important: true,
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
      text: saveLine(shooterName, gkName),
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
    } else if (rnd() < 0.80) {
      // Escanteio
      teamStats.corners += 1
      const team = isHome ? config.homeTeam : config.awayTeam
      state.events = [{
        id: nameId(), minute, type: "corner", side,
        text: `Escanteio para ${team.curto}`,
      }, ...state.events]
      state.momentum += isHome ? 6 : -6

      // Resolução do escanteio: ~30% vira cabeçada perigosa (~4% do total de escanteios = gol)
      if (rnd() < 0.30) {
        const hdrData = pickPlayerFull(side, config, ["ZAG", "ATA", "VOL"])
        const hdrName = hdrData?.nome ?? pickPlayer(side, config, ["ZAG", "ATA", "VOL"])
        const hdrShooting = (hdrData?.shooting ?? (isHome ? probs.homeAttStr : probs.awayAttStr)) * 0.82
        const oppGK = isHome ? probs.awayGKStr : probs.homeGKStr
        teamStats.shots += 1
        const hdrXG = computeXG(hdrShooting, oppGK, minute) * 0.72
        teamStats.xG += hdrXG
        // 42% de cabeçadas no alvo (taxa real em escanteios); 30% das no alvo = gol
        if (rnd() < 0.42) {
          teamStats.shotsOnTarget += 1
          if (rnd() < 0.18) {
            teamStats.goals += 1
            const takerData = pickSetPieceTaker(side, config, "corner", ["MEI", "PD", "PE"])
            const cornerCandidate = takerData?.nome ?? pickPlayer(side, config, ["MEI", "PD", "PE"])
            const cornerTaker = cornerCandidate !== hdrName ? cornerCandidate : undefined
            state.events = [{
              id: nameId(), minute, type: "goal", side,
              text: cornerTaker
                ? `GOOOOL! ${hdrName} marca de cabeça no escanteio cobrado por ${cornerTaker}!`
                : `GOOOOL! ${hdrName} marca de cabeça no escanteio!`,
              player: hdrName, assist: cornerTaker, important: true,
            }, ...state.events]
            state.flash = { side, type: "goal" }
            state.ball = { x: 50, y: 50, side: isHome ? "away" : "home" }
            state.momentum = isHome ? 20 : -20
          } else {
            state.events = [{
              id: nameId(), minute, type: "save", side,
              text: `${hdrName} cabeceia no escanteio, goleiro defende!`,
              player: hdrName,
            }, ...state.events]
            state.flash = { side, type: "chance" }
            state.momentum += isHome ? -5 : 5
          }
        }
      }
    } else if (rnd() < 0.5) {
      // Finalizacao pra fora, sem escanteio nem trave — narra as vezes (nao spamar).
      state.events = [{
        id: nameId(), minute, type: "miss", side,
        text: missLine(shooterName),
        player: shooterName,
      }, ...state.events]
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

  // Calibrado para cerca de 0,08-0,18 expulsao por partida em amostra longa.
  // O multiplicador anterior criava reincidencia de amarelos em quase todo jogo.
  if (rnd() < probs.cardChance * 0.4) {
    const squad = side === "home" ? config.homeSquad : config.awaySquad
    const eligible = (squad ?? []).filter(candidate => !state.playerRedCards[`${side}:${candidate.nome.toLocaleLowerCase("pt-BR")}`])
    const player = eligible.length > 0
      ? (eligible.filter(candidate => ["ZAG", "VOL", "LD", "LE"].includes(candidate.pos)).sort(() => rnd() - .5)[0] ?? eligible[Math.floor(rnd() * eligible.length)]).nome
      : pickPlayer(side, config, ["ZAG", "VOL", "LD", "LE"])
    const cardKey = `${side}:${player.toLocaleLowerCase("pt-BR")}`
    const previousYellows = state.playerYellowCards[cardKey] ?? 0
    const isSecondYellow = previousYellows >= 1
    const isStraightRed = !isSecondYellow && rnd() < 0.003
    const isRed = isSecondYellow || isStraightRed

    if (isRed) {
      if (isSecondYellow) {
        teamStats.yellows += 1
        state.playerYellowCards[cardKey] = previousYellows + 1
      }
      teamStats.reds += 1
      state.playerRedCards[cardKey] = true
      if (isHome) state.homeReds += 1
      else state.awayReds += 1
      state.events = [{
        id: nameId(), minute, type: "red_card", side,
        text: isSecondYellow ? `Segundo amarelo para ${player}. EXPULSO!` : `Cartão VERMELHO para ${player}`,
        player, important: true,
      }, ...state.events]
      state.flash = { side, type: "card", cardColor: "red" }
      // Vermelho é golpe pesado no momentum
      state.momentum += isHome ? -25 : 25
    } else {
      teamStats.yellows += 1
      state.playerYellowCards[cardKey] = previousYellows + 1
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

  // Falta perigosa → cobrança direta: ~12% das faltas viram finalização
  if (rnd() < 0.12) {
    const fkSide: Side = isHome ? "away" : "home"  // time que cobra a falta
    const fkIsHome = fkSide === "home"
    const fkData = pickPlayerFull(fkSide, config, ["MEI", "ATA", "VOL"])
    const fkName = fkData?.nome ?? pickPlayer(fkSide, config, ["MEI", "ATA"])
    const fkShooting = (fkData?.shooting ?? (fkIsHome ? probs.homeAttStr : probs.awayAttStr)) * 0.85
    const fkGKDef = fkIsHome ? probs.awayGKStr : probs.homeGKStr
    const fkStats = fkIsHome ? state.home : state.away
    fkStats.shots += 1
    const fkXG = computeXG(fkShooting, fkGKDef, minute) * 0.75
    fkStats.xG += fkXG
    if (rnd() < Math.min(0.42, fkXG * 1.6)) {
      fkStats.shotsOnTarget += 1
      if (rnd() < Math.min(0.38, fkXG * 1.4)) {
        fkStats.goals += 1
        state.events = [{
          id: nameId(), minute, type: "goal", side: fkSide,
          text: `GOOOOL! ${fkName} marca de falta direto!`,
          player: fkName, important: true,
        }, ...state.events]
        state.flash = { side: fkSide, type: "goal" }
        state.ball = { x: 50, y: 50, side: fkIsHome ? "away" : "home" }
        state.momentum = fkIsHome ? 20 : -20
      } else {
        state.events = [{
          id: nameId(), minute, type: "save", side: fkSide,
          text: `${fkName} cobra falta, goleiro defende!`,
          player: fkName,
        }, ...state.events]
        state.flash = { side: fkSide, type: "chance" }
      }
    }
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

    // Penalti do USUARIO: o motor PARA aqui. Antes ele cobrava no mesmo tick — o gol
    // ja estava no placar quando a UI ia reagir, o evento de penalti ficava soterrado
    // sob o de gol (o modal nunca abria) e a escolha do batedor seria decorativa.
    if (config.userSide === side) {
      state.pendingPenalty = { side, minute }
      return
    }

    // Penalti da IA: cobra na hora, com um batedor escolhido pelo proprio motor.
    resolvePenaltyKick(state, config, side, null, probs)
  }
}

/** Desfecho da cobranca — alimenta a narracao do modal. */
export interface PenaltyOutcome {
  scored: boolean
  /** "gol" | "defendeu" | "fora" — o "fora" so existe quando erra o alvo. */
  kind: "gol" | "defesa" | "fora"
  takerName: string
  gkName: string
}

/**
 * Executa a cobranca de penalti. `taker` = batedor escolhido pelo usuario; quando null,
 * o motor escolhe (usado para os penaltis da IA).
 */
function resolvePenaltyKick(
  state: MatchState,
  config: MatchConfig,
  side: Side,
  taker: SquadPlayer | null,
  probs: DynamicProbs,
): PenaltyOutcome {
  const isHome = side === "home"
  const gkSide: Side = isHome ? "away" : "home"
  const teamStats = isHome ? state.home : state.away
  const minute = state.minute

  // Ordem: escolha explícita do usuário no modal > cobrador designado na tática
  // > sorteio por posição.
  const takerData = taker ?? pickSetPieceTaker(side, config, "penalty", ["ATA", "MEI"])
  const takerShooting = takerData?.shooting ?? (isHome ? probs.homeAttStr : probs.awayAttStr)
  const takerName = takerData?.nome ?? pickPlayer(side, config, ["ATA"])
  const gkData = pickPlayerFull(gkSide, config, ["GOL"])
  const gkName = gkData?.nome ?? pickPlayer(gkSide, config, ["GOL"])

  // A escolha do batedor IMPORTA: a conversao sai do shooting dele.
  const convRate = Math.min(0.88, 0.72 + (takerShooting - 70) * 0.003)
  teamStats.shots += 1

  if (rnd() < convRate) {
    teamStats.goals += 1
    teamStats.shotsOnTarget += 1
    teamStats.xG += 0.78
    state.events = [{
      id: nameId(), minute, type: "goal", side,
      text: `GOOOL! ${takerName} converte o pênalti`,
      player: takerName, important: true,
    }, ...state.events]
    state.flash = { side, type: "goal" }
    state.momentum = isHome ? 18 : -18
    return { scored: true, kind: "gol", takerName, gkName }
  }

  // Errou: ~30% das perdidas vao para FORA; o resto o goleiro pega.
  if (rnd() < 0.3) {
    state.events = [{
      id: nameId(), minute, type: "miss", side,
      text: `${takerName} isola o pênalti! Perdeu uma chance de ouro.`,
      player: takerName, important: true,
    }, ...state.events]
    state.flash = { side, type: "chance" }
    state.momentum += isHome ? -20 : 20
    return { scored: false, kind: "fora", takerName, gkName }
  }

  teamStats.shotsOnTarget += 1
  state.events = [{
    id: nameId(), minute, type: "save", side,
    text: `${gkName} defende o pênalti de ${takerName}!`,
    important: true,
  }, ...state.events]
  state.flash = { side, type: "chance" }
  state.momentum += isHome ? -20 : 20
  return { scored: false, kind: "defesa", takerName, gkName }
}

/**
 * Cobra o penalti pendente com o batedor escolhido pelo usuario e libera a partida.
 * Chamado pela UI depois que o jogador escolhe no modal.
 */
export function resolvePendingPenalty(
  state: MatchState,
  config: MatchConfig,
  taker: SquadPlayer | null,
): { state: MatchState; outcome: PenaltyOutcome | null } {
  if (!state.pendingPenalty) return { state, outcome: null }

  const next: MatchState = {
    ...state,
    home: { ...state.home },
    away: { ...state.away },
    events: state.events.slice(),
    flash: null,
  }

  const probs = calcDynamicProbs(config, next)
  const outcome = resolvePenaltyKick(next, config, next.pendingPenalty!.side, taker, probs)
  next.pendingPenalty = null
  next.momentum = Math.max(-50, Math.min(50, next.momentum))
  return { state: next, outcome }
}

// ──────���──────────────────────────────────────────────────────────────────────
// Atualização de posse (baseada em midfield + momentum)
// ──────────────────────────────────────���──────────────────────────────────────

function updatePossession(state: MatchState, config: MatchConfig): void {
  const homeSt = deriveStrengths(config.homeSquad, config.homeRating)
  const awaySt = deriveStrengths(config.awaySquad, config.awayRating)
  if (config.homeMidfield != null) homeSt.midfield = config.homeMidfield
  if (config.awayMidfield != null) awaySt.midfield = config.awayMidfield

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
  const clamp01 = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  // ── Bola guiada pelo EVENTO do minuto ────────────────────────────────────────
  // moveBall roda DEPOIS de generateMinuteEvents, entao events[0] e o lance deste
  // minuto. Antes a bola so mirava o terco de ataque e, com o lado sorteado ~50/50,
  // a suavizacao a puxava pro meio (o "so fica no meio do campo"). Agora cada tipo
  // de lance leva a bola pro lugar certo: gol -> meio (recomeco), chute/defesa ->
  // area, escanteio -> quina, falta/cartao -> ponto da falta, e a posse manda no
  // lado quando nao ha lance.
  const ev = state.events[0]
  const evThis = ev && ev.minute === state.minute
  // adv = quanto o time avancou rumo ao gol adversario (0 = gol proprio, 1 = gol adv).
  // Converte para x do campo conforme o lado ataca.
  const toX = (side: Side, adv: number) => (side === "home" ? adv * 100 : (1 - adv) * 100)

  if (evThis && ev) {
    const s = ev.side
    if (ev.type === "goal" || ev.type === "kickoff") {
      state.ball = { x: 50, y: 50, side: ev.type === "goal" ? (s === "home" ? "away" : "home") : s }
      return
    }
    let adv = 0.6
    let ty = 20 + rnd() * 60
    switch (ev.type) {
      case "penalty":
        adv = 0.88; ty = 50; break
      case "shot": case "shot_on_target": case "save": case "miss": case "post":
        adv = 0.80 + rnd() * 0.12; ty = 34 + rnd() * 32; break
      case "corner":
        adv = 0.97; ty = rnd() < 0.5 ? 6 : 94; break
      case "foul": case "yellow_card": case "red_card":
        // Falta: jogo parado num ponto qualquer, mais provavel no meio/ataque.
        adv = 0.35 + rnd() * 0.45; ty = 10 + rnd() * 80; break
      case "injury":
        adv = 0.30 + rnd() * 0.40; ty = 10 + rnd() * 80; break
      default:
        adv = 0.55 + rnd() * 0.25; ty = 25 + rnd() * 50
    }
    const tx = toX(s, adv)
    // Lance definido: a bola pula quase direto pro local (pouca inercia).
    state.ball = {
      x: clamp01(state.ball.x * 0.25 + tx * 0.75, 2, 98),
      y: clamp01(state.ball.y * 0.25 + ty * 0.75, 4, 96),
      side: s,
    }
    return
  }

  // ── Jogo aberto (sem lance): posse decide o lado; zonas dao variedade ─────────
  // Antes o lado saia so do momentum -> ~50/50 -> media no meio. Agora parte da
  // posse REAL.
  const homePoss = isNaN(state.home.possession) ? 50 : state.home.possession
  const homeProb = clamp01(
    homePoss / 100 + state.momentum * 0.002 + state.awayReds * 0.06 - state.homeReds * 0.06,
    0.18, 0.86,
  )
  const side: Side = rnd() < homeProb ? "home" : "away"

  // Zonas de campo: construcao, progressao, terco final, ou recuo/lateral.
  const r = rnd()
  let adv: number
  let ty: number
  if (r < 0.30) { adv = 0.32 + rnd() * 0.18; ty = 25 + rnd() * 50 }        // construcao (meio-campo)
  else if (r < 0.62) { adv = 0.50 + rnd() * 0.22; ty = 15 + rnd() * 70 }   // progressao
  else if (r < 0.86) { adv = 0.72 + rnd() * 0.20; ty = 20 + rnd() * 60 }   // terco final
  else { adv = 0.40 + rnd() * 0.25; ty = rnd() < 0.5 ? 6 + rnd() * 10 : 84 + rnd() * 10 } // lateral/lance de linha

  const tx = toX(side, adv)
  // Jogo aberto: menos inercia que antes (0.68 -> 0.52) pra bola de fato viajar.
  state.ball = {
    x: clamp01(state.ball.x * 0.52 + tx * 0.48, 2, 98),
    y: clamp01(state.ball.y * 0.55 + ty * 0.45, 4, 96),
    side,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tick: avança 1 minuto de partida
// ─────────────────────────────────────────────────────────────────────────────

function getDurationMinutes(config?: MatchConfig): number {
  const d = config?.durationMinutes
  return Number.isFinite(d) && (d ?? 0) > 0 ? d! : 90
}

function getHalfDuration(config?: MatchConfig): number {
  return Math.floor(getDurationMinutes(config) / 2)
}

/**
 * Reinicio do 2o tempo. O relogio VOLTA para o fim do 1o tempo (45'): o motor conta
 * ticks, entao o acrescimo do 1o tempo ficava grudado no contador e empurrava o resto
 * da partida — o 2o tempo comecava aos 48'/51' e o jogo terminava aos 95'/97'.
 *
 * Estava duplicada em quatro lugares (tickMinute, simulateFullMatch e duas vezes no hook
 * da partida ao vivo) e nenhum resetava o minuto; por isso agora mora so aqui.
 */
export function resumeSecondHalf(state: MatchState, config?: MatchConfig): MatchState {
  if (state.phase !== "halftime") return state
  return {
    ...state,
    phase: "second",
    minute: getHalfDuration(config),
    momentum: 0,  // o intervalo reseta o momentum
    addedTime: 0, // zera para o acrescimo do 2o tempo
    flash: null,  // nenhum lance do 1o tempo pode piscar no reinicio
  }
}

/**
 * Minuto de FUTEBOL para carimbar um evento. O motor conta ticks; no acrescimo o
 * ponteiro trava em 45'/90' e o excedente vira "+N" — senao um gol no tick 94 aparece
 * como "94'" em vez de "90+4'". Tambem serve para eventos criados pela UI
 * (substituicao), para que o relogio seja o mesmo em todo lugar.
 */
export function getFootballClock(
  state: MatchState,
  config?: MatchConfig,
): { minute: number; addedTime?: number } {
  if (state.phase !== "first" && state.phase !== "second") {
    return { minute: state.minute }
  }
  const base = state.phase === "first" ? getHalfDuration(config) : getDurationMinutes(config)
  const over = state.minute - base
  return over > 0 ? { minute: base, addedTime: over } : { minute: state.minute }
}

function stampStoppage(next: MatchState, eventsBefore: number, config: MatchConfig): void {
  const { addedTime: over } = getFootballClock(next, config)
  if (!over) return
  const base = next.minute - over

  // generateMinuteEvents insere os novos eventos no INICIO do array.
  const created = next.events.length - eventsBefore
  for (let i = 0; i < created; i++) {
    next.events[i] = { ...next.events[i], minute: base, addedTime: over }
  }
}

export function tickMinute(state: MatchState, config: MatchConfig): MatchState {
  if (state.phase === "fulltime" || state.phase === "pre") return state
  // Penalti do usuario pendente: o relogio NAO anda ate ele escolher o batedor.
  if (state.pendingPenalty) return state

  // O intervalo acaba aqui: devolve o relogio para 45' antes de seguir.
  if (state.phase === "halftime") return resumeSecondHalf(state, config)

  const durationMinutes = getDurationMinutes(config)

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

  // ── Transições de fase ────────────────────────────────────────────────────

  // Ao atingir o minuto 45: rola o acréscimo (1-4 min) em vez de entrar no intervalo
  if (next.minute === halfDuration && state.phase === "first") {
    next.addedTime = 1 + Math.floor(rnd() * 4)
    generateMinuteEvents(next, config)
    updatePossession(next, config)
    moveBall(next)
    next.momentum = Math.max(-50, Math.min(50, next.momentum))
    return next
  }

  // Entra no intervalo depois de esgotar o acréscimo do 1º tempo
  if (state.phase === "first" && state.minute >= halfDuration && next.minute > halfDuration + state.addedTime) {
    next.phase = "halftime"
    next.events = [{
      id: nameId(),
      minute: halfDuration,
      addedTime: state.addedTime,
      type: "halftime",
      side: "home",
      text: `Fim do 1º tempo (+${state.addedTime}')`,
      important: true,
    }, ...next.events]
    next.ball = { x: 50, y: 50, side: "away" }
    return next
  }

  // Ao atingir o minuto 90: rola o acréscimo (2-5 min) em vez de encerrar
  if (next.minute === durationMinutes && state.phase === "second") {
    next.addedTime = 2 + Math.floor(rnd() * 5)
    generateMinuteEvents(next, config)
    updatePossession(next, config)
    moveBall(next)
    next.momentum = Math.max(-50, Math.min(50, next.momentum))
    return next
  }

  // Encerra depois de esgotar o acréscimo do 2º tempo
  if (state.phase === "second" && state.minute >= durationMinutes && next.minute > durationMinutes + state.addedTime) {
    next.phase = "fulltime"
    next.events = [{
      id: nameId(),
      minute: durationMinutes,
      addedTime: state.addedTime,
      type: "fulltime",
      side: "home",
      text: `Fim de jogo. ${config.homeTeam.curto} ${next.home.goals} x ${next.away.goals} ${config.awayTeam.curto}`,
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

  const eventsBefore = next.events.length
  generateMinuteEvents(next, config)
  stampStoppage(next, eventsBefore, config)
  updatePossession(next, config)
  moveBall(next)

  // Clamp do momentum
  next.momentum = Math.max(-50, Math.min(50, next.momentum))

  return next
}

// ───────────────────────────────────────────────────────────────────���─────────
// Inicia primeiro tempo
// ─────────────────────────────────────────────────────────────────────────────

export function startMatch(state: MatchState): MatchState {
  if (state.phase !== "pre") return state
  return { ...state, phase: "first", minute: 0 }
}

// ──────────��─────────────────────────────���────────────────────────────────────
// Simulação rápida (sem ticks visuais)
// ───────────────────────────────��─────────────────────────────────────────────

export function simulateFullMatch(config: MatchConfig): MatchState {
  let state = startMatch(createInitialState())
  while (state.phase !== "fulltime") {
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
