// PHASE 33 — Ranking dinâmico de clubes
// Status: skeleton — prestígio, torcida, elenco, finanças, base, ranking continental.

export interface ClubRankingScore {
  curto: string
  nome: string
  totalScore: number               // soma ponderada
  components: {
    prestigio: number              // 0..100 → peso 0.25
    torcida: number                // 0..100 → peso 0.15
    squadStrength: number          // overall médio do elenco → peso 0.25
    finance: number                // saldo normalizado → peso 0.15
    youthLevel: number             // potencial médio da base → peso 0.10
    recentTrophies: number         // últimas 5 temporadas → peso 0.10
  }
}

export interface ContinentalRanking {
  curto: string
  nome: string
  pais: string
  points: number                   // CONMEBOL pts (5 anos rolling)
  position: number
}

/** Calcula ranking dinâmico de clubes. */
export function calcClubRanking(_clubs: { curto: string; nome: string; data: ClubRankingScore["components"] }[]): ClubRankingScore[] {
  return _clubs.map(club => ({
    curto: club.curto, nome: club.nome, components: { ...club.data },
    totalScore: Math.round((club.data.prestigio * .25 + club.data.torcida * .15 + club.data.squadStrength * .25 + club.data.finance * .15 + club.data.youthLevel * .10 + club.data.recentTrophies * .10) * 100) / 100,
  })).sort((a, b) => b.totalScore - a.totalScore || a.nome.localeCompare(b.nome))
}

/** Calcula ranking continental (ex: CONMEBOL pontos por desempenho recente). */
export function calcContinentalRanking(_history: { season: number; curto: string; pais: string; pointsEarned: number }[]): ContinentalRanking[] {
  const latest = Math.max(0, ..._history.map(item => item.season))
  const clubs = new Map<string, { nome: string; pais: string; points: number }>()
  for (const item of _history) {
    const age = latest - item.season
    if (age > 4) continue
    const current = clubs.get(item.curto) ?? { nome: item.curto, pais: item.pais, points: 0 }
    current.points += item.pointsEarned * (1 - age * 0.12)
    clubs.set(item.curto, current)
  }
  return [...clubs.entries()].map(([curto, data]) => ({ curto, nome: data.nome, pais: data.pais, points: Math.round(data.points * 100) / 100, position: 0 }))
    .sort((a, b) => b.points - a.points || a.curto.localeCompare(b.curto)).map((item, index) => ({ ...item, position: index + 1 }))
}
