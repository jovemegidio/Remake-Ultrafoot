// A CORRECAO DA VIRADA RESOLVE PARA TODO MUNDO? — varre uma pasta de bundles.
//
// Para cada carreira de cada save responde, com as funcoes de verdade do jogo:
//   - a temporada estava TRAVADA (liga dinamica, comportamento antigo)?
//   - ela destrava com a liga congelada + piso de um turno (a correcao)?
//   - o clube muda de divisao quando ela fechar?
//
//   npx tsx scripts/diag-saves-lote.ts <pasta-com-bundles>
import fs from "node:fs"
import path from "node:path"
import {
  getUserLeagueTeams, resolveLeagueTeams, getLeagueName, computeStandingsFromFixtures,
  generateBrasileirao, reconcilePlayedFixtures, getStateChampRounds, type Fixture,
} from "../lib/use-game-manager"
import { getTeamByShort, effectiveDivision, setClubDivisions } from "../lib/teams-data"
import { isSeasonOver, isOverdueUserFixture } from "../lib/fixture-catchup"
import { evolvePyramids } from "../lib/league-pyramid"
import { allTeams } from "../lib/teams-data"

const pasta = process.argv[2]
if (!pasta) { console.error("uso: tsx scripts/diag-saves-lote.ts <pasta>"); process.exit(1) }

interface Linha {
  arquivo: string; carreira: string; clube: string; divisao: string
  temporada: number; semana: number
  fimAntes: number; fimDepois: number; passouDoFim: boolean
  antesTravado: boolean; depoisTravado: boolean
  ligaAntes: number; ligaDepois: number
  simuladasAntes: number; simuladasDepois: number
  proximaDivisao: string
}
const linhas: Linha[] = []
const erros: string[] = []

function medir(
  times: { curto: string }[], me: string, liga: string, div: string,
  season: number, semana: number, resultados: unknown[], chaves: string[],
  offset: number,
  /** A FORMULA DO PISO. "antiga" = `(times-1)*2`, impossivel em liga impar;
   *  "nova" = um turno. Medir os dois lados com a formula nova esconderia
   *  metade da correcao — foi o erro da primeira versao deste script. */
  piso: "antiga" | "nova",
) {
  const cal = reconcilePlayedFixtures(
    generateBrasileirao(times as never, me, liga, div, offset) as Fixture[],
    resultados as never, season, chaves,
  )
  const meus = cal.filter(f => f.isUserMatch)
  const pendentes = meus.filter(f => !f.played)
  // O catch-up simula sozinho tudo o que ficou no passado.
  const atrasadas = pendentes.filter(f => isOverdueUserFixture(f, semana))
  const restam = pendentes.length - atrasadas.length
  const exigido = piso === "antiga"
    ? Math.max(1, (times.length - 1) * 2)
    : Math.max(1, times.length - 1)
  const seasonEndWeek = Math.max(...cal.map(f => f.week))
  // Depois do proximo avanco: as atrasadas viram jogadas.
  const completa = meus.length >= exigido && restam === 0
  const fecha = isSeasonOver({
    leagueComplete: completa, currentWeek: semana, seasonEndWeek,
    userFixtures: meus.map(f => ({ played: f.played || isOverdueUserFixture(f, semana) })),
  })
  // ⚠️ "nao fecha" NAO e o mesmo que "travada". Uma carreira na semana 3 nao
  // fecha porque a temporada mal comecou — isso e o certo. TRAVADA e so quem ja
  // passou do fim do calendario e ainda assim nao fecha: esse jogador clica
  // "avancar" para sempre dentro do mesmo ano.
  const passouDoFim = semana > seasonEndWeek
  return { fecha, travada: passouDoFim && !fecha, passouDoFim, seasonEndWeek, simuladas: atrasadas.length, cal }
}

for (const arquivo of fs.readdirSync(pasta).filter(f => f.endsWith(".json"))) {
  const caminho = path.join(pasta, arquivo)
  let entries: Record<string, string>
  try { entries = JSON.parse(fs.readFileSync(caminho, "utf8")).entries } catch { erros.push(`${arquivo}: ilegivel`); continue }

  const indice = entries["ultrafoot:career-index"]
  if (!indice) continue
  let carreiras: { id: string }[] = []
  try { carreiras = JSON.parse(indice) } catch { continue }

  for (const { id } of carreiras) {
    const bruto = entries[`ultrafoot:save:${id}`]
    const bruteEngine = entries[`ultrafoot-game-engine:${id}`]
    if (!bruto || !bruteEngine) continue
    let save: Record<string, never>, eng: Record<string, never>
    try {
      save = JSON.parse(bruto)
      eng = JSON.parse(bruteEngine).state
    } catch { erros.push(`${arquivo}/${id}: json`); continue }

    const me = save.selectedTeamShort as unknown as string
    const time = me ? getTeamByShort(me) : undefined
    if (!time) { erros.push(`${arquivo}/${id}: clube ${me} nao existe`); continue }

    setClubDivisions(save.clubDivisions)
    const divOverride = save.divisionOverride as unknown as string | undefined
    const div = divOverride ?? effectiveDivision(time)
    const liga = getLeagueName(me, divOverride)
    const season = save.season as unknown as number
    const semana = save.week as unknown as number
    const tabela = (eng.serieAStandings ?? []) as unknown as { teamShort: string }[]
    const congelada = (save.leagueTeams as unknown as string[])?.length
      ? (save.leagueTeams as unknown as string[])
      : tabela.map(l => l.teamShort).filter(Boolean)
    const resultados = (eng.matchResults ?? []) as unknown[]
    const chaves = (save.completedFixtureKeys ?? []) as unknown as string[]

    let antes, depois
    try {
      const offset = getStateChampRounds(me)
      antes = medir(getUserLeagueTeams(me, divOverride), me, liga, div, season, semana, resultados, chaves, offset, "antiga")
      depois = medir(resolveLeagueTeams(me, divOverride, congelada), me, liga, div, season, semana, resultados, chaves, offset, "nova")
    } catch (e) { erros.push(`${arquivo}/${id}: ${(e as Error).message}`); continue }

    let proxima = div
    try {
      const derivada = [...computeStandingsFromFixtures(depois.cal, liga)].sort((a, b) =>
        b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor)
      if (derivada.length) {
        const moved = evolvePyramids({
          clubs: allTeams.map(t => ({ curto: t.curto, division: effectiveDivision(t), prestige: t.prestigio ?? 60 })),
          userDivision: div, userFinalOrder: derivada.map(l => l.teamShort), seed: season,
        })
        proxima = moved[me] ?? div
      }
    } catch { /* piramide e extra */ }

    linhas.push({
      arquivo: arquivo.slice(0, 8), carreira: id.slice(-6), clube: me, divisao: div,
      temporada: season, semana, fimAntes: antes.seasonEndWeek, fimDepois: depois.seasonEndWeek,
      passouDoFim: antes.passouDoFim || depois.passouDoFim,
      antesTravado: antes.travada, depoisTravado: depois.travada,
      ligaAntes: getUserLeagueTeams(me, divOverride).length, ligaDepois: congelada.length,
      simuladasAntes: antes.simuladas, simuladasDepois: depois.simuladas,
      proximaDivisao: proxima,
    })
  }
}

// De-duplica: o mesmo save aparece em varios arquivos (backups da mesma conta).
const unicas = [...new Map(linhas.map(l => [`${l.carreira}|${l.semana}|${l.clube}`, l])).values()]
console.log(`carreiras analisadas: ${linhas.length} (${unicas.length} distintas)\n`)
console.log("carreira clube div        temp/sem  fim  situacao                liga(din>congelada)  simuladas  proxima")
for (const l of unicas.sort((a, b) => b.semana - a.semana)) {
  const situacao = l.antesTravado ? "TRAVADA (passou do fim)"
    : l.passouDoFim ? "passou do fim, fecha  "
    : "temporada em andamento"
  console.log(
    `${l.carreira} ${l.clube.padEnd(5)} ${l.divisao.padEnd(10)}` +
    ` ${l.temporada}/${String(l.semana).padStart(2)} ${String(l.fimDepois).padStart(4)}  ${situacao}` +
    `  ${String(l.ligaAntes).padStart(3)} > ${String(l.ligaDepois).padStart(3)}` +
    `            ${String(l.simuladasAntes).padStart(3)} > ${String(l.simuladasDepois).padStart(3)}` +
    `     ${l.divisao === l.proximaDivisao ? "(fica)" : "-> " + l.proximaDivisao}`)
}

const passaram = unicas.filter(l => l.passouDoFim)
console.log(`\ncarreiras que ja passaram do fim da temporada: ${passaram.length}`)
console.log(`  TRAVADAS antes da correcao: ${passaram.filter(l => l.antesTravado).length}`)
console.log(`  TRAVADAS depois da correcao: ${passaram.filter(l => l.depoisTravado).length}`)
const ligaMudou = unicas.filter(l => l.ligaAntes !== l.ligaDepois)
console.log(`\ncarreiras cuja liga JA mudou de tamanho (a bomba armada): ${ligaMudou.length} de ${unicas.length}`)
for (const l of ligaMudou) {
  console.log(`  ${l.clube} (${l.divisao}): jogou com ${l.ligaDepois}, o jogo hoje monta ${l.ligaAntes}` +
    ` — ${l.simuladasAntes} partidas fantasma evitadas`)
}
if (erros.length) {
  console.log(`\nnao analisadas (${erros.length}):`)
  for (const e of erros.slice(0, 15)) console.log("  -", e)
}
