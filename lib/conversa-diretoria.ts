// CONVERSA COM A DIRETORIA — a mesa que faltava.
//
// O atleta já tinha conversa de verdade (components/bench-talk.tsx: ele pede,
// você responde, a moral dele muda). A diretoria não tinha nada: a aba só
// listava recados prontos. Aqui ela ganha uma conversa com assunto, tom de
// resposta e CONSEQUÊNCIA — verba liberada, meta renegociada, confiança que
// sobe ou desce.
//
// Por que NÃO é um chat de IA de verdade: o jogo roda offline, no seu PC. Pendurar
// a conversa num modelo de linguagem exigiria internet, chave de API e custo por
// mensagem para cada jogador — e deixaria a tela em branco no avião. O que vale
// aqui é o que os simuladores usam: diálogo com estado. Quem responde é a
// diretoria DESTE save, olhando confiança, campanha, caixa e o que você já
// prometeu antes.

export type AssuntoDaDiretoria = "verba" | "meta" | "pressao" | "elenco"
export type TomDaResposta = "firme" | "diplomatico" | "humilde"

export interface EstadoDaDiretoria {
  /** 0-100. Vem de computeBoardConfidence (board-engine). */
  confianca: number
  /** Posição atual na liga e a meta cobrada. */
  posicao: number
  metaPosicao: number
  /** Caixa do clube, para a conversa de verba não pedir o impossível. */
  caixa: number
  /** Prestígio do clube — clube grande é mais exigente. */
  prestigio: number
  /** Quantas vezes você já pediu algo nesta temporada (a paciência acaba). */
  pedidosNaTemporada: number
}

export interface FalaDaConversa {
  autor: "diretoria" | "tecnico"
  texto: string
}

export interface OpcaoDeResposta {
  id: TomDaResposta
  texto: string
}

export interface DesfechoDaConversa {
  resposta: string
  /** Variação na confiança da diretoria (-15 a +12). */
  confiancaDelta: number
  /** Verba extra liberada, quando o assunto era verba e eles cederam. */
  verbaLiberada?: number
  /** Meta renegociada (nova posição exigida), quando cederam. */
  novaMeta?: number
}

export const ASSUNTOS: { id: AssuntoDaDiretoria; titulo: string; descricao: string }[] = [
  { id: "verba", titulo: "Pedir verba para reforços", descricao: "Peça dinheiro extra para o mercado." },
  { id: "meta", titulo: "Renegociar a meta da temporada", descricao: "Discuta o objetivo cobrado de você." },
  { id: "pressao", titulo: "Falar sobre a pressão", descricao: "Peça respaldo publico da diretoria." },
  { id: "elenco", titulo: "Falar do elenco", descricao: "Explique o momento do grupo e o que falta." },
]

/** A primeira fala — a diretoria abre de acordo com o estado real da carreira. */
export function aberturaDaDiretoria(assunto: AssuntoDaDiretoria, e: EstadoDaDiretoria): string {
  const acimaDaMeta = e.posicao > 0 && e.posicao <= e.metaPosicao
  switch (assunto) {
    case "verba":
      return e.confianca >= 65
        ? "Estamos satisfeitos com o trabalho. Diga o que precisa — dentro do razoável, o clube ouve."
        : "Verba? O clube já investiu no elenco que você tem. Explique por que deveríamos colocar mais."
    case "meta":
      return acimaDaMeta
        ? `Você está em ${e.posicao}º, acima do que pedimos. Por que mexer na meta agora?`
        : `A meta era terminar até o ${e.metaPosicao}º e o time está em ${e.posicao}º. O que aconteceu?`
    case "pressao":
      return e.confianca >= 60
        ? "A imprensa cobra, é o normal. O que você espera da diretoria?"
        : "Não vamos fingir que está tudo bem. O clube esperava mais. Diga o que pretende fazer."
    case "elenco":
      return "Somos todo ouvidos. Como você avalia o grupo que tem em mãos?"
  }
}

export const RESPOSTAS: Record<AssuntoDaDiretoria, OpcaoDeResposta[]> = {
  verba: [
    { id: "firme", texto: "Sem reforço não há como cumprir o que vocês pedem." },
    { id: "diplomatico", texto: "Tenho dois alvos certos. Com pouco, resolvo duas posições." },
    { id: "humilde", texto: "Se não houver verba, eu trabalho com o que tenho." },
  ],
  meta: [
    { id: "firme", texto: "A meta foi feita sem conhecer o elenco. Ela precisa mudar." },
    { id: "diplomatico", texto: "Proponho revisar o objetivo agora e recompensar se superarmos." },
    { id: "humilde", texto: "Assumo a meta como está. A responsabilidade é minha." },
  ],
  pressao: [
    { id: "firme", texto: "Quero apoio público. Sem isso, o vestiário sente." },
    { id: "diplomatico", texto: "Peço tempo e uma nota da diretoria reforçando o projeto." },
    { id: "humilde", texto: "A cobrança é justa. Vou responder dentro de campo." },
  ],
  elenco: [
    { id: "firme", texto: "O elenco é curto para tantas competições, e isso é responsabilidade do clube." },
    { id: "diplomatico", texto: "O grupo é bom, mas duas posições precisam de reforço para o ano." },
    { id: "humilde", texto: "Tenho material suficiente. Cabe a mim extrair mais do grupo." },
  ],
}

/**
 * A diretoria responde.
 *
 * A regra que dá peso à conversa: **quem entrega, pede**. Confiança alta abre a
 * mão do clube; confiança baixa transforma tom firme em atrito. E pedir toda
 * semana cansa — `pedidosNaTemporada` derruba a chance de conseguir algo.
 */
export function responderDiretoria(
  assunto: AssuntoDaDiretoria,
  tom: TomDaResposta,
  e: EstadoDaDiretoria,
): DesfechoDaConversa {
  const cansaco = Math.min(30, e.pedidosNaTemporada * 10)
  const credito = e.confianca - cansaco
  const acimaDaMeta = e.posicao > 0 && e.posicao <= e.metaPosicao

  if (assunto === "verba") {
    // Verba sai do caixa: no máximo um quarto do que existe, e só com crédito.
    const teto = Math.max(0, Math.round((e.caixa * 0.25) / 500_000) * 500_000)
    if (tom === "firme") {
      if (credito >= 70) {
        return { resposta: "Você entrega resultado e fala na hora certa. A verba está liberada.", confiancaDelta: 2, verbaLiberada: teto }
      }
      return { resposta: "Exigência não é argumento. Traga resultado e voltamos a conversar.", confiancaDelta: -8 }
    }
    if (tom === "diplomatico") {
      if (credito >= 45) {
        return { resposta: "Duas posições, dentro do teto. Fechado.", confiancaDelta: 3, verbaLiberada: Math.round(teto * 0.6) }
      }
      return { resposta: "Vamos esperar mais algumas rodadas antes de mexer no caixa.", confiancaDelta: 0 }
    }
    return { resposta: "É a postura que o clube espera. Não esqueceremos disso.", confiancaDelta: 6 }
  }

  if (assunto === "meta") {
    if (tom === "firme") {
      if (credito >= 75 && !acimaDaMeta) {
        return { resposta: "Tem razão sobre o elenco. A meta muda — mas a cobrança continua.", confiancaDelta: -2, novaMeta: Math.min(20, e.metaPosicao + 4) }
      }
      return { resposta: "A meta foi acertada com você. Ela fica de pé.", confiancaDelta: -10 }
    }
    if (tom === "diplomatico") {
      if (credito >= 55) {
        return { resposta: "Revisamos o objetivo, com bônus se você superá-lo.", confiancaDelta: 1, novaMeta: Math.min(20, e.metaPosicao + 2) }
      }
      return { resposta: "Ainda é cedo para mexer no que combinamos.", confiancaDelta: -1 }
    }
    return { resposta: "Gostamos de quem assume. Conte com o nosso tempo.", confiancaDelta: 8 }
  }

  if (assunto === "pressao") {
    if (tom === "firme") {
      return credito >= 65
        ? { resposta: "Haverá nota de apoio ainda hoje. Trabalhe tranquilo.", confiancaDelta: 4 }
        : { resposta: "Apoio se conquista com resultado. Por ora, resolva em campo.", confiancaDelta: -7 }
    }
    if (tom === "diplomatico") {
      return credito >= 40
        ? { resposta: "O clube reforçará o projeto publicamente. Use bem esse tempo.", confiancaDelta: 5 }
        : { resposta: "Vamos evitar declarações. Foque no próximo jogo.", confiancaDelta: 0 }
    }
    return { resposta: "Postura correta. É assim que se atravessa um momento ruim.", confiancaDelta: 7 }
  }

  // elenco
  if (tom === "firme") {
    return credito >= 60
      ? { resposta: "Anotado. O departamento de futebol vai ouvir você no próximo mercado.", confiancaDelta: 1 }
      : { resposta: "Culpar o elenco não resolve. O treinador foi escolhido para isso.", confiancaDelta: -6 }
  }
  if (tom === "diplomatico") {
    return { resposta: "Diagnóstico claro. Vamos trabalhar essas duas posições.", confiancaDelta: 4 }
  }
  return { resposta: "Responsabilidade é o que se espera. Estamos com você.", confiancaDelta: 6 }
}
