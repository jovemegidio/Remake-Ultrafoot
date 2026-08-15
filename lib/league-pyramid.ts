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

import { UEFA_EXPANSION_FEDERATIONS } from "@/lib/uefa-expansion"
import { regulamentoDaLigaNoServidor } from "@/lib/atualizacao-elencos"

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
  // A Divisao de Acesso e o quinto degrau: os clubes brasileiros do pool que nao
  // tinham divisao nenhuma passam a ter para onde subir. Quatro trocas, como nos
  // outros degraus brasileiros. Ver o tipo `Divisao` em lib/teams-data.
  { country: "Brasil", tiers: ["serie_a", "serie_b", "serie_c", "serie_d", "divisao_acesso_br"], swaps: [4, 4, 4, 4] },
  { country: "Inglaterra", tiers: ["premier_league", "championship", "league_one_eng", "league_two_eng", "national_league_eng", "national_league_ns_eng"], swaps: [3, 3, 4, 2, 4] },
  { country: "Espanha", tiers: ["la_liga", "la_liga_2", "primera_federacion_esp", "segunda_federacion_esp"], swaps: [3, 4, 5] },
  { country: "Italia", tiers: ["serie_a_ita", "serie_b_ita"], swaps: [3] },
  { country: "Alemanha", tiers: ["bundesliga", "bundesliga_2", "dritte_liga_ger"], swaps: [3, 3] },
  { country: "Franca", tiers: ["ligue_1", "ligue_2", "national_fra"], swaps: [3, 3] },
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
  { country: "Portugal", tiers: ["primeira_liga", "liga_portugal_2", "liga_3_por", "campeonato_portugal"], swaps: [2, 2, 2] },
  { country: "Holanda", tiers: ["eredivisie", "eerste_divisie"], swaps: [3] },
  { country: "Belgica", tiers: ["pro_league_bel", "challenger_pro", "first_national_bel"], swaps: [2, 2] },
  { country: "Turquia", tiers: ["super_lig", "tff_1_lig", "tff_2_lig"], swaps: [3, 3] },
  { country: "Russia", tiers: ["russian_prem", "russian_first"], swaps: [2] },
  { country: "Argentina", tiers: ["liga_argentina", "primera_b_arg"], swaps: [2] },
  { country: "Colombia", tiers: ["primera_a_col", "torneo_betplay"], swaps: [2] },
  { country: "Uruguai", tiers: ["primera_div_ury", "segunda_div_ury"], swaps: [3] },
  // China: o pool so tem 11 clubes chineses livres, entao a segunda divisao
  // nasce com 11 em vez dos 16 da competicao real.
  { country: "China", tiers: ["chinese_super", "china_league_one"], swaps: [3] },
  // Escocia e Equador nao tinham nem a divisao no tipo `Divisao`; as duas foram
  // criadas para o rebaixamento que a primeira divisao ja anunciava existir.
  { country: "Escocia", tiers: ["scottish_prem", "scottish_champ", "scottish_league_one", "scottish_league_two"], swaps: [2, 2, 2] },
  { country: "Equador", tiers: ["primera_a_ecu", "serie_b_ecu"], swaps: [2] },
  // Coreia do Sul: a K League 2 passou a existir de verdade (17 clubes e
  // elencos importados do Transfermarkt), entao o pais volta a rebaixar.
  { country: "Coreia do Sul", tiers: ["k_league_1", "k_league_2"], swaps: [2] },
  { country: "Peru", tiers: ["primera_div_per", "liga_2_per"], swaps: [2] },
  { country: "Bolivia", tiers: ["primera_div_bol", "copa_simon_bolivar"], swaps: [2] },
  { country: "Paraguai", tiers: ["primera_div_par", "division_intermedia_par"], swaps: [2] },
  { country: "Venezuela", tiers: ["primera_div_ven", "liga_futve_2"], swaps: [2] },
  { country: "Dinamarca", tiers: ["superliga_den", "betinia_liga"], swaps: [2] },
  { country: "Noruega", tiers: ["eliteserien_nor", "obos_ligaen"], swaps: [2] },
  { country: "Chipre", tiers: ["protathlima_cyp", "second_div_cyp"], swaps: [3] },
  { country: "Chequia", tiers: ["fortuna_liga_cze", "chance_narodni_liga"], swaps: [1] },
  { country: "Grecia", tiers: ["super_league_gre", "super_league_2_gre"], swaps: [2] },
  // Federações da expansão só entram aqui quando os DOIS níveis têm uma
  // fotografia explícita de participantes. O filtro evita transformar uma
  // segunda divisão ainda aberta em uma pirâmide fictícia e liga
  // automaticamente novas divisões verificadas nas próximas entregas.
  ...UEFA_EXPANSION_FEDERATIONS.flatMap((federation): Pyramid[] => {
    const { top, second } = federation
    if (!top?.participants.length || !second?.participants.length) return []
    return [{
      country: federation.country,
      tiers: [top.id, second.id],
      swaps: [Math.min(top.relegation, second.promotion)],
    }]
  }),
]

const TIER_INDEX = new Map<string, { pyramid: Pyramid; idx: number }>()
for (const pyramid of PYRAMIDS) {
  pyramid.tiers.forEach((tier, idx) => TIER_INDEX.set(tier, { pyramid, idx }))
}

/** Quantos clubes DESCEM desta divisao (0 se for a base da piramide ou fora de piramide). */
export function relegationCount(division: string): number {
  const info = TIER_INDEX.get(division)
  if (!info) return 0
  const doCanal = regulamentoDaLigaNoServidor(division)?.rebaixamentos
  if (typeof doCanal === "number" && doCanal >= 0) return doCanal
  return info.idx < info.pyramid.swaps.length ? info.pyramid.swaps[info.idx] : 0
}

/**
 * Quantos clubes SOBEM desta divisao (0 se for o topo ou fora de piramide).
 *
 * ⚠️ O NUMERO E UM SO PARA OS DOIS LADOS. Na piramide, `swaps[i]` e ao mesmo
 * tempo quantos caem do nivel i e quantos sobem do nivel i+1 — se cada ponta
 * pudesse ser editada por conta propria, o painel deixaria publicar "3 caem da
 * Serie A" com "2 sobem da Serie B" e a primeira divisao encolheria uma vaga por
 * temporada, em silencio.
 *
 * Por isso o REBAIXAMENTO da divisao de cima manda. `acessos` so vale quando a
 * divisao de cima nao foi configurada no canal.
 */
export function promotionCount(division: string): number {
  const info = TIER_INDEX.get(division)
  if (!info) return 0
  if (info.idx === 0) return 0
  const acima = info.pyramid.tiers[info.idx - 1]
  const quedaDeCima = regulamentoDaLigaNoServidor(acima)?.rebaixamentos
  if (typeof quedaDeCima === "number" && quedaDeCima >= 0) return quedaDeCima
  const doCanal = regulamentoDaLigaNoServidor(division)?.acessos
  if (typeof doCanal === "number" && doCanal >= 0) return doCanal
  return info.pyramid.swaps[info.idx - 1]
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
  divisao_acesso_br: "Divisão de Acesso",
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
  primera_div_per: "Liga 1 Peru", liga_2_per: "Liga 2 Peru",
  primera_div_bol: "División Profesional", copa_simon_bolivar: "Copa Simón Bolívar",
  primera_div_par: "División de Honor", division_intermedia_par: "División Intermedia",
  primera_div_ven: "Liga FUTVE 1", liga_futve_2: "Liga FUTVE 2",
  superliga_den: "3F Superliga", betinia_liga: "Betinia LIGA",
  eliteserien_nor: "Eliteserien", obos_ligaen: "OBOS-ligaen",
  protathlima_cyp: "Cyprus League", second_div_cyp: "Cyprus Second Division",
  fortuna_liga_cze: "Chance Liga", chance_narodni_liga: "Chance Národní Liga",
  league_one_eng: "EFL League One", league_two_eng: "EFL League Two",
  national_league_eng: "National League", national_league_ns_eng: "National League North/South",
  primera_federacion_esp: "Primera Federación", segunda_federacion_esp: "Segunda Federación",
  dritte_liga_ger: "3. Liga", national_fra: "Championnat National",
  liga_3_por: "Liga 3", campeonato_portugal: "Campeonato de Portugal",
  scottish_league_one: "Scottish League One", scottish_league_two: "Scottish League Two",
  first_national_bel: "Belgian National Division 1", tff_2_lig: "TFF 2. Lig",
  super_league_2_gre: "Super League Greece 2",
  uefa_aut_1: "Austrian Bundesliga", uefa_aut_2: "2. Liga",
  uefa_pol_1: "Ekstraklasa", uefa_pol_2: "I liga",
  uefa_rou_1: "Liga I", uefa_rou_2: "Liga II",
  uefa_sui_1: "Swiss Super League", uefa_sui_2: "Swiss Challenge League",
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
  /** Identidade global persistida. `curto` pode colidir entre países/pools. */
  id?: string
  curto: string
  /** Divisao ATUAL (ja com override aplicado). */
  division: string
  /** Forca do clube — ordena as divisoes que o jogo nao simula. */
  prestige: number
  /** `false` para equipes B/reservas impedidas de subir pelo regulamento. */
  promotionEligible?: boolean
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
      const promoted = lowerOrdered.filter(club => club.promotionEligible !== false).slice(0, swap)
      // Se faltarem clubes elegíveis, desce a mesma quantidade que sobe para
      // preservar o tamanho das duas divisões.
      const relegated = upperOrdered.slice(-promoted.length)
      for (const c of relegated) overrides[c.id ?? c.curto] = lower
      for (const c of promoted) overrides[c.id ?? c.curto] = upper
    }
  }
  return overrides
}
