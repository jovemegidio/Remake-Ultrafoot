import { GAME_DATA_HASH, GAME_DATA_VERSION, ONLINE_PROTOCOL_VERSION } from "@/lib/online-multiplayer"

export type InternetConnectionState = "connecting" | "connected" | "reconnecting" | "closed" | "error"

export interface InternetParticipant {
  id: string
  managerName: string
  teamShort: string
  ready: boolean
  connected: boolean
  joinedAt: number
  lastSeen: number
}

export interface InternetFixture {
  id: string
  round: number
  homeId: string
  awayId: string
  status: "scheduled" | "live" | "awaiting_confirmation" | "disputed" | "played"
  homeGoals?: number
  awayGoals?: number
}

export interface InternetCompetition {
  id: string
  name: string
  format: "league"
  currentRound: number
  totalRounds: number
  fixtures: InternetFixture[]
  standings: { participantId: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number }[]
  finished: boolean
  leagueId: string
  officialRulesLocked: true
  matchSpeed: "normal" | "rapida"
  roundDeadlineHours: 24 | 48 | 72 | 168
  allowSpectators: boolean
}

export interface InternetLeagueSettings {
  leagueId: string
  leagueName: string
  matchSpeed: "normal" | "rapida"
  roundDeadlineHours: 24 | 48 | 72 | 168
  allowSpectators: boolean
}

export interface InternetRoom {
  code: string
  mode: "career" | "tournament"
  hostId: string
  gameVersion: string
  dataVersion: string
  dataHash: string
  maxPlayers: number
  sharedRound: number
  participants: InternetParticipant[]
  competition: InternetCompetition | null
  leagueSettings: InternetLeagueSettings
  sequence: number
}

export interface InternetSession {
  relayUrl: string
  participantId: string
  sessionToken: string
  room: InternetRoom
}

const INTERNET_SESSION_KEY = "ultrafoot:internet-session"
const RELAY_OVERRIDE_KEY = "ultrafoot:relay-url"

function normalizedUrl(value: string): string { return value.trim().replace(/\/+$/, "") }

export function configuredRelayUrl(): string {
  if (typeof window !== "undefined") {
    const override = normalizedUrl(localStorage.getItem(RELAY_OVERRIDE_KEY) ?? "")
    if (override) return override
  }
  return normalizedUrl(process.env.NEXT_PUBLIC_ULTRAFOOT_RELAY_URL ?? "")
}

export function setRelayOverride(url: string): void {
  if (typeof window === "undefined") return
  const normalized = normalizedUrl(url)
  if (normalized) localStorage.setItem(RELAY_OVERRIDE_KEY, normalized)
  else localStorage.removeItem(RELAY_OVERRIDE_KEY)
}

function persist(session: InternetSession | null): void {
  if (typeof window === "undefined") return
  if (session) sessionStorage.setItem(INTERNET_SESSION_KEY, JSON.stringify(session))
  else sessionStorage.removeItem(INTERNET_SESSION_KEY)
}

export function restoreInternetSession(): InternetSession | null {
  if (typeof window === "undefined") return null
  try { return JSON.parse(sessionStorage.getItem(INTERNET_SESSION_KEY) || "null") as InternetSession | null } catch { return null }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } })
  const data = await response.json() as T & { ok?: boolean; error?: string; requiredVersion?: string }
  if (!response.ok || data.ok === false) {
    const errors: Record<string, string> = {
      version_mismatch: "A sala usa outra versão do jogo.", data_mismatch: "O banco de elencos/regulamentos da sala é diferente.", room_full: "A sala está lotada.",
      room_not_found: "Sala não encontrada.", competition_already_started: "O campeonato já começou.", invalid_reconnect_credentials: "A credencial de reconexão expirou.", unsupported_game_version: `O relay exige a versão ${data.requiredVersion ?? "mais recente"}.`,
      team_already_selected: "Este clube já foi escolhido por outro técnico.",
      rate_limited: "Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.",
      payload_too_large: "A solicitação enviada é maior que o permitido pelo serviço.",
    }
    throw new Error(errors[data.error ?? ""] ?? data.error ?? `Falha HTTP ${response.status}`)
  }
  return data
}

export async function checkRelayHealth(relayUrl = configuredRelayUrl()): Promise<{ ok: boolean; gameVersion: string }> {
  if (!relayUrl) throw new Error("O endereço público do relay ainda não foi configurado.")
  return request(`${relayUrl}/health`)
}

export async function createInternetRoom(input: { managerName: string; teamShort: string; maxPlayers?: number; mode?: "career" | "tournament"; leagueSettings: InternetLeagueSettings }): Promise<InternetSession> {
  const relayUrl = configuredRelayUrl()
  if (!relayUrl) throw new Error("O relay público ainda não foi implantado/configurado.")
  const response = await request<{ ok: true; participantId: string; sessionToken: string; room: InternetRoom }>(`${relayUrl}/v1/rooms`, { method: "POST", body: JSON.stringify({ hostName: input.managerName, hostTeam: input.teamShort, gameVersion: ONLINE_PROTOCOL_VERSION, dataVersion: GAME_DATA_VERSION, dataHash: GAME_DATA_HASH, maxPlayers: Math.max(20, Math.min(32, input.maxPlayers ?? 32)), mode: input.mode ?? "tournament", leagueSettings: input.leagueSettings }) })
  const session = { relayUrl, participantId: response.participantId, sessionToken: response.sessionToken, room: response.room }
  persist(session); return session
}

export async function joinInternetRoom(input: { code: string; managerName: string; teamShort: string }): Promise<InternetSession> {
  const relayUrl = configuredRelayUrl()
  if (!relayUrl) throw new Error("O relay público ainda não foi implantado/configurado.")
  const code = input.code.trim().toUpperCase()
  const response = await request<{ ok: true; participantId: string; sessionToken: string; room: InternetRoom }>(`${relayUrl}/v1/rooms/${code}/join`, { method: "POST", body: JSON.stringify({ managerName: input.managerName, teamShort: input.teamShort, gameVersion: ONLINE_PROTOCOL_VERSION, dataVersion: GAME_DATA_VERSION, dataHash: GAME_DATA_HASH }) })
  const session = { relayUrl, participantId: response.participantId, sessionToken: response.sessionToken, room: response.room }
  persist(session); return session
}

export async function reconnectInternetRoom(session: InternetSession): Promise<InternetSession> {
  const response = await request<{ ok: true; participantId: string; sessionToken: string; room: InternetRoom }>(`${session.relayUrl}/v1/rooms/${session.room.code}/join`, { method: "POST", body: JSON.stringify({ managerName: "", teamShort: "", gameVersion: ONLINE_PROTOCOL_VERSION, dataVersion: GAME_DATA_VERSION, dataHash: GAME_DATA_HASH, participantId: session.participantId, sessionToken: session.sessionToken }) })
  const restored = { ...session, room: response.room }
  persist(restored); return restored
}

export function leaveInternetRoom(): void { persist(null) }

export interface InternetRoomSocket {
  send: (type: string, payload?: Record<string, unknown>) => boolean
  close: () => void
}

export function connectInternetRoom(session: InternetSession, callbacks: { onRoom: (room: InternetRoom) => void; onState: (state: InternetConnectionState) => void; onEvent?: (type: string, payload: unknown) => void; onError?: (message: string) => void }): InternetRoomSocket {
  let socket: WebSocket | null = null, stopped = false, attempt = 0, reconnectTimer = 0
  const connect = () => {
    callbacks.onState(attempt ? "reconnecting" : "connecting")
    const wsBase = session.relayUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:")
    const query = new URLSearchParams({ participantId: session.participantId, token: session.sessionToken })
    socket = new WebSocket(`${wsBase}/v1/rooms/${session.room.code}/connect?${query}`)
    socket.onopen = () => { attempt = 0; callbacks.onState("connected") }
    socket.onmessage = event => {
      try {
        const message = JSON.parse(String(event.data)) as { type: string; payload?: unknown }
        if ((message.type === "snapshot" || message.type === "room_updated") && message.payload) {
          session.room = message.payload as InternetRoom; persist(session); callbacks.onRoom(session.room)
        }
        if (message.type === "error") callbacks.onError?.(String((message.payload as { error?: string })?.error ?? "Erro do relay"))
        callbacks.onEvent?.(message.type, message.payload)
      } catch { callbacks.onError?.("Mensagem inválida recebida do relay.") }
    }
    socket.onerror = () => callbacks.onState("error")
    socket.onclose = () => {
      if (stopped) return callbacks.onState("closed")
      callbacks.onState("reconnecting")
      const delay = Math.min(15_000, 750 * 2 ** Math.min(5, attempt++))
      reconnectTimer = window.setTimeout(connect, delay)
    }
  }
  connect()
  return {
    send(type, payload = {}) { if (socket?.readyState !== WebSocket.OPEN) return false; socket.send(JSON.stringify({ type, payload, requestId: crypto.randomUUID() })); return true },
    close() { stopped = true; window.clearTimeout(reconnectTimer); socket?.close(1000, "client_leave") },
  }
}
