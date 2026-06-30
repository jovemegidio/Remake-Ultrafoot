// PHASE 17 — Vestiário
// Status: skeleton — eventos: reclamação banco, pedido reunião, grupo insatisfeito,
// veterano cobrando, jovem pedindo chance, estrela querendo sair.

import type { GameState } from "@/lib/save-system"

export type DressingRoomEventType =
  | "bench_complaint"
  | "meeting_request"
  | "group_unhappy"
  | "veteran_demanding"
  | "youth_chance"
  | "star_wants_out"
  | "captain_change"

export interface DressingRoomEvent {
  id: string
  type: DressingRoomEventType
  playerIds: string[]              // jogadores envolvidos
  description: string
  options: DressingRoomResponse[]
  createdAt: number                // week
  resolved: boolean
}

export interface DressingRoomResponse {
  id: string
  text: string
  effects: {
    moralDelta: number
    relationshipDelta?: { playerId: string; delta: number }[]
    cohesionDelta?: number
  }
}

/** Detecta eventos de vestiário a partir do estado do elenco. */
export function detectEvents(_state: GameState, _week: number): DressingRoomEvent[] {
  throw new Error("dressing-room-engine.detectEvents: not implemented")
}

/** Aplica resposta do técnico a um evento. */
export function respondToEvent(
  _state: GameState,
  _eventId: string,
  _responseId: string,
): GameState {
  throw new Error("dressing-room-engine.respondToEvent: not implemented")
}
