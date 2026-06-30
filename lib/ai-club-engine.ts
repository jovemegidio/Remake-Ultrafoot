// PHASE 38 — IA dos clubes (decisões fora do campo)
// Status: skeleton — contratar, vender, renovar, demitir técnico, mudar tática,
// usar base, entrar em crise. Cada clube tem perfil próprio.

import type { GameState } from "@/lib/save-system"
import type { TacticalIdentity } from "@/lib/tactics-engine"
import type { TransferOffer } from "@/lib/transfer-engine"

export type ClubAIPersonality = "agressivo" | "conservador" | "formador" | "comprador" | "vendedor"

export interface ClubAIConfig {
  curto: string
  personality: ClubAIPersonality
  budgetCaution: number            // 0..100
  starHunting: number              // 0..100 (vai atrás de big players)
  youthFocus: number               // 0..100
  identity: TacticalIdentity
  patienceWithCoach: number        // 0..100
  inCrisis: boolean
}

/** Tick weekly: cada clube IA decide o que fazer. */
export function tickAIDecisions(_state: GameState, _week: number): {
  state: GameState
  newOffers: TransferOffer[]
  coachChanges: { curto: string; newCoach: string }[]
  identityChanges: { curto: string; newIdentity: TacticalIdentity }[]
} {
  throw new Error("ai-club-engine.tickAIDecisions: not implemented")
}

/** Decide se clube IA quer comprar jogador X. */
export function evaluateBuy(
  _config: ClubAIConfig,
  _player: { overall: number; age: number; value: number; nationality: string },
): { wants: boolean; maxFee: number; maxSalary: number } {
  throw new Error("ai-club-engine.evaluateBuy: not implemented")
}

/** Decide se clube IA aceita vender jogador. */
export function evaluateSell(
  _config: ClubAIConfig,
  _player: { overall: number; age: number; valueClub: number },
  _offer: TransferOffer,
): boolean {
  throw new Error("ai-club-engine.evaluateSell: not implemented")
}

/** Detecta se clube entrou em crise → muda comportamento. */
export function detectCrisis(_recentResults: ("W"|"D"|"L")[], _financeRunway: number): boolean {
  throw new Error("ai-club-engine.detectCrisis: not implemented")
}
