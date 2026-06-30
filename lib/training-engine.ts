// PHASE 11 — Treino semanal
// Status: skeleton — finalização, defesa, posse, contra-ataque, bola parada,
// físico, recuperação, entrosamento, jovens. Impactos: moral, energia, lesão, evolução.

import type { GameState } from "@/lib/save-system"

export type TrainingType =
  | "finalizacao"
  | "defesa"
  | "posse"
  | "contra_ataque"
  | "bola_parada"
  | "fisico"
  | "recuperacao"
  | "entrosamento"
  | "jovens"

export type TrainingIntensity = "leve" | "media" | "alta"

export interface TrainingSession {
  type: TrainingType
  intensity: TrainingIntensity
  durationDays: number
  focusPlayerIds?: string[]
}

export interface TrainingWeekPlan {
  weekStart: number                // round
  sessions: TrainingSession[]      // ~5 por semana
  restDays: number
}

export interface TrainingResult {
  attributeGains: { playerId: string; attr: string; delta: number }[]
  moraleDelta: number              // -10..+10 médio do elenco
  energyDelta: number              // -20..0
  injuries: { playerId: string; severity: "leve" | "muscular" | "grave" }[]
  cohesionDelta: number            // entrosamento tático
}

/** Cria plano de treino padrão da semana. */
export function defaultWeekPlan(_round: number): TrainingWeekPlan {
  throw new Error("training-engine.defaultWeekPlan: not implemented")
}

/** Aplica plano semanal: atualiza atributos, moral, energia, gera lesões. */
export function applyWeek(_state: GameState, _plan: TrainingWeekPlan): {
  state: GameState
  result: TrainingResult
} {
  throw new Error("training-engine.applyWeek: not implemented")
}

/** Avalia risco de lesão de uma sessão. */
export function injuryRisk(_session: TrainingSession, _playerId: string): number {
  throw new Error("training-engine.injuryRisk: not implemented")
}
