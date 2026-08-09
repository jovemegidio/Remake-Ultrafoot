// PHASE 17 — Vestiário funcional: eventos derivados do elenco real e respostas
// persistidas na carreira.

import type { GameState } from "@/lib/save-system"
import type { Player } from "@/lib/game-engine"
import { analyseSquadDynamics, roleLabel } from "@/lib/squad-dynamics"

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
export function detectEvents(state: GameState, week: number, engineSquad: readonly Player[] = []): DressingRoomEvent[] {
  if (!engineSquad.length || week < 3) return []
  const event = (type: DressingRoomEventType, players: string[], description: string): DressingRoomEvent => ({ id:`${state.season}-${week}-${type}-${players.join("-")}`, type, playerIds:players, description, createdAt:week, resolved:false, options:[
    { id:"listen", text:"Ouvir e conversar", effects:{ moralDelta:4, cohesionDelta:2 } },
    { id:"promise", text:"Prometer uma oportunidade", effects:{ moralDelta:7, cohesionDelta:1 } },
    { id:"firm", text:"Manter a decisão técnica", effects:{ moralDelta:-3, cohesionDelta:-1 } },
  ] })

  const dynamics = analyseSquadDynamics(engineSquad)
  const byId = new Map(engineSquad.map(player => [player.id, player]))
  const critical = [...dynamics.players]
    .filter(item => item.concern)
    .sort((a, b) => a.satisfaction - b.satisfaction)

  if (dynamics.unsettledLeaders >= 3 || (state.teamMorale ?? 65) < 42) {
    const leaders = critical.slice(0, 4).map(item => String(item.playerId))
    return [event("group_unhappy", leaders, `${dynamics.unsettledLeaders || leaders.length} lideranças estão insatisfeitas com papéis e minutos no elenco.`)]
  }

  const mainConcern = critical[0]
  if (mainConcern) {
    const player = byId.get(mainConcern.playerId)
    if (!player) return []
    const type: DressingRoomEventType = mainConcern.role === "estrela"
      ? "star_wants_out"
      : player.age <= 21
        ? "youth_chance"
        : "bench_complaint"
    return [event(
      type,
      [String(player.id)],
      `${player.name} considera insuficiente o tempo de jogo para seu papel de ${roleLabel(mainConcern.role).toLowerCase()}.`,
    )]
  }
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
  next.resolvedDressingRoomEvents = [...new Set([...(next.resolvedDressingRoomEvents ?? []), eventId])].slice(-100)
  next.updatedAt = Date.now()
  return next
}
