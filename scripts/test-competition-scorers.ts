// A artilharia da competicao tem que: (a) somar exatamente os gols dos placares,
// (b) favorecer atacantes/meias, (c) ser deterministica (mesmo input -> mesma
// lista), (d) preservar os numeros REAIS do time do usuario.
import { gerarEstatisticasCompeticao, type CompStatRow } from "../lib/competition-scorers"
import type { MatchResult } from "../lib/game-engine"
import type { Player } from "../lib/players-data"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }

const squad = (prefixo: string): Player[] => [
  { nome: `${prefixo} ATA`, pos: "ATA", idade: 25, base: 82, time: prefixo },
  { nome: `${prefixo} EXT`, pos: "EXT", idade: 24, base: 80, time: prefixo },
  { nome: `${prefixo} MEI`, pos: "MEI", idade: 27, base: 78, time: prefixo },
  { nome: `${prefixo} VOL`, pos: "VOL", idade: 28, base: 76, time: prefixo },
  { nome: `${prefixo} ZAG`, pos: "ZAG", idade: 30, base: 77, time: prefixo },
  { nome: `${prefixo} GOL`, pos: "GOL", idade: 29, base: 79, time: prefixo },
] as Player[]

const mr = (home: string, away: string, hs: number, as: number, week: number): MatchResult => ({
  season: 2026, week, competition: "Liga", homeTeam: home, awayTeam: away, homeScore: hs, awayScore: as,
} as MatchResult)

const resultados = [mr("AAA", "BBB", 3, 1, 1), mr("CCC", "AAA", 0, 2, 2), mr("BBB", "CCC", 2, 2, 3)]
const params = {
  resultados,
  squadDe: (s: string) => squad(s),
  nomeDe: (s: string) => `Time ${s}`,
  userShort: "USR",
  userRows: [{ key: "USR:Craque", name: "Craque", teamShort: "USR", teamName: "Meu Time", nat: "Brasil", goals: 5, assists: 3, matches: 4 }] as CompStatRow[],
}

const rows = gerarEstatisticasCompeticao(params)

console.log("== Artilharia da competicao ==")

// (a) total de gols gerados (CPU) = soma dos placares dos times NAO-usuario.
const golsPlacar = resultados.reduce((s, m) => s + m.homeScore + m.awayScore, 0) // 3+1+0+2+2+2 = 10
const golsGerados = rows.filter(r => r.teamShort !== "USR").reduce((s, r) => s + r.goals, 0)
check(golsGerados === golsPlacar, `gols gerados ${golsGerados} != placares ${golsPlacar}`)

// (b) atacantes/meias marcam mais que zagueiro/goleiro (no agregado).
const porPos = (sufixo: string) => rows.filter(r => r.name.endsWith(sufixo)).reduce((s, r) => s + r.goals, 0)
check(porPos("ATA") + porPos("EXT") + porPos("MEI") >= porPos("ZAG") + porPos("GOL"), "ofensivos marcam mais que defensivos")

// (c) determinismo: rodar de novo da a mesma coisa.
const rows2 = gerarEstatisticasCompeticao(params)
check(JSON.stringify(rows) === JSON.stringify(rows2), "resultado deve ser deterministico")

// (d) o time do usuario entra com os numeros reais, intactos.
const craque = rows.find(r => r.name === "Craque")
check(craque?.goals === 5 && craque?.assists === 3, "numeros reais do usuario preservados")

// (e) todo goleador tem um time e nome.
check(rows.every(r => r.name && r.teamShort), "toda linha tem nome e time")

const top = rows.filter(r => r.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 3)
console.log("  Top artilheiros: " + top.map(r => `${r.name} ${r.goals}`).join(", "))
console.log(falhas === 0 ? "\nOK — artilharia da competicao coerente e deterministica" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
