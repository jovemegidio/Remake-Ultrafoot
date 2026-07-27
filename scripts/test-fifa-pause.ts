// Valida a pausa da Copa: em ano de Mundial (2026) junho vira um bloco de ~6
// semanas atravessando junho->julho; fora disso, cada janela FIFA pausa 1 semana.
import { aplicarPausasFifa } from "../lib/use-game-manager"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log("  FALHA: " + msg) } }

// Temporada brasileira: 38 rodadas de liga, abril(3)->novembro(10).
const meses = [3,3,3,4,4,4,5,5,5,6,6,6,7,7,7,8,8,8,9,9,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10]
const fixtures: any[] = meses.map((mes, i) => ({
  id: i + 1, round: i + 1, week: i + 1, month: mes,
  homeTeam: { curto: "USR" }, awayTeam: { curto: "RIV" },
  competition: "Liga", played: false, isUserMatch: true, competitionType: "league",
}))
const userTeam: any = { curto: "USR", nome: "Meu Time" }

// ── Ano de Copa (2026) ──
const comCopa = aplicarPausasFifa(fixtures, userTeam, 2026)
const wcBreaks = comCopa.filter(f => f.competitionType === "fifa_break" && f.competition === "Copa do Mundo FIFA")
check(wcBreaks.length === 6, `Mundial deve ter 6 semanas de pausa (tem ${wcBreaks.length})`)
check(wcBreaks.some(f => f.month === 5) && wcBreaks.some(f => f.month === 6), "Mundial atravessa junho(5) e julho(6)")
check(comCopa.filter(f => f.competitionType === "fifa_break").length > 6, "alem do Mundial, ainda ha datas FIFA de Set/Out/Nov")
// Nenhuma partida de liga se perdeu.
check(comCopa.filter(f => f.competitionType === "league").length === 38, "as 38 partidas de liga continuam la")

// ── Ano sem Copa (2027) ──
const semCopa = aplicarPausasFifa(fixtures, userTeam, 2027)
check(!semCopa.some(f => f.competition === "Copa do Mundo FIFA"), "2027 nao tem pausa de Mundial")
const junho2027 = semCopa.filter(f => f.competitionType === "fifa_break" && f.month === 5)
check(junho2027.length === 1, `2027: junho e data FIFA de 1 semana (tem ${junho2027.length})`)

console.log(falhas === 0 ? "\nOK — pausa da Copa coerente" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
