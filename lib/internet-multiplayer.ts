import { safeLocalSet } from "@/lib/safe-storage"
import { GAME_DATA_HASH, GAME_DATA_VERSION, ONLINE_PROTOCOL_VERSION } from "@/lib/online-multiplayer"

export type InternetConnectionState = "connecting" | "connected" | "reconnecting" | "closed" | "error"

/** Escopo público da 3.0: liga assíncrona confiável, ainda não carreira online. */
export const ONLINE_PRODUCT_NAME = "Liga Online Beta"
export const ONLINE_BETA_CAPABILITIES = {
  format: "league_only",
  sharedCareer: false,
  authoritativeSimulation: false,
  resultDoubleConfirmation: true,
  reconnect: true,
  spectators: true,
} as const

export interface InternetParticipant {
  id: string
  managerName: string
  teamShort: string
  /** Entrou só para assistir: não ocupa vaga, não joga, não entra na tabela. */
  spectator?: boolean
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
  /** Quem já mandou o placar — é o que diferencia "aguardando" de "divergente". */
  submissions?: Array<{ participantId: string; homeGoals: number; awayGoals: number; at: number }>
  /** Resultado decretado por prazo vencido (W.O.). */
  walkover?: boolean
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
  /** Quando a rodada atual começou e quando ela vence (epoch ms). */
  roundStartedAt?: number | null
  roundDeadlineAt?: number | null
  /** Definido ao fim da última rodada — o líder da tabela final. */
  championId?: string | null
}

export interface InternetLeagueSettings {
  leagueId: string
  leagueName: string
  matchSpeed: "normal" | "rapida"
  roundDeadlineHours: 24 | 48 | 72 | 168
  allowSpectators: boolean
  /**
   * ⚠️ TAMBEM EXIGIDOS POR CODIGO JA PUBLICADO (1.0.356). O `fc-hub` grava e le
   * os dois ao criar a sala; sem eles o commit `be0ac1b` nao compilava.
   * Opcionais porque sala antiga nao os tem — e sala sem modalidade e sala
   * profissional, que era o unico modo quando ela foi criada.
   */
  modalidade?: string
  dificuldade?: string
}

/**
 * Comando genérico replicado pelo relay, com ordem autoritativa (`sequence`).
 *
 * O relay SEMPRE mandou isto no snapshot (`publicRoom` devolve os últimos 200),
 * mas o tipo do cliente não declarava o campo — então nenhuma tela conseguia
 * ler. É este canal que o Draft online usa para as escolhas, o que permitiu
 * fazer um modo novo sem ensinar o protocolo do draft ao servidor.
 */
export interface ComandoDaSala {
  sequence: number
  participantId: string
  commandType: string
  payload?: unknown
  createdAt: number
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
  /** Log ordenado de comandos (últimos 200). Ver `ComandoDaSala`. */
  commands?: ComandoDaSala[]
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
const OFFICIAL_RELAY_URL = "https://ultrafoot.179-198-103-30.sslip.io/relay"

function normalizedUrl(value: string): string { return value.trim().replace(/\/+$/, "") }

/**
 * Multiplayer por relay: ligado apenas quando existe um relay público
 * configurado em NEXT_PUBLIC_ULTRAFOOT_RELAY_URL.
 *
 * Sem relay implantado, a área "Campeonato pela internet" ficava visível no FC
 * Hub e falhava em qualquer clique — e o preflight do release ainda exigia que
 * o relay respondesse, travando a publicação de builds que nem usavam online.
 * Basta definir a variável para a função voltar a aparecer sozinha.
 */
export const ONLINE_RELAY_ENABLED = true

export function configuredRelayUrl(): string {
  if (typeof window !== "undefined") {
    const override = normalizedUrl(localStorage.getItem(RELAY_OVERRIDE_KEY) ?? "")
    if (override) return override
    // MESMA ORIGEM só vale quando o jogo roda de verdade num servidor web (dev
    // com `next dev`, ou a versão navegador), onde `/relay` é servido junto.
    //
    // ⚠️ No app EMPACOTADO isto disparava indevidamente: a webview do Tauri serve
    // de `http://tauri.localhost`, cujo protocolo TAMBÉM é "http:". O relay virava
    // `http://tauri.localhost/relay`, o app pedia a si mesmo, recebia o próprio
    // HTML e o JSON.parse estourava com
    //   Unexpected token '<', "<!DOCTYPE "... is not valid JSON
    // — o erro que aparecia em "Campeonato pela internet". A VPS logo abaixo
    // nunca era alcançada no jogo instalado.
    const host = window.location.hostname
    const appEmpacotado =
      host === "tauri.localhost" ||
      host.endsWith(".tauri.localhost") ||
      typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== "undefined"
    const viaWeb = window.location.protocol === "http:" || window.location.protocol === "https:"
    if (viaWeb && !appEmpacotado) {
      return `${window.location.origin}/relay`
    }
  }
  return normalizedUrl(process.env.NEXT_PUBLIC_ULTRAFOOT_RELAY_URL ?? OFFICIAL_RELAY_URL)
}

export function setRelayOverride(url: string): void {
  if (typeof window === "undefined") return
  const normalized = normalizedUrl(url)
  if (normalized) safeLocalSet(RELAY_OVERRIDE_KEY, normalized)
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
      spectators_disabled: "Esta sala não aceita espectadores.",
      deadline_not_reached: "O prazo da rodada ainda não venceu.",
      invalid_fixture: "Esta partida não é sua ou não existe mais.",
      host_only: "Só o organizador do campeonato pode fazer isso.",
      players_not_ready: "Nem todos os técnicos confirmaram as decisões.",
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

export async function joinInternetRoom(input: { code: string; managerName: string; teamShort: string; spectator?: boolean }): Promise<InternetSession> {
  const relayUrl = configuredRelayUrl()
  if (!relayUrl) throw new Error("O relay público ainda não foi implantado/configurado.")
  const code = input.code.trim().toUpperCase()
  const response = await request<{ ok: true; participantId: string; sessionToken: string; room: InternetRoom }>(`${relayUrl}/v1/rooms/${code}/join`, { method: "POST", body: JSON.stringify({ managerName: input.managerName, teamShort: input.teamShort, spectator: Boolean(input.spectator), gameVersion: ONLINE_PROTOCOL_VERSION, dataVersion: GAME_DATA_VERSION, dataHash: GAME_DATA_HASH }) })
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
