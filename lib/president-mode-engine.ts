// PHASE 28 — Modo Presidente / Diretor
// Status: skeleton — contratar técnico, orçamento, estádio, patrocinador, finanças.
// Visão complementar do GameState — sem controlar tática/escalação.

import type { GameState } from "@/lib/save-system"

export type PresidentialAction =
  | "hire_coach"
  | "fire_coach"
  | "set_budget"
  | "approve_signing"
  | "reject_signing"
  | "request_facility_upgrade"
  | "negotiate_sponsor"
  | "set_ticket_price"

export interface CoachCandidate {
  name: string
  reputation: number               // 0..100
  identity: string                 // ver tactics-engine.TacticalIdentity
  monthlyWage: number
  contractMonths: number
  achievements: string[]
}

/** Inicia carreira no modo presidente. */
export function startPresidentMode(_state: GameState): GameState {
  throw new Error("president-mode-engine.startPresidentMode: not implemented")
}

/** Lista candidatos a técnico. */
export function listCoachCandidates(_clubPrestigio: number): CoachCandidate[] {
  throw new Error("president-mode-engine.listCoachCandidates: not implemented")
}

/** Aplica ação presidencial. */
export function applyAction(
  _state: GameState,
  _action: PresidentialAction,
  _payload: Record<string, unknown>,
): GameState {
  throw new Error("president-mode-engine.applyAction: not implemented")
}
