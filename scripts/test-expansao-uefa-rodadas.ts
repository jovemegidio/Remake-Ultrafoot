/**
 * EXPANSAO UEFA: rodadas coerentes.
 *
 * A 1.0.279 criou `lib/uefa-expansion.ts` com quatro segundas divisoes reais.
 * Duas armadilhas apareceram, e este teste trava as duas:
 *
 *   1. TURNOS MULTIPLOS. A Challenge League suica joga QUATRO turnos entre dez
 *      clubes (36 jogos). O gate de regulamentos exige
 *      `rounds === (teams - 1) * roundRobinCycles` e assume 2 turnos quando o
 *      campo falta — a Suica reprovava a publicacao inteira.
 *
 *   2. CALENDARIO x COMPETICAO. `LEAGUE_CALENDAR` nao conhece nenhuma divisao
 *      `uefa_*`, entao `getLeagueRounds` devolvia 38 para ligas que declaram
 *      21, 30, 34 e 36. Quando o calendario pede mais rodadas do que a
 *      competicao tem, A LIGA NUNCA FECHA A TEMPORADA — o mesmo defeito que a
 *      Pro League belga ja teve.
 */
import { UEFA_EXPANSION_COMPETITIONS } from "../lib/uefa-expansion"
import { getLeagueRounds } from "../lib/use-game-manager"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

console.log("\nEXPANSAO UEFA — RODADAS\n")

const todas = Object.entries(UEFA_EXPANSION_COMPETITIONS).map(([id, lista]) => ({ id, c: lista[0] }))
console.log(`  (${todas.length} divisoes da expansao)\n`)

// 1. A regra do gate vale para TODA divisao de pontos corridos.
{
  const quebradas = todas
    .filter(({ c }) => c.format === "points")
    .filter(({ c }) => c.rounds !== (c.teams - 1) * c.roundRobinCycles)
    .map(({ id, c }) => `${id} (${c.teams} clubes, ${c.rounds} rodadas, ${c.roundRobinCycles} turnos)`)
  ok("pontos corridos: rodadas = (clubes-1) x turnos", quebradas.length === 0, quebradas.join("; "))
}

// 2. Turnos sempre positivos — um zero aqui zeraria o campeonato.
{
  const zeradas = todas.filter(({ c }) => !(c.roundRobinCycles >= 1)).map(x => x.id)
  ok("todo turno e >= 1", zeradas.length === 0, zeradas.join(", "))
}

// 3. A Suica e o caso que reprovou a publicacao: 10 clubes, 4 turnos, 36 jogos.
{
  const sui = UEFA_EXPANSION_COMPETITIONS["uefa_sui_2"]?.[0]
  ok("Suica 2a existe", Boolean(sui))
  ok("Suica: 10 clubes", sui?.teams === 10, `${sui?.teams}`)
  ok("Suica: 36 rodadas", sui?.rounds === 36, `${sui?.rounds}`)
  ok("Suica: 4 turnos", sui?.roundRobinCycles === 4, `${sui?.roundRobinCycles}`)
}

// 4. O CALENDARIO CONCORDA COM A COMPETICAO. Este e o que impede temporada
//    travada: pedir 38 rodadas de uma liga que so tem 21.
{
  const divergentes = todas
    .filter(({ id, c }) => getLeagueRounds(id) !== c.rounds)
    .map(({ id, c }) => `${id}: calendario ${getLeagueRounds(id)} x competicao ${c.rounds}`)
  ok("calendario pede exatamente o que a competicao tem", divergentes.length === 0,
    divergentes.slice(0, 6).join("; "))
}

// 5. Os quatro paises com segunda divisao verificada, um a um.
{
  const esperado: Record<string, number> = {
    uefa_aut_2: 30, uefa_pol_2: 34, uefa_rou_2: 21, uefa_sui_2: 36,
  }
  for (const [id, rodadas] of Object.entries(esperado)) {
    ok(`${id}: competicao e calendario dizem ${rodadas}`,
      UEFA_EXPANSION_COMPETITIONS[id]?.[0]?.rounds === rodadas && getLeagueRounds(id) === rodadas,
      `competicao ${UEFA_EXPANSION_COMPETITIONS[id]?.[0]?.rounds}, calendario ${getLeagueRounds(id)}`)
  }
}

// 6. Divisao desconhecida continua caindo no padrao — nao quebrar o resto.
{
  ok("divisao fora da expansao mantem o padrao 38", getLeagueRounds("divisao_que_nao_existe") === 38)
  ok("liga do LEAGUE_CALENDAR nao foi afetada", getLeagueRounds("serie_a") === 38)
}

console.log(`\n${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)
