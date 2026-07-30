// RENOVAÇÃO DE EMPRÉSTIMO — a mesa com o clube DONO do passe.
//
// A regra, como o usuário definiu (30/07/2026):
//
//   • Atleta que chegou por empréstimo NÃO pode ser vendido nem colocado na
//     lista de transferências — o passe não é seu. (A trava está no motor:
//     `toggleTransferListed`/`toggleLoanListed` ignoram quem tem `isLoanedIn`.)
//   • Dá para DEVOLVER antes da hora: ele volta na hora ao clube de origem.
//   • Dá para RENOVAR, e renovar é uma NEGOCIAÇÃO: o dono pede termos, você
//     responde, ele faz contraproposta. Sem acordo, o vínculo acaba na data e o
//     atleta volta para casa.
//
// O que faz a mesa não ser um "sim" automático: o clube dono avalia o que o
// empréstimo rende PARA ELE. Ele quer (a) taxa, (b) o salário coberto e (c) o
// garoto JOGANDO — um empréstimo em que o atleta ficou no banco é ruim para o
// dono, e ele cobra mais caro ou simplesmente leva de volta.

export type PosturaDoDono = "tranquilo" | "exigente" | "quer_de_volta"

export interface TermosDeEmprestimo {
  /** Semanas de extensão pedidas/oferecidas. */
  semanas: number
  /** Taxa paga ao clube dono pelo período. */
  taxa: number
  /** Quanto do salário do atleta você cobre (0 a 100%). */
  coberturaSalarial: number
}

export interface ContextoDaRenovacao {
  /** Overall do atleta — quanto melhor, mais o dono cobra. */
  overall: number
  idade: number
  /** Salário semanal do atleta. */
  salarioSemanal: number
  /** Partidas que ele jogou por você nesta passagem. */
  jogos: number
  /** Semanas já cumpridas do empréstimo (para saber se deu tempo de jogar). */
  semanasNoClube: number
  /** Prestígio do clube dono (define o quanto ele pode se dar ao luxo de recusar). */
  prestigioDono: number
}

export interface RespostaDoDono {
  aceito: boolean
  /** Contraproposta do dono quando não aceita (null = ele encerrou a conversa). */
  contraproposta: TermosDeEmprestimo | null
  postura: PosturaDoDono
  /** Frase para a tela — o motivo em português, não um código. */
  recado: string
}

function hash(v: string): number {
  let h = 2166136261
  for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * Quanto o atleta JOGOU na passagem, de 0 a 1.
 *
 * É o que mais pesa: emprestar serve para o garoto rodar. Quem segurou o
 * jogador no banco perde o direito de renovar barato — e às vezes perde o
 * direito de renovar.
 */
export function aproveitamentoDoEmprestimo(ctx: ContextoDaRenovacao): number {
  const jogosPossiveis = Math.max(1, Math.round(ctx.semanasNoClube))
  return Math.max(0, Math.min(1, ctx.jogos / jogosPossiveis))
}

/** A postura do dono na mesa, decidida pelo uso que você deu ao atleta. */
export function posturaDoDono(ctx: ContextoDaRenovacao, semente: string): PosturaDoDono {
  const uso = aproveitamentoDoEmprestimo(ctx)
  // Jovem que não jogou volta para casa: é o pior resultado possível para o dono.
  if (uso < 0.3 && ctx.idade <= 23) return "quer_de_volta"
  // Craque emprestado sempre tem fila na porta; o dono ouve, mas cobra.
  if (ctx.overall >= 78) return "exigente"
  if (uso >= 0.7) return "tranquilo"
  return hash(`${semente}:postura`) % 100 < 55 ? "exigente" : "tranquilo"
}

/** O que o dono PEDE de saída — o ponto de partida da conversa. */
export function pedidoInicial(ctx: ContextoDaRenovacao, semente: string): TermosDeEmprestimo {
  const postura = posturaDoDono(ctx, semente)
  const uso = aproveitamentoDoEmprestimo(ctx)
  // Taxa base pelo patamar do atleta, corrigida pelo uso (jogou = mais barato).
  const base = Math.pow(Math.max(40, ctx.overall) / 60, 3) * 900_000
  const multaDeBanco = 1 + (1 - uso) * 0.6
  const premioDePostura = postura === "exigente" ? 1.35 : postura === "quer_de_volta" ? 1.9 : 1
  return {
    semanas: 26,
    taxa: Math.round((base * multaDeBanco * premioDePostura) / 50_000) * 50_000,
    coberturaSalarial: postura === "tranquilo" ? 80 : 100,
  }
}

/**
 * O dono responde à sua proposta.
 *
 * `rodada` é quantas vezes você já respondeu — a cada rodada ele cede um pouco
 * menos, e na terceira encerra. Determinístico pela semente: a mesma proposta
 * não muda de resposta se a tela renderizar de novo.
 */
export function responderRenovacao(
  proposta: TermosDeEmprestimo,
  ctx: ContextoDaRenovacao,
  rodada: number,
  semente: string,
): RespostaDoDono {
  const postura = posturaDoDono(ctx, semente)
  const pedido = pedidoInicial(ctx, semente)
  const nome = "o clube"

  if (postura === "quer_de_volta" && rodada === 0) {
    return {
      aceito: false,
      contraproposta: null,
      postura,
      recado: `${ctx.idade <= 23 ? "O garoto quase não jogou" : "O atleta rendeu pouco"} na sua equipe. ` +
        `${nome} dono prefere levá-lo de volta e reavaliar em casa.`,
    }
  }

  // O quanto a proposta cobre o que ele pede, olhando taxa E salário juntos.
  const valorPedido = pedido.taxa + (pedido.coberturaSalarial / 100) * ctx.salarioSemanal * pedido.semanas
  const valorOferecido = proposta.taxa + (proposta.coberturaSalarial / 100) * ctx.salarioSemanal * proposta.semanas
  const cobertura = valorPedido > 0 ? valorOferecido / valorPedido : 1

  // Tolerância cai a cada rodada: a primeira conversa aceita 92% do pedido, a
  // segunda 96%, a terceira exige o valor cheio.
  const exigencia = rodada === 0 ? 0.92 : rodada === 1 ? 0.96 : 1
  if (cobertura >= exigencia) {
    return {
      aceito: true,
      contraproposta: null,
      postura,
      recado: `Acordo fechado: mais ${proposta.semanas} semanas de empréstimo.`,
    }
  }

  if (rodada >= 2) {
    return {
      aceito: false,
      contraproposta: null,
      postura,
      recado: "Sem acordo. O empréstimo termina na data marcada e o atleta volta ao clube de origem.",
    }
  }

  // Contraproposta: ele cede uma parte da diferença, nunca tudo.
  const cedeu = postura === "exigente" ? 0.12 : 0.25
  const alvo = valorPedido - (valorPedido - valorOferecido) * cedeu
  const semanas = proposta.semanas
  const salarioNoPeriodo = (proposta.coberturaSalarial / 100) * ctx.salarioSemanal * semanas
  return {
    aceito: false,
    postura,
    contraproposta: {
      semanas,
      taxa: Math.max(0, Math.round((alvo - salarioNoPeriodo) / 50_000) * 50_000),
      coberturaSalarial: Math.max(proposta.coberturaSalarial, pedido.coberturaSalarial),
    },
    recado: postura === "exigente"
      ? "A proposta está abaixo do que o clube dono espera. Ele voltou com outros números."
      : "Quase lá — o clube dono ajustou a proposta e devolveu para você.",
  }
}
