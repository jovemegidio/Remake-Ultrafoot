import assert from "node:assert/strict"
import {
  aiClubSocialMatchModifier,
  evolveAIClubSocialState,
  initialAIClubSocialState,
} from "../lib/ai-club-social"

const initial = initialAIClubSocialState(70)
const crisis = evolveAIClubSocialState(initial, ["L", "L", "D", "L", "L"], 105301, 70)
assert(crisis.state.morale < initial.morale)
assert(crisis.state.managerTrust < initial.managerTrust)
assert(crisis.state.pressure > initial.pressure)
assert(crisis.state.winlessRun >= 4)
assert(aiClubSocialMatchModifier(crisis.state) < 0)

const recovery = evolveAIClubSocialState(crisis.state, ["W", "W", "D", "W", "W"], 105302, 70)
assert(recovery.state.morale > crisis.state.morale)
assert(recovery.state.supporterMood > crisis.state.supporterMood)
assert(recovery.state.unbeatenRun === 5)
assert(aiClubSocialMatchModifier(recovery.state) > aiClubSocialMatchModifier(crisis.state))

const sameWeek = evolveAIClubSocialState(recovery.state, ["L", "L", "L", "L", "L"], 105302, 70)
assert.deepEqual(sameWeek.state, recovery.state, "recarregar a mesma semana não pode evoluir duas vezes")

for (let week = 105303; week <= 105330; week++) {
  const state = evolveAIClubSocialState(recovery.state, ["L", "L", "L", "L", "L"], week, 90).state
  assert(state.morale >= 0 && state.morale <= 100)
  assert(state.pressure >= 0 && state.pressure <= 100)
  assert(aiClubSocialMatchModifier(state) >= -4)
}

console.log("ai-club-social: memória, crise, recuperação, idempotência e limites validados")
