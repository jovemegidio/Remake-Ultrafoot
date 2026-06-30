// PHASE 21 — Eventos dinâmicos
// Status: skeleton — lesões em massa, atraso salário, proposta inesperada, polêmica,
// invasão treino, patrocinador ameaça, venda sem autorização, chuva forte.

import type { GameState } from "@/lib/save-system"

export type DynamicEventId =
  | "mass_injuries"
  | "salary_delay"
  | "surprise_offer"
  | "player_polemic"
  | "training_invasion"
  | "sponsor_threat"
  | "unauthorized_sale"
  | "heavy_rain"
  | "stadium_issue"
  | "transport_strike"

export interface DynamicEvent {
  id: string
  type: DynamicEventId
  triggeredAt: number              // week
  season: number
  context: Record<string, unknown>
  resolved: boolean
  options?: { id: string; text: string; outcome: Record<string, unknown> }[]
}

/** Decide se evento será disparado nessa semana (probabilidade baseada em estado). */
export function rollEvents(_state: GameState, _week: number): DynamicEvent[] {
  throw new Error("events-engine.rollEvents: not implemented")
}

/** Aplica resolução escolhida pelo usuário. */
export function resolveEvent(
  _state: GameState,
  _eventId: string,
  _optionId: string,
): GameState {
  throw new Error("events-engine.resolveEvent: not implemented")
}
