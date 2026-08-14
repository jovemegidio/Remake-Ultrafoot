import clubs from "../data/seeds/real-clubs-stage3-czech-second.json"
import { completarLigaComPool } from "../lib/teams-data"
import { competitionsByLeague } from "../lib/international-competitions"
import { getCountryCompetitions } from "../lib/country-competitions"
import { promotionCount, relegationCount } from "../lib/league-pyramid"
import { getPlayersForTeam } from "../lib/players-data"

const fail = (message: string): never => {
  console.error(`FALHA: ${message}`)
  process.exit(1)
}

if (clubs.length !== 16) fail(`esperava 16 clubes, encontrou ${clubs.length}`)
if (new Set(clubs.map(club => club.file_key)).size !== 16) fail("há file_key repetido")
if (new Set(clubs.map(club => club.curto)).size !== 16) fail("há código curto repetido")

const league = completarLigaComPool("chance_narodni_liga")
if (league.length !== 16) fail(`a liga joga com ${league.length} clubes`)
if (!league.some(team => team.file_key === "mfk_karvina")) fail("MFK Karvina não entrou na segunda divisão")
if (league.some(team => team.file_key === "artis_brno")) fail("Artis Brno permaneceu indevidamente na segunda divisão")

const reserves = league.filter(team => team.promotionEligible === false)
if (reserves.map(team => team.file_key).sort().join(",") !== "banik_ostrava_b,slavia_praha_b") {
  fail("equipes B não estão marcadas corretamente")
}
for (const team of league) {
  const squad = getPlayersForTeam(team, { raw: true })
  if (squad.length < 18) fail(`${team.nome} tem apenas ${squad.length} atletas`)
  if (squad.some(player => player.generatedOrigin === "provisional")) fail(`${team.nome} ainda usa complemento provisório`)
}

const competition = competitionsByLeague.chance_narodni_liga?.[0]
if (competition?.teams !== 16 || competition.rounds !== 30 || competition.promotion !== 1) {
  fail("regulamento da Chance Národní Liga divergente")
}
if (promotionCount("chance_narodni_liga") !== 1 || relegationCount("fortuna_liga_cze") !== 1) {
  fail("acesso direto Chequia não foi conectado")
}
if (getCountryCompetitions("chance_narodni_liga").domesticCup !== "Copa da Chequia") {
  fail("segunda divisão não foi conectada à copa nacional")
}

console.log("stage3-czech: 16 clubes e elencos reais, 30 rodadas, acesso direto e equipes B bloqueadas")
