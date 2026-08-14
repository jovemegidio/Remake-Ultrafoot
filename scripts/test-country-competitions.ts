import assert from "node:assert/strict"
import { getConfederation, getCountryCompetitions } from "../lib/country-competitions"
import { TAMANHO_OFICIAL_DA_LIGA } from "../lib/teams-data"
import { competitionsByLeague } from "../lib/international-competitions"

const falhas: string[] = []
const estaduais = new Set(["paulistao", "carioca", "mineiro", "gaucho"])
const nationalDivisions = new Set([
  ...Object.keys(TAMANHO_OFICIAL_DA_LIGA),
  ...Object.keys(competitionsByLeague).filter(division => !estaduais.has(division)),
])
for (const division of nationalDivisions) {
  const competitions = getCountryCompetitions(division)
  const confederation = getConfederation(division)
  if (competitions.country === "Internacional") falhas.push(`${division}: sem pais`)
  if (competitions.domesticCup === "Copa Nacional") falhas.push(`${division}: copa generica`)
  if (confederation === "UNAFFILIATED") falhas.push(`${division}: sem confederacao`)
}

assert.deepEqual(falhas, [], falhas.join("\n"))
assert.equal(getConfederation("divisao_inventada"), "UNAFFILIATED")
assert.deepEqual(getContinentalSafe("divisao_inventada"), [])

function getContinentalSafe(division: string) {
  const conf = getConfederation(division)
  return conf === "UNAFFILIATED" ? [] : [conf]
}

console.log(`country-competitions: ${nationalDivisions.size} divisoes cobertas sem fallback`)
