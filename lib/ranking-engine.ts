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
  throw new Error("ranking-engine.calcClubRanking: not implemented")
}

/** Calcula ranking continental (ex: CONMEBOL pontos por desempenho recente). */
export function calcContinentalRanking(_history: { season: number; curto: string; pais: string; pointsEarned: number }[]): ContinentalRanking[] {
  throw new Error("ranking-engine.calcContinentalRanking: not implemented")
}
