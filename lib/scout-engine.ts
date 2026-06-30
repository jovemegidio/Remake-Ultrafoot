// PHASE 9 — Scouting
// Status: skeleton — olheiro nacional/internacional, potencial, encaixe tático,
// histórico de lesão, salário esperado, custo, risco, personalidade.

import type { Personality } from "@/lib/youth-engine"

export type ScoutRegion =
  | "br_sudeste"
  | "br_sul"
  | "br_nordeste"
  | "br_norte"
  | "br_centrooeste"
  | "sa_argentina"
  | "sa_uruguai"
  | "sa_outros"
  | "europa"
  | "africa"
  | "asia"

export interface ScoutAssignment {
  id: string
  scoutName: string
  region: ScoutRegion
  focus: "young" | "first_team" | "specific_position"
  positionFocus?: string
  startedAt: number                // week
  durationWeeks: number
  reportsCount: number
}

export interface ScoutReport {
  id: string
  playerId: string
  playerName: string
  scoutName: string
  region: ScoutRegion
  knownAttributes: Partial<Record<string, number>>  // overall, pace, etc — o que o olheiro descobriu
  potentialEstimate: { min: number; max: number }
  tacticalFit: number              // 0-100
  injuryRisk: "low" | "medium" | "high"
  expectedSalary: number
  estimatedTransferCost: number
  contractRisk: "low" | "medium" | "high"
  personality?: Personality
  recommendation: "sign" | "monitor" | "pass"
  notes: string
  generatedAt: number              // week
}

/** Designa olheiro para missão (região + foco). */
export function assignScout(_assignment: ScoutAssignment): void {
  throw new Error("scout-engine.assignScout: not implemented")
}

/** Avança 1 semana: olheiros geram reports baseado na qualidade do staff. */
export function tickScouting(_currentWeek: number): ScoutReport[] {
  throw new Error("scout-engine.tickScouting: not implemented")
}

/** Pede reavaliação focal de jogador específico. */
export function deepScout(_playerId: string, _scoutName: string): ScoutReport {
  throw new Error("scout-engine.deepScout: not implemented")
}
