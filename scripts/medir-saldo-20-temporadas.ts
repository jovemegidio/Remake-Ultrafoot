// FERRAMENTA (nao e gate): o saldo de um clube ao longo de 20 temporadas SEM
// nenhuma decisao do tecnico. Roda o laco semanal de verdade do motor.
//
//   node node_modules/tsx/dist/cli.mjs scripts/medir-saldo-20-temporadas.ts ABC
//
// ⚠️ O QUE ELA JA DESMENTIU. A auditoria de 18/08/2026 anotou "economia estavel
// demais: saldo entre 130 e 200 milhoes por 20 temporadas". A medicao mostrou
// que o numero vinha do clube PADRAO do harness — o Bragantino, que comeca com
// 188 mi de caixa no cadastro (clube da Red Bull). Medindo outros:
//
//   ABC          1,0 mi -> oscila entre 0,6 e 1,3 mi nas 20 temporadas
//   Corinthians 10,0 mi -> cai a 15 mi, sobe a 98 mi na 20a
//   Bragantino 188,0 mi -> 234 mi na 20a
//
// Ou seja: a economia DIFERENCIA. Antes de calibrar por sintoma, medir com mais
// de um clube. Ver tambem scripts/qa-economia-longa.ts (o gate do modelo).

import { useGameEngine } from "../lib/game-engine"
const clube = process.argv[2] ?? "BGT"
useGameEngine.getState().initializeGame(clube)
const inicial = useGameEngine.getState().balance
const linhas: string[] = []
for (let s = 1; s <= 20; s++) {
  for (let w = 0; w < 52; w++) useGameEngine.getState().advanceWeek()
  const antes = useGameEngine.getState()
  useGameEngine.getState().processSeasonEnd(antes.currentSeason + 1, antes.serieAStandings, antes.serieAStandings)
  const e = useGameEngine.getState()
  linhas.push(`T${s}: saldo ${(e.balance/1_000_000).toFixed(1)} mi | elenco ${e.squadPlayers.length} | folha/sem ${(e.weeklyExpenses/1_000).toFixed(0)}k`)
}
console.log(`${clube}: saldo inicial ${(inicial/1_000_000).toFixed(1)} mi`)
console.log(linhas.join("\n"))
