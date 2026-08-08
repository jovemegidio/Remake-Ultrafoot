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
  // ── INTENÇÕES ACRESCENTADAS (pedido: "eu responder a um jogador 'você não
  // está treinando o suficiente' e ele ter uma resposta pra rebater e afins").
  //
  // Antes tudo que fosse cobrança caía em `exigir`, e `exigir` respondia sempre
  // a mesma coisa. Cobrar TREINO, criticar DESEMPENHO e AMEAÇAR são três falas
  // diferentes, e um atleta real rebate cada uma de um jeito.
  | "criticar"   // desempenho/postura: "está jogando mal", "não está treinando"
  | "ameacar"    // consequência: "vai para o banco", "vou te vender"
  | "perguntar"  // ouvir: "como você está?", "o que está acontecendo?"
  | "renovar"    // contrato: "quero renovar com você"

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

// ⚠️ VOCABULARIO GRANDE DE PROPOSITO. O jogo e offline e nao tem modelo de
// linguagem: entender "qualquer coisa" e, na pratica, ter aqui as palavras que
// uma pessoa REALMENTE usa — incluindo giria, forma falada e prefixo que cobre
// as flexoes ("trein" pega treino, treinando, treinar, treinamento).
const PALAVRAS: Record<IntencaoDoTecnico, string[]> = {
  liberar: ["procurar outro clube", "pode sair", "pode procurar", "libero", "liberado", "arrume outro",
    "arruma outro", "nao conto com voce", "nao conto contigo", "esta liberado", "pode negociar",
    "vou te emprestar", "emprestimo", "te coloco na lista", "lista de transfer", "melhor voce sair",
    "seu lugar nao e aqui", "nao faz parte dos planos", "fora dos planos", "pode ir embora", "ta liberado",
    "arranje outro", "busque outro", "seu ciclo acabou", "seu ciclo aqui", "nao tem mais espaco",
    "vou te dispensar", "dispensad", "nao serve mais"],
  prometer: ["vai ser titular", "sera titular", "voce e titular", "voce joga", "vai jogar", "comeca jogando",
    "escalado", "prometo", "garanto a vaga", "a vaga e sua", "conte com a vaga", "entra no time",
    "titular na proxima", "vou te escalar", "voce comeca", "e seu o lugar", "vaga garantida", "pode se preparar",
    "prepare-se para jogar", "te ponho em campo", "vou te por", "vou te colocar", "proximo jogo voce"],
  exigir: ["trein", "conquist", "merec", "esforc", "empenho", "dedica", "prove", "provar", "mostre", "mostrar",
    "corre atras", "trabalh", "por conta propria", "ninguem ganha vaga", "se dedique", "ralar", "ralando",
    "suar", "sue a camisa", "vai ter que", "tem que correr", "academia", "intensidade", "foco", "disciplina",
    "chegue mais cedo", "faca por onde"],
  acolher: ["confio", "confianca em voce", "paciencia", "calma", "seu momento vai chegar", "estou com voce",
    "conte comigo", "sei do seu valor", "voce e importante", "tranquilo", "nao desanime", "seguro",
    "fique calmo", "sua hora vai chegar", "acredito em voce", "nao se preocupe", "estamos juntos",
    "cabeca erguida", "nao desista", "vai passar", "to contigo", "apoio voce"],
  elogiar: ["parabens", "otimo", "excelente", "muito bom", "gosto do seu", "voce e bom", "qualidade",
    "melhor do", "orgulho", "grande jogador", "craque", "fera", "monstro", "jogou muito", "mandou bem",
    "show", "espetacular", "diferenciado", "decisivo", "importante para o grupo", "referencia"],
  explicar: ["momento do time", "opcao tatica", "tatica", "esquema", "concorrencia", "concorrente", "sistema",
    "explico", "explicar", "questao de", "hoje o time", "a escolha", "por isso", "e o seguinte", "acontece que",
    "a razao", "o motivo", "por que", "porque", "entenda", "e assim", "questao tecnica", "escolha minha",
    "nao e pessoal", "nada contra voce"],
  // ── NOVAS ──────────────────────────────────────────────────────────────
  criticar: ["nao esta trein", "nao treina", "treinando pouco", "treinando mal", "nao se dedica",
    "esta devendo", "ta devendo", "jogando mal", "jogou mal", "rendimento", "caiu de", "abaixo do",
    "decepcion", "fraco", "apagado", "sumiu em campo", "nao corre", "nao ajuda", "relaxad", "acomodad",
    "desligad", "postura", "atitude", "compromisso", "peso", "fora de forma", "condicao fisica",
    "chega atrasado", "indisciplina", "nao esta bem", "esta ruim", "precisa melhorar", "insuficiente",
    "nao e suficiente", "esperava mais"],
  ameacar: ["vai para o banco", "vai pro banco", "fica no banco", "banco de reservas", "vou te vender",
    "te vendo", "vou negociar voce", "perde a vaga", "vai perder", "ultima chance", "ou muda ou",
    "se nao mudar", "consequencia", "vou tomar providencia", "nao vou aceitar", "assim nao da",
    "corto voce", "fica fora", "nem relacionado", "sem relacionar", "multa", "advertencia"],
  perguntar: ["como voce esta", "como esta", "tudo bem", "o que esta acontecendo", "o que houve",
    "algum problema", "quer conversar", "me conta", "como se sente", "como estao as coisas",
    "esta feliz", "esta incomodado", "o que voce acha", "sua opiniao", "quer falar", "escuto voce",
    "estou ouvindo", "desabafa", "o que voce quer"],
  renovar: ["renovar", "renovacao", "novo contrato", "estender", "aumentar seu salario", "aumento",
    "valorizar", "valorizacao", "quero voce aqui", "seguir conosco", "continuar no clube", "mais tempo aqui",
    "assinar", "proposta de contrato", "melhorar seu contrato", "reajuste"],
}

/** A ordem de leitura: o que tem consequencia pesada exige palavra clara. */
// A ordem importa: o que tem consequencia pesada exige palavra clara e e lido
// primeiro. `criticar` vem ANTES de `exigir` porque "voce nao esta treinando" e
// critica, nao cobranca — e a resposta do atleta e outra.
const ORDEM: IntencaoDoTecnico[] = [
  "liberar", "ameacar", "prometer", "renovar", "criticar", "exigir", "perguntar", "acolher", "elogiar", "explicar",
]

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

  // ── CRITICAR: ele REBATE, e o argumento sai da situacao real dele ────────
  //
  // O pedido era exatamente este: dizer "voce nao esta treinando o suficiente" e
  // ouvir uma resposta a altura. Quem treina ha 12 jogos sem entrar nao aceita
  // essa critica calado; quem esta de moral alta e joga responde diferente de
  // quem ja desistiu. `encerra: false` mantem a conversa aberta — critica pede
  // reposta, e resposta pede treplica.
  if (intencao === "criticar") {
    if (impaciente && desconfiado) {
      return {
        resposta: `Professor, o senhor me cobra dedicação, mas eu não entro há ${e.jogosSemJogar} jogos ` +
          `e já ouvi promessa que não valeu. Fica difícil ouvir que o problema sou eu.`,
        moralDegraus: -2,
        encerra: false,
      }
    }
    if (impaciente) {
      return {
        resposta: `Eu chego cedo e saio tarde do treino, professor. Se o senhor acha que estou devendo, ` +
          `me põe em campo e cobra de mim lá dentro — no treino eu já mostrei o que sei fazer.`,
        moralDegraus: -1,
        encerra: false,
      }
    }
    if (moral >= 3) {
      return {
        resposta: `Recebo a crítica, professor. Se o senhor viu algo que não está bom, me diz o que é ` +
          `que eu corrijo — não vim aqui para brigar.`,
        moralDegraus: 0,
        encerra: false,
      }
    }
    if (e.idade >= 31) {
      return {
        resposta: `Eu tenho ${e.idade} anos, professor, não tenho mais o que provar em treino. ` +
          `O que eu preciso é de ritmo de jogo, e isso o senhor é quem me dá.`,
        moralDegraus: -1,
        encerra: false,
      }
    }
    return {
      resposta: `Se está faltando alguma coisa da minha parte, eu quero saber qual é. ` +
        `Me aponta e eu trabalho nisso.`,
      moralDegraus: -1,
      encerra: false,
    }
  }

  // ── AMEACAR: funciona com quem tem o que perder; com quem ja perdeu, nao ──
  if (intencao === "ameacar") {
    if (impaciente || e.naListaDeTransferencias) {
      return {
        resposta: `Banco eu já conheço, professor — estou nele há ${e.jogosSemJogar} jogos. ` +
          `Se a ideia é me pressionar, o senhor está ameaçando com o que eu já vivo.`,
        moralDegraus: -2,
        encerra: false,
      }
    }
    if (moral >= 3) {
      return {
        resposta: `Não precisa chegar a esse ponto, professor. Se tem algo errado, me fala e eu resolvo.`,
        moralDegraus: -1,
        encerra: false,
      }
    }
    return {
      resposta: `Entendi o recado. Vou mostrar em campo que o senhor não precisa disso comigo.`,
      moralDegraus: -1,
      encerra: false,
    }
  }

  // ── PERGUNTAR: ouvir custa nada e quase sempre rende ─────────────────────
  if (intencao === "perguntar") {
    if (e.naListaDeTransferencias) {
      return {
        resposta: `Sinceramente? Estou na lista, professor. Fico mais tranquilo sabendo o que vai ser de mim.`,
        moralDegraus: 0,
        encerra: false,
      }
    }
    if (impaciente) {
      return {
        resposta: `Estou incomodado, professor — e acho que o senhor sabe por quê. ${e.jogosSemJogar} jogos ` +
          `sem entrar pesa na cabeça de qualquer um.`,
        moralDegraus: 1,
        encerra: false,
      }
    }
    return {
      resposta: `Estou bem, professor. Trabalhando e esperando a oportunidade. Obrigado por perguntar.`,
      moralDegraus: 1,
      encerra: false,
    }
  }

  // ── RENOVAR: sinal forte de valorizacao ──────────────────────────────────
  if (intencao === "renovar") {
    if (impaciente) {
      return {
        resposta: `Renovar eu quero, professor. Mas contrato novo sem jogo não resolve o meu problema — ` +
          `eu preciso é entrar em campo.`,
        moralDegraus: 1,
        encerra: false,
      }
    }
    return {
      resposta: `Isso é um reconhecimento e tanto, professor. Pode falar com o meu empresário que eu quero ficar.`,
      moralDegraus: 2,
      encerra: false,
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
