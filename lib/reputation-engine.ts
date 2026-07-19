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
  const score = _factors.goals * 1.5 + _factors.assists + _factors.trophies * 16 + _factors.yearsAtClub * 5 + _factors.manOfTheMatchCount * 2 + _factors.ageBonus
  if (score >= 150) return "lenda"
  if (score >= 90) return "idolo"
  if (score >= 48) return "estrela"
  if (score >= 16) return "titular"
  return "promessa"
}

/** Atualiza reputação após resultado/temporada. */
export function update(_rep: PlayerReputation, _factors: ReputationFactors): PlayerReputation {
  const tier = calcTier(_factors)
  const gain = _factors.goals * .35 + _factors.assists * .25 + _factors.trophies * 5 + _factors.manOfTheMatchCount * .8 + _factors.yearsAtClub
  const globalReputation = Math.max(0, Math.min(100, Math.round((_rep.globalReputation + gain) * 10) / 10))
  return { ..._rep, tier, globalReputation, shirtSales: Math.min(3, Math.round((salaryMultiplier(tier) * .7 + globalReputation / 100) * 100) / 100) }
}

/** Multiplicador de salário esperado por tier. */
export function salaryMultiplier(_tier: ReputationTier): number {
  return ({ promessa: 0.7, titular: 1.0, estrela: 1.6, idolo: 2.4, lenda: 3.5 } as Record<ReputationTier, number>)[_tier]
}
