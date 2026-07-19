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
  ["fla_flu", "FLA", "FLU", 96], ["derby_paulista", "COR", "PAL", 98],
  ["majestoso", "SAO", "COR", 94], ["choque_rei", "PAL", "SAO", 93],
  ["mineiro", "CAM", "CRU", 97], ["grenal", "INT", "GRE", 100],
  ["bavi", "BAH", "VIT", 95], ["classico_rei", "FOR", "CEA", 94],
  ["classico_vovo", "BOT", "FLU", 87], ["milhoes", "FLA", "VAS", 99],
].map(([id, teamA, teamB, intensity]) => ({ id: String(id), teamA: String(teamA), teamB: String(teamB), intensity: Number(intensity), history: [] }))

/** Há rivalidade entre dois clubes? */
export function isClasico(_curtoA: string, _curtoB: string): Rivalry | null {
  const a = _curtoA.toUpperCase(), b = _curtoB.toUpperCase()
  return RIVALRIES.find(r => (r.teamA === a && r.teamB === b) || (r.teamA === b && r.teamB === a)) ?? null
}

/** Configura semana de clássico (boost moral, pressão, hype). */
export function setupClasicoWeek(_rivalry: Rivalry, _week: number): ClasicoWeek {
  const historyBoost = Math.min(10, _rivalry.history.length)
  const hypeLevel = Math.min(100, _rivalry.intensity + historyBoost)
  return { rivalryId: _rivalry.id, startsAt: Math.max(0, _week - 1), endsAt: _week + 1, hypeLevel, pressBoost: Math.round(hypeLevel * .16), fanBoost: Math.round(hypeLevel * .2), pressureExtra: Math.round(hypeLevel * .18), moralStakes: Math.round(5 + hypeLevel * .08) }
}

/** Aplica modifiers no MatchState pra clássicos. */
export function applyClasicoModifiers(_clasico: ClasicoWeek): {
  attackBoost: number
  pressureMultiplier: number
  cardChanceBoost: number
} {
  return { attackBoost: Math.round(_clasico.hypeLevel * .035 * 100) / 100, pressureMultiplier: 1 + _clasico.pressureExtra / 100, cardChanceBoost: Math.round(_clasico.hypeLevel * .06 * 100) / 100 }
}
