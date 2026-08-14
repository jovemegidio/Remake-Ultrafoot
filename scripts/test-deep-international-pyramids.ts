import assert from "node:assert/strict"
import {
  TAMANHO_OFICIAL_DA_LIGA,
  clubDivisionKey,
  completarLigaComPool,
  effectiveDivision,
  getTeamByFileKey,
} from "../lib/teams-data"
import {
  divisionAbove, divisionBelow, evolvePyramids, promotionCount, relegationCount,
  type PyramidClub,
} from "../lib/league-pyramid"

const pyramids = {
  Inglaterra: ["premier_league", "championship", "league_one_eng", "league_two_eng", "national_league_eng", "national_league_ns_eng"],
  Espanha: ["la_liga", "la_liga_2", "primera_federacion_esp", "segunda_federacion_esp"],
  Alemanha: ["bundesliga", "bundesliga_2", "dritte_liga_ger"],
  Franca: ["ligue_1", "ligue_2", "national_fra"],
  Portugal: ["primeira_liga", "liga_portugal_2", "liga_3_por", "campeonato_portugal"],
  Escocia: ["scottish_prem", "scottish_champ", "scottish_league_one", "scottish_league_two"],
  Belgica: ["pro_league_bel", "challenger_pro", "first_national_bel"],
  Turquia: ["super_lig", "tff_1_lig", "tff_2_lig"],
  Grecia: ["super_league_gre", "super_league_2_gre"],
} as const

for (const [country, tiers] of Object.entries(pyramids)) {
  const seen = new Set<string>()
  const seenShorts = new Set<string>()
  const pyramidClubs: PyramidClub[] = []
  for (const [index, division] of tiers.entries()) {
    const clubs = completarLigaComPool(division)
    assert.equal(
      clubs.length,
      TAMANHO_OFICIAL_DA_LIGA[division],
      `${country}/${division}: tamanho da divisão`,
    )
    for (const club of clubs) {
      const key = clubDivisionKey(club)
      assert.ok(!seen.has(key), `${country}: ${club.nome} aparece em mais de uma divisão`)
      assert.ok(!seenShorts.has(club.curto), `${country}: código ${club.curto} aparece em mais de uma divisão`)
      seen.add(key)
      seenShorts.add(club.curto)
      assert.equal(getTeamByFileKey(club.file_key)?.file_key, club.file_key)
      assert.equal(effectiveDivision(club), division)
      pyramidClubs.push({
        id: key,
        curto: club.curto,
        division,
        prestige: club.prestigio ?? 50,
        promotionEligible: club.promotionEligible,
      })
    }

    assert.equal(divisionAbove(division), index === 0 ? null : tiers[index - 1])
    assert.equal(divisionBelow(division), index === tiers.length - 1 ? null : tiers[index + 1])
    if (index > 0) assert.ok(promotionCount(division) > 0, `${division}: precisa promover`)
    if (index < tiers.length - 1) assert.ok(relegationCount(division) > 0, `${division}: precisa rebaixar`)
  }

  const movements = evolvePyramids({
    clubs: pyramidClubs,
    userDivision: null,
    userFinalOrder: [],
    seed: 2026,
  })
  const after = pyramidClubs.map(club => ({ ...club, division: movements[club.id!] ?? club.division }))
  for (const division of tiers) {
    assert.equal(
      after.filter(club => club.division === division).length,
      TAMANHO_OFICIAL_DA_LIGA[division],
      `${country}/${division}: tamanho precisa permanecer estável após a temporada`,
    )
  }
}

console.log("deep-international-pyramids: profundidade, tamanhos, exclusividade e movimentos validados")
