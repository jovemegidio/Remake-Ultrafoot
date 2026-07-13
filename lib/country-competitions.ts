// Competicoes por PAIS/LIGA.
//
// A tela de Competicoes era hardcoded em Brasil: quem jogava com o Barcelona via
// "Copa do Brasil", "Paulistao" e "Libertadores". Aqui cada liga declara a sua copa
// nacional, a sua competicao continental e se o pais tem estadual (so o Brasil tem).

export interface CountryCompetitions {
  country: string
  /** Copa nacional (mata-mata). */
  domesticCup: string
  /** Competicao continental principal. */
  continental: string
  /** Segunda competicao continental (null quando nao houver). */
  continentalSecondary: string | null
  /** So o Brasil disputa campeonato estadual. */
  hasStateChampionship: boolean
}

const UEFA = {
  continental: "UEFA Champions League",
  continentalSecondary: "UEFA Europa League",
  hasStateChampionship: false,
}

const CONMEBOL = {
  continental: "Libertadores",
  continentalSecondary: "Copa Sul-Americana",
}

export const LEAGUE_COMPETITIONS: Record<string, CountryCompetitions> = {
  // Brasil — unico com estadual
  serie_a: { country: "Brasil", domesticCup: "Copa do Brasil", ...CONMEBOL, hasStateChampionship: true },
  serie_b: { country: "Brasil", domesticCup: "Copa do Brasil", ...CONMEBOL, hasStateChampionship: true },
  serie_c: { country: "Brasil", domesticCup: "Copa do Brasil", ...CONMEBOL, hasStateChampionship: true },
  serie_d: { country: "Brasil", domesticCup: "Copa do Brasil", ...CONMEBOL, hasStateChampionship: true },

  // Europa
  la_liga: { country: "Espanha", domesticCup: "Copa del Rey", ...UEFA },
  premier_league: { country: "Inglaterra", domesticCup: "FA Cup", ...UEFA },
  serie_a_ita: { country: "Italia", domesticCup: "Coppa Italia", ...UEFA },
  bundesliga: { country: "Alemanha", domesticCup: "DFB-Pokal", ...UEFA },
  ligue_1: { country: "Franca", domesticCup: "Coupe de France", ...UEFA },
  primeira_liga: { country: "Portugal", domesticCup: "Taca de Portugal", ...UEFA },
  eredivisie: { country: "Holanda", domesticCup: "KNVB Beker", ...UEFA },
  scottish_prem: { country: "Escocia", domesticCup: "Scottish Cup", ...UEFA },
  super_lig: { country: "Turquia", domesticCup: "Turkish Cup", ...UEFA },
  pro_league_bel: { country: "Belgica", domesticCup: "Beker van Belgie", ...UEFA },
  russian_prem: { country: "Russia", domesticCup: "Copa da Russia", ...UEFA },

  // America do Sul
  liga_argentina: { country: "Argentina", domesticCup: "Copa Argentina", ...CONMEBOL, hasStateChampionship: false },
  primera_a_col: { country: "Colombia", domesticCup: "Copa Colombia", ...CONMEBOL, hasStateChampionship: false },
  primera_div_chi: { country: "Chile", domesticCup: "Copa Chile", ...CONMEBOL, hasStateChampionship: false },
  primera_div_ury: { country: "Uruguai", domesticCup: "Copa Uruguay", ...CONMEBOL, hasStateChampionship: false },

  // Demais
  saudi_pro: { country: "Arabia Saudita", domesticCup: "King's Cup", continental: "AFC Champions League", continentalSecondary: null, hasStateChampionship: false },
  j_league: { country: "Japao", domesticCup: "Copa do Imperador", continental: "AFC Champions League", continentalSecondary: null, hasStateChampionship: false },
  k_league_1: { country: "Coreia do Sul", domesticCup: "Korean FA Cup", continental: "AFC Champions League", continentalSecondary: null, hasStateChampionship: false },
  chinese_super: { country: "China", domesticCup: "Chinese FA Cup", continental: "AFC Champions League", continentalSecondary: null, hasStateChampionship: false },
  mls: { country: "Estados Unidos", domesticCup: "US Open Cup", continental: "CONCACAF Champions Cup", continentalSecondary: null, hasStateChampionship: false },
  liga_mx: { country: "Mexico", domesticCup: "Copa MX", continental: "CONCACAF Champions Cup", continentalSecondary: null, hasStateChampionship: false },
}

const FALLBACK: CountryCompetitions = {
  country: "Internacional",
  domesticCup: "Copa Nacional",
  continental: "Copa Continental",
  continentalSecondary: null,
  hasStateChampionship: false,
}

export function getCountryCompetitions(divisao: string | undefined): CountryCompetitions {
  if (!divisao) return FALLBACK
  return LEAGUE_COMPETITIONS[divisao] ?? FALLBACK
}

/** Atalho: o time disputa campeonato estadual? (so clubes brasileiros) */
export function hasStateChampionship(divisao: string | undefined): boolean {
  return getCountryCompetitions(divisao).hasStateChampionship
}
