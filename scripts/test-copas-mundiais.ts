import assert from "node:assert/strict"
import { getOpponentPool, getUserCupPlan } from "../lib/use-game-manager"
import { allTeams } from "../lib/teams-data"
import { getCountryCompetitions } from "../lib/country-competitions"

const cases = [
  ["copenhagen", "Copa da Dinamarca", true],
  ["aalborg_din", "Copa da Dinamarca", false],
  ["bodo_glimt", "Copa da Noruega", true],
  ["stromsgodset_nor", "Copa da Noruega", false],
  ["pafos_fc", "Copa do Chipre", true],
  ["akritas_chlorakas", "Copa do Chipre", false],
  ["sparta_tch", "Copa da Chequia", true],
] as const

for (const [fileKey, expectedCup, expectedContinental] of cases) {
  const team = allTeams.find(candidate => candidate.file_key === fileKey)
  assert(team, `${fileKey}: clube ausente`)
  const plans = getUserCupPlan(team, [], null, 2027, 1)
  const cup = plans.find(plan => plan.competitionType === "cup")
  assert.equal(cup?.competition.name, expectedCup, `${fileKey}: copa nacional incorreta`)
  assert.equal(plans.some(plan => plan.competitionType === "continental"), expectedContinental, `${fileKey}: elegibilidade continental incorreta`)
  assert(cup && getOpponentPool(team, cup).length >= 4, `${fileKey}: copa sem adversários nacionais`)
  if (cup) {
    const country = getCountryCompetitions(String(team.divisao)).country
    const opponents = getOpponentPool(team, cup)
    assert(opponents.every(opponent => getCountryCompetitions(String(opponent.divisao)).country === country || String(opponent.pais ?? opponent.estado) === country), `${fileKey}: copa contém clube estrangeiro`)
  }
}

console.log("copas-mundiais: copas nacionais e vagas continentais derivadas para elites e divisões inferiores")
