// PHASE 18 — Diretoria
// Status: skeleton — perfis paciente/exigente/gastadora/econômica/base/títulos/lucro/politizada.
// Define metas anuais e julga desempenho do técnico.

export type BoardProfile =
  | "paciente"
  | "exigente"
  | "gastadora"
  | "economica"
  | "base"
  | "titulos"
  | "lucro"
  | "politizada"

export interface BoardObjective {
  id: string
  metric: "league_position" | "title" | "stay_above" | "youth_promoted" | "profit" | "no_signings_above" | "qualify_continental" | "win_clasico"
  target: number | string
  weight: "primary" | "secondary" | "bonus"
  deadlineSeason: number
  status: "pending" | "in_progress" | "completed" | "failed"
}

export interface BoardConfig {
  profile: BoardProfile
  patience: number                 // 0..100 (alta = paciente)
  budgetGrowthRate: number         // 0..1 (rate of saldo growth allowed)
  trustInCoach: number             // 0..100
  pressureToFire: number           // 0..100
}

/** Gera objetivos da temporada baseado no perfil. */
export function generateObjectives(_config: BoardConfig, _season: number): BoardObjective[] {
  throw new Error("board-engine.generateObjectives: not implemented")
}

/** Avalia performance do técnico vs objetivos — atualiza pressureToFire. */
export function evaluatePerformance(_config: BoardConfig, _objectives: BoardObjective[]): BoardConfig {
  throw new Error("board-engine.evaluatePerformance: not implemented")
}

/** Diretoria considera demitir técnico? */
export function shouldFireCoach(_config: BoardConfig): boolean {
  return _config.pressureToFire >= 80
}

// ─── MVP funcional: objetivos, avaliacoes, coletivas, rivalidades ──────────────

import type { CareerMessage } from "@/lib/career-types"
import type { SavedTeam } from "@/lib/save-system"

export interface SeasonObjective {
  /** Posição mínima exigida pela diretoria (1 = título). */
  minPosition: number
  /** Posição alvo confortável (sem cobrança). */
  targetPosition: number
  /** Texto explicando o objetivo. */
  description: string
}

/** Define objetivo com base no prestígio do time. */
export function calcSeasonObjective(team: SavedTeam): SeasonObjective {
  const p = team.prestigio
  if (p >= 88) {
    return {
      minPosition: 4,
      targetPosition: 1,
      description: `Conquistar o titulo do Brasileirao. A diretoria considera o ${team.nome} um dos favoritos absolutos. Ficar fora do G4 sera considerado fracasso.`,
    }
  }
  if (p >= 78) {
    return {
      minPosition: 8,
      targetPosition: 4,
      description: `Garantir vaga na Libertadores (G4). A diretoria espera briga consistente pelo titulo. Cair fora do G8 e inaceitavel.`,
    }
  }
  if (p >= 68) {
    return {
      minPosition: 12,
      targetPosition: 8,
      description: `Brigar pelo G8 (Sul-Americana). Ficar abaixo da metade da tabela sera questionado pela diretoria.`,
    }
  }
  if (p >= 58) {
    return {
      minPosition: 16,
      targetPosition: 12,
      description: `Permanencia tranquila na Serie A. O foco e nao se envolver com a parte de baixo da tabela.`,
    }
  }
  return {
    minPosition: 16,
    targetPosition: 16,
    description: `Evitar o rebaixamento. Cada ponto e disputado, e a permanencia e o objetivo unico desta temporada.`,
  }
}

export function generateBoardObjectiveMessage(
  team: SavedTeam,
  managerName: string,
  season: number,
  objective: SeasonObjective,
): CareerMessage {
  return {
    id: `board_obj_${season}`,
    from: "Presidencia",
    subject: `Metas da temporada ${season}`,
    preview: objective.description.slice(0, 80),
    fullContent: `Caro ${managerName},\n\n${objective.description}\n\n— Posicao alvo: ${objective.targetPosition}o ou melhor\n— Posicao minima aceitavel: ${objective.minPosition}o\n\nA diretoria fara avaliacoes periodicas ao longo da temporada.\n\nBoa temporada.`,
    date: "Pre-temporada",
    read: false,
    starred: true,
    archived: false,
    deleted: false,
    category: "diretoria",
    week: 0,
    season,
  }
}

/** Avaliacao da diretoria nas rodadas 10/20/30. */
export function generateBoardEvaluation(
  team: SavedTeam,
  managerName: string,
  season: number,
  round: number,
  userPosition: number,
  totalTeams: number,
  objective: SeasonObjective,
): CareerMessage | null {
  if (round !== 10 && round !== 20 && round !== 30) return null
  const stage = round === 10 ? "primeiro terco" : round === 20 ? "metade da temporada" : "reta final"

  let mood: string
  let body: string
  let starred = false

  if (userPosition <= objective.targetPosition) {
    mood = "satisfeita"
    body = `A diretoria esta SATISFEITA com o desempenho do ${team.nome} no ${stage}. Atualmente na ${userPosition}a posicao, dentro do alvo. Continue assim.`
    starred = userPosition === 1
  } else if (userPosition <= objective.minPosition) {
    mood = "neutra"
    body = `A diretoria observa o ${team.nome} na ${userPosition}a posicao no ${stage}. Resultado dentro do aceitavel mas abaixo do alvo (${objective.targetPosition}o). Esperamos crescimento.`
  } else if (userPosition <= objective.minPosition + 3) {
    mood = "preocupada"
    body = `A diretoria esta PREOCUPADA. O ${team.nome} esta na ${userPosition}a posicao no ${stage}, abaixo do minimo (${objective.minPosition}o). Cobramos reacao.`
  } else {
    mood = "irritada"
    body = `A diretoria esta INSATISFEITA. Posicao ${userPosition}o/${totalTeams} no ${stage} e inadmissivel. ${managerName}, sua posicao sera reavaliada se nao houver virada.`
  }

  return {
    id: `board_eval_${season}_r${round}`,
    from: "Presidencia",
    subject: `Avaliacao — Rodada ${round} (diretoria ${mood})`,
    preview: body.slice(0, 80),
    fullContent: body + `\n\nPosicao alvo: ${objective.targetPosition}o\nPosicao minima: ${objective.minPosition}o`,
    date: `Rodada ${round}`,
    read: false,
    starred,
    archived: false,
    deleted: false,
    category: "diretoria",
    week: round,
    season,
  }
}

/** Coletiva de imprensa: ~40% chance a cada 5 rodadas. */
export function generatePressConferenceMessage(
  team: SavedTeam,
  managerName: string,
  season: number,
  round: number,
  recentForm: ("W" | "D" | "L")[],
): CareerMessage | null {
  if (round % 5 !== 0 || round === 0) return null
  if (Math.random() > 0.4) return null

  const wins = recentForm.filter(r => r === "W").length
  const losses = recentForm.filter(r => r === "L").length

  let topic: string
  let content: string
  if (wins >= 4) {
    topic = `Sequencia de vitorias chama atencao da imprensa`
    content = `${managerName}, a imprensa quer saber como voce esta mantendo o ${team.nome} em otimo momento (${wins}V em 5 jogos).\n\nUma coletiva foi marcada apos a partida da rodada ${round}. Mantenha o discurso humilde e cite o coletivo.`
  } else if (losses >= 3) {
    topic = `Imprensa cobra explicacoes apos sequencia ruim`
    content = `${managerName}, a imprensa esta de olho na ma fase do ${team.nome} (${losses}D em 5 jogos). A coletiva apos a rodada ${round} sera tensa.\n\nMantenha a calma. Reconheca os erros sem culpar um unico jogador.`
  } else {
    topic = `Coletiva pre-rodada ${round + 1}`
    content = `${managerName}, foi marcada uma coletiva antes da proxima rodada. Topicos provaveis:\n\n— Reforcos da janela\n— Lesoes do elenco\n— Confronto direto da rodada\n\nUma boa entrevista mantem a torcida confiante.`
  }

  return {
    id: `press_${season}_r${round}_${Math.random().toString(36).slice(2, 6)}`,
    from: "Assessoria de Imprensa",
    subject: topic,
    preview: content.slice(0, 80),
    fullContent: content,
    date: `Rodada ${round}`,
    read: false,
    starred: false,
    archived: false,
    deleted: false,
    category: "staff",
    week: round,
    season,
  }
}

/** Mapa de rivalidades classicas. */
const RIVALRIES: Record<string, string[]> = {
  FLA: ["FLU", "VAS", "BOT"],
  FLU: ["FLA", "VAS", "BOT"],
  VAS: ["FLA", "FLU", "BOT"],
  BOT: ["FLA", "FLU", "VAS"],
  COR: ["PAL", "SAO", "SAN"],
  PAL: ["COR", "SAO", "SAN"],
  SAO: ["COR", "PAL", "SAN"],
  SAN: ["COR", "PAL", "SAO"],
  GRE: ["INT"],
  INT: ["GRE"],
  ATM: ["CRU"],
  CRU: ["ATM"],
}

export function isRivalryMatch(curtoA: string, curtoB: string): boolean {
  return (RIVALRIES[curtoA]?.includes(curtoB) ?? false) || (RIVALRIES[curtoB]?.includes(curtoA) ?? false)
}

export function generateRivalryMessage(
  team: SavedTeam,
  rivalNome: string,
  season: number,
  round: number,
): CareerMessage {
  return {
    id: `rivalry_${season}_r${round}_${Date.now().toString(36).slice(-4)}`,
    from: "Torcida Organizada",
    subject: `Classico contra ${rivalNome} na rodada ${round}!`,
    preview: `A torcida do ${team.nome} esta em alvoroco para o classico.`,
    fullContent: `A torcida do ${team.nome} esta em alvoroco para o classico contra o ${rivalNome} na rodada ${round}.\n\nDerby mexe com a moral do elenco e da torcida. Vencer cobre uma temporada inteira; perder pode pesar por meses.\n\nFoco maximo na preparacao tatica.`,
    date: `Rodada ${round}`,
    read: false,
    starred: false,
    archived: false,
    deleted: false,
    category: "competicao",
    week: round,
    season,
  }
}

// ─── Ciclo de pressao: CONFIANCA -> DEMISSAO -> PROPOSTAS ─────────────────────
//
// As metas (calcSeasonObjective) ja existiam, mas nada as cobrava: evaluatePerformance
// era um stub que dava throw e shouldFireCoach lia um pressureToFire que ninguem
// calculava. Ou seja: nao havia risco de ser demitido, e sem risco a campanha ruim
// nao custa nada. E o que separa "simulador de tabela" de "carreira".

export type CareerStatus = "safe" | "warning" | "critical"

export interface ConfidenceInput {
  /** Posicao atual na liga (1 = lider). */
  currentPosition: number
  objective: SeasonObjective
  /** Ultimos resultados do usuario, MAIS RECENTE PRIMEIRO. */
  recentForm: ("V" | "E" | "D")[]
  /** Fracao da temporada ja disputada (0..1). No inicio a diretoria e paciente. */
  seasonProgress: number
}

/** Confianca da diretoria, 0-100. Abaixo de 25 o cargo esta em risco real. */
export function computeBoardConfidence(input: ConfidenceInput): number {
  const { currentPosition, objective, recentForm, seasonProgress } = input

  let confidence = 70

  // Distancia da meta — pesa mais conforme a temporada avanca: na 3a rodada da
  // para recuperar; na 35a, nao.
  const gap = currentPosition - objective.targetPosition
  if (gap > 0) {
    confidence -= gap * 2.6 * (0.35 + seasonProgress)
    // Abaixo do minimo aceitavel a diretoria endurece de vez.
    if (currentPosition > objective.minPosition) {
      confidence -= (currentPosition - objective.minPosition) * 3.5 * (0.4 + seasonProgress)
    }
  } else {
    confidence += Math.min(25, -gap * 2.5)
  }

  // Forma recente: sequencia ruim derruba ate quem esta bem colocado — e a
  // demissao "injusta" que existe no futebol de verdade.
  for (const r of recentForm.slice(0, 5)) {
    if (r === "V") confidence += 4
    else if (r === "E") confidence -= 1
    else confidence -= 5
  }

  const firstNonLoss = recentForm.findIndex(r => r !== "D")
  const losingStreak = firstNonLoss === -1 ? recentForm.length : firstNonLoss
  if (losingStreak >= 3) confidence -= (losingStreak - 2) * 6

  return Math.max(0, Math.min(100, Math.round(confidence)))
}

export function getCareerStatus(confidence: number): CareerStatus {
  if (confidence >= 50) return "safe"
  if (confidence >= 25) return "warning"
  return "critical"
}

/**
 * A diretoria decide demitir. So demite em estado CRITICO — e ainda assim por
 * chance, nao determinismo (dirigente hesita, da "voto de confianca").
 */
export function shouldFireManager(confidence: number, seasonProgress: number): boolean {
  if (confidence >= 25) return false
  const risk = (25 - confidence) / 25          // 0..1
  const timing = 0.4 + seasonProgress * 0.6    // mais paciencia no comeco
  return Math.random() < risk * timing * 0.55
}

export interface JobOffer {
  clubShort: string
  clubName: string
  clubPrestige: number
  /** "club" = outro clube; "national" = selecao. */
  kind: "club" | "national"
  reason: string
}

/**
 * Clubes maiores (e a selecao) so aparecem quando voce entrega resultado.
 * E a recompensa que fecha o ciclo: performar -> ser cortejado -> subir de patamar.
 */
export function generateJobOffers(
  confidence: number,
  currentPosition: number,
  userPrestige: number,
  candidates: { curto: string; nome: string; prestigio: number }[],
  opts: { allowNationalTeam?: boolean } = {}
): JobOffer[] {
  // Sem desempenho, ninguem liga.
  if (confidence < 70 || currentPosition > 6) return []

  const offers: JobOffer[] = []

  const bigger = candidates
    .filter(c => c.prestigio > userPrestige + 4)
    .sort((a, b) => b.prestigio - a.prestigio)

  for (const c of bigger.slice(0, 3)) {
    // Quanto maior o clube, mais dificil ele te procurar.
    const chance = Math.max(0.04, 0.35 - (c.prestigio - userPrestige) * 0.012)
    if (Math.random() < chance) {
      offers.push({
        clubShort: c.curto,
        clubName: c.nome,
        clubPrestige: c.prestigio,
        kind: "club",
        reason: `O ${c.nome} acompanhou sua campanha e quer voce no comando.`,
      })
    }
  }

  // Selecao: so para campanhas de elite.
  if (opts.allowNationalTeam && confidence >= 85 && currentPosition <= 2 && Math.random() < 0.18) {
    offers.push({
      clubShort: "BRA",
      clubName: "Selecao Brasileira",
      clubPrestige: 95,
      kind: "national",
      reason: "A CBF quer conversar sobre o comando da Selecao.",
    })
  }

  return offers
}
