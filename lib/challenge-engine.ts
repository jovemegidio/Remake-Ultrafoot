// MODO DESAFIOS — cenários com regra, prazo e recompensa.
//
// ⚠️ O QUE ESTE ARQUIVO ERA ATÉ A 1.0.302.
//
// Um esqueleto que se declarava esqueleto ("Status: skeleton — define a API").
// Ele tinha os oito desafios, mas:
//
//  1. `startChallenge` não injetava REGRA nenhuma — mexia em saldo e moral e
//     pronto. "Copa sem reforços" não impedia contratar; "sub-23" não impedia
//     contratar um veterano de 34 anos.
//  2. `evaluateChallenge` e `claimReward` NUNCA eram chamados por ninguém. O
//     progresso não avançava, o desafio não falhava no prazo e a recompensa não
//     saía do lugar.
//  3. Nenhuma tela linkava `/desafios`: a página existia e era inalcançável.
//
// A IDEIA CENTRAL, que continua valendo: um desafio NÃO é um modo de jogo
// separado. É a mesma carreira com PARÂMETROS injetados — restrição de mercado,
// caixa inicial, prazo e objetivo. Por isso aqui só existem dados e duas
// funções puras; quem executa continua sendo o motor da carreira.
//
// ONDE ISTO É LIDO (as três pontas que tiram do papel):
//  • `lib/game-engine.ts` — `buyPlayer`/`loanPlayer` consultam `podeReforcar()`
//    e recusam o negócio proibido pelo desafio;
//  • `lib/save-system.ts` — `sincronizarDesafioAtivo()` a cada carga/gravação,
//    para o motor saber a regra sem depender de nenhuma tela estar montada;
//  • `lib/use-game-manager.ts` — avalia na virada de temporada e paga o prêmio.

import type { GameState } from "@/lib/save-system"
import type { SeasonRecord, TransferRecord } from "@/lib/career-types"

export type ChallengeId =
  | "save_relegation"
  | "promote_division"
  | "small_state"
  | "u23_only"
  | "cup_no_signings"
  | "qualify_continental"
  | "rebuild_giant"
  | "cut_payroll"

export type ChallengeDifficulty = "facil" | "medio" | "dificil" | "lendario"

/**
 * REGRAS INJETADAS. Tudo opcional: o que não é declarado segue como na carreira
 * normal. Campo ausente ≠ campo zerado — por isso nenhum default numérico aqui.
 */
export interface ChallengeRules {
  /** Teto de reforços por temporada. `0` proíbe contratar. */
  reforcosPorTemporada?: number
  /** Idade máxima de quem pode ser contratado. */
  idadeMaximaDeReforco?: number
  /** Só atleta sem clube (sem pagar transferência). */
  somenteSemClube?: boolean
  /** Empréstimo de ENTRADA proibido (senão vira a brecha óbvia do "não contratar"). */
  proibirEmprestimo?: boolean
  /** Caixa no começo do desafio (pode ser negativo: clube falido). */
  caixaInicial?: number
  /** Teto de caixa no começo — usado quando o desafio é de aperto financeiro. */
  caixaMaximoInicial?: number
  /** Moral do elenco no começo (o clube em crise não começa feliz). */
  moralInicial?: number
}

export type ChallengeMetric =
  | "league_position"
  | "title"
  | "promotion"
  | "stay_above"
  | "qualify_continental"
  | "finish_positive"
  | "no_signings"
  | "u23_squad"

export interface ChallengeGoal {
  id: string
  description: string
  metric: ChallengeMetric
  target: number | string
  /** Valor atingido na última avaliação — só para a tela mostrar progresso. */
  currentValue?: number | string
  completed: boolean
}

export interface ChallengeConfig {
  id: ChallengeId
  nome: string
  descricao: string
  difficulty: ChallengeDifficulty
  /** Quantas temporadas o técnico tem para cumprir. Estourou, falhou. */
  durationSeasons: number
  /** Em que clube o desafio faz sentido — texto, porque quem escolhe é o jogador. */
  clubeIdeal: string
  rules: ChallengeRules
  goals: ChallengeGoal[]
  reward: { prestigio: number; saldo: number; xp: number; titulo: string }
}

export interface ChallengeProgress {
  challengeId: ChallengeId
  startedAt: number
  startSeason: number
  currentSeason: number
  goals: ChallengeGoal[]
  failed: boolean
  completed: boolean
  /** Já pagou o prêmio? Impede pagar de novo a cada virada de temporada. */
  rewardClaimed?: boolean
  /** Clube onde o desafio começou — trocar de clube abandona o desafio. */
  startTeamShort?: string
}

// ─── CATÁLOGO ────────────────────────────────────────────────────────────────
//
// Escrito por extenso de propósito. A versão anterior era um `.map` sobre uma
// matriz de tuplas em UMA linha: economizava trinta linhas de arquivo e custava
// a possibilidade de cada desafio ter regra própria — que é a razão de o modo
// existir.

export const CHALLENGES: ChallengeConfig[] = [
  {
    id: "save_relegation",
    nome: "Operação permanência",
    descricao: "Assuma um clube em apuros e escape do rebaixamento.",
    difficulty: "dificil",
    durationSeasons: 1,
    clubeIdeal: "Um clube da parte de baixo da tabela",
    rules: { moralInicial: 45, caixaMaximoInicial: 12_000_000 },
    goals: [{
      id: "save_relegation-goal",
      description: "Terminar a liga fora da zona de rebaixamento",
      metric: "stay_above",
      target: 16,
      completed: false,
    }],
    reward: { prestigio: 3, saldo: 4_000_000, xp: 400, titulo: "Bombeiro" },
  },
  {
    id: "promote_division",
    nome: "Rumo à elite",
    descricao: "Conquiste o acesso à divisão de cima.",
    difficulty: "medio",
    durationSeasons: 2,
    clubeIdeal: "Um clube de Série B, C ou D",
    rules: {},
    goals: [{
      id: "promote_division-goal",
      description: "Conquistar o acesso",
      metric: "promotion",
      target: 1,
      completed: false,
    }],
    reward: { prestigio: 4, saldo: 6_000_000, xp: 600, titulo: "Rei do Acesso" },
  },
  {
    id: "small_state",
    nome: "Zebra estadual",
    descricao: "Seja campeão com um clube pequeno, sem comprar o título.",
    difficulty: "lendario",
    durationSeasons: 2,
    clubeIdeal: "Um clube pequeno do seu estado",
    rules: { reforcosPorTemporada: 2, somenteSemClube: true, proibirEmprestimo: true },
    goals: [{
      id: "small_state-goal",
      description: "Ser campeão de uma competição",
      metric: "title",
      target: 1,
      completed: false,
    }],
    reward: { prestigio: 8, saldo: 10_000_000, xp: 1200, titulo: "Matador de Gigantes" },
  },
  {
    id: "u23_only",
    nome: "Geração futura",
    descricao: "Monte um elenco jovem: nenhum reforço acima de 23 anos.",
    difficulty: "dificil",
    durationSeasons: 2,
    clubeIdeal: "Qualquer clube com boa base",
    rules: { idadeMaximaDeReforco: 23, proibirEmprestimo: true },
    goals: [
      {
        id: "u23_only-goal",
        description: "Ter ao menos 12 atletas de até 23 anos no elenco",
        metric: "u23_squad",
        target: 12,
        completed: false,
      },
      {
        id: "u23_only-liga",
        description: "Terminar a liga entre os 8 primeiros",
        metric: "league_position",
        target: 8,
        completed: false,
      },
    ],
    reward: { prestigio: 5, saldo: 8_000_000, xp: 900, titulo: "Formador" },
  },
  {
    id: "cup_no_signings",
    nome: "Copa sem reforços",
    descricao: "Vença uma competição sem contratar ninguém. O elenco é o que você tem.",
    difficulty: "lendario",
    durationSeasons: 1,
    clubeIdeal: "Qualquer clube",
    rules: { reforcosPorTemporada: 0, proibirEmprestimo: true },
    goals: [
      {
        id: "cup_no_signings-goal",
        description: "Ser campeão de uma competição",
        metric: "title",
        target: 1,
        completed: false,
      },
      {
        id: "cup_no_signings-mercado",
        description: "Não contratar nenhum atleta",
        metric: "no_signings",
        target: 0,
        completed: false,
      },
    ],
    reward: { prestigio: 7, saldo: 9_000_000, xp: 1100, titulo: "Dono do Vestiário" },
  },
  {
    id: "qualify_continental",
    nome: "Passaporte continental",
    descricao: "Classifique o clube para a competição continental.",
    difficulty: "medio",
    durationSeasons: 2,
    clubeIdeal: "Um clube de meio de tabela",
    rules: {},
    goals: [{
      id: "qualify_continental-goal",
      description: "Terminar a liga entre os 6 primeiros",
      metric: "qualify_continental",
      target: 6,
      completed: false,
    }],
    reward: { prestigio: 4, saldo: 7_000_000, xp: 700, titulo: "Continental" },
  },
  {
    id: "rebuild_giant",
    nome: "Gigante de volta",
    descricao: "Um clube grande em crise: reconstrua sem estourar o caixa.",
    difficulty: "dificil",
    durationSeasons: 3,
    clubeIdeal: "Um clube tradicional em má fase",
    rules: { reforcosPorTemporada: 3, caixaMaximoInicial: 20_000_000, moralInicial: 50 },
    goals: [{
      id: "rebuild_giant-goal",
      description: "Terminar a liga entre os 4 primeiros",
      metric: "league_position",
      target: 4,
      completed: false,
    }],
    reward: { prestigio: 6, saldo: 12_000_000, xp: 1000, titulo: "Reconstrutor" },
  },
  {
    id: "cut_payroll",
    nome: "Contas em dia",
    descricao: "Caixa curto e mercado travado: termine a temporada no azul.",
    difficulty: "medio",
    durationSeasons: 1,
    clubeIdeal: "Qualquer clube",
    rules: { caixaMaximoInicial: 5_000_000, reforcosPorTemporada: 1, somenteSemClube: true },
    goals: [{
      id: "cut_payroll-goal",
      description: "Terminar a temporada com o caixa positivo",
      metric: "finish_positive",
      target: 0,
      completed: false,
    }],
    reward: { prestigio: 3, saldo: 5_000_000, xp: 500, titulo: "Administrador" },
  },
]

export function acharDesafio(id: ChallengeId): ChallengeConfig | undefined {
  return CHALLENGES.find(challenge => challenge.id === id)
}

/** As regras do desafio em frases — a tela mostra isto antes de o jogador aceitar. */
export function descreverRegras(config: ChallengeConfig): string[] {
  const r = config.rules
  const linhas: string[] = []
  if (r.reforcosPorTemporada === 0) linhas.push("Proibido contratar")
  else if (r.reforcosPorTemporada !== undefined) linhas.push(`No máximo ${r.reforcosPorTemporada} reforço(s) por temporada`)
  if (r.idadeMaximaDeReforco !== undefined) linhas.push(`Só contrata atleta de até ${r.idadeMaximaDeReforco} anos`)
  if (r.somenteSemClube) linhas.push("Só contrata atleta sem clube")
  if (r.proibirEmprestimo) linhas.push("Empréstimo de entrada proibido")
  if (r.caixaInicial !== undefined) linhas.push(`Começa com caixa de ${Math.round(r.caixaInicial / 1_000_000)} mi`)
  if (r.caixaMaximoInicial !== undefined) linhas.push(`Caixa inicial limitado a ${Math.round(r.caixaMaximoInicial / 1_000_000)} mi`)
  if (r.moralInicial !== undefined) linhas.push(`Elenco começa desconfiado (moral ${r.moralInicial})`)
  linhas.push(`Prazo de ${config.durationSeasons} temporada(s)`)
  return linhas
}

// ─── DESAFIO ATIVO (o que o motor consulta) ──────────────────────────────────
//
// O motor de jogo (`game-engine`) é um store separado do save e não pode
// importar `save-system` sem criar ciclo. Em vez de fazer cada tela passar a
// regra na chamada — o caminho que deixaria uma tela esquecida como brecha —
// o save publica aqui um retrato do desafio ativo, e o motor lê deste retrato.
//
// É cache de LEITURA: a verdade continua sendo `state.activeChallenge`. Ficar
// dessincronizado só afrouxa a regra por um instante, nunca corrompe o save.

interface RetratoDoDesafio {
  config: ChallengeConfig
  season: number
  /** Reforços já feitos NA TEMPORADA corrente (buy + loan + loan_buy). */
  reforcosNaTemporada: number
}

let _retrato: RetratoDoDesafio | null = null

/** Tipos de movimentação que contam como REFORÇO para a regra do desafio. */
const TIPOS_DE_REFORCO = new Set<TransferRecord["type"]>(["buy", "loan", "loan_buy"])

export function contarReforcos(transfers: readonly TransferRecord[] | undefined, season: number): number {
  return (transfers ?? []).filter(t => t.season === season && TIPOS_DE_REFORCO.has(t.type)).length
}

/**
 * Publica (ou apaga) o retrato do desafio ativo. Chamado pelo save-system a cada
 * carga e a cada gravação — nunca por uma tela, justamente para não depender de
 * qual tela está aberta.
 */
export function sincronizarDesafioAtivo(state: Pick<GameState, "activeChallenge" | "season" | "transfers">): void {
  const progresso = state.activeChallenge
  if (!progresso || progresso.completed || progresso.failed) {
    _retrato = null
    return
  }
  const config = acharDesafio(progresso.challengeId)
  if (!config) {
    _retrato = null
    return
  }
  _retrato = {
    config,
    season: state.season,
    reforcosNaTemporada: contarReforcos(state.transfers, state.season),
  }
}

export function desafioAtivo(): ChallengeConfig | null {
  return _retrato?.config ?? null
}

export interface PedidoDeReforco {
  /** Idade do atleta (quando conhecida). */
  idade?: number
  /** Atleta sem clube — não custa transferência. */
  semClube?: boolean
  /** É empréstimo de entrada, não compra. */
  emprestimo?: boolean
}

export interface VeredictoDeReforco {
  pode: boolean
  /** Frase pronta para a tela. Sempre presente quando `pode` é falso. */
  motivo?: string
}

/**
 * A FISCALIZAÇÃO. Sem desafio ativo devolve sempre `pode: true` — o modo normal
 * não paga nada por este código existir.
 */
export function podeReforcar(pedido: PedidoDeReforco = {}): VeredictoDeReforco {
  if (!_retrato) return { pode: true }
  const { config, reforcosNaTemporada } = _retrato
  const r = config.rules
  const nome = config.nome

  if (pedido.emprestimo && r.proibirEmprestimo) {
    return { pode: false, motivo: `O desafio "${nome}" não permite empréstimo de entrada.` }
  }
  if (r.reforcosPorTemporada !== undefined && reforcosNaTemporada >= r.reforcosPorTemporada) {
    return {
      pode: false,
      motivo: r.reforcosPorTemporada === 0
        ? `O desafio "${nome}" proíbe contratar. Você joga com o elenco que tem.`
        : `O desafio "${nome}" permite ${r.reforcosPorTemporada} reforço(s) por temporada e você já usou todos.`,
    }
  }
  if (r.somenteSemClube && !pedido.semClube) {
    return { pode: false, motivo: `O desafio "${nome}" só permite contratar atleta sem clube.` }
  }
  if (r.idadeMaximaDeReforco !== undefined && pedido.idade !== undefined && pedido.idade > r.idadeMaximaDeReforco) {
    return {
      pode: false,
      motivo: `O desafio "${nome}" só permite contratar atleta de até ${r.idadeMaximaDeReforco} anos.`,
    }
  }
  return { pode: true }
}

// ─── CICLO DE VIDA ───────────────────────────────────────────────────────────

/**
 * Até que semana da temporada aceitar um desafio ainda vale para o ano corrente.
 *
 * Aceitar "termine entre os 4 primeiros" na semana 30, com dois terços da liga
 * já jogados, seria cobrar uma campanha que o técnico não dirigiu. Passado o
 * prazo, o desafio começa a contar na temporada seguinte — e a tela diz isso
 * antes de o jogador aceitar.
 */
export const SEMANA_LIMITE_PARA_COMECAR = 8

export function temporadaDeInicio(season: number, week: number): number {
  return week <= SEMANA_LIMITE_PARA_COMECAR ? season : season + 1
}

/**
 * Inicia o desafio.
 *
 * ⚠️ O CAIXA NÃO MORA NO SAVE — mora no motor (`game-engine.balance`). A versão
 * anterior escrevia `state.balance` e considerava o serviço feito; o clube
 * continuava com o dinheiro de sempre, porque nenhuma tela lê aquele campo para
 * dizer quanto há em caixa. Por isso `caixaAtual` entra e `caixaAlvo` sai: quem
 * chama aplica no motor. Duas fontes de verdade para dinheiro é exatamente o
 * tipo de divergência que esta base já pagou caro.
 */
export function startChallenge(
  id: ChallengeId,
  state: GameState,
  caixaAtual: number,
): { estado: GameState; caixaAlvo?: number } {
  const config = acharDesafio(id)
  if (!config) throw new Error(`Desafio inválido: ${id}`)

  const inicio = temporadaDeInicio(state.season, state.week)
  const progress: ChallengeProgress = {
    challengeId: id,
    startedAt: Date.now(),
    startSeason: inicio,
    currentSeason: state.season,
    goals: config.goals.map(goal => ({ ...goal })),
    failed: false,
    completed: false,
    rewardClaimed: false,
    startTeamShort: state.selectedTeamShort ?? undefined,
  }

  const r = config.rules
  const estado: GameState = {
    ...state,
    activeChallenge: progress,
    ...(r.moralInicial !== undefined ? { teamMorale: r.moralInicial } : {}),
    updatedAt: Date.now(),
  }

  let caixaAlvo: number | undefined
  if (r.caixaInicial !== undefined) caixaAlvo = r.caixaInicial
  if (r.caixaMaximoInicial !== undefined) caixaAlvo = Math.min(caixaAlvo ?? caixaAtual, r.caixaMaximoInicial)

  // O retrato precisa valer JÁ: quem aceita o desafio costuma ir direto ao
  // mercado, e a gravação do save é assíncrona.
  sincronizarDesafioAtivo(estado)
  return { estado, caixaAlvo }
}

/** Desiste do desafio. Não devolve nada do que a regra custou — foi a carreira que rolou. */
export function abandonarDesafio(state: GameState): GameState {
  const next: GameState = { ...state, activeChallenge: undefined, updatedAt: Date.now() }
  sincronizarDesafioAtivo(next)
  return next
}

export interface ContextoDeAvaliacao {
  /** Temporada que ACABOU de encerrar. */
  season: number
  /** Registros do seasonHistory desta temporada (liga e copas). */
  registrosDaTemporada: readonly SeasonRecord[]
  transfers: readonly TransferRecord[]
  /** Idades do elenco profissional — vem do motor, não do espelho do save. */
  idadesDoElenco: readonly number[]
  saldo: number
}

/**
 * Avalia o desafio no fim de uma temporada.
 *
 * Chamado por `use-game-manager` na virada, DEPOIS de o registro da temporada
 * existir: metade das metas lê exatamente esse registro (posição final, acesso,
 * título) e avaliar antes devolveria "não cumpriu" para quem acabou de cumprir.
 */
export function evaluateChallenge(progress: ChallengeProgress, ctx: ContextoDeAvaliacao): ChallengeProgress {
  const config = acharDesafio(progress.challengeId)
  if (!config) return progress
  // DESAFIO ACEITO NO MEIO DO ANO começa a valer na temporada seguinte (ver
  // `temporadaDeInicio`). Avaliar a temporada que já estava rodando cobraria uma
  // meta de um ano que o técnico não teve como disputar inteiro.
  if (ctx.season < progress.startSeason) return progress

  // O registro da LIGA é o que tem mais jogos — a copa tem ~5. Mesmo critério
  // que o resto da base usa para separar liga de copa no seasonHistory.
  const daLiga = [...ctx.registrosDaTemporada]
    .sort((a, b) => (b.won + b.drawn + b.lost) - (a.won + a.drawn + a.lost))[0] ?? null
  const foiCampeao = ctx.registrosDaTemporada.some(r => r.position === 1)
  const reforcos = contarReforcos(ctx.transfers, ctx.season)
  const sub23 = ctx.idadesDoElenco.filter(idade => idade <= 23).length

  const goals = progress.goals.map(goal => {
    let completed = goal.completed          // meta cumprida não descumpre depois
    let currentValue: number | string | undefined = goal.currentValue

    switch (goal.metric) {
      case "promotion":
        currentValue = daLiga?.promoted ? "acesso" : "sem acesso"
        completed = completed || Boolean(daLiga?.promoted)
        break
      case "league_position":
        currentValue = daLiga?.position ?? "-"
        completed = completed || Boolean(daLiga && daLiga.position <= Number(goal.target))
        break
      case "stay_above":
        currentValue = daLiga?.position ?? "-"
        completed = completed || Boolean(daLiga && !daLiga.relegated && daLiga.position <= Number(goal.target))
        break
      case "qualify_continental":
        currentValue = daLiga?.position ?? "-"
        completed = completed || Boolean(daLiga && daLiga.position <= Number(goal.target))
        break
      case "title":
        currentValue = foiCampeao ? "campeão" : "sem título"
        completed = completed || foiCampeao
        break
      case "no_signings":
        // Esta NÃO é cumulativa: contratar depois de já ter cumprido quebra a
        // premissa do desafio, então ela pode voltar atrás.
        currentValue = reforcos
        completed = reforcos <= Number(goal.target)
        break
      case "u23_squad":
        currentValue = sub23
        completed = completed || sub23 >= Number(goal.target)
        break
      case "finish_positive":
        currentValue = ctx.saldo
        completed = ctx.saldo >= Number(goal.target)
        break
    }
    return { ...goal, currentValue, completed }
  })

  const completed = goals.every(goal => goal.completed)
  // O prazo conta a temporada de início: começar em 2026 com duração 1 significa
  // cumprir ATÉ o fim de 2026.
  const ultimaTemporada = progress.startSeason + config.durationSeasons - 1
  return {
    ...progress,
    currentSeason: ctx.season,
    goals,
    completed,
    failed: !completed && ctx.season >= ultimaTemporada,
  }
}

/**
 * Recompensa do desafio concluído.
 *
 * Devolve um PATCH (não o estado inteiro) e o prêmio em dinheiro à parte, pelo
 * mesmo motivo do `caixaAlvo` acima: o caixa é do motor. `null` quando não há o
 * que pagar — não concluído, falhado, ou já pago (a virada de temporada roda
 * todo ano e não pode pagar de novo).
 */
export function claimReward(
  progress: ChallengeProgress,
  state: Pick<GameState, "coachXP" | "selectedTeam" | "desafiosConcluidos">,
): { patch: Partial<GameState>; premioEmCaixa: number; titulo: string } | null {
  if (!progress.completed || progress.failed || progress.rewardClaimed) return null
  const config = acharDesafio(progress.challengeId)
  if (!config) return null

  const conquistas = state.desafiosConcluidos ?? []
  return {
    premioEmCaixa: config.reward.saldo,
    titulo: config.reward.titulo,
    patch: {
      coachXP: (state.coachXP ?? 0) + config.reward.xp,
      selectedTeam: state.selectedTeam
        ? { ...state.selectedTeam, prestigio: Math.min(100, state.selectedTeam.prestigio + config.reward.prestigio) }
        : state.selectedTeam,
      activeChallenge: { ...progress, rewardClaimed: true },
      desafiosConcluidos: conquistas.some(c => c.challengeId === progress.challengeId)
        ? conquistas
        : [...conquistas, {
            challengeId: progress.challengeId,
            season: progress.currentSeason,
            titulo: config.reward.titulo,
            em: Date.now(),
          }],
    },
  }
}
