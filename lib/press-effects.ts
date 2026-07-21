// Consequencias da coletiva pos-jogo sobre o ELENCO e a DIRETORIA.
//
// O que existia: `onComplete(moraleImpact)` recebia o saldo das respostas e
// simplesmente NAO usava o valor. O jogador escolhia entre "vou cobrar no
// vestiario" e "o grupo esta de parabens" e as duas davam exatamente no mesmo
// lugar — a coletiva era decorativa.
//
// A regra central: diretoria e elenco julgam coisas DIFERENTES. Bater no time em
// publico costuma agradar quem cobra resultado e afundar quem esta no vestiario;
// blindar o grupo faz o contrario. Uma nota so nao expressa isso, por isso o tom
// de cada resposta viaja junto.

export type TomResposta = "positivo" | "neutro" | "negativo" | "agressivo" | string

export interface EfeitoColetiva {
  /** Variacao na moral do elenco. */
  moralDelta: number
  /** Variacao na confianca da diretoria. */
  diretoriaDelta: number
  /** Mensagem do vestiario, ou null se as respostas foram irrelevantes. */
  recadoElenco: { titulo: string; texto: string } | null
  /** Mensagem da diretoria, ou null. */
  recadoDiretoria: { titulo: string; texto: string } | null
}

export function calcularEfeitoColetiva(input: {
  moraleImpact: number
  tons: TomResposta[]
  venceu: boolean
  perdeu: boolean
}): EfeitoColetiva {
  const { moraleImpact, tons, venceu, perdeu } = input
  if (tons.length === 0) {
    return { moralDelta: 0, diretoriaDelta: 0, recadoElenco: null, recadoDiretoria: null }
  }

  const agressivas = tons.filter(t => t === "agressivo").length
  const positivas = tons.filter(t => t === "positivo").length
  const negativas = tons.filter(t => t === "negativo").length

  // O elenco sente o saldo das respostas quase diretamente; cobrar em publico
  // pesa mais do que o numero sugere, porque expoe o grupo.
  const moralDelta = Math.max(-12, Math.min(12, moraleImpact - agressivas * 2))

  /**
   * A diretoria NAO e o espelho do elenco. Ela valoriza quem assume
   * responsabilidade e desconfia de quem so elogia depois de perder — proteger
   * o grupo apos derrota soa como falta de autocritica.
   */
  let diretoriaDelta = 0
  if (perdeu) {
    diretoriaDelta += negativas * 2   // reconhecer o erro conta a favor
    diretoriaDelta += agressivas * 1  // cobranca publica agrada a cupula
    diretoriaDelta -= positivas * 2   // comemorar apos derrota, nao
  } else if (venceu) {
    diretoriaDelta += positivas
    diretoriaDelta -= agressivas * 2  // vencer e bater no time passa instabilidade
  } else {
    diretoriaDelta += Math.sign(moraleImpact)
  }
  diretoriaDelta = Math.max(-8, Math.min(8, diretoriaDelta))

  const recadoElenco = moralDelta === 0 ? null : moralDelta > 0
    ? {
        titulo: "Elenco aprovou sua fala",
        texto: `O grupo comentou a coletiva no vestiario e gostou do que ouviu. Moral do elenco em alta (+${moralDelta}).`,
      }
    : {
        titulo: "Clima pesado no vestiario",
        texto: `Suas declaracoes cairam mal entre os atletas. Moral do elenco em baixa (${moralDelta}).`,
      }

  const recadoDiretoria = diretoriaDelta === 0 ? null : diretoriaDelta > 0
    ? {
        titulo: "Diretoria elogiou sua postura",
        texto: `A diretoria acompanhou a entrevista e aprovou seu discurso. Confianca da diretoria em alta (+${diretoriaDelta}).`,
      }
    : {
        titulo: "Diretoria fez uma ressalva",
        texto: `A diretoria nao gostou do tom da sua entrevista e pediu mais cautela em publico. Confianca da diretoria em baixa (${diretoriaDelta}).`,
      }

  return { moralDelta, diretoriaDelta, recadoElenco, recadoDiretoria }
}
