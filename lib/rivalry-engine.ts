// PHASE 22 — Rivalidades
// Status: skeleton — semana clássico, provocações, bônus torcida, pressão extra, moral.

export interface Rivalry {
  id: string                       // ex: "fla_flu", "atleti_cruzeiro"
  teamA: string                    // curto
  teamB: string
  intensity: number                // 0..100
  history: ClasicoMemory[]
}

export interface ClasicoMemory {
  season: number
  homeCurto: string
  awayCurto: string
  homeGoals: number
  awayGoals: number
}

export interface ClasicoWeek {
  rivalryId: string
  startsAt: number                 // week
  endsAt: number                   // week
  hypeLevel: number                // 0..100
  pressBoost: number
  fanBoost: number
  pressureExtra: number
  moralStakes: number              // mudança de moral em caso de vitória/derrota
}

/** Lookup pré-definido das principais rivalidades brasileiras. */
export const RIVALRIES: Rivalry[] = [
  // TODO: Fla x Flu, Cor x Pal, Sao x Cor, Atleti x Cru, Gre x Int, Ba x Vit, etc
]

/** Há rivalidade entre dois clubes? */
export function isClasico(_curtoA: string, _curtoB: string): Rivalry | null {
  throw new Error("rivalry-engine.isClasico: not implemented")
}

/** Configura semana de clássico (boost moral, pressão, hype). */
export function setupClasicoWeek(_rivalry: Rivalry, _week: number): ClasicoWeek {
  throw new Error("rivalry-engine.setupClasicoWeek: not implemented")
}

/** Aplica modifiers no MatchState pra clássicos. */
export function applyClasicoModifiers(_clasico: ClasicoWeek): {
  attackBoost: number
  pressureMultiplier: number
  cardChanceBoost: number
} {
  throw new Error("rivalry-engine.applyClasicoModifiers: not implemented")
}
