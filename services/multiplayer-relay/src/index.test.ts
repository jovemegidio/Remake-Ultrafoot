import { describe, expect, it } from "vitest"
import { SELF, env } from "cloudflare:test"
import { calculateStandings, roundRobin } from "./index"

// A versão vem do wrangler.jsonc em vez de ficar fixa no teste: o relay recusa
// (409) qualquer gameVersion diferente de ALLOWED_GAME_VERSION, então cravar o
// número aqui fazia a suíte quebrar a cada bump de versão do jogo.
// O cast é necessário porque o Env de index.ts não é exportado e o tipo gerado
// para `env` não conhece as vars declaradas no wrangler.jsonc.
const GAME_VERSION = (env as unknown as { ALLOWED_GAME_VERSION: string }).ALLOWED_GAME_VERSION

describe("tabela para campeonato remoto", () => {
  it("gera 31 rodadas com 16 partidas simultâneas para 32 técnicos", () => {
    const ids = Array.from({ length: 32 }, (_, index) => `p${index + 1}`)
    const schedule = roundRobin(ids)
    expect(schedule.totalRounds).toBe(31)
    expect(schedule.fixtures).toHaveLength(496)
    for (let round = 1; round <= 31; round++) {
      const fixtures = schedule.fixtures.filter(item => item.round === round)
      expect(fixtures).toHaveLength(16)
      expect(new Set(fixtures.flatMap(item => [item.homeId, item.awayId])).size).toBe(32)
    }
  })

  it("calcula classificação somente com resultados confirmados", () => {
    const schedule = roundRobin(["a", "b", "c", "d"])
    const [first] = schedule.fixtures
    first.status = "played"
    first.homeGoals = 2
    first.awayGoals = 1
    const table = calculateStandings(["a", "b", "c", "d"], schedule.fixtures)
    expect(table[0].points).toBe(3)
    expect(table.reduce((sum, row) => sum + row.played, 0)).toBe(2)
  })
})

describe("API do relay", () => {
  it("cria sala persistente e protege o snapshot", async () => {
    const create = await SELF.fetch("https://relay.test/v1/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "Host", hostTeam: "INT", gameVersion: GAME_VERSION, dataVersion: "2026.07", dataHash: "qa-hash", maxPlayers: 32, mode: "tournament" }),
    })
    expect(create.status).toBe(201)
    const payload = await create.json<{ room: { code: string; maxPlayers: number }; participantId: string; sessionToken: string }>()
    expect(payload.room.maxPlayers).toBe(32)
    for (let index = 2; index <= 20; index++) {
      const joined = await SELF.fetch(`https://relay.test/v1/rooms/${payload.room.code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
    body: JSON.stringify({ managerName: `Técnico ${index}`, teamShort: `T${index}`, gameVersion: GAME_VERSION, dataVersion: "2026.07", dataHash: "qa-hash" }),
      })
      expect(joined.status).toBe(201)
    }
    const duplicate = await SELF.fetch(`https://relay.test/v1/rooms/${payload.room.code}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    body: JSON.stringify({ managerName: "Duplicado", teamShort: "T20", gameVersion: GAME_VERSION, dataVersion: "2026.07", dataHash: "qa-hash" }),
    })
    expect(duplicate.status).toBe(409)
    const denied = await SELF.fetch(`https://relay.test/v1/rooms/${payload.room.code}/snapshot`)
    expect(denied.status).toBe(401)
    const snapshot = await SELF.fetch(`https://relay.test/v1/rooms/${payload.room.code}/snapshot?participantId=${payload.participantId}&token=${payload.sessionToken}`)
    expect(snapshot.status).toBe(200)
    const room = await snapshot.json<{ room: { participants: unknown[] } }>()
    expect(room.room.participants).toHaveLength(20)
  })
})
