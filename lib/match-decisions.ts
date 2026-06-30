// PHASE 13 — Partida ao vivo: decisões do técnico
// Status: skeleton — gritar, acalmar, pressionar, recuar, tudo ou nada,
// segurar resultado, bola longa, sub sugerida. Impacta moral/desempenho/ritmo/pressão.

import type { MatchState } from "@/lib/match-engine"

export type MatchDecisionId =
  | "gritar"
  | "acalmar"
  | "pressionar"
  | "recuar"
  | "tudo_ou_nada"
  | "segurar_resultado"
  | "bola_longa"
  | "sub_sugerida"

export interface DecisionEffect {
  attackDelta: number              // -10..+10
  defenseDelta: number
  energyDelta: number              // -5..+5
  moraleDelta: number              // -10..+10
  pressureDelta: number            // 0..+15
  durationMinutes: number          // por quantos minutos vale
}

export interface ActiveDecision {
  id: MatchDecisionId
  appliedAtMinute: number
  effect: DecisionEffect
}

/** Aplica decisão do técnico durante a partida. */
export function applyDecision(_state: MatchState, _id: MatchDecisionId): {
  state: MatchState
  active: ActiveDecision
} {
  throw new Error("match-decisions.applyDecision: not implemented")
}

/** Avalia se decisão é apropriada (pra IA do auxiliar sugerir). */
export function suggestDecision(_state: MatchState): MatchDecisionId | null {
  throw new Error("match-decisions.suggestDecision: not implemented")
}

/** Remove decisões expiradas baseado no minuto atual. */
export function pruneExpired(_active: ActiveDecision[], _minute: number): ActiveDecision[] {
  return _active.filter(d => _minute < d.appliedAtMinute + d.effect.durationMinutes)
}
