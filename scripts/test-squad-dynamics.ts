import assert from "node:assert/strict"
import { analyseSquadDynamics, applyWeeklyPlayingTimeMorale } from "../lib/squad-dynamics"
import { detectEvents, respondToEvent } from "../lib/dressing-room-engine"
import type { Player } from "../lib/game-engine"
import type { GameState } from "../lib/save-system"

function player(id: number, overall: number, age: number, matches: number, minutes: number, starter = false): Player {
  return {
    id, name: `Atleta ${id}`, position: id === 1 ? "GOL" : "MEI", age, overall,
    potential: age <= 21 ? overall + 12 : overall + 2, nationality: "Brasil",
    pace: overall, shooting: overall, passing: overall, dribbling: overall,
    defending: overall, physical: overall, energy: 90, morale: "Normal", moralePoints: 55,
    form: 65, contract: null, injury: null, isStarter: starter,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: matches, minutesPlayed: minutes, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null, calledUp: false, marketValue: 1_000_000,
    joinedClubWeek: 0, joinedClubSeason: 2026, isLoanedIn: false,
  }
}

const squad = Array.from({ length: 22 }, (_, index) => {
  const rank = index + 1
  const isFirstTeam = rank <= 11
  return player(rank, 90 - rank, rank >= 18 ? 19 : 27, 10, isFirstTeam ? 850 : 20, isFirstTeam)
})

const report = analyseSquadDynamics(squad)
assert.equal(report.players.length, 22)
assert.equal(report.players.find(item => item.playerId === 1)?.role, "estrela")
assert.equal(report.players.find(item => item.playerId === 18)?.role, "promessa")
assert.ok(report.concerns > 0, "reservas de rotação sem minutos devem gerar preocupações")

const keyPlayer = report.players.find(item => item.playerId === 1)!
const unhappy = applyWeeklyPlayingTimeMorale(squad[0], keyPlayer, 0, 1)
assert.equal(unhappy.moralePoints, 53, "jogador-chave ignorado deve perder moral gradualmente")

const selected = applyWeeklyPlayingTimeMorale({ ...squad[0], moralePoints: 50 }, keyPlayer, 90, 1)
assert.equal(selected.moralePoints, 51, "jogador insatisfeito utilizado deve começar a recuperar moral")

const noMatch = applyWeeklyPlayingTimeMorale(squad[0], keyPlayer, 0, 0)
assert.equal(noMatch.moralePoints, 55, "sem partida não pode haver punição por minutos")

const save = { season: 2026, teamMorale: 65, updatedAt: 0 } as GameState
const events = detectEvents(save, 10, squad)
assert.equal(events.length, 1)
assert.equal(events[0].type, "bench_complaint")
assert.match(events[0].description, /tempo de jogo/)
const answered = respondToEvent(save, events[0].id, "listen")
assert.ok(answered.resolvedDressingRoomEvents?.includes(events[0].id))
assert.equal(answered.teamMorale, 69)

console.log(`squad-dynamics: ${report.players.length} papéis, satisfação ${report.satisfaction}, ${report.concerns} alertas e resposta persistente validados`)
