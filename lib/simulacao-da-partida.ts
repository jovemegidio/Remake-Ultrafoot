// O PLACAR DE UMA PARTIDA SIMULADA — e POR QUE ele saiu assim.
//
// ⚠️ O QUE ISTO CORRIGE, e é grave: até aqui, a partida resolvida sem o jogador
// em campo saía do PRESTÍGIO DO CLUBE e de mais nada.
//
//     const homeStrength = homeTeam.prestigio + 5
//     const homeExpectedGoals = 1.3 + (homeChance * 1.5)
//
// Elenco, escalação, forma, moral e tática não entravam na conta. Ou seja: quem
// simulava a própria partida — e o jogo oferece esse caminho — jogava com o
// escudo, não com o time. Contratar um craque, escalar melhor ou mudar o plano
// não mudava nada no resultado.
//
// É exatamente o defeito que o co-op já tinha barrado do outro lado: o
// adversário humano não pode entrar como CPU medido por prestígio, senão "o
// elenco que a outra pessoa montou não vale nada no placar" (ver
// `lib/forca-do-plantel.ts`). O mesmo vale para o próprio jogador.
//
// ── O que este módulo faz, e o que NÃO faz ──────────────────────────────────
//
// Ele NÃO é um motor de partida: não simula jogadas, posicionamento nem bola. É
// uma resolução por SETORES — meu ataque contra a defesa dele, o meio contra o
// meio — que produz um placar plausível E a conta que o gerou.
//
// A conta importa tanto quanto o placar. Hoje o jogador perde e não tem como
// saber por quê; devolver "seu meio-campo foi dominado por 9 pontos" é a
// leitura que o 3D não dá, porque o 3D encena um resultado já decidido.
//
// Módulo PURO: sem React, sem store, sem acesso a dados do jogo.

/** Força de um lado, por setor. Escala de overall (0-100). */
export interface ForcaPorSetor {
  ataque: number
  meio: number
  defesa: number
}

export interface LadoDaSimulacao {
  forca: ForcaPorSetor
  /** Mando de campo. Só um dos lados deve tê-lo. */
  mandante?: boolean
  /**
   * Ajuste do plano tático, já limitado pelo teto do jogo (`TETO_TATICO`).
   * Positivo ajuda, negativo atrapalha. Quem calcula é `lib/forcas-taticas.ts`.
   */
  tatica?: Partial<ForcaPorSetor>
}

/** Um setor comparado com o setor que o enfrenta. */
export interface DueloDeSetor {
  setor: "ataque" | "meio" | "defesa"
  /** Nosso valor já com tática e mando. */
  nosso: number
  /** O valor que nos enfrenta (defesa deles contra nosso ataque, etc.). */
  deles: number
  /** `nosso - deles`. Positivo = vantagem nossa. */
  saldo: number
}

export interface PlacarExplicado {
  golsMandante: number
  golsVisitante: number
  /** Duelos do ponto de vista do MANDANTE. */
  duelos: DueloDeSetor[]
  /** Frases curtas do que decidiu a partida, do mais forte para o mais fraco. */
  porQue: string[]
}

/**
 * MANDO DE CAMPO. Mantido em +5 de propósito: é o valor que o cálculo antigo
 * usava, e mudá-lo junto com o resto tornaria impossível saber qual das duas
 * mudanças moveu a balança.
 */
const MANDO = 5

/**
 * Quanto um ponto de vantagem no setor vale em gol esperado.
 *
 * ⚠️ COMPRIMIDO DE PROPÓSITO. A calibração deste jogo transforma força em
 * probabilidade de forma comprimida — uma diferença de 10 de overall não pode
 * virar goleada, senão o elenco passa a decidir tudo e o futebol some. Com
 * 0.035, dez pontos de vantagem no ataque valem ~0.35 gol esperado, que é a
 * ordem de grandeza certa para um jogo de 90 minutos.
 */
const GOL_POR_PONTO = 0.035

/** Gols esperados de um time médio contra um time médio. */
const BASE_ESPERADA = 1.25

function comTatica(forca: ForcaPorSetor, tatica?: Partial<ForcaPorSetor>): ForcaPorSetor {
  return {
    ataque: forca.ataque + (tatica?.ataque ?? 0),
    meio: forca.meio + (tatica?.meio ?? 0),
    defesa: forca.defesa + (tatica?.defesa ?? 0),
  }
}

/**
 * Os três duelos, do ponto de vista do mandante.
 *
 * O ataque encara a DEFESA do outro; o meio encara o meio. É a comparação que
 * um técnico faz olhando a escalação, e é a que a explicação precisa devolver.
 */
export function duelosDaPartida(mandante: LadoDaSimulacao, visitante: LadoDaSimulacao): DueloDeSetor[] {
  const casa = comTatica(mandante.forca, mandante.tatica)
  const fora = comTatica(visitante.forca, visitante.tatica)
  // ⚠️ O MANDO NÃO ENTRA AQUI, e a distinção é o ponto do módulo.
  //
  // Os duelos comparam TIME contra TIME — elenco e plano —, porque é isso que a
  // explicação precisa devolver e é sobre isso que o técnico pode agir. Somando
  // o mando aqui, dois elencos idênticos apareciam com "+5 de vantagem" nos três
  // setores, e a tela dizia que o mandante dominou uma partida em que os times
  // eram iguais. O mando é um empurrão da PARTIDA, e entra no placar à parte.
  return [
    { setor: "ataque", nosso: casa.ataque, deles: fora.defesa, saldo: casa.ataque - fora.defesa },
    { setor: "meio", nosso: casa.meio, deles: fora.meio, saldo: casa.meio - fora.meio },
    { setor: "defesa", nosso: casa.defesa, deles: fora.ataque, saldo: casa.defesa - fora.ataque },
  ]
}

/**
 * Sorteio determinístico por semente.
 *
 * ⚠️ `Math.random()` não serve aqui. O placar precisa ser o MESMO toda vez que a
 * mesma partida for resolvida — o jogo recalcula rodadas em mais de um caminho,
 * e um placar que muda a cada leitura faz a tabela discordar do histórico.
 * (Os goleadores já eram sorteados por semente pelo mesmo motivo.)
 */
function sorteioDaSemente(semente: string): () => number {
  let h = 2166136261
  for (let i = 0; i < semente.length; i++) {
    h ^= semente.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Gols a partir do esperado, por Poisson. Teto de 6 evita placar de circo. */
function golsPorPoisson(esperado: number, aleatorio: () => number): number {
  const lambda = Math.max(0.15, esperado)
  const limite = Math.exp(-lambda)
  let n = 0
  let p = 1
  do {
    n++
    p *= aleatorio()
  } while (p > limite && n < 8)
  return Math.min(6, n - 1)
}

const NOME_DO_SETOR: Record<DueloDeSetor["setor"], string> = {
  ataque: "ataque",
  meio: "meio-campo",
  defesa: "defesa",
}

/**
 * Frases do que decidiu a partida, do desequilíbrio maior para o menor.
 *
 * Só entra o que foi DECISIVO (|saldo| >= 3). Listar um duelo equilibrado como
 * causa seria ruído: o jogador leria três frases e não saberia em qual mexer.
 */
function explicar(duelos: DueloDeSetor[], ladoDoTexto: "mandante" | "visitante"): string[] {
  const sinal = ladoDoTexto === "mandante" ? 1 : -1
  return duelos
    .map(d => ({ ...d, saldo: d.saldo * sinal }))
    .filter(d => Math.abs(d.saldo) >= 3)
    .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo))
    .map(d => {
      const p = Math.round(Math.abs(d.saldo))
      if (d.setor === "defesa") {
        return d.saldo > 0
          ? `Sua defesa segurou o ataque deles (vantagem de ${p}).`
          : `O ataque deles passou por cima da sua defesa (desvantagem de ${p}).`
      }
      return d.saldo > 0
        ? `Seu ${NOME_DO_SETOR[d.setor]} levou vantagem de ${p}.`
        : `Seu ${NOME_DO_SETOR[d.setor]} foi dominado por ${p}.`
    })
}

/**
 * Resolve a partida e devolve o placar COM a conta que o gerou.
 *
 * `semente` precisa identificar a partida (clubes + temporada + rodada), para o
 * mesmo jogo dar sempre o mesmo resultado.
 */
export function simularPartida(
  mandante: LadoDaSimulacao,
  visitante: LadoDaSimulacao,
  semente: string,
  /** De quem é a explicação. O placar não muda; o texto, sim. */
  ladoDoTexto: "mandante" | "visitante" = "mandante",
): PlacarExplicado {
  const duelos = duelosDaPartida(mandante, visitante)
  const aleatorio = sorteioDaSemente(semente)

  // O meio-campo pesa nos DOIS lados: quem domina o meio ataca mais e sofre
  // menos. Por isso ele entra com metade do peso em cada conta, em vez de virar
  // um quarto gol esperado que ninguém consegue explicar.
  const ataque = duelos[0].saldo
  const meio = duelos[1].saldo
  const defesa = duelos[2].saldo
  // O mando entra AQUI, uma vez só, e não dentro dos duelos — ver
  // `duelosDaPartida`. Vale como empurrão no gol esperado do mandante e alívio
  // no do visitante, que é o efeito que ele tem de verdade.
  const mando = mandante.mandante === false ? 0 : MANDO * GOL_POR_PONTO

  const esperadoMandante = BASE_ESPERADA + (ataque + meio * 0.5) * GOL_POR_PONTO + mando
  const esperadoVisitante = BASE_ESPERADA + (-defesa - meio * 0.5) * GOL_POR_PONTO - mando

  return {
    golsMandante: golsPorPoisson(esperadoMandante, aleatorio),
    golsVisitante: golsPorPoisson(esperadoVisitante, aleatorio),
    duelos,
    porQue: explicar(duelos, ladoDoTexto),
  }
}

/**
 * Força por setor a partir do PRESTÍGIO, para os clubes que o jogo não simula
 * com elenco.
 *
 * ⚠️ Continua existindo de propósito. Resolver as dezenas de partidas de uma
 * rodada carregando o elenco de cada clube é o custo que já travou o jogo no
 * apito final (ver a memória do O(n²) no universo 286). Elenco real entra onde
 * muda a experiência: nas partidas do jogador.
 */
export function forcaPorPrestigio(prestigio: number): ForcaPorSetor {
  // Prestígio 0-100 mapeado na faixa de overall que os elencos ocupam.
  const base = 45 + prestigio * 0.35
  return { ataque: base, meio: base, defesa: base }
}
