// QUANTO DA VENDA É REALMENTE SEU.
//
// ⚠️ O QUE ISTO CORRIGE. O contrato do jogo já declarava, há versões, três
// coisas que tiram dinheiro de uma venda:
//
//   resaleClause    // % devida ao clube anterior
//   ownedPercentage // % dos direitos que este clube possui
//   fundPercentage  // % que pertence a um fundo
//
// e NENHUMA delas era aplicada em lugar nenhum. `sellPlayer` fazia
// `balance + recebido` — o valor cheio. Vender um atleta de quem o clube possui
// 60% dos direitos pagava 100%; vender alguém com 20% de revenda pactuada pagava
// 100%.
//
// Não era só falta de realismo: era brecha. O caminho mais rentável do jogo
// passava a ser justamente comprar direitos fatiados barato e vender inteiro.
//
// É o padrão que mais se repete neste projeto: o campo existe, a tela deixa
// preencher, e nada lê. Ver a memória sobre sistemas implementados e desligados.
//
// Módulo PURO: sem store, sem React.

export interface DireitosDoAtleta {
  /** % devida ao clube anterior sobre a venda (0-50). */
  resaleClause?: number
  /** Nome do clube que recebe a revenda. */
  previousClub?: string | null
  /** % dos direitos que ESTE clube possui (0-100). Ausente = 100%. */
  ownedPercentage?: number
  /** % pertencente a um fundo de investimento. */
  fundPercentage?: number
  fundName?: string
}

export interface Repasse {
  para: string
  valor: number
  motivo: "revenda" | "fundo" | "coproprietario"
}

export interface VendaRepartida {
  /** O que entra no caixa do clube. */
  liquido: number
  /** Para onde foi o resto, linha a linha. */
  repasses: Repasse[]
  /** Valor cheio da negociação. */
  bruto: number
}

/**
 * Reparte o valor de uma venda entre o clube e quem mais tem direito.
 *
 * ⚠️ A ORDEM IMPORTA, e é a do futebol:
 *
 *  1. O **fatiamento de direitos** vem primeiro. Se o clube possui 60%, os
 *     outros 40% nunca foram dele — não é desconto, é dinheiro de outra pessoa
 *     passando pela conta.
 *  2. A **cláusula de revenda** incide sobre o valor CHEIO, não sobre a fatia
 *     do clube. É assim que ela é pactuada: "20% da próxima venda", e a próxima
 *     venda é o negócio inteiro. Aplicá-la sobre a fatia faria o clube anterior
 *     ser penalizado por um fatiamento de que ele não participou.
 *
 * O líquido nunca fica negativo: com direitos e revenda somando mais que o
 * valor, a venda simplesmente não rende nada — não vira dívida.
 */
export function repartirVenda(valor: number, direitos?: DireitosDoAtleta): VendaRepartida {
  const bruto = Math.max(0, Math.round(valor))
  if (!direitos || bruto === 0) return { liquido: bruto, repasses: [], bruto }

  const repasses: Repasse[] = []

  // 1) Direitos de terceiros
  const fundo = limitar(direitos.fundPercentage ?? 0, 0, 100)
  if (fundo > 0) {
    const v = Math.round(bruto * (fundo / 100))
    if (v > 0) repasses.push({ para: direitos.fundName || "Fundo de investimento", valor: v, motivo: "fundo" })
  }

  // `ownedPercentage` ausente = o clube possui tudo. Um 0 explícito, por outro
  // lado, é 0 mesmo — daí o `??` em vez de `||`.
  const possui = limitar(direitos.ownedPercentage ?? 100, 0, 100)
  const deTerceiros = Math.max(0, 100 - possui - fundo)
  if (deTerceiros > 0) {
    const v = Math.round(bruto * (deTerceiros / 100))
    if (v > 0) repasses.push({ para: "Coproprietário", valor: v, motivo: "coproprietario" })
  }

  // 2) Revenda ao clube anterior — sobre o valor cheio
  const revenda = limitar(direitos.resaleClause ?? 0, 0, 50)
  if (revenda > 0 && direitos.previousClub) {
    const v = Math.round(bruto * (revenda / 100))
    if (v > 0) repasses.push({ para: direitos.previousClub, valor: v, motivo: "revenda" })
  }

  const total = repasses.reduce((s, r) => s + r.valor, 0)
  return { liquido: Math.max(0, bruto - total), repasses, bruto }
}

function limitar(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** Uma linha por repasse, para o extrato e a notificação. */
export function descreverRepasses(v: VendaRepartida): string[] {
  return v.repasses.map(r => {
    const pct = v.bruto ? Math.round((r.valor / v.bruto) * 100) : 0
    if (r.motivo === "revenda") return `${pct}% de revenda para ${r.para}`
    if (r.motivo === "fundo") return `${pct}% do fundo ${r.para}`
    return `${pct}% de direitos de ${r.para}`
  })
}
