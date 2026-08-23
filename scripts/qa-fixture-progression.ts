import { allPoolTeams, allTeams, getTeamsByDivision } from "../lib/teams-data"
import {
  generateBrasileirao,
  getDivisionLeagueTeams,
  getLeagueRounds,
  generateStateChampionshipFixtures,
  generateUserCupMatches,
  getCalendarFixtureKey,
  getOpponentPool,
  getStateChampionshipTeams,
  getUserCupPlan,
  reconcilePlayedFixtures,
  type Fixture,
} from "../lib/use-game-manager"
import type { MatchResult } from "../lib/game-engine"
import { competitionsByLeague } from "../lib/international-competitions"

const fail = (message: string): never => { throw new Error(message) }
const divisions = [...new Set(allTeams.map(team => String(team.divisao)))].filter(Boolean)
let auditedLeagues = 0
let auditedCupPlans = 0
const descompassos: string[] = []
let auditedStateClubs = 0

for (const division of divisions) {
  const teams = getTeamsByDivision(division as never)
  if (teams.length < 4) continue
  const fixtures = generateBrasileirao(teams, teams[0].curto, `QA ${division}`, division)
  const pairs = new Map<string, { count: number; directions: Set<string> }>()
  for (const fixture of fixtures) {
    if (fixture.homeTeam.curto === fixture.awayTeam.curto) fail(`${division}: clube joga contra si mesmo`)
    const pair = [fixture.homeTeam.curto, fixture.awayTeam.curto].sort().join("::")
    const data = pairs.get(pair) ?? { count: 0, directions: new Set<string>() }
    data.count++
    data.directions.add(`${fixture.homeTeam.curto}>${fixture.awayTeam.curto}`)
    pairs.set(pair, data)
  }
  // ⚠️ ESTE PORTÃO AFIRMAVA UMA REGRA QUE NÃO EXISTE.
  //
  // Ele exigia que TODO confronto de TODA divisão aparecesse exatamente 2x, em
  // dois mandos. Isso é falso por FORMATO, não por defeito, e reprovava geração
  // correta em pelo menos três casos reais:
  //
  //   uefa_rou_2  turno único (roundRobinCycles: 1) e play-off depois;
  //   uefa_sui_2  quatro encontros por dupla — 4x, mas em 2 mandos;
  //   mls         conferências: clubes de conferências diferentes não se
  //               enfrentam duas vezes.
  //
  // O que o portão existe para proteger é outra coisa, e essa sim é universal: a
  // temporada não pode acabar antes da hora. O defeito original era o calendário
  // encerrar no meio e rebaixar o clube depois de ~15 jogos.
  //
  // A invariante certa é POR CLUBE: todo mundo joga o número de partidas que a
  // competição declara, e todos jogam a MESMA quantidade — clube com jogo a mais
  // que os outros já apareceu aqui (ver a memória do calendário de divisão
  // ímpar).
  const declarada = Object.values(competitionsByLeague).flat().find(c => c.id === division)
  const jogosPorClube = new Map<string, number>()
  for (const fixture of fixtures) {
    jogosPorClube.set(fixture.homeTeam.curto, (jogosPorClube.get(fixture.homeTeam.curto) ?? 0) + 1)
    jogosPorClube.set(fixture.awayTeam.curto, (jogosPorClube.get(fixture.awayTeam.curto) ?? 0) + 1)
  }
  const contagens = [...new Set(jogosPorClube.values())]
  if (contagens.length !== 1) {
    fail(`${division}: clubes com números de jogos diferentes (${contagens.sort((a, b) => a - b).join("/")})`)
  }
  // Coerência INTERNA: o calendário tem de fechar com os clubes que existem.
  const ciclos = declarada?.roundRobinCycles ?? 2
  const esperadoPelaBase = (teams.length - 1) * ciclos
  // Formatos por conferência (MLS) não seguem esta conta; só cobramos onde a
  // competição é pontos corridos puros.
  if (declarada?.format === "points" && contagens[0] !== esperadoPelaBase) {
    fail(`${division}: cada clube joga ${contagens[0]}, mas ${teams.length} clubes em ${ciclos} ciclo(s) dão ${esperadoPelaBase}`)
  }

  // ⚠️ DESCOMPASSO ENTRE CATÁLOGO E BASE — relatado, não reprovado.
  //
  // `j_league` declara 20 clubes e a base tem 18; `mls` declara 30 e tem 24. O
  // calendário gerado está CERTO para os clubes que existem — o que falta é
  // clube na base, que é trabalho de dado (nome, escudo, cidade reais), não de
  // calendário. Reprovar aqui bloquearia toda publicação por uma lacuna de
  // conteúdo; ficar calado a esconderia. Então ela aparece no relatório.
  if (declarada?.teams && declarada.teams !== teams.length) {
    descompassos.push(`${division}: catálogo diz ${declarada.teams} clubes, a base tem ${teams.length}`)
  }
  if (jogosPorClube.size !== teams.length) {
    fail(`${division}: ${jogosPorClube.size} clubes no calendário para ${teams.length} na divisão`)
  }
  auditedLeagues++
}

// Regressão crítica: a Série A precisa sempre oferecer 38 partidas ao clube do
// usuário. Sem esta verificação era possível uma alteração no calendário encerrar
// a temporada antes do returno, causando rebaixamento após cerca de 15 jogos.
for (const team of allTeams.filter(team => String(team.divisao) === "serie_a")) {
  const leagueTeams = getDivisionLeagueTeams(team.curto)
  const fixtures = generateBrasileirao(leagueTeams, team.curto, "Brasileirão Série A", "serie_a")
  const userFixtures = fixtures.filter(fixture => fixture.isUserMatch)
  if (leagueTeams.length !== 20) fail(`${team.nome}: Série A não possui 20 participantes (${leagueTeams.length})`)
  if (userFixtures.length !== getLeagueRounds("serie_a")) {
    fail(`${team.nome}: Série A gerou ${userFixtures.length} jogos, esperado 38`)
  }
}

const brazilianDivisions = new Set(["serie_a", "serie_b", "serie_c", "serie_d"])
for (const userTeam of allTeams.filter(team => brazilianDivisions.has(String(team.divisao)))) {
  const teams = getStateChampionshipTeams(userTeam.curto)
  if (teams.length < 4) continue
  const fixtures = generateStateChampionshipFixtures(teams, userTeam.curto, `QA Estadual ${userTeam.estado}`)
  const directionalPairs = new Set<string>()
  const clubWeeks = new Set<string>()
  const fixtureKeys = new Set<string>()

  for (const fixture of fixtures) {
    if (fixture.homeTeam.curto === fixture.awayTeam.curto) {
      fail(`${userTeam.nome}: clube joga contra si mesmo no estadual`)
    }
    // O mesmo confronto pode reaparecer legitimamente em outra fase (ex.: fase
    // classificatória e quartas). Duplicidade é erro somente dentro da mesma fase.
    const directional = `${fixture.stage ?? "fase"}::${fixture.homeTeam.curto}>${fixture.awayTeam.curto}`
    if (directionalPairs.has(directional)) {
      fail(`${userTeam.nome}: mando estadual repetido ${directional}`)
    }
    directionalPairs.add(directional)
    for (const club of [fixture.homeTeam.curto, fixture.awayTeam.curto]) {
      const clubWeek = `${fixture.week}::${club}`
      if (clubWeeks.has(clubWeek)) fail(`${userTeam.nome}: ${club} joga duas vezes na semana estadual ${fixture.week}`)
      clubWeeks.add(clubWeek)
    }
    const key = getCalendarFixtureKey(fixture, 2026)
    if (fixtureKeys.has(key)) fail(`${userTeam.nome}: chave estadual duplicada ${key}`)
    fixtureKeys.add(key)
  }

  // Simula jogar, salvar e reconstruir o calendário depois de cada partida do
  // usuário. Uma partida concluída jamais pode voltar a ser a próxima.
  const userFixtures = fixtures.filter(fixture => fixture.isUserMatch).sort((a, b) => a.week - b.week)
  const results: MatchResult[] = []
  const completed: string[] = []
  for (let index = 0; index < userFixtures.length; index++) {
    const fixture = userFixtures[index]
    const fixtureKey = getCalendarFixtureKey(fixture, 2026)
    results.push({
      fixtureKey,
      fixtureId: fixture.id,
      week: fixture.week,
      season: 2026,
      competition: fixture.competition,
      homeTeam: fixture.homeTeam.curto,
      awayTeam: fixture.awayTeam.curto,
      homeScore: 1,
      awayScore: 0,
      events: [],
    })
    completed.push(fixtureKey)
    const rebuilt = reconcilePlayedFixtures(fixtures, results, 2026, completed)
    const next = rebuilt.filter(item => item.isUserMatch && !item.played).sort((a, b) => a.week - b.week)[0]
    if (next && getCalendarFixtureKey(next, 2026) === fixtureKey) {
      fail(`${userTeam.nome}: partida estadual concluída reapareceu após reconstruir o save`)
    }
    if (rebuilt.filter(item => item.isUserMatch && item.played).length !== index + 1) {
      fail(`${userTeam.nome}: resultado estadual concluiu quantidade incorreta de partidas`)
    }
  }
  auditedStateClubs++
}

for (const team of allTeams) {
  const leagueOpponents = new Set(
    getTeamsByDivision(team.divisao).filter(opponent => opponent.curto !== team.curto).map(opponent => opponent.curto),
  )
  const used = new Set(leagueOpponents)
  for (const plan of getUserCupPlan(team)) {
    const pool = getOpponentPool(team, plan)
    const unusedBefore = pool.filter(opponent => !used.has(opponent.curto)).length
    const matches = generateUserCupMatches(team, plan, 2026, used).filter(m => m !== null)
    const opponents = matches.map(match => match.homeTeam.curto === team.curto ? match.awayTeam.curto : match.homeTeam.curto)
    // Adversario REPETE de proposito agora: ida e volta e o mesmo rival duas
    // vezes, e a fase de grupos e turno e returno contra tres. O que nao pode e
    // o mesmo rival aparecer em FASES diferentes.
    const rivalPorFase = new Map<string, Set<string>>()
    for (const match of matches) {
      const rival = match.homeTeam.curto === team.curto ? match.awayTeam.curto : match.homeTeam.curto
      const fase = rivalPorFase.get(match.stage) ?? new Set<string>()
      fase.add(rival)
      rivalPorFase.set(match.stage, fase)
    }
    const rivaisPorFase = [...rivalPorFase.entries()]
    const repetidoEntreFases = rivaisPorFase.flatMap(([, rivais]) => [...rivais])
    if (unusedBefore >= matches.length && new Set(repetidoEntreFases).size !== repetidoEntreFases.length) {
      fail(`${team.nome}/${plan.competition.name}: mesmo adversário em fases diferentes`)
    }
    // Cada fase de confronto tem UM rival; a de grupos tem tres.
    for (const [fase, rivais] of rivaisPorFase) {
      const esperado = fase === "fase_grupos" ? 3 : 1
      if (rivais.size !== esperado) {
        fail(`${team.nome}/${plan.competition.name}: fase ${fase} com ${rivais.size} rivais (esperado ${esperado})`)
      }
    }
    if (unusedBefore >= matches.length && opponents.some(opponent => leagueOpponents.has(opponent))) {
      fail(`${team.nome}/${plan.competition.name}: repetiu rival da liga com alternativas nacionais`)
    }
    auditedCupPlans++
  }
}

const teamA = allPoolTeams[0]
const teamB = allPoolTeams.find(team => team.curto !== teamA.curto)!
const base = (id: number, week: number): Fixture => ({
  id,
  round: week,
  week,
  homeTeam: teamA,
  awayTeam: teamB,
  competition: "QA Cup",
  played: false,
  isUserMatch: true,
  month: 0,
  competitionType: "cup",
})
const fixtures = [base(50001, 1), base(50002, 2)]
const firstKey = getCalendarFixtureKey(fixtures[0], 2026)
const firstResult: MatchResult = {
  fixtureKey: firstKey,
  fixtureId: fixtures[0].id,
  week: 1,
  season: 2026,
  competition: "QA Cup",
  homeTeam: teamA.curto,
  awayTeam: teamB.curto,
  homeScore: 1,
  awayScore: 0,
  events: [],
}
const reconciled = reconcilePlayedFixtures(fixtures, [firstResult], 2026, [firstKey])
if (!reconciled[0].played || reconciled[1].played) fail("um placar concluiu mais de uma fixture")

const legacyResult = { ...firstResult, fixtureKey: undefined, fixtureId: undefined }
const legacy = reconcilePlayedFixtures(fixtures, [legacyResult], 2026)
if (legacy.filter(fixture => fixture.played).length !== 1) fail("migração antiga reaproveitou o mesmo placar")

const staleCalendarResult = { ...firstResult, fixtureKey: "2026::state::calendario-antigo::999" }
const migratedCalendar = reconcilePlayedFixtures(fixtures, [staleCalendarResult], 2026)
if (!migratedCalendar[0].played || migratedCalendar[1].played) {
  fail("resultado de calendário estadual antigo não migrou em relação 1:1")
}

if (descompassos.length > 0) {
  console.log(`
⚠️ ${descompassos.length} liga(s) com menos clubes na base do que o catálogo declara —`)
  console.log("   o calendário fecha certo para quem existe; falta clube cadastrado:")
  for (const d of descompassos) console.log("   - " + d)
  console.log("")
}
console.log(`OK calendário: ${auditedLeagues} ligas, ${auditedStateClubs} clubes em estaduais, ${auditedCupPlans} planos de copa e conclusão 1:1`)
