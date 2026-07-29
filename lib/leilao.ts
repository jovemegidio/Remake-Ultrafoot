"use client"

// LEILÃO DE JOGADOR — disputa por um mesmo alvo.
//
// O mercado do jogo é 1-para-1 (lib/transfer-engine): você propõe, o clube
// aceita ou recusa. Falta o caso em que VÁRIOS clubes querem o mesmo atleta,
// que é onde o preço sobe de verdade e onde perder dói.
//
// A regra do leilão aqui é a que o futebol usa de fato: não vence só quem paga
// mais, vence a combinação de dinheiro com o que o atleta quer (projeto, sair
// jogando, tamanho do clube). Um lance altíssimo de um clube pequeno pode perder
// para uma oferta menor de um grande — e é isso que faz o jogador pensar.

export interface LanceLeilao {
  clubeCurto: string
  clubeNome: string
  valor: number
  /** Prestígio do clube que deu o lance (0-100). */
  prestigio: number
  /** true quando é o lance do jogador humano. */
  doUsuario?: boolean
}

export interface LeilaoAberto {
  id: string
  jogadorNome: string
  jogadorOverall: number
  jogadorIdade: number
  clubeVendedorCurto: string
  clubeVendedorNome: string
  /** Piso pedido pelo vendedor. */
  valorMinimo: number
  /** Semana em que encerra. */
  encerraNaSemana: number
  lances: LanceLeilao[]
}

/**
 * Preço de partida de um leilão.
 *
 * Usa a MESMA escala de lib/transfer-engine.calcMarketValue (overall³ × 35). A
 * primeira versão disto tinha fórmula própria e devolvia R$ 0,8 mi para um
 * atleta de overall 82 — cerca de cinquenta vezes abaixo do que o resto do jogo
 * paga pelo mesmo atleta. Duas escalas de valor no mesmo jogo é bug garantido:
 * o leilão viraria a forma mais barata de contratar.
 *
 * O piso fica em 85% do valor de mercado: o vendedor abre abaixo para atrair
 * lances, e é a disputa que leva o preço acima.
 */
export function valorMinimoDe(overall: number, idade: number, potencial?: number): number {
  const fatorIdade = idade <= 23 ? 1.35 : idade >= 32 ? 0.58 : 1
  const qualidade = Math.max(45, overall)
  // O termo de POTENCIAL faz parte de calcMarketValue. Sem ele, um jovem de
  // potencial alto saía do leilão mais barato do que custa na aba Buscar — e o
  // leilão voltaria a ser o jeito barato de contratar, que é o defeito que a
  // escala alinhada existe para evitar.
  const promessa = Math.max(0, (potencial ?? overall) - overall) * 350_000
  const mercado = Math.round(((qualidade ** 3) * 35 + promessa) * fatorIdade / 10000) * 10000
  return Math.round((mercado * 0.85) / 10000) * 10000
}

/** Incremento mínimo para cobrir o lance atual — evita leilão de centavos. */
export function lanceMinimoSeguinte(leilao: LeilaoAberto): number {
  const atual = maiorLance(leilao)?.valor ?? leilao.valorMinimo
  return Math.round(atual * 1.08)
}

export function maiorLance(leilao: LeilaoAberto): LanceLeilao | null {
  if (leilao.lances.length === 0) return null
  return [...leilao.lances].sort((a, b) => b.valor - a.valor)[0]
}

/**
 * Atratividade de um lance aos olhos do ATLETA.
 *
 * Dinheiro pesa mais, mas não sozinho: o prestígio do clube entra comprimido
 * (mesma escolha do motor de partida — diferença grande não pode decidir tudo).
 */
export function atratividade(lance: LanceLeilao, maior: number): number {
  const relativo = maior > 0 ? lance.valor / maior : 1
  const brilho = Math.sign(lance.prestigio - 60) * Math.pow(Math.abs(lance.prestigio - 60), 0.5) * 0.035
  return relativo + brilho
}

/**
 * Fecha o leilão e devolve o vencedor.
 *
 * Devolve `null` quando ninguém cobriu o mínimo — o atleta fica onde está, que é
 * um desfecho legítimo e faz o jogador levar o piso a sério.
 */
export function encerrarLeilao(leilao: LeilaoAberto): { vencedor: LanceLeilao; motivo: string } | null {
  const validos = leilao.lances.filter(l => l.valor >= leilao.valorMinimo)
  if (validos.length === 0) return null

  const maior = Math.max(...validos.map(l => l.valor))
  const ordenados = [...validos].sort((a, b) => atratividade(b, maior) - atratividade(a, maior))
  const vencedor = ordenados[0]

  const eraMaiorLance = vencedor.valor >= maior
  const motivo = eraMaiorLance
    ? `${vencedor.clubeNome} venceu com o maior lance.`
    : `${vencedor.clubeNome} levou mesmo sem o maior lance: o atleta preferiu o projeto.`

  return { vencedor, motivo }
}

// ─── VITRINE DETERMINÍSTICA ───────────────────────────────────────────────────
//
// O leilão precisa existir na tela sem virar um simulador paralelo do mundo. A
// saída é deixá-lo DERIVADO: dado (atleta, semana), quem está na disputa e quanto
// já ofereceram é sempre a mesma coisa. Só o lance do usuário precisa ser salvo.
//
// Isso evita o defeito que o leilão já teve uma vez — inventar um sistema
// paralelo ao que o jogo tinha. Aqui não há estado novo do mundo: os lances da
// IA saem de `lanceDaIA`, a mesma função que as regras usam.

function semente(texto: string): number {
  let h = 2166136261
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

/** Sorteio 0-1 reproduzível a partir de um texto. */
function sorteioDe(texto: string): number {
  return (semente(texto) % 100000) / 100000
}

/** Identidade estável de um leilão: atleta + clube de origem. */
export function chaveLeilao(jogadorNome: string, clubeNome: string): string {
  return `${clubeNome}::${jogadorNome}`.toLocaleLowerCase("pt-BR")
}

/**
 * Este atleta está em disputa nesta semana?
 *
 * Só ~1 em 400 entra por semana, e nunca abaixo de overall 72: leilão de reserva
 * não interessa a ninguém e encheria a tela de ruído.
 */
export function emLeilaoNaSemana(
  jogadorNome: string,
  clubeNome: string,
  overall: number,
  semana: number,
): boolean {
  if (overall < 78) return false
  // A janela dura 3 semanas, então o bloco de semanas é o que define o lote.
  const bloco = Math.floor(semana / 3)
  return sorteioDe(`leilao:${chaveLeilao(jogadorNome, clubeNome)}:${bloco}`) < 0.0025
}

/** Semana em que o leilão deste atleta encerra (fim do bloco de 3 semanas). */
export function semanaDeEncerramento(semana: number): number {
  return (Math.floor(semana / 3) + 1) * 3
}

/**
 * Lances da IA já dados neste leilão, reproduzíveis. Recebe os clubes que
 * poderiam entrar e devolve os que de fato entraram, em ordem crescente de valor
 * — como se tivessem se cobrindo um ao outro ao longo da semana.
 */
export function lancesDaIA(
  leilao: LeilaoAberto,
  candidatos: { curto: string; nome: string; prestigio: number; caixa: number; forcaElenco: number }[],
  semana: number,
): LanceLeilao[] {
  const acumulado: LanceLeilao[] = []
  // Ordem de entrada também é derivada, para o mais rico não ser sempre o último.
  const ordenados = [...candidatos].sort(
    (a, b) => sorteioDe(`ordem:${leilao.id}:${a.curto}`) - sorteioDe(`ordem:${leilao.id}:${b.curto}`),
  )
  // Teto de concorrentes varia de 1 a 4 POR LEILÃO. Com teto fixo em 4 e o
  // interesse alto, toda disputa vinha com exatamente 4 clubes e ficava
  // monótona; variando, aparece o duelo direto e aparece o leilão cheio.
  const teto = 1 + Math.floor(sorteioDe(`teto:${leilao.id}`) * 4)
  for (const clube of ordenados) {
    const parcial: LeilaoAberto = { ...leilao, lances: acumulado }
    const lance = lanceDaIA(parcial, clube, sorteioDe(`lance:${leilao.id}:${clube.curto}:${semana}`))
    if (lance) acumulado.push(lance)
    if (acumulado.length >= teto) break
  }
  return acumulado
}

/**
 * Lance da IA. Clube só entra se o atleta melhora o elenco dele e se cabe no
 * caixa — senão o leilão vira inflação sem sentido.
 */
export function lanceDaIA(
  leilao: LeilaoAberto,
  clube: { curto: string; nome: string; prestigio: number; caixa: number; forcaElenco: number },
  sorteio: number = Math.random(),
): LanceLeilao | null {
  const melhora = leilao.jogadorOverall - clube.forcaElenco
  // -5 e não -2: clube compra também para dar profundidade ao elenco e para
  // revender. Com o corte em -2, quase nenhum atleta agradava a alguém que
  // também tivesse caixa para pagá-lo, e o leilão abria vazio.
  if (melhora < -5) return null                       // não agrega
  const minimo = lanceMinimoSeguinte(leilao)
  if (minimo > clube.caixa * 0.6) return null         // não cabe no caixa

  // Interesse cresce com a melhora e com o prestígio (clube grande arrisca mais).
  // Jovem entra na conta: um atleta de 21 anos interessa mesmo sem melhorar o XI.
  const juventude = leilao.jogadorIdade <= 23 ? 0.18 : leilao.jogadorIdade >= 31 ? -0.10 : 0
  const interesse = 0.25 + melhora * 0.06 + (clube.prestigio - 60) * 0.004 + juventude
  if (sorteio >= Math.min(0.85, interesse)) return null

  const agressividade = 1 + sorteio * 0.12
  return {
    clubeCurto: clube.curto,
    clubeNome: clube.nome,
    valor: Math.round(minimo * agressividade),
    prestigio: clube.prestigio,
  }
}
