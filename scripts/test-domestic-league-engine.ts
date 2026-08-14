import assert from "node:assert/strict"
import {
  calendarWindowForDivision,
  generateLeaguePairings,
  leagueNameForDivision,
  leagueSeasonPlan,
  type LeagueScheduleTeam,
} from "../lib/domestic-league-engine"

const teams = (count: number, prefix = "T"): LeagueScheduleTeam[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}${String(index + 1).padStart(2, "0")}`,
    name: `${prefix} ${index + 1}`,
  }))

function appearances(count: number, division: string, ranking?: string[]) {
  const entries = teams(count)
  const schedule = generateLeaguePairings({ division, teams: entries, regularRanking: ranking })
  const byTeam = new Map(entries.map(team => [team.id, 0]))
  for (const game of schedule) {
    assert.notEqual(game.homeId, game.awayId, `${division}: clube enfrenta a si mesmo`)
    byTeam.set(game.homeId, (byTeam.get(game.homeId) ?? 0) + 1)
    byTeam.set(game.awayId, (byTeam.get(game.awayId) ?? 0) + 1)
  }
  return { entries, schedule, byTeam }
}

{
  const { schedule, byTeam } = appearances(20, "premier_league")
  assert.equal(schedule.length, 380)
  assert.deepEqual(new Set(byTeam.values()), new Set([38]))
}

{
  const { schedule, byTeam } = appearances(24, "league_one_eng")
  assert.equal(schedule.length, 552)
  assert.deepEqual(new Set(byTeam.values()), new Set([46]))
}

{
  const { schedule, byTeam } = appearances(10, "scottish_league_one")
  assert.equal(schedule.length, 180)
  assert.deepEqual(new Set(byTeam.values()), new Set([36]))
}

{
  const { schedule, byTeam } = appearances(12, "premyer_liqa_aze")
  assert.equal(schedule.length, 198)
  assert.deepEqual(new Set(byTeam.values()), new Set([33]))
}

{
  const { schedule, byTeam } = appearances(12, "primera_div_par")
  assert.equal(schedule.length, 264)
  assert.deepEqual(new Set(byTeam.values()), new Set([44]))
  assert.equal(schedule.filter(game => game.stage === "apertura").length, 132)
  assert.equal(schedule.filter(game => game.stage === "clausura").length, 132)
}

{
  const mls = teams(30, "MLS")
  // Nomes suficientes para validar que a classificação nominal é aceita; os
  // demais são distribuídos deterministicamente entre as duas conferências.
  mls[0].name = "Inter Miami"
  mls[1].name = "New York City FC"
  const schedule = generateLeaguePairings({ division: "mls", teams: mls })
  const games = new Map(mls.map(team => [team.id, 0]))
  for (const game of schedule) {
    games.set(game.homeId, (games.get(game.homeId) ?? 0) + 1)
    games.set(game.awayId, (games.get(game.awayId) ?? 0) + 1)
  }
  assert.equal(schedule.length, 510)
  assert.deepEqual(new Set(games.values()), new Set([34]))
  assert.equal(Math.max(...schedule.map(game => game.round)), 34)
}

{
  const entries = teams(12, "DEN")
  const regular = generateLeaguePairings({ division: "superliga_den", teams: entries })
  assert.equal(regular.length, 132)
  const complete = generateLeaguePairings({
    division: "superliga_den",
    teams: entries,
    regularRanking: entries.map(team => team.id),
  })
  assert.equal(complete.length, 192)
  assert.equal(Math.max(...complete.map(game => game.round)), 32)
}

{
  const entries = teams(12, "SCO")
  const complete = generateLeaguePairings({
    division: "scottish_prem",
    teams: entries,
    regularRanking: entries.map(team => team.id),
  })
  assert.equal(complete.length, 228)
  assert.equal(leagueSeasonPlan("scottish_prem", 12).maximumMatches, 38)
}

{
  const entries = teams(16, "CZE")
  const complete = generateLeaguePairings({
    division: "fortuna_liga_cze",
    teams: entries,
    regularRanking: entries.map(team => team.id),
  })
  assert.equal(complete.length, 270) // 240 regulares + 15 título + 15 permanência
  assert.equal(Math.max(...complete.map(game => game.round)), 35)
  assert.equal(leagueSeasonPlan("fortuna_liga_cze", 16).maximumMatches, 35)
}

assert.equal(leagueNameForDivision("superliga_den"), "3F Superliga")
assert.equal(calendarWindowForDivision("eliteserien_nor").startMonth, 2)
assert.equal(calendarWindowForDivision("uefa_esp_1").startMonth, 7)

console.log("domestic-league-engine: formatos, turnos, segmentos, conferências e splits validados")
