import assert from "node:assert/strict"
import { aggregateDecisionEffects, applyDecision, pruneExpired } from "../lib/match-decisions"
import { createInitialState } from "../lib/match-engine"

const state = { ...createInitialState(), phase: "second" as const, minute: 70 }
const pressure = applyDecision(state, "pressionar")
const protect = applyDecision(state, "segurar_resultado")

const combined = aggregateDecisionEffects([pressure.active, protect.active], 75)
assert.equal(combined.attackDelta, -1)
assert.equal(combined.defenseDelta, 5)
assert.equal(combined.energyDelta, -2)
assert.equal(combined.moraleDelta, 1)
assert.equal(combined.pressureDelta, 10)

assert.equal(aggregateDecisionEffects([pressure.active], 84).attackDelta, 5)
assert.equal(aggregateDecisionEffects([pressure.active], 85).attackDelta, 0)
assert.equal(pruneExpired([pressure.active], 85).length, 0)

// O clique da decisao causa uma reacao curta, sem aplicar de uma vez todo o
// bonus que agora pertence ao intervalo temporizado.
assert.equal(pressure.state.momentum, 3)

console.log("OK — decisoes 291 afetam os cinco eixos durante todo o intervalo")
