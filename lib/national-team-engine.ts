// PHASE 26 — Seleções
// Convocações por forma/overall, simulação de partidas de seleção com
// distribuição de Poisson e ranking estilo Elo (modelo FIFA simplificado).

export interface NationalTeam {
  countryCode: string              // "BRA", "ARG", etc
  countryName: string
  prestigio: number
  rankingPosition: number          // ranking fictício UF
  rankingPoints: number
  squad: string[]                  // playerIds convocados
  manager: string                  // técnico
}

export type CallUpReason =
  | "form"                         // forma boa no clube
  | "regular_starter"
  | "promising_youth"
  | "veteran_experience"
  | "injury_replacement"

export interface CallUp {
  playerId: string
  countryCode: string
  competition: "amistoso" | "eliminatorias" | "copa" | "copa_continental"
  reason: CallUpReason
  matches: number                  // jogos previstos no período
  weekStart: number
  weekEnd: number
}

const SQUAD_SIZE: Record<CallUp["competition"], number> = {
  amistoso: 23,
  eliminatorias: 23,
  copa: 26,
  copa_continental: 26,
}

const MATCHES_IN_WINDOW: Record<CallUp["competition"], number> = {
  amistoso: 2,
  eliminatorias: 2,
  copa: 7,
  copa_continental: 6,
}

/** Convoca jogadores de acordo com forma e tipo de competição. */
export function callUpSquad(
  country: NationalTeam,
  competition: CallUp["competition"],
  eligiblePlayers: { playerId: string; overall: number; form: number; nationality: string; age?: number }[],
): CallUp[] {
  const size = SQUAD_SIZE[competition]
  const matches = MATCHES_IN_WINDOW[competition]

  // Score de convocação: overall pesa mais, forma desempata, copa privilegia experiência
  const scored = eligiblePlayers
    .filter(p => p.nationality === country.countryCode || p.nationality === country.countryName)
    .map(p => {
      const formBonus = (p.form - p.overall) * 0.6
      const expBonus = competition === "copa" && (p.age ?? 27) >= 29 ? 1.5 : 0
      return { p, score: p.overall + formBonus + expBonus }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, size)

  return scored.map(({ p }, i) => {
    let reason: CallUpReason = "regular_starter"
    if (p.form >= p.overall + 4) reason = "form"
    else if ((p.age ?? 27) <= 21) reason = "promising_youth"
    else if ((p.age ?? 27) >= 32) reason = "veteran_experience"
    else if (i >= size - 3) reason = "injury_replacement"
    return {
      playerId: p.playerId,
      countryCode: country.countryCode,
      competition,
      reason,
      matches,
      weekStart: 0,
      weekEnd: 2,
    }
  })
}

// ─── Simulação de partida (Poisson bivariado simplificado) ───────────────────

function poissonSample(lambda: number): number {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do { k++; p *= Math.random() } while (p > L)
  return k - 1
}

/** Simula partida de seleção. Força relativa define os gols esperados. */
export function simulateNationalMatch(
  home: NationalTeam,
  away: NationalTeam,
): { homeGoals: number; awayGoals: number } {
  const diff = home.prestigio - away.prestigio
  // Gols esperados: base 1.25 (mando leve) ajustada pela diferença de força
  const homeLambda = Math.max(0.25, Math.min(4, 1.35 + diff * 0.045))
  const awayLambda = Math.max(0.2, Math.min(4, 1.05 - diff * 0.04))
  return {
    homeGoals: poissonSample(homeLambda),
    awayGoals: poissonSample(awayLambda),
  }
}

// ─── Ranking (Elo, modelo SUM do ranking FIFA) ────────────────────────────────

const K_FACTOR = 35

/** Atualiza ranking após resultado (Elo com resultado esperado). */
export function updateRanking(
  all: NationalTeam[],
  result: { homeCode: string; awayCode: string; homeGoals: number; awayGoals: number },
): NationalTeam[] {
  const home = all.find(t => t.countryCode === result.homeCode)
  const away = all.find(t => t.countryCode === result.awayCode)
  if (!home || !away) return all

  const actual = result.homeGoals > result.awayGoals ? 1 : result.homeGoals === result.awayGoals ? 0.5 : 0
  const expected = 1 / (1 + Math.pow(10, (away.rankingPoints - home.rankingPoints) / 600))
  const delta = K_FACTOR * (actual - expected)

  const updated = all.map(t => {
    if (t.countryCode === home.countryCode) return { ...t, rankingPoints: Math.round(t.rankingPoints + delta) }
    if (t.countryCode === away.countryCode) return { ...t, rankingPoints: Math.round(t.rankingPoints - delta) }
    return t
  })

  // Reordena posições
  const sorted = [...updated].sort((a, b) => b.rankingPoints - a.rankingPoints)
  const posMap = new Map(sorted.map((t, i) => [t.countryCode, i + 1]))
  return updated.map(t => ({ ...t, rankingPosition: posMap.get(t.countryCode) ?? t.rankingPosition }))
}
