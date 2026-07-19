import { DurableObject } from "cloudflare:workers"

type RoomMode = "career" | "tournament"
type FixtureStatus = "scheduled" | "live" | "awaiting_confirmation" | "disputed" | "played"

interface Env {
  ROOMS: DurableObjectNamespace<MultiplayerRoom>
  ALLOWED_GAME_VERSION: string
  ALLOWED_ORIGINS: string
}

interface Participant {
  id: string
  managerName: string
  teamShort: string
  ready: boolean
  connected: boolean
  joinedAt: number
  lastSeen: number
  token: string
}

interface ResultSubmission { participantId: string; homeGoals: number; awayGoals: number; at: number }
interface Fixture {
  id: string
  round: number
  homeId: string
  awayId: string
  status: FixtureStatus
  submissions: ResultSubmission[]
  homeGoals?: number
  awayGoals?: number
}

interface Standing {
  participantId: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points: number
}

interface OnlineCompetition {
  id: string
  name: string
  format: "league"
  createdAt: number
  currentRound: number
  totalRounds: number
  fixtures: Fixture[]
  standings: Standing[]
  finished: boolean
  leagueId: string
  officialRulesLocked: true
  matchSpeed: "normal" | "rapida"
  roundDeadlineHours: 24 | 48 | 72 | 168
  allowSpectators: boolean
}

interface LeagueSettings {
  leagueId: string
  leagueName: string
  matchSpeed: "normal" | "rapida"
  roundDeadlineHours: 24 | 48 | 72 | 168
  allowSpectators: boolean
}

interface OrderedCommand {
  sequence: number
  participantId: string
  commandType: string
  payload: unknown
  createdAt: number
}

interface RoomState {
  code: string
  mode: RoomMode
  hostId: string
  gameVersion: string
  dataVersion: string
  dataHash: string
  maxPlayers: number
  createdAt: number
  sharedRound: number
  participants: Participant[]
  competition: OnlineCompetition | null
  leagueSettings: LeagueSettings
  commands: OrderedCommand[]
  sequence: number
}

interface SocketAttachment {
  participantId: string
  windowStartedAt: number
  messagesInWindow: number
}

const encoder = new TextEncoder()
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" }
const HTTP_WINDOW_MS = 60_000
const httpWindows = new Map<string, { startedAt: number; count: number }>()

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: JSON_HEADERS })
}

function randomCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("")
}

function token(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("")
}

function publicRoom(state: RoomState) {
  return {
    ...state,
    participants: state.participants.map(({ token: _token, ...participant }) => participant),
    commands: state.commands.slice(-200),
  }
}

export function roundRobin(participantIds: string[]): { fixtures: Fixture[]; totalRounds: number } {
  const ids = [...participantIds]
  if (ids.length % 2) ids.push("BYE")
  const rounds = ids.length - 1
  const fixtures: Fixture[] = []
  const rotation = [...ids]
  for (let round = 1; round <= rounds; round++) {
    for (let index = 0; index < rotation.length / 2; index++) {
      const first = rotation[index]
      const second = rotation[rotation.length - 1 - index]
      if (first === "BYE" || second === "BYE") continue
      const swap = (round + index) % 2 === 0
      fixtures.push({ id: `r${round}-m${index + 1}`, round, homeId: swap ? second : first, awayId: swap ? first : second, status: "scheduled", submissions: [] })
    }
    rotation.splice(1, 0, rotation.pop()!)
  }
  return { fixtures, totalRounds: rounds }
}

export function calculateStandings(participantIds: string[], fixtures: Fixture[]): Standing[] {
  const rows = new Map(participantIds.map(id => [id, { participantId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }]))
  for (const fixture of fixtures.filter(item => item.status === "played")) {
    const home = rows.get(fixture.homeId), away = rows.get(fixture.awayId)
    if (!home || !away) continue
    const hg = fixture.homeGoals ?? 0, ag = fixture.awayGoals ?? 0
    home.played++; away.played++; home.gf += hg; home.ga += ag; away.gf += ag; away.ga += hg
    if (hg > ag) { home.won++; home.points += 3; away.lost++ }
    else if (ag > hg) { away.won++; away.points += 3; home.lost++ }
    else { home.drawn++; away.drawn++; home.points++; away.points++ }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)
}

function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return true
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map(item => item.trim()).filter(Boolean)
  return allowed.includes(origin)
}

/** Limite por IP no edge. É uma primeira barreira; em produção deve ser somado
 * ao WAF/Rate Limiting Rule do Cloudflare para valer entre todos os isolates. */
function httpRateLimited(request: Request, maxRequests: number): number | null {
  const now = Date.now()
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"
  const key = `${ip}:${new URL(request.url).pathname}`
  const current = httpWindows.get(key)
  if (!current || now - current.startedAt >= HTTP_WINDOW_MS) {
    httpWindows.set(key, { startedAt: now, count: 1 })
    return null
  }
  current.count++
  if (current.count <= maxRequests) return null
  return Math.max(1, Math.ceil((HTTP_WINDOW_MS - (now - current.startedAt)) / 1000))
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!originAllowed(request, env)) return json({ ok: false, error: "origin_not_allowed" }, 403)
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS })
    const url = new URL(request.url)
    if (url.pathname === "/health") return json({ ok: true, service: "ultrafoot-relay", gameVersion: env.ALLOWED_GAME_VERSION })
    if (url.pathname.startsWith("/v1/")) {
      const retryAfter = httpRateLimited(request, url.pathname === "/v1/rooms" ? 8 : 40)
      if (retryAfter) return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), { status: 429, headers: { ...JSON_HEADERS, "retry-after": String(retryAfter) } })
      const length = Number(request.headers.get("content-length") ?? "0")
      if (Number.isFinite(length) && length > 16 * 1024) return json({ ok: false, error: "payload_too_large" }, 413)
    }
    if (url.pathname === "/v1/rooms" && request.method === "POST") {
      const code = randomCode()
      const room = env.ROOMS.getByName(code)
      const body = await request.text()
      if (encoder.encode(body).byteLength > 16 * 1024) return json({ ok: false, error: "payload_too_large" }, 413)
      return room.fetch(new Request(`${url.origin}/create?code=${code}`, { method: "POST", headers: request.headers, body }))
    }
    const match = url.pathname.match(/^\/v1\/rooms\/([A-Z0-9]{6,12})(\/(?:join|snapshot|connect))$/)
    if (!match) return json({ ok: false, error: "not_found" }, 404)
    const code = match[1]
    const room = env.ROOMS.getByName(code)
    const forwarded = new URL(request.url)
    forwarded.pathname = match[2]
    forwarded.searchParams.set("code", code)
    return room.fetch(new Request(forwarded, request))
  },
} satisfies ExportedHandler<Env>

export class MultiplayerRoom extends DurableObject<Env> {
  private state: RoomState | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => { this.state = await ctx.storage.get<RoomState>("room") ?? null })
  }

  private async save(): Promise<void> { if (this.state) await this.ctx.storage.put("room", this.state) }

  private participant(id: string, suppliedToken: string): Participant | null {
    return this.state?.participants.find(item => item.id === id && item.token === suppliedToken) ?? null
  }

  private broadcast(type: string, payload: unknown): void {
    const message = JSON.stringify({ type, payload, sentAt: Date.now() })
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(message) } catch { /* socket sera removido pelo runtime */ }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/create" && request.method === "POST") {
      if (this.state) return json({ ok: false, error: "room_exists" }, 409)
      const input = await request.json<{ hostName: string; hostTeam: string; gameVersion: string; dataVersion: string; dataHash: string; maxPlayers?: number; mode?: RoomMode; leagueSettings?: Partial<LeagueSettings> }>()
      if (input.gameVersion !== this.env.ALLOWED_GAME_VERSION) return json({ ok: false, error: "unsupported_game_version", requiredVersion: this.env.ALLOWED_GAME_VERSION }, 409)
      const hostId = crypto.randomUUID(), hostToken = token(), createdAt = Date.now()
      const deadlines = [24, 48, 72, 168] as const
      const requestedDeadline = Number(input.leagueSettings?.roundDeadlineHours)
      const leagueSettings: LeagueSettings = {
        leagueId: String(input.leagueSettings?.leagueId ?? "brasileirao_a").slice(0, 48),
        leagueName: String(input.leagueSettings?.leagueName ?? "Liga FC Hub").slice(0, 64),
        matchSpeed: input.leagueSettings?.matchSpeed === "rapida" ? "rapida" : "normal",
        roundDeadlineHours: deadlines.includes(requestedDeadline as typeof deadlines[number]) ? requestedDeadline as LeagueSettings["roundDeadlineHours"] : 72,
        allowSpectators: Boolean(input.leagueSettings?.allowSpectators),
      }
      this.state = { code: url.searchParams.get("code")!, mode: input.mode ?? "tournament", hostId, gameVersion: input.gameVersion, dataVersion: input.dataVersion, dataHash: input.dataHash, maxPlayers: Math.max(2, Math.min(32, input.maxPlayers ?? 32)), createdAt, sharedRound: 0, participants: [{ id: hostId, managerName: input.hostName.slice(0, 48), teamShort: input.hostTeam.slice(0, 16), ready: false, connected: false, joinedAt: createdAt, lastSeen: createdAt, token: hostToken }], competition: null, leagueSettings, commands: [], sequence: 0 }
      await this.save()
      return json({ ok: true, participantId: hostId, sessionToken: hostToken, room: publicRoom(this.state) }, 201)
    }
    if (!this.state) return json({ ok: false, error: "room_not_found" }, 404)

    if (url.pathname === "/join" && request.method === "POST") {
      const input = await request.json<{ managerName: string; teamShort: string; gameVersion: string; dataVersion: string; dataHash: string; participantId?: string; sessionToken?: string }>()
      if (input.gameVersion !== this.state.gameVersion) return json({ ok: false, error: "version_mismatch", requiredVersion: this.state.gameVersion }, 409)
      if (input.dataVersion !== this.state.dataVersion || input.dataHash !== this.state.dataHash) return json({ ok: false, error: "data_mismatch", requiredDataVersion: this.state.dataVersion, requiredDataHash: this.state.dataHash }, 409)
      if (input.participantId && input.sessionToken) {
        const existing = this.participant(input.participantId, input.sessionToken)
        if (!existing) return json({ ok: false, error: "invalid_reconnect_credentials" }, 401)
        existing.connected = false; existing.lastSeen = Date.now(); await this.save()
        return json({ ok: true, participantId: existing.id, sessionToken: existing.token, room: publicRoom(this.state), reconnected: true })
      }
      if (this.state.competition) return json({ ok: false, error: "competition_already_started" }, 409)
      if (this.state.participants.length >= this.state.maxPlayers) return json({ ok: false, error: "room_full" }, 409)
      if (this.state.participants.some(item => item.teamShort.toLocaleLowerCase() === input.teamShort.trim().toLocaleLowerCase())) return json({ ok: false, error: "team_already_selected" }, 409)
      const id = crypto.randomUUID(), sessionToken = token(), joinedAt = Date.now()
      this.state.participants.push({ id, managerName: input.managerName.slice(0, 48), teamShort: input.teamShort.slice(0, 16), ready: false, connected: false, joinedAt, lastSeen: joinedAt, token: sessionToken })
      await this.save(); this.broadcast("room_updated", publicRoom(this.state))
      return json({ ok: true, participantId: id, sessionToken, room: publicRoom(this.state) }, 201)
    }

    if (url.pathname === "/snapshot" && request.method === "GET") {
      const participant = this.participant(url.searchParams.get("participantId") ?? "", url.searchParams.get("token") ?? "")
      return participant ? json({ ok: true, room: publicRoom(this.state) }) : json({ ok: false, error: "unauthorized" }, 401)
    }

    if (url.pathname === "/connect" && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const participant = this.participant(url.searchParams.get("participantId") ?? "", url.searchParams.get("token") ?? "")
      if (!participant) return json({ ok: false, error: "unauthorized" }, 401)
      const pair = new WebSocketPair(), [client, server] = Object.values(pair)
      const attachment: SocketAttachment = { participantId: participant.id, windowStartedAt: Date.now(), messagesInWindow: 0 }
      server.serializeAttachment(attachment)
      this.ctx.acceptWebSocket(server, [`participant:${participant.id}`])
      participant.connected = true; participant.lastSeen = Date.now(); await this.save()
      server.send(JSON.stringify({ type: "snapshot", payload: publicRoom(this.state), sentAt: Date.now() }))
      this.broadcast("presence", { participantId: participant.id, connected: true })
      return new Response(null, { status: 101, webSocket: client })
    }
    return json({ ok: false, error: "not_found" }, 404)
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (!this.state) return socket.close(1011, "room_missing")
    const attachment = socket.deserializeAttachment() as SocketAttachment
    const participant = this.state.participants.find(item => item.id === attachment.participantId)
    if (!participant) return socket.close(1008, "participant_missing")
    const now = Date.now()
    if (now - attachment.windowStartedAt > 10_000) { attachment.windowStartedAt = now; attachment.messagesInWindow = 0 }
    attachment.messagesInWindow++
    socket.serializeAttachment(attachment)
    if (attachment.messagesInWindow > 50) return socket.send(JSON.stringify({ type: "error", payload: { error: "rate_limited" } }))
    if (typeof message !== "string" || encoder.encode(message).byteLength > 64 * 1024) return socket.send(JSON.stringify({ type: "error", payload: { error: "invalid_message" } }))
    let input: { type: string; requestId?: string; payload?: Record<string, unknown> }
    try { input = JSON.parse(message) } catch { return socket.send(JSON.stringify({ type: "error", payload: { error: "invalid_json" } })) }
    participant.lastSeen = now
    const isHost = participant.id === this.state.hostId

    if (input.type === "ping") return socket.send(JSON.stringify({ type: "pong", requestId: input.requestId, sentAt: now }))
    if (input.type === "set_ready") participant.ready = Boolean(input.payload?.ready)
    else if (input.type === "create_competition") {
      if (!isHost) return socket.send(JSON.stringify({ type: "error", requestId: input.requestId, payload: { error: "host_only" } }))
      if (this.state.participants.length < 20) return socket.send(JSON.stringify({ type: "error", requestId: input.requestId, payload: { error: "minimum_20_players" } }))
      if (this.state.competition) return socket.send(JSON.stringify({ type: "error", requestId: input.requestId, payload: { error: "competition_exists" } }))
      const schedule = roundRobin(this.state.participants.map(item => item.id))
      const settings = this.state.leagueSettings
      this.state.competition = { id: crypto.randomUUID(), name: settings.leagueName, format: "league", createdAt: now, currentRound: 1, totalRounds: schedule.totalRounds, fixtures: schedule.fixtures, standings: calculateStandings(this.state.participants.map(item => item.id), []), finished: false, leagueId: settings.leagueId, officialRulesLocked: true, matchSpeed: settings.matchSpeed, roundDeadlineHours: settings.roundDeadlineHours, allowSpectators: settings.allowSpectators }
    } else if (input.type === "start_round") {
      if (!isHost || !this.state.competition) return socket.send(JSON.stringify({ type: "error", requestId: input.requestId, payload: { error: "host_only_or_no_competition" } }))
      const fixtures = this.state.competition.fixtures.filter(item => item.round === this.state!.competition!.currentRound)
      const involved = new Set(fixtures.flatMap(item => [item.homeId, item.awayId]))
      if (this.state.participants.some(item => involved.has(item.id) && !item.ready)) return socket.send(JSON.stringify({ type: "error", requestId: input.requestId, payload: { error: "players_not_ready" } }))
      fixtures.forEach(item => { if (item.status === "scheduled") item.status = "live" })
      this.state.participants.forEach(item => item.ready = false)
      this.broadcast("round_started", { round: this.state.competition.currentRound, fixtures })
    } else if (input.type === "submit_result") {
      const fixture = this.state.competition?.fixtures.find(item => item.id === input.payload?.fixtureId)
      if (!fixture || ![fixture.homeId, fixture.awayId].includes(participant.id) || !["live", "awaiting_confirmation", "disputed"].includes(fixture.status)) return socket.send(JSON.stringify({ type: "error", requestId: input.requestId, payload: { error: "invalid_fixture" } }))
      const submission: ResultSubmission = { participantId: participant.id, homeGoals: Math.max(0, Math.min(99, Number(input.payload?.homeGoals) || 0)), awayGoals: Math.max(0, Math.min(99, Number(input.payload?.awayGoals) || 0)), at: now }
      fixture.submissions = [...fixture.submissions.filter(item => item.participantId !== participant.id), submission]
      if (fixture.submissions.length === 2) {
        const [first, second] = fixture.submissions
        if (first.homeGoals === second.homeGoals && first.awayGoals === second.awayGoals) { fixture.status = "played"; fixture.homeGoals = first.homeGoals; fixture.awayGoals = first.awayGoals }
        else fixture.status = "disputed"
      } else fixture.status = "awaiting_confirmation"
    } else if (input.type === "resolve_result") {
      if (!isHost) return socket.send(JSON.stringify({ type: "error", requestId: input.requestId, payload: { error: "host_only" } }))
      const fixture = this.state.competition?.fixtures.find(item => item.id === input.payload?.fixtureId)
      if (!fixture) return
      fixture.homeGoals = Math.max(0, Math.min(99, Number(input.payload?.homeGoals) || 0)); fixture.awayGoals = Math.max(0, Math.min(99, Number(input.payload?.awayGoals) || 0)); fixture.status = "played"
    } else if (input.type === "career_command") {
      this.state.sequence++
      this.state.commands.push({ sequence: this.state.sequence, participantId: participant.id, commandType: String(input.payload?.commandType ?? "unknown").slice(0, 64), payload: input.payload?.payload, createdAt: now })
      if (this.state.commands.length > 2_000) this.state.commands.splice(0, 500)
    } else if (input.type === "claim_host") {
      const currentHost = this.state.participants.find(item => item.id === this.state!.hostId)
      if (currentHost?.connected || now - (currentHost?.lastSeen ?? now) < 90_000) return socket.send(JSON.stringify({ type: "error", requestId: input.requestId, payload: { error: "host_still_active" } }))
      const successor = [...this.state.participants].filter(item => item.connected).sort((a, b) => a.joinedAt - b.joinedAt)[0]
      if (!successor || successor.id !== participant.id) return socket.send(JSON.stringify({ type: "error", requestId: input.requestId, payload: { error: "host_recovery_not_allowed" } }))
      this.state.hostId = participant.id
      this.broadcast("host_changed", { hostId: participant.id })
    } else if (input.type === "advance_career") {
      if (!isHost || this.state.participants.some(item => !item.ready)) return socket.send(JSON.stringify({ type: "error", requestId: input.requestId, payload: { error: "host_only_or_players_not_ready" } }))
      this.state.sharedRound++; this.state.participants.forEach(item => item.ready = false)
    } else return socket.send(JSON.stringify({ type: "error", requestId: input.requestId, payload: { error: "unknown_message" } }))

    if (this.state.competition) {
      const competition = this.state.competition
      competition.standings = calculateStandings(this.state.participants.map(item => item.id), competition.fixtures)
      const roundComplete = competition.fixtures.filter(item => item.round === competition.currentRound).every(item => item.status === "played")
      if (roundComplete) {
        if (competition.currentRound >= competition.totalRounds) competition.finished = true
        else competition.currentRound++
      }
    }
    await this.save()
    this.broadcast("room_updated", publicRoom(this.state))
    socket.send(JSON.stringify({ type: "ack", requestId: input.requestId, sentAt: now }))
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null
    const participant = this.state?.participants.find(item => item.id === attachment?.participantId)
    if (participant) { participant.connected = false; participant.lastSeen = Date.now(); await this.save(); this.broadcast("presence", { participantId: participant.id, connected: false }) }
    socket.close(code, reason)
  }
}
