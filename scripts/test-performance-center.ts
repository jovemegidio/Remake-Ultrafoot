import assert from "node:assert/strict"
import { applyMedicalRestrictionsForMatch, buildDataHub, medicalRisk, mergePhaseTactic, normalizePerformanceState, projectSquad, DEFAULT_PHASE_TACTIC } from "../lib/performance-center"

const young = projectSquad([{ playerId: 1, age: 18, overall: 60, potential: 78 }], 2026)[0]
assert.equal(young.seasons[0].overall, 60, "a temporada atual deve exibir o overall atual")
assert(young.seasons.every((season, index, all) => index === 0 || season.overall >= all[index - 1].overall), "jovem não pode regredir durante a fase de desenvolvimento")
assert(young.seasons.every(season => season.overall <= 78), "projeção não pode superar o potencial")

const veteran = projectSquad([{ playerId: 2, age: 31, overall: 78, potential: 82 }], 2026)[0]
assert(veteran.seasons.at(-1)!.overall < veteran.seasons[0].overall, "veterano deve projetar declínio")
assert(veteran.seasons.slice(1).some(season => season.status === "declinio"), "declínio precisa ser identificado")

const healthy = { age: 24, energy: 100, form: 70, injury: null } as never
const tired = { age: 34, energy: 42, form: 40, injury: null } as never
const injured = { age: 24, energy: 100, form: 70, injury: { type: "teste" } } as never
assert.equal(medicalRisk(healthy, 0).label, "baixo")
assert(medicalRisk(tired, 70).score >= 70)
assert.equal(medicalRisk(injured, 0).score, 100)
const restricted = applyMedicalRestrictionsForMatch([
  { id: 1, energy: 95 }, { id: 2, energy: 91 }, { id: 3, energy: 74 },
] as never, { 1: "afastado", 2: "minutos", 3: "sem-contato" })
assert.deepEqual(restricted.map(player => [player.id, player.energy]), [[2, 68], [3, 74]], "restrição médica precisa chegar à escalação e à condição física")

const merged = mergePhaseTactic({ mentality: "ofensiva" } as never, DEFAULT_PHASE_TACTIC)
assert.equal(merged.mentality, "ofensiva", "atributos fora das fases devem ser preservados")
assert.equal(merged.pressingIntensity, DEFAULT_PHASE_TACTIC.outOfPossession.pressingIntensity)
assert.equal(merged.inPossessionFormation, "3-2-5")
assert.equal(merged.outOfPossessionFormation, "4-1-4-1")

const migrated = normalizePerformanceState({
  squadPlan: [{ playerId: 9, decision: "renovar", targetSeason: 2028, note: "capitão" }],
  phaseTactic: { ...DEFAULT_PHASE_TACTIC, formation: "4-4-2", inPossession: { ...DEFAULT_PHASE_TACTIC.inPossession, formation: undefined } } as never,
})
assert.equal(migrated.phaseTactic.inPossession.formation, "4-4-2", "save antigo deve migrar a formação sem apagar o plano")
assert.equal(migrated.squadPlan[0].note, "capitão")

const dataHub = buildDataHub([
  { scored: 2, conceded: 0, home: true, xG: 1.7, xGA: 0.6, shots: 10, shotsOnTarget: 5, possession: 57, passAccuracy: 86 },
  { scored: 1, conceded: 1, home: false, xG: 1.1, xGA: 1.2, shots: 8, shotsOnTarget: 3, possession: 48, passAccuracy: 79 },
  { scored: 0, conceded: 1, home: false },
])
assert.deepEqual([dataHub.wins, dataHub.draws, dataHub.losses], [1, 1, 1])
assert.equal(dataHub.sampleWithAdvancedData, 2)
assert.equal(dataHub.shotConversion, 3 / 18 * 100)
assert.equal(dataHub.form.join(""), "WDL")
assert.equal(buildDataHub([{ scored: 1, conceded: 0, home: true }]).xGPerGame, null, "save antigo não pode receber xG inventado")

console.log("performance-center: projeção, migração, risco médico, fases táticas e Data Hub validados")
