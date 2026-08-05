/**
 * O clube nunca pode ficar sem time para escalar.
 *
 * A rede de seguranca existia so no `processSeasonEnd` e com piso 11 — o minimo
 * para escalar, sem banco. Entre uma virada e outra o elenco despencava sem piso
 * nenhum: medido 39 -> 15 atletas em uma temporada, e a propria reposicao
 * automatica nascia com contrato vencido a partir de 2029.
 *
 * Cobre o modulo puro e a carreira inteira rodando no motor.
 */
import { reforcosEmergenciais, carenciasDoElenco, ELENCO_MINIMO } from "../lib/reposicao-emergencial"
import { useGameEngine } from "../lib/game-engine"

let falhas = 0
const ok = (nome: string, condicao: boolean, detalhe = "") => {
  console.log(`${condicao ? "OK  " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!condicao) falhas++
}

// ---- modulo puro ---------------------------------------------------------
// Elenco de 20 que cumpre TODOS os minimos por setor (2 GOL, 5 DEF, 5 MEI, 3 ATA).
const elencoCheio = ["GOL","GOL","ZAG","ZAG","ZAG","LD","LE","VOL","VOL","MEI","MEI","MEI","ATA","ATA","PD","PE","ZAG","MEI","ATA","LD"]
  .map((position, i) => ({ position, overall: 65, name: `Atleta ${i}` }))
ok("elenco completo nao recebe reforco", reforcosEmergenciais(elencoCheio, { divisao: "serie_a", temporada: 2030, semana: 10 }).length === 0)

const elencoVazio: { position: string; overall: number; name?: string }[] = []
const doZero = reforcosEmergenciais(elencoVazio, { divisao: "serie_a", temporada: 2030, semana: 10 })
ok("elenco vazio e reposto ate o minimo", doZero.length === ELENCO_MINIMO, `${doZero.length} reforcos`)
ok("a reposicao do zero traz goleiro", doZero.some(r => r.position === "GOL"))
ok("e nao vira um time de goleiros", doZero.filter(r => r.position === "GOL").length <= 3,
  `${doZero.filter(r => r.position === "GOL").length} goleiros`)
ok("nenhuma carencia de setor sobra", Object.keys(carenciasDoElenco(doZero)).length === 0,
  JSON.stringify(carenciasDoElenco(doZero)))
ok("emergencial vale ZERO no mercado (nao reabre a impressora)", doZero.every(r => r.marketValue === 0))
ok("os nomes nao repetem dentro do lote", new Set(doZero.map(r => r.name)).size === doZero.length)

const semGoleiro = Array.from({ length: 18 }, (_, i) => ({ position: "MEI", overall: 60, name: `Meia ${i}` }))
const reposicaoGol = reforcosEmergenciais(semGoleiro, { divisao: "serie_b", temporada: 2031, semana: 3 })
ok("elenco cheio mas SEM goleiro ainda recebe goleiro", reposicaoGol.filter(r => r.position === "GOL").length >= 2,
  `${reposicaoGol.length} reforcos`)

const determinista = reforcosEmergenciais(elencoVazio, { divisao: "serie_a", temporada: 2030, semana: 10 })
ok("a geracao e deterministica", JSON.stringify(determinista) === JSON.stringify(doZero))

// ---- carreira inteira no motor -------------------------------------------
const g = () => useGameEngine.getState()
g().initializeGame("BGT")
const folhaDe = (pl: readonly { contract?: { salary?: number } | null }[]) => pl.reduce((s, p) => s + (p.contract?.salary ?? 0), 0)
const despesaInicial = g().weeklyExpenses
const folhaInicial = folhaDe(g().squadPlayers)
let menorElenco = 99
let menosGoleiros = 99
for (let t = 1; t <= 6; t++) {
  for (let w = 0; w < 52; w++) {
    g().advanceWeek()
    menorElenco = Math.min(menorElenco, g().squadPlayers.length)
    menosGoleiros = Math.min(menosGoleiros, g().squadPlayers.filter(p => p.position === "GOL").length)
  }
  const antes = g()
  g().processSeasonEnd(antes.currentSeason + 1, antes.serieAStandings, antes.serieAStandings)
}
ok("6 temporadas sem o elenco furar o piso", menorElenco >= ELENCO_MINIMO, `menor elenco = ${menorElenco}`)
ok("nunca ficou sem goleiro", menosGoleiros >= 1, `menos goleiros = ${menosGoleiros}`)
// `weeklyExpenses` carrega tambem comissao tecnica e olheiros, entao o que se
// cobra e o MOVIMENTO: a despesa tem de cair exatamente o quanto a folha caiu.
const movimentoDaDespesa = g().weeklyExpenses - despesaInicial
const movimentoDaFolha = folhaDe(g().squadPlayers) - folhaInicial
ok("a despesa acompanha o movimento da folha (nao fica congelada)",
  Math.abs(movimentoDaDespesa - movimentoDaFolha) < 1,
  `despesa moveu ${Math.round(movimentoDaDespesa)}, folha moveu ${Math.round(movimentoDaFolha)}`)

console.log(falhas === 0 ? "\nRESULTADO: TUDO OK" : `\nRESULTADO: ${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
