// A TEMPORADA TEM QUE CABER NO ANO — teste de regressão.
//
// Bug real (07/08/2026): com 7 dias fixos por rodada, uma temporada de estadual
// + liga (até ~58 rodadas) passava de 365 dias. A semana 57 caía em 28/jan do
// ano SEGUINTE enquanto o rótulo dizia a temporada velha, e o jogador ficava num
// limbo: semanas sem jogo, "temporada nova em fevereiro" e tela preta ao iniciar
// partida.
//
// O que este teste protege é a PROPRIEDADE, não um número: a última rodada de
// qualquer temporada plausível tem de cair dentro do ano dela.

import { getGameDate, configurarDuracaoDaTemporada, diasPorRodada } from "@/lib/game-date"

let falhas = 0
function ok(cond: boolean, msg: string) {
  console.log(`  ${cond ? "ok  " : "FALHA"} ${msg}`)
  if (!cond) falhas++
}

const M = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")} ${M[d.getMonth()]} ${d.getFullYear()}`

console.log("== A temporada cabe no ano ==")

// 1. O caso que quebrou: Série A + estadual longo.
{
  configurarDuracaoDaTemporada(58)
  const ultima = getGameDate(2026, 58)
  console.log(`     58 rodadas -> passo ${diasPorRodada().toFixed(2)} dias · ultima em ${fmt(ultima)}`)
  ok(ultima.getFullYear() === 2026, "com 58 rodadas a ULTIMA cai em 2026, nao em 2027")
}

// 2. Varre durações plausíveis — nenhuma pode vazar para o ano seguinte.
{
  let vazou: number | null = null
  for (let rodadas = 30; rodadas <= 70; rodadas++) {
    configurarDuracaoDaTemporada(rodadas)
    if (getGameDate(2026, rodadas).getFullYear() !== 2026) { vazou = rodadas; break }
  }
  ok(vazou === null, `nenhuma duracao de 30 a 70 rodadas vaza para o ano seguinte${vazou ? ` (vazou em ${vazou})` : ""}`)
}

// 3. Temporada curta NÃO estica: liga europeia de 38 segue 1 jogo/semana.
{
  configurarDuracaoDaTemporada(38)
  ok(Math.abs(diasPorRodada() - 7) < 0.01, "38 rodadas mantem 7 dias por rodada (nao estica o calendario)")
  const ultima = getGameDate(2026, 38)
  ok(ultima.getMonth() <= 9, `liga de 38 rodadas acaba antes de novembro (${fmt(ultima)})`)
}

// 4. A primeira rodada é sempre 1º de janeiro.
{
  for (const r of [38, 52, 58]) {
    configurarDuracaoDaTemporada(r)
    const d = getGameDate(2026, 1)
    ok(d.getMonth() === 0 && d.getDate() === 1, `com ${r} rodadas, a rodada 1 e 01/jan`)
  }
}

// 5. A data nunca anda para trás conforme a rodada avança.
{
  configurarDuracaoDaTemporada(58)
  let anterior = getGameDate(2026, 1).getTime()
  let monotona = true
  for (let w = 2; w <= 58; w++) {
    const t = getGameDate(2026, w).getTime()
    if (t < anterior) { monotona = false; break }
    anterior = t
  }
  ok(monotona, "a data avanca (ou repete), nunca retrocede entre rodadas")
}

// 6. Entrada inválida não quebra nem zera o passo.
{
  configurarDuracaoDaTemporada(52)
  const antes = diasPorRodada()
  configurarDuracaoDaTemporada(0)
  configurarDuracaoDaTemporada(NaN)
  configurarDuracaoDaTemporada(undefined)
  ok(diasPorRodada() === antes, "duracao invalida e ignorada, mantendo a anterior")
}

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${falhas} TESTE(S) FALHARAM`)
process.exit(falhas ? 1 : 0)
