// Competicoes internacionais
import type { Divisao } from "./teams-data"

export interface Competition {
  id: string
  name: string
  shortName: string
  type: "league" | "cup" | "continental"
  region: string
  format: "points" | "knockout" | "group_knockout" | "league_playoff" | "league_phase"
  teams: number
  rounds?: number
  groups?: number
  teamsPerGroup?: number
  prize: number
  prestige: number
  relegation?: number
  promotion?: number
  continentalSpots?: { competition: string; spots: number }[]
  formatDetails?: string
}

// Competicoes por liga
export const competitionsByLeague: Record<Divisao, Competition[]> = {
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
      rounds: 58,
      prize: 40000000,
      prestige: 65,
      continentalSpots: [
        { competition: "concacaf_champions", spots: 4 },
      ],
      formatDetails: "Turno e returno entre os 30 clubes. A MLS real separa duas conferências de 15 com 34 jogos por clube e playoffs.",
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
    { id: "scottish_prem", name: "Scottish Premiership", shortName: "SPFL Prem", type: "league", region: "escocia", format: "league_playoff", teams: 12, rounds: 22, prize: 15000000, prestige: 65, relegation: 2, formatDetails: "Turno e returno entre os 12 clubes. Na Escócia são 33 rodadas e uma divisão em grupos de título e permanência; aqui a temporada é corrida." },
  ],

  // Super Lig - Turquia
  super_lig: [
    { id: "super_lig", name: "Trendyol Süper Lig", shortName: "Süper Lig", type: "league", region: "turquia", format: "points", teams: 18, rounds: 34, prize: 35000000, prestige: 70, relegation: 3 },
  ],

  // Belgian Pro League - Belgica
  pro_league_bel: [
    { id: "pro_league_bel", name: "Belgian Pro League", shortName: "Pro League", type: "league", region: "belgica", format: "points", teams: 16, rounds: 30, prize: 20000000, prestige: 66, relegation: 2, formatDetails: "Liga clássica em turno e returno, sem playoffs." },
  ],

  // Russian Premier League - Russia
  russian_prem: [
    { id: "russian_prem", name: "Russian Premier League", shortName: "RPL", type: "league", region: "russia", format: "points", teams: 16, rounds: 30, prize: 25000000, prestige: 68, relegation: 2 },
  ],

  // Liga Argentina
  liga_argentina: [
    { id: "liga_argentina", name: "Liga Profesional de Fútbol", shortName: "Liga Argentina", type: "league", region: "argentina", format: "group_knockout", teams: 30, rounds: 58, prize: 20000000, prestige: 75, relegation: 2, continentalSpots: [{ competition: "libertadores", spots: 6 }, { competition: "sulamericana", spots: 6 }], formatDetails: "Turno e returno entre todos os clubes. Na Argentina a temporada se divide em Apertura e Clausura, com duas zonas de 15 e mata-mata." },
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
    { id: "primera_div_ury", name: "Liga AUF Uruguaya", shortName: "Liga AUF", type: "league", region: "uruguai", format: "group_knockout", teams: 16, rounds: 30, prize: 4000000, prestige: 58, relegation: 3, continentalSpots: [{ competition: "libertadores", spots: 4 }, { competition: "sulamericana", spots: 4 }], formatDetails: "Turno e returno entre todos os clubes. No Uruguai a temporada tem Apertura, Intermedio e Clausura, com a Tabela Anual definindo campeao e rebaixamentos." },
  ],

  // LigaPro Serie A - Equador (liga que faltava)
  primera_a_ecu: [
    { id: "primera_a_ecu", name: "LigaPro Serie A", shortName: "LigaPro", type: "league", region: "equador", format: "group_knockout", teams: 16, rounds: 30, prize: 4000000, prestige: 60, relegation: 2, continentalSpots: [{ competition: "libertadores", spots: 4 }, { competition: "sulamericana", spots: 4 }], formatDetails: "Primeira e segunda etapa em pontos corridos; os vencedores de etapa decidem o titulo na final; a Tabela Acumulada define vagas continentais e os dois rebaixados." },
  ],

  // K-League 1 - Coreia do Sul
  k_league_1: [
    { id: "k_league_1", name: "K League 1", shortName: "K-League 1", type: "league", region: "coreia_do_sul", format: "league_playoff", teams: 12, rounds: 22, prize: 15000000, prestige: 58, relegation: 2, formatDetails: "Turno e returno entre os 12 clubes, dois caem para a K League 2. Na Coreia a temporada tem três turnos e depois se divide em grupos A e B; aqui ela é disputada em pontos corridos." },
  ],

  // Chinese Super League - China
  chinese_super: [
    { id: "chinese_super", name: "Chinese Super League", shortName: "CSL", type: "league", region: "china", format: "points", teams: 16, rounds: 30, prize: 20000000, prestige: 55, relegation: 3 },
  ],

  // 2as divisoes - Europa
  championship: [
    { id: "championship", name: "EFL Championship", shortName: "Championship", type: "league", region: "inglaterra", format: "league_playoff", teams: 24, rounds: 46, prize: 20000000, prestige: 55, promotion: 3, relegation: 0, formatDetails: "Dois acessos diretos; a partir de 2026/27, seis clubes disputam o playoff pela terceira vaga." },
  ],
  la_liga_2: [
    { id: "la_liga_2", name: "La Liga 2", shortName: "La Liga 2", type: "league", region: "espanha", format: "league_playoff", teams: 22, rounds: 42, prize: 8000000, prestige: 45, promotion: 3, relegation: 0, formatDetails: "Dois acessos diretos; 3º ao 6º disputam o playoff pela terceira vaga; quatro rebaixados." },
  ],
  serie_b_ita: [
    { id: "serie_b_ita", name: "Serie B", shortName: "Serie B Ita", type: "league", region: "italia", format: "league_playoff", teams: 20, rounds: 38, prize: 10000000, prestige: 48, promotion: 3, relegation: 0, formatDetails: "Dois acessos diretos e playoff pela terceira vaga; três quedas diretas e playout entre 16º e 17º quando aplicável." },
  ],
  bundesliga_2: [
    { id: "bundesliga_2", name: "2. Bundesliga", shortName: "2. Bundesliga", type: "league", region: "alemanha", format: "league_playoff", teams: 18, rounds: 34, prize: 8000000, prestige: 46, promotion: 3, relegation: 0, formatDetails: "Dois acessos e duas quedas diretas; o 3º disputa playoff com o 16º da Bundesliga e o 16º enfrenta o 3º da 3. Liga." },
  ],
  ligue_2: [
    { id: "ligue_2", name: "Ligue 2", shortName: "Ligue 2", type: "league", region: "franca", format: "league_playoff", teams: 18, rounds: 34, prize: 5000000, prestige: 40, promotion: 3, relegation: 0, formatDetails: "Dois acessos diretos; 3º a 5º disputam playoff e o vencedor enfrenta o 16º da Ligue 1. O 16º disputa permanência com o National." },
  ],
  liga_portugal_2: [
    { id: "liga_portugal_2", name: "Liga Portugal 2", shortName: "Liga 2", type: "league", region: "portugal", format: "league_playoff", teams: 18, rounds: 34, prize: 3000000, prestige: 38, promotion: 3, relegation: 0, formatDetails: "Dois acessos diretos e playoff do 3º contra o 16º da primeira divisão; duas quedas diretas e playoff de permanência." },
  ],
  eerste_divisie: [
    { id: "eerste_divisie", name: "Eerste Divisie", shortName: "Eerste Div", type: "league", region: "holanda", format: "league_playoff", teams: 20, rounds: 38, prize: 2000000, prestige: 35, promotion: 3, relegation: 0, formatDetails: "Campeão e vice elegíveis sobem diretamente; campeões de período e melhores elegíveis disputam o playoff pela terceira vaga. Equipes B não podem subir." },
  ],
  challenger_pro: [
    { id: "challenger_pro", name: "Challenger Pro League", shortName: "Challenger", type: "league", region: "belgica", format: "league_playoff", teams: 16, rounds: 30, prize: 1500000, prestige: 32, promotion: 2, relegation: 0, formatDetails: "Formato 2026/27 para 15/16 clubes: líder elegível sobe; clubes elegíveis do 2º ao 5º disputam a segunda vaga; equipes U23 não podem subir." },
  ],
  tff_1_lig: [
    { id: "tff_1_lig", name: "TFF 1. Lig", shortName: "1. Lig", type: "league", region: "turquia", format: "league_playoff", teams: 20, rounds: 38, prize: 2500000, prestige: 36, promotion: 3, relegation: 0, formatDetails: "Vinte clubes em turno e returno; quatro rebaixados. O acesso combina vagas diretas e playoff conforme o estatuto TFF 2026/27." },
  ],
  russian_first: [
    { id: "russian_first", name: "Russian First League", shortName: "RPL 2", type: "league", region: "russia", format: "points", teams: 20, rounds: 38, prize: 2000000, prestige: 35, promotion: 2, relegation: 0 },
  ],

  // 2as divisoes - Americas
  primera_b_arg: [
    { id: "primera_b_arg", name: "Primera Nacional", shortName: "Primera B Arg", type: "league", region: "argentina", format: "league_playoff", teams: 20, rounds: 38, prize: 2000000, prestige: 40, promotion: 2, relegation: 0, formatDetails: "Turno e returno entre os 20 clubes; sobem dois. A Primera Nacional real tem 36 clubes em duas zonas." },
  ],
  torneo_betplay: [
    { id: "torneo_betplay", name: "Torneo BetPlay Dimayor", shortName: "Torneo Betplay", type: "league", region: "colombia", format: "group_knockout", teams: 16, rounds: 30, prize: 1500000, prestige: 35, promotion: 2, formatDetails: "Turno e returno entre os 16 clubes; sobem dois a Primera A." },
  ],
  primera_b_chi: [
    { id: "primera_b_chi", name: "Liga de Ascenso de Chile", shortName: "Liga Ascenso", type: "league", region: "chile", format: "league_playoff", teams: 18, rounds: 34, prize: 1000000, prestige: 32, promotion: 2, relegation: 0, formatDetails: "Dezesseis clubes em 30 rodadas, com acesso direto e liguilla pela segunda vaga." },
  ],
  segunda_div_ury: [
    { id: "segunda_div_ury", name: "Segunda División Profesional", shortName: "Segunda Uruguay", type: "league", region: "uruguai", format: "league_playoff", teams: 14, rounds: 26, prize: 500000, prestige: 28, promotion: 3, relegation: 0, formatDetails: "Turno e returno entre os 14 clubes; sobem dois a Primera Division." },
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
    { id: "scottish_champ", name: "Scottish Championship", shortName: "Scottish Champ", type: "league", region: "escocia", format: "league_playoff", teams: 10, rounds: 18, prize: 2000000, prestige: 34, promotion: 2, relegation: 0, formatDetails: "Turno e returno entre os dez clubes; o campeao sobe direto e o segundo decide o acesso no playoff." },
  ],
  serie_b_ecu: [
    { id: "serie_b_ecu", name: "LigaPro Serie B", shortName: "LigaPro B", type: "league", region: "equador", format: "league_playoff", teams: 10, rounds: 18, prize: 1200000, prestige: 32, promotion: 2, relegation: 0, formatDetails: "Turno e returno entre os dez clubes; os dois primeiros sobem a Serie A." },
  ],
  china_league_one: [
    { id: "china_league_one", name: "China League One", shortName: "China Liga 1", type: "league", region: "china", format: "points", teams: 11, rounds: 20, prize: 3000000, prestige: 30, promotion: 2, relegation: 0, formatDetails: "Turno e returno. A China League One real tem 16 clubes; aqui a divisao e montada com os clubes chineses disponiveis." },
  ],
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
