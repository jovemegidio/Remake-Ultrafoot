import http from "node:http"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { WebSocketServer, WebSocket } from "ws"

const PORT = Number(process.env.PORT || 8790)
const DATA_DIR = process.env.DATA_DIR || "/var/lib/ultrafoot/relay"
const GAME_VERSION = process.env.GAME_VERSION || "1.0.191"
// VERSÕES DE PROTOCOLO ACEITAS.
//
// Era uma só, comparada com `!==`: publicar o jogo sem republicar o relay no
// mesmo minuto derrubava o multiplayer de todo mundo que atualizasse. Agora é
// uma LISTA — na virada de protocolo a versão antiga fica aqui por pelo menos
// uma release e ninguém é expulso no meio de um campeonato.
const ALLOWED_GAME_VERSIONS = new Set(
  (process.env.ALLOWED_GAME_VERSIONS || GAME_VERSION).split(",").map(v => v.trim()).filter(Boolean),
)
const versaoAceita = v => ALLOWED_GAME_VERSIONS.has(String(v))
const DB_FILE = path.join(DATA_DIR, "rooms.json")
const rooms = new Map()
const sockets = new Map()
const windows = new Map()
fs.mkdirSync(DATA_DIR, { recursive: true })
try {
  const stored = JSON.parse(fs.readFileSync(DB_FILE, "utf8"))
  for (const room of stored) rooms.set(room.code, room)
} catch {}

const publicRoom = room => ({
  ...room,
  participants: room.participants.map(({ token: _token, ...participant }) => participant),
  commands: room.commands.slice(-200),
})
const code = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from(crypto.randomBytes(8), byte => alphabet[byte % alphabet.length]).join("")
}
const token = () => crypto.randomBytes(32).toString("hex")
const json = (res, status, value) => {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  })
  res.end(body)
}
const persist = () => {
  const temporary = `${DB_FILE}.tmp`
  fs.writeFileSync(temporary, JSON.stringify([...rooms.values()]))
  fs.renameSync(temporary, DB_FILE)
}
const broadcast = (room, type, payload) => {
  const message = JSON.stringify({ type, payload, sentAt: Date.now() })
  for (const socket of sockets.get(room.code) || []) {
    if (socket.readyState === WebSocket.OPEN) socket.send(message)
  }
}
const body = req => new Promise((resolve, reject) => {
  let raw = ""
  req.on("data", chunk => {
    raw += chunk
    if (Buffer.byteLength(raw) > 64 * 1024) req.destroy()
  })
  req.on("end", () => {
    try { resolve(JSON.parse(raw || "{}")) } catch (error) { reject(error) }
  })
})
const limited = req => {
  const now = Date.now(), ip = req.socket.remoteAddress || "unknown"
  const recent = (windows.get(ip) || []).filter(stamp => now - stamp < 60_000)
  recent.push(now); windows.set(ip, recent)
  return recent.length > 120
}
const participant = (room, id, suppliedToken) =>
  room?.participants.find(item => item.id === id && item.token === suppliedToken)

function roundRobin(idsInput) {
  const ids = [...idsInput]
  if (ids.length % 2) ids.push("BYE")
  const totalRounds = ids.length - 1, fixtures = [], rotation = [...ids]
  for (let round = 1; round <= totalRounds; round++) {
    for (let index = 0; index < rotation.length / 2; index++) {
      const first = rotation[index], second = rotation[rotation.length - 1 - index]
      if (first === "BYE" || second === "BYE") continue
      const swap = (round + index) % 2 === 0
      fixtures.push({ id: `r${round}-m${index + 1}`, round, homeId: swap ? second : first, awayId: swap ? first : second, status: "scheduled", submissions: [] })
    }
    rotation.splice(1, 0, rotation.pop())
  }
  return { fixtures, totalRounds }
}
function standings(ids, fixtures) {
  const rows = new Map(ids.map(id => [id, { participantId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }]))
  for (const fixture of fixtures.filter(item => item.status === "played")) {
    const home = rows.get(fixture.homeId), away = rows.get(fixture.awayId)
    if (!home || !away) continue
    const hg = fixture.homeGoals || 0, ag = fixture.awayGoals || 0
    home.played++; away.played++; home.gf += hg; home.ga += ag; away.gf += ag; away.ga += hg
    if (hg > ag) { home.won++; home.points += 3; away.lost++ }
    else if (ag > hg) { away.won++; away.points += 3; home.lost++ }
    else { home.drawn++; away.drawn++; home.points++; away.points++ }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {})
  if (req.url === "/health") return json(res, 200, { ok: true, service: "ultrafoot-relay", gameVersion: GAME_VERSION, rooms: rooms.size })
  if (limited(req)) return json(res, 429, { ok: false, error: "rate_limited" })
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (req.method === "POST" && url.pathname === "/v1/rooms") {
    const input = await body(req).catch(() => null)
    if (!input) return json(res, 400, { ok: false, error: "invalid_json" })
    if (!versaoAceita(input.gameVersion)) return json(res, 409, { ok: false, error: "unsupported_game_version", requiredVersion: GAME_VERSION })
    let roomCode = code()
    while (rooms.has(roomCode)) roomCode = code()
    const now = Date.now(), id = crypto.randomUUID(), sessionToken = token()
    const deadlines = [24, 48, 72, 168], requested = Number(input.leagueSettings?.roundDeadlineHours)
    const leagueSettings = {
      leagueId: String(input.leagueSettings?.leagueId || "brasileirao_a").slice(0, 48),
      leagueName: String(input.leagueSettings?.leagueName || "Liga FC Hub").slice(0, 64),
      matchSpeed: input.leagueSettings?.matchSpeed === "rapida" ? "rapida" : "normal",
      roundDeadlineHours: deadlines.includes(requested) ? requested : 72,
      allowSpectators: Boolean(input.leagueSettings?.allowSpectators),
    }
    const room = {
      code: roomCode, mode: input.mode || "tournament", hostId: id, gameVersion: GAME_VERSION,
      dataVersion: input.dataVersion, dataHash: input.dataHash, maxPlayers: Math.max(2, Math.min(32, input.maxPlayers || 32)),
      createdAt: now, sharedRound: 0,
      participants: [{ id, managerName: String(input.hostName || "Técnico").slice(0, 48), teamShort: String(input.hostTeam || "").slice(0, 16), ready: false, connected: false, joinedAt: now, lastSeen: now, token: sessionToken }],
      competition: null, leagueSettings, commands: [], sequence: 0,
    }
    rooms.set(roomCode, room); persist()
    return json(res, 201, { ok: true, participantId: id, sessionToken, room: publicRoom(room) })
  }
  const match = url.pathname.match(/^\/v1\/rooms\/([A-Z0-9]{6,12})\/(join|snapshot)$/)
  if (!match) return json(res, 404, { ok: false, error: "not_found" })
  const room = rooms.get(match[1])
  if (!room) return json(res, 404, { ok: false, error: "room_not_found" })
  if (match[2] === "snapshot" && req.method === "GET") {
    const found = participant(room, url.searchParams.get("participantId"), url.searchParams.get("token"))
    return found ? json(res, 200, { ok: true, room: publicRoom(room) }) : json(res, 401, { ok: false, error: "unauthorized" })
  }
  if (match[2] === "join" && req.method === "POST") {
    const input = await body(req).catch(() => null)
    if (!input) return json(res, 400, { ok: false, error: "invalid_json" })
    if (!versaoAceita(input.gameVersion)) return json(res, 409, { ok: false, error: "version_mismatch", requiredVersion: room.gameVersion })
    if (input.dataVersion !== room.dataVersion || input.dataHash !== room.dataHash) return json(res, 409, { ok: false, error: "data_mismatch" })
    if (input.participantId && input.sessionToken) {
      const found = participant(room, input.participantId, input.sessionToken)
      return found ? json(res, 200, { ok: true, participantId: found.id, sessionToken: found.token, room: publicRoom(room), reconnected: true }) : json(res, 401, { ok: false, error: "invalid_reconnect_credentials" })
    }
    // ── ESPECTADOR ─────────────────────────────────────────────────────────
    // "Permitir espectadores" era uma caixa de seleção que não fazia nada: o
    // campo viajava até o relay e morria ali. Agora quem entra como espectador
    // acompanha a sala sem ocupar vaga, sem escolher clube e sem entrar na
    // tabela — e pode entrar com o campeonato JÁ EM ANDAMENTO, que é o caso de
    // uso inteiro (assistir a final de um campeonato alheio).
    const querAssistir = Boolean(input.spectator)
    if (querAssistir && !room.leagueSettings?.allowSpectators) {
      return json(res, 403, { ok: false, error: "spectators_disabled" })
    }
    if (!querAssistir) {
      if (room.competition) return json(res, 409, { ok: false, error: "competition_already_started" })
      if (room.participants.length >= room.maxPlayers) return json(res, 409, { ok: false, error: "room_full" })
      if (room.participants.some(item => item.teamShort.toLowerCase() === String(input.teamShort).trim().toLowerCase())) return json(res, 409, { ok: false, error: "team_already_selected" })
    }
    const now = Date.now(), id = crypto.randomUUID(), sessionToken = token()
    room.participants.push({ id, managerName: String(input.managerName || "Técnico").slice(0, 48), teamShort: querAssistir ? "" : String(input.teamShort || "").slice(0, 16), spectator: querAssistir, ready: false, connected: false, joinedAt: now, lastSeen: now, token: sessionToken })
    persist(); broadcast(room, "room_updated", publicRoom(room))
    return json(res, 201, { ok: true, participantId: id, sessionToken, room: publicRoom(room) })
  }
  return json(res, 404, { ok: false, error: "not_found" })
})

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 })
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const match = url.pathname.match(/^\/v1\/rooms\/([A-Z0-9]{6,12})\/connect$/)
  const room = match && rooms.get(match[1])
  const found = room && participant(room, url.searchParams.get("participantId"), url.searchParams.get("token"))
  if (!room || !found) return socket.destroy()
  wss.handleUpgrade(req, socket, head, ws => {
    ws.room = room; ws.participant = found; ws.windowStartedAt = Date.now(); ws.messageCount = 0
    if (!sockets.has(room.code)) sockets.set(room.code, new Set())
    sockets.get(room.code).add(ws); found.connected = true; found.lastSeen = Date.now(); persist()
    ws.send(JSON.stringify({ type: "snapshot", payload: publicRoom(room), sentAt: Date.now() }))
    broadcast(room, "presence", { participantId: found.id, connected: true })
    wss.emit("connection", ws)
  })
})
wss.on("connection", ws => {
  ws.on("message", raw => {
    const now = Date.now(), room = ws.room, actor = ws.participant
    if (now - ws.windowStartedAt > 10_000) { ws.windowStartedAt = now; ws.messageCount = 0 }
    if (++ws.messageCount > 50) return ws.send(JSON.stringify({ type: "error", payload: { error: "rate_limited" } }))
    let input
    try { input = JSON.parse(String(raw)) } catch { return }
    actor.lastSeen = now
    const host = actor.id === room.hostId
    const error = value => ws.send(JSON.stringify({ type: "error", requestId: input.requestId, payload: { error: value } }))
    if (input.type === "ping") return ws.send(JSON.stringify({ type: "pong", requestId: input.requestId, sentAt: now }))
    if (input.type === "set_ready") actor.ready = Boolean(input.payload?.ready)
    else if (input.type === "create_competition") {
      if (!host) return error("host_only")
      // Espectador não joga: não conta para o mínimo nem entra no chaveamento.
      const tecnicos = room.participants.filter(item => !item.spectator)
      if (tecnicos.length < 2) return error("minimum_2_players")
      if (room.competition) return error("competition_exists")
      const schedule = roundRobin(tecnicos.map(item => item.id)), settings = room.leagueSettings
      room.competition = { id: crypto.randomUUID(), name: settings.leagueName, format: "league", createdAt: now, currentRound: 1, totalRounds: schedule.totalRounds, fixtures: schedule.fixtures, standings: standings(tecnicos.map(item => item.id), []), finished: false, leagueId: settings.leagueId, officialRulesLocked: true, matchSpeed: settings.matchSpeed, roundDeadlineHours: settings.roundDeadlineHours, allowSpectators: settings.allowSpectators }
    } else if (input.type === "start_round") {
      if (!host || !room.competition) return error("host_only_or_no_competition")
      const fixtures = room.competition.fixtures.filter(item => item.round === room.competition.currentRound)
      const involved = new Set(fixtures.flatMap(item => [item.homeId, item.awayId]))
      if (room.participants.some(item => involved.has(item.id) && !item.spectator && !item.ready)) return error("players_not_ready")
      fixtures.forEach(item => { if (item.status === "scheduled") item.status = "live" })
      room.participants.forEach(item => item.ready = false)
      // PRAZO DA RODADA — o campo `roundDeadlineHours` existia desde sempre e
      // NUNCA foi usado: a sala escolhia "48 horas" e nada acontecia às 48h
      // porque ninguém marcava quando a rodada começou. Sem este carimbo, um
      // técnico que sumia congelava o campeonato inteiro para sempre.
      room.competition.roundStartedAt = now
      room.competition.roundDeadlineAt = now + room.competition.roundDeadlineHours * 3_600_000
      broadcast(room, "round_started", { round: room.competition.currentRound, fixtures, deadlineAt: room.competition.roundDeadlineAt })
    } else if (input.type === "expire_round") {
      // RODADA VENCIDA: quem não jogou perde por W.O. (3x0), como em qualquer
      // liga online. Só vale DEPOIS do prazo — antes disso o host não pode
      // simplesmente decretar o resultado dos outros.
      if (!host || !room.competition) return error("host_only_or_no_competition")
      if (!room.competition.roundDeadlineAt || now < room.competition.roundDeadlineAt) return error("deadline_not_reached")
      const pendentes = room.competition.fixtures.filter(item =>
        item.round === room.competition.currentRound && item.status !== "played")
      for (const fixture of pendentes) {
        // Quem enviou resultado não leva W.O.; quem ficou calado, sim.
        const mandanteEnviou = fixture.submissions?.some(s => s.participantId === fixture.homeId)
        const visitanteEnviou = fixture.submissions?.some(s => s.participantId === fixture.awayId)
        if (mandanteEnviou && !visitanteEnviou) { fixture.homeGoals = 3; fixture.awayGoals = 0 }
        else if (visitanteEnviou && !mandanteEnviou) { fixture.homeGoals = 0; fixture.awayGoals = 3 }
        else { fixture.homeGoals = 0; fixture.awayGoals = 0 }
        fixture.status = "played"
        fixture.walkover = true
      }
      broadcast(room, "round_expired", { round: room.competition.currentRound, count: pendentes.length })
    } else if (input.type === "submit_result") {
      const fixture = room.competition?.fixtures.find(item => item.id === input.payload?.fixtureId)
      if (!fixture || ![fixture.homeId, fixture.awayId].includes(actor.id)) return error("invalid_fixture")
      const submission = { participantId: actor.id, homeGoals: Math.max(0, Math.min(99, Number(input.payload?.homeGoals) || 0)), awayGoals: Math.max(0, Math.min(99, Number(input.payload?.awayGoals) || 0)), at: now }
      fixture.submissions = [...fixture.submissions.filter(item => item.participantId !== actor.id), submission]
      if (fixture.submissions.length === 2) {
        const [a, b] = fixture.submissions
        if (a.homeGoals === b.homeGoals && a.awayGoals === b.awayGoals) { fixture.status = "played"; fixture.homeGoals = a.homeGoals; fixture.awayGoals = a.awayGoals } else fixture.status = "disputed"
      } else fixture.status = "awaiting_confirmation"
    } else if (input.type === "resolve_result") {
      if (!host) return error("host_only")
      const fixture = room.competition?.fixtures.find(item => item.id === input.payload?.fixtureId)
      if (!fixture) return error("invalid_fixture")
      fixture.homeGoals = Math.max(0, Math.min(99, Number(input.payload?.homeGoals) || 0)); fixture.awayGoals = Math.max(0, Math.min(99, Number(input.payload?.awayGoals) || 0)); fixture.status = "played"
    } else if (input.type === "claim_host") {
      const currentHost = room.participants.find(item => item.id === room.hostId)
      if (currentHost?.connected) return error("host_still_connected")
      room.hostId = actor.id
    } else if (input.type === "career_command") {
      room.sequence++; room.commands.push({ sequence: room.sequence, participantId: actor.id, commandType: String(input.payload?.commandType || "unknown").slice(0, 64), payload: input.payload?.payload, createdAt: now })
      if (room.commands.length > 2000) room.commands.splice(0, 500)
    } else if (input.type === "advance_career") {
      if (!host || room.participants.some(item => !item.spectator && !item.ready)) return error("host_only_or_players_not_ready")
      room.sharedRound++; room.participants.forEach(item => item.ready = false)
    } else return error("unknown_message")
    if (room.competition) {
      room.competition.standings = standings(room.participants.filter(item => !item.spectator).map(item => item.id), room.competition.fixtures)
      const complete = room.competition.fixtures.filter(item => item.round === room.competition.currentRound).every(item => item.status === "played")
      if (complete) {
        if (room.competition.currentRound >= room.competition.totalRounds) {
          room.competition.finished = true
          // CAMPEÃO: a competição terminava e ninguém era declarado vencedor —
          // a tabela só parava de andar. Agora o líder final fica registrado.
          room.competition.championId = room.competition.standings[0]?.participantId ?? null
          broadcast(room, "competition_finished", { championId: room.competition.championId, standings: room.competition.standings })
        } else {
          room.competition.currentRound++
          // Rodada nova ainda não começou: o prazo só volta a correr no start_round.
          room.competition.roundStartedAt = null
          room.competition.roundDeadlineAt = null
        }
      }
    }
    persist(); broadcast(room, "room_updated", publicRoom(room))
    ws.send(JSON.stringify({ type: "ack", requestId: input.requestId, sentAt: now }))
  })
  ws.on("close", () => {
    ws.participant.connected = false; ws.participant.lastSeen = Date.now()
    sockets.get(ws.room.code)?.delete(ws); persist()
    broadcast(ws.room, "presence", { participantId: ws.participant.id, connected: false })
  })
})

server.listen(PORT, "127.0.0.1", () => console.log(`Ultrafoot relay ${GAME_VERSION} on ${PORT}`))
