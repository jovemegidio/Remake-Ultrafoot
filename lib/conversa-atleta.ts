// CONVERSA COM O ATLETA — campo de texto livre, resposta na hora, consequência
// no elenco.
//
// A versão anterior era um modal com três botões prontos ("você será titular",
// "conquiste no treino", "procure outro clube"): sempre as mesmas três frases,
// sempre o mesmo resultado. Aqui você ESCREVE, e o atleta responde ao que foi
// escrito — a intenção sai do próprio texto e o desfecho olha a situação real
// dele (jogos sem entrar, moral, idade, concorrência na posição) e o seu
// histórico de promessas.
//
// SEM MODELO DE LINGUAGEM, pela mesma razão da conversa com a diretoria
// (lib/conversa-diretoria.ts): o jogo roda offline, no PC do jogador. A leitura
// é por intenção; quando ela falha, o atleta pede que você seja mais claro em
// vez de inventar resposta.
//
// O QUE MUDA DE VERDADE (é isto que separa conversa de enfeite):
//   • moral do atleta, em degraus;
//   • titularidade — prometer coloca o atleta no XI e TIRA outro;
//   • lista de transferências — liberar a saída marca o atleta;
//   • PROMESSA REGISTRADA: prometer titularidade cria uma dívida. Se ele não
//     entrar em campo nas próximas partidas, a moral desaba e a sua palavra
//     passa a valer menos nas conversas seguintes.

export type IntencaoDoTecnico =
  | "prometer"
  | "exigir"
  | "acolher"
  | "elogiar"
  | "explicar"
  | "liberar"

export interface EstadoDoAtleta {
  nome: string
  posicao: string
  /** Rotulo de moral do motor ("Feliz" ... "Infeliz"). */
  moral: string
  overall: number
  idade: number
  /** Partidas do time em que ele nao entrou como titular. */
  jogosSemJogar: number
  /** Melhor overall entre os titulares da MESMA posicao (0 = sem concorrente). */
  concorrencia: number
  /** Promessas de titularidade que voce nao cumpriu nesta carreira. */
  promessasQuebradas: number
  /** Ele ja esta na lista de transferencias? */
  naListaDeTransferencias: boolean
}

export interface DesfechoDoAtleta {
  resposta: string
  /** Degraus de moral para ajustarMoralJogador (+ melhora, - piora). */
  moralDegraus: number
  /** Entra no XI titular agora (e alguem sai). */
  viraTitular?: boolean
  /** Vai para a lista de transferencias — ele desistiu de brigar pela vaga. */
  vaParaAListaDeTransferencias?: boolean
  /** Registra a divida: prometido titular, tem que entrar em campo. */
  registraPromessa?: boolean
  /** Encerra a conversa (nao ha mais o que dizer depois disto). */
  encerra?: boolean
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()


// ── LEITURA DA INTENÇÃO ──────────────────────────────────────────────────────
//
// A ordem importa: "liberar" e "prometer" são as falas com consequência pesada,
// então precisam de palavras específicas. Quem escreve solto cai em "explicar",
// que é a resposta honesta e sem efeito colateral.

const PALAVRAS: Record<IntencaoDoTecnico, string[]> = {
  liberar: ["procurar outro clube", "pode sair", "pode procurar", "libero", "liberado", "arrume outro", "arruma outro", "nao conto com voce", "nao conto contigo", "esta liberado", "pode negociar", "vou te emprestar", "emprestimo", "te coloco na lista", "lista de transfer", "melhor voce sair", "seu lugar nao e aqui"],
  prometer: ["vai ser titular", "sera titular", "voce e titular", "voce joga", "vai jogar", "comeca jogando", "escalado", "prometo", "garanto a vaga", "a vaga e sua", "conte com a vaga", "entra no time", "titular na proxima", "vou te escalar"],
  exigir: ["treino", "treinar", "conquist", "merec", "esforc", "empenho", "dedica", "prove", "provar", "mostre", "mostrar", "corre atras", "trabalh", "por conta propria", "ninguem ganha vaga"],
  acolher: ["confio", "confianca em voce", "paciencia", "calma", "seu momento vai chegar", "estou com voce", "conte comigo", "sei do seu valor", "voce e importante", "tranquilo", "nao desanime", "seguro"],
  elogiar: ["parabens", "otimo", "excelente", "muito bom", "gosto do seu", "voce e bom", "qualidade", "melhor do", "orgulho", "grande jogador", "craque"],
  explicar: ["momento do time", "opcao tatica", "tatica", "esquema", "concorrencia", "concorrente", "sistema", "explico", "explicar", "questao de", "hoje o time", "a escolha", "por isso"],
}

/** A ordem de leitura: o que tem consequencia pesada exige palavra clara. */
const ORDEM: IntencaoDoTecnico[] = ["liberar", "prometer", "exigir", "acolher", "elogiar", "explicar"]

function pontos(texto: string, chaves: string[]): number {
  return chaves.reduce((n, k) => (texto.includes(k) ? n + 1 : n), 0)
}

/** A intenção da mensagem, ou null quando não dá para saber. */
export function intencaoDoTexto(texto: string): IntencaoDoTecnico | null {
  const t = semAcento(texto)
  // Negação simples: "você NÃO vai ser titular" não é uma promessa.
  const negado = /\b(nao|jamais|nunca)\b[^.!?]{0,24}(titular|jogar|escalad)/.test(t)
  let melhor: { id: IntencaoDoTecnico; n: number } | null = null
  for (const id of ORDEM) {
    if (id === "prometer" && negado) continue
    const n = pontos(t, PALAVRAS[id])
    if (n > 0 && (!melhor || n > melhor.n)) melhor = { id, n }
  }
  return melhor?.id ?? null
}

/** Quando o atleta não entendeu. */
export const PEDIDO_DE_CLAREZA =
  "Não entendi o que o senhor quis dizer, professor. Fale direto: eu vou ter chance no time, " +
  "preciso conquistar a vaga no treino, ou é melhor eu procurar outro clube?"

/** A abertura do atleta — sai da situação real dele. */
export function aberturaDoAtleta(e: EstadoDoAtleta): string {
  if (e.naListaDeTransferencias) {
    return `Professor, fiquei sabendo que estou na lista. Se for isso mesmo, eu queria ouvir do senhor.`
  }
  if (e.promessasQuebradas > 0) {
    return `Professor, faz ${e.jogosSemJogar} jogos que não começo. O senhor já tinha me falado que eu ia jogar ` +
      `e não aconteceu. Eu preciso saber onde eu estou nessa história.`
  }
  if (e.jogosSemJogar >= 12) {
    return `Professor, são ${e.jogosSemJogar} jogos sem começar. Nessa altura eu já não sei se ainda faço parte ` +
      `dos planos. Prefiro ouvir a verdade.`
  }
  return `Professor, faz ${e.jogosSemJogar} jogos que não começo. Quero saber o que preciso fazer para ser titular. ` +
    `Estou pensando na minha situação aqui.`
}

/** Sugestões clicáveis — atalho para quem não quer digitar. */
export const SUGESTOES: { id: IntencaoDoTecnico; rotulo: string; frase: string }[] = [
  { id: "prometer", rotulo: "Prometer a vaga", frase: "Você vai ser titular na próxima partida." },
  { id: "exigir", rotulo: "Cobrar treino", frase: "A vaga se conquista no treino. Mostre mais e ela é sua." },
  { id: "explicar", rotulo: "Explicar a escolha", frase: "É uma opção tática, você tem concorrência forte na posição." },
  { id: "acolher", rotulo: "Dar confiança", frase: "Confio em você, o seu momento vai chegar." },
  { id: "liberar", rotulo: "Liberar a saída", frase: "Se quiser jogar, pode procurar outro clube." },
]

// ── DESFECHO ─────────────────────────────────────────────────────────────────
//
// A regra que dá peso à conversa: **palavra vale pelo histórico**. Promessa
// cumprida no passado faz a próxima valer; promessa quebrada esvazia o discurso
// e ainda irrita. E paciência tem limite: quem está há 12, 15 jogos no banco não
// se acalma com "conquiste no treino".

/** Moral em número (0 = Infeliz ... 4 = Feliz), para pesar a resposta. */
const ESCALA_DE_MORAL = ["Infeliz", "Insatisfeito", "Normal", "Motivado", "Feliz"]
const nivelDeMoral = (moral: string): number => {
  const i = ESCALA_DE_MORAL.indexOf(moral)
  return i < 0 ? 2 : i
}

export function responderAtleta(intencao: IntencaoDoTecnico, e: EstadoDoAtleta): DesfechoDoAtleta {
  const moral = nivelDeMoral(e.moral)
  const impaciente = e.jogosSemJogar >= 10
  const desconfiado = e.promessasQuebradas > 0
  // Promessa CRÍVEL: ele é páreo para o titular da posição. Prometer vaga a quem
  // está 8 pontos abaixo do concorrente soa a conversa para adiar o problema.
  const crivel = e.concorrencia === 0 || e.overall >= e.concorrencia - 4

  if (intencao === "prometer") {
    if (desconfiado) {
      return {
        resposta: `O senhor já tinha me dito isso, professor. Eu vou pra dentro do campo e a gente vê. ` +
          `Mas essa é a última vez que eu ouço essa conversa.`,
        moralDegraus: 1,
        viraTitular: true,
        registraPromessa: true,
        encerra: true,
      }
    }
    return {
      resposta: crivel
        ? `Isso é tudo o que eu queria ouvir, professor. Pode contar comigo, eu não vou te decepcionar.`
        : `Eu agradeço, professor. Mas o senhor sabe que eu tenho que provar dentro de campo — e eu quero essa chance.`,
      moralDegraus: crivel ? 2 : 1,
      viraTitular: true,
      registraPromessa: true,
      encerra: true,
    }
  }

  if (intencao === "exigir") {
    if (impaciente) {
      return {
        resposta: `Professor, com todo o respeito: eu treino forte há ${e.jogosSemJogar} jogos e não entro. ` +
          `A essa altura não é mais questão de treino.`,
        moralDegraus: -1,
        encerra: true,
      }
    }
    return {
      resposta: `Entendo. Vou trabalhar mais forte no treino para conquistar meu espaço.`,
      moralDegraus: moral <= 1 ? 0 : 1,
      encerra: true,
    }
  }

  if (intencao === "acolher") {
    if (impaciente && desconfiado) {
      return {
        resposta: `Confiança eu tenho, professor. O que eu não tenho é jogo. Palavra bonita não me coloca em campo.`,
        moralDegraus: 0,
        encerra: true,
      }
    }
    return {
      resposta: `Ouvir isso do senhor ajuda. Vou seguir trabalhando e esperar a minha vez.`,
      moralDegraus: impaciente ? 1 : 2,
      encerra: true,
    }
  }

  if (intencao === "elogiar") {
    return {
      resposta: impaciente
        ? `Obrigado, professor. Mas se eu sou tão bom assim, eu queria estar jogando.`
        : `Obrigado, professor. Vou continuar me dedicando para retribuir.`,
      moralDegraus: impaciente ? 0 : 1,
      encerra: true,
    }
  }

  if (intencao === "explicar") {
    // A honestidade é o caminho seguro: rende pouco, mas quase nunca custa.
    // Só o veterano se irrita quando a explicação vira enrolação de novo.
    if (e.idade >= 30 && impaciente) {
      return {
        resposta: `Eu conheço esse discurso, professor. Na minha idade eu não tenho tempo de esperar opção tática.`,
        moralDegraus: -1,
        encerra: true,
      }
    }
    return {
      resposta: `Pelo menos agora eu sei onde estou. Obrigado pela sinceridade, professor.`,
      moralDegraus: 1,
      encerra: true,
    }
  }

  // liberar
  return {
    resposta: e.naListaDeTransferencias
      ? `Então está decidido. Vou conversar com o meu empresário.`
      : `Se é assim, prefiro procurar um clube onde eu jogue. Obrigado pela sinceridade.`,
    moralDegraus: -2,
    vaParaAListaDeTransferencias: true,
    encerra: true,
  }
}
