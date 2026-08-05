// PIRAMIDE VIVA — acesso e rebaixamento para TODO o mundo, com os rivais
// realmente trocando de divisao a cada temporada.
//
// O que existia antes (lib/promotion-relegation.ts): so a escada brasileira, e
// so o CLUBE DO USUARIO mudava de divisao. Os rivais ficavam congelados — subir
// da Serie B levava sempre aos mesmos 20 clubes fixos da Serie A. E Premier,
// La Liga etc. nao tinham acesso/rebaixamento nenhum.
//
// Este modulo e PURO e testavel. O estado (qual divisao cada clube ocupa agora)
// mora no save como `clubDivisions: Record<curto, divisao>`, evoluido a cada
// fim de temporada por `evolvePyramids`.

/** Uma piramide nacional: divisoes do topo para a base e quantos clubes trocam
 *  entre cada par adjacente. swaps[i] = clubes entre tiers[i] e tiers[i+1]. */
export interface Pyramid {
  country: string
  tiers: string[]
  swaps: number[]
}

// So entram paises com 2+ divisoes com elenco na base (conferido). Os numeros de
// troca seguem a vida real: Europa 3, Brasil 4. Onde a divisao de baixo nao
// existe no jogo, o clube simplesmente nao tem para onde descer/subir.
export const PYRAMIDS: readonly Pyramid[] = [
  { country: "Brasil", tiers: ["serie_a", "serie_b", "serie_c", "serie_d"], swaps: [4, 4, 4] },
  { country: "Inglaterra", tiers: ["premier_league", "championship"], swaps: [3] },
  { country: "Espanha", tiers: ["la_liga", "la_liga_2"], swaps: [3] },
  { country: "Italia", tiers: ["serie_a_ita", "serie_b_ita"], swaps: [3] },
  { country: "Alemanha", tiers: ["bundesliga", "bundesliga_2"], swaps: [3] },
  { country: "Franca", tiers: ["ligue_1", "ligue_2"], swaps: [3] },
  { country: "Arabia", tiers: ["saudi_pro", "saudi_first_div"], swaps: [3] },
  // Chile: as duas divisoes ja existiam com elenco (19 e 13 clubes) e nenhuma
  // delas trocava de nivel — era a unica piramide pronta que faltava ligar.
  // Dois clubes, como na vida real (o 2o acesso sai de liguilla, simplificado).
  { country: "Chile", tiers: ["primera_div_chi", "primera_b_chi"], swaps: [2] },
  // ⚠️ ESTES OITO PAISES TINHAM ZONA DE REBAIXAMENTO DECORATIVA. A competicao da
  // primeira divisao declarava 2 ou 3 rebaixados, a segunda divisao ja existia
  // no tipo `Divisao` e em `competitionsByLeague` com nome, premio e acesso — e
  // nao tinha clube nenhum, entao ninguem caia e ninguem subia. Os clubes da
  // segunda vem do pool do proprio pais (ver PAIS_DA_DIVISAO em teams-data).
  //
  // O numero de trocas e o `relegation` que a primeira divisao ja declarava; as
  // duas listas sao conferidas pelo scripts/auditar-ligas-consistencia.mjs.
  { country: "Portugal", tiers: ["primeira_liga", "liga_portugal_2"], swaps: [2] },
  { country: "Holanda", tiers: ["eredivisie", "eerste_divisie"], swaps: [3] },
  { country: "Belgica", tiers: ["pro_league_bel", "challenger_pro"], swaps: [2] },
  { country: "Turquia", tiers: ["super_lig", "tff_1_lig"], swaps: [3] },
  { country: "Russia", tiers: ["russian_prem", "russian_first"], swaps: [2] },
  { country: "Argentina", tiers: ["liga_argentina", "primera_b_arg"], swaps: [2] },
  { country: "Colombia", tiers: ["primera_a_col", "torneo_betplay"], swaps: [2] },
  { country: "Uruguai", tiers: ["primera_div_ury", "segunda_div_ury"], swaps: [3] },
  // China: o pool so tem 11 clubes chineses livres, entao a segunda divisao
  // nasce com 11 em vez dos 16 da competicao real.
  { country: "China", tiers: ["chinese_super", "china_league_one"], swaps: [3] },
  // Escocia e Equador nao tinham nem a divisao no tipo `Divisao`; as duas foram
  // criadas para o rebaixamento que a primeira divisao ja anunciava existir.
  { country: "Escocia", tiers: ["scottish_prem", "scottish_champ"], swaps: [2] },
  { country: "Equador", tiers: ["primera_a_ecu", "serie_b_ecu"], swaps: [2] },
  // Coreia do Sul: a K League 2 passou a existir de verdade (17 clubes e
  // elencos importados do Transfermarkt), entao o pais volta a rebaixar.
  { country: "Coreia do Sul", tiers: ["k_league_1", "k_league_2"], swaps: [2] },
]

const TIER_INDEX = new Map<string, { pyramid: Pyramid; idx: number }>()
for (const pyramid of PYRAMIDS) {
  pyramid.tiers.forEach((tier, idx) => TIER_INDEX.set(tier, { pyramid, idx }))
}

/** Quantos clubes DESCEM desta divisao (0 se for a base da piramide ou fora de piramide). */
export function relegationCount(division: string): number {
  const info = TIER_INDEX.get(division)
  if (!info) return 0
  return info.idx < info.pyramid.swaps.length ? info.pyramid.swaps[info.idx] : 0
}

/** Quantos clubes SOBEM desta divisao (0 se for o topo ou fora de piramide). */
export function promotionCount(division: string): number {
  const info = TIER_INDEX.get(division)
  if (!info) return 0
  return info.idx > 0 ? info.pyramid.swaps[info.idx - 1] : 0
}

export function divisionAbove(division: string): string | null {
  const info = TIER_INDEX.get(division)
  if (!info || info.idx === 0) return null
  return info.pyramid.tiers[info.idx - 1]
}

export function divisionBelow(division: string): string | null {
  const info = TIER_INDEX.get(division)
  if (!info || info.idx >= info.pyramid.tiers.length - 1) return null
  return info.pyramid.tiers[info.idx + 1]
}

export interface DivisionOutcome {
  nextDivision: string
  movement: "promoted" | "relegated" | "stay"
  message: string
}

const LABELS: Record<string, string> = {
  serie_a: "Série A", serie_b: "Série B", serie_c: "Série C", serie_d: "Série D",
  premier_league: "Premier League", championship: "Championship",
  la_liga: "La Liga", la_liga_2: "La Liga 2",
  serie_a_ita: "Serie A", serie_b_ita: "Serie B",
  bundesliga: "Bundesliga", bundesliga_2: "Bundesliga 2",
  ligue_1: "Ligue 1", ligue_2: "Ligue 2",
  saudi_pro: "Saudi Pro League", saudi_first_div: "Saudi First Division",
  primera_div_chi: "Primera División", primera_b_chi: "Primera B",
  primeira_liga: "Primeira Liga", liga_portugal_2: "Liga Portugal 2",
  eredivisie: "Eredivisie", eerste_divisie: "Eerste Divisie",
  pro_league_bel: "Pro League", challenger_pro: "Challenger Pro League",
  super_lig: "Süper Lig", tff_1_lig: "TFF 1. Lig",
  russian_prem: "Premier League Russa", russian_first: "First League",
  liga_argentina: "Liga Profesional", primera_b_arg: "Primera Nacional",
  primera_a_col: "Primera A", torneo_betplay: "Torneo BetPlay",
  primera_div_ury: "Primera División", segunda_div_ury: "Segunda División",
  chinese_super: "Chinese Super League", china_league_one: "China League One",
  scottish_prem: "Scottish Premiership", scottish_champ: "Scottish Championship",
  primera_a_ecu: "LigaPro Serie A", serie_b_ecu: "LigaPro Serie B",
  k_league_1: "K League 1", k_league_2: "K League 2",
}
export function divisionLabel(division: string): string {
  return LABELS[division] ?? division
}

/**
 * Decide a divisao de UM clube na proxima temporada, pela posicao final e pelo
 * tamanho da liga. Funciona para qualquer divisao que esteja numa piramide.
 */
export function resolveDivisionChange(
  division: string,
  position: number,
  size: number,
  teamName = "Seu clube",
): DivisionOutcome {
  const down = relegationCount(division)
  const up = promotionCount(division)

  if (down > 0 && position > size - down) {
    const below = divisionBelow(division)
    if (below) {
      return {
        nextDivision: below,
        movement: "relegated",
        message: `${teamName} foi REBAIXADO para a ${divisionLabel(below)} (terminou em ${position}º).`,
      }
    }
  }
  if (up > 0 && position <= up) {
    const above = divisionAbove(division)
    if (above) {
      return {
        nextDivision: above,
        movement: "promoted",
        message: `${teamName} foi PROMOVIDO para a ${divisionLabel(above)} (terminou em ${position}º)!`,
      }
    }
  }
  return { nextDivision: division, movement: "stay", message: "" }
}

// ── Piramide viva: evolucao de TODOS os clubes ──────────────────────────────

export interface PyramidClub {
  curto: string
  /** Divisao ATUAL (ja com override aplicado). */
  division: string
  /** Forca do clube — ordena as divisoes que o jogo nao simula. */
  prestige: number
}

function hash(value: string): number {
  let h = 2166136261
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

/**
 * Evolui as piramides de uma temporada para a proxima: para cada divisao de cada
 * pais, os `swap` piores descem e os `swap` melhores da divisao de baixo sobem,
 * e trocam de lugar (o tamanho das ligas fica constante).
 *
 * A divisao do USUARIO usa a classificacao REAL (`userFinalOrder`, do 1º ao
 * ultimo por `curto`). As demais o jogo nao simula: ordena por prestigio com um
 * ruido deterministico por temporada, para nao ser sempre o mesmo campeao.
 *
 * Retorna o MAPA de overrides atualizado (curto -> nova divisao) apenas para os
 * clubes que mudaram — o resto continua na divisao estatica.
 */
export function evolvePyramids(params: {
  clubs: readonly PyramidClub[]
  userDivision: string | null
  userFinalOrder: readonly string[] // curtos do 1º ao ultimo na liga do usuario
  seed: number
}): Record<string, string> {
  const { clubs, userDivision, userFinalOrder, seed } = params
  const byDivision = new Map<string, PyramidClub[]>()
  for (const c of clubs) {
    const list = byDivision.get(c.division) ?? []
    list.push(c)
    byDivision.set(c.division, list)
  }

  // Ordena uma divisao do 1º ao ultimo colocado.
  const finalOrder = (division: string, list: PyramidClub[]): PyramidClub[] => {
    if (division === userDivision && userFinalOrder.length) {
      const pos = new Map(userFinalOrder.map((curto, i) => [curto, i]))
      return [...list].sort((a, b) =>
        (pos.get(a.curto) ?? 999) - (pos.get(b.curto) ?? 999)
        || b.prestige - a.prestige)
    }
    // Divisao nao simulada: prestigio manda, com ruido por temporada.
    return [...list].sort((a, b) => {
      const ra = b.prestige - a.prestige
      if (ra !== 0) return ra
      return hash(`${seed}:${a.curto}`) - hash(`${seed}:${b.curto}`)
    }).sort((a, b) => {
      const na = a.prestige + (hash(`${seed}:${a.curto}`) % 7) - 3
      const nb = b.prestige + (hash(`${seed}:${b.curto}`) % 7) - 3
      return nb - na
    })
  }

  const overrides: Record<string, string> = {}
  for (const pyramid of PYRAMIDS) {
    for (let i = 0; i < pyramid.swaps.length; i++) {
      const upper = pyramid.tiers[i]
      const lower = pyramid.tiers[i + 1]
      const swap = pyramid.swaps[i]
      const upperClubs = byDivision.get(upper)
      const lowerClubs = byDivision.get(lower)
      if (!upperClubs?.length || !lowerClubs?.length) continue

      const upperOrdered = finalOrder(upper, upperClubs)
      const lowerOrdered = finalOrder(lower, lowerClubs)

      // Os `swap` piores da de cima descem; os `swap` melhores da de baixo sobem.
      const relegated = upperOrdered.slice(-swap)
      const promoted = lowerOrdered.slice(0, swap)
      for (const c of relegated) overrides[c.curto] = lower
      for (const c of promoted) overrides[c.curto] = upper
    }
  }
  return overrides
}
