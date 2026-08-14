import assert from "node:assert/strict"
import { evolvePyramids, type PyramidClub } from "../lib/league-pyramid"

const clubs: PyramidClub[] = [
  ...["A1", "A2", "A3", "A4", "A5", "A6"].map((curto, index) => ({ curto, division: "serie_a", prestige: 80 - index })),
  { curto: "B-RES-1", division: "serie_b", prestige: 99, promotionEligible: false },
  { curto: "B-RES-2", division: "serie_b", prestige: 98, promotionEligible: false },
  { curto: "B1", division: "serie_b", prestige: 90, promotionEligible: true },
  { curto: "B2", division: "serie_b", prestige: 89, promotionEligible: true },
]

const moved = evolvePyramids({ clubs, userDivision: null, userFinalOrder: [], seed: 2026 })
assert.notEqual(moved["B-RES-1"], "serie_a", "equipe reserva subiu")
assert.notEqual(moved["B-RES-2"], "serie_a", "equipe reserva subiu")
assert.equal(moved.B1, "serie_a")
assert.equal(moved.B2, "serie_a")
assert.equal(Object.entries(moved).filter(([, division]) => division === "serie_b").length, 2, "a pirâmide não preservou o tamanho ao faltar elegíveis")

console.log("reserve-promotion: equipes B não sobem e as divisões preservam o tamanho")
