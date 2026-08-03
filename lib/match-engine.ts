// Motor de simulação de partida - Ultrafoot 26 v2
// Usa atributos individuais dos jogadores (shooting, defending, passing, stamina),
// sistema de momentum, impacto de cartões vermelhos e fadiga para resultados realistas.

import type { Team } from "@/lib/teams-data"
import { penalidadeImprovisacao } from "@/lib/formations"

// ─────────────────────────────────────────────────────────────────────────────
// Tipos base
// ─────────────────────────────────────────────────────────────────────────────

export type MatchSpeed = "slow" | "normal" | "fast" | "ultra" | "hyper"

// Velocidades expostas na UI: 1x, 3x, 5x (pedido do jogador). O "1x" e a base
// (normal = 2 ticks/s); fast = 3x = 6, ultra = 5x = 10. slow/hyper ficam no tipo
// por compatibilidade de saves antigos, mas nao aparecem mais nos botoes.
export const SPEED_TICKS_PER_SEC: Record<MatchSpeed, number> = {
  slow: 1,
  normal: 2,
  fast: 6,
  ultra: 10,
  hyper: 30,
}

export type MatchPhase =
  | "pre"
  | "first"
  | "halftime"
  | "second"
  | "fulltime"
  /**
   * DISPUTA DE PENALTIS — mata-mata empatado ao fim dos 90.
   *
   * Ate aqui o jogo simplesmente apitava "fulltime" num 1x1 de final e o
   * classificado era decidido DEPOIS, fora da partida, por um cara-ou-coroa em
   * `passouNoConfronto` (lib/cup-bracket). O momento mais tenso do futebol nao
   * existia: voce jogava a final, empatava, e descobria pelo calendario se tinha
   * passado. Agora a partida NAO termina no empate — ela entra nesta fase.
   */
  | "penaltis"

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
  // Estes dois existiam na narracao (lib/commentary-engine) e na tatica
  // (offsideTrap / contra-ataque) mas NUNCA eram gerados pelo motor: o texto
  // estava pronto e nunca disparava. O jogador ligava a linha de impedimento,
  // recebia o bonus defensivo e passava 90 minutos sem ver um impedimento.
  | "offside"
  | "counter_attack"

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
  /**
   * Só em `red_card`. O motor SEMPRE soube se a expulsão foi por segundo
   * amarelo ou vermelho direto (era a diferenca entre dois textos), mas isso
   * morria na string — o pos-jogo recebia um booleano "vermelho" e dava 1 jogo
   * de suspensao para qualquer caso. Estruturado, o tribunal pode julgar.
   */
  motivoExpulsao?: "segundo_amarelo" | "vermelho_direto"
  /** Só em `red_card` direto: agressao (pena de 4-8) em vez de falta dura. */
  expulsaoViolenta?: boolean
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
  homeInjuries: number // lesoes no jogo (o substituto rende um pouco menos)
  awayInjuries: number
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
  /**
   * Disputa de penaltis em andamento. `null` em toda partida que nao empatou num
   * mata-mata decisivo — ou seja, na esmagadora maioria dos jogos.
   */
  shootout: ShootoutState | null
}

/** Uma cobranca da disputa. */
export interface ShootoutKick {
  ordem: number
  side: Side
  batedor: string
  goleiro: string
  resultado: "gol" | "defesa" | "fora"
}

export interface ShootoutState {
  kicks: ShootoutKick[]
  homeGoals: number
  awayGoals: number
  /** Lado da PROXIMA cobranca. */
  nextSide: Side
  /** Lado que abre a disputa (sorteio de moeda, como na vida real). */
  firstSide: Side
  /** Passou das cinco cobrancas regulamentares: agora e alternada, morte subita. */
  suddenDeath: boolean
  finished: boolean
  winner: Side | null
  /**
   * Quem ja bateu, por lado. Nenhum atleta repete antes de TODOS os que estao em
   * campo baterem — e a regra real, e sem ela o usuario escalaria o melhor
   * finalizador nas cinco cobrancas.
   */
  usedHome: string[]
  usedAway: string[]
}

const SHOOTOUT_REGULATION_KICKS = 5

// Jogador do elenco — nome+pos obrigatórios, atributos opcionais (retrocompat)
export interface SquadPlayer {
  nome: string
  /** Posição em que está ESCALADO (o slot da formação). */
  pos: string
  /**
   * Posição de ORIGEM do atleta. Quando difere de `pos`, ele está improvisado e
   * rende menos — ver penalidadeImprovisacao em lib/formations. Ausente = assume
   * que está na posição natural (comportamento de antes desta versão).
   */
  posNatural?: string
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
   * Linha de impedimento (lib/tactics-engine.offsideTrap). Chega ate aqui para
   * o motor poder GERAR impedimentos — antes a opcao so alterava um multiplicador
   * defensivo e o jogador nunca via a consequencia em campo.
   */
  homeOffsideTrap?: boolean
  awayOffsideTrap?: boolean
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
    homeInjuries: 0,
    awayInjuries: 0,
    playerYellowCards: {},
    playerRedCards: {},
    pendingPenalty: null,
    shootout: null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────

function rnd(): number { return Math.random() }

/**
 * Converte diferenca de forca em vantagem de chance, com saturacao.
 *
 * Por que raiz e nao multiplicacao direta: a relacao entre forca e resultado no
 * futebol nao e linear. Um time 5 pontos melhor ganha um pouco mais; um time 20
 * pontos melhor NAO ganha quatro vezes mais — ganha bastante mais, com teto.
 * O expoente 0,55 mantem quase toda a sensibilidade ate ~10 pontos (onde vive a
 * maioria dos confrontos) e achata dai para cima.
 *
 *   diferenca:   5     10     20     30     40
 *   antes:    0,010  0,020  0,040  0,060  0,080
 *   agora:    0,008  0,012  0,018  0,023  0,027
 *
 * Medido em 6.000 partidas por faixa — ver relatorio.md, achado 19.
 */
function comprimir(diferenca: number): number {
  return Math.sign(diferenca) * Math.pow(Math.abs(diferenca), 0.50)
}

function comprimirVantagem(diferenca: number): number {
  return comprimir(diferenca) * 0.0035
}
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

  // A PENALIDADE DE IMPROVISAÇÃO entra aqui, no ponto em que o atributo do
  // atleta vira força de setor. Antes, escalar um centroavante na zaga não tinha
  // custo nenhum: ele defendia como um zagueiro. Agora rende menos, e quanto
  // mais distante a função, maior a perda (trocar de lado custa quase nada).
  const avgAttr = (players: SquadPlayer[], attr: keyof SquadPlayer): number => {
    if (players.length === 0) return fallback
    const soma = players.reduce((s, p) => {
      const valor = (p[attr] as number | undefined) ?? fallback
      const fator = p.posNatural ? penalidadeImprovisacao(p.posNatural, p.pos) : 1
      return s + valor * fator
    }, 0)
    return soma / players.length
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
  // Um valor FIXO para todo adversario era o problema: o lanterna virava muralha
  // e o lider nao apertava mais do que ele. Agora a dificuldade tem tres partes,
  // e e por isso que fica mais dificil E mais realista ao mesmo tempo:
  //
  //   1. base — o degrau de qualidade que a maquina ganha por ser a maquina;
  //   2. quem e melhor que voce IMPOE mais (e quem e pior nao vira gigante):
  //      a diferenca de forca entra com peso, mas limitada nas duas pontas;
  //   3. jogo grande aperta — classico, decisao e final pesam, como na vida.
  const cpuEhVisitante = config.userSide === "home"
  const forcaCpu = cpuEhVisitante ? config.awayRating : config.homeRating
  const forcaUsuario = cpuEhVisitante ? config.homeRating : config.awayRating

  let CPU_DIFFICULTY = 0
  if (config.userSide) {
    CPU_DIFFICULTY = 9
    CPU_DIFFICULTY += Math.max(-3, Math.min(7, (forcaCpu - forcaUsuario) * 0.09))
    const ctx = config.modifiers
    if (ctx?.isDerby) CPU_DIFFICULTY += 2
    if (ctx?.matchImportance === "decisivo") CPU_DIFFICULTY += 2
    else if (ctx?.matchImportance === "final") CPU_DIFFICULTY += 3
  }

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
  // Base elevada de 0,075 para 0,083: a medicao de 20.000 partidas deu 1,21 gol
  // por time contra ~1,35 do futebol real, com cauda fina demais (jogos de 3+
  // gols em 8,4% contra 11% reais).
  const avg = total / 2
  const baseShot = Math.min(0.16, 0.089 + (avg - 60) * 0.0022)

  // Diferencial ataque vs defesa adversária, COMPRIMIDO.
  //
  // Historico: o peso era 0.0010 (o acaso dominava), foi dobrado para 0.0020 e
  // resolveu o favoritismo — mas de forma LINEAR, e ai a conta desandou na outra
  // ponta. Medindo 6.000 partidas por faixa, 20 pontos de diferenca davam 88,9%
  // de vitoria para o favorito e placar medio de 2,90 x 0,51. No futebol real
  // esse confronto fica na casa de 65-70%: zebra faz parte, e e o que da graca a
  // Copa do Brasil.
  //
  // A correcao NAO e baixar o peso (isso mataria o favoritismo de novo) e sim
  // COMPRIMIR: manter a sensibilidade nas diferencas pequenas, que sao as comuns,
  // e saturar nas grandes. E a mesma escolha que o Brasfoot documenta no manual
  // ("um jogador forca 100 e LIGEIRAMENTE melhor do que um forca 95").
  const homeAttDiff = comprimirVantagem(homeAttEff - awayDefEff)
  const awayAttDiff = comprimirVantagem(awayAttEff - homeDefEff)

  // MEIO-CAMPO cria chances (antes so mexia na posse, um numero cosmetico):
  // dominar o meio gera mais finalizacoes, como na vida real.
  const midDiff = homeSt.midfield - awaySt.midfield
  const homeMidBonus = Math.max(-0.05, Math.min(0.05, midDiff * 0.0016))
  const awayMidBonus = Math.max(-0.05, Math.min(0.05, -midDiff * 0.0016))

  // ANTI-GOLEADA / gestao de resultado: o gol dava momentum ao ARTILHEIRO, que
  // ficava mais forte — bola de neve rumo a goleada. Invertido: quem esta na
  // FRENTE recua (cria menos); quem esta ATRAS se lanca (cria mais). E o que os
  // times fazem de verdade — segurar o resultado / partir para o desespero.
  // ATENUADO. O efeito e real (time na frente recua), mas na intensidade antiga
  // virava elastico: puxava todo jogo de volta ao empate. Medindo 20.000
  // partidas entre iguais, davam 31,8% de empate contra ~26% do futebol real —
  // e, mais revelador, contra ~28% que DUAS POISSON INDEPENDENTES com a mesma
  // media dariam. Ou seja, o excesso nao era variancia: era acoplamento entre os
  // dois lados, criado aqui. Reduzido a ~55% da forca anterior.
  const lead = state.home.goals - state.away.goals
  const homeLeadAdj = lead >= 2 ? -0.011 : lead === 1 ? -0.004 : lead === -1 ? 0.004 : lead <= -2 ? 0.011 : 0
  const awayLeadAdj = -homeLeadAdj

  // Penalidade por time com 10 jogadores
  const homeRedShotPen = state.homeReds * 0.09
  const awayRedShotPen = state.awayReds * 0.09

  // Lesao enfraquece o time (substituto rende menos), efeito modesto e limitado.
  const homeInjPen = Math.min(0.045, state.homeInjuries * 0.018)
  const awayInjPen = Math.min(0.045, state.awayInjuries * 0.018)

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

  const homeShotChance = Math.max(0.03, Math.min(0.24,
    (baseShot + homeAttDiff + homeMidBonus + homeLeadAdj - homeRedShotPen - homeInjPen + homeLateBonus) * wf * (0.96 + homeAdvantage * 0.44)
  ))
  const awayShotChance = Math.max(0.03, Math.min(0.24,
    (baseShot + awayAttDiff + awayMidBonus + awayLeadAdj - awayRedShotPen - awayInjPen + awayLateBonus) * wf * (1.06 - homeAdvantage * 0.38)
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
  // Peso do finalizador e do goleiro AUMENTADO: antes (0.0015/0.0013) o acaso
  // dominava e a qualidade individual quase nao aparecia — um artilheiro 90
  // convertia quase igual a um zagueiro. Agora a habilidade pesa de verdade.
  // COMPRIMIDO, pelo mesmo motivo do comprimirVantagem — e aqui o efeito era
  // ainda mais forte. Com os pesos lineares antigos, um confronto de 85 contra
  // 65 dava xG de 0,136 para o forte e 0,024 para o fraco: 5,8x de diferenca so
  // na conversao. Multiplicado pelos chutes a mais, virava 89% de vitoria.
  // A qualidade individual continua pesando (que era o objetivo do ajuste
  // anterior), mas para de escalar sem limite.
  const base = 0.035 + rnd() * 0.085
  const shooterBonus = comprimir(shooterShooting - 70) * 0.0056  // bom chutador aumenta
  const gkPenalty = comprimir(gkDefending - 70) * 0.0050         // bom goleiro reduz
  const lateBonus = minute >= 85 ? 0.022 : minute >= 78 ? 0.012 : 0
  return Math.max(0.02, Math.min(0.6, base + shooterBonus - gkPenalty + lateBonus))
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
      // Vermelho direto: ~1/3 e conduta violenta (agressao), o resto e falta
      // dura/temeraria. E o que separa uma pena de 4-8 jogos de uma de 1-3.
      const violenta = isStraightRed && rnd() < 0.34
      state.events = [{
        id: nameId(), minute, type: "red_card", side,
        text: isSecondYellow
          ? `Segundo amarelo para ${player}. EXPULSO!`
          : violenta
            ? `Cartão VERMELHO para ${player} — agressão! Vai a julgamento.`
            : `Cartão VERMELHO para ${player}`,
        player, important: true,
        motivoExpulsao: isSecondYellow ? "segundo_amarelo" : "vermelho_direto",
        expulsaoViolenta: violenta,
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

/**
 * Impedimento. Devolve true quando a jogada foi anulada.
 *
 * A frequencia sobe quando o time que DEFENDE joga com linha de impedimento
 * (tactics-engine.offsideTrap). Ate agora essa opcao so dava +2% de solidez
 * defensiva, um numero invisivel: o jogador ligava e nao via nada acontecer.
 * ~1,8 impedimentos por jogo na base, ~3 com a armadilha ligada — proximo do
 * que se ve numa partida de verdade.
 */
function marcarImpedimento(side: Side, state: MatchState, config: MatchConfig): boolean {
  const defensor = side === "home" ? "away" : "home"
  const armadilha = defensor === "home" ? config.homeOffsideTrap : config.awayOffsideTrap
  const chance = armadilha ? 0.14 : 0.08
  if (rnd() >= chance) return false

  const time = side === "home" ? config.homeTeam : config.awayTeam
  const jogador = pickPlayer(side, config, ["ATA", "MEI"])
  state.events = [{
    id: nameId(), minute: state.minute, type: "offside", side,
    text: `Impedimento de ${jogador} (${time.curto})`,
    player: jogador,
  }, ...state.events]
  return true
}

/**
 * Contra-ataque: o time que acabou de defender sai em velocidade.
 *
 * Existia como opcao tatica e como texto de narracao, mas o motor nunca gerava
 * o evento — entao "jogar de contra-ataque" nao tinha efeito observavel. Aqui a
 * mentalidade defensiva e o que aumenta a chance, que e justamente a troca do
 * estilo: menos posse, mais perigo quando recupera.
 */
function tentarContraAtaque(side: Side, state: MatchState, config: MatchConfig, probs: DynamicProbs): void {
  const mentalidade = side === "home" ? config.homeMentality : config.awayMentality
  const chance = mentalidade === "defensivo" ? 0.10 : mentalidade === "ofensivo" ? 0.03 : 0.05
  if (rnd() >= chance) return

  const time = side === "home" ? config.homeTeam : config.awayTeam
  const jogador = pickPlayer(side, config, ["ATA", "MEI"])
  state.events = [{
    id: nameId(), minute: state.minute, type: "counter_attack", side,
    text: `Contra-ataque do ${time.curto} puxado por ${jogador}`,
    player: jogador,
  }, ...state.events]
  state.momentum += side === "home" ? 5 : -5
  // O contra-ataque chega com perigo: vira finalizacao em boa parte das vezes.
  if (rnd() < 0.55) resolveShot(side, state, config, probs)
}

function generateMinuteEvents(state: MatchState, config: MatchConfig): void {
  const probs = calcDynamicProbs(config, state)
  const minute = state.minute

  // Finalizações verificadas independentemente para cada time.
  // O impedimento entra ANTES: a jogada existia e foi anulada, entao consome a
  // chance daquele minuto em vez de virar chute.
  const homeVaiChutar = rnd() < probs.homeShotChance
  const awayVaiChutar = rnd() < probs.awayShotChance

  if (homeVaiChutar && marcarImpedimento("home", state, config)) {
    // anulado: nao vira finalizacao
  } else if (homeVaiChutar) {
    resolveShot("home", state, config, probs)
  }
  if (awayVaiChutar && marcarImpedimento("away", state, config)) {
    // anulado
  } else if (awayVaiChutar) {
    resolveShot("away", state, config, probs)
  }

  // Contra-ataque: quem defende e recupera a bola sai em velocidade. So faz
  // sentido quando o time NAO criou a chance neste minuto e o adversario criou.
  if (homeVaiChutar !== awayVaiChutar) {
    const ladoContra: Side = homeVaiChutar ? "away" : "home"
    tentarContraAtaque(ladoContra, state, config, probs)
  }

  // Faltas verificadas independentemente
  if (rnd() < probs.homeFoulChance) resolveFoul("home", state, config, probs)
  if (rnd() < probs.awayFoulChance) resolveFoul("away", state, config, probs)

  // Lesão — mais frequente no 2º tempo e nos minutos finais
  const baseInjury = state.phase === "second" ? 0.007 : 0.003
  const lateMulti = minute >= 75 ? 1.5 : 1.0
  if (rnd() < baseInjury * lateMulti) {
    const injSide: Side = rnd() < probs.homeAdvantage ? "away" : "home"
    const injured = pickPlayer(injSide, config, ["ZAG", "VOL", "MEI", "ATA", "LD", "LE"])
    // Lesao TIRA de campo: o time enfraquece um pouco pelo resto do jogo (o
    // substituto rende menos). Antes a lesao era so um flash narrativo.
    if (injSide === "home") state.homeInjuries += 1
    else state.awayInjuries += 1
    const entra = pickPlayer(injSide, config, ["ATA", "MEI", "VOL", "ZAG", "LD", "LE"])
    state.events = [{
      id: nameId(), minute, type: "injury", side: injSide,
      text: `${injured} se machuca e não tem condições — ${entra} entra no lugar`,
      player: injured, important: true,
    }, ...state.events]
    state.flash = null
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

// ─────────────────────────────────────────────────────────────────────────────
// DISPUTA DE PENALTIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abre a disputa. A partida sai de "fulltime" e entra em "penaltis" — o placar
 * dos 90 minutos fica congelado (os gols da disputa NAO entram nele, como manda
 * a regra: o jogo continua 1x1 na sumula).
 *
 * Quem bate primeiro sai no cara-ou-coroa, que aqui e a UNICA moeda legitima da
 * disputa — decidir o CLASSIFICADO na moeda era o defeito que isto conserta.
 */
export function startShootout(state: MatchState): MatchState {
  if (state.shootout) return state
  const firstSide: Side = rnd() < 0.5 ? "home" : "away"
  return {
    ...state,
    phase: "penaltis",
    shootout: {
      kicks: [],
      homeGoals: 0,
      awayGoals: 0,
      nextSide: firstSide,
      firstSide,
      suddenDeath: false,
      finished: false,
      winner: null,
      usedHome: [],
      usedAway: [],
    },
  }
}

/**
 * Batedores DISPONIVEIS de um lado, na ordem em que a tela deve sugeri-los.
 *
 * Fica de fora quem ja bateu na rodada corrente e quem foi expulso — um time com
 * dois vermelhos bate com nove, e isso pesa. Quando todos ja bateram, a lista
 * reabre (a partir da sexta cobranca o ciclo recomeca).
 */
export function shootoutAvailableTakers(
  state: MatchState,
  config: MatchConfig,
  side: Side,
): SquadPlayer[] {
  const squad = (side === "home" ? config.homeSquad : config.awaySquad) ?? []
  const emCampo = squad.filter(p => !state.playerRedCards[p.nome])
  if (!emCampo.length) return []
  const used = side === "home" ? state.shootout?.usedHome ?? [] : state.shootout?.usedAway ?? []
  // O ciclo se fecha quando TODOS bateram: dai a lista reabre inteira.
  const restantes = emCampo.filter(p => !used.includes(p.nome))
  return restantes.length ? restantes : emCampo
}

/** O melhor batedor disponivel — usado pela IA e quando o usuario nao escolhe. */
function bestShootoutTaker(state: MatchState, config: MatchConfig, side: Side): SquadPlayer | null {
  const pool = shootoutAvailableTakers(state, config, side)
  if (!pool.length) return null
  // Goleiro so bate quando nao sobrou mais ninguem.
  const linha = pool.filter(p => p.pos !== "GOL")
  const base = linha.length ? linha : pool
  return [...base].sort((a, b) => (b.shooting ?? b.rating ?? 70) - (a.shooting ?? a.rating ?? 70))[0]
}

/**
 * A disputa ja tem vencedor matematico?
 *
 * Nas cinco cobrancas regulamentares vale o saldo possivel: 3x1 com o adversario
 * tendo so mais uma cobranca ja acabou. Na morte subita, so decide com os dois
 * lados tendo batido o mesmo numero de vezes.
 */
function shootoutDecided(s: ShootoutState): Side | null {
  const homeKicks = s.kicks.filter(k => k.side === "home").length
  const awayKicks = s.kicks.filter(k => k.side === "away").length

  if (homeKicks >= SHOOTOUT_REGULATION_KICKS && awayKicks >= SHOOTOUT_REGULATION_KICKS) {
    if (homeKicks !== awayKicks) return null
    if (s.homeGoals > s.awayGoals) return "home"
    if (s.awayGoals > s.homeGoals) return "away"
    return null
  }

  const homeRestantes = Math.max(0, SHOOTOUT_REGULATION_KICKS - homeKicks)
  const awayRestantes = Math.max(0, SHOOTOUT_REGULATION_KICKS - awayKicks)
  if (s.homeGoals > s.awayGoals + awayRestantes) return "home"
  if (s.awayGoals > s.homeGoals + homeRestantes) return "away"
  return null
}

/**
 * Cobra UMA penalidade da disputa. `taker` = escolha do usuario; `null` deixa o
 * motor escolher (lado da IA, ou usuario que fechou o modal sem decidir).
 *
 * A conversao sai da FINALIZACAO de quem bate contra o goleiro que esta la —
 * comprimida de proposito, como no resto do motor: um batedor excelente converte
 * ~86%, um ruim ~58%. Penalti e loteria, mas nao e moeda.
 */
export function takeShootoutKick(
  state: MatchState,
  config: MatchConfig,
  taker: SquadPlayer | null,
): { state: MatchState; kick: ShootoutKick | null } {
  const atual = state.shootout
  if (!atual || atual.finished) return { state, kick: null }

  const side = atual.nextSide
  const gkSide: Side = side === "home" ? "away" : "home"
  const escolhido = taker ?? bestShootoutTaker(state, config, side)
  const batedor = escolhido?.nome ?? pickPlayer(side, config, ["ATA"])
  const goleiro = pickPlayerFull(gkSide, config, ["GOL"])?.nome ?? pickPlayer(gkSide, config, ["GOL"])

  const finalizacao = escolhido?.shooting ?? escolhido?.rating
    ?? (side === "home" ? config.homeRating : config.awayRating)
  // Mesma curva comprimida de lib/cup-engine.disputarPenaltis, para a disputa que
  // voce joga e a que a CPU joga terem a MESMA fisica.
  const desvio = finalizacao - 70
  const base = 0.75 + Math.sign(desvio) * Math.pow(Math.abs(desvio), 0.5) * 0.013
  // Na morte subita a pressao cobra seu preco: todo mundo converte um pouco menos.
  const pressao = atual.suddenDeath ? 0.04 : 0
  const conversao = Math.max(0.55, Math.min(0.9, base - pressao))

  const converteu = rnd() < conversao
  // Errou: o goleiro pega com mais frequencia do que a bola vai pra fora.
  const resultado: ShootoutKick["resultado"] = converteu ? "gol" : (rnd() < 0.6 ? "defesa" : "fora")

  const kick: ShootoutKick = {
    ordem: atual.kicks.length + 1,
    side,
    batedor,
    goleiro,
    resultado,
  }

  const kicks = [...atual.kicks, kick]
  const homeGoals = atual.homeGoals + (side === "home" && converteu ? 1 : 0)
  const awayGoals = atual.awayGoals + (side === "away" && converteu ? 1 : 0)

  // Fecha o ciclo: quando TODOS os que estao em campo ja bateram, a lista zera e
  // o primeiro batedor volta a ficar disponivel.
  const elegiveis = (lado: Side) =>
    ((lado === "home" ? config.homeSquad : config.awaySquad) ?? [])
      .filter(p => !state.playerRedCards[p.nome]).length
  const cicla = (lista: string[], lado: Side) => lista.length >= Math.max(1, elegiveis(lado)) ? [] : lista

  const usedHome = cicla(side === "home" ? [...atual.usedHome, batedor] : atual.usedHome, "home")
  const usedAway = cicla(side === "away" ? [...atual.usedAway, batedor] : atual.usedAway, "away")

  const parcial: ShootoutState = {
    ...atual,
    kicks,
    homeGoals,
    awayGoals,
    usedHome,
    usedAway,
    nextSide: gkSide,
    suddenDeath:
      kicks.filter(k => k.side === "home").length >= SHOOTOUT_REGULATION_KICKS &&
      kicks.filter(k => k.side === "away").length >= SHOOTOUT_REGULATION_KICKS,
  }

  const winner = shootoutDecided(parcial)
  const shootout: ShootoutState = winner
    ? { ...parcial, finished: true, winner }
    : parcial

  return { state: { ...state, shootout }, kick }
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
  // "penaltis" entra aqui junto com fulltime: o relogio da partida ja parou e a
  // disputa avanca por cobranca (takeShootoutKick), nunca por minuto. Sem esta
  // guarda o tick voltaria a simular jogo com a disputa aberta.
  if (state.phase === "fulltime" || state.phase === "pre" || state.phase === "penaltis") return state
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

/**
 * Simulacao HEADLESS (sem UI): usada pela simulacao rapida, pela virada de
 * temporada e pelas copas.
 *
 * TRAVAVA PARA SEMPRE quando `userSide` estava definido. Ao sair um penalti para
 * o time do usuario, o motor guarda `pendingPenalty` e PARA — de proposito, para
 * a UI abrir o modal do batedor. Mas aqui nao ha UI: `tickMinute` devolvia o
 * mesmo estado, o minuto nunca andava e o laco girava em 100% de CPU sem nunca
 * chegar a "fulltime". Uma unica partida bastava para pendurar a aba.
 *
 * Agora a cobranca e resolvida na hora (batedor escolhido pelo motor), e um
 * limite de voltas garante que nenhuma condicao nova volte a prender o jogo.
 */
export function simulateFullMatch(config: MatchConfig): MatchState {
  let state = startMatch(createInitialState())
  let voltas = 0
  while (state.phase !== "fulltime" && voltas++ < 600) {
    if (state.pendingPenalty) {
      state = resolvePendingPenalty(state, config, null).state
      continue
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
