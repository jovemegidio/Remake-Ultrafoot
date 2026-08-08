// SETORES DO ESTÁDIO: capacidade, preço e obra — por setor.
//
// O que existia: `stadium-economy.ts` trata o estádio como UM número de lugares
// e UM nível de preço global (`TicketTier`: barato/normal/caro). Funciona, mas
// não permite o que o técnico realmente faz — cobrar R$ 10 na geral e R$ 70 no
// camarote, e decidir QUAL setor ampliar.
//
// Este módulo não substitui o stadium-economy: ele detalha. A capacidade total
// continua sendo a soma, então a bilheteria antiga segue funcionando enquanto a
// nova é ligada.

export type SetorId = "geral" | "arquibancada" | "cadeira" | "camarote"

export interface SetorInfo {
  id: SetorId
  nome: string
  /** Fatia da capacidade total num estádio típico. */
  fatia: number
  /** Teto absoluto de lugares deste setor. Camarote não vira arquibancada. */
  teto: number
  /** Preço sugerido de referência, em reais. */
  precoBase: number
  /** Custo de construção por lugar. Camarote é caro; geral é concreto e grade. */
  custoPorLugar: number
  /** Lugares construídos por semana de obra. */
  ritmoObra: number
}

/**
 * Os quatro setores.
 *
 * As fatias e os tetos saem de um estádio real de referência (48 mil lugares:
 * 7.200 na geral, 36.048 de arquibancada, 4.320 de cadeira e 432 de camarote).
 * Os tetos são ABSOLUTOS por setor — é o que impede transformar um estádio
 * inteiro em camarote e imprimir bilheteria.
 */
export const SETORES: SetorInfo[] = [
  { id: "geral", nome: "Geral", fatia: 0.150, teto: 18_000, precoBase: 10, custoPorLugar: 380, ritmoObra: 900 },
  { id: "arquibancada", nome: "Arquibancada", fatia: 0.751, teto: 80_000, precoBase: 15, custoPorLugar: 620, ritmoObra: 700 },
  { id: "cadeira", nome: "Cadeira", fatia: 0.090, teto: 9_000, precoBase: 25, custoPorLugar: 1_400, ritmoObra: 300 },
  { id: "camarote", nome: "Camarote", fatia: 0.009, teto: 700, precoBase: 70, custoPorLugar: 9_000, ritmoObra: 40 },
]

export const SETOR_POR_ID = Object.fromEntries(SETORES.map(s => [s.id, s])) as Record<SetorId, SetorInfo>

export type PorSetor<T> = Record<SetorId, T>

function porSetor<T>(fn: (s: SetorInfo) => T): PorSetor<T> {
  return SETORES.reduce((acc, s) => { acc[s.id] = fn(s); return acc }, {} as PorSetor<T>)
}

/**
 * Reparte uma capacidade total nos quatro setores.
 *
 * Serve para o clube que ainda não tem setores definidos: em vez de pedir que o
 * técnico digite tudo, deriva-se da capacidade que o estádio já tem. O
 * arredondamento sobra para a arquibancada, que é o maior setor — assim a soma
 * bate EXATAMENTE com o total e a bilheteria não perde nem ganha lugar.
 */
export function repartirCapacidade(capacidadeTotal: number): PorSetor<number> {
  const total = Math.max(1_000, Math.round(capacidadeTotal))
  const bruto = porSetor(s => Math.min(s.teto, Math.round(total * s.fatia)))
  const soma = SETORES.reduce((t, s) => t + bruto[s.id], 0)
  bruto.arquibancada = Math.max(0, Math.min(SETOR_POR_ID.arquibancada.teto, bruto.arquibancada + (total - soma)))
  return bruto
}

export function capacidadeTotal(capacidades: PorSetor<number>): number {
  return SETORES.reduce((t, s) => t + (capacidades[s.id] ?? 0), 0)
}

/**
 * Preços sugeridos para o clube.
 *
 * Escalam com o prestígio: um clube grande cobra mais caro pelo mesmo lugar, e
 * a torcida paga. O piso existe para o clube pequeno não cobrar centavos.
 */
export function precosSugeridos(prestigio: number): PorSetor<number> {
  const fator = 0.7 + Math.max(0, Math.min(100, prestigio)) / 100 * 0.9
  return porSetor(s => Math.max(5, Math.round(s.precoBase * fator)))
}

/** Quantos lugares ainda cabem em cada setor. É o "Máximo mais:" da tela. */
export function vagasParaConstruir(capacidades: PorSetor<number>): PorSetor<number> {
  return porSetor(s => Math.max(0, s.teto - (capacidades[s.id] ?? 0)))
}

// ─── Orçamento da obra ────────────────────────────────────────────────────────

export interface PedidoDeObra {
  lugares: PorSetor<number>
}

export interface Orcamento {
  /** Só o que cabe: pedido acima do teto é aparado antes de orçar. */
  lugares: PorSetor<number>
  totalLugares: number
  custo: number
  semanas: number
  /** Vazio quando o pedido é válido; senão explica o que foi aparado. */
  aviso: string
}

/**
 * Orça a obra pedida.
 *
 * Apara o que passa do teto em vez de recusar o pedido inteiro: quem digitou
 * 50 mil na geral quer o máximo possível, não uma mensagem de erro.
 */
export function orcarObra(capacidades: PorSetor<number>, pedido: PedidoDeObra): Orcamento {
  const vagas = vagasParaConstruir(capacidades)
  let aparou = false
  const lugares = porSetor(s => {
    const pedido_ = Math.max(0, Math.round(pedido.lugares[s.id] ?? 0))
    const cabe = Math.min(pedido_, vagas[s.id])
    if (cabe < pedido_) aparou = true
    return cabe
  })

  const totalLugares = SETORES.reduce((t, s) => t + lugares[s.id], 0)
  const custo = SETORES.reduce((t, s) => t + lugares[s.id] * s.custoPorLugar, 0)
  // A obra dos setores corre em PARALELO (são frentes diferentes do estádio),
  // então o prazo é o do setor mais demorado, não a soma de todos.
  const semanas = SETORES.reduce(
    (maior, s) => Math.max(maior, lugares[s.id] > 0 ? Math.ceil(lugares[s.id] / s.ritmoObra) : 0),
    0,
  )

  return {
    lugares,
    totalLugares,
    custo: Math.round(custo),
    // Toda obra tem ao menos uma semana: entregar no mesmo dia não é obra.
    semanas: totalLugares > 0 ? Math.max(1, semanas) : 0,
    aviso: aparou ? "Alguns setores já estão no limite: o pedido foi ajustado ao que ainda cabe." : "",
  }
}

// ─── Obra em andamento ────────────────────────────────────────────────────────

export interface ObraDoEstadio {
  lugares: PorSetor<number>
  custo: number
  /** Semana absoluta (temporada * 52 + semana) em que a obra termina. */
  terminaEm: number
  iniciadaEm: number
}

export function semanaAbsoluta(temporada: number, semana: number): number {
  return temporada * 52 + semana
}

export function iniciarObra(orcamento: Orcamento, temporada: number, semana: number): ObraDoEstadio {
  const inicio = semanaAbsoluta(temporada, semana)
  return {
    lugares: orcamento.lugares,
    custo: orcamento.custo,
    iniciadaEm: inicio,
    terminaEm: inicio + orcamento.semanas,
  }
}

export function obraConcluida(obra: ObraDoEstadio | undefined, temporada: number, semana: number): boolean {
  return !!obra && semanaAbsoluta(temporada, semana) >= obra.terminaEm
}

/** Entrega a obra: soma os lugares construídos, respeitando o teto de novo. */
export function aplicarObra(capacidades: PorSetor<number>, obra: ObraDoEstadio): PorSetor<number> {
  return porSetor(s => Math.min(s.teto, (capacidades[s.id] ?? 0) + (obra.lugares[s.id] ?? 0)))
}

// ─── Migração do preço global ─────────────────────────────────────────────────
//
// Os setores SUBSTITUEM o `TicketTier` global (barato/normal/caro) de
// stadium-economy — decisão do usuário em 29/07/2026. Mas há saves em uso com um
// tier escolhido, e nenhum deles pode abrir com o preço zerado ou com o preço de
// outra pessoa. `precosDoTier` é a ponte: converte o tier antigo nos quatro
// preços, preservando a intenção de quem escolheu "Popular" ou "Premium".
//
// Os multiplicadores são os MESMOS de TICKET_TIERS (0,65 / 1 / 1,55), então
// quem estava no Padrão continua pagando exatamente o preço sugerido.

export type TierAntigo = "barato" | "normal" | "caro"

const MULTIPLICADOR_DO_TIER: Record<TierAntigo, number> = {
  barato: 0.65,
  normal: 1,
  caro: 1.55,
}

export function precosDoTier(prestigio: number, tier: TierAntigo = "normal"): PorSetor<number> {
  const sugeridos = precosSugeridos(prestigio)
  const fator = MULTIPLICADOR_DO_TIER[tier] ?? 1
  return porSetor(s => Math.max(1, Math.round(sugeridos[s.id] * fator)))
}

/**
 * Estado inicial do estádio para um save que ainda não tem setores.
 *
 * Chamar isto uma vez na migração resolve os dois lados: reparte a capacidade
 * que o clube já tinha e converte o tier em preços. Sem isso, o save antigo
 * abriria com estádio de capacidade zero.
 */
export function estadoInicialDoEstadio(input: {
  capacidadeTotal: number
  prestigio: number
  tierAntigo?: TierAntigo
}): { capacidades: PorSetor<number>; precos: PorSetor<number>; usarSugeridos: boolean } {
  return {
    capacidades: repartirCapacidade(input.capacidadeTotal),
    precos: precosDoTier(input.prestigio, input.tierAntigo ?? "normal"),
    // Quem nunca mexeu em preço continua no automático: o padrão não pode
    // obrigar o técnico a abrir a tela do estádio para o jogo funcionar.
    usarSugeridos: !input.tierAntigo || input.tierAntigo === "normal",
  }
}

/**
 * Satisfação da torcida com o preço — o que o `satisfactionDelta` do tier fazia.
 *
 * Preço acima do sugerido desgasta; abaixo agrada. Pesa pelo TAMANHO do setor,
 * porque encarecer o camarote não irrita a massa e encarecer a geral irrita.
 */
export function humorPeloPreco(
  capacidades: PorSetor<number>,
  precos: PorSetor<number>,
  prestigio: number,
): number {
  const sugeridos = precosSugeridos(prestigio)
  const total = capacidadeTotal(capacidades)
  if (total <= 0) return 0
  let soma = 0
  for (const s of SETORES) {
    const excesso = sugeridos[s.id] > 0 ? (precos[s.id] ?? sugeridos[s.id]) / sugeridos[s.id] - 1 : 0
    soma += -excesso * ((capacidades[s.id] ?? 0) / total)
  }
  return Math.max(-6, Math.min(4, Math.round(soma * 8)))
}

// ─── Bilheteria por setor ─────────────────────────────────────────────────────

export interface RendaDoJogo {
  publico: number
  renda: number
  ocupacao: number
  porSetor: PorSetor<{ publico: number; renda: number; ocupacao: number }>
}

/**
 * Bilheteria somando setor a setor.
 *
 * O ponto de ter setores: cada um reage ao preço de um jeito. A geral esvazia
 * se ficar cara — é o torcedor que escolhe pelo bolso. O camarote é comprado por
 * empresa e por sócio de plano alto, então enche quase igual mesmo caro. Cobrar
 * o mesmo em todo lugar deixa dinheiro na mesa OU esvazia o estádio.
 */
export function calcularRenda(input: {
  capacidades: PorSetor<number>
  precos: PorSetor<number>
  prestigio: number
  /** 0-1: o quanto o jogo atrai (clássico, boa fase, título em jogo). */
  atracao: number
}): RendaDoJogo {
  const sugeridos = precosSugeridos(input.prestigio)
  const atracao = Math.max(0.15, Math.min(1, input.atracao))

  const detalhe = porSetor(s => {
    const capacidade = Math.max(0, input.capacidades[s.id] ?? 0)
    const preco = Math.max(0, input.precos[s.id] ?? sugeridos[s.id])
    // Quanto o preço passa do sugerido, e o quanto isso afasta o público. A
    // geral é a mais sensível; o camarote quase não sente.
    const excesso = sugeridos[s.id] > 0 ? preco / sugeridos[s.id] - 1 : 0
    const sensibilidade = s.id === "geral" ? 0.55 : s.id === "arquibancada" ? 0.42 : s.id === "cadeira" ? 0.28 : 0.10

    // ⚠️ GLITCH DE DINHEIRO INFINITO — CONSERTADO (relato de jogador, 07/08/2026:
    // "coloco o ingresso num valor alto, pago a dívida inteira e ainda sobra").
    //
    // A ocupação tinha piso FIXO de 5%: `Math.max(0.05, ...)`. Como a renda é
    // `público × preço`, e o público nunca caía abaixo de 5% do setor POR MAIS
    // CARO QUE FOSSE O INGRESSO, a receita crescia sem limite — bastava digitar
    // um número absurdo e 5% do estádio "pagava". Dinheiro infinito por
    // construção, sem depender de bug de estado nem de save corrompido.
    //
    // O piso agora vale só para preço ATÉ o sugerido: aí ele representa o
    // torcedor fiel, que vai ao estádio mesmo em jogo ruim, e faz sentido. Acima
    // do sugerido a demanda pode chegar a ZERO — ninguém paga dez vezes o preço
    // justo. Isso fecha a torneira: a receita passa a ter um máximo (cobrar mais
    // caro rende mais até certo ponto e depois esvazia o estádio), que é como
    // bilheteria funciona de verdade.
    const ocupacaoCrua = atracao * (1 - excesso * sensibilidade)
    const ocupacao = excesso <= 0
      ? Math.max(0.05, Math.min(1, ocupacaoCrua))
      : Math.max(0, Math.min(1, ocupacaoCrua))

    const publico = Math.round(capacidade * ocupacao)
    return { publico, renda: publico * preco, ocupacao }
  })

  const publico = SETORES.reduce((t, s) => t + detalhe[s.id].publico, 0)
  const renda = SETORES.reduce((t, s) => t + detalhe[s.id].renda, 0)
  const total = capacidadeTotal(input.capacidades)
  return {
    publico,
    renda: Math.round(renda),
    ocupacao: total > 0 ? publico / total : 0,
    porSetor: detalhe,
  }
}
