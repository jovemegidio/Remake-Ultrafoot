import { competitionsByLeague } from "./international-competitions"

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
  /** Terceira competicao continental, quando houver. */
  continentalTertiary?: string | null
  /** So o Brasil disputa campeonato estadual. */
  hasStateChampionship: boolean
}

const UEFA = {
  continental: "UEFA Champions League",
  continentalSecondary: "UEFA Europa League",
  continentalTertiary: "UEFA Conference League",
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
  saudi_pro: { country: "Arabia Saudita", domesticCup: "King's Cup", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  j_league: { country: "Japao", domesticCup: "Copa do Imperador", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  k_league_1: { country: "Coreia do Sul", domesticCup: "Korean FA Cup", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  chinese_super: { country: "China", domesticCup: "Chinese FA Cup", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  mls: { country: "Estados Unidos", domesticCup: "US Open Cup", continental: "CONCACAF Champions Cup", continentalSecondary: null, hasStateChampionship: false },
  liga_mx: { country: "Mexico", domesticCup: "Leagues Cup", continental: "CONCACAF Champions Cup", continentalSecondary: null, hasStateChampionship: false },
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

// ─── Confederacao ────────────────────────────────────────────────────────────
//
// Nao basta acertar o NOME da competicao continental: os ADVERSARIOS tambem precisam
// vir do continente certo. A tela sorteava a continental a partir de uma lista fixa de
// clubes sul-americanos (Boca, River, Penarol...), entao a Juventus caia num chaveamento
// contra o Boca Juniors. Aqui derivamos a confederacao a partir da liga do clube e, com
// ela, quais ligas fornecem os participantes.

export type Confederation = "CONMEBOL" | "UEFA" | "AFC" | "CONCACAF"

const CONFEDERATION_DIVISIONS: Record<Confederation, string[]> = {
  CONMEBOL: [
    "serie_a", "serie_b", "serie_c", "serie_d",
    "liga_argentina", "primera_a_col", "primera_div_chi", "primera_div_ury",
  ],
  UEFA: [
    "premier_league", "la_liga", "serie_a_ita", "bundesliga", "ligue_1",
    "primeira_liga", "eredivisie", "scottish_prem", "super_lig",
    "pro_league_bel", "russian_prem",
  ],
  AFC: ["saudi_pro", "j_league", "k_league_1", "chinese_super"],
  CONCACAF: ["mls", "liga_mx"],
}

export function getConfederation(divisao: string | undefined): Confederation {
  if (!divisao) return "CONMEBOL"
  for (const [conf, divs] of Object.entries(CONFEDERATION_DIVISIONS)) {
    if (divs.includes(divisao)) return conf as Confederation
  }
  return "CONMEBOL"
}

/** Ligas que fornecem os participantes da continental do clube. */
export function getContinentalDivisions(divisao: string | undefined): string[] {
  return CONFEDERATION_DIVISIONS[getConfederation(divisao)]
}

// ─── Qual continental o clube disputa ────────────────────────────────────────
//
// Nao basta saber o continente: o clube nao "joga a Champions" por ser europeu — ele
// joga a Champions OU a Europa League conforme ONDE TERMINOU. Antes a tela fixava a
// competicao principal, entao um 6o colocado aparecia na Champions.

export interface ContinentalSpot {
  /** Nome da competicao que ele disputa; null se nao se classificou. */
  competition: string | null
  qualified: boolean
  /** true quando e a secundaria (Europa League / Sul-Americana). */
  isSecondary: boolean
}

/**
 * @param position Posicao na liga (1 = lider). 0/undefined = temporada nao comecou.
 */
export function getContinentalSpot(
  divisao: string | undefined,
  position: number | undefined,
): ContinentalSpot {
  const comps = getCountryCompetitions(divisao)
  const league = divisao
    ? competitionsByLeague[divisao as keyof typeof competitionsByLeague]?.find(competition => competition.type === "league")
    : undefined
  const allocations = league?.continentalSpots ?? []
  const primarySpots = allocations[0]?.spots ?? 0
  const secondarySpots = allocations[1]?.spots ?? 0
  const tertiarySpots = allocations[2]?.spots ?? 0

  if (!position || position <= 0) {
    return { competition: comps.continental, qualified: false, isSecondary: false }
  }

  if (position <= primarySpots) {
    return { competition: comps.continental, qualified: true, isSecondary: false }
  }

  if (position <= primarySpots + secondarySpots && comps.continentalSecondary) {
    return { competition: comps.continentalSecondary, qualified: true, isSecondary: true }
  }

  if (position <= primarySpots + secondarySpots + tertiarySpots && comps.continentalTertiary) {
    return { competition: comps.continentalTertiary, qualified: true, isSecondary: true }
  }

  // Fora das vagas: mostra a principal como alvo, mas nao classificado.
  return { competition: comps.continental, qualified: false, isSecondary: false }
}
