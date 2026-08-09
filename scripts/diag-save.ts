// DIAGNOSTICO DE UM SAVE REAL — a temporada consegue virar?
//
// Recebe o bundle da nuvem (o JSON de /var/lib/ultrafoot/saves/<sha>.json) e
// refaz, com as FUNCOES DE VERDADE do jogo, a conta que `advanceWeek` faz toda
// semana: monta a liga, gera o calendario, concilia os resultados do motor e
// pergunta a `isSeasonOver` se acabou.
//
// Roda a conta DUAS vezes: com a liga dinamica (`getUserLeagueTeams`, o
// comportamento antigo) e com a liga congelada do save (`resolveLeagueTeams`,
// que e a correcao). A diferenca entre as duas e o bug.
//
//   npx tsx scripts/diag-save.ts <bundle.json>
import fs from "node:fs"
import {
  getUserLeagueTeams, resolveLeagueTeams, getLeagueRounds, getLeagueName, computeStandingsFromFixtures,
  generateBrasileirao, reconcilePlayedFixtures, type Fixture,
} from "../lib/use-game-manager"
import {
  getTeamByShort, getTeamsByDivision, effectiveDivision, setClubDivisions, tamanhoDaLiga, allTeams,
} from "../lib/teams-data"
import { evolvePyramids } from "../lib/league-pyramid"
import { isSeasonOver, isOverdueUserFixture } from "../lib/fixture-catchup"

const arquivo = process.argv[2]
if (!arquivo) { console.error("uso: tsx scripts/diag-save.ts <bundle.json>"); process.exit(1) }

const bundle = JSON.parse(fs.readFileSync(arquivo, "utf8"))
const entries: Record<string, string> = bundle.entries
// `active-career` e uma string crua no localStorage, nao JSON.
const careerId = entries["ultrafoot:active-career"].replace(/^"|"$/g, "")
const save = JSON.parse(entries[`ultrafoot:save:${careerId}`])
const engine = JSON.parse(entries[`ultrafoot-game-engine:${careerId}`]).state

const userShort: string = save.selectedTeamShort
const season: number = save.season
const divOverride: string | undefined = save.divisionOverride

console.log(`carreira ${careerId} — ${userShort}, temporada ${season}, semana ${save.week}`)
console.log(`semana do motor: ${engine.currentWeek} | divisionOverride: ${divOverride ?? "(nenhum)"}`)

setClubDivisions(save.clubDivisions)
const time = getTeamByShort(userShort)
const divisao = divOverride ?? (time ? effectiveDivision(time) : null) ?? "serie_a"
const nomeLiga = getLeagueName(userShort, divOverride)
console.log(`\ndivisao: ${divisao} | liga: "${nomeLiga}"`)
console.log(`curados na divisao: ${getTeamsByDivision(divisao).length}` +
  ` | alvo: ${tamanhoDaLiga(divisao)} | rodadas declaradas: ${getLeagueRounds(divisao)}`)

// A migracao da correcao: quando o save nao tem liga congelada, ela e adotada da
// tabela do motor (serieAStandings vale para qualquer divisao; o nome engana).
const tabela: { teamShort: string }[] = engine.serieAStandings ?? []
const congelada: string[] = save.leagueTeams?.length
  ? save.leagueTeams
  : tabela.map(l => l.teamShort).filter(Boolean)

const resultados = engine.matchResults ?? []

function conta(rotulo: string, times: { curto: string }[]) {
  const calendario = generateBrasileirao(
    times as never, userShort, nomeLiga, divisao, 0,
  ) as Fixture[]
  const conciliado = reconcilePlayedFixtures(
    calendario, resultados, season, save.completedFixtureKeys ?? [],
  )
  const doUsuario = conciliado.filter(f => f.isUserMatch)
  const pendentes = doUsuario.filter(f => !f.played)
  const exigido = Math.max(1, times.length - 1)
  const leagueComplete = doUsuario.length >= exigido && pendentes.length === 0
  const seasonEndWeek = Math.max(...calendario.map(f => f.week))
  const acabou = isSeasonOver({
    leagueComplete, currentWeek: save.week, seasonEndWeek, userFixtures: doUsuario,
  })

  console.log(`\n── ${rotulo} ──`)
  console.log(`  clubes: ${times.length} | jogos do clube: ${doUsuario.length}` +
    ` | exigido: ${exigido} | pendentes: ${pendentes.length}`)
  console.log(`  leagueComplete = ${leagueComplete}   ->   isSeasonOver = ${acabou}`)
  if (pendentes.length && pendentes.length <= 6) {
    for (const f of pendentes) {
      console.log(`    sem par: r${f.round} ${f.homeTeam.curto} x ${f.awayTeam.curto}`)
    }
  } else if (pendentes.length) {
    console.log(`    (${pendentes.length} partidas sem par — a temporada nunca fecha)`)
  }

  // As pendentes que ficaram no PASSADO sao simuladas pelo catch-up no proximo
  // "avancar semana" (isOverdueUserFixture). Se todas forem dessas, a temporada
  // fecha nesse mesmo avanco.
  const atrasadas = pendentes.filter(f => isOverdueUserFixture(f, save.week))
  if (pendentes.length) {
    const sobra = pendentes.length - atrasadas.length
    console.log(`  atrasadas (o motor resolve sozinho ao avancar): ${atrasadas.length}` +
      ` | ficariam pendentes: ${sobra}`)
    if (sobra === 0) {
      console.log(`  => apos o proximo avanco: leagueComplete = true, isSeasonOver = ` +
        isSeasonOver({ leagueComplete: true, currentWeek: save.week, seasonEndWeek, userFixtures: doUsuario.map(() => ({ played: true })) }))
    }
  }
  return { leagueComplete, acabou }
}

conta("ANTES — liga dinamica (getUserLeagueTeams)", getUserLeagueTeams(userShort, divOverride))
conta("DEPOIS — liga congelada (resolveLeagueTeams)", resolveLeagueTeams(userShort, divOverride, congelada))

// A POSICAO FINAL QUE A VIRADA VAI USAR. Nao e a tabela do motor: a virada
// deriva a classificacao dos FIXTURES conciliados (computeStandingsFromFixtures)
// e so cai na tabela do motor se aquilo vier vazio. E dessa posicao que sai o
// acesso — vale conferir as duas.
const calFinal = reconcilePlayedFixtures(
  generateBrasileirao(
    resolveLeagueTeams(userShort, divOverride, congelada) as never,
    userShort, nomeLiga, divisao, 0,
  ) as Fixture[],
  resultados, season, save.completedFixtureKeys ?? [],
)
const ordenar = <T extends { teamShort: string; points: number; goalsFor: number; goalsAgainst: number }>(l: T[]) =>
  [...l].sort((a, b) =>
    b.points - a.points ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor)

const derivada = ordenar(computeStandingsFromFixtures(calFinal, nomeLiga))
// `engine` vem de JSON.parse, entao e `any`: passado direto ao generico, T caia
// na RESTRICAO (so points/goalsFor/goalsAgainst) e `teamShort` sumia. A anotacao
// explicita e o mesmo padrao ja usado na `tabela`, mais acima neste arquivo.
const tabelaDoMotor: { teamShort: string; points: number; goalsFor: number; goalsAgainst: number }[] =
  engine.serieAStandings ?? []
const doMotor = ordenar(tabelaDoMotor)
const posDerivada = derivada.findIndex(l => l.teamShort === userShort) + 1
const posMotor = doMotor.findIndex(l => l.teamShort === userShort) + 1
console.log(`\nposicao final — derivada dos fixtures: ${posDerivada}o de ${derivada.length}` +
  ` (${derivada[posDerivada - 1]?.points} pts)`)
console.log(`posicao final — tabela do motor:     ${posMotor}o de ${doMotor.length}` +
  ` (${doMotor[posMotor - 1]?.points} pts)`)
console.log(`\ntopo derivado dos fixtures:`)
derivada.slice(0, 6).forEach((l, i) =>
  console.log(`  ${i + 1}o ${l.teamShort} ${l.points} pts (${l.played} J)`))

// A divisao da proxima temporada sai de `evolvePyramids` — a mesma chamada da
// virada (lib/league-pyramid), NAO do modulo antigo promotion-relegation.
const moved = evolvePyramids({
  clubs: allTeams.map(t => ({ curto: t.curto, division: effectiveDivision(t), prestige: t.prestigio ?? 60 })),
  userDivision: divisao,
  userFinalOrder: derivada.map(l => l.teamShort),
  seed: season,
})
console.log(`\nevolvePyramids -> divisao de ${userShort} em ${season + 1}: ` +
  `${moved[userShort] ?? divisao}${moved[userShort] && moved[userShort] !== divisao ? "  ✅ MUDOU" : ""}`)
