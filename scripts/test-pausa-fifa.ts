// A pausa de data FIFA tem que: (a) aparecer quando a temporada entra numa
// janela FIFA, (b) NUNCA dividir semana com jogo de liga (o clube fica parado),
// (c) cair num mes de janela FIFA, (d) nao mexer no numero de jogos do clube
// (fim de temporada intacto).
import { aplicarPausasFifa, type Fixture } from "../lib/use-game-manager"
import { getTeamByShort } from "../lib/teams-data"
import { isFifaWindowMonth } from "../lib/national-windows"

const user = getTeamByShort("FLA") ?? getTeamByShort("COR")!
let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }

// Calendario sintetico de uma liga europeia: Agosto(7) a Maio(4), 1 jogo/semana.
// Passa por Setembro/Outubro/Novembro/Marco (janelas FIFA).
const MESES = [7, 7, 8, 8, 9, 9, 10, 10, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4] // 18 semanas
const base: Fixture[] = MESES.map((m, i) => ({
  id: i + 1, round: i + 1, week: i + 1,
  homeTeam: user, awayTeam: user,
  competition: "Liga", played: false, isUserMatch: true,
  month: m, competitionType: "league",
}))

const antes = base.filter(f => f.competitionType === "league").length
const out = aplicarPausasFifa(base, user)
const breaks = out.filter(f => f.competitionType === "fifa_break")
const liga = out.filter(f => f.competitionType === "league")

console.log(`== Pausa FIFA ==`)
console.log(`  jogos de liga: ${antes} -> ${liga.length} (deve ser igual)`)
console.log(`  pausas inseridas: ${breaks.length} nas semanas ${breaks.map(b => b.week).sort((a,b)=>a-b).join(", ")}`)

// (a) inseriu pausas
check(breaks.length >= 3, "deveria inserir >=3 pausas (Set, Out/Nov, Marco)")
// (d) nao mudou o numero de jogos de liga
check(liga.length === antes, "numero de jogos de liga nao pode mudar")
// (b) nenhuma pausa divide semana com jogo de liga
for (const b of breaks) {
  const conflito = liga.some(f => f.week === b.week)
  check(!conflito, `pausa na semana ${b.week} nao pode ter jogo de liga junto`)
}
// (c) toda pausa cai num mes de janela FIFA
for (const b of breaks) check(isFifaWindowMonth(b.month), `pausa no mes ${b.month} nao e janela FIFA`)
// pausas nao sao compromisso do usuario (fim de temporada)
check(breaks.every(b => !b.isUserMatch && b.played), "pausa deve ser isUserMatch:false e played:true")
// semanas unicas: cada semana tem no maximo um "trilho" de liga/pausa
const semanasLigaEpausa = [...liga, ...breaks].map(f => f.week)
check(new Set(semanasLigaEpausa).size === semanasLigaEpausa.length, "cada semana deve ser unica entre liga e pausa")

console.log(falhas === 0 ? "\nOK — clube para na data FIFA e retoma depois" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
