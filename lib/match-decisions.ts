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
export function applyDecision(state: MatchState, id: MatchDecisionId): {
  state: MatchState
  active: ActiveDecision
} {
  const effects: Record<MatchDecisionId, DecisionEffect> = {
    gritar:{attackDelta:3,defenseDelta:1,energyDelta:-2,moraleDelta:2,pressureDelta:5,durationMinutes:10}, acalmar:{attackDelta:-1,defenseDelta:2,energyDelta:2,moraleDelta:3,pressureDelta:0,durationMinutes:12},
    pressionar:{attackDelta:5,defenseDelta:-2,energyDelta:-4,moraleDelta:1,pressureDelta:10,durationMinutes:15}, recuar:{attackDelta:-4,defenseDelta:6,energyDelta:1,moraleDelta:0,pressureDelta:0,durationMinutes:15},
    tudo_ou_nada:{attackDelta:10,defenseDelta:-8,energyDelta:-5,moraleDelta:2,pressureDelta:15,durationMinutes:10}, segurar_resultado:{attackDelta:-6,defenseDelta:7,energyDelta:2,moraleDelta:0,pressureDelta:0,durationMinutes:12},
    bola_longa:{attackDelta:4,defenseDelta:-1,energyDelta:-2,moraleDelta:0,pressureDelta:4,durationMinutes:12}, sub_sugerida:{attackDelta:2,defenseDelta:2,energyDelta:4,moraleDelta:2,pressureDelta:2,durationMinutes:20},
  }
  const next = structuredClone(state), effect = effects[id]
  next.momentum = Math.max(-50, Math.min(50, next.momentum + effect.attackDelta + effect.pressureDelta / 2))
  return { state:next, active:{id,appliedAtMinute:state.minute,effect} }
}

/** Avalia se decisão é apropriada (pra IA do auxiliar sugerir). */
export function suggestDecision(state: MatchState): MatchDecisionId | null {
  const diff = state.home.goals - state.away.goals
  if (state.minute >= 80 && diff < 0) return "tudo_ou_nada"
  if (state.minute >= 75 && diff > 0) return "segurar_resultado"
  if (state.momentum < -25) return "acalmar"
  if (state.minute >= 55 && diff === 0) return "pressionar"
  return null
}

/** Remove decisões expiradas baseado no minuto atual. */
export function pruneExpired(_active: ActiveDecision[], _minute: number): ActiveDecision[] {
  return _active.filter(d => _minute < d.appliedAtMinute + d.effect.durationMinutes)
}
