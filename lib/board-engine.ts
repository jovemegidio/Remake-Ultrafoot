// PHASE 18 — Diretoria
// Status: implementado — perfis paciente/exigente/gastadora/econômica/base/títulos/lucro/politizada.
// Define metas anuais e julga desempenho do técnico.
// ⚠️ ESTE CABEÇALHO SE DECLARAVA INCOMPLETO E MENTIA. O módulo está completo
//    e é lido por 6 arquivos do jogo. Um rótulo desatualizado PARA MENOS
//    custa o mesmo que um para mais: leva quem audita a recriar do zero o
//    que já está pronto.

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
export function generateObjectives(config: BoardConfig, season: number): BoardObjective[] {
  const primary: BoardObjective = config.profile === "titulos" || config.profile === "exigente"
    ? {id:"league",metric:"league_position",target:4,weight:"primary",deadlineSeason:season,status:"pending"}
    : config.profile === "lucro" || config.profile === "economica"
      ? {id:"profit",metric:"profit",target:0,weight:"primary",deadlineSeason:season,status:"pending"}
      : config.profile === "base"
        ? {id:"youth",metric:"youth_promoted",target:2,weight:"primary",deadlineSeason:season,status:"pending"}
        : {id:"survival",metric:"stay_above",target:16,weight:"primary",deadlineSeason:season,status:"pending"}
  return [primary,{id:"continental",metric:"qualify_continental",target:1,weight:"secondary",deadlineSeason:season,status:"pending"},{id:"clasico",metric:"win_clasico",target:1,weight:"bonus",deadlineSeason:season,status:"pending"}]
}

/** Avalia performance do técnico vs objetivos — atualiza pressureToFire. */
export function evaluatePerformance(config: BoardConfig, objectives: BoardObjective[]): BoardConfig {
  const weight={primary:20,secondary:10,bonus:5}, next={...config}
  const delta=objectives.reduce((n,o)=>n+(o.status==="completed"?-weight[o.weight]:o.status==="failed"?weight[o.weight]:0),0)
  next.pressureToFire=Math.max(0,Math.min(100,next.pressureToFire+delta-(next.patience-50)*.05))
  next.trustInCoach=Math.max(0,Math.min(100,next.trustInCoach-delta*.6))
  return next
}

/** Diretoria considera demitir técnico? */
export function shouldFireCoach(_config: BoardConfig): boolean {
  return _config.pressureToFire >= 80
}

// ─── MVP funcional: objetivos, avaliacoes, coletivas, rivalidades ──────────────

import type { CareerMessage } from "@/lib/career-types"
import type { SavedTeam } from "@/lib/save-system"
import { getCountryCompetitions } from "@/lib/country-competitions"

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
  const competitions = getCountryCompetitions(team.divisao)
  const division = team.divisao.toLowerCase()
  const lowerDivision = /(serie_b|serie_c|serie_d|segunda|terceira|quarta|championship|2\.|_2)/.test(division)
  if (lowerDivision) {
    if (p >= 72) return {
      minPosition: 6,
      targetPosition: 2,
      description: `Disputar o acesso e terminar entre os primeiros colocados. A diretoria do ${team.nome} espera uma campanha de promoção, sem abandonar a disputa da ${competitions.domesticCup}.`,
    }
    return {
      minPosition: 12,
      targetPosition: 6,
      description: `Construir uma campanha competitiva na divisão atual, mirando a parte de cima da tabela e evolução sustentável do elenco.`,
    }
  }
  if (p >= 88) {
    return {
      minPosition: 4,
      targetPosition: 1,
      description: `Conquistar o título nacional e disputar a ${competitions.continental}. A diretoria considera o ${team.nome} um dos favoritos; ficar fora das primeiras posições será considerado fracasso.`,
    }
  }
  if (p >= 78) {
    return {
      minPosition: 8,
      targetPosition: 4,
      description: `Garantir classificação para a ${competitions.continental}. A diretoria espera presença constante entre os primeiros colocados e uma boa campanha na ${competitions.domesticCup}.`,
    }
  }
  if (p >= 68) {
    return {
      minPosition: 12,
      targetPosition: 8,
      description: `Brigar por vaga continental${competitions.continentalSecondary ? ` na ${competitions.continentalSecondary}` : ""}. Ficar abaixo da metade da tabela será questionado pela diretoria.`,
    }
  }
  if (p >= 58) {
    return {
      minPosition: 16,
      targetPosition: 12,
      description: `Garantir permanência tranquila na primeira divisão e não se envolver com a zona de rebaixamento.`,
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
  /**
   * CONDUTA DO TREINADOR, 0-100 (1.0.377). Opcional: sem ela nada muda.
   *
   * ⚠️ ELA NAO E MAIS UM TERMO DE DESEMPENHO — E UM MULTIPLICADOR DA PACIENCIA,
   * e a diferenca importa. Somada, a conduta viraria pontos de confianca e um
   * tecnico exemplar sobreviveria a um rebaixamento por bom comportamento.
   * Multiplicando a DISTANCIA ATE A META, ela faz o que faz no futebol de
   * verdade: quem tem ficha limpa ganha mais tempo para consertar a campanha,
   * e quem briga com todo mundo tem menos. Nenhuma das duas salva quem perde.
   */
  conduta?: number
}

/** Confianca da diretoria, 0-100. Abaixo de 25 o cargo esta em risco real. */
export function computeBoardConfidence(input: ConfidenceInput): number {
  const { currentPosition, objective, recentForm, seasonProgress } = input

  let confidence = 70

  // Distancia da meta — pesa mais conforme a temporada avanca: na 3a rodada da
  // para recuperar; na 35a, nao.
  // 1,2x de tolerancia com ficha limpa, 0,8x com ficha suja. Ver `conduta`.
  const tolerancia = input.conduta === undefined
    ? 1
    : 0.8 + (Math.max(0, Math.min(100, input.conduta)) / 100) * 0.4

  const gap = currentPosition - objective.targetPosition
  if (gap > 0) {
    confidence -= (gap * 2.6 * (0.35 + seasonProgress)) / tolerancia
    // Abaixo do minimo aceitavel a diretoria endurece de vez.
    if (currentPosition > objective.minPosition) {
      confidence -= ((currentPosition - objective.minPosition) * 3.5 * (0.4 + seasonProgress)) / tolerancia
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
  candidates: { curto: string; nome: string; prestigio: number; divisao?: string }[],
  opts: { allowNationalTeam?: boolean; experienceSeasons?: number; careerTitles?: number; currentWeek?: number; currentDivision?: string } = {}
): JobOffer[] {
  // Avaliamos MENSALMENTE (a cada 4 semanas), desde cedo. Antes so a cada 13
  // semanas E com confianca>=72 E top 6 — na pratica quase nunca saia proposta
  // (relato: "nunca aparecem propostas de clube, nem fracas nem fortes"). Agora:
  //  - indo BEM (confianca alta e boa posicao)  -> clubes ACIMA te cortejam;
  //  - indo MAL (fraco/na parte de baixo)        -> clubes MENORES/laterais ainda
  //    aparecem (na vida real um tecnico em baixa recebe sondagem de times menores
  //    querendo reconstruir). So o comeco absoluto (semana < 5) e mudo.
  const weeks = Math.max(0, opts.currentWeek ?? 0)
  if (weeks < 5 || weeks % 4 !== 0) return []
  const indoBem = confidence >= 62 && currentPosition <= 10

  const offers: JobOffer[] = []

  const experience = Math.max(0, opts.experienceSeasons ?? 0)
  const titles = Math.max(0, opts.careerTitles ?? 0)
  // Reputacao cresce aos poucos. Uma boa campanha na Serie D abre Serie C/B, nao o
  // Barcelona. Gigantes exigem anos, titulos e desempenho sustentado.
  const performanceBonus = confidence >= 90 && currentPosition <= 2 ? 3 : confidence >= 80 ? 1 : 0
  const earlyCareerPenalty = experience === 0 && weeks < 26 ? 2 : 0
  const prestigeCeiling = userPrestige + Math.max(2, 5 + experience * 2 + titles * 3 + performanceBonus - earlyCareerPenalty)

  const divisionTier = (division = "") => {
    const d = division.toLowerCase()
    if (/(serie_d|quarta|fourth|regional)/.test(d)) return 1
    if (/(serie_c|terceira|third|3\.liga|league_one)/.test(d)) return 2
    if (/(serie_b|segunda|second|championship|2\.bundesliga|la_liga_2|ligue_2)/.test(d)) return 3
    return 4
  }
  const currentTier = divisionTier(opts.currentDivision)
  const allowedTierJump = titles >= 2 || experience >= 4 ? 2 : 1
  // Indo bem: clubes ACIMA (ambicao). Indo mal: clubes de porte parecido ou um
  // pouco MENOR, que abriram vaga e apostam num tecnico livre — sempre existe
  // mercado, so muda o tamanho do clube conforme o momento.
  const eligible = (indoBem
    ? candidates.filter(c => c.prestigio > userPrestige + 1 && c.prestigio <= prestigeCeiling)
    : candidates.filter(c => c.prestigio <= userPrestige + 2 && c.prestigio >= userPrestige - 22))
    .filter(c => divisionTier(c.divisao) <= currentTier + allowedTierJump)
    .sort((a, b) => b.prestigio - a.prestigio || a.nome.localeCompare(b.nome))

  const c = eligible[0]
  if (c) offers.push({
    clubShort: c.curto,
    clubName: c.nome,
    clubPrestige: c.prestigio,
    kind: "club",
    reason: indoBem
      ? `O ${c.nome} acompanhou seu trabalho: ${currentPosition}º lugar, confiança da diretoria em ${Math.round(confidence)}% e ${experience} temporada${experience === 1 ? "" : "s"} de experiência.`
      : `O ${c.nome} abriu o cargo e procura um técnico livre para um novo ciclo — uma chance de recomeço.`,
  })

  // Convites de SELECAO NAO saem daqui. Havia uma oferta "Selecao Brasileira"
  // hardcoded cujo aceite chamava assumirClube("BRA") -> initializeGame("BRA"),
  // tratando a selecao como se fosse um CLUBE (bug). O fluxo real e proprio:
  // lib/use-national-team.ts + app/selecao/page.tsx, com contrato, objetivos e
  // competicoes internacionais. Este gerador cuida so de propostas de CLUBE.
  return offers
}
