// CONFIANÇA DA DIRETORIA, POR ÁREA.
//
// O que existia
// ─────────────
// Um número de 0 a 100: desempenho esportivo (posição contra objetivo, forma,
// fase da temporada) mais um bônus de governança que as crises financeiras
// empurram para baixo. Os dois colapsados num só.
//
// Por que isso é pouco
// ────────────────────
// Um técnico que ganha tudo em campo e quebra o clube tem exatamente a mesma
// leitura de um que equilibra as contas e não vence: **72**. O número diz que a
// diretoria está mais ou menos satisfeita e não diz COM O QUÊ — então ele não
// orienta decisão nenhuma. É a diferença entre um termômetro e um diagnóstico, e
// é por isso que o FM separa em áreas: o técnico precisa saber se o problema
// dele é resultado, dinheiro, mercado ou base, porque cada um se resolve de um
// jeito diferente.
//
// ⚠️ ESTE MÓDULO NÃO INVENTA DADO NENHUM. Cada área é derivada do que o save já
// tem — posição contra objetivo, caixa e dívida, gasto contra orçamento,
// promoções da base, moral do elenco. Nenhum campo novo, nenhum sistema
// paralelo: se a área precisasse de um dado que não existe, ela não entraria.
//
// O número geral continua existindo e continua sendo o que manda nas
// consequências (demissão, cobrança). A divisão é EXPLICAÇÃO, não substituição —
// trocar a regra de demissão junto seria mudar duas coisas de uma vez.
//
// Este arquivo é PURO: sem React, sem store, sem save.

import { pesoDasAreas } from "@/lib/tom-da-modalidade"
import type { ModalidadeDeCarreira } from "@/lib/modalidade-de-carreira"

export type AreaDaDiretoria = "resultados" | "financas" | "mercado" | "base" | "vestiario"

export interface LeituraDaArea {
  /** Quanto esta area pesa NESTA modalidade. Ver `pesoDasAreas`. */
  peso?: number
  area: AreaDaDiretoria
  /** 0 a 100, na mesma escala do número geral. */
  nota: number
  /** O que a diretoria diria, em uma linha. */
  leitura: string
}

export interface ContextoDaConfianca {
  /** Confiança esportiva já calculada (posição, forma, objetivo). */
  confiancaEsportiva: number
  /** Penalidade acumulada de governança (negativa). */
  bonusDeGovernanca: number
  saldo: number
  dividaTotal: number
  /** Quanto do orçamento de transferências foi gasto (0 a 1+). */
  gastoDoOrcamento: number
  /** Atletas da base promovidos ao profissional nesta carreira. */
  promovidosDaBase: number
  /** Moral do elenco, 0 a 100. */
  moralDoElenco: number
  /**
   * ⚠️ QUE CARREIRA E ESTA (1.0.347). Ausente = tecnico profissional, que era o
   * unico comportamento ate aqui. Sem isto, a diretoria do Sub-20 cobrava
   * resultado como a de um clube de Serie A e mal olhava para o que a base
   * formou — que e o trabalho inteiro daquela carreira.
   */
  modalidade?: ModalidadeDeCarreira
}

const limitar = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/**
 * A leitura de cada área.
 *
 * ⚠️ As faixas são propositalmente largas. A diretoria não é uma planilha: ela
 * percebe "está indo bem", "está preocupante" e "acabou a paciência". Faixas
 * estreitas fariam a frase mudar toda semana sem nada ter mudado de verdade, e o
 * jogador aprenderia a ignorá-las.
 */
export function confiancaPorArea(ctx: ContextoDaConfianca): LeituraDaArea[] {
  const areas: LeituraDaArea[] = []

  // RESULTADOS — o que já era medido, agora sozinho e sem contaminação.
  areas.push({
    area: "resultados",
    nota: limitar(ctx.confiancaEsportiva),
    leitura: ctx.confiancaEsportiva >= 70 ? "A campanha corresponde ao que esperávamos."
      : ctx.confiancaEsportiva >= 45 ? "A campanha está aquém, mas há tempo."
      : "Os resultados não sustentam o projeto.",
  })

  // FINANÇAS — caixa e dívida. É aqui que o bônus de governança pertencia desde
  // sempre: ele nasce de atraso de pagamento, não de derrota.
  const saudeFinanceira = ctx.saldo <= 0 ? 20
    : ctx.dividaTotal > 0 && ctx.saldo < ctx.dividaTotal * 0.3 ? 45
    : ctx.dividaTotal === 0 ? 85
    : 65
  const financas = limitar(saudeFinanceira + ctx.bonusDeGovernanca)
  areas.push({
    area: "financas",
    nota: financas,
    leitura: financas >= 70 ? "As contas estão em ordem."
      : financas >= 40 ? "O caixa preocupa a diretoria."
      : "A situação financeira é insustentável.",
  })

  // MERCADO — gastar não é pecado; gastar ALÉM do orçamento é.
  const mercado = ctx.gastoDoOrcamento <= 0.85 ? 78
    : ctx.gastoDoOrcamento <= 1 ? 62
    : ctx.gastoDoOrcamento <= 1.25 ? 40
    : 22
  areas.push({
    area: "mercado",
    nota: mercado,
    leitura: mercado >= 70 ? "As contratações respeitam o planejamento."
      : mercado >= 40 ? "O investimento passou do combinado."
      : "O gasto no mercado fugiu do controle.",
  })

  // BASE — a diretoria de clube que forma cobra que se forme.
  const base = ctx.promovidosDaBase >= 3 ? 88
    : ctx.promovidosDaBase === 2 ? 74
    : ctx.promovidosDaBase === 1 ? 60
    : 45
  areas.push({
    area: "base",
    nota: base,
    leitura: base >= 70 ? "A base está entregando ao profissional."
      : base >= 55 ? "Esperávamos mais garotos aproveitados."
      : "A base não tem produzido para o time principal.",
  })

  // VESTIÁRIO — moral é o termômetro que a diretoria enxerga de fora.
  areas.push({
    area: "vestiario",
    nota: limitar(ctx.moralDoElenco),
    leitura: ctx.moralDoElenco >= 70 ? "O grupo está com o treinador."
      : ctx.moralDoElenco >= 45 ? "Há ruído no vestiário."
      : "O elenco não responde mais ao comando.",
  })

  // ⚠️ O PESO DA AREA DEPENDE DA MODALIDADE. Formar atleta e uma das areas do
  // tecnico profissional e e O trabalho de quem dirige o Sub-20; caixa aperta um
  // clube de Serie A de um jeito e um departamento feminino de outro. As faixas
  // continuam largas — o que muda e o quanto cada leitura pesa no fim.
  const pesos = pesoDasAreas(ctx.modalidade)
  for (const area of areas) area.peso = pesos[area.area] ?? 1

  return areas
}

/**
 * A ÁREA QUE MAIS PESA CONTRA o técnico agora.
 *
 * É a informação acionável: dá para consertar uma coisa por vez, e o jogador
 * precisa saber qual. Devolve `null` quando nada está ruim — dizer "sua pior
 * área é a base, com 74" seria alarme falso.
 */
export function areaMaisFragil(areas: LeituraDaArea[]): LeituraDaArea | null {
  // ⚠️ A PIOR NOTA NAO E O PIOR PROBLEMA. Numa carreira de Sub-20, mercado 40 e
  // irrelevante e base 58 e grave — apontar o mercado mandaria o jogador
  // consertar o que ninguem esta cobrando dele. Ordena pelo que DOI, que e a
  // nota lida contra o peso da area nesta modalidade.
  const dorDe = (a: LeituraDaArea) => a.nota / (a.peso ?? 1)
  const pior = [...areas].sort((a, b) => dorDe(a) - dorDe(b))[0]
  return pior && pior.nota < 55 ? pior : null
}

export const NOME_DA_AREA: Record<AreaDaDiretoria, string> = {
  resultados: "Resultados",
  financas: "Finanças",
  mercado: "Mercado",
  base: "Base",
  vestiario: "Vestiário",
}
