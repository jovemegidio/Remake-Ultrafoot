import assert from "node:assert/strict"
import { competitionsByLeague } from "../lib/international-competitions"
import { allInternationalTeams } from "../lib/international-teams"
import {
  UEFA_EXPANSION_CLUBS,
  UEFA_EXPANSION_COMPETITIONS,
  UEFA_EXPANSION_FEDERATIONS,
} from "../lib/uefa-expansion"
import { divisionAbove, divisionBelow, promotionCount, relegationCount } from "../lib/league-pyramid"

assert.equal(UEFA_EXPANSION_FEDERATIONS.length, 37, "as 37 associações ausentes precisam existir no catálogo")
assert.equal(new Set(UEFA_EXPANSION_FEDERATIONS.map(item => item.code)).size, 37, "códigos UEFA não podem repetir")

const liechtenstein = UEFA_EXPANSION_FEDERATIONS.find(item => item.code === "lie")
assert(liechtenstein)
assert.equal(liechtenstein.top, null, "Liechtenstein não pode ganhar uma liga nacional fictícia")
assert.match(liechtenstein.crossBorderSystem ?? "", /suíça/i)

const topTiers = UEFA_EXPANSION_FEDERATIONS.flatMap(item => item.top ? [item.top] : [])
assert.equal(topTiers.length, 36, "as demais associações precisam expor a primeira divisão")
for (const division of topTiers) {
  assert.equal(division.participants.length, division.teams, `${division.id}: fotografia da elite incompleta`)
  assert.equal(competitionsByLeague[division.id]?.[0]?.teams, division.teams, `${division.id}: competição não integrada`)
  assert.equal(UEFA_EXPANSION_COMPETITIONS[division.id]?.[0]?.participantStatus, "provisional-snapshot")
}

assert.equal(new Set(UEFA_EXPANSION_CLUBS.map(club => club.file_key)).size, UEFA_EXPANSION_CLUBS.length, "file_key de clube duplicado")
assert.equal(new Set(UEFA_EXPANSION_CLUBS.map(club => club.curto)).size, UEFA_EXPANSION_CLUBS.length, "identidade curta de clube duplicada")
for (const club of UEFA_EXPANSION_CLUBS) {
  assert(allInternationalTeams.some(team => team.file_key === club.file_key), `${club.nome}: clube não entrou no catálogo jogável`)
}

const emptySeconds = UEFA_EXPANSION_FEDERATIONS.filter(item => item.second && item.second.participants.length === 0)
assert.equal(emptySeconds.length, 30, "o gate deve expor exatamente as segundas divisões ainda não abastecidas")

const verifiedSeconds = UEFA_EXPANSION_FEDERATIONS.flatMap(item => item.second?.participantStatus === "official-verified" ? [item.second] : [])
assert.equal(verifiedSeconds.length, 4, "Áustria, Polônia, Romênia e Suíça precisam ter a segunda divisão verificada")
assert.deepEqual(verifiedSeconds.map(item => item.id).sort(), ["uefa_aut_2", "uefa_pol_2", "uefa_rou_2", "uefa_sui_2"])
for (const division of verifiedSeconds) {
  assert.equal(division.participants.length, division.teams, `${division.id}: participantes oficiais incompletos`)
  assert.equal(UEFA_EXPANSION_COMPETITIONS[division.id]?.[0]?.rounds, division.rounds, `${division.id}: rodadas divergentes`)
  assert.equal(UEFA_EXPANSION_COMPETITIONS[division.id]?.[0]?.participantStatus, "official-verified")
  const federation = UEFA_EXPANSION_FEDERATIONS.find(item => item.code === division.id.split("_")[1])
  const elite = new Set(federation?.top?.participants ?? [])
  assert.equal(division.participants.filter(name => elite.has(name)).length, 0, `${division.id}: clube não pode ocupar elite e acesso simultaneamente`)
}
assert.equal(UEFA_EXPANSION_CLUBS.length, 504, "438 clubes de elite + 66 clubes das quatro segundas divisões")

const expectedSwaps: Record<string, number> = {
  uefa_aut_1: 1,
  uefa_pol_1: 3,
  uefa_rou_1: 2,
  uefa_sui_1: 1,
}
for (const [top, swaps] of Object.entries(expectedSwaps)) {
  const second = top.replace(/_1$/, "_2")
  assert.equal(divisionBelow(top), second, `${top}: segunda divisão não ligada à pirâmide viva`)
  assert.equal(divisionAbove(second), top, `${second}: elite não ligada à pirâmide viva`)
  assert.equal(relegationCount(top), swaps, `${top}: rebaixamento divergente`)
  assert.equal(promotionCount(second), swaps, `${second}: acesso divergente`)
}

console.log(`uefa-expansion: 37 associações, ${topTiers.length} elites e ${UEFA_EXPANSION_CLUBS.length} clubes explícitos validados; ${emptySeconds.length} segundas divisões ainda abertas`)
