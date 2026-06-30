// PHASE 4 — Reconstrução de clube (cenários iniciais)
// Status: skeleton — cenários: gigante em crise, clube endividado, rebaixado,
// envelhecido, formador, pequeno, recém-promovido. Cada um tem metas por temporada.

import type { SavedTeam, GameState } from "@/lib/save-system"

export type RebuildScenarioId =
  | "giant_crisis"
  | "indebted"
  | "relegated"
  | "aging_squad"
  | "youth_developer"
  | "small_club"
  | "newly_promoted"

export interface SeasonGoal {
  season: number
  esportiva: { metric: string; target: string | number }
  financeira: { metric: string; target: number }
  base: { metric: string; target: string | number }
}

export interface RebuildScenario {
  id: RebuildScenarioId
  nome: string
  descricao: string
  modifiers: {
    saldoMultiplier?: number
    saldoOverride?: number
    debt?: number
    averageAge?: "young" | "old"
    moraleStart?: number
    boardPatience?: "low" | "medium" | "high"
  }
  goals: SeasonGoal[]
  durationSeasons: number
}

export const REBUILD_SCENARIOS: RebuildScenario[] = [
  // TODO: definir 7 cenários
]

/** Aplica modifiers do cenário no GameState inicial. */
export function applyScenario(_id: RebuildScenarioId, _team: SavedTeam, _state: GameState): GameState {
  throw new Error("rebuild-engine.applyScenario: not implemented")
}

/** Avalia metas anuais do cenário. */
export function evaluateGoals(_id: RebuildScenarioId, _state: GameState): {
  esportivaCompleted: boolean
  financeiraCompleted: boolean
  baseCompleted: boolean
} {
  throw new Error("rebuild-engine.evaluateGoals: not implemented")
}
