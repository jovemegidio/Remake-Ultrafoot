// QUAL EVENTO O RADAR DEVE ENCENAR.
//
// O radar reage ao último lance relevante: no chute a bola voa para o gol, no
// escanteio ela vai para o canto e o time aglomera na área. A escolha desse
// "último lance" vivia solta dentro da tela do ao-vivo e estava ERRADA de duas
// formas que se somavam:
//
//   1. LADO ERRADO DA LISTA. O motor guarda os eventos com o MAIS NOVO NA
//      FRENTE (`events: [novo, ...anteriores]`, ver hooks/use-match-simulation).
//      A busca varria do fim para o começo procurando o mais recente — e o fim
//      da lista é o começo da partida. O radar encenava, a cada quadro, o
//      PRIMEIRO chute do jogo: aos 66 minutos a bola ainda voava para o gol de
//      quem finalizou aos 3.
//
//   2. IDENTIDADE INSTÁVEL. O "seq" que dispara a reação era o ÍNDICE no array.
//      Como cada evento novo entra na frente, o índice de um evento FIXO cresce
//      a cada lance — o `seq` mudava sozinho e a reação re-disparava sem parar,
//      sempre com o mesmo lance velho.
//
// A correção das duas: varrer do começo (onde está o mais novo) e identificar o
// evento pela sua ORDEM NA PARTIDA (`total - índice`), que não muda quando
// outros eventos entram na frente.
//
// Puro e isolado para poder ser testado — ver scripts/test-radar-evento.ts.

export type TipoDeReacao = "shot" | "goal" | "corner" | "chance"

export interface EventoDoRadar {
  type: TipoDeReacao
  side: "home" | "away"
  /** Ordem do lance na partida. ESTÁVEL: não muda quando chegam lances novos. */
  seq: number
}

/** O mínimo que este módulo precisa enxergar de um evento da partida. */
export interface EventoDaPartida {
  type: string
  side?: "home" | "away"
}

/** Lances que o radar sabe encenar, e como cada um vira reação. */
const REACAO_POR_TIPO: Record<string, TipoDeReacao> = {
  goal: "goal",
  corner: "corner",
  shot: "shot",
  shot_on_target: "shot",
  save: "shot",
  post: "shot",
  miss: "shot",
  penalty: "shot",
  free_kick: "shot",
  chance: "chance",
}

/**
 * O lance mais recente que o radar deve encenar, ou `undefined` quando ainda não
 * houve nenhum.
 *
 * `eventos` vem do motor com o MAIS NOVO NA FRENTE.
 */
export function selecionarEventoDoRadar(
  eventos: readonly EventoDaPartida[],
): EventoDoRadar | undefined {
  for (let i = 0; i < eventos.length; i++) {
    const e = eventos[i]
    const tipo = REACAO_POR_TIPO[e.type]
    if (!tipo) continue
    // Sem lado não dá para saber para que gol a bola vai; encenar seria chutar.
    if (e.side !== "home" && e.side !== "away") continue
    return { type: tipo, side: e.side, seq: eventos.length - i }
  }
  return undefined
}
