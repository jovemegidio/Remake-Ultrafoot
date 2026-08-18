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

import { tomDaModalidade } from "@/lib/tom-da-modalidade"
import type { ModalidadeDeCarreira } from "@/lib/modalidade-de-carreira"

export type AssuntoDaDiretoria = "verba" | "meta" | "pressao" | "elenco" | "demissao"
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
  /** O técnico pediu demissão nesta fala — a tela confirma antes de executar. */
  pedeDemissao?: boolean
}

export const ASSUNTOS: { id: AssuntoDaDiretoria; titulo: string; descricao: string }[] = [
  { id: "verba", titulo: "Pedir verba para reforços", descricao: "Peça dinheiro extra para o mercado." },
  { id: "meta", titulo: "Renegociar a meta da temporada", descricao: "Discuta o objetivo cobrado de você." },
  { id: "pressao", titulo: "Falar sobre a pressão", descricao: "Peça respaldo publico da diretoria." },
  { id: "elenco", titulo: "Falar do elenco", descricao: "Explique o momento do grupo e o que falta." },
  { id: "demissao", titulo: "Pedir demissão", descricao: "Encerrar seu ciclo no clube." },
]

// ── ENTENDER O QUE VOCÊ ESCREVEU ────────────────────────────────────────────
//
// O chat é de texto livre, e o jogo roda offline: não há modelo de linguagem do
// outro lado. O que existe é leitura de INTENÇÃO por palavra-chave — assunto
// (do que você está falando) e tom (como está falando). É o suficiente para a
// conversa responder ao que foi dito, e é honesto: quando não entende, a
// diretoria pede que você seja mais claro em vez de fingir que entendeu.

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// ⚠️ VOCABULARIO AMPLO DE PROPOSITO (pedido: "aumente o contexto de fala onde
// posso falar qualquer coisa e eles entenderem").
//
// O jogo e OFFLINE e nao tem modelo de linguagem: o que existe aqui e leitura de
// INTENCAO por palavra-chave, e a qualidade dela e exatamente o tamanho desta
// lista. Falar por voz ou digitar livremente so funciona se as palavras que uma
// pessoa realmente usa estiverem aqui — incluindo giria, forma falada e erro de
// digitacao comum. Trechos curtos (prefixos) cobrem as flexoes: "reforc" pega
// reforco, reforcos, reforcar.
const PALAVRAS_DE_ASSUNTO: Record<AssuntoDaDiretoria, string[]> = {
  verba: ["verba", "dinheiro", "grana", "investir", "investimento", "reforc", "contratar", "contrata", "caixa",
    "orcamento", "budget", "comprar", "janela", "bufunfa", "money", "capital", "aporte", "libera", "liberar",
    "abrir o cofre", "cofre", "gastar", "gasto", "teto", "folha", "salarial", "propost", "negociar jogador",
    "mercado", "trazer alguem", "trazer um", "preciso de gente", "falta jogador", "sem elenco pra"],
  meta: ["meta", "objetivo", "cobranca", "cobrar", "exig", "titulo", "classific", "rebaix", "tabela", "posicao",
    "campanha", "alvo", "expectativa", "onde querem", "que esperam", "top", "g4", "g6", "z4", "subir", "acesso",
    "promocao", "descer", "cair", "primeira divisao", "serie a", "objetivos", "resultado esperado"],
  pressao: ["pressao", "imprensa", "apoio", "respaldo", "demiss", "demitir", "cadeira", "confianca", "critica",
    "torcida", "cobranca da torcida", "clima", "estabilidade", "seguro", "meu emprego", "meu cargo", "corda bamba", "vao me mandar", "tempo", "paciencia", "prazo", "credito", "estao satisfeitos",
    "aguentam", "respaldo do conselho", "conselho", "presidente"],
  elenco: ["elenco", "grupo", "jogador", "atleta", "plantel", "lesao", "lesionad", "desfalque", "curto",
    "qualidade", "time", "escalacao", "banco", "reserva", "titular", "peca", "carente", "fraco", "limitado",
    "nivel", "material humano", "vestiario", "moral", "entrosamento", "sub", "base", "juniores"],
  // PEDIR DEMISSAO pela conversa (pedido). Palavras que so aparecem quando e
  // isso mesmo que se quer dizer — "sair", sozinho, e ambiguo demais.
  demissao: ["pedir demissao", "peco demissao", "me demito", "demito", "quero sair do clube",
    "deixar o clube", "estou saindo", "renuncio", "renunciar", "entrego o cargo", "abandono o cargo",
    "nao quero mais", "meu ciclo acabou", "encerrar meu ciclo", "rescindir meu contrato"],
}

const PALAVRAS_DE_TOM: Record<TomDaResposta, string[]> = {
  firme: ["preciso", "exijo", "tem que", "nao da", "impossivel", "sem isso", "cobro", "inaceitavel", "obrigat",
    "ou entao", "nao aceito", "faco questao", "e o minimo", "nao tem como", "ou eu", "de jeito nenhum",
    "absurdo", "inadmissivel", "nao vou", "recuso", "quero ja", "urgente", "agora"],
  humilde: ["assumo", "minha responsabilidade", "culpa minha", "eu resolvo", "trabalho com", "sem problema",
    "aceito", "entendo", "vou responder", "me viro", "peco desculpa", "desculpa", "reconheco", "erramos",
    "errei", "vou corrigir", "confie", "me deem tempo", "estou ciente", "faremos melhor", "compreendo"],
  diplomatico: ["proponho", "sugiro", "podemos", "talvez", "acredito", "gostaria", "seria bom", "vamos", "que tal", "penso"],
}

function contem(texto: string, chaves: string[]): number {
  return chaves.reduce((n, k) => (texto.includes(k) ? n + 1 : n), 0)
}

/** O assunto de que a mensagem trata, ou null quando não dá para saber. */
export function assuntoDoTexto(texto: string): AssuntoDaDiretoria | null {
  const t = semAcento(texto)
  let melhor: { id: AssuntoDaDiretoria; pontos: number } | null = null
  for (const id of Object.keys(PALAVRAS_DE_ASSUNTO) as AssuntoDaDiretoria[]) {
    const pontos = contem(t, PALAVRAS_DE_ASSUNTO[id])
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { id, pontos }
  }
  return melhor?.id ?? null
}

/** O tom da mensagem. Sem sinal claro, trata como diplomático (o meio-termo). */
export function tomDoTexto(texto: string): TomDaResposta {
  const t = semAcento(texto)
  const firme = contem(t, PALAVRAS_DE_TOM.firme) + (texto.includes("!") ? 1 : 0) + (texto === texto.toUpperCase() && texto.length > 12 ? 1 : 0)
  const humilde = contem(t, PALAVRAS_DE_TOM.humilde)
  const diplomatico = contem(t, PALAVRAS_DE_TOM.diplomatico)
  if (firme > humilde && firme > diplomatico) return "firme"
  if (humilde > firme && humilde > diplomatico) return "humilde"
  return "diplomatico"
}

/** Quando a diretoria não entendeu o assunto. */
export const PEDIDO_DE_CLAREZA =
  "Não ficou claro o que você está pedindo. Fale de verba para reforços, da meta da temporada, " +
  "da pressão em cima do trabalho ou do elenco que você tem."

/** A primeira fala — a diretoria abre de acordo com o estado real da carreira. */
/**
 * ⚠️ A DIRETORIA FALAVA COM TODO MUNDO IGUAL (corrigido na 1.0.347).
 *
 * A mesma frase ia para quem dirige um clube de Serie A, um departamento
 * feminino e um Sub-20 — inclusive "o clube ja investiu no elenco que voce tem",
 * dita a quem comanda a base, onde a conta e outra e o trabalho e formar. O
 * `modalidade` e opcional porque ausente significa o modo de sempre, nunca
 * "nao sei". Ver lib/tom-da-modalidade.
 */
export function aberturaDaDiretoria(
  assunto: AssuntoDaDiretoria,
  e: EstadoDaDiretoria,
  modalidade?: ModalidadeDeCarreira,
): string {
  const acimaDaMeta = e.posicao > 0 && e.posicao <= e.metaPosicao
  const tom = tomDaModalidade(modalidade)
  switch (assunto) {
    case "verba":
      return e.confianca >= 65
        ? `Estamos satisfeitos com o trabalho. Diga o que precisa — dentro do razoável, o clube ouve.`
        : tom.falaDeVerba
    case "meta":
      return acimaDaMeta
        ? `Você está em ${e.posicao}º, acima do que pedimos. Por que mexer na meta agora?`
        : `A meta era terminar até o ${e.metaPosicao}º e ${tom.equipe} está em ${e.posicao}º. O que aconteceu?`
    case "pressao":
      return e.confianca >= 60
        ? "A imprensa cobra, é o normal. O que você espera da diretoria?"
        : `Não vamos fingir que está tudo bem. Aqui se espera ${tom.oQueEsperam}. Diga o que pretende fazer.`
    case "elenco":
      return `Somos todo ouvidos. Como você avalia ${tom.equipe} que tem em mãos?`
    case "demissao":
      return e.confianca >= 60
        ? "Você quer mesmo sair? O clube está satisfeito com o trabalho e preferia que ficasse. Pense bem."
        : "Se é essa a sua decisão, o clube não vai segurar ninguém contra a vontade. Confirme e encerramos hoje."
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
  demissao: [
    { id: "firme", texto: "Peço demissão. Não há mais condições de seguir." },
    { id: "diplomatico", texto: "Acho que meu ciclo aqui se encerrou. Prefiro sair agora." },
    { id: "humilde", texto: "Não entreguei o que prometi. Deixo o cargo à disposição." },
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
  // DEMISSAO nao e negociacao: o clube pode lamentar, mas quem decide e voce.
  // A tela e que confirma antes de executar (acao irreversivel).
  if (assunto === "demissao") {
    return {
      resposta: e.confianca >= 60
        ? "Lamentamos. Fica registrado o respeito do clube pelo seu trabalho — as portas seguem abertas."
        : "Aceito. Agradecemos o período e desejamos sorte na sequência.",
      confiancaDelta: 0,
      pedeDemissao: true,
    }
  }
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
