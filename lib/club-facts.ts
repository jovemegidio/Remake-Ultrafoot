// Fatos REAIS de clubes: fundação e contagem de títulos.
//
// A tela de seleção INVENTAVA esses números por hash do nome (Corinthians saía
// como "1895, 11 ligas" — o real é 1910, 7). São afirmações sobre clubes reais:
// ou vêm de curadoria, ou mostramos "—". Nunca um número inventado.
//
// Contagens conservadoras (títulos oficialmente reconhecidos, sem casos em
// disputa). Revisão editorial do usuário é bem-vinda — basta editar aqui.

export interface ClubFacts {
  foundation: number
  /** Ligas nacionais (Brasileirão unificado pela CBF). */
  ligas: number
  /** Copas nacionais (Copa do Brasil). */
  copas: number
  /** Continentais principais (Libertadores). */
  continental: number
}

export const CLUB_FACTS: Record<string, ClubFacts> = {
  COR: { foundation: 1910, ligas: 7, copas: 3, continental: 1 },
  PAL: { foundation: 1914, ligas: 12, copas: 4, continental: 3 },
  SAN: { foundation: 1912, ligas: 8, copas: 1, continental: 3 },
  SAO: { foundation: 1930, ligas: 6, copas: 1, continental: 3 },
  FLA: { foundation: 1895, ligas: 7, copas: 4, continental: 3 },
  FLU: { foundation: 1902, ligas: 4, copas: 1, continental: 1 },
  BOT: { foundation: 1904, ligas: 3, copas: 0, continental: 1 },
  VAS: { foundation: 1898, ligas: 4, copas: 1, continental: 1 },
  GRE: { foundation: 1903, ligas: 2, copas: 5, continental: 3 },
  INT: { foundation: 1909, ligas: 3, copas: 1, continental: 2 },
  CRU: { foundation: 1921, ligas: 4, copas: 6, continental: 2 },
  CAM: { foundation: 1908, ligas: 2, copas: 2, continental: 1 },
  BAH: { foundation: 1931, ligas: 2, copas: 0, continental: 0 },
  COR_PR: { foundation: 1924, ligas: 1, copas: 1, continental: 0 },
}

/** Fatos do clube, por `curto`. `null` = sem curadoria: a UI mostra "—". */
export function getClubFacts(curto: string | undefined | null): ClubFacts | null {
  if (!curto) return null
  return CLUB_FACTS[curto] ?? null
}
