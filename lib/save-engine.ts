// PHASE 1 — Save engine (facade)
// Status: skeleton — facade sobre lib/save-system.ts, com hooks pra Tauri Store.
// Objetivo: múltiplos slots, autosave, migração de versão, export/import.

import {
  loadGameState,
  saveGameState,
  clearGameState,
  hasSave,
  type GameState,
  DEFAULT_STATE,
} from "@/lib/save-system"

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

/** Lista todos os slots existentes. */
export function listSlots(): SaveSlotMeta[] {
  throw new Error("save-engine.listSlots: not implemented")
}

/** Carrega slot específico. */
export function loadSlot(_id: SaveSlotId): GameState | null {
  throw new Error("save-engine.loadSlot: not implemented")
}

/** Salva em slot específico. */
export function saveSlot(_id: SaveSlotId, _state: GameState): void {
  throw new Error("save-engine.saveSlot: not implemented")
}

/** Exporta save como JSON (Tauri: dialog file picker). */
export function exportSave(_state: GameState): string {
  return JSON.stringify(_state, null, 2)
}

/** Importa save de JSON (com validação de versão). */
export function importSave(_json: string): GameState {
  throw new Error("save-engine.importSave: not implemented")
}

/** Migra state de versão antiga para atual. */
export function migrate(_state: Partial<GameState>): GameState {
  throw new Error("save-engine.migrate: not implemented")
}
