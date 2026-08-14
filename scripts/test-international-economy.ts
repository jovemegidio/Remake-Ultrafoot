import assert from "node:assert/strict"
import { leaguePrizeMoney, playerSalaryWeekly, weeklyIncomeFor } from "../lib/club-economy"

const playablePyramids = [
  ["championship", "league_one_eng"],
  ["league_one_eng", "league_two_eng"],
  ["la_liga_2", "primera_federacion_esp"],
  ["bundesliga_2", "dritte_liga_ger"],
  ["ligue_2", "national_fra"],
  ["liga_portugal_2", "liga_3_por"],
  ["scottish_champ", "scottish_league_one"],
  ["challenger_pro", "first_national_bel"],
  ["tff_1_lig", "tff_2_lig"],
  ["super_league_gre", "super_league_2_gre"],
  ["primera_div_per", "liga_2_per"],
  ["primera_div_bol", "copa_simon_bolivar"],
  ["primera_div_par", "division_intermedia_par"],
  ["primera_div_ven", "liga_futve_2"],
  ["superliga_den", "betinia_liga"],
  ["eliteserien_nor", "obos_ligaen"],
  ["protathlima_cyp", "second_div_cyp"],
  ["fortuna_liga_cze", "chance_narodni_liga"],
] as const

for (const [topFlight, secondTier] of playablePyramids) {
  assert.ok(
    weeklyIncomeFor(topFlight, 60) > weeklyIncomeFor(secondTier, 60),
    `${topFlight}: receita da elite precisa superar a segunda divisão`,
  )
  assert.ok(
    playerSalaryWeekly(70, topFlight) > playerSalaryWeekly(70, secondTier),
    `${topFlight}: salário da elite precisa superar a segunda divisão`,
  )
}

for (const division of [
  "primera_div_per", "primera_div_bol", "primera_div_par", "primera_div_ven",
  "super_league_gre", "superliga_den", "fortuna_liga_cze", "premyer_liqa_aze",
  "eliteserien_nor", "protathlima_cyp", "premier_liga_kaz",
]) {
  assert.ok(
    leaguePrizeMoney(division, 1, 16) > leaguePrizeMoney(division, 16, 16),
    `${division}: campeão precisa receber mais que o último colocado`,
  )
}

console.log("international-economy: salários, receitas e prêmios por país validados")
