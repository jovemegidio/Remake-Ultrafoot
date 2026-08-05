// Medição de apoio para a auditoria 4.0: o que acontece com o elenco de um
// clube quando o técnico NÃO age por 10 temporadas. Reproduz a tabela do
// relatório 3.0 (overall médio, top-11, emergenciais, folha, caixa) na base atual.
import { useGameEngine, folhaSemanal } from "../lib/game-engine"

const g = () => useGameEngine.getState()
const TEMPORADAS = Number(process.env.TEMPORADAS ?? 10)
const CLUBES = (process.env.CLUBES ?? "FLA,MCI,ABC").split(",")

const media = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0)

for (const curto of CLUBES) {
  g().initializeGame(curto)
  console.log(`\n=== ${curto} ===`)
  console.log("temp  elenco  ovrMedio  top11  emergenciais  folha/sem      caixa")
  const linha = (t: number) => {
    const s = g()
    const ovrs = s.squadPlayers.map(p => p.overall)
    const top11 = [...ovrs].sort((a, b) => b - a).slice(0, 11)
    // "Emergencial" = valor de mercado zero (a reposição automática nasce assim).
    const emerg = s.squadPlayers.filter(p => (p.marketValue ?? 0) <= 0).length
    console.log(
      `${String(t).padStart(4)}  ${String(s.squadPlayers.length).padStart(6)}` +
      `  ${media(ovrs).toFixed(1).padStart(8)}  ${media(top11).toFixed(1).padStart(5)}` +
      `  ${String(emerg).padStart(12)}  ${Math.round(folhaSemanal(s.squadPlayers)).toLocaleString("pt-BR").padStart(10)}` +
      `  ${Math.round(s.balance).toLocaleString("pt-BR").padStart(15)}`,
    )
  }
  linha(0)
  for (let t = 1; t <= TEMPORADAS; t++) {
    for (let semana = 0; semana < 52; semana++) g().advanceWeek()
    const antes = g()
    g().processSeasonEnd(antes.currentSeason + 1, antes.serieAStandings, antes.serieAStandings)
    if (t % 2 === 0 || t === TEMPORADAS) linha(t)
  }
}
