// CLÁUSULAS DO NEGÓCIO — parcelamento, revenda e recompra.
//
// ⚠️ O QUE ISTO CORRIGE.
//
// 1. TODA TRANSFERÊNCIA ERA À VISTA. `buyPlayer` fazia `balance - fee` e
//    `sellPlayer` fazia `balance + líquido`, no ato, sempre. Não existia
//    parcelar — e parcelar é como a maior parte das transferências do futebol
//    acontece. Efeito prático: um clube pequeno nunca alcançava um reforço caro,
//    porque o único caminho era ter o valor cheio no caixa naquela semana.
//
// 2. `resaleClause` ERA SEMPRE ZERO. O campo existe no contrato desde sempre e
//    `lib/repartir-venda.ts` já desconta a revenda devida ao clube anterior —
//    mas NADA no jogo jamais escrevia um valor ali fora do `0` do estado
//    inicial. A regra existia inteira, testada, e nunca disparava. É o padrão
//    mais repetido desta base: o sistema pronto sem porta de entrada.
//
// 3. NÃO HAVIA RECOMPRA. Vender uma cria com direito de recomprá-la por valor
//    fixo é o instrumento que um clube formador de verdade usa, e não existia.
//
// ⚠️ O QUE ESTE MÓDULO NÃO FAZ, E POR QUÊ. Add-on por desempenho do atleta
// vendido ("+2 mi a cada 10 jogos") NÃO está aqui. O gatilho exigiria acompanhar
// jogo a jogo um atleta que saiu do elenco e passou a viver num clube da CPU, e
// o registro que existe (`lib/departed-players.ts`) guarda apenas QUE ele saiu,
// não o que ele fez depois. Escrever a cláusula sem o rastreio criaria mais uma
// promessa que nunca dispara — exatamente o defeito que os itens 2 e 3 acima
// estão consertando. A revenda, essa sim, tem gatilho real: o próprio jogo já
// sabe quando um atleta é vendido de novo.
//
// Módulo PURO: sem store, sem React.

export type TipoDeCompromisso = "receber" | "pagar"

export interface Parcela {
  id: string
  /** Semana ABSOLUTA em que cai (a mesma escala de `absoluteWeek` do motor). */
  semana: number
  valor: number
  tipo: TipoDeCompromisso
  atleta: string
  /** A outra ponta do negócio, para o extrato dizer de quem é o dinheiro. */
  clube: string
}

export interface Recompra {
  id: string
  atleta: string
  /** Clube que comprou — é dele que recompramos. */
  clube: string
  valor: number
  /** Última temporada em que o direito pode ser exercido. */
  ateTemporada: number
}

export interface TermosDoNegocio {
  /** Quantas parcelas ANUAIS além da entrada. 0 = à vista, como era antes. */
  parcelas: number
  /** % de uma futura revenda que fica com o vendedor (0-`MAX_REVENDA`). */
  revendaAoVendedor?: number
  /** Direito de recompra por valor fixo, quando estamos VENDENDO. */
  recompra?: { valor: number; ateTemporada: number } | null
}

export const TERMOS_A_VISTA: TermosDoNegocio = { parcelas: 0 }

/**
 * Quanto o parcelamento encarece o negócio, por parcela anual.
 *
 * ⚠️ TEM DE ENCARECER, senão parcelar é lucro puro e ninguém pagaria à vista
 * nunca mais — a escolha deixaria de existir. Quem parcela paga mais no total e
 * quem recebe parcelado recebe mais no total: é o mesmo juro visto dos dois
 * lados da mesa, e é o que faz o clube com caixa ter uma vantagem de verdade.
 */
export const JUROS_POR_PARCELA = 0.06

/** Além disto nenhum clube aceita esticar. */
export const MAX_PARCELAS = 4

/** Teto da revenda pactuada, na mesma escala que `repartirVenda` já limita. */
export const MAX_REVENDA = 30

/** Valor NOMINAL total do negócio, já com o custo do parcelamento. */
export function totalComParcelamento(valor: number, parcelas: number): number {
  const n = Math.max(0, Math.min(MAX_PARCELAS, Math.round(parcelas)))
  return Math.round(valor * (1 + JUROS_POR_PARCELA * n))
}

/**
 * Quanto o vendedor abate do preço em troca de ficar com uma fatia da revenda.
 *
 * Metade do percentual, e não ele inteiro: a revenda é dinheiro FUTURO e
 * INCERTO — o atleta pode não ser vendido de novo, ou ser vendido por menos.
 * Descontar o percentual cheio faria a cláusula ser sempre o melhor negócio
 * para quem compra, e ela deixaria de ser uma troca.
 */
export function descontoPorRevenda(valor: number, percentual: number): number {
  const pct = Math.max(0, Math.min(MAX_REVENDA, percentual))
  return Math.round(valor * (pct / 100) * 0.5)
}

/**
 * Quanto o vendedor abate do preço em troca de dar o direito de recompra.
 *
 * A recompra é uma opção que fica com o VENDEDOR: quem compra assume o risco de
 * formar um atleta e ver o preço travado. O desconto é proporcional a quão baixo
 * é o preço de recompra em relação ao que está sendo pago agora.
 */
export function descontoPorRecompra(valor: number, valorDaRecompra: number): number {
  if (valorDaRecompra <= 0 || valor <= 0) return 0
  const razao = Math.max(0, Math.min(3, valorDaRecompra / valor))
  // Recompra pelo mesmo preço abate ~15%; a partir de 2,5x o preço pago o
  // direito praticamente não incomoda quem compra e o desconto ZERA. O portão
  // cobra esse zero: um desconto residual eterno faria valer sempre pedir
  // recompra, mesmo por um valor que nunca seria exercido.
  return Math.round(valor * Math.max(0, 0.15 - (razao - 1) * 0.1))
}

export interface ContextoDoNegocio {
  atleta: string
  clube: string
  /** Semana ABSOLUTA de hoje (`absoluteWeek(temporada, semana)`). */
  semanaAtual: number
  tipo: TipoDeCompromisso
}

export interface NegocioResolvido {
  /** O que entra ou sai do caixa AGORA. */
  aVista: number
  /** O que fica agendado para as próximas temporadas. */
  parcelas: Parcela[]
  /** Nominal somado: `aVista` + todas as parcelas. */
  total: number
  /** Uma linha por cláusula, para o extrato e para a tela. */
  descricao: string[]
}

/**
 * Resolve o negócio em dinheiro e calendário.
 *
 * ⚠️ A PRIMEIRA PARCELA CAI DAQUI A UM ANO, não na semana seguinte. Parcelamento
 * de transferência é anual no futebol, e semanal transformaria a cláusula num
 * empréstimo de curto prazo — outra coisa.
 */
export function resolverNegocio(
  valor: number,
  termos: TermosDoNegocio,
  ctx: ContextoDoNegocio,
): NegocioResolvido {
  const bruto = Math.max(0, Math.round(valor))
  const n = Math.max(0, Math.min(MAX_PARCELAS, Math.round(termos.parcelas)))
  const descricao: string[] = []

  if (n === 0) {
    return { aVista: bruto, parcelas: [], total: bruto, descricao: ["À vista"] }
  }

  const total = totalComParcelamento(bruto, n)
  // Entrada + n parcelas anuais iguais. A entrada absorve o arredondamento para
  // que a soma feche EXATAMENTE com o total — centavo perdido em transferência
  // vira dinheiro criado ou destruído do nada ao longo de uma carreira longa.
  const porParcela = Math.round(total / (n + 1))
  const parcelas: Parcela[] = Array.from({ length: n }, (_, i) => ({
    id: `${ctx.tipo}-${ctx.semanaAtual}-${i}-${ctx.atleta}`,
    semana: ctx.semanaAtual + 52 * (i + 1),
    valor: porParcela,
    tipo: ctx.tipo,
    atleta: ctx.atleta,
    clube: ctx.clube,
  }))
  const aVista = total - porParcela * n

  descricao.push(
    `${n + 1}x: entrada de ${milhoes(aVista)} e ${n} parcela${n === 1 ? "" : "s"} anual${n === 1 ? "" : "is"} de ${milhoes(porParcela)}`,
    `Total ${milhoes(total)} — ${milhoes(total - bruto)} a mais que à vista`,
  )
  return { aVista, parcelas, total, descricao }
}

/** As parcelas que vencem nesta semana (ou antes, se algo atrasou). */
export function parcelasVencidas(parcelas: readonly Parcela[], semanaAtual: number): Parcela[] {
  return parcelas.filter(p => p.semana <= semanaAtual)
}

/** O que sobra depois de liquidar as vencidas. */
export function parcelasRestantes(parcelas: readonly Parcela[], semanaAtual: number): Parcela[] {
  return parcelas.filter(p => p.semana > semanaAtual)
}

/**
 * Saldo da semana: o que entra menos o que sai.
 *
 * ⚠️ Devolvido como número único de propósito — quem chama soma ao `balance` uma
 * vez só. Aplicar entrada e saída em dois `set` diferentes abriria a janela em
 * que o caixa fica negativo por um instante e alguma regra de inadimplência
 * dispararia sem motivo.
 */
export function saldoDasParcelas(vencidas: readonly Parcela[]): number {
  return vencidas.reduce((s, p) => s + (p.tipo === "receber" ? p.valor : -p.valor), 0)
}

/** A recompra ainda pode ser exercida nesta temporada? */
export function recompraValida(recompra: Recompra, temporadaAtual: number): boolean {
  return temporadaAtual <= recompra.ateTemporada
}

function milhoes(valor: number): string {
  if (Math.abs(valor) >= 1_000_000) return `${(valor / 1_000_000).toFixed(1)} mi`
  return `${Math.round(valor / 1000)} mil`
}
