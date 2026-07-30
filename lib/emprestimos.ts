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

// ── EMPRÉSTIMO NOVO: a dificuldade da mesa ───────────────────────────────────
//
// A mesa de empréstimo do mercado era a parte mais fácil do jogo: taxa fixa de
// 2% do valor por mês (um craque de 80 mi saía por 1,6 mi/mês, troco), nenhuma
// resistência do dono, salário não entrava na conta e o atleta topava qualquer
// coisa porque a força do elenco comprador era passada como zero. Emprestar era
// mais barato e mais fácil do que qualquer outra forma de reforçar o time.
//
// Agora vale a regra da vida real: **ninguém empresta titular em idade de auge**.
// O que circula por empréstimo é jovem para rodar, reserva encostado e veterano
// caro que o dono quer tirar da folha.

export interface ContextoDeEmprestimo {
  overall: number
  idade: number
  /** Valor de mercado do atleta. */
  valor: number
  /** Prestígio do clube DONO e do clube que quer o empréstimo. */
  prestigioDono: number
  prestigioComprador: number
}

export interface DificuldadeDoEmprestimo {
  /** Taxa que o dono considera JUSTA pelo período (referência do slider). */
  taxaJusta: number
  /** Piso: abaixo disto o dono nem responde. */
  taxaMinima: number
  /** Teto: acima disto não adianta pagar mais. */
  taxaMaxima: number
  /** Fatia mínima do salário que você tem de assumir (%). */
  coberturaMinima: number
  /** Multiplica a chance de aceite do clube dono. */
  chanceMult: number
  /** O dono não empresta este atleta de jeito nenhum. */
  recusaDireta: boolean
  /** Motivo em português, para a tela. */
  motivo: string
}

/**
 * O quanto este atleta é "emprestável" — 0 = peça intocável, 1 = o dono agradece
 * se você levar.
 *
 * O eixo principal é IDADE × QUALIDADE: jogador bom entre 25 e 31 anos é titular
 * de alguém, e titular não sai por empréstimo. Jovem sai para rodar; veterano
 * caro sai para aliviar a folha.
 */
export function emprestabilidade(ctx: ContextoDeEmprestimo): number {
  const auge = ctx.idade >= 25 && ctx.idade <= 31
  const jovem = ctx.idade <= 22
  const veterano = ctx.idade >= 33

  // Quanto melhor o atleta, menos o dono quer abrir mão — salvo se for jovem.
  let base = ctx.overall >= 82 ? 0.08
    : ctx.overall >= 78 ? 0.2
    : ctx.overall >= 72 ? 0.45
    : 0.75

  if (jovem) base += 0.35        // rodar é o objetivo do empréstimo de garoto
  if (veterano) base += 0.15     // folha alta pesa mais que o passe
  if (auge) base -= 0.25         // titular em idade de auge não circula

  // Clube grande não empresta para clube pequeno o que ele mesmo usaria.
  const degrau = (ctx.prestigioComprador - ctx.prestigioDono) / 100
  base += degrau * 0.2

  return Math.max(0, Math.min(1, base))
}

/** A régua da negociação de um empréstimo novo. */
export function dificuldadeDeEmprestimo(ctx: ContextoDeEmprestimo): DificuldadeDoEmprestimo {
  const solta = emprestabilidade(ctx)

  // TAXA. Sai do patamar do atleta em curva (como pedidoInicial), não de uma
  // porcentagem linear do valor — é o que faz craque custar caro de verdade.
  // Quem o dono não quer soltar cobra prêmio; quem ele quer tirar da folha sai barato.
  const patamar = Math.pow(Math.max(45, ctx.overall) / 62, 3)
  const premioDeResistencia = 1 + (1 - solta) * 1.6
  const taxaJusta = Math.max(
    100_000,
    Math.round((ctx.valor * 0.11 * patamar * premioDeResistencia) / 50_000) * 50_000,
  )

  // SALÁRIO. Emprestar serve para aliviar a folha: quanto menos o dono quer
  // soltar, mais ele exige que você banque o atleta inteiro.
  const coberturaMinima = solta >= 0.7 ? 50 : solta >= 0.45 ? 75 : 100

  // O dono simplesmente não empresta o titular em auge — nem por dinheiro.
  if (solta <= 0.12) {
    return {
      taxaJusta, taxaMinima: taxaJusta, taxaMaxima: taxaJusta,
      coberturaMinima: 100, chanceMult: 0, recusaDireta: true,
      motivo: ctx.idade >= 25 && ctx.idade <= 31
        ? "Titular em idade de auge não sai por empréstimo. O clube ouve proposta de COMPRA."
        : "O clube não abre mão deste atleta por empréstimo.",
    }
  }

  return {
    taxaJusta,
    taxaMinima: Math.round(taxaJusta * 0.6),
    taxaMaxima: Math.round(taxaJusta * 2),
    coberturaMinima,
    // Mesmo dentro do que ele aceita discutir, a chance cai para os melhores.
    chanceMult: 0.45 + solta * 0.75,
    recusaDireta: false,
    motivo: solta >= 0.7
      ? "O clube quer o atleta rodando e topa conversar."
      : solta >= 0.45
        ? "O clube ouve a proposta, mas quer taxa cheia e o salário coberto."
        : "O clube reluta em emprestar: só sai por uma taxa bem acima e com a folha toda por sua conta.",
  }
}

// ── EMPRÉSTIMO NOVO: A MESA DE TERMOS (1.0.228) ──────────────────────────────
//
// Até aqui o empréstimo tinha UMA etapa: taxa + cobertura salarial, e fechava.
// Não havia salário, não havia duração (26 semanas cravadas no código), não
// havia opção de compra e o dono não pedia nada em troca. Comprar tinha três
// etapas de negociação; emprestar tinha meia.
//
// Agora o empréstimo tem a mesa que faltava. E o que o dono cobra NÃO é só
// dinheiro: emprestar existe para o atleta JOGAR, então ele exige minutagem —
// a mesma régua que a renovação (`aproveitamentoDoEmprestimo`) usa depois para
// decidir se renova. Quem promete banco não leva o garoto.

/** O que o clube dono exige numa mesa de empréstimo novo. */
export interface ExigenciasDoDono {
  /** Duração que serve ao dono, em semanas. */
  semanasIdeais: number
  /** Fatia mínima do salário que você assume (%). */
  coberturaMinima: number
  /** % das partidas que ele exige que o atleta jogue. */
  minutosMinimos: number
  /** O dono aceita vender no fim? (jovem de projeto costuma não ter opção.) */
  aceitaOpcaoDeCompra: boolean
  /** Piso da opção de compra, quando ele aceita uma. */
  opcaoDeCompraMinima: number
}

/** A proposta que VOCÊ leva à mesa do dono. */
export interface TermosNovoEmprestimo {
  semanas: number
  taxa: number
  coberturaSalarial: number
  /** % das partidas que você promete ao atleta. */
  minutosPrometidos: number
  /** Valor da opção de compra ao fim (0 = sem opção). */
  opcaoDeCompra: number
}

export type VereditoDoDono = "aceito" | "contraproposta" | "recusado"

export interface RespostaDaMesaDeEmprestimo {
  veredito: VereditoDoDono
  /** Frase do dono, em português. */
  recado: string
  /** Presente em "contraproposta": o que ele exige para fechar. */
  contraproposta?: TermosNovoEmprestimo
  /** 0-100 — o quanto a proposta agradou (para a barra da tela). */
  satisfacao: number
}

/**
 * O que o dono pede de saída num empréstimo novo.
 *
 * Sai da mesma `emprestabilidade` que define a taxa: quem ele quer tirar da
 * folha é flexível; quem ele solta a contragosto exige tudo — folha inteira,
 * titularidade garantida e nenhuma opção de compra.
 */
export function exigenciasDoDono(ctx: ContextoDeEmprestimo): ExigenciasDoDono {
  const solta = emprestabilidade(ctx)
  const jovem = ctx.idade <= 22

  return {
    // Garoto para rodar vai por temporada inteira; veterano/reserva aceita meia.
    semanasIdeais: jovem ? 39 : 26,
    coberturaMinima: solta >= 0.7 ? 50 : solta >= 0.45 ? 75 : 100,
    // O ponto do empréstimo. Garoto tem de jogar; veterano encostado, nem tanto.
    minutosMinimos: jovem ? 70 : solta >= 0.7 ? 50 : 40,
    // Ninguém coloca opção de compra na joia da base; no encostado, o dono adora.
    aceitaOpcaoDeCompra: !(jovem && ctx.overall >= 72),
    opcaoDeCompraMinima: Math.round((ctx.valor * (jovem ? 1.4 : 0.9)) / 100_000) * 100_000,
  }
}

/**
 * O dono responde à sua proposta de empréstimo.
 *
 * Regra da mesa: minutagem e cobertura são ELIMINATÓRIAS (não há dinheiro que
 * compre "ele fica no banco"); taxa e opção de compra são negociáveis. `rodada`
 * conta quantas vezes você já respondeu — na terceira ele encerra, como na
 * renovação.
 */
export function avaliarPropostaDeEmprestimo(
  termos: TermosNovoEmprestimo,
  exigencias: ExigenciasDoDono,
  dificuldade: DificuldadeDoEmprestimo,
  rodada: number,
  nomeDoAtleta: string,
): RespostaDaMesaDeEmprestimo {
  if (dificuldade.recusaDireta) {
    return { veredito: "recusado", satisfacao: 0, recado: dificuldade.motivo }
  }

  // ── Minutagem: o motivo de existir o empréstimo ──────────────────────────
  if (termos.minutosPrometidos < exigencias.minutosMinimos) {
    if (rodada >= 2) {
      return {
        veredito: "recusado",
        satisfacao: 0,
        recado: `Não vamos mandar ${nomeDoAtleta} para ficar no banco. Conversa encerrada.`,
      }
    }
    return {
      veredito: "contraproposta",
      satisfacao: 15,
      contraproposta: { ...termos, minutosPrometidos: exigencias.minutosMinimos },
      recado: `${nomeDoAtleta} sai para JOGAR. Garanta pelo menos ${exigencias.minutosMinimos}% das partidas ` +
        `ou levamos o atleta para outro clube.`,
    }
  }

  // ── Opção de compra: ele pode simplesmente não aceitar ───────────────────
  if (termos.opcaoDeCompra > 0 && !exigencias.aceitaOpcaoDeCompra) {
    return {
      veredito: "contraproposta",
      satisfacao: 30,
      contraproposta: { ...termos, opcaoDeCompra: 0 },
      recado: `${nomeDoAtleta} é projeto da casa. Empréstimo sim, opção de compra não.`,
    }
  }
  if (termos.opcaoDeCompra > 0 && termos.opcaoDeCompra < exigencias.opcaoDeCompraMinima) {
    return {
      veredito: "contraproposta",
      satisfacao: 35,
      contraproposta: { ...termos, opcaoDeCompra: exigencias.opcaoDeCompraMinima },
      recado: `Se há opção de compra, ela vale o que o atleta vale. Abaixo de ` +
        `${Math.round(exigencias.opcaoDeCompraMinima / 1_000_000)} milhões não assinamos.`,
    }
  }

  // ── O pacote financeiro ──────────────────────────────────────────────────
  // Taxa e cobertura entram juntas: quem cobre a folha inteira pode pagar menos
  // de taxa, e vice-versa. Foi o que sempre faltou — as duas eram checadas em
  // separado e uma não compensava a outra.
  const taxaRatio = dificuldade.taxaJusta > 0 ? termos.taxa / dificuldade.taxaJusta : 1
  const coberturaExtra = (termos.coberturaSalarial - exigencias.coberturaMinima) / 100
  const duracaoGap = Math.abs(termos.semanas - exigencias.semanasIdeais) / exigencias.semanasIdeais

  let satisfacao =
    50 +
    (taxaRatio - 1) * 60 +
    coberturaExtra * 45 +
    (termos.opcaoDeCompra > 0 ? 8 : 0) -   // opção de compra agrada quem quer se livrar da folha
    duracaoGap * 25

  // Cobertura abaixo do mínimo é grave, mas aqui ainda dá para comprar com taxa.
  if (termos.coberturaSalarial < exigencias.coberturaMinima) {
    satisfacao -= (exigencias.coberturaMinima - termos.coberturaSalarial) * 1.1
  }

  satisfacao = Math.max(0, Math.min(100, satisfacao))

  // A tolerância cai a cada rodada — igual à renovação.
  const corte = rodada === 0 ? 55 : rodada === 1 ? 62 : 70
  if (satisfacao >= corte) {
    return {
      veredito: "aceito",
      satisfacao: Math.round(satisfacao),
      recado: `Fechado. ${nomeDoAtleta} é seu por ${termos.semanas} semanas — queremos ele jogando.`,
    }
  }

  if (rodada >= 2) {
    return {
      veredito: "recusado",
      satisfacao: Math.round(satisfacao),
      recado: "Não chegamos a um acordo. O atleta fica.",
    }
  }

  // Contraproposta: ele pede o que falta, cedendo uma parte da diferença.
  const cedeu = 0.2
  const taxaAlvo = Math.max(termos.taxa, dificuldade.taxaJusta * (1 - cedeu))
  const contraproposta: TermosNovoEmprestimo = {
    semanas: exigencias.semanasIdeais,
    taxa: Math.min(
      dificuldade.taxaMaxima,
      Math.round(taxaAlvo / 50_000) * 50_000,
    ),
    coberturaSalarial: Math.max(termos.coberturaSalarial, exigencias.coberturaMinima),
    minutosPrometidos: Math.max(termos.minutosPrometidos, exigencias.minutosMinimos),
    opcaoDeCompra: termos.opcaoDeCompra,
  }

  const faltas: string[] = []
  if (contraproposta.taxa > termos.taxa) faltas.push("a taxa está abaixo do que pedimos")
  if (contraproposta.coberturaSalarial > termos.coberturaSalarial) faltas.push("você precisa assumir mais da folha")
  if (contraproposta.semanas !== termos.semanas) faltas.push("a duração não serve ao nosso planejamento")

  return {
    veredito: "contraproposta",
    satisfacao: Math.round(satisfacao),
    contraproposta,
    recado: faltas.length
      ? `Assim não fecha: ${faltas.join(", ")}. Ajuste e voltamos a conversar.`
      : "Estamos perto, mas ainda não é o suficiente.",
  }
}

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
