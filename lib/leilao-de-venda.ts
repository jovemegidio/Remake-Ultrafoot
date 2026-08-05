"use client"

// LEILÃO DE VENDA — você põe UM ATLETA SEU em disputa.
//
// ⚠️ POR QUE ISTO EXISTE (pedido: "a opção de colocar seus jogadores em leilão;
// caso algum time compre, o dinheiro entra em caixa e o jogador sai na abertura
// da janela").
//
// O leilão que o jogo tinha era só de COMPRA: outros clubes abriam um atleta à
// disputa e você cobria o lance. Para vender só havia dois caminhos, os dois
// passivos — esperar uma sondagem da IA ou apertar "Vender agora" e aceitar o
// primeiro palpite. Não existia forma de ANUNCIAR um atleta e deixar o mercado
// disputar o preço, que é justamente onde o vendedor ganha dinheiro de verdade.
//
// TRÊS DECISÕES QUE IMPORTAM:
//
// 1. REAPROVEITA O MOTOR DE LANCES (`lancesDaIA` / `encerrarLeilao`). Escrever um
//    segundo motor de leilão seria a mesma armadilha das "duas escalas de valor"
//    que o leilão de compra já pagou caro: dois lugares decidindo quanto vale um
//    atleta divergem, e o jogador descobre pela brecha.
//
// 2. O PISO É SEU, mas com um mínimo. Anunciar por R$ 1 e receber quatro lances
//    de R$ 1,08 seria imprimir dinheiro ao contrário — o piso não pode ficar
//    abaixo de 60% do valor de mercado, senão o leilão vira uma forma de doar o
//    atleta. E o preço final sai da disputa, não do piso.
//
// 3. O DESFECHO É DERIVADO, como no leilão de compra: dado (anúncio, semana),
//    quem entrou e quanto ofereceu é sempre o mesmo. O save guarda só o anúncio.
//    Sem isso, dois renders da mesma tela dariam resultados diferentes.

import {
  encerrarLeilao, lancesDaIA, maiorLance, semanaDeAbertura,
  type LanceLeilao, type LeilaoAberto,
} from "@/lib/leilao"

/** Quantas semanas um anúncio fica aberto. Mesmo fôlego do leilão de compra. */
export const SEMANAS_DE_LEILAO = 3

/** Piso mínimo aceito, como fração do valor de mercado do atleta. */
export const PISO_MINIMO_DO_VALOR = 0.6

/** Um atleta SEU anunciado em leilão. Vive no save (`GameState.leiloesDeVenda`). */
export interface LeilaoDeVenda {
  /** Identidade estável do anúncio — também é a semente dos lances da IA. */
  id: string
  playerId: number
  playerName: string
  position: string
  overall: number
  idade: number
  /** Piso pedido por você. Abaixo dele o atleta não sai. */
  valorMinimo: number
  /** Valor de mercado na hora do anúncio (referência para a tela). */
  valorDeMercado: number
  abertoNaSemana: number
  encerraNaSemana: number
  season: number
}

export interface ClubeCandidato {
  curto: string
  nome: string
  prestigio: number
  caixa: number
  forcaElenco: number
}

export interface DesfechoDaVenda {
  leilao: LeilaoDeVenda
  /** null = ninguém cobriu o piso; o atleta fica. */
  vencedor: LanceLeilao | null
  valor: number
  motivo: string
}

/** O piso mais baixo que o jogo aceita para este atleta. */
export function pisoMinimoDe(valorDeMercado: number): number {
  return Math.max(50_000, Math.round((valorDeMercado * PISO_MINIMO_DO_VALOR) / 10_000) * 10_000)
}

/**
 * Piso SUGERIDO ao abrir o anúncio: o valor de mercado cheio.
 *
 * O vendedor pede o que o atleta vale e deixa a disputa levar acima — se pedisse
 * abaixo (como o leilão de compra faz para atrair lances), anunciar seria sempre
 * pior do que vender direto.
 */
export function pisoSugeridoDe(valorDeMercado: number): number {
  return Math.max(pisoMinimoDe(valorDeMercado), Math.round(valorDeMercado / 10_000) * 10_000)
}

/** Monta o `LeilaoAberto` que o motor de lances entende. */
function comoLeilaoAberto(anuncio: LeilaoDeVenda, clubeDoUsuario: { curto: string; nome: string }): LeilaoAberto {
  return {
    id: anuncio.id,
    jogadorNome: anuncio.playerName,
    jogadorOverall: anuncio.overall,
    jogadorIdade: anuncio.idade,
    clubeVendedorCurto: clubeDoUsuario.curto,
    clubeVendedorNome: clubeDoUsuario.nome,
    valorMinimo: anuncio.valorMinimo,
    encerraNaSemana: anuncio.encerraNaSemana,
    lances: [],
  }
}

/**
 * A disputa por este anúncio na semana informada.
 *
 * Não há lance do usuário aqui — quem vende não dá lance no próprio atleta.
 */
export function disputaPorAnuncio(
  anuncio: LeilaoDeVenda,
  candidatos: readonly ClubeCandidato[],
  semana: number,
  clubeDoUsuario: { curto: string; nome: string },
): LeilaoAberto {
  const base = comoLeilaoAberto(anuncio, clubeDoUsuario)
  // A semana efetiva nunca passa do fecho: depois dele a mesa está encerrada e os
  // lances não podem continuar subindo (senão o preço mudaria a cada vez que o
  // técnico reabrisse a tela dias depois — e o dinheiro já teria entrado).
  const semanaEfetiva = Math.min(semana, anuncio.encerraNaSemana)
  const lances = lancesDaIA(base, [...candidatos], Math.max(semanaDeAbertura(anuncio.encerraNaSemana), semanaEfetiva))
  return { ...base, lances }
}

/** O maior lance na mesa agora (ou null). */
export function lanceLiderando(
  anuncio: LeilaoDeVenda,
  candidatos: readonly ClubeCandidato[],
  semana: number,
  clubeDoUsuario: { curto: string; nome: string },
): LanceLeilao | null {
  return maiorLance(disputaPorAnuncio(anuncio, candidatos, semana, clubeDoUsuario))
}

/**
 * Fecha os anúncios cujo prazo já venceu e devolve o que aconteceu com cada um.
 *
 * Roda a partir do SAVE, sem depender de a tela estar aberta: o técnico pode
 * anunciar um atleta e avançar cinco semanas sem passar pela página de leilões.
 * Devolve também os anúncios que continuam abertos, para o chamador regravar a
 * lista sem precisar recalcular a regra.
 */
export function resolverLeiloesDeVenda(
  anuncios: readonly LeilaoDeVenda[],
  semanaAtual: number,
  seasonAtual: number,
  candidatos: readonly ClubeCandidato[],
  clubeDoUsuario: { curto: string; nome: string },
): { desfechos: DesfechoDaVenda[]; abertos: LeilaoDeVenda[] } {
  const desfechos: DesfechoDaVenda[] = []
  const abertos: LeilaoDeVenda[] = []

  for (const anuncio of anuncios) {
    // Anúncio de temporada passada não se resolve mais: os clubes candidatos e o
    // elenco mudaram. Some, e o atleta simplesmente continua no clube.
    if (anuncio.season !== seasonAtual) continue
    if (semanaAtual < anuncio.encerraNaSemana) { abertos.push(anuncio); continue }

    const disputa = disputaPorAnuncio(anuncio, candidatos, anuncio.encerraNaSemana, clubeDoUsuario)
    const resultado = encerrarLeilao(disputa)
    if (!resultado) {
      desfechos.push({
        leilao: anuncio, vencedor: null, valor: 0,
        motivo: `Ninguém cobriu o piso de ${anuncio.valorMinimo.toLocaleString("pt-BR")} por ${anuncio.playerName}. Ele segue no elenco.`,
      })
      continue
    }
    desfechos.push({
      leilao: anuncio,
      vencedor: resultado.vencedor,
      valor: resultado.vencedor.valor,
      motivo: resultado.motivo,
    })
  }

  return { desfechos, abertos }
}
