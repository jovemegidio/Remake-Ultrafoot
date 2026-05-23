// Competicoes internacionais
import type { Divisao } from "./teams-data"

export interface Competition {
  id: string
  name: string
  shortName: string
  type: "league" | "cup" | "continental"
  region: string
  format: "points" | "knockout" | "group_knockout"
  teams: number
  rounds?: number
  groups?: number
  teamsPerGroup?: number
  prize: number
  prestige: number
  relegation?: number
  promotion?: number
  continentalSpots?: { competition: string; spots: number }[]
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
      prize: 50000000,
      prestige: 85,
      relegation: 4,
      continentalSpots: [
        { competition: "libertadores", spots: 4 },
        { competition: "sulamericana", spots: 4 },
      ],
    },
    {
      id: "copa_brasil",
      name: "Copa do Brasil",
      shortName: "Copa Brasil",
      type: "cup",
      region: "brasil",
      format: "knockout",
      teams: 92,
      prize: 80000000,
      prestige: 80,
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
      prize: 150000000,
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
      prize: 40000000,
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
      format: "points",
      teams: 20,
      rounds: 38,
      prize: 10000000,
      prestige: 60,
      promotion: 4,
      relegation: 4,
    },
  ],
  serie_c: [
    {
      id: "brasileirao_c",
      name: "Campeonato Brasileiro Serie C",
      shortName: "Serie C",
      type: "league",
      region: "brasil",
      format: "points",
      teams: 20,
      rounds: 38,
      prize: 2000000,
      prestige: 40,
      promotion: 4,
      relegation: 4,
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
      teams: 68,
      prize: 500000,
      prestige: 25,
      promotion: 4,
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
        { competition: "champions_league", spots: 4 },
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
      format: "group_knockout",
      teams: 36,
      prize: 300000000,
      prestige: 100,
    },
    {
      id: "europa_league",
      name: "UEFA Europa League",
      shortName: "UEL",
      type: "continental",
      region: "europa",
      format: "group_knockout",
      teams: 32,
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
      relegation: 2,
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
      relegation: 2,
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
      teams: 58,
      prize: 10000000,
      prestige: 55,
    },
    {
      id: "afc_champions_league",
      name: "AFC Champions League",
      shortName: "ACL",
      type: "continental",
      region: "asia",
      format: "group_knockout",
      teams: 40,
      prize: 50000000,
      prestige: 75,
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
      format: "points",
      teams: 29,
      rounds: 34,
      prize: 40000000,
      prestige: 65,
      continentalSpots: [
        { competition: "concacaf_champions", spots: 4 },
      ],
    },
    {
      id: "us_open_cup",
      name: "US Open Cup",
      shortName: "Open Cup",
      type: "cup",
      region: "usa",
      format: "knockout",
      teams: 103,
      prize: 5000000,
      prestige: 45,
    },
    {
      id: "mls_cup",
      name: "MLS Cup Playoffs",
      shortName: "MLS Cup",
      type: "cup",
      region: "usa",
      format: "knockout",
      teams: 14,
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
      format: "points",
      teams: 18,
      rounds: 34,
      prize: 45000000,
      prestige: 72,
      continentalSpots: [
        { competition: "concacaf_champions", spots: 4 },
      ],
    },
    {
      id: "copa_mx",
      name: "Copa MX",
      shortName: "Copa MX",
      type: "cup",
      region: "mexico",
      format: "group_knockout",
      teams: 32,
      prize: 8000000,
      prestige: 50,
    },
    {
      id: "liguilla",
      name: "Liga MX Liguilla",
      shortName: "Liguilla",
      type: "cup",
      region: "mexico",
      format: "knockout",
      teams: 12,
      prize: 25000000,
      prestige: 75,
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
      format: "group_knockout",
      teams: 16,
      prize: 5000000,
      prestige: 55,
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
      prize: 3000000,
      prestige: 50,
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
      prize: 2000000,
      prestige: 45,
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
      prize: 2000000,
      prestige: 45,
    },
  ],

  // J-League (placeholder)
  j_league: [
    {
      id: "j_league",
      name: "J1 League",
      shortName: "J-League",
      type: "league",
      region: "japao",
      format: "points",
      teams: 20,
      rounds: 38,
      prize: 30000000,
      prestige: 60,
      relegation: 3,
    },
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
    prize: 150000000,
  },
  sulamericana: {
    id: "sulamericana",
    name: "CONMEBOL Sul-Americana",
    shortName: "Sul-Americana",
    region: "america_sul",
    prestige: 70,
    prize: 40000000,
  },
  afc_champions_league: {
    id: "afc_champions_league",
    name: "AFC Champions League",
    shortName: "ACL",
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
