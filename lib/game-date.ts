// A temporada comeca em 01/01 do ano informado e TERMINA DENTRO DO MESMO ANO.
//
// ⚠️ ANTES ERAM 7 DIAS FIXOS POR RODADA, E ISSO ESTOURAVA O ANO.
//
// A temporada brasileira e estadual + liga em sequencia: ~16 a 20 rodadas de
// estadual mais 38 de liga = ate 58 semanas. A 7 dias por rodada isso da 406
// dias — mais que um ano. Na pratica, a partir da semana 54 a data passava para
// o ano seguinte enquanto o rotulo continuava dizendo a temporada velha:
//
//     semana 53 -> 31/dez/2026      semana 57 -> 28/jan/2027
//     semana 58 ->  4/fev/2027
//
// Foi o que produziu "temporada nova comecando em fevereiro", semanas sem jogo
// nenhum e a tela preta ao iniciar partida — o jogador estava alem do fim do
// calendario, num limbo que nao deveria existir.
//
// A correcao NAO e mexer no gerador de fixtures (area com armadilha registrada:
// "a temporada travava para sempre"). E reconhecer que o calendario real do
// futebol brasileiro TEM rodada de meio de semana: 54 jogos em 12 meses dao ~6,7
// dias entre partidas, nao 7. Entao o passo passa a ser derivado da duracao da
// temporada, e o ano volta a caber em si mesmo.

/** Dias uteis de um ano de calendario, em semanas inteiras. */
const DIAS_NO_ANO = 364

/** Duracao padrao: 52 rodadas = exatamente 7 dias por rodada, como antes. */
const SEMANAS_PADRAO = 52

/**
 * Duracao da temporada EM CURSO, em rodadas.
 *
 * Fica no modulo porque `getGameDate` e chamado de 17 lugares e passar a
 * duracao em cada um deles espalharia a mesma informacao por toda a base — e
 * bastaria um esquecido para a data daquela tela discordar das outras, que e
 * justamente o bug que este arquivo existe para evitar (o cabecalho dizia
 * "28 JAN" e a manchete "8 DE DEZ").
 *
 * Quem sabe a duracao real e o `use-game-manager`, que calcula `seasonEndWeek`.
 * Ele configura aqui uma vez por temporada.
 */
let semanasDaTemporada = SEMANAS_PADRAO

/**
 * Informa a duracao da temporada corrente. Idempotente e barato: chamar a cada
 * render nao custa nada e mantem a data coerente quando a temporada vira.
 */
export function configurarDuracaoDaTemporada(semanas: number | undefined | null): void {
  if (!semanas || !Number.isFinite(semanas) || semanas <= 0) return
  // Temporada mais curta que o ano nao ESTICA os jogos: um calendario europeu de
  // 38 rodadas continua com uma partida por semana e simplesmente acaba antes.
  // A compressao so entra quando ha rodadas demais para caber em 7 dias cada.
  semanasDaTemporada = Math.max(SEMANAS_PADRAO, Math.round(semanas))
}

/** Quantos dias separam duas rodadas na temporada corrente. */
export function diasPorRodada(): number {
  return DIAS_NO_ANO / semanasDaTemporada
}

export function getGameDate(season: number, week: number): Date {
  const date = new Date(season, 0, 1)
  const passo = diasPorRodada()
  date.setDate(date.getDate() + Math.round(Math.max(0, week - 1) * passo))
  return date
}
