import { DIVISOES_DE_ACESSO } from "@/lib/divisao-de-acesso"
import { LIGAS_FEMININAS } from "@/lib/futebol-feminino"
import {
  bundesliga2Teams, bundesligaTeams, championshipTeams, chineseSuperTeams, ecuadorTeams,
  eredivisieTeams, jLeagueTeams, kLeague1Teams, kLeague2Teams, laLiga2Teams, laLigaTeams,
  ligaArgentinaTeams, ligaMXTeams, ligue1Teams, ligue2Teams, mlsTeams, premierLeagueTeams,
  primeiraAColTeams, primeiraLigaTeams, primeraBChileTeams, primeraDivChileTeams,
  primeraDivUryTeams, proLeagueBelTeams, russianPremTeams, saudiFirstDivTeams, saudiProTeams,
  scottishPremTeams, serieAItaTeams, serieBItaTeams, superLigTeams,
} from "@/lib/international-teams"
import { serieATeams, serieBTeams, serieCTeams, serieDTeams, type Divisao, type Regiao, type Team } from "@/lib/teams-data"
import { UEFA_EXPANSION_FEDERATIONS } from "@/lib/uefa-expansion"

// O CATALOGO DE PAISES E LIGAS DA CRIACAO DE CARREIRA.
//
// ⚠️ ISTO MORAVA DENTRO DE `app/novo-jogo/page.tsx` — 341 linhas de dado puro no
// meio de uma tela de 2.243. Nao havia gancho de React nem estado ali: era
// catalogo, e catalogo nao e camada de visao.
//
// ⚠️ E ESTAVA NO ESCOPO DA TRADUCAO POR ISSO. O portao `qa-traducao` varre
// `app/` e `components/`, entao "Premier League", "Championship", "Brasileirao
// Serie A" e os nomes de 40+ paises entravam na conta de "frases chumbadas" —
// medido, 194 das 331 daquele arquivo. Nome proprio nao vira nada em idioma
// nenhum: extrai-los encheria os arquivos de idioma de lixo e escondia a chave
// de verdade no meio.
//
// Mover para `lib/` conserta as duas coisas de uma vez, e nenhuma delas e
// cosmetica: o dado vai para onde dado mora, e a metrica de traducao passa a
// medir texto de interface.
//
// ⚠️ O QUE AQUI E TRADUZIVEL, E O QUE NAO E. `name` de pais PODE ser traduzido
// um dia (Inglaterra/England); `label` de liga NAO — "Premier League" e o nome
// da competicao, nao uma descricao dela. Se alguem for internacionalizar isto,
// e o `name` que vira chave, e ele sozinho.

export interface LeagueTab {
  key: Divisao
  label: string
  short: string
  teams: Team[]
  /**
   * Liga montada com o pool do proprio pais (as segundas divisoes ligadas em
   * 04/08). ⚠️ NAO da para resolver isso no escopo do modulo: o caminho passa
   * por `applyTeamOverride`, que le o persistent-store, e no Tauri o store
   * hidrata DEPOIS do import — o clube apareceria com o nome e o escudo de
   * antes das suas edicoes, e nunca se corrigiria. Ver
   * [[ultrafoot-efeito-que-grava-antes-de-hidratar]].
   */
  doPool?: boolean
  /** Lista TODOS os clubes da divisao, e nao a tabela de 20. Ver o uso abaixo. */
  todosDaDivisao?: boolean
}

export interface CountryTab {
  name: string
  code: string
  region: Regiao
  leagues: LeagueTab[]
}

const CORE_COUNTRIES: CountryTab[] = [
  {
    name: "Brasil", code: "BRA", region: "brasil",
    leagues: [
      { key: "serie_a", label: "Brasileirao Serie A", short: "Serie A", teams: serieATeams },
      { key: "serie_b", label: "Brasileirao Serie B", short: "Serie B", teams: serieBTeams },
      { key: "serie_c", label: "Brasileirao Serie C", short: "Serie C", teams: serieCTeams },
      { key: "serie_d", label: "Brasileirao Serie D", short: "Serie D", teams: serieDTeams },
    ],
  },
  {
    name: "Inglaterra", code: "ENG", region: "europa",
    leagues: [
      { key: "premier_league", label: "Premier League", short: "Premier League", teams: premierLeagueTeams },
      { key: "championship", label: "Championship", short: "Championship", teams: championshipTeams },
      { key: "league_one_eng", label: "League One", short: "League One", teams: [], doPool: true },
      { key: "league_two_eng", label: "League Two", short: "League Two", teams: [], doPool: true },
      { key: "national_league_eng", label: "National League", short: "National League", teams: [], doPool: true },
      { key: "national_league_ns_eng", label: "National League North/South", short: "National N/S", teams: [], doPool: true },
    ],
  },
  {
    name: "Espanha", code: "ESP", region: "europa",
    leagues: [
      { key: "la_liga", label: "La Liga", short: "La Liga", teams: laLigaTeams },
      { key: "la_liga_2", label: "La Liga 2", short: "La Liga 2", teams: laLiga2Teams },
      { key: "primera_federacion_esp", label: "Primera Federacion", short: "Primera Fed.", teams: [], doPool: true },
      { key: "segunda_federacion_esp", label: "Segunda Federacion", short: "Segunda Fed.", teams: [], doPool: true },
    ],
  },
  {
    name: "Italia", code: "ITA", region: "europa",
    leagues: [
      { key: "serie_a_ita", label: "Serie A", short: "Serie A", teams: serieAItaTeams },
      { key: "serie_b_ita", label: "Serie B", short: "Serie B", teams: serieBItaTeams },
    ],
  },
  {
    name: "Alemanha", code: "GER", region: "europa",
    leagues: [
      { key: "bundesliga", label: "Bundesliga", short: "Bundesliga", teams: bundesligaTeams },
      { key: "bundesliga_2", label: "2. Bundesliga", short: "2. Bundesliga", teams: bundesliga2Teams },
      { key: "dritte_liga_ger", label: "3. Liga", short: "3. Liga", teams: [], doPool: true },
    ],
  },
  {
    name: "Franca", code: "FRA", region: "europa",
    leagues: [
      { key: "ligue_1", label: "Ligue 1", short: "Ligue 1", teams: ligue1Teams },
      { key: "ligue_2", label: "Ligue 2", short: "Ligue 2", teams: ligue2Teams },
      { key: "national_fra", label: "Championnat National", short: "National", teams: [], doPool: true },
    ],
  },
  {
    name: "Portugal", code: "POR", region: "europa",
    leagues: [
      { key: "primeira_liga", label: "Primeira Liga", short: "Primeira Liga", teams: primeiraLigaTeams },
      { key: "liga_portugal_2", label: "Liga Portugal 2", short: "Liga 2", teams: [], doPool: true },
      { key: "liga_3_por", label: "Liga 3", short: "Liga 3", teams: [], doPool: true },
      { key: "campeonato_portugal", label: "Campeonato de Portugal", short: "Campeonato", teams: [], doPool: true },
    ],
  },
  {
    name: "Holanda", code: "NED", region: "europa",
    leagues: [
      { key: "eredivisie", label: "Eredivisie", short: "Eredivisie", teams: eredivisieTeams },
      { key: "eerste_divisie", label: "Eerste Divisie", short: "Eerste Div", teams: [], doPool: true },
    ],
  },
  {
    name: "Escocia", code: "SCO", region: "europa",
    leagues: [
      { key: "scottish_prem", label: "Scottish Premiership", short: "Scottish Prem", teams: scottishPremTeams },
      { key: "scottish_champ", label: "Scottish Championship", short: "Championship", teams: [], doPool: true },
      { key: "scottish_league_one", label: "Scottish League One", short: "League One", teams: [], doPool: true },
      { key: "scottish_league_two", label: "Scottish League Two", short: "League Two", teams: [], doPool: true },
    ],
  },
  {
    name: "Turquia", code: "TUR", region: "europa",
    leagues: [
      { key: "super_lig", label: "Super Lig", short: "Super Lig", teams: superLigTeams },
      { key: "tff_1_lig", label: "TFF 1. Lig", short: "1. Lig", teams: [], doPool: true },
      { key: "tff_2_lig", label: "TFF 2. Lig", short: "2. Lig", teams: [], doPool: true },
    ],
  },
  {
    name: "Belgica", code: "BEL", region: "europa",
    leagues: [
      { key: "pro_league_bel", label: "Belgian Pro League", short: "Pro League", teams: proLeagueBelTeams },
      { key: "challenger_pro", label: "Challenger Pro League", short: "Challenger", teams: [], doPool: true },
      { key: "first_national_bel", label: "Belgian National Division 1", short: "National 1", teams: [], doPool: true },
    ],
  },
  {
    name: "Russia", code: "RUS", region: "europa",
    leagues: [
      { key: "russian_prem", label: "Russian Premier League", short: "Russian Prem", teams: russianPremTeams },
      { key: "russian_first", label: "Russian First League", short: "First League", teams: [], doPool: true },
    ],
  },
  {
    name: "EUA", code: "USA", region: "americas",
    leagues: [
      { key: "mls", label: "MLS", short: "MLS", teams: mlsTeams },
    ],
  },
  {
    name: "Mexico", code: "MEX", region: "americas",
    leagues: [
      { key: "liga_mx", label: "Liga MX", short: "Liga MX", teams: ligaMXTeams },
    ],
  },
  {
    name: "Argentina", code: "ARG", region: "americas",
    leagues: [
      { key: "liga_argentina", label: "Liga Profesional", short: "Liga Argentina", teams: ligaArgentinaTeams },
      { key: "primera_b_arg", label: "Primera Nacional", short: "Primera Nacional", teams: [], doPool: true },
    ],
  },
  {
    name: "Colombia", code: "COL", region: "americas",
    leagues: [
      { key: "primera_a_col", label: "Primera A", short: "Primera A", teams: primeiraAColTeams },
      { key: "torneo_betplay", label: "Torneo BetPlay", short: "Torneo BetPlay", teams: [], doPool: true },
    ],
  },
  {
    name: "Chile", code: "CHI", region: "americas",
    leagues: [
      { key: "primera_div_chi", label: "Primera Division", short: "Primera Div", teams: primeraDivChileTeams },
      { key: "primera_b_chi", label: "Primera B", short: "Primera B", teams: primeraBChileTeams },
    ],
  },
  {
    // A LigaPro existia inteira (16 clubes, escudo em todos, regulamento
    // proprio) e nao aparecia aqui — o pais nao era oferecido.
    name: "Equador", code: "ECU", region: "americas",
    leagues: [
      { key: "primera_a_ecu", label: "LigaPro Serie A", short: "LigaPro", teams: ecuadorTeams },
      { key: "serie_b_ecu", label: "LigaPro Serie B", short: "LigaPro B", teams: [], doPool: true },
    ],
  },
  {
    name: "Uruguai", code: "URU", region: "americas",
    leagues: [
      { key: "primera_div_ury", label: "Primera Division", short: "Primera Div", teams: primeraDivUryTeams },
      { key: "segunda_div_ury", label: "Segunda Division", short: "Segunda Div", teams: [], doPool: true },
    ],
  },
  {
    name: "Arabia Saudita", code: "KSA", region: "asia",
    leagues: [
      { key: "saudi_pro", label: "Saudi Pro League", short: "Saudi Pro", teams: saudiProTeams },
      { key: "saudi_first_div", label: "Saudi First Division", short: "Saudi 1a Div", teams: saudiFirstDivTeams },
    ],
  },
  {
    name: "Japao", code: "JPN", region: "asia",
    leagues: [
      { key: "j_league", label: "J-League", short: "J-League", teams: jLeagueTeams },
    ],
  },
  {
    name: "Coreia do Sul", code: "KOR", region: "asia",
    leagues: [
      { key: "k_league_1", label: "K-League 1", short: "K-League 1", teams: kLeague1Teams },
      { key: "k_league_2", label: "K-League 2", short: "K-League 2", teams: kLeague2Teams },
    ],
  },
  {
    name: "China", code: "CHN", region: "asia",
    leagues: [
      { key: "chinese_super", label: "Chinese Super League", short: "Super League", teams: chineseSuperTeams },
      { key: "china_league_one", label: "China League One", short: "China Liga 1", teams: [], doPool: true },
    ],
  },
]

const EXPANSION_COUNTRIES: CountryTab[] = UEFA_EXPANSION_FEDERATIONS
  .filter(federation => federation.top?.participants.length)
  .map(federation => ({
    name: federation.country,
    code: federation.code.toUpperCase(),
    region: "europa",
    leagues: [federation.top, federation.second]
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry?.participants.length))
      .map(entry => ({
        key: entry.id,
        label: entry.name,
        short: entry.name,
        teams: [],
        // Resolve depois da hidratação para respeitar overrides e saves.
        doPool: true,
      })),
  }))

/**
 * Países que já possuíam clubes, competição e pirâmide, mas não apareciam na
 * criação de carreira. As equipes são resolvidas do catálogo no momento da
 * hidratação para respeitar atualização de elenco e edição do usuário.
 */
const CATALOG_COUNTRIES: CountryTab[] = [
  { name: "Peru", code: "PER", region: "americas", leagues: [
    { key: "primera_div_per", label: "Liga 1 do Peru", short: "Liga 1", teams: [], doPool: true },
    { key: "liga_2_per", label: "Liga 2 do Peru", short: "Liga 2", teams: [], doPool: true },
  ] },
  { name: "Bolivia", code: "BOL", region: "americas", leagues: [
    { key: "primera_div_bol", label: "Division Profesional", short: "Division Profesional", teams: [], doPool: true },
    { key: "copa_simon_bolivar", label: "Copa Simon Bolivar", short: "Simon Bolivar", teams: [], doPool: true },
  ] },
  { name: "Paraguai", code: "PAR", region: "americas", leagues: [
    { key: "primera_div_par", label: "Division de Honor", short: "Primera", teams: [], doPool: true },
    { key: "division_intermedia_par", label: "Division Intermedia", short: "Intermedia", teams: [], doPool: true },
  ] },
  { name: "Venezuela", code: "VEN", region: "americas", leagues: [
    { key: "primera_div_ven", label: "Liga FUTVE 1", short: "FUTVE 1", teams: [], doPool: true },
    { key: "liga_futve_2", label: "Liga FUTVE 2", short: "FUTVE 2", teams: [], doPool: true },
  ] },
  { name: "Grecia", code: "GRE", region: "europa", leagues: [
    { key: "super_league_gre", label: "Super League Greece", short: "Super League", teams: [], doPool: true },
    { key: "super_league_2_gre", label: "Super League Greece 2", short: "Super League 2", teams: [], doPool: true },
  ] },
  { name: "Dinamarca", code: "DEN", region: "europa", leagues: [
    { key: "superliga_den", label: "3F Superliga", short: "Superliga", teams: [], doPool: true },
    { key: "betinia_liga", label: "Betinia Liga", short: "Betinia Liga", teams: [], doPool: true },
  ] },
  { name: "Chequia", code: "CZE", region: "europa", leagues: [
    { key: "fortuna_liga_cze", label: "Chance Liga", short: "Chance Liga", teams: [], doPool: true },
    { key: "chance_narodni_liga", label: "Chance Narodni Liga", short: "Narodni Liga", teams: [], doPool: true },
  ] },
  { name: "Azerbaijao", code: "AZE", region: "europa", leagues: [
    { key: "premyer_liqa_aze", label: "Misli Premyer Liqasi", short: "Premyer Liqa", teams: [], doPool: true },
  ] },
  { name: "Noruega", code: "NOR", region: "europa", leagues: [
    { key: "eliteserien_nor", label: "Eliteserien", short: "Eliteserien", teams: [], doPool: true },
    { key: "obos_ligaen", label: "OBOS-ligaen", short: "OBOS-ligaen", teams: [], doPool: true },
  ] },
  { name: "Chipre", code: "CYP", region: "europa", leagues: [
    { key: "protathlima_cyp", label: "Cyprus League", short: "Cyprus League", teams: [], doPool: true },
    { key: "second_div_cyp", label: "Cyprus Second Division", short: "Second Division", teams: [], doPool: true },
  ] },
  { name: "Cazaquistao", code: "KAZ", region: "europa", leagues: [
    { key: "premier_liga_kaz", label: "Kazakhstan Premier League", short: "Premier Liga", teams: [], doPool: true },
  ] },
]

/**
 * A DIVISÃO DE ACESSO É ANEXADA À ABA DO PRÓPRIO PAÍS.
 *
 * Escrever uma linha por país aqui (são treze) é o que faz esta lista sair de
 * sincronia com o catálogo — foi assim que onze segundas divisões existiram
 * declaradas e sem aparecer em lugar nenhum. O casamento é pelo `name` da aba,
 * que usa a mesma grafia das pirâmides.
 *
 * ⚠️ `todosDaDivisao` em vez de `doPool`: a base tem centenas de clubes para 20
 * vagas na tabela, e mostrar só as 20 esconderia justamente o clube pequeno que
 * o jogador foi procurar. Ver o uso mais abaixo.
 */
const porNomeDoPais = (a: CountryTab, b: CountryTab) =>
  a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })

export const COUNTRIES: CountryTab[] = [...CORE_COUNTRIES, ...CATALOG_COUNTRIES, ...EXPANSION_COUNTRIES]
  .map(pais => {
    const acesso = DIVISOES_DE_ACESSO.find(a => a.country === pais.name)
    if (!acesso || pais.leagues.some(l => l.key === acesso.id)) return pais
    return {
      ...pais,
      leagues: [...pais.leagues, {
        // O catálogo guarda o id como `string`; a aba pede `Divisao`. A união já
        // aceita `acesso_${string}`, e o teste confere que todo id do catálogo
        // tem pirâmide, rótulo e regulamento — a garantia é lá, não no tipo.
        key: acesso.id as Divisao,
        label: acesso.rotulo,
        short: acesso.rotulo.length > 14 ? "Acesso" : acesso.rotulo,
        teams: [],
        todosDaDivisao: true,
      }],
    }
  })
  /**
   * ORDEM ALFABÉTICA — pedido do usuário (1.0.322): "as 70 ligas devem começar
   * por ordem alfabética... para jogadores registrados começar ABCDEFG".
   *
   * A ordem antiga era a de CADASTRO: primeiro os países do catálogo original
   * (Brasil, Inglaterra, Espanha...), depois os do catálogo estendido, e por
   * último os 36 da expansão UEFA. Funcionava enquanto eram dez países; com
   * setenta virou uma lista sem regra nenhuma, em que achar a Dinamarca exigia
   * varrer o carrossel inteiro.
   *
   * `localeCompare` com `sensitivity: "base"` porque os nomes convivem com e sem
   * acento na base ("Azerbaijao"/"Azerbaijão"): comparar bytes jogaria os
   * acentuados para o fim da lista.
   */
  .sort(porNomeDoPais)

/**
 * PAÍSES COM FUTEBOL FEMININO.
 *
 * Sai inteiro do cadastro de `lib/futebol-feminino` — país, liga, tamanho, copa
 * e continental moram lá, num lugar só. Os clubes são resolvidos na HIDRATAÇÃO
 * (`doPool`), pelo mesmo motivo das segundas divisões masculinas: o
 * persistent-store carrega depois do import e um clube resolvido cedo demais
 * apareceria com o nome e o escudo de antes das edições do jogador.
 */
export const COUNTRIES_FEMININOS: CountryTab[] = Object.values(
  LIGAS_FEMININAS.reduce<Record<string, CountryTab>>((mapa, liga) => {
    const pais = (mapa[liga.codigoPais] ??= {
      name: liga.pais, code: liga.codigoPais, region: liga.regiao, leagues: [],
    })
    pais.leagues.push({ key: liga.id as Divisao, label: liga.nome, short: liga.short, teams: [], doPool: true })
    return mapa
  }, {}),
).sort(porNomeDoPais)

// Fundo trocado a pedido do usuario (2026-07-20): foto in-game 7.