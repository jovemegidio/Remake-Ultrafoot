// A TORCIDA: quantos são, quantos pagam e quem manda na arquibancada.
//
// O que já existia e continua valendo: `state.fanBase` (número de torcedores,
// semeado de `Team.torcida`, que traz números reais por clube) e
// `fanBaseGrowth` em stadium-economy, que mexe nesse número a cada jogo em casa
// conforme resultado, ocupação e preço do ingresso.
//
// O que FALTAVA — e é o que este módulo entrega:
//
//   1. TÍTULO NÃO MOVIA A TORCIDA. Só jogo em casa mexia, e pouco. Dava para
//      ganhar a Libertadores e a torcida não sentir. É o oposto do que se quer
//      de uma carreira longa: passar anos, ganhar coisa e VER a torcida crescer.
//   2. SÓCIO TORCEDOR não existia no caminho vivo. Havia uma interface `FanBase`
//      e um `calculateFanRevenue` no game-engine com ZERO chamadores — nenhum
//      real pingava no caixa por sócio.
//   3. TORCIDA ORGANIZADA não existia em lugar nenhum, embora o jogo já tenha o
//      evento `torcida_briga` e o cargo `chefe_seguranca` que o mitiga.
//
// Os números foram calibrados contra a realidade do futebol brasileiro: clube
// grande tem dezenas de milhões de torcedores e ~100-150 mil sócios; clube
// pequeno tem centenas de milhares de torcedores e alguns milhares de sócios.

// ─── Torcedores ───────────────────────────────────────────────────────────────

/** O que aconteceu na temporada que move a massa de torcedores. */
export type ConquistaDaTemporada =
  | "titulo_continental"   // Libertadores / Champions
  | "titulo_nacional"      // Série A, Copa do Brasil
  | "titulo_estadual"
  | "acesso"               // subiu de divisão
  | "rebaixamento"
  | "vice_nacional"
  | "temporada_fraca"      // terminou na parte de baixo sem nada

/**
 * Quanto cada feito move a torcida, em fração do total.
 *
 * Assimetria proposital: rebaixamento dói mais do que um título soma. Torcedor
 * de ocasião some rápido quando o time cai, e volta devagar — é o que se vê na
 * vida real, e é o que faz a reconstrução ter peso.
 */
const IMPACTO: Record<ConquistaDaTemporada, number> = {
  titulo_continental: 0.055,
  titulo_nacional: 0.035,
  titulo_estadual: 0.006,
  acesso: 0.06,
  rebaixamento: -0.09,
  vice_nacional: 0.012,
  temporada_fraca: -0.015,
}

/**
 * Aplica os feitos da temporada sobre a torcida.
 *
 * O ganho é AMORTECIDO pelo tamanho: é muito mais fácil um clube de 500 mil
 * torcedores dobrar do que um de 25 milhões crescer 5%. Sem isso, um clube
 * grande vencedor viraria bola de neve até ter mais torcedores que o país.
 */
export function torcidaAposTemporada(
  torcidaAtual: number,
  conquistas: ConquistaDaTemporada[],
): { torcida: number; variacao: number } {
  const base = Math.max(1_000, torcidaAtual)
  let fator = 0
  for (const c of conquistas) fator += IMPACTO[c] ?? 0

  // Teto de saturação: acima de ~20 milhões o crescimento fica cada vez mais
  // difícil (o clube já tem quem havia para ter).
  const saturacao = fator > 0 ? Math.max(0.25, 1 - base / 40_000_000) : 1
  const variacao = Math.round(base * fator * saturacao)
  return { torcida: Math.max(1_000, base + variacao), variacao }
}

// ─── Sócio torcedor ───────────────────────────────────────────────────────────

export type PlanoDeSocio = "basico" | "padrao" | "premium"

export interface PlanoInfo {
  id: PlanoDeSocio
  nome: string
  mensalidade: number
  /** Multiplica a adesão: quanto mais caro, menos gente assina. */
  atratividade: number
  descricao: string
}

export const PLANOS_DE_SOCIO: PlanoInfo[] = [
  {
    id: "basico", nome: "Sócio Torcedor", mensalidade: 30, atratividade: 1.35,
    descricao: "Desconto no ingresso e prioridade na fila. Barato, adere muita gente.",
  },
  {
    id: "padrao", nome: "Sócio Fiel", mensalidade: 60, atratividade: 1,
    descricao: "Cadeira garantida nos jogos em casa. O plano de referência.",
  },
  {
    id: "premium", nome: "Sócio Camisa 12", mensalidade: 130, atratividade: 0.55,
    descricao: "Cadeira cativa, prioridade em final e acesso ao CT. Poucos, mas rendem muito.",
  },
]

export const PLANO_POR_ID = Object.fromEntries(PLANOS_DE_SOCIO.map(p => [p.id, p])) as Record<PlanoDeSocio, PlanoInfo>

export interface QuadroDeSocios {
  socios: number
  mensalidade: number
  receitaMensal: number
  /** Quantos por cento da torcida viraram sócios. */
  adesao: number
}

/**
 * Quantos torcedores viram sócios.
 *
 * A taxa de conversão real no Brasil fica na casa de 0,3% a 1,5% da torcida —
 * clubes do Sul convertem mais, clube gigante converte proporcionalmente menos
 * (tem torcedor demais espalhado pelo país para caber no estádio).
 *
 * `satisfacao` (0-100) é o humor da torcida: time ganhando enche o quadro
 * social, time ruim esvazia. É essa ligação que faz o sócio "acompanhar" a
 * carreira em vez de ser um número parado.
 */
export function quadroDeSocios(input: {
  torcida: number
  satisfacao: number
  plano: PlanoDeSocio
  /** 1-5. Estrutura melhor (estádio, marketing) sustenta mais sócio. */
  nivelMarketing?: number
}): QuadroDeSocios {
  const { torcida, satisfacao, plano } = input
  const info = PLANO_POR_ID[plano] ?? PLANO_POR_ID.padrao
  const marketing = Math.max(1, Math.min(5, input.nivelMarketing ?? 2))

  // CALIBRAGEM. O ponto de referência é satisfação 60, plano padrão, marketing
  // nível 2 — nesse ponto os números caem em cima da realidade brasileira:
  // Flamengo ~129 mil sócios, Grêmio ~88 mil, Chapecoense ~5,6 mil.
  //
  // A diluição existe porque torcida gigante é NACIONAL: o torcedor de Flamengo
  // em Manaus não vira sócio para pegar cadeira no Maracanã. Por isso o clube
  // gigante converte proporcionalmente MENOS (~0,46%) que o clube médio do Sul
  // (~1,2%), que é exatamente o que se vê nos números reais.
  const diluicao = Math.max(0.33, 1 - Math.max(0, torcida - 1_000_000) / 40_000_000)
  // Ancorado em 60: acima disso o quadro engorda, abaixo esvazia.
  const humor = Math.max(0.35, Math.min(1.5, 1 + (satisfacao - 60) * 0.014))
  const taxa = 0.014 * diluicao * humor * info.atratividade * (0.86 + marketing * 0.07)

  // Teto de sanidade: nem o clube mais apaixonado transforma 3% da torcida em
  // sócio pagante.
  const socios = Math.max(50, Math.round(torcida * Math.min(0.03, taxa)))
  return {
    socios,
    mensalidade: info.mensalidade,
    receitaMensal: socios * info.mensalidade,
    adesao: torcida > 0 ? (socios / torcida) * 100 : 0,
  }
}

// ─── Torcidas organizadas ─────────────────────────────────────────────────────

export interface Organizada {
  id: string
  nome: string
  membros: number
  /** -100 (revoltada) a +100 (em festa). */
  humor: number
  /** Quanto ela puxa o coro: soma na pressão do estádio em jogo da casa. */
  influencia: number
}

const PREFIXOS = ["Mancha", "Força", "Gaviões", "Império", "Camisa", "Raça", "Fúria", "Dragões", "Leões", "Trincheira", "Setor", "Guerreiros"]
const SUFIXOS = ["Jovem", "Independente", "Alviverde", "Rubro-Negra", "Tricolor", "Alvinegra", "do Norte", "Popular", "Fanáticos", "12", "Sul", "Vermelha"]

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/**
 * As organizadas de um clube. Determinístico pelo clube: os nomes não podem
 * mudar a cada vez que a tela abre — é gente que o técnico vai reconhecer ao
 * longo da carreira.
 *
 * Clube grande tem mais organizadas e maiores, mas o número de membros é uma
 * fração pequena da torcida: organizada é minoria barulhenta, não a massa.
 */
export function organizadasDoClube(clubeCurto: string, torcida: number): Organizada[] {
  const rnd = mulberry32(hash(`${clubeCurto}:organizadas`))
  const quantas = torcida > 10_000_000 ? 4 : torcida > 2_000_000 ? 3 : 2
  const usados = new Set<string>()

  return Array.from({ length: quantas }, (_, i) => {
    let nome = ""
    // Evita duas organizadas com o mesmo nome no mesmo clube.
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      const candidato = `${PREFIXOS[Math.floor(rnd() * PREFIXOS.length)]} ${SUFIXOS[Math.floor(rnd() * SUFIXOS.length)]}`
      if (!usados.has(candidato)) { nome = candidato; break }
    }
    if (!nome) nome = `Organizada ${i + 1}`
    usados.add(nome)

    // A primeira é sempre a maior — é assim que se organiza uma arquibancada.
    //
    // A mesma diluição do quadro social vale aqui, e por um motivo mais forte:
    // organizada é gente que VAI AO ESTÁDIO. Sem isso, um clube de 28 milhões
    // ganhava uma organizada de 400 mil membros — a maior do Brasil de verdade
    // tem ~100 mil. Com a diluição, a maior de um gigante fica na casa das
    // dezenas de milhares, que é a escala certa.
    const diluicao = Math.max(0.33, 1 - Math.max(0, torcida - 1_000_000) / 40_000_000)
    const parcela = (i === 0 ? 0.006 : 0.002) * (0.7 + rnd() * 0.6) * diluicao
    return {
      id: `${clubeCurto}_org_${i}`,
      nome,
      membros: Math.max(300, Math.round(torcida * parcela)),
      humor: 0,
      influencia: Math.round((i === 0 ? 6 : 3) * (0.7 + rnd() * 0.6)),
    }
  })
}

/**
 * Reage ao que aconteceu. Organizada é mais volátil que o torcedor comum: sobe
 * rápido com título e desaba rápido com sequência ruim.
 */
export function humorDasOrganizadas(
  organizadas: Organizada[],
  evento: { vitorias: number; derrotas: number; conquistas?: ConquistaDaTemporada[] },
): Organizada[] {
  let delta = evento.vitorias * 6 - evento.derrotas * 9
  for (const c of evento.conquistas ?? []) {
    if (c === "titulo_continental") delta += 60
    else if (c === "titulo_nacional") delta += 45
    else if (c === "titulo_estadual") delta += 12
    else if (c === "acesso") delta += 35
    else if (c === "rebaixamento") delta -= 70
    else if (c === "temporada_fraca") delta -= 20
  }
  return organizadas.map(o => ({
    ...o,
    humor: Math.max(-100, Math.min(100, o.humor + delta)),
  }))
}

/**
 * Satisfação da torcida (0-100) derivada do humor das organizadas.
 *
 * DERIVADA de propósito, em vez de virar mais um campo de estado para manter em
 * sincronia: a arquibancada organizada é o termômetro do resto da torcida, e um
 * segundo número guardado à parte inevitavelmente discordaria dela.
 */
export function satisfacaoDaTorcida(organizadas: Organizada[]): number {
  if (!organizadas.length) return 55
  const medio = organizadas.reduce((t, o) => t + o.humor, 0) / organizadas.length
  return Math.max(0, Math.min(100, Math.round(55 + medio * 0.45)))
}

/**
 * Empurrão das organizadas na pressão do estádio em jogo da casa.
 *
 * Revoltada NÃO vira torcida adversária: ela cala, vaia e o time joga pior em
 * casa — que é o efeito real de uma arquibancada contra.
 */
export function pressaoDasOrganizadas(organizadas: Organizada[]): number {
  if (!organizadas.length) return 0
  const soma = organizadas.reduce((t, o) => t + o.influencia * (o.humor / 100), 0)
  return Math.round(Math.max(-12, Math.min(12, soma)))
}

export interface RiscoDeConfusao {
  /** 0-1. Quem chama decide se sorteia. */
  chance: number
  motivo: string
}

/**
 * Risco de confusão com organizada. Alimenta o evento `torcida_briga` que o
 * game-engine já tem — e que o `chefe_seguranca` já reduz em 60%.
 */
export function riscoDeConfusao(
  organizadas: Organizada[],
  temChefeDeSeguranca: boolean,
): RiscoDeConfusao {
  const revoltadas = organizadas.filter(o => o.humor <= -45)
  if (!revoltadas.length) return { chance: 0, motivo: "" }
  const bruto = Math.min(0.25, revoltadas.length * 0.05 + revoltadas.reduce((t, o) => t + Math.abs(o.humor), 0) / 2500)
  return {
    chance: temChefeDeSeguranca ? bruto * 0.4 : bruto,
    motivo: `${revoltadas.map(o => o.nome).join(", ")} ${revoltadas.length === 1 ? "está revoltada" : "estão revoltadas"} com o time.`,
  }
}

// ─── Retrato completo ─────────────────────────────────────────────────────────

export interface RetratoDaTorcida {
  torcedores: number
  quadro: QuadroDeSocios
  organizadas: Organizada[]
  pressao: number
  clima: "em festa" | "confiante" | "apreensiva" | "revoltada"
}

export function retratoDaTorcida(input: {
  clubeCurto: string
  torcida: number
  satisfacao: number
  plano: PlanoDeSocio
  nivelMarketing?: number
  organizadas?: Organizada[]
}): RetratoDaTorcida {
  const organizadas = input.organizadas?.length
    ? input.organizadas
    : organizadasDoClube(input.clubeCurto, input.torcida)
  const humorMedio = organizadas.reduce((t, o) => t + o.humor, 0) / Math.max(1, organizadas.length)
  return {
    torcedores: input.torcida,
    quadro: quadroDeSocios({
      torcida: input.torcida,
      satisfacao: input.satisfacao,
      plano: input.plano,
      nivelMarketing: input.nivelMarketing,
    }),
    organizadas,
    pressao: pressaoDasOrganizadas(organizadas),
    clima:
      humorMedio >= 45 ? "em festa"
      : humorMedio >= 0 ? "confiante"
      : humorMedio >= -45 ? "apreensiva"
      : "revoltada",
  }
}
