import { allTeams } from "@/lib/teams-data"
import { NATIONAL_COMPETITIONS } from "@/lib/national-competitions"
import { YOUTH_COMPETITION_FORMATS_2026 } from "@/lib/youth-career-engine"

export const ONLINE_GAME_VERSION = "1.0.100"
// O relay valida `gameVersion` contra ALLOWED_GAME_VERSION e devolve 409
// (unsupported_game_version) quando não bate. Ficar preso em 1.0.96 enquanto o
// relay foi implantado em 1.0.98 quebrou a criação/entrada em salas em produção.
// Cliente, relay (services/multiplayer-relay/wrangler.jsonc) e o preflight do
// release precisam andar juntos — este valor acompanha a versão da build.
export const ONLINE_PROTOCOL_VERSION = "1.0.100"
export const GAME_DATA_VERSION = "2026.07.18"

export interface OnlineParticipant {
  id: string
  managerName: string
  teamShort: string
  ready: boolean
  connected: boolean
  lastSeen: number
}

export interface OnlineAction {
  sequence: number
  participantId: string
  actionType: string
  payload: unknown
  createdAt: number
}

export interface OnlineRoom {
  roomCode: string
  gameVersion: string
  dataVersion: string
  dataHash: string
  maxPlayers: number
  participants: OnlineParticipant[]
  actions: OnlineAction[]
  currentRound: number
  createdAt: number
}

export interface OnlineSession {
  address: string
  participantId: string
  sessionToken: string
  room: OnlineRoom
  isHost: boolean
}

type NativeSession = Omit<OnlineSession, "isHost">
const SESSION_KEY = "ultrafoot:online-session"

function stableDataFingerprint(): string {
  const source = JSON.stringify({
    teams: allTeams.map(team => [team.curto, team.nome, team.pais, team.divisao, team.file_key]),
    national: NATIONAL_COMPETITIONS.filter(item => !item.legacy).map(item => [item.id, item.participants, item.groups, item.groupSize, item.leagueTeams, item.knockoutStages]),
    youth: YOUTH_COMPETITION_FORMATS_2026.map(item => [item.name, item.participants, item.stages]),
  })
  let high = 0x811c9dc5, low = 0x01000193
  for (let index = 0; index < source.length; index++) {
    low ^= source.charCodeAt(index)
    const product = Math.imul(low, 0x01000193)
    high = (high ^ (product >>> 16)) >>> 0
    low = product >>> 0
  }
  return `${high.toString(16).padStart(8, "0")}${low.toString(16).padStart(8, "0")}`
}

export const GAME_DATA_HASH = stableDataFingerprint()

async function invokeNative<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) throw new Error("O servidor embutido está disponível somente no aplicativo instalado.")
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<T>(command, args)
}

function persist(session: OnlineSession | null): void {
  if (typeof window === "undefined") return
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else sessionStorage.removeItem(SESSION_KEY)
}

export function restoreOnlineSession(): OnlineSession | null {
  if (typeof window === "undefined") return null
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") as OnlineSession | null } catch { return null }
}

export async function startOnlineServer(input: { managerName: string; teamShort: string; maxPlayers: number }): Promise<OnlineSession> {
  const native = await invokeNative<NativeSession>("online_start_server", {
    hostName: input.managerName, hostTeam: input.teamShort, maxPlayers: input.maxPlayers,
    gameVersion: ONLINE_GAME_VERSION, dataVersion: GAME_DATA_VERSION, dataHash: GAME_DATA_HASH,
  })
  const session = { ...native, isHost: true }
  persist(session)
  return session
}

export async function stopOnlineServer(): Promise<void> {
  await invokeNative<boolean>("online_stop_server")
  persist(null)
}

export async function joinOnlineServer(input: { address: string; roomCode: string; managerName: string; teamShort: string }): Promise<OnlineSession> {
  const response = await invokeNative<{ ok: boolean; error?: string; participantId: string; sessionToken: string; room: OnlineRoom }>("online_join_server", {
    address: input.address, roomCode: input.roomCode.trim().toUpperCase(), managerName: input.managerName, teamShort: input.teamShort,
    gameVersion: ONLINE_GAME_VERSION, dataVersion: GAME_DATA_VERSION, dataHash: GAME_DATA_HASH,
  })
  if (!response.ok) throw new Error(response.error || "Não foi possível entrar na sala.")
  const session: OnlineSession = { address: input.address, participantId: response.participantId, sessionToken: response.sessionToken, room: response.room, isHost: false }
  persist(session)
  return session
}

export async function refreshOnlineRoom(session: OnlineSession): Promise<OnlineSession> {
  const response = await invokeNative<{ ok: boolean; error?: string; room: OnlineRoom }>("online_room_snapshot", { address: session.address, roomCode: session.room.roomCode })
  if (!response.ok) throw new Error(response.error || "Sala indisponível.")
  const updated = { ...session, room: response.room }
  persist(updated)
  return updated
}

export async function setOnlineReady(session: OnlineSession, ready: boolean): Promise<OnlineSession> {
  const response = await invokeNative<{ ok: boolean; error?: string; room: OnlineRoom }>("online_set_ready", {
    address: session.address, roomCode: session.room.roomCode, participantId: session.participantId, sessionToken: session.sessionToken, ready,
  })
  if (!response.ok) throw new Error(response.error || "Não foi possível confirmar a rodada.")
  const updated = { ...session, room: response.room }
  persist(updated)
  return updated
}

export async function submitOnlineAction(session: OnlineSession, actionType: string, payload: unknown = {}): Promise<OnlineSession> {
  const response = await invokeNative<{ ok: boolean; error?: string; room: OnlineRoom }>("online_submit_action", {
    address: session.address, roomCode: session.room.roomCode, participantId: session.participantId, sessionToken: session.sessionToken, actionType, payload,
  })
  if (!response.ok) throw new Error(response.error || "Ação recusada pelo host.")
  const updated = { ...session, room: response.room }
  persist(updated)
  return updated
}

export function leaveOnlineSession(): void { persist(null) }

/** Permite que módulos do jogo publiquem somente a decisão, nunca o save inteiro. */
export function announceOnlineAction(actionType: string, payload: unknown): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ultrafoot:online-action", { detail: { actionType, payload } }))
}
