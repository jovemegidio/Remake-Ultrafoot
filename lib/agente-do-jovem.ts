"use client"

// AGENTE DO JOGADOR DA BASE — a compra de um júnior deixa de ser um botão.
//
// Até aqui contratar uma promessa do mercado de juniores era: tem vaga, tem
// caixa, clicou, chegou. O clube formador pedia um valor e ninguém discutia. Mas
// é justamente na base que o empresário manda: o clube até libera, e o agente
// trava, pede luvas, e leva o garoto para quem paga a comissão.
//
// O que este módulo acrescenta:
//   • COMISSÃO por fora do valor do clube (o que o técnico paga a mais);
//   • RECUSA quando a proposta é baixa para o padrão do agente;
//   • CONTRAPROPOSTA, que é o caso mais comum — dá para aceitar ou desistir.
//
// O agente é DERIVADO do id do atleta: o mesmo garoto tem sempre o mesmo agente,
// com o mesmo temperamento. Sem isso, fechar e reabrir a tela sortearia um agente
// novo e bastaria insistir até sair um camarada — o mesmo defeito que o botão de
// dispensar já teve na categoria de base.

const PRENOMES = [
  "Giuliano", "Márcio", "Eduardo", "Paulo", "Ricardo", "André", "Fernando",
  "Carlos", "Jorge", "Rafael", "Sérgio", "Bruno", "Tiago", "Otávio",
]
const SOBRENOMES = [
  "Bertolucci", "Amaral", "Uribe", "Vasquez", "Kremer", "Nogueira", "Bianchi",
  "Salgado", "Mendonça", "Prado", "Riquelme", "Fontana", "Duarte", "Espinosa",
]

/** Temperamento do agente. É o que dá cara à negociação. */
export type PerfilAgente = "razoavel" | "duro" | "tubarao"

export interface AgenteDoJovem {
  nome: string
  perfil: PerfilAgente
  /** Comissão pedida, em fração do valor do clube (0.04 a 0.22). */
  comissao: number
  /** Quanto acima do pedido do clube ele espera receber no total (1.0 a 1.35). */
  exigencia: number
}

export const ROTULO_PERFIL: Record<PerfilAgente, string> = {
  razoavel: "Razoável",
  duro: "Duro na queda",
  tubarao: "Tubarão",
}

export const DESCRICAO_PERFIL: Record<PerfilAgente, string> = {
  razoavel: "Cobra a comissão de praxe e não cria caso.",
  duro: "Vai pedir mais do que o clube e insistir.",
  tubarao: "Trata o garoto como ativo. Comissão alta e paciência curta.",
}

function semente(texto: string): number {
  let h = 2166136261
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

/** Sorteio 0-1 reproduzível a partir de um texto. */
function sorteioDe(texto: string): number {
  return (semente(texto) % 100000) / 100000
}

/**
 * O agente deste atleta. Determinístico pelo id — o mesmo garoto tem sempre o
 * mesmo empresário, então não dá para reabrir a tela até sair um mais mole.
 *
 * `potencial` puxa o perfil para cima: promessa grande atrai empresário grande.
 */
export function agenteDoJovem(playerId: string, potencial = 70): AgenteDoJovem {
  const s = semente(`agente:${playerId}`)
  const nome = `${PRENOMES[s % PRENOMES.length]} ${SOBRENOMES[Math.floor(s / PRENOMES.length) % SOBRENOMES.length]}`

  // Quanto maior o potencial, maior a chance de o agente ser osso duro.
  const puxao = Math.max(0, Math.min(0.45, (potencial - 68) * 0.018))
  const r = sorteioDe(`perfil:${playerId}`) + puxao
  const perfil: PerfilAgente = r >= 0.80 ? "tubarao" : r >= 0.48 ? "duro" : "razoavel"

  const base: Record<PerfilAgente, { comissao: number; exigencia: number }> = {
    razoavel: { comissao: 0.05, exigencia: 1.00 },
    duro:     { comissao: 0.11, exigencia: 1.12 },
    tubarao:  { comissao: 0.19, exigencia: 1.26 },
  }
  const b = base[perfil]
  // Variação fina por atleta, para dois "tubarões" não pedirem o mesmo número.
  const ruido = sorteioDe(`ruido:${playerId}`) * 0.06 - 0.03
  return {
    nome,
    perfil,
    comissao: Math.round((b.comissao + ruido) * 1000) / 1000,
    exigencia: Math.round((b.exigencia + ruido) * 1000) / 1000,
  }
}

/** Comissão em reais, sobre o valor pedido pelo clube formador. */
export function comissaoEmReais(valorDoClube: number, agente: AgenteDoJovem): number {
  return Math.round(valorDoClube * agente.comissao / 10_000) * 10_000
}

/** O total que o agente considera aceitável de saída (clube + exigência dele). */
export function pedidoDoAgente(valorDoClube: number, agente: AgenteDoJovem): number {
  return Math.round(valorDoClube * agente.exigencia / 10_000) * 10_000
}

export interface RespostaDoAgente {
  desfecho: "aceita" | "contraproposta" | "recusa"
  /** Total a pagar se aceitar (valor ao clube + comissão). Só em "aceita". */
  totalAPagar?: number
  /** O que ele pede, em "contraproposta". */
  contra?: number
  fala: string
}

/**
 * Resposta do agente a uma oferta.
 *
 * `oferta` é o que o técnico propõe pagar AO CLUBE (a comissão entra por fora,
 * como no futebol de verdade — é o que faz a conta doer mais do que o anunciado).
 *
 * A regra: abaixo de 72% do que ele pede, recusa e encerra. Entre 72% e o pedido,
 * contrapropõe. No pedido ou acima, aceita.
 *
 * POR QUE 72% E NÃO 80%: com 80% o "tubarão" recusava até o valor cheio pedido
 * pelo clube — a exigência dele (até 1,35×) faz o preço do clube valer ~74% do
 * que ele quer. O atleta ficava IMPOSSÍVEL de contratar pela tela, que sempre
 * oferece o pedido do clube. Isso é beco sem saída, não dificuldade. Em 72% o
 * pior caso ainda cai em contraproposta: o técnico vê o preço e decide.
 */
const PISO_PARA_CONVERSAR = 0.72

export function responderOferta(
  valorDoClube: number,
  oferta: number,
  agente: AgenteDoJovem,
  jogadorNome: string,
): RespostaDoAgente {
  const pedido = pedidoDoAgente(valorDoClube, agente)
  const comissao = comissaoEmReais(oferta, agente)
  const mi = (v: number) => `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`

  if (oferta < pedido * PISO_PARA_CONVERSAR) {
    return {
      desfecho: "recusa",
      fala: agente.perfil === "tubarao"
        ? `${agente.nome}: "Isso não é proposta. ${jogadorNome} vale ${mi(pedido)} e eu não perco tempo abaixo disso."`
        : `${agente.nome}: "Muito abaixo. Volte com algo perto de ${mi(pedido)} que a gente conversa."`,
    }
  }
  if (oferta < pedido) {
    return {
      desfecho: "contraproposta",
      contra: pedido,
      fala: `${agente.nome}: "Chegou perto. Feche em ${mi(pedido)} ao clube, mais ${mi(comissaoEmReais(pedido, agente))} da minha comissão, e ${jogadorNome} é seu."`,
    }
  }
  return {
    desfecho: "aceita",
    totalAPagar: oferta + comissao,
    fala: `${agente.nome}: "Combinado. ${mi(oferta)} ao ${"clube"} e ${mi(comissao)} de comissão — ${jogadorNome} assina hoje."`,
  }
}
