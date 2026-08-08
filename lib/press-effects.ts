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

/**
 * `omisso` = o tecnico deixou o tempo da pergunta acabar (ver o cronometro em
 * components/match/post-match-press.tsx). NAO e o mesmo que "neutro": ficar
 * calado diante da imprensa passa inseguranca, e os dois lados leem isso mal.
 */
export type TomResposta = "positivo" | "neutro" | "negativo" | "agressivo" | "omisso" | string

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
  const omissas = tons.filter(t => t === "omisso").length

  // O elenco sente o saldo das respostas quase diretamente; cobrar em publico
  // pesa mais do que o numero sugere, porque expoe o grupo.
  // O silencio pesa no elenco: o grupo esperava ser defendido (ou cobrado) e
  // ouviu o tecnico travar. Alem do impacto negativo que a propria resposta ja
  // carrega, cada omissao tira mais um ponto.
  const moralDelta = Math.max(-12, Math.min(12, moraleImpact - agressivas * 2 - omissas))

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
  // A DIRETORIA E QUEM MENOS PERDOA A OMISSAO. O clube tem imagem publica a
  // defender: um tecnico que emudece na coletiva vira manchete sozinho. Pesa em
  // qualquer resultado — inclusive na vitoria, onde havia so o que colher.
  diretoriaDelta -= omissas * 2
  diretoriaDelta = Math.max(-8, Math.min(8, diretoriaDelta))

  // Recado proprio quando o problema FOI o silencio: sem isto o tecnico levava
  // um "caiu mal no vestiario" sem entender que o motivo foi nao ter respondido.
  if (omissas > 0) {
    const plural = omissas > 1
    return {
      moralDelta,
      diretoriaDelta,
      recadoElenco: {
        titulo: plural ? `Voce nao respondeu ${omissas} perguntas` : "Voce ficou sem resposta",
        texto: `O elenco assistiu a coletiva e viu o tecnico travar diante da imprensa. `
          + `Isso passa inseguranca ao grupo (${moralDelta} de moral).`,
      },
      recadoDiretoria: {
        titulo: "A diretoria cobrou postura na entrevista",
        texto: `Ficar calado em coletiva vira noticia sozinho e expoe o clube. `
          + `A diretoria pediu preparo para as proximas (${diretoriaDelta} de confianca).`,
      },
    }
  }

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
