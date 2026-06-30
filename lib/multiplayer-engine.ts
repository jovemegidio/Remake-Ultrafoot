// PHASE 29 — Multiplayer local
// Status: skeleton — 2-4 técnicos no mesmo save, turnos semanais,
// disputa de mercado, tabela compartilhada.

import type { GameState, SavedTeam } from "@/lib/save-system"

export interface MultiplayerSlot {
  slotId: number                   // 1..4
  managerName: string
  team: SavedTeam
  isAI: boolean
  ready: boolean                   // marcou turno como concluído?
  pendingDecisions: string[]       // ids de eventos pendentes
}

export interface MultiplayerSession {
  id: string
  slots: MultiplayerSlot[]
  sharedState: GameState
  currentTurn: number              // round
  turnOwner: number                // 1..4 (alternância) ou -1 = todos simultâneo
  marketLockedBy?: number
  createdAt: number
}

/** Cria sessão local com N humanos. */
export function createSession(_humans: { managerName: string; team: SavedTeam }[]): MultiplayerSession {
  throw new Error("multiplayer-engine.createSession: not implemented")
}

/** Avança turno só quando todos slots ready=true. */
export function advanceTurnIfReady(_session: MultiplayerSession): MultiplayerSession {
  throw new Error("multiplayer-engine.advanceTurnIfReady: not implemented")
}

/** Disputa de mercado: 2 humanos miram mesmo jogador. */
export function resolveMarketDispute(
  _session: MultiplayerSession,
  _playerId: string,
): { winnerSlotId: number; reason: string } {
  throw new Error("multiplayer-engine.resolveMarketDispute: not implemented")
}
