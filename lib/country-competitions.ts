import { competitionsByLeague } from "./international-competitions"
import { UEFA_EXPANSION_FEDERATIONS } from "./uefa-expansion"
import { DIVISOES_DE_ACESSO, IDS_DE_ACESSO } from "./divisao-de-acesso"

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

const LEAGUE_COMPETITIONS_BASE: Record<string, CountryCompetitions> = {
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
  primera_a_ecu: { country: "Equador", domesticCup: "Copa Ecuador", ...CONMEBOL, hasStateChampionship: false },

  // Demais
  saudi_pro: { country: "Arabia Saudita", domesticCup: "King's Cup", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  j_league: { country: "Japao", domesticCup: "Copa do Imperador", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  k_league_1: { country: "Coreia do Sul", domesticCup: "Korean FA Cup", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  chinese_super: { country: "China", domesticCup: "Chinese FA Cup", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  mls: { country: "Estados Unidos", domesticCup: "US Open Cup", continental: "CONCACAF Champions Cup", continentalSecondary: null, hasStateChampionship: false },
  liga_mx: { country: "Mexico", domesticCup: "Leagues Cup", continental: "CONCACAF Champions Cup", continentalSecondary: null, hasStateChampionship: false },

  // ── As 18 divisoes que caiam no FALLBACK ────────────────────────────────────
  //
  // A auditoria de 31/07/2026 achou dezoito divisoes JOGAVEIS sem entrada aqui.
  // Elas nao ficavam sem competicao: caiam no FALLBACK, e o clube disputava uma
  // "Copa Nacional" e uma "Copa Continental" — nomes inventados, iguais para
  // ingles, tcheco e boliviano. Quem escolhia o Hertha via o time competir numa
  // copa que nao existe, em vez da DFB-Pokal.
  //
  // SEGUNDAS DIVISOES: disputam a copa nacional do proprio pais (na vida real o
  // segundo escalao entra na FA Cup, na Copa del Rey, na Coppa Italia) e tem a
  // continental do pais como horizonte — chegar la depende de subir, e disso
  // cuida a piramide.
  championship: { country: "Inglaterra", domesticCup: "FA Cup", ...UEFA },
  la_liga_2: { country: "Espanha", domesticCup: "Copa del Rey", ...UEFA },
  serie_b_ita: { country: "Italia", domesticCup: "Coppa Italia", ...UEFA },
  bundesliga_2: { country: "Alemanha", domesticCup: "DFB-Pokal", ...UEFA },
  ligue_2: { country: "Franca", domesticCup: "Coupe de France", ...UEFA },
  primera_b_chi: { country: "Chile", domesticCup: "Copa Chile", ...CONMEBOL, hasStateChampionship: false },
  saudi_first_div: { country: "Arabia Saudita", domesticCup: "King's Cup", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  liga_portugal_2: { country: "Portugal", domesticCup: "Taca de Portugal", ...UEFA },
  eerste_divisie: { country: "Holanda", domesticCup: "KNVB Beker", ...UEFA },
  challenger_pro: { country: "Belgica", domesticCup: "Beker van Belgie", ...UEFA },
  tff_1_lig: { country: "Turquia", domesticCup: "Turkish Cup", ...UEFA },
  russian_first: { country: "Russia", domesticCup: "Copa da Russia", ...UEFA },
  primera_b_arg: { country: "Argentina", domesticCup: "Copa Argentina", ...CONMEBOL, hasStateChampionship: false },
  torneo_betplay: { country: "Colombia", domesticCup: "Copa Colombia", ...CONMEBOL, hasStateChampionship: false },
  segunda_div_ury: { country: "Uruguai", domesticCup: "Copa AUF Uruguay", ...CONMEBOL, hasStateChampionship: false },
  liga_2_per: { country: "Peru", domesticCup: "Copa de la Liga", ...CONMEBOL, hasStateChampionship: false },
  copa_simon_bolivar: { country: "Bolivia", domesticCup: "Copa de la División Profesional", ...CONMEBOL, hasStateChampionship: false },
  division_intermedia_par: { country: "Paraguai", domesticCup: "Copa Paraguay", ...CONMEBOL, hasStateChampionship: false },
  liga_futve_2: { country: "Venezuela", domesticCup: "Copa Venezuela", ...CONMEBOL, hasStateChampionship: false },
  j2_league: { country: "Japao", domesticCup: "Copa do Imperador", continental: "AFC Champions League Elite", continentalSecondary: "AFC Champions League Two", hasStateChampionship: false },
  k_league_2: { country: "Coreia do Sul", domesticCup: "Korea Cup", continental: "AFC Champions League Elite", continentalSecondary: "AFC Champions League Two", hasStateChampionship: false },
  scottish_champ: { country: "Escocia", domesticCup: "Scottish Cup", ...UEFA },
  serie_b_ecu: { country: "Equador", domesticCup: "Copa Ecuador", ...CONMEBOL, hasStateChampionship: false },
  china_league_one: { country: "China", domesticCup: "Chinese FA Cup", continental: "AFC Champions League Elite", continentalSecondary: "AFC Champions League Two", hasStateChampionship: false },

  // LIGAS NACIONAIS que existiam no catalogo sem competicoes declaradas. Sao as
  // mesmas onze que tinham menos de oito clubes e agora foram completadas pelo
  // pool (ver completarLigaComPool em lib/teams-data): sem estas entradas, o
  // campeonato ficava de pe mas a copa e a continental continuavam genericas.
  primera_div_per: { country: "Peru", domesticCup: "Copa de la Liga", ...CONMEBOL, hasStateChampionship: false },
  primera_div_ven: { country: "Venezuela", domesticCup: "Copa Venezuela", ...CONMEBOL, hasStateChampionship: false },
  primera_div_bol: { country: "Bolivia", domesticCup: "Copa Bolivia", ...CONMEBOL, hasStateChampionship: false },
  primera_div_par: { country: "Paraguai", domesticCup: "Copa Paraguai", ...CONMEBOL, hasStateChampionship: false },
  super_league_gre: { country: "Grecia", domesticCup: "Copa da Grecia", ...UEFA },
  superliga_den: { country: "Dinamarca", domesticCup: "Copa da Dinamarca", ...UEFA },
  fortuna_liga_cze: { country: "Chequia", domesticCup: "Copa da Chequia", ...UEFA },
  premyer_liqa_aze: { country: "Azerbaijao", domesticCup: "Copa do Azerbaijao", ...UEFA },
  eliteserien_nor: { country: "Noruega", domesticCup: "Copa da Noruega", ...UEFA },
  protathlima_cyp: { country: "Chipre", domesticCup: "Copa do Chipre", ...UEFA },
  premier_liga_kaz: { country: "Cazaquistao", domesticCup: "Copa do Cazaquistao", ...UEFA },
  betinia_liga: { country: "Dinamarca", domesticCup: "Copa da Dinamarca", ...UEFA },
  obos_ligaen: { country: "Noruega", domesticCup: "Copa da Noruega", ...UEFA },
  second_div_cyp: { country: "Chipre", domesticCup: "Copa do Chipre", ...UEFA },
  chance_narodni_liga: { country: "Chequia", domesticCup: "Copa da Chequia", ...UEFA },
  league_one_eng: { country: "Inglaterra", domesticCup: "FA Cup", ...UEFA },
  league_two_eng: { country: "Inglaterra", domesticCup: "FA Cup", ...UEFA },
  national_league_eng: { country: "Inglaterra", domesticCup: "FA Cup", ...UEFA },
  national_league_ns_eng: { country: "Inglaterra", domesticCup: "FA Cup", ...UEFA },
  primera_federacion_esp: { country: "Espanha", domesticCup: "Copa del Rey", ...UEFA },
  segunda_federacion_esp: { country: "Espanha", domesticCup: "Copa del Rey", ...UEFA },
  dritte_liga_ger: { country: "Alemanha", domesticCup: "DFB-Pokal", ...UEFA },
  national_fra: { country: "Franca", domesticCup: "Coupe de France", ...UEFA },
  liga_3_por: { country: "Portugal", domesticCup: "Taca de Portugal", ...UEFA },
  campeonato_portugal: { country: "Portugal", domesticCup: "Taca de Portugal", ...UEFA },
  scottish_league_one: { country: "Escocia", domesticCup: "Scottish Cup", ...UEFA },
  scottish_league_two: { country: "Escocia", domesticCup: "Scottish Cup", ...UEFA },
  first_national_bel: { country: "Belgica", domesticCup: "Beker van Belgie", ...UEFA },
  tff_2_lig: { country: "Turquia", domesticCup: "Turkish Cup", ...UEFA },
  super_league_2_gre: { country: "Grecia", domesticCup: "Copa da Grecia", ...UEFA },
}

for (const federation of UEFA_EXPANSION_FEDERATIONS) {
  for (const division of [federation.top, federation.second]) {
    if (!division?.participants.length) continue
    // Vai para a BASE, e nao para o objeto exportado: este laço roda antes de o
    // derivado existir, e é a base que a derivação lê.
    LEAGUE_COMPETITIONS_BASE[division.id] = {
      country: federation.country,
      domesticCup: `Copa nacional — ${federation.country}`,
      ...UEFA,
    }
  }
}

const FALLBACK: CountryCompetitions = {
  country: "Internacional",
  domesticCup: "Copa Nacional",
  continental: "Copa Continental",
  continentalSecondary: null,
  hasStateChampionship: false,
}

/**
 * ⚠️ AS DIVISOES DE ACESSO ENTRAM AQUI, DEPOIS — nao dentro do objeto acima.
 *
 * Elas HERDAM a configuracao da divisao logo acima delas: mesmo pais, mesma copa
 * nacional, mesma continental, mesmo estadual. E o certo por construcao (um
 * clube nao muda de pais nem de copa ao subir um degrau) e evita que a base
 * fique com dado velho quando a divisao de cima for corrigida.
 *
 * A copa nacional entra junto porque e assim na vida real: a vaga do clube
 * pequeno sai da base, e sortear o gigante na primeira fase e justamente a
 * recompensa de comecar por baixo.
 *
 * Um objeto nao pode se referenciar durante a propria inicializacao — por isso a
 * derivacao mora fora dele.
 */
export const LEAGUE_COMPETITIONS: Record<string, CountryCompetitions> = {
  ...LEAGUE_COMPETITIONS_BASE,
  ...Object.fromEntries(DIVISOES_DE_ACESSO.map(acesso =>
    [acesso.id, { ...(LEAGUE_COMPETITIONS_BASE[acesso.acima] ?? FALLBACK) }])),
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

export type Confederation = "CONMEBOL" | "UEFA" | "AFC" | "CONCACAF" | "UNAFFILIATED"

const CONFEDERATION_DIVISIONS: Record<Confederation, string[]> = {
  CONMEBOL: [
    "serie_a", "serie_b", "serie_c", "serie_d",
    "liga_argentina", "primera_a_col", "primera_div_chi", "primera_div_ury", "primera_a_ecu",
    "primera_b_arg", "torneo_betplay", "primera_b_chi", "segunda_div_ury", "serie_b_ecu",
    "primera_div_per", "primera_div_ven", "primera_div_bol", "primera_div_par",
    "liga_2_per", "copa_simon_bolivar", "division_intermedia_par", "liga_futve_2",
  ],
  UEFA: [
    "premier_league", "la_liga", "serie_a_ita", "bundesliga", "ligue_1",
    "primeira_liga", "eredivisie", "scottish_prem", "super_lig",
    "pro_league_bel", "russian_prem",
    "championship", "la_liga_2", "serie_b_ita", "bundesliga_2", "ligue_2",
    "liga_portugal_2", "eerste_divisie", "scottish_champ", "tff_1_lig",
    "challenger_pro", "russian_first", "super_league_gre", "superliga_den",
    "fortuna_liga_cze", "premyer_liqa_aze", "eliteserien_nor", "protathlima_cyp",
    "premier_liga_kaz", "betinia_liga", "obos_ligaen", "second_div_cyp", "chance_narodni_liga",
    "league_one_eng", "league_two_eng", "national_league_eng", "national_league_ns_eng",
    "primera_federacion_esp", "segunda_federacion_esp", "dritte_liga_ger", "national_fra",
    "liga_3_por", "campeonato_portugal", "scottish_league_one", "scottish_league_two",
    "first_national_bel", "tff_2_lig", "super_league_2_gre",
  ],
  AFC: ["saudi_pro", "saudi_first_div", "j_league", "j2_league", "k_league_1", "k_league_2", "chinese_super", "china_league_one"],
  CONCACAF: ["mls", "liga_mx"],
  UNAFFILIATED: [],
}

CONFEDERATION_DIVISIONS.UEFA.push(...UEFA_EXPANSION_FEDERATIONS.flatMap(federation =>
  [federation.top, federation.second]
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry?.participants.length))
    .map(entry => entry.id),
))

// A divisao de acesso fica na MESMA confederacao da divisao acima dela — o clube
// nao muda de continente ao subir um degrau. Derivado em vez de escrito a mao
// porque uma base fora de confederacao sortearia adversario continental de outro
// continente, que e um defeito que a Juventus x Boca ja produziu uma vez.
for (const acesso of DIVISOES_DE_ACESSO) {
  for (const divs of Object.values(CONFEDERATION_DIVISIONS)) {
    if (divs.includes(acesso.acima) && !divs.includes(acesso.id)) { divs.push(acesso.id); break }
  }
}

export function getConfederation(divisao: string | undefined): Confederation {
  if (!divisao) return "UNAFFILIATED"
  for (const [conf, divs] of Object.entries(CONFEDERATION_DIVISIONS)) {
    if (divs.includes(divisao)) return conf as Confederation
  }
  // Nunca inventar continente: uma divisao nova precisa ser cadastrada antes de
  // receber adversarios continentais. O fallback antigo mandava qualquer liga
  // desconhecida para a Libertadores.
  return "UNAFFILIATED"
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
