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
export function detectEvents(state: GameState, week: number): DressingRoomEvent[] {
  const squad = state.squadPlayers ?? []
  if (!squad.length || week < 3) return []
  const event = (type: DressingRoomEventType, players: string[], description: string): DressingRoomEvent => ({ id:`${state.season}-${week}-${type}`, type, playerIds:players, description, createdAt:week, resolved:false, options:[
    { id:"listen", text:"Ouvir e conversar", effects:{ moralDelta:4, cohesionDelta:2 } },
    { id:"promise", text:"Prometer uma oportunidade", effects:{ moralDelta:7, cohesionDelta:1 } },
    { id:"firm", text:"Manter a decisão técnica", effects:{ moralDelta:-3, cohesionDelta:-1 } },
  ] })
  if ((state.teamMorale ?? 65) < 42) return [event("group_unhappy", squad.slice(0,4).map(p=>p.id), "Parte do elenco está insatisfeita com o ambiente.")]
  if (week % 7 === 0) { const p = squad.find(p=>p.age <= 21) ?? squad[0]; return [event("youth_chance", [p.id], `${p.name} pediu mais oportunidades no time.`)] }
  return []
}

/** Aplica resposta do técnico a um evento. */
export function respondToEvent(
  state: GameState,
  eventId: string,
  responseId: string,
): GameState {
  const next = structuredClone(state)
  const delta = responseId === "listen" ? 4 : responseId === "promise" ? 7 : -3
  next.teamMorale = Math.max(0, Math.min(100, (next.teamMorale ?? 65) + delta))
  next.updatedAt = Date.now()
  void eventId
  return next
}
