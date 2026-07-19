// Save engine transacional: slots, autosave, migração, export/import e recuperação.

import {
  loadGameState,
  saveGameState,
  clearGameState,
  hasSave,
  type GameState,
  DEFAULT_STATE,
} from "@/lib/save-system"
import { storeGet, storeRemove, storeSet } from "@/lib/persistent-store"

export type SaveSlotId = "slot1" | "slot2" | "slot3" | "auto"

export interface SaveSlotMeta {
  id: SaveSlotId
  managerName: string
  teamNome: string
  teamCurto: string
  season: number
  round: number
  updatedAt: number
}

/** Re-exports do save-system atual (slot único) — compat backwards. */
export const load = loadGameState
export const save = saveGameState
export const clear = clearGameState
export const has = hasSave
export const DEFAULT = DEFAULT_STATE

const SLOT_PREFIX = "ultrafoot:save-slot:"
const SAVE_SCHEMA = 1

interface SaveEnvelope {
  schema: number
  checksum: string
  savedAt: number
  state: GameState
}

function checksum(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

type SaveCopy = "primary" | "staging" | "backup" | "backup2"

function key(id: SaveSlotId, copy: SaveCopy = "primary"): string {
  return `${SLOT_PREFIX}${id}${copy === "primary" ? "" : `:${copy}`}`
}

function decodeEnvelope(raw: string | null): GameState | null {
  if (!raw) return null
  try {
    const envelope = JSON.parse(raw) as Partial<SaveEnvelope>
    if (!envelope.state || envelope.schema !== SAVE_SCHEMA) return null
    const payload = JSON.stringify(envelope.state)
    if (checksum(payload) !== envelope.checksum) return null
    return migrate(envelope.state)
  } catch {
    return null
  }
}

/** Lista todos os slots existentes. */
export function listSlots(): SaveSlotMeta[] {
  return (["slot1", "slot2", "slot3", "auto"] as SaveSlotId[])
    .map(id => ({ id, state: loadSlot(id) }))
    .filter((entry): entry is { id: SaveSlotId; state: GameState } => Boolean(entry.state))
    .map(({ id, state }) => ({
      id,
      managerName: state.managerName,
      teamNome: state.selectedTeam?.nome ?? "Sem clube",
      teamCurto: state.selectedTeam?.curto ?? state.selectedTeamShort ?? "---",
      season: state.season,
      round: state.currentRound ?? state.week,
      updatedAt: state.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Carrega slot específico. */
export function loadSlot(id: SaveSlotId): GameState | null {
  // Um staging válido significa que o processo caiu depois de concluir a escrita,
  // mas antes do commit. Ele é preferido se for mais novo que o primário.
  const candidates = (["primary", "staging", "backup", "backup2"] as SaveCopy[])
    .map(copy => ({ copy, raw: storeGet(key(id, copy)) }))
    .map(entry => ({ ...entry, state: decodeEnvelope(entry.raw) }))
    .filter((entry): entry is typeof entry & { state: GameState } => Boolean(entry.state))
    .sort((a, b) => (b.state.updatedAt || 0) - (a.state.updatedAt || 0))
  return candidates[0]?.state ?? null
}

/** Salva em slot específico. */
export function saveSlot(id: SaveSlotId, state: GameState): void {
  const migrated = migrate({ ...state, updatedAt: Date.now() })
  const payload = JSON.stringify(migrated)
  const envelope: SaveEnvelope = {
    schema: SAVE_SCHEMA,
    checksum: checksum(payload),
    savedAt: Date.now(),
    state: migrated,
  }
  const serialized = JSON.stringify(envelope)
  // 1. Escreve e valida staging; 2. gira dois backups; 3. comita. Se o jogo for
  // encerrado em qualquer ponto, loadSlot ainda encontra uma cópia íntegra.
  storeSet(key(id, "staging"), serialized)
  if (!decodeEnvelope(storeGet(key(id, "staging")))) throw new Error("Falha ao validar gravação do save")
  const previous = storeGet(key(id, "primary"))
  const previousBackup = storeGet(key(id, "backup"))
  if (previousBackup && decodeEnvelope(previousBackup)) storeSet(key(id, "backup2"), previousBackup)
  if (previous && decodeEnvelope(previous)) storeSet(key(id, "backup"), previous)
  storeSet(key(id, "primary"), serialized)
  if (!decodeEnvelope(storeGet(key(id, "primary")))) throw new Error("Falha ao confirmar gravação do save")
  storeRemove(key(id, "staging"))
}

/** Exporta save como JSON (Tauri: dialog file picker). */
export function exportSave(_state: GameState): string {
  return JSON.stringify(_state, null, 2)
}

/** Importa save de JSON (com validação de versão). */
export function importSave(json: string): GameState {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error("Arquivo de save inválido: JSON malformado")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Arquivo de save inválido: estrutura ausente")
  }
  const candidate = "state" in parsed && (parsed as { state?: unknown }).state
    ? (parsed as { state: Partial<GameState> }).state
    : parsed as Partial<GameState>
  if (typeof candidate.season !== "number" || !Number.isFinite(candidate.season)) {
    throw new Error("Arquivo de save inválido: temporada ausente")
  }
  if (candidate.season < 1900 || candidate.season > 2300) {
    throw new Error("Arquivo de save inválido: temporada fora do intervalo")
  }
  return migrate(candidate)
}

/** Migra state de versão antiga para atual. */
export function migrate(state: Partial<GameState>): GameState {
  const now = Date.now()
  const next: GameState = {
    ...DEFAULT_STATE,
    ...state,
    version: DEFAULT_STATE.version,
    createdAt: typeof state.createdAt === "number" && state.createdAt > 0 ? state.createdAt : now,
    updatedAt: typeof state.updatedAt === "number" && state.updatedAt > 0 ? state.updatedAt : now,
    coachSkills: Array.isArray(state.coachSkills) ? state.coachSkills : DEFAULT_STATE.coachSkills.map(skill => ({ ...skill })),
    coachLegacy: state.coachLegacy ? { ...DEFAULT_STATE.coachLegacy, ...state.coachLegacy } : { ...DEFAULT_STATE.coachLegacy, careerRecords: [], legacySkills: [] },
    nationalCareer: state.nationalCareer ? { ...DEFAULT_STATE.nationalCareer, ...state.nationalCareer } : { ...DEFAULT_STATE.nationalCareer },
    pendingNationalOffers: Array.isArray(state.pendingNationalOffers) ? state.pendingNationalOffers : [],
    declinedNationalTeamIds: Array.isArray(state.declinedNationalTeamIds) ? state.declinedNationalTeamIds : [],
    managers: Array.isArray(state.managers) ? state.managers : [],
    controllerBindings: state.controllerBindings && typeof state.controllerBindings === "object" ? state.controllerBindings : {},
  }
  next.week = Math.max(0, Math.floor(Number(next.week) || 0))
  next.season = Math.floor(Number(next.season) || DEFAULT_STATE.season)
  next.commentaryVolume = Math.max(0, Math.min(100, Number(next.commentaryVolume) || 0))
  next.teamMorale = next.teamMorale == null ? undefined : Math.max(0, Math.min(100, Number(next.teamMorale) || 0))
  return next
}

export function deleteSlot(id: SaveSlotId): void {
  for (const copy of ["primary", "staging", "backup", "backup2"] as SaveCopy[]) storeRemove(key(id, copy))
}
