// Valida o rastreamento de goleadores: (a) um scorer por gol, com time certo e
// assistente do MESMO time; (b) deterministico; (c) o agregador da competicao usa
// os scorers gravados (dado real) em vez de re-atribuir pelo placar.
import { gerarScorersDaPartida, gerarEstatisticasCompeticao, type CompStatRow } from "../lib/competition-scorers"
import type { MatchResult } from "../lib/game-engine"
import type { Player } from "../lib/players-data"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log("  FALHA: " + msg) } }

const squad = (pref: string): Player[] => [
  { nome: `${pref} ATA`, pos: "ATA", idade: 25, base: 84, time: pref },
  { nome: `${pref} EXT`, pos: "EXT", idade: 24, base: 81, time: pref },
  { nome: `${pref} MEI`, pos: "MEI", idade: 27, base: 79, time: pref },
  { nome: `${pref} VOL`, pos: "VOL", idade: 28, base: 76, time: pref },
  { nome: `${pref} ZAG`, pos: "ZAG", idade: 30, base: 77, time: pref },
  { nome: `${pref} GOL`, pos: "GOL", idade: 29, base: 78, time: pref },
] as Player[]

// (a) numero de scorers = total de gols; time e assistente coerentes
const scorers = gerarScorersDaPartida({
  homeShort: "AAA", awayShort: "BBB",
  homePlayers: squad("AAA"), awayPlayers: squad("BBB"),
  homeScore: 3, awayScore: 1, seedBase: "AAA-BBB-2026-5",
})
check(scorers.length === 4, `deve haver 4 scorers (3+1), tem ${scorers.length}`)
check(scorers.filter(s => s.teamShort === "AAA").length === 3, "3 gols do mandante")
check(scorers.filter(s => s.teamShort === "BBB").length === 1, "1 gol do visitante")
check(scorers.every(s => s.name.startsWith(s.teamShort)), "cada goleador pertence ao seu time")
check(scorers.every(s => !s.assist || s.assist.startsWith(s.teamShort)), "assistente e do mesmo time")
check(scorers.every(s => s.assist !== s.name), "assistente diferente do goleador")

// (b) determinismo
const scorers2 = gerarScorersDaPartida({
  homeShort: "AAA", awayShort: "BBB",
  homePlayers: squad("AAA"), awayPlayers: squad("BBB"),
  homeScore: 3, awayScore: 1, seedBase: "AAA-BBB-2026-5",
})
check(JSON.stringify(scorers) === JSON.stringify(scorers2), "geracao deve ser deterministica")

// (c) o agregador usa os scorers gravados (nao re-atribui)
const mr: MatchResult = {
  season: 2026, week: 5, competition: "Liga",
  homeTeam: "AAA", awayTeam: "BBB", homeScore: 3, awayScore: 1,
  events: [], scorers,
} as MatchResult
const rows = gerarEstatisticasCompeticao({
  resultados: [mr],
  squadDe: (s) => squad(s),
  nomeDe: (s) => `Time ${s}`,
  userShort: "USR",
  userRows: [] as CompStatRow[],
})
const golsAgregados = rows.reduce((s, r) => s + r.goals, 0)
check(golsAgregados === 4, `agregado deve somar 4 gols dos scorers, somou ${golsAgregados}`)
// Os nomes agregados batem com os scorers gravados (dado real, nao atribuido)
const nomesScorers = new Set(scorers.map(s => s.name))
check(rows.filter(r => r.goals > 0).every(r => nomesScorers.has(r.name)), "artilheiros vem dos scorers gravados")

console.log(falhas === 0 ? "\nOK — rastreamento de goleadores coerente e persistido" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
