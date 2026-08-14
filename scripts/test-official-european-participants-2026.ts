import assert from "node:assert/strict"
import { OFFICIAL_EUROPEAN_PARTICIPANTS_2026 } from "../lib/official-european-participants-2026"
import { completarLigaComPool } from "../lib/teams-data"

const pairs = [
  ["premier_league", "championship"],
  ["primeira_liga", "liga_portugal_2"],
  ["eredivisie", "eerste_divisie"],
  ["super_lig", "tff_1_lig"],
  ["russian_prem", "russian_first"],
  ["la_liga", "la_liga_2"],
  ["bundesliga", "bundesliga_2"],
  ["ligue_1", "ligue_2"],
  ["serie_a_ita", "serie_b_ita"],
  ["pro_league_bel", "challenger_pro"],
  ["scottish_prem", "scottish_champ"],
] as const

for (const [top, second] of pairs) {
  const topTeams = completarLigaComPool(top)
  const secondTeams = completarLigaComPool(second)
  assert.equal(topTeams.length, OFFICIAL_EUROPEAN_PARTICIPANTS_2026[top].participants.length, `${top}: participantes incompletos`)
  assert.equal(secondTeams.length, OFFICIAL_EUROPEAN_PARTICIPANTS_2026[second].participants.length, `${second}: participantes incompletos`)
  assert.equal(new Set(topTeams.map(team => team.file_key)).size, topTeams.length, `${top}: clube duplicado`)
  assert.equal(new Set(secondTeams.map(team => team.file_key)).size, secondTeams.length, `${second}: clube duplicado`)
  const topKeys = new Set(topTeams.map(team => team.file_key))
  assert(!secondTeams.some(team => topKeys.has(team.file_key)), `${top}/${second}: mesmo clube nos dois níveis`)
}

assert.equal(completarLigaComPool("challenger_pro").length, 15)
assert.equal(completarLigaComPool("scottish_champ").length, 10)
assert.equal(completarLigaComPool("russian_first").length, 18)
console.log("official-europe-2026: 22 divisões com participantes oficiais, identidade única e sem vazamento entre níveis")
