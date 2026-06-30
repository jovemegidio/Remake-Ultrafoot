// PHASE 34 — Reputação de jogadores
// Status: skeleton — promessa → estrela → ídolo → lenda. Impacta salário, torcida, mercado, camisa.

export type ReputationTier = "promessa" | "titular" | "estrela" | "idolo" | "lenda"

export interface PlayerReputation {
  playerId: string
  tier: ReputationTier
  globalReputation: number         // 0..100
  clubAffinity: Record<string, number> // curto -> 0..100 (preferência/identificação)
  shirtSales: number               // multiplier 0..3
  fanFavoriteOf?: string           // curto
}

export interface ReputationFactors {
  goals: number
  assists: number
  trophies: number
  yearsAtClub: number
  manOfTheMatchCount: number
  ageBonus: number                 // veteranos sobem mais devagar
}

/** Calcula tier a partir de fatores. */
export function calcTier(_factors: ReputationFactors): ReputationTier {
  throw new Error("reputation-engine.calcTier: not implemented")
}

/** Atualiza reputação após resultado/temporada. */
export function update(_rep: PlayerReputation, _factors: ReputationFactors): PlayerReputation {
  throw new Error("reputation-engine.update: not implemented")
}

/** Multiplicador de salário esperado por tier. */
export function salaryMultiplier(_tier: ReputationTier): number {
  return ({ promessa: 0.7, titular: 1.0, estrela: 1.6, idolo: 2.4, lenda: 3.5 } as Record<ReputationTier, number>)[_tier]
}
