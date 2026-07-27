// CONVERSA REAL com o jogador (estilo FM/EA FC): em vez de 4 botões genéricos com
// delta fixo, a conversa é CONTEXTUAL. O jogo lê a situação do atleta (tempo de
// jogo, forma, moral, idade/liderança) e o jogador ABRE com uma postura; você
// escolhe o TOM da resposta e o desfecho depende do tema + humor + personalidade.
// Há um "melhor caminho" por situação (acolher quem está mal, elogiar quem vai
// bem, ser honesto com o reserva) e respostas erradas custam moral.

export type ConvMood = "happy" | "neutral" | "unhappy"
export type ConvTone = "acolher" | "motivar" | "elogiar" | "prometer" | "honesto" | "firmeza" | "responsabilidade"

export interface ConvChoice {
  id: ConvTone
  /** O que o TÉCNICO diz. */
  label: string
}

export interface Conversation {
  topicId: string
  topicLabel: string
  /** Fala de abertura do JOGADOR (a postura dele). */
  opening: string
  mood: ConvMood
  choices: ConvChoice[]
}

export interface ConvOutcome {
  moraleChange: number
  /** Resposta do jogador ao seu tom. */
  reaction: string
  positive: boolean
}

export interface PlayerConvCtx {
  name: string
  age?: number
  morale?: string
  form?: number
  isStarter?: boolean
  lastRating?: number
  persona?: string
}

const primeiroNome = (n: string) => (n || "Jogador").split(" ")[0]

function moodDe(morale?: string): ConvMood {
  if (morale === "Feliz" || morale === "Motivado") return "happy"
  if (morale === "Insatisfeito" || morale === "Infeliz") return "unhappy"
  return "neutral"
}

/** Personalidade "difícil" (temperamental/explosivo) reage pior a pressão. */
function temperamental(persona?: string): boolean {
  const p = (persona || "").toLowerCase()
  return /explos|temperament|polêmic|polemic|rebelde|individual|estrela|egoc/.test(p)
}
/** Personalidade de liderança/profissional aceita cobrança honesta e responsabilidade. */
function lider(persona?: string): boolean {
  const p = (persona || "").toLowerCase()
  return /líder|lider|capit|profiss|determin|mentor|veterano/.test(p)
}

// ── MONTAGEM DA CONVERSA ──────────────────────────────────────────────────────
export function buildConversation(p: PlayerConvCtx): Conversation {
  const nome = primeiroNome(p.name)
  const mood = moodDe(p.morale)
  const form = p.form ?? 60
  const rating = p.lastRating
  const idade = p.age ?? 25

  // Reserva incomodado quer jogar (tema mais comum e sensível).
  if (p.isStarter === false && mood !== "happy") {
    return {
      topicId: "tempo_de_jogo", topicLabel: "Tempo de jogo", mood,
      opening: `Treinador, eu queria mais oportunidades. Sinto que estou pronto e não estou tendo chances de mostrar meu valor.`,
      choices: [
        { id: "prometer", label: `Você terá sua chance nos próximos jogos, ${nome}.` },
        { id: "honesto", label: `A vaga se conquista no treino. Mostre mais e ela é sua.` },
        { id: "firmeza", label: `As escolhas de escalação são minhas. Respeite o grupo.` },
      ],
    }
  }
  // Boa fase / confiança.
  if (mood === "happy" && ((rating ?? 0) >= 7.5 || form >= 75)) {
    return {
      topicId: "boa_fase", topicLabel: "Boa fase", mood,
      opening: `Estou me sentindo muito bem em campo, treinador. Confiante para ajudar o time.`,
      choices: [
        { id: "elogiar", label: `Você está decisivo, ${nome}. Continue nesse nível.` },
        { id: "firmeza", label: `Ótimo — mas não relaxe. O próximo jogo é o mais importante.` },
        { id: "motivar", label: `Quero ainda mais de você. Você pode ser o nosso diferencial.` },
      ],
    }
  }
  // Má fase / rendimento em queda.
  if ((rating != null && rating < 6.5) || form < 45) {
    return {
      topicId: "ma_fase", topicLabel: "Fase ruim", mood,
      opening: `Sei que não estou no meu melhor momento, treinador. Isso está me incomodando.`,
      choices: [
        { id: "acolher", label: `Confio em você, ${nome}. Sua qualidade vai voltar a aparecer.` },
        { id: "motivar", label: `Vire o jogo no treino. Você é melhor do que tem mostrado.` },
        { id: "firmeza", label: `Precisa reagir. O time depende do seu rendimento.` },
      ],
    }
  }
  // Veterano / liderança.
  if (idade >= 30) {
    return {
      topicId: "lideranca", topicLabel: "Liderança", mood,
      opening: `Treinador, o que você precisa de mim para ajudar o grupo?`,
      choices: [
        { id: "responsabilidade", label: `Preciso de você liderando o vestiário, ${nome}.` },
        { id: "elogiar", label: `Sua experiência é fundamental para os mais novos.` },
        { id: "motivar", label: `Quero você dando o exemplo dentro e fora de campo.` },
      ],
    }
  }
  // Check-in geral.
  return {
    topicId: "geral", topicLabel: "Conversa", mood,
    opening: `Tudo certo, treinador. Focado no trabalho e à disposição.`,
    choices: [
      { id: "elogiar", label: `Gosto da sua postura, ${nome}. Siga assim.` },
      { id: "motivar", label: `Quero você buscando evoluir a cada treino.` },
      { id: "honesto", label: `Vou ser direto sobre o que espero de você.` },
    ],
  }
}

// ── DESFECHO ──────────────────────────────────────────────────────────────────
// Base por tom × humor (o mesmo tom rende diferente conforme o humor). Depois um
// ajuste por TEMA (o tom "certo" para a situação) e por PERSONALIDADE.
const BASE: Record<ConvTone, Record<ConvMood, number>> = {
  acolher:          { happy: 2, neutral: 3, unhappy: 6 },
  motivar:          { happy: 2, neutral: 4, unhappy: 4 },
  elogiar:          { happy: 5, neutral: 2, unhappy: 1 },
  prometer:         { happy: 3, neutral: 4, unhappy: 5 },
  honesto:          { happy: 2, neutral: 2, unhappy: 1 },
  firmeza:          { happy: 0, neutral: -1, unhappy: -3 },
  responsabilidade: { happy: 4, neutral: 4, unhappy: 3 },
}

// Bônus/penalidade do TOM ideal para cada TEMA (o "acerto de leitura").
const TEMA_FIT: Record<string, Partial<Record<ConvTone, number>>> = {
  tempo_de_jogo: { prometer: +2, honesto: +2, firmeza: -1 },   // prometer agrada JÁ; honesto é justo; firmeza custa
  boa_fase:      { elogiar: +2, motivar: +1, firmeza: 0 },
  ma_fase:       { acolher: +2, motivar: +1, firmeza: -2 },     // pressão em quem está mal = pior
  lideranca:     { responsabilidade: +3, elogiar: +1 },
  geral:         { elogiar: +1, motivar: +1, honesto: 0 },
}

export function resolveChoice(p: PlayerConvCtx, conv: Conversation, tone: ConvTone): ConvOutcome {
  const nome = primeiroNome(p.name)
  let delta = BASE[tone]?.[conv.mood] ?? 0
  delta += TEMA_FIT[conv.topicId]?.[tone] ?? 0

  // Personalidade: temperamental odeia firmeza/pressão e desconfia de promessa
  // vazia; líder/profissional valoriza honestidade e responsabilidade.
  if (temperamental(p.persona)) {
    if (tone === "firmeza") delta -= 2
    if (tone === "honesto") delta -= 1
    if (tone === "elogiar") delta += 1
  }
  if (lider(p.persona)) {
    if (tone === "responsabilidade" || tone === "honesto") delta += 2
    if (tone === "firmeza") delta += 1 // encara bem a cobrança direta
  }

  const positive = delta > 0
  const reaction = reacao(conv.topicId, tone, positive, nome)
  return { moraleChange: delta, reaction, positive }
}

function reacao(topic: string, tone: ConvTone, positive: boolean, nome: string): string {
  if (tone === "prometer") return positive
    ? `${nome} sai animado — mas agora espera as chances que você prometeu.`
    : `${nome} ouve a promessa com desconfiança; já ouviu isso antes.`
  if (tone === "firmeza") return positive
    ? `${nome} aceita a posição e reafirma o compromisso com o grupo.`
    : `${nome} se fecha e sai contrariado com a cobrança.`
  if (tone === "acolher") return positive
    ? `${nome} agradece a confiança e promete dar a volta por cima.`
    : `${nome} agradece, mas segue abatido.`
  if (tone === "responsabilidade") return positive
    ? `${nome} veste a braçadeira simbólica e assume o papel de liderança.`
    : `${nome} pondera se é o momento de assumir isso.`
  if (tone === "elogiar") return positive
    ? `${nome} sorri e se mostra ainda mais motivado.`
    : `${nome} recebe o elogio, mas queria mais do que palavras.`
  if (tone === "honesto") return positive
    ? `${nome} concorda: sabe o que precisa fazer para melhorar.`
    : `${nome} não gosta muito da franqueza, mas entende o recado.`
  return positive
    ? `${nome} responde bem à conversa e sai motivado.`
    : `${nome} não reage como você esperava.`
}
