import assert from "node:assert/strict"
import { isTransferWindowOpen, nextTransferWindowWeek, useGameEngine, type Player } from "../lib/game-engine"

assert.equal(isTransferWindowOpen(1), true)
assert.equal(isTransferWindowOpen(20), false)
assert.equal(isTransferWindowOpen(27), true)
assert.equal(nextTransferWindowWeek(20), 27)
assert.equal(nextTransferWindowWeek(40), 53)

const player: Player = {
  id: 919191,
  name: "Teste Janela Persistente",
  position: "GOL",
  age: 25,
  nationality: "Brasil",
  overall: 72,
  potential: 75,
  pace: 60,
  shooting: 20,
  passing: 65,
  dribbling: 48,
  defending: 70,
  physical: 72,
  energy: 100,
  morale: "Feliz",
  form: 70,
  contract: { salary: 20_000, endDate: 100, releaseClause: null, signedWeek: 1, signedSeason: 2026 },
  injury: null,
  seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
  training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
  nationalTeam: null,
  calledUp: false,
  marketValue: 1_000_000,
  joinedClubWeek: 0,
  joinedClubSeason: 2026,
  isLoanedIn: false,
  statusEffects: [],
}

useGameEngine.setState({ currentWeek: 20, currentSeason: 2026, balance: 10_000_000, transferBudget: 10_000_000, pendingIncomingTransfers: [], squadPlayers: [] })
assert.equal(useGameEngine.getState().buyPlayer(player, 1_000_000, false), "pending")
assert.equal(useGameEngine.getState().squadPlayers.length, 0)
assert.equal(useGameEngine.getState().pendingIncomingTransfers.length, 1)
for (let week = 20; week < 27; week++) useGameEngine.getState().advanceWeek()
assert.equal(useGameEngine.getState().pendingIncomingTransfers.length, 0)
assert.equal(useGameEngine.getState().squadPlayers.some(item => item.name === player.name), true)

useGameEngine.setState({ currentWeek: 20, balance: 10_000_000, transferBudget: 10_000_000, pendingIncomingTransfers: [], squadPlayers: [] })
assert.equal(useGameEngine.getState().buyPlayer({ ...player, name: "Livre Imediato" }, 0, true), "joined")
assert.equal(useGameEngine.getState().squadPlayers.some(item => item.name === "Livre Imediato"), true)

console.log("OK janela: fila persistente, registro automático e jogador livre imediato")
