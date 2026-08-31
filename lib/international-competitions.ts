// Competicoes internacionais
import type { Divisao } from "./teams-data"
import { UEFA_EXPANSION_COMPETITIONS } from "./uefa-expansion"
import { DIVISOES_DE_ACESSO } from "./divisao-de-acesso"
import { LIGAS_FEMININAS } from "./futebol-feminino"

export interface Competition {
  id: string
  name: string
  shortName: string
  type: "league" | "cup" | "continental"
  region: string
  format: "points" | "knockout" | "group_knockout" | "league_playoff" | "league_phase"
  teams: number
  rounds?: number
  /** Número de turnos completos entre todos os clubes (2 = ida e volta). */
  roundRobinCycles?: number
  /** Quantos torneios completos a temporada contém (ex.: Apertura + Clausura). */
  seasonSegments?: number
  groups?: number
  teamsPerGroup?: number
  prize: number
  prestige: number
  relegation?: number
  promotion?: number
  continentalSpots?: { competition: string; spots: number }[]
  formatDetails?: string
  /** Fonte da entidade responsável pela competição. */
  sourceUrl?: string
  participantStatus?: "provisional-snapshot" | "official-verified"
}

// Competicoes por liga
export const competitionsByLeague: Record<string, Competition[]> = {
  // Brasil
  serie_a: [
    {
      id: "brasileirao_a",
      name: "Campeonato Brasileiro Serie A",
      shortName: "Brasileirao",
      type: "league",
      region: "brasil",
      format: "points",
      teams: 20,
      rounds: 38,
      prize: 77000000,
      prestige: 85,
      relegation: 4,
      continentalSpots: [
        { competition: "libertadores", spots: 5 },
        { competition: "sulamericana", spots: 6 },
      ],
    },
    {
      id: "copa_brasil",
      name: "Copa do Brasil",
      shortName: "Copa Brasil",
      type: "cup",
      region: "brasil",
      format: "knockout",
      teams: 126,
      prize: 80000000,
      prestige: 82,
    },
    {
      id: "libertadores",
      name: "CONMEBOL Libertadores",
      shortName: "Libertadores",
      type: "continental",
      region: "america_sul",
      format: "group_knockout",
      teams: 47,
      groups: 8,
      teamsPerGroup: 4,
      prize: 134550000,
      prestige: 95,
    },
    {
      id: "sulamericana",
      name: "CONMEBOL Sul-Americana",
      shortName: "Sul-Americana",
      type: "continental",
      region: "america_sul",
      format: "group_knockout",
      teams: 44,
      groups: 8,
      teamsPerGroup: 4,
      prize: 35100000,
      prestige: 70,
    },
  ],
  serie_b: [
    {
      id: "brasileirao_b",
      name: "Campeonato Brasileiro Serie B",
      shortName: "Serie B",
      type: "league",
      region: "brasil",
      format: "league_playoff",
      teams: 20,
      rounds: 38,
      prize: 38000000,
      prestige: 60,
      promotion: 4,
      relegation: 4,
      formatDetails: "1º e 2º sobem diretamente; 3º x 6º e 4º x 5º disputam duas vagas em playoffs de ida e volta.",
    },
  ],
  serie_c: [
    {
      id: "brasileirao_c",
      name: "Campeonato Brasileiro Serie C",
      shortName: "Serie C",
      type: "league",
      region: "brasil",
      format: "league_playoff",
      teams: 20,
      rounds: 38,
      prize: 10000000,
      prestige: 40,
      promotion: 4,
      relegation: 4,
      formatDetails: "Turno e returno entre os 20 clubes; sobem quatro e caem quatro para a Série D.",
    },
  ],
  serie_d: [
    {
      id: "brasileirao_d",
      name: "Campeonato Brasileiro Serie D",
      shortName: "Serie D",
      type: "league",
      region: "brasil",
      format: "group_knockout",
      // A Serie D real tem 96 clubes em 16 grupos; o jogo disputa uma chave
      // unica de 20, como as demais divisoes. Enquanto isto dizia 96 e dez
      // rodadas, a tela do regulamento descrevia um torneio que nao existia.
      teams: 20,
      rounds: 38,
      prize: 2000000,
      prestige: 25,
      promotion: 4,
      formatDetails: "Turno e returno entre os 20 clubes; sobem quatro à Série C. Na competição real são 96 clubes em 16 grupos.",
      // ⚠️ A Serie D passou a ter para onde REBAIXAR quando a Divisao de Acesso
      // nasceu. Ate aqui ela era a ponta da piramide e nao declarava queda; o
      // numero tem de bater com `swaps` da piramide, e o
      // `qa-qualidade-das-ligas` cobra isso.
      relegation: 4,
    },
  ],

  // Inglaterra
  premier_league: [
    {
      id: "premier_league",
      name: "Premier League",
      shortName: "Premier",
      type: "league",
      region: "inglaterra",
      format: "points",
      teams: 20,
      rounds: 38,
      prize: 200000000,
      prestige: 98,
      relegation: 3,
      continentalSpots: [
        { competition: "champions_league", spots: 5 },
        { competition: "europa_league", spots: 2 },
        { competition: "conference_league", spots: 1 },
      ],
    },
    {
      id: "fa_cup",
      name: "FA Cup",
      shortName: "FA Cup",
      type: "cup",
      region: "inglaterra",
      format: "knockout",
      teams: 124,
      prize: 20000000,
      prestige: 85,
    },
    {
      id: "efl_cup",
      name: "EFL Cup",
      shortName: "Carabao Cup",
      type: "cup",
      region: "inglaterra",
      format: "knockout",
      teams: 92,
      prize: 10000000,
      prestige: 65,
    },
    {
      id: "champions_league",
      name: "UEFA Champions League",
      shortName: "UCL",
      type: "continental",
      region: "europa",
      format: "league_phase",
      teams: 36,
      rounds: 8,
      formatDetails: "Liga única: 1º ao 8º nas oitavas, 9º ao 24º nos playoffs e 25º ao 36º eliminados.",
      prize: 300000000,
      prestige: 100,
    },
    {
      id: "europa_league",
      name: "UEFA Europa League",
      shortName: "UEL",
      type: "continental",
      region: "europa",
      format: "league_phase",
      teams: 36,
      rounds: 8,
      formatDetails: "Liga única de oito partidas seguida por playoffs e mata-mata.",
      prize: 80000000,
      prestige: 80,
    },
  ],

  // Espanha
  la_liga: [
    {
      id: "la_liga",
      name: "La Liga",
      shortName: "La Liga",
      type: "league",
      region: "espanha",
      format: "points",
      teams: 20,
      rounds: 38,
      prize: 150000000,
      prestige: 95,
      relegation: 3,
      continentalSpots: [
        { competition: "champions_league", spots: 4 },
        { competition: "europa_league", spots: 2 },
        { competition: "conference_league", spots: 1 },
      ],
    },
    {
      id: "copa_del_rey",
      name: "Copa del Rey",
      shortName: "Copa del Rey",
      type: "cup",
      region: "espanha",
      format: "knockout",
      teams: 126,
      prize: 15000000,
      prestige: 80,
    },
    {
      id: "supercopa_espana",
      name: "Supercopa de Espana",
      shortName: "Supercopa",
      type: "cup",
      region: "espanha",
      format: "knockout",
      teams: 4,
      prize: 5000000,
      prestige: 60,
    },
  ],

  // Italia
  serie_a_ita: [
    {
      id: "serie_a_ita",
      name: "Serie A",
      shortName: "Serie A",
      type: "league",
      region: "italia",
      format: "points",
      teams: 20,
      rounds: 38,
      prize: 140000000,
      prestige: 93,
      relegation: 3,
      continentalSpots: [
        { competition: "champions_league", spots: 4 },
        { competition: "europa_league", spots: 2 },
        { competition: "conference_league", spots: 1 },
      ],
    },
    {
      id: "coppa_italia",
      name: "Coppa Italia",
      shortName: "Coppa Italia",
      type: "cup",
      region: "italia",
      format: "knockout",
      teams: 44,
      prize: 12000000,
      prestige: 75,
    },
    {
      id: "supercoppa",
      name: "Supercoppa Italiana",
      shortName: "Supercoppa",
      type: "cup",
      region: "italia",
      format: "knockout",
      teams: 4,
      prize: 5000000,
      prestige: 55,
    },
  ],

  // Alemanha
  bundesliga: [
    {
      id: "bundesliga",
      name: "Bundesliga",
      shortName: "Bundesliga",
      type: "league",
      region: "alemanha",
      format: "points",
      teams: 18,
      rounds: 34,
      prize: 130000000,
      prestige: 92,
      relegation: 3,
      formatDetails: "Turno e returno; 17º e 18º caem diretamente e o 16º decide a permanência com o 3º da 2. Bundesliga — três clubes trocam de divisão.",
      continentalSpots: [
        { competition: "champions_league", spots: 4 },
        { competition: "europa_league", spots: 2 },
        { competition: "conference_league", spots: 1 },
      ],
    },
    {
      id: "dfb_pokal",
      name: "DFB-Pokal",
      shortName: "DFB-Pokal",
      type: "cup",
      region: "alemanha",
      format: "knockout",
      teams: 64,
      prize: 10000000,
      prestige: 75,
    },
    {
      id: "supercup_ger",
      name: "DFL-Supercup",
      shortName: "Supercup",
      type: "cup",
      region: "alemanha",
      format: "knockout",
      teams: 2,
      prize: 3000000,
      prestige: 50,
    },
  ],

  // Franca
  ligue_1: [
    {
      id: "ligue_1",
      name: "Ligue 1",
      shortName: "Ligue 1",
      type: "league",
      region: "franca",
      format: "points",
      teams: 18,
      rounds: 34,
      prize: 100000000,
      prestige: 85,
      relegation: 3,
      formatDetails: "Turno e returno; 17º e 18º caem diretamente e o 16º decide a permanência com o 3º da Ligue 2 — três clubes trocam de divisão.",
      continentalSpots: [
        { competition: "champions_league", spots: 3 },
        { competition: "europa_league", spots: 1 },
        { competition: "conference_league", spots: 1 },
      ],
    },
    {
      id: "coupe_de_france",
      name: "Coupe de France",
      shortName: "Coupe France",
      type: "cup",
      region: "franca",
      format: "knockout",
      teams: 8506,
      prize: 8000000,
      prestige: 70,
    },
    {
      id: "coupe_de_la_ligue",
      name: "Trophee des Champions",
      shortName: "Trophee",
      type: "cup",
      region: "franca",
      format: "knockout",
      teams: 2,
      prize: 2000000,
      prestige: 45,
    },
  ],

  // Portugal
  primeira_liga: [
    { id: "taca_da_liga", name: "Taça da Liga", shortName: "Taça da Liga", type: "cup", region: "portugal", format: "group_knockout", teams: 34, groups: 4, prize: 3_000_000, prestige: 55, formatDetails: "Disputada desde 2007 pelos clubes da Primeira Liga e da Liga 2: fases eliminatórias iniciais, quatro grupos e uma final four em sede única." },
    {
      id: "primeira_liga",
      name: "Primeira Liga",
      shortName: "Liga Portugal",
      type: "league",
      region: "portugal",
      format: "points",
      teams: 18,
      rounds: 34,
      prize: 50000000,
      prestige: 75,
      relegation: 2,
      continentalSpots: [
        { competition: "champions_league", spots: 2 },
        { competition: "europa_league", spots: 2 },
        { competition: "conference_league", spots: 1 },
      ],
    },
    {
      id: "taca_portugal",
      name: "Taca de Portugal",
      shortName: "Taca Portugal",
      type: "cup",
      region: "portugal",
      format: "knockout",
      teams: 152,
      prize: 5000000,
      prestige: 65,
    },
  ],

  // Arabia Saudita
  saudi_pro: [
    {
      id: "saudi_pro_league",
      name: "Saudi Pro League",
      shortName: "Saudi Pro",
      type: "league",
      region: "arabia_saudita",
      format: "points",
      teams: 18,
      rounds: 34,
      prize: 80000000,
      prestige: 70,
      relegation: 3,
      continentalSpots: [
        { competition: "afc_champions_league", spots: 4 },
      ],
    },
    {
      id: "kings_cup",
      name: "King Cup",
      shortName: "King Cup",
      type: "cup",
      region: "arabia_saudita",
      format: "knockout",
      teams: 32,
      prize: 10000000,
      prestige: 55,
      formatDetails: "Trinta e dois clubes em mata-mata de jogo único; o sorteio da primeira fase separa os 16 melhores da elite dos demais participantes.",
    },
    {
      id: "afc_champions_league",
      name: "AFC Champions League Elite",
      shortName: "ACL Elite",
      type: "continental",
      region: "asia",
      format: "league_phase",
      teams: 32,
      rounds: 8,
      groups: 2,
      teamsPerGroup: 16,
      prize: 50000000,
      prestige: 75,
      formatDetails: "Duas ligas regionais de 16; cada clube joga oito partidas (quatro em casa e quatro fora). Os oito melhores de cada região avançam às oitavas.",
    },
  ],

  saudi_first_div: [
    {
      id: "saudi_first_division",
      name: "Saudi First Division League",
      shortName: "Saudi 1st",
      type: "league",
      region: "arabia_saudita",
      format: "points",
      teams: 18,
      rounds: 34,
      prize: 5000000,
      prestige: 45,
      promotion: 3,
      relegation: 0,
      formatDetails: "Dezoito clubes em turno e returno; três acessos e três rebaixamentos conforme a regulação da First Division.",
    },
  ],

  // Estados Unidos
  mls: [
    {
      id: "mls",
      name: "Major League Soccer",
      shortName: "MLS",
      type: "league",
      region: "usa",
      format: "league_playoff",
      teams: 30,
      groups: 2,
      rounds: 34,
      prize: 40000000,
      prestige: 65,
      continentalSpots: [
        { competition: "concacaf_champions", spots: 4 },
      ],
      formatDetails: "Trinta clubes em duas conferências de 15; cada clube disputa 34 jogos na fase regular antes dos playoffs da MLS Cup.",
    },
    {
      id: "us_open_cup",
      name: "US Open Cup",
      shortName: "Open Cup",
      type: "cup",
      region: "usa",
      format: "knockout",
      teams: 80,
      prize: 5000000,
      prestige: 45,
      formatDetails: "Oitenta clubes no torneio principal e sete rodadas em jogo único; 32 amadores e 48 profissionais. Dezesseis clubes da MLS entram na fase de 32.",
    },
    {
      id: "mls_cup",
      name: "MLS Cup Playoffs",
      shortName: "MLS Cup",
      type: "cup",
      region: "usa",
      format: "knockout",
      teams: 18,
      prize: 30000000,
      prestige: 70,
    },
    {
      id: "concacaf_champions",
      name: "CONCACAF Champions Cup",
      shortName: "CCL",
      type: "continental",
      region: "america_norte",
      format: "knockout",
      teams: 27,
      prize: 25000000,
      prestige: 60,
      formatDetails: "Vinte e sete clubes: 22 iniciam na primeira fase e cinco entram nas oitavas. As quatro primeiras fases são em ida e volta; a final é disputada em jogo único.",
    },
  ],

  // Mexico
  liga_mx: [
    {
      id: "liga_mx",
      name: "Liga MX",
      shortName: "Liga MX",
      type: "league",
      region: "mexico",
      format: "league_playoff",
      teams: 18,
      rounds: 34,
      prize: 45000000,
      prestige: 72,
      continentalSpots: [
        { competition: "concacaf_champions", spots: 4 },
      ],
      formatDetails: "Turno e returno entre os 18 clubes. No México a temporada se divide em Apertura e Clausura, com 17 rodadas cada e fase final.",
    },
    {
      id: "liguilla",
      name: "Liga MX Liguilla",
      shortName: "Liguilla",
      type: "cup",
      region: "mexico",
      format: "knockout",
      teams: 8,
      prize: 25000000,
      prestige: 75,
      formatDetails: "Fase final do Clausura 2026 com os oito primeiros colocados, iniciando diretamente nas quartas de final.",
    },
    {
      id: "leagues_cup",
      name: "Leagues Cup",
      shortName: "Leagues Cup",
      type: "continental",
      region: "america_norte",
      format: "group_knockout",
      teams: 36,
      prize: 40000000,
      prestige: 68,
      continentalSpots: [{ competition: "concacaf_champions", spots: 3 }],
      formatDetails: "Dezoito clubes da Liga MX e os nove melhores de cada conferência da MLS; confrontos entre ligas e fase eliminatória valendo três vagas na Champions Cup.",
    },
  ],

  // Estaduais brasileiros (simplificado)
  paulistao: [
    {
      id: "paulistao",
      name: "Campeonato Paulista",
      shortName: "Paulistao",
      type: "league",
      region: "sao_paulo",
      format: "league_playoff",
      teams: 16,
      rounds: 8,
      prize: 10000000,
      prestige: 55,
      relegation: 2,
      formatDetails: "Oito partidas por clube (quatro em casa e quatro fora); G8 nas quartas, semifinal e final em jogo único; dois rebaixados.",
    },
  ],
  carioca: [
    {
      id: "carioca",
      name: "Campeonato Carioca",
      shortName: "Carioca",
      type: "league",
      region: "rio_de_janeiro",
      format: "group_knockout",
      teams: 12,
      rounds: 6,
      groups: 2,
      teamsPerGroup: 6,
      prize: 6000000,
      prestige: 50,
      relegation: 1,
      formatDetails: "Dois grupos de seis; cada clube enfrenta os seis integrantes da outra chave. Oito avançam às quartas.",
    },
  ],
  mineiro: [
    {
      id: "mineiro",
      name: "Campeonato Mineiro",
      shortName: "Mineiro",
      type: "league",
      region: "minas_gerais",
      format: "group_knockout",
      teams: 12,
      rounds: 8,
      groups: 3,
      teamsPerGroup: 4,
      prize: 4000000,
      prestige: 45,
      relegation: 2,
      formatDetails: "Três grupos de quatro e oito jogos contra clubes das outras chaves; líderes e melhor segundo às semifinais; dois rebaixados.",
    },
  ],
  gaucho: [
    {
      id: "gaucho",
      name: "Campeonato Gaucho",
      shortName: "Gaucho",
      type: "league",
      region: "rio_grande_sul",
      format: "group_knockout",
      teams: 12,
      rounds: 6,
      groups: 2,
      teamsPerGroup: 6,
      prize: 4000000,
      prestige: 45,
      relegation: 2,
      formatDetails: "Dois grupos de seis e seis jogos contra a outra chave; G8 às quartas e quadrangular de permanência entre 9º e 12º.",
    },
  ],

  // J-League
  j_league: [
    { id: "copa_imperador", name: "Copa do Imperador", shortName: "Copa do Imperador", type: "cup", region: "japao", format: "knockout", teams: 88, prize: 3_500_000, prestige: 66, formatDetails: "Copa nacional do Japão, aberta a clubes profissionais e amadores de todas as prefeituras; o campeão vai à Champions asiática." },
    { id: "levain_cup", name: "J.League YBC Levain Cup", shortName: "Levain Cup", type: "cup", region: "japao", format: "group_knockout", teams: 60, groups: 0, prize: 2_800_000, prestige: 54, formatDetails: "Copa da liga japonesa aberta às três divisões da J.League, com mata-mata desde as fases iniciais e final em jogo único." },
    {
      id: "j_league",
      name: "J1 League",
      shortName: "J-League",
      type: "league",
      region: "japao",
      format: "group_knockout",
      teams: 20,
      rounds: 38,
      prize: 30000000,
      prestige: 60,
      relegation: 0,
      formatDetails: "Turno e returno entre os 20 clubes, sem rebaixamento. Em 2026 o Japão disputa um torneio de transição com dois grupos regionais de dez.",
    },
  ],

  // Eredivisie - Holanda
  eredivisie: [
    { id: "eredivisie", name: "Eredivisie", shortName: "Eredivisie", type: "league", region: "holanda", format: "league_playoff", teams: 18, rounds: 34, prize: 40000000, prestige: 72, relegation: 3, formatDetails: "Turno e returno; 17º e 18º caem diretamente e o 16º disputa o playoff de promoção/rebaixamento." },
  ],

  // Scottish Premiership - Escocia
  scottish_prem: [
    { id: "scottish_cup", name: "Scottish Cup", shortName: "Scottish Cup", type: "cup", region: "escocia", format: "knockout", teams: 124, prize: 4_000_000, prestige: 64, formatDetails: "A copa nacional mais antiga do mundo: 124 clubes de todas as divisões em mata-mata único até a final em Hampden Park." },
    { id: "scottish_league_cup", name: "Scottish League Cup", shortName: "League Cup", type: "cup", region: "escocia", format: "group_knockout", teams: 42, groups: 8, prize: 2_500_000, prestige: 52, formatDetails: "Abre a temporada escocesa: oito grupos com os clubes das quatro divisões, seguidos de mata-mata até a final em Hampden Park." },
    { id: "scottish_prem", name: "Scottish Premiership", shortName: "SPFL Prem", type: "league", region: "escocia", format: "league_playoff", teams: 12, rounds: 38, groups: 2, prize: 15000000, prestige: 65, relegation: 2, formatDetails: "Três turnos (33 jogos), seguidos pela divisão em grupos de título e permanência; cada clube encerra a temporada com 38 jogos." },
  ],

  // Super Lig - Turquia
  super_lig: [
    { id: "super_lig", name: "Trendyol Süper Lig", shortName: "Süper Lig", type: "league", region: "turquia", format: "points", teams: 18, rounds: 34, prize: 35000000, prestige: 70, relegation: 3 },
  ],

  // Belgian Pro League - Belgica
  pro_league_bel: [
    // 18 clubes desde 2026/27 (fonte oficial da Pro League). Eram 16 aqui e 30
    // rodadas, enquanto o LEAGUE_CALENDAR pedia 34: a liga nunca fechava a
    // temporada pela contagem de rodadas. Agora os tres numeros batem —
    // 18 clubes => 34 rodadas => calendario de 34.
    { id: "pro_league_bel", name: "Belgian Pro League", shortName: "Pro League", type: "league", region: "belgica", format: "points", teams: 18, rounds: 34, prize: 20000000, prestige: 66, relegation: 2, formatDetails: "Liga clássica em turno e returno entre os 18 clubes, sem playoffs." },
  ],

  // Russian Premier League - Russia
  russian_prem: [
    { id: "russian_prem", name: "Russian Premier League", shortName: "RPL", type: "league", region: "russia", format: "points", teams: 16, rounds: 30, prize: 25000000, prestige: 68, relegation: 2 },
  ],

  // Liga Argentina
  liga_argentina: [
    { id: "copa_argentina", name: "Copa Argentina", shortName: "Copa Argentina", type: "cup", region: "argentina", format: "knockout", teams: 64, prize: 5_000_000, prestige: 70, formatDetails: "Mata-mata nacional com 64 clubes de todas as divisões em sedes neutras; o campeão vai à Libertadores." },
    { id: "copa_de_la_liga_arg", name: "Copa de la Liga Profesional", shortName: "Copa de la Liga", type: "cup", region: "argentina", format: "group_knockout", teams: 30, groups: 2, prize: 4_000_000, prestige: 62, formatDetails: "Torneio da liga argentina disputado em duas zonas de quinze clubes; os oito melhores de cada zona avançam ao mata-mata." },
    // `groups: 2` estava faltando: o texto ja descrevia as duas zonas de 15, mas
    // o campo que o resto do jogo le dizia chave unica.
    { id: "liga_argentina", name: "Liga Profesional de Fútbol", shortName: "Liga Argentina", type: "league", region: "argentina", format: "group_knockout", teams: 30, groups: 2, rounds: 58, prize: 20000000, prestige: 75, relegation: 2, continentalSpots: [{ competition: "libertadores", spots: 6 }, { competition: "sulamericana", spots: 6 }], formatDetails: "Turno e returno entre todos os clubes. Na Argentina a temporada se divide em Apertura e Clausura, com duas zonas de 15 e mata-mata." },
  ],

  // Primera A - Colombia
  primera_a_col: [
    { id: "primera_a_col", name: "Liga BetPlay Dimayor", shortName: "Primera A", type: "league", region: "colombia", format: "group_knockout", teams: 20, rounds: 38, prize: 8000000, prestige: 62, relegation: 2, continentalSpots: [{ competition: "libertadores", spots: 4 }, { competition: "sulamericana", spots: 4 }], formatDetails: "Dois torneios em 2026. Liga I: todos contra todos, quartas, semifinais e final. Liga II: todos contra todos, dois quadrangulares e final." },
  ],

  // Primera Division - Chile
  primera_div_chi: [
    // 19 clubes, e nao os 16 da edicao real: o catalogo curado tem tres a mais e
    // apagar clube com elenco e escudo seria pior do que uma tabela maior.
    { id: "primera_div_chi", name: "Liga de Primera de Chile", shortName: "Primera Chile", type: "league", region: "chile", format: "points", teams: 16, rounds: 30, prize: 6000000, prestige: 60, relegation: 2, promotion: 0, continentalSpots: [{ competition: "libertadores", spots: 4 }, { competition: "sulamericana", spots: 4 }] },
  ],

  // Primera Division - Uruguay
  primera_div_ury: [
    // 37 rodadas = Apertura (15) + Intermedio (7) + Clausura (15), os tres
    // torneios que o texto ja descrevia mas que o numero de rodadas ignorava.
    { id: "primera_div_ury", name: "Liga AUF Uruguaya", shortName: "Liga AUF", type: "league", region: "uruguai", format: "group_knockout", teams: 16, groups: 2, rounds: 37, prize: 4000000, prestige: 58, relegation: 3, continentalSpots: [{ competition: "libertadores", spots: 4 }, { competition: "sulamericana", spots: 4 }], formatDetails: "Apertura, Intermedio e Clausura somam 37 rodadas; a Tabela Anual define campeao e rebaixamentos." },
  ],

  // LigaPro Serie A - Equador (liga que faltava)
  primera_a_ecu: [
    { id: "primera_a_ecu", name: "LigaPro Serie A", shortName: "LigaPro", type: "league", region: "equador", format: "group_knockout", teams: 16, rounds: 30, prize: 4000000, prestige: 60, relegation: 2, continentalSpots: [{ competition: "libertadores", spots: 4 }, { competition: "sulamericana", spots: 4 }], formatDetails: "Primeira e segunda etapa em pontos corridos; os vencedores de etapa decidem o titulo na final; a Tabela Acumulada define vagas continentais e os dois rebaixados." },
  ],

  // K-League 1 - Coreia do Sul
  k_league_1: [
    { id: "k_league_1", name: "K League 1", shortName: "K-League 1", type: "league", region: "coreia_do_sul", format: "league_playoff", teams: 12, rounds: 38, groups: 2, prize: 15000000, prestige: 58, relegation: 2, formatDetails: "Três turnos (33 jogos), seguidos pela divisão em grupos Final A e Final B; cada clube encerra a temporada com 38 jogos." },
  ],

  // Chinese Super League - China
  chinese_super: [
    { id: "chinese_super", name: "Chinese Super League", shortName: "CSL", type: "league", region: "china", format: "points", teams: 16, rounds: 30, prize: 20000000, prestige: 55, relegation: 3 },
  ],

  // 2as divisoes - Europa
  championship: [
    { id: "championship", name: "EFL Championship", shortName: "Championship", type: "league", region: "inglaterra", format: "league_playoff", teams: 24, rounds: 46, prize: 20000000, prestige: 55, promotion: 3, relegation: 3, formatDetails: "Dois acessos diretos; a partir de 2026/27, seis clubes disputam o playoff pela terceira vaga; três rebaixados." },
  ],
  la_liga_2: [
    { id: "la_liga_2", name: "La Liga 2", shortName: "La Liga 2", type: "league", region: "espanha", format: "league_playoff", teams: 22, rounds: 42, prize: 8000000, prestige: 45, promotion: 3, relegation: 4, formatDetails: "Dois acessos diretos; 3º ao 6º disputam o playoff pela terceira vaga; quatro rebaixados." },
  ],
  serie_b_ita: [
    { id: "serie_b_ita", name: "Serie B", shortName: "Serie B Ita", type: "league", region: "italia", format: "league_playoff", teams: 20, rounds: 38, prize: 10000000, prestige: 48, promotion: 3, relegation: 0, formatDetails: "Dois acessos diretos e playoff pela terceira vaga; três quedas diretas e playout entre 16º e 17º quando aplicável." },
  ],
  bundesliga_2: [
    { id: "bundesliga_2", name: "2. Bundesliga", shortName: "2. Bundesliga", type: "league", region: "alemanha", format: "league_playoff", teams: 18, rounds: 34, prize: 8000000, prestige: 46, promotion: 3, relegation: 3, formatDetails: "Dois acessos e duas quedas diretas; o 3º disputa playoff com o 16º da Bundesliga e o 16º enfrenta o 3º da 3. Liga." },
  ],
  ligue_2: [
    { id: "ligue_2", name: "Ligue 2", shortName: "Ligue 2", type: "league", region: "franca", format: "league_playoff", teams: 18, rounds: 34, prize: 5000000, prestige: 40, promotion: 3, relegation: 3, formatDetails: "Dois acessos diretos; 3º a 5º disputam playoff e o vencedor enfrenta o 16º da Ligue 1. O 16º disputa permanência com o National." },
  ],
  liga_portugal_2: [
    { id: "liga_portugal_2", name: "Liga Portugal 2", shortName: "Liga 2", type: "league", region: "portugal", format: "league_playoff", teams: 18, rounds: 34, prize: 3000000, prestige: 38, promotion: 3, relegation: 2, formatDetails: "Dois acessos diretos e playoff do 3º contra o 16º da primeira divisão; duas quedas diretas e playoff de permanência." },
  ],
  eerste_divisie: [
    { id: "eerste_divisie", name: "Eerste Divisie", shortName: "Eerste Div", type: "league", region: "holanda", format: "league_playoff", teams: 20, rounds: 38, prize: 2000000, prestige: 35, promotion: 3, relegation: 0, formatDetails: "Campeão e vice elegíveis sobem diretamente; campeões de período e melhores elegíveis disputam o playoff pela terceira vaga. Equipes B não podem subir." },
  ],
  challenger_pro: [
    { id: "challenger_pro", name: "Challenger Pro League", shortName: "Challenger", type: "league", region: "belgica", format: "league_playoff", teams: 15, rounds: 28, prize: 1500000, prestige: 32, promotion: 2, relegation: 2, formatDetails: "Formato 2026/27 com 15 clubes: 30 datas e uma folga por clube em cada turno, totalizando 28 jogos por equipe; líder sobe e 2º ao 5º disputam a segunda vaga." },
  ],
  tff_1_lig: [
    { id: "tff_1_lig", name: "TFF 1. Lig", shortName: "1. Lig", type: "league", region: "turquia", format: "league_playoff", teams: 20, rounds: 38, prize: 2500000, prestige: 36, promotion: 3, relegation: 3, formatDetails: "Vinte clubes em turno e returno; três trocas de nível preservam o tamanho da pirâmide jogável. O acesso combina vagas diretas e playoff." },
  ],
  russian_first: [
    { id: "russian_first", name: "Russian First League", shortName: "RPL 2", type: "league", region: "russia", format: "points", teams: 18, rounds: 34, prize: 2000000, prestige: 35, promotion: 2, relegation: 0, formatDetails: "Dezoito clubes em turno e returno em 2026/27. Os dois primeiros sobem diretamente; 3º e 4º disputam os playoffs de acesso, sujeitos ao licenciamento RFU." },
  ],

  // 2as divisoes - Americas
  primera_b_arg: [
    // Os 36 clubes reais da Primera Nacional, em duas zonas — o comentario antigo
    // ja admitia a diferenca ("a real tem 36 clubes em duas zonas") e o jogo
    // seguia com 20 e sem rebaixamento nenhum.
    // `relegation` fica em 0 DE PROPOSITO. A Primera Nacional real rebaixa quatro
    // para a Primera B Metropolitana / Torneo Federal, que o jogo nao modela:
    // anunciar zona de rebaixamento que nunca rebaixa e mentir para o jogador —
    // e o defeito que a `league-pyramid` ja chama de "zona decorativa".
    { id: "primera_b_arg", name: "Primera Nacional", shortName: "Primera B Arg", type: "league", region: "argentina", format: "league_playoff", teams: 36, groups: 2, rounds: 38, prize: 2000000, prestige: 40, promotion: 2, relegation: 0, formatDetails: "Duas zonas de 18 clubes em turno e returno; sobem dois. Nao ha divisao abaixo no jogo, entao ninguem e rebaixado." },
  ],
  torneo_betplay: [
    { id: "torneo_betplay", name: "Torneo BetPlay Dimayor", shortName: "Torneo Betplay", type: "league", region: "colombia", format: "group_knockout", teams: 16, rounds: 30, prize: 1500000, prestige: 35, promotion: 2, formatDetails: "Turno e returno entre os 16 clubes; sobem dois a Primera A." },
  ],
  primera_b_chi: [
    { id: "primera_b_chi", name: "Liga de Ascenso de Chile", shortName: "Liga Ascenso", type: "league", region: "chile", format: "league_playoff", teams: 18, rounds: 34, prize: 1000000, prestige: 32, promotion: 2, relegation: 0, formatDetails: "Dezesseis clubes em 30 rodadas, com acesso direto e liguilla pela segunda vaga." },
  ],
  segunda_div_ury: [
    // 14 clubes, e nao os 13 da edicao real: com 13 o turno-returno fecha em 24
    // rodadas e o calendario declara 26 — a divergencia entre as duas contas e
    // exatamente o que impedia a temporada de fechar (bug #1). Um clube a mais
    // custa menos que uma liga que nao termina.
    { id: "segunda_div_ury", name: "Segunda División Profesional", shortName: "Segunda Uruguay", type: "league", region: "uruguai", format: "league_playoff", teams: 14, rounds: 26, prize: 500000, prestige: 28, promotion: 3, relegation: 0, formatDetails: "Turno e returno entre os 14 clubes; sobem tres a Primera Division." },
  ],

  // 2as divisoes - Asia
  j2_league: [
    { id: "j2_league", name: "J2 League", shortName: "J2 League", type: "league", region: "japao", format: "group_knockout", teams: 20, rounds: 18, prize: 5000000, prestige: 38, promotion: 0, relegation: 0, formatDetails: "Em 2026, J2 e J3 disputam competição especial regional antes da mudança para o calendário 2026/27; não há acesso nem descenso no torneio de transição." },
  ],
  k_league_2: [
    { id: "k_league_2", name: "K League 2", shortName: "K-League 2", type: "league", region: "coreia_do_sul", format: "league_playoff", teams: 17, rounds: 32, prize: 3000000, prestige: 32, promotion: 3, relegation: 0, formatDetails: "Dezessete clubes jogam 32 partidas em 34 rodadas. 1º e 2º sobem diretamente; 3º a 6º disputam o playoff pela terceira vaga." },
  ],
  // 2as divisoes criadas para o pais ter rebaixamento de verdade
  scottish_champ: [
    { id: "scottish_champ", name: "Scottish Championship", shortName: "Scottish Champ", type: "league", region: "escocia", format: "league_playoff", teams: 10, rounds: 36, roundRobinCycles: 4, prize: 2000000, prestige: 34, promotion: 2, relegation: 2, formatDetails: "Quatro turnos entre os dez clubes (36 jogos); campeão sobe e os playoffs conectam Premiership e League One." },
  ],
  serie_b_ecu: [
    { id: "serie_b_ecu", name: "LigaPro Serie B", shortName: "LigaPro B", type: "league", region: "equador", format: "league_playoff", teams: 10, rounds: 18, prize: 1200000, prestige: 32, promotion: 2, relegation: 0, formatDetails: "Turno e returno entre os dez clubes; os dois primeiros sobem a Serie A." },
  ],
  china_league_one: [
    { id: "china_league_one", name: "China League One", shortName: "China Liga 1", type: "league", region: "china", format: "points", teams: 11, rounds: 20, prize: 3000000, prestige: 30, promotion: 2, relegation: 0, formatDetails: "Turno e returno. A China League One real tem 16 clubes; aqui a divisao e montada com os clubes chineses disponiveis." },
  ],

  // Ligas sul-americanas que existiam apenas como clubes soltos no catálogo.
  // Os formatos abaixo são os publicados pelas federações para a temporada
  // 2026; copa e liga são objetos diferentes para não apagar fases reais.
  primera_div_per: [
    { id: "liga_1_peru", name: "Liga 1 do Peru", shortName: "Liga 1 Peru", type: "league", region: "peru", format: "league_playoff", teams: 18, rounds: 34, prize: 3500000, prestige: 57, relegation: 2, continentalSpots: [{ competition: "libertadores", spots: 4 }, { competition: "sulamericana", spots: 4 }], formatDetails: "Dezoito clubes disputam Apertura e Clausura; a tabela acumulada define os playoffs do título, quatro vagas à Libertadores, quatro à Sul-Americana e os dois rebaixados." },
    { id: "copa_liga_peru", name: "Copa de la Liga", shortName: "Copa da Liga", type: "cup", region: "peru", format: "group_knockout", teams: 18, groups: 4, prize: 1000000, prestige: 46, formatDetails: "Competição profissional separada da Copa Perú, conforme o catálogo de regulamentos FPF 2026." },
  ],
  primera_div_bol: [
    { id: "division_profesional_bol", name: "Liga de la División Profesional", shortName: "División Profesional", type: "league", region: "bolivia", format: "points", teams: 16, rounds: 30, prize: 3000000, prestige: 56, relegation: 2, continentalSpots: [{ competition: "libertadores", spots: 4 }, { competition: "sulamericana", spots: 4 }], formatDetails: "Dezesseis clubes em turno e returno. O último cai diretamente; o penúltimo disputa permanência em ida e volta contra o campeão da Copa Simón Bolívar." },
    { id: "copa_division_profesional_bol", name: "Copa de la División Profesional", shortName: "Copa Profesional", type: "cup", region: "bolivia", format: "group_knockout", teams: 16, groups: 4, teamsPerGroup: 4, prize: 1200000, prestige: 48, formatDetails: "Quatro grupos de quatro; os dois melhores de cada grupo avançam às quartas, seguidas por semifinal e final." },
  ],
  primera_div_par: [
    { id: "division_honor_par", name: "Copa de Primera do Paraguai", shortName: "División de Honor", type: "league", region: "paraguai", format: "league_playoff", teams: 12, rounds: 44, seasonSegments: 2, prize: 3000000, prestige: 58, relegation: 2, continentalSpots: [{ competition: "libertadores", spots: 4 }, { competition: "sulamericana", spots: 4 }], formatDetails: "Doze clubes disputam dois campeonatos independentes: Apertura e Clausura, cada um com 22 rodadas em turno e returno. O descenso usa a média acumulada prevista pela APF." },
    { id: "copa_paraguay", name: "Copa Paraguay", shortName: "Copa Paraguay", type: "cup", region: "paraguai", format: "knockout", teams: 74, prize: 1000000, prestige: 51, formatDetails: "Setenta e quatro clubes: 17 campeões departamentais, 12 da Primera C, 17 da Primera B, 16 da Intermedia e 12 da División de Honor. O campeão vai à Libertadores." },
  ],
  primera_div_ven: [
    { id: "liga_futve_1", name: "Liga FUTVE 1", shortName: "Liga FUTVE", type: "league", region: "venezuela", format: "group_knockout", teams: 14, groups: 2, rounds: 26, prize: 2500000, prestige: 53, relegation: 2, continentalSpots: [{ competition: "libertadores", spots: 4 }, { competition: "sulamericana", spots: 4 }], formatDetails: "Fases regulares com quatorze clubes e classificação dos oito melhores a dois quadrangulares; os vencedores decidem o título." },
    { id: "copa_venezuela", name: "Copa Venezuela", shortName: "Copa Venezuela", type: "cup", region: "venezuela", format: "group_knockout", teams: 28, groups: 5, prize: 800000, prestige: 46, formatDetails: "A fase inicial reúne 20 clubes em cinco grupos de quatro; oito classificados se juntam aos oito clubes da Liga FUTVE 1 vindos dos quadrangulares. O mata-mata, das oitavas à final, é em ida e volta." },
  ],
  liga_2_per: [
    { id: "liga_2_per", name: "Liga 2 do Peru", shortName: "Liga 2 Peru", type: "league", region: "peru", format: "group_knockout", teams: 18, groups: 2, prize: 900000, prestige: 34, promotion: 2, relegation: 0, formatDetails: "Dezoito clubes passam por fase regional, fase final e playoffs. Campeão e vice sobem à Liga 1; os últimos de cada grupo de descenso caem à Liga 3." },
  ],
  copa_simon_bolivar: [
    { id: "copa_simon_bolivar", name: "Copa Simón Bolívar", shortName: "Simón Bolívar", type: "league", region: "bolivia", format: "group_knockout", teams: 24, groups: 6, teamsPerGroup: 4, prize: 650000, prestige: 32, promotion: 2, relegation: 0, formatDetails: "A etapa regional reúne 69 clubes das nove associações departamentais. A carreira começa na fase nacional oficial: 24 classificados em seis grupos de quatro; 16 avançam às oitavas, e todas as eliminatórias até a final são em ida e volta." },
  ],
  division_intermedia_par: [
    { id: "division_intermedia_par", name: "División Intermedia", shortName: "Intermedia", type: "league", region: "paraguai", format: "points", teams: 16, rounds: 30, prize: 750000, prestige: 34, promotion: 2, relegation: 0, formatDetails: "Dezesseis clubes em turno e returno; campeão e vice sobem diretamente para a División de Honor." },
  ],
  liga_futve_2: [
    { id: "liga_futve_2", name: "Liga FUTVE 2", shortName: "FUTVE 2", type: "league", region: "venezuela", format: "group_knockout", teams: 14, groups: 2, rounds: 26, prize: 600000, prestige: 31, promotion: 2, relegation: 0, formatDetails: "Quatorze clubes profissionais disputam a segunda divisão e participam da fase inicial da Copa Venezuela; os melhores avançam à fase decisiva pelo acesso." },
  ],

  // Lote europeu 2026 — antes estes países tinham apenas um clube curado e
  // nenhuma competição associada, portanto a carreira ficava sem calendário.
  super_league_gre: [
    { id: "super_league_gre", name: "Super League Greece", shortName: "Super League", type: "league", region: "grecia", format: "league_playoff", teams: 14, rounds: 26, groups: 3, prize: 6500000, prestige: 61, relegation: 2, continentalSpots: [{ competition: "champions_league", spots: 2 }, { competition: "europa_league", spots: 1 }, { competition: "conference_league", spots: 2 }], formatDetails: "Fase regular de 26 rodadas. Depois, a classificação separa playoffs de 1º–4º e 5º–8º e playout de 9º–14º; os pontos da primeira fase são mantidos." },
  ],
  superliga_den: [
    { id: "superliga_den", name: "3F Superliga", shortName: "Superliga", type: "league", region: "dinamarca", format: "league_playoff", teams: 12, rounds: 32, groups: 2, prize: 7500000, prestige: 62, relegation: 2, continentalSpots: [{ competition: "champions_league", spots: 2 }, { competition: "europa_league", spots: 1 }, { competition: "conference_league", spots: 2 }], formatDetails: "Doze clubes jogam 22 rodadas; os seis primeiros formam o grupo do título e os seis últimos o grupo de permanência, cada qual com mais dez rodadas. Os dois últimos do grupo de permanência são rebaixados." },
  ],
  fortuna_liga_cze: [
    { id: "fortuna_liga_cze", name: "Chance Liga", shortName: "Chance Liga", type: "league", region: "chequia", format: "league_playoff", teams: 16, rounds: 35, groups: 3, prize: 6000000, prestige: 61, relegation: 1, continentalSpots: [{ competition: "champions_league", spots: 2 }, { competition: "europa_league", spots: 1 }, { competition: "conference_league", spots: 2 }], formatDetails: "Dezesseis clubes fazem 30 rodadas. Os seis primeiros e os seis últimos jogam mais cinco partidas em seus grupos; 7º–10º disputam o playoff europeu. O último cai diretamente; 14º e 15º disputam o playoff de permanência." },
  ],
  chance_narodni_liga: [
    { id: "chance_narodni_liga", name: "Chance Národní Liga", shortName: "Chance Národní Liga", type: "league", region: "chequia", format: "points", teams: 16, rounds: 30, prize: 1800000, prestige: 41, promotion: 1, relegation: 0, formatDetails: "Dezesseis clubes em turno e returno, totalizando 30 rodadas. O campeão sobe diretamente; 2º e 3º disputam playoff contra 14º e 15º da elite. Os dois últimos descem ao terceiro nível, ainda não jogável." },
  ],
  premyer_liqa_aze: [
    { id: "premyer_liqa_aze", name: "Misli Premyer Liqası", shortName: "Premyer Liqa", type: "league", region: "azerbaijao", format: "points", teams: 12, rounds: 33, roundRobinCycles: 3, prize: 3500000, prestige: 52, continentalSpots: [{ competition: "champions_league", spots: 1 }, { competition: "conference_league", spots: 3 }], formatDetails: "Doze clubes disputam três turnos, totalizando 33 partidas por equipe. O último cai diretamente; o 11º disputa playoff contra o vice da I Liqa." },
  ],
  eliteserien_nor: [
    { id: "eliteserien_nor", name: "NFF Eliteserien", shortName: "Eliteserien", type: "league", region: "noruega", format: "points", teams: 16, rounds: 30, prize: 9000000, prestige: 64, relegation: 2, continentalSpots: [{ competition: "champions_league", spots: 1 }, { competition: "conference_league", spots: 3 }], formatDetails: "Dezesseis clubes em turno e returno. 15º e 16º caem diretamente para a OBOS-ligaen; o 14º disputa a repescagem em ida e volta." },
  ],
  protathlima_cyp: [
    { id: "protathlima_cyp", name: "Cyprus League by Stoiximan", shortName: "Cyprus League", type: "league", region: "chipre", format: "league_playoff", teams: 14, rounds: 26, groups: 2, prize: 3000000, prestige: 51, relegation: 3, continentalSpots: [{ competition: "champions_league", spots: 1 }, { competition: "conference_league", spots: 3 }], formatDetails: "Quatorze clubes fazem 26 rodadas. Os seis primeiros jogam mais dez partidas pelo título; os oito restantes jogam mais sete pela permanência. Os três últimos do grupo B são rebaixados." },
  ],
  premier_liga_kaz: [
    { id: "premier_liga_kaz", name: "Kazakhstan Premier League", shortName: "Premier Liga", type: "league", region: "cazaquistao", format: "points", teams: 16, rounds: 30, prize: 4000000, prestige: 52, continentalSpots: [{ competition: "champions_league", spots: 1 }, { competition: "conference_league", spots: 3 }], formatDetails: "A elite foi ampliada de 14 para 16 clubes em 2026 e disputa turno e returno, totalizando 30 rodadas." },
  ],
  betinia_liga: [
    { id: "betinia_liga", name: "Betinia LIGA", shortName: "1. Division", type: "league", region: "dinamarca", format: "league_playoff", teams: 12, rounds: 32, groups: 2, prize: 2200000, prestige: 43, promotion: 2, relegation: 0, formatDetails: "Doze clubes disputam 22 rodadas. Os seis primeiros seguem ao grupo de acesso e os seis últimos ao grupo de permanência, com mais dez partidas; os dois melhores sobem à 3F Superliga." },
  ],
  obos_ligaen: [
    { id: "obos_ligaen", name: "OBOS-ligaen", shortName: "OBOS-ligaen", type: "league", region: "noruega", format: "points", teams: 16, rounds: 30, prize: 2500000, prestige: 45, promotion: 2, relegation: 0, formatDetails: "Dezesseis clubes em turno e returno. Os dois primeiros sobem diretamente; do 3º ao 6º disputam a qualificação cujo vencedor enfrenta o 14º da Eliteserien." },
  ],
  second_div_cyp: [
    { id: "second_div_cyp", name: "Cyprus Second Division", shortName: "Second Division", type: "league", region: "chipre", format: "league_playoff", teams: 16, rounds: 29, groups: 2, prize: 700000, prestige: 34, promotion: 3, relegation: 0, formatDetails: "Os 16 clubes jogam uma primeira fase de 15 rodadas. Os oito primeiros e os oito últimos formam dois grupos e jogam mais 14 rodadas; os três primeiros do grupo A sobem." },
  ],
}

/** Níveis inferiores carregados por grupo quando a competição é regionalizada. */
const DEEP_PLAYABLE_COMPETITIONS: Record<string, Competition[]> = {
  league_one_eng: [{ id: "league_one_eng", name: "EFL League One", shortName: "League One", type: "league", region: "inglaterra", format: "points", teams: 24, rounds: 46, prize: 5_000_000, prestige: 40, promotion: 3, relegation: 4, formatDetails: "Vinte e quatro clubes em 46 rodadas; dois acessos diretos, playoffs pela terceira vaga e quatro rebaixamentos." }],
  league_two_eng: [{ id: "league_two_eng", name: "EFL League Two", shortName: "League Two", type: "league", region: "inglaterra", format: "points", teams: 24, rounds: 46, prize: 2_500_000, prestige: 32, promotion: 4, relegation: 2, formatDetails: "Vinte e quatro clubes em 46 rodadas; três acessos diretos, playoffs pela quarta vaga e dois rebaixamentos." }],
  national_league_eng: [{ id: "national_league_eng", name: "National League", shortName: "National League", type: "league", region: "inglaterra", format: "league_playoff", teams: 24, rounds: 46, prize: 1_200_000, prestige: 25, promotion: 2, relegation: 4, formatDetails: "Campeão sobe diretamente; os clubes seguintes disputam playoffs pela segunda vaga." }],
  national_league_ns_eng: [{ id: "national_league_ns_eng", name: "National League North/South", shortName: "National N/S", type: "league", region: "inglaterra", format: "league_playoff", teams: 12, rounds: 22, groups: 2, prize: 500_000, prestige: 18, promotion: 4, formatDetails: "Grupo regional carregado conforme o clube; campeão e vencedor dos playoffs sobem." }],
  primera_federacion_esp: [{ id: "primera_federacion_esp", name: "Primera Federación", shortName: "Primera Federación", type: "league", region: "espanha", format: "league_playoff", teams: 20, rounds: 38, groups: 2, prize: 2_000_000, prestige: 34, promotion: 4, relegation: 5, formatDetails: "Um dos dois grupos de 20 clubes é carregado; campeões sobem e os playoffs definem as demais vagas." }],
  segunda_federacion_esp: [{ id: "segunda_federacion_esp", name: "Segunda Federación", shortName: "Segunda Federación", type: "league", region: "espanha", format: "league_playoff", teams: 20, rounds: 38, groups: 5, prize: 700_000, prestige: 24, promotion: 5, formatDetails: "Grupo regional de 20 clubes; acesso decidido por liderança e playoffs nacionais." }],
  dritte_liga_ger: [{ id: "dritte_liga_ger", name: "3. Liga", shortName: "3. Liga", type: "league", region: "alemanha", format: "points", teams: 20, rounds: 38, prize: 3_000_000, prestige: 36, promotion: 3, formatDetails: "Vinte clubes em turno e returno; dois acessos diretos e uma vaga de playoff." }],
  national_fra: [{ id: "national_fra", name: "Championnat National", shortName: "National", type: "league", region: "franca", format: "points", teams: 18, rounds: 34, prize: 1_800_000, prestige: 32, promotion: 3, formatDetails: "Dezoito clubes em turno e returno; acessos diretos e playoff com a Ligue 2." }],
  liga_3_por: [{ id: "liga_3_por", name: "Liga 3", shortName: "Liga 3", type: "league", region: "portugal", format: "league_playoff", teams: 10, rounds: 18, groups: 2, prize: 1_200_000, prestige: 31, promotion: 2, relegation: 2, formatDetails: "Série regional de dez clubes; a fase seguinte define acesso e permanência." }],
  campeonato_portugal: [{ id: "campeonato_portugal", name: "Campeonato de Portugal", shortName: "Campeonato", type: "league", region: "portugal", format: "group_knockout", teams: 14, rounds: 26, groups: 4, prize: 450_000, prestige: 22, promotion: 2, formatDetails: "Uma das quatro séries regionais de 14 clubes é carregada; os classificados disputam a fase de acesso." }],
  scottish_league_one: [{ id: "scottish_league_one", name: "Scottish League One", shortName: "League One", type: "league", region: "escocia", format: "points", teams: 10, rounds: 36, roundRobinCycles: 4, prize: 1_200_000, prestige: 30, promotion: 2, relegation: 2, formatDetails: "Dez clubes em quatro turnos; acesso direto e playoffs." }],
  scottish_league_two: [{ id: "scottish_league_two", name: "Scottish League Two", shortName: "League Two", type: "league", region: "escocia", format: "points", teams: 10, rounds: 36, roundRobinCycles: 4, prize: 600_000, prestige: 22, promotion: 2, formatDetails: "Dez clubes em quatro turnos; campeão sobe e os seguintes disputam playoffs." }],
  first_national_bel: [{ id: "first_national_bel", name: "Belgian National Division 1", shortName: "National 1", type: "league", region: "belgica", format: "points", teams: 14, rounds: 26, groups: 2, prize: 900_000, prestige: 27, promotion: 2, formatDetails: "Divisão inferior carregada por grupo linguístico, com acesso à Challenger Pro League." }],
  tff_2_lig: [{ id: "tff_2_lig", name: "TFF 2. Lig", shortName: "2. Lig", type: "league", region: "turquia", format: "league_playoff", teams: 18, rounds: 34, groups: 2, prize: 1_000_000, prestige: 28, promotion: 3, formatDetails: "Um dos dois grupos de 18 clubes é carregado; campeões e playoffs definem os acessos." }],
  super_league_2_gre: [{ id: "super_league_2_gre", name: "Super League Greece 2", shortName: "Super League 2", type: "league", region: "grecia", format: "league_playoff", teams: 16, rounds: 30, groups: 2, prize: 1_000_000, prestige: 30, promotion: 2, formatDetails: "Segunda divisão grega organizada em grupos e fase decisiva pelo acesso." }],
}

const FM26_PLAYABLE_LEAGUES_SOURCE = "https://support.sega.com/hc/en-gb/articles/31629731464593-Which-leagues-are-playable-and-how-can-I-add-them-to-my-Football-Manager-26-save-game"
for (const competitions of Object.values(DEEP_PLAYABLE_COMPETITIONS)) {
  for (const competition of competitions) {
    competition.sourceUrl = FM26_PLAYABLE_LEAGUES_SOURCE
    competition.participantStatus = "provisional-snapshot"
  }
}

// Mantido fora do literal gigante para que a expansão de federações seja
// declarativa e auditável em um único arquivo.
Object.assign(competitionsByLeague, UEFA_EXPANSION_COMPETITIONS, DEEP_PLAYABLE_COMPETITIONS)

// ─── FUTEBOL FEMININO ────────────────────────────────────────────────────────
//
// A liga feminina precisa existir AQUI, e não só no catálogo de clubes, porque é
// deste mapa que saem quatro coisas do modo profissional: a tela de
// Competições, o regulamento (`COMPETITION_REGULATIONS_2026` é DERIVADO daqui),
// as vagas continentais (`getContinentalSpot` lê `continentalSpots`) e a
// premiação. Sem estas entradas o clube feminino teria calendário e tabela e
// nenhuma competição declarada — jogaria um campeonato que a tela não sabe
// nomear.
//
// Os valores de premiação são a ordem de grandeza REAL da modalidade, não uma
// cópia reduzida do masculino: inflar prêmio feminino desbalancearia a
// economia do clube (a receita entra no mesmo caixa).
const REGIAO_POR_CONFEDERACAO: Record<string, string> = {
  CONMEBOL: "america_sul", UEFA: "europa", AFC: "asia", CONCACAF: "america_norte", OFC: "oceania",
}

for (const liga of LIGAS_FEMININAS) {
  const regiao = liga.codigoPais === "BRA" ? "brasil" : REGIAO_POR_CONFEDERACAO[liga.confederacao] ?? "internacional"
  const rodadas = (liga.clubes.length - 1) * 2
  const premioBase = liga.nivel === 1 ? 4_200_000 : 900_000
  const competicoes: Competition[] = [
    {
      id: liga.id,
      name: liga.nome,
      shortName: liga.short,
      type: "league",
      region: regiao,
      format: "points",
      teams: liga.clubes.length,
      rounds: rodadas,
      roundRobinCycles: 2,
      prize: premioBase,
      prestige: liga.nivel === 1 ? 72 : 52,
      relegation: liga.desce,
      promotion: liga.sobe,
      // Vagas continentais: as duas primeiras da primeira divisão, como na
      // Champions feminina e na Libertadores Feminina (que leva o campeão e o
      // vice de cada federação).
      continentalSpots: liga.continental && liga.nivel === 1
        ? [{ competition: liga.continental, spots: 2 }, ...(liga.continentalSecundaria ? [{ competition: liga.continentalSecundaria, spots: 1 }] : [])]
        : [],
      participantStatus: liga.procedencia === "federation-snapshot" ? "official-verified" : "provisional-snapshot",
    },
    {
      id: `${liga.id}_copa`,
      name: liga.copaNacional,
      shortName: liga.copaNacional,
      type: "cup",
      region: regiao,
      format: "knockout",
      teams: Math.max(16, liga.clubes.length * 2),
      prize: Math.round(premioBase * 0.6),
      prestige: liga.nivel === 1 ? 68 : 48,
    },
  ]
  if (liga.continental && liga.nivel === 1) {
    competicoes.push({
      id: `${liga.id}_continental`,
      name: liga.continental,
      shortName: liga.continental,
      type: "continental",
      region: REGIAO_POR_CONFEDERACAO[liga.confederacao] ?? "internacional",
      format: "group_knockout",
      teams: liga.confederacao === "UEFA" ? 18 : 16,
      groups: 4,
      teamsPerGroup: 4,
      prize: Math.round(premioBase * 1.8),
      prestige: 88,
    })
  }
  competitionsByLeague[liga.id] = competicoes
}

// ⚠️ A DERIVACAO DO ACESSO RODA DEPOIS DO `Object.assign` ACIMA.
//
// Seis paises (Alemanha, Franca, Espanha, Portugal, Belgica, Turquia) tem a
// divisao logo acima do acesso em `DEEP_PLAYABLE_COMPETITIONS`, e nao no objeto
// literal. Rodando antes, `competitionsByLeague[acesso.acima]` era `undefined`
// para eles e as seis bases ficavam SEM REGULAMENTO — divisao jogavel cuja tela
// de competicao nao mostra nada, que e o defeito das dezoito ligas do FALLBACK.
/**
 * REGULAMENTO DAS DIVISÕES DE ACESSO — derivado da divisão logo acima.
 *
 * ⚠️ Prêmio e prestígio são uma FRAÇÃO da divisão de cima, nunca números
 * inventados. É a mesma regra que fez o leilão e o caixa dos clubes darem
 * errado três vezes: antes de escrever um número de dinheiro ou de força,
 * procure a escala que o jogo já usa. Aqui a escala é a do degrau imediatamente
 * superior, que é exatamente o que o jogador vai comparar.
 *
 * ⚠️ `relegation` fica em ZERO. É a base da pirâmide: não existe degrau abaixo,
 * e divisão que anuncia rebaixamento sem ter para onde cair foi um defeito real
 * em 16 ligas, corrigido na auditoria de 04/08.
 *
 * ⚠️ A divisão de cima passa a REBAIXAR — antes ela era a ponta. O número tem de
 * bater com `swaps` da pirâmide, e o `qa-qualidade-das-ligas` cobra isso; por
 * isso o `relegation` dela é ajustado aqui, junto, e não numa edição à mão que
 * ficaria para trás quando o catálogo crescesse.
 */
for (const acesso of DIVISOES_DE_ACESSO) {
  const deCima = competitionsByLeague[acesso.acima]?.[0]
  if (!deCima) continue

  competitionsByLeague[acesso.acima] = competitionsByLeague[acesso.acima].map((c, i) =>
    i === 0 ? { ...c, relegation: acesso.sobem } : c)

  competitionsByLeague[acesso.id] = [{
    id: acesso.id,
    name: acesso.rotulo,
    shortName: acesso.rotulo.length > 16 ? acesso.rotulo.slice(0, 16) : acesso.rotulo,
    type: "league",
    region: deCima.region,
    // ⚠️ FORMATO ELIMINATÓRIO, como a base de pirâmide é na vida real: os
    // clubes se dividem em grupos regionais e os melhores decidem o acesso em
    // mata-mata. É o mesmo formato que a Série D já declara (`group_knockout`).
    //
    // ⚠️ E é o mesmo compromisso dela, escrito aqui para ninguém redescobrir:
    // quem GERA jogo é o `buildRoundRobin`, que deriva tudo do número de clubes
    // da divisão — as três fontes de "rodadas" e só uma manda. Então o jogo
    // disputa uma chave única de 20 e o regulamento descreve a competição real.
    // Fingir grupos aqui sem o gerador suportá-los faria a tela anunciar um
    // torneio que não acontece, que foi exatamente o defeito das 47
    // inconsistências corrigidas em 04/08.
    format: "group_knockout",
    groups: 4,
    teamsPerGroup: 5,
    teams: 20,
    rounds: 38,
    prize: Math.max(200_000, Math.round(deCima.prize * 0.3)),
    prestige: Math.max(5, Math.round(deCima.prestige * 0.5)),
    promotion: acesso.sobem,
    relegation: 0,
    formatDetails: `Base da pirâmide: reúne todos os clubes do país fora das outras divisões, em quatro grupos regionais de cinco. Os dois melhores de cada grupo avançam ao mata-mata, e ${acesso.sobem} sobem à ${deCima.name}. No jogo a chave é única, de 20 clubes montados em torno do seu — turno e returno.`,
  }]
}


// Funcao para obter competicoes de um time
export function getCompetitionsForTeam(divisao: Divisao): Competition[] {
  return competitionsByLeague[divisao] || []
}

// Funcao para gerar calendario de liga
export function generateLeagueSchedule(teams: string[], rounds: number): { round: number; home: string; away: string }[] {
  const schedule: { round: number; home: string; away: string }[] = []
  const n = teams.length
  const halfRounds = rounds / 2
  
  // Algoritmo round-robin para gerar confrontos
  for (let round = 0; round < halfRounds; round++) {
    for (let match = 0; match < n / 2; match++) {
      const home = (round + match) % (n - 1)
      let away = (n - 1 - match + round) % (n - 1)
      
      if (match === 0) {
        away = n - 1
      }
      
      // Primeiro turno
      schedule.push({
        round: round + 1,
        home: teams[home],
        away: teams[away]
      })
      
      // Segundo turno (invertido)
      schedule.push({
        round: round + halfRounds + 1,
        home: teams[away],
        away: teams[home]
      })
    }
  }
  
  return schedule.sort((a, b) => a.round - b.round)
}

// Informacoes das competicoes continentais
export const continentalCompetitions = {
  champions_league: {
    id: "champions_league",
    name: "UEFA Champions League",
    shortName: "UCL",
    region: "europa",
    prestige: 100,
    prize: 300000000,
  },
  europa_league: {
    id: "europa_league",
    name: "UEFA Europa League",
    shortName: "UEL",
    region: "europa",
    prestige: 80,
    prize: 80000000,
  },
  conference_league: {
    id: "conference_league",
    name: "UEFA Conference League",
    shortName: "UECL",
    region: "europa",
    prestige: 60,
    prize: 40000000,
  },
  libertadores: {
    id: "libertadores",
    name: "CONMEBOL Libertadores",
    shortName: "Libertadores",
    region: "america_sul",
    prestige: 95,
    prize: 134550000,
  },
  sulamericana: {
    id: "sulamericana",
    name: "CONMEBOL Sul-Americana",
    shortName: "Sul-Americana",
    region: "america_sul",
    prestige: 70,
    prize: 35100000,
  },
  afc_champions_league: {
    id: "afc_champions_league",
    name: "AFC Champions League Elite",
    shortName: "ACL Elite",
    region: "asia",
    prestige: 75,
    prize: 50000000,
  },
  concacaf_champions: {
    id: "concacaf_champions",
    name: "CONCACAF Champions Cup",
    shortName: "CCL",
    region: "america_norte",
    prestige: 60,
    prize: 25000000,
  },
}
