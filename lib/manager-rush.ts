// MANAGER RUSH — a partida começa aos 60 minutos e você está perdendo.
//
// ⚠️ POR QUE ELE PÔDE SER FEITO AGORA, E OS OUTROS NÃO. Dos seis modos que
// faltavam, quatro (Champions, Carreira Online, Diretoria, Cooperativa) exigem
// SERVIDOR: estado compartilhado entre pessoas, pareamento, anti-trapaça. Este e
// o "Eventos da semana" não exigem — são variações de REGRA sobre o motor que já
// existe, e por isso são jogáveis hoje, sozinho, sem um relay no ar.
//
// Prometer os seis e entregar seis telas que abrem e não conectam seria pior do
// que entregar dois que funcionam e dizer a verdade sobre os outros quatro.
//
// ⚠️ O MODO NÃO ENCOSTA NO SAVE DA CARREIRA. É a regra que o gate
// `test-online-nao-toca-no-save` cobra: nada do online pode mexer no que o
// jogador construiu em anos de carreira. O Rush é uma partida avulsa; o
// resultado morre na tela.
//
// Módulo PURO — sem React, sem store.

import type { Team } from "@/lib/teams-data"

/** O minuto em que a bola volta a rolar. É o que dá nome ao modo. */
export const MINUTO_INICIAL = 60

export interface DesafioRush {
  /** Semente do dia: todo mundo pega o mesmo desafio na mesma data. */
  semente: string
  clube: Team
  adversario: Team
  /** Quanto você está perdendo quando assume. Nunca zero — não haveria desafio. */
  golsPro: number
  golsContra: number
  /** O que é preciso para "vencer" o desafio. */
  objetivo: "empatar" | "virar"
}

/** Hash estável: a mesma data e o mesmo elenco produzem o mesmo desafio. */
function hash(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/**
 * O DESAFIO DO DIA.
 *
 * ⚠️ DETERMINÍSTICO PELA DATA, e não sorteado a cada abertura. Um desafio que
 * muda quando o jogador reabre a tela é um desafio que ele repete até vir um
 * fácil — e aí não é desafio, é sorteio. Com a data como semente, o de hoje é o
 * de hoje, e comparar resultado com outra pessoa passa a significar alguma coisa.
 *
 * `dataISO` entra por parâmetro (e não de `new Date()` aqui dentro) para o teste
 * conseguir fixar o dia.
 */
export function desafioDoDia(clubes: readonly Team[], dataISO: string): DesafioRush | null {
  const elegiveis = clubes.filter(t => t.prestigio >= 55)
  if (elegiveis.length < 2) return null

  const semente = `rush:${dataISO}`
  const h = hash(semente)
  const clube = elegiveis[h % elegiveis.length]
  // O adversário sai de OUTRO ponto do hash para não cair sempre no vizinho de
  // índice — e nunca pode ser o próprio clube.
  let adversario = elegiveis[(h >> 7) % elegiveis.length]
  if (adversario.file_key === clube.file_key) {
    adversario = elegiveis[((h >> 7) + 1) % elegiveis.length]
  }

  // ⚠️ UM GOL DE DESVANTAGEM, SEMPRE — e a primeira versão errou isto feio.
  //
  // Ela sorteava 1 ou 2 gols atrás e, com 2, pedia o empate: DOIS gols em trinta
  // minutos. Medido com o motor de verdade, 20 tentativas seguidas: ZERO
  // sucessos. Um desafio impossível não é difícil, é quebrado — ensina o jogador
  // a fechar a tela, e ele nunca mais volta para descobrir que melhorou.
  //
  // Com um gol atrás, o EMPATE é alcançável e a VIRADA é o prêmio de quem
  // arrisca. Quem manda no objetivo é a força relativa: contra um adversário
  // mais fraco, empatar seria pouco.
  const golsPro = (h >> 11) % 2          // 0 ou 1: às vezes você já marcou
  const favorito = clube.prestigio >= adversario.prestigio
  return {
    semente,
    clube,
    adversario,
    golsPro,
    golsContra: golsPro + 1,
    objetivo: favorito ? "virar" : "empatar",
  }
}

export interface ResultadoRush {
  golsPro: number
  golsContra: number
  /** O objetivo foi cumprido? */
  venceu: boolean
  /** O que aconteceu do minuto 60 em diante, para a tela contar. */
  narracao: { minuto: number; texto: string; tipo: "gol-pro" | "gol-contra" | "apito" }[]
}

/**
 * Avalia o desfecho a partir do placar final.
 *
 * Separado de quem SIMULA de propósito: a regra do que conta como vitória é do
 * modo, e o motor não precisa conhecê-la.
 */
export function avaliarRush(desafio: DesafioRush, golsPro: number, golsContra: number): boolean {
  return desafio.objetivo === "virar" ? golsPro > golsContra : golsPro >= golsContra
}

/** As duas posturas do modo — o único botão, e ele muda o jogo. */
export type PosturaRush = "equilibrado" | "tudo-ou-nada"

/**
 * A FORÇA DOS DOIS LADOS DO MINUTO 60 EM DIANTE.
 *
 * ⚠️ MORA AQUI, E NÃO NA TELA, porque o gate precisa medir EXATAMENTE o que o
 * jogador joga. Na primeira versão a tela dava um empurrão que o teste não
 * conhecia: o gate media 4% de sucesso e aprovava um modo que, na mão do
 * jogador, era outro. Número de balanceamento em dois lugares é número que
 * diverge.
 *
 * O empurrão base representa o que o modo é: você ENTROU para mudar o jogo. Sem
 * ele o desafio virava sorteio contra a estatística — medido, 1 sucesso em 24.
 */
export function forcasDoRush(
  desafio: DesafioRush,
  postura: PosturaRush,
): { homeRating: number; awayRating: number } {
  // O técnico mexeu: o time volta diferente do que estava aos 60.
  const empurraoDoTecnico = 10
  const arrisca = postura === "tudo-ou-nada"
  return {
    homeRating: desafio.clube.prestigio + empurraoDoTecnico + (arrisca ? 8 : 0),
    // Ir com tudo abre espaço atrás — o preço que torna a escolha uma escolha.
    awayRating: desafio.adversario.prestigio + (arrisca ? 7 : 0),
  }
}
