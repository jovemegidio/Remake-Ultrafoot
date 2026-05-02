// Sistema completo de dados dos clubes brasileiros com escudos e uniformes reais

export interface Kit {
  id: "home" | "away" | "third"
  label: string
  primary: string
  secondary: string
  accent?: string
  pattern: "stripes" | "solid" | "diagonal" | "hoops" | "half"
  sponsor?: string
}

export interface Club {
  id: string
  name: string
  shortName: string
  abbr: string
  city: string
  state: string
  stadium: string
  stadiumCapacity: number
  founded: number
  colors: {
    primary: string
    secondary: string
    accent?: string
  }
  kits: Kit[]
  // URL do escudo oficial via API-Football ou similar
  crestUrl: string
  formation: string
  style: string
}

// Cores dos clubes em oklch para consistencia
const CLUB_COLORS = {
  // Atletico-MG - Preto e Branco
  atleticoMG: {
    primary: "oklch(0.15 0 0)",
    secondary: "oklch(0.95 0 0)",
  },
  // Cruzeiro - Azul e Branco
  cruzeiro: {
    primary: "oklch(0.45 0.2 250)",
    secondary: "oklch(0.95 0 0)",
  },
  // Flamengo - Vermelho e Preto
  flamengo: {
    primary: "oklch(0.50 0.22 25)",
    secondary: "oklch(0.15 0 0)",
  },
  // Palmeiras - Verde e Branco
  palmeiras: {
    primary: "oklch(0.45 0.15 145)",
    secondary: "oklch(0.95 0 0)",
  },
  // Corinthians - Preto e Branco
  corinthians: {
    primary: "oklch(0.15 0 0)",
    secondary: "oklch(0.95 0 0)",
  },
  // Sao Paulo - Vermelho, Preto e Branco
  saoPaulo: {
    primary: "oklch(0.95 0 0)",
    secondary: "oklch(0.50 0.22 25)",
    accent: "oklch(0.15 0 0)",
  },
  // Santos - Preto e Branco
  santos: {
    primary: "oklch(0.95 0 0)",
    secondary: "oklch(0.15 0 0)",
  },
  // Botafogo - Preto e Branco
  botafogo: {
    primary: "oklch(0.15 0 0)",
    secondary: "oklch(0.95 0 0)",
  },
  // Fluminense - Grena, Verde e Branco
  fluminense: {
    primary: "oklch(0.40 0.18 350)",
    secondary: "oklch(0.45 0.15 145)",
  },
  // Vasco - Preto e Branco
  vasco: {
    primary: "oklch(0.15 0 0)",
    secondary: "oklch(0.95 0 0)",
  },
  // Gremio - Azul, Preto e Branco
  gremio: {
    primary: "oklch(0.45 0.18 240)",
    secondary: "oklch(0.15 0 0)",
  },
  // Internacional - Vermelho e Branco
  internacional: {
    primary: "oklch(0.50 0.22 25)",
    secondary: "oklch(0.95 0 0)",
  },
  // Tombense - Vermelho e Preto
  tombense: {
    primary: "oklch(0.50 0.22 25)",
    secondary: "oklch(0.15 0 0)",
  },
  // America-MG - Verde e Branco
  americaMG: {
    primary: "oklch(0.45 0.15 145)",
    secondary: "oklch(0.95 0 0)",
  },
}

export const CLUBS: Club[] = [
  {
    id: "atletico-mg",
    name: "Clube Atletico Mineiro",
    shortName: "Atletico-MG",
    abbr: "CAM",
    city: "Belo Horizonte",
    state: "MG",
    stadium: "Arena MRV",
    stadiumCapacity: 46000,
    founded: 1908,
    colors: CLUB_COLORS.atleticoMG,
    crestUrl: "https://media.api-sports.io/football/teams/1062.png",
    formation: "4-2-3-1",
    style: "Equilibrado",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.atleticoMG.primary,
        secondary: CLUB_COLORS.atleticoMG.secondary,
        pattern: "stripes",
        sponsor: "MRV",
      },
      {
        id: "away",
        label: "Reserva",
        primary: CLUB_COLORS.atleticoMG.secondary,
        secondary: CLUB_COLORS.atleticoMG.primary,
        pattern: "solid",
        sponsor: "MRV",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: "oklch(0.45 0.15 45)",
        secondary: CLUB_COLORS.atleticoMG.primary,
        pattern: "solid",
        sponsor: "MRV",
      },
    ],
  },
  {
    id: "cruzeiro",
    name: "Cruzeiro Esporte Clube",
    shortName: "Cruzeiro",
    abbr: "CRU",
    city: "Belo Horizonte",
    state: "MG",
    stadium: "Mineirao",
    stadiumCapacity: 61846,
    founded: 1921,
    colors: CLUB_COLORS.cruzeiro,
    crestUrl: "https://media.api-sports.io/football/teams/1066.png",
    formation: "4-3-3",
    style: "Ofensivo",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.cruzeiro.primary,
        secondary: CLUB_COLORS.cruzeiro.secondary,
        pattern: "solid",
        sponsor: "Betfair",
      },
      {
        id: "away",
        label: "Reserva",
        primary: CLUB_COLORS.cruzeiro.secondary,
        secondary: CLUB_COLORS.cruzeiro.primary,
        pattern: "solid",
        sponsor: "Betfair",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: "oklch(0.25 0.15 250)",
        secondary: "oklch(0.78 0.18 75)",
        pattern: "diagonal",
        sponsor: "Betfair",
      },
    ],
  },
  {
    id: "flamengo",
    name: "Clube de Regatas do Flamengo",
    shortName: "Flamengo",
    abbr: "FLA",
    city: "Rio de Janeiro",
    state: "RJ",
    stadium: "Maracana",
    stadiumCapacity: 78838,
    founded: 1895,
    colors: CLUB_COLORS.flamengo,
    crestUrl: "https://media.api-sports.io/football/teams/127.png",
    formation: "4-4-2",
    style: "Ofensivo",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.flamengo.primary,
        secondary: CLUB_COLORS.flamengo.secondary,
        pattern: "hoops",
        sponsor: "Adidas",
      },
      {
        id: "away",
        label: "Reserva",
        primary: CLUB_COLORS.flamengo.secondary,
        secondary: CLUB_COLORS.flamengo.primary,
        pattern: "solid",
        sponsor: "Adidas",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: "oklch(0.95 0 0)",
        secondary: CLUB_COLORS.flamengo.primary,
        pattern: "diagonal",
        sponsor: "Adidas",
      },
    ],
  },
  {
    id: "palmeiras",
    name: "Sociedade Esportiva Palmeiras",
    shortName: "Palmeiras",
    abbr: "PAL",
    city: "Sao Paulo",
    state: "SP",
    stadium: "Allianz Parque",
    stadiumCapacity: 43713,
    founded: 1914,
    colors: CLUB_COLORS.palmeiras,
    crestUrl: "https://media.api-sports.io/football/teams/121.png",
    formation: "4-3-3",
    style: "Equilibrado",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.palmeiras.primary,
        secondary: CLUB_COLORS.palmeiras.secondary,
        pattern: "solid",
        sponsor: "Crefisa",
      },
      {
        id: "away",
        label: "Reserva",
        primary: CLUB_COLORS.palmeiras.secondary,
        secondary: CLUB_COLORS.palmeiras.primary,
        pattern: "solid",
        sponsor: "Crefisa",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: "oklch(0.78 0.18 75)",
        secondary: CLUB_COLORS.palmeiras.primary,
        pattern: "diagonal",
        sponsor: "Crefisa",
      },
    ],
  },
  {
    id: "corinthians",
    name: "Sport Club Corinthians Paulista",
    shortName: "Corinthians",
    abbr: "COR",
    city: "Sao Paulo",
    state: "SP",
    stadium: "Neo Quimica Arena",
    stadiumCapacity: 49205,
    founded: 1910,
    colors: CLUB_COLORS.corinthians,
    crestUrl: "https://media.api-sports.io/football/teams/131.png",
    formation: "4-3-3",
    style: "Defensivo",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.corinthians.secondary,
        secondary: CLUB_COLORS.corinthians.primary,
        pattern: "solid",
        sponsor: "Neo Quimica",
      },
      {
        id: "away",
        label: "Reserva",
        primary: CLUB_COLORS.corinthians.primary,
        secondary: CLUB_COLORS.corinthians.secondary,
        pattern: "solid",
        sponsor: "Neo Quimica",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: "oklch(0.45 0.15 280)",
        secondary: CLUB_COLORS.corinthians.secondary,
        pattern: "diagonal",
        sponsor: "Neo Quimica",
      },
    ],
  },
  {
    id: "sao-paulo",
    name: "Sao Paulo Futebol Clube",
    shortName: "Sao Paulo",
    abbr: "SAO",
    city: "Sao Paulo",
    state: "SP",
    stadium: "MorumBIS",
    stadiumCapacity: 66795,
    founded: 1930,
    colors: CLUB_COLORS.saoPaulo,
    crestUrl: "https://media.api-sports.io/football/teams/126.png",
    formation: "4-2-3-1",
    style: "Equilibrado",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.saoPaulo.primary,
        secondary: CLUB_COLORS.saoPaulo.secondary,
        accent: CLUB_COLORS.saoPaulo.accent,
        pattern: "hoops",
        sponsor: "New Balance",
      },
      {
        id: "away",
        label: "Reserva",
        primary: CLUB_COLORS.saoPaulo.secondary,
        secondary: CLUB_COLORS.saoPaulo.primary,
        pattern: "solid",
        sponsor: "New Balance",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: CLUB_COLORS.saoPaulo.accent!,
        secondary: CLUB_COLORS.saoPaulo.primary,
        pattern: "diagonal",
        sponsor: "New Balance",
      },
    ],
  },
  {
    id: "santos",
    name: "Santos Futebol Clube",
    shortName: "Santos",
    abbr: "SAN",
    city: "Santos",
    state: "SP",
    stadium: "Vila Belmiro",
    stadiumCapacity: 16068,
    founded: 1912,
    colors: CLUB_COLORS.santos,
    crestUrl: "https://media.api-sports.io/football/teams/128.png",
    formation: "4-3-3",
    style: "Ofensivo",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.santos.primary,
        secondary: CLUB_COLORS.santos.secondary,
        pattern: "solid",
        sponsor: "Umbro",
      },
      {
        id: "away",
        label: "Reserva",
        primary: CLUB_COLORS.santos.secondary,
        secondary: CLUB_COLORS.santos.primary,
        pattern: "stripes",
        sponsor: "Umbro",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: "oklch(0.78 0.18 75)",
        secondary: CLUB_COLORS.santos.secondary,
        pattern: "solid",
        sponsor: "Umbro",
      },
    ],
  },
  {
    id: "botafogo",
    name: "Botafogo de Futebol e Regatas",
    shortName: "Botafogo",
    abbr: "BOT",
    city: "Rio de Janeiro",
    state: "RJ",
    stadium: "Estadio Nilton Santos",
    stadiumCapacity: 46831,
    founded: 1904,
    colors: CLUB_COLORS.botafogo,
    crestUrl: "https://media.api-sports.io/football/teams/120.png",
    formation: "4-2-3-1",
    style: "Equilibrado",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.botafogo.primary,
        secondary: CLUB_COLORS.botafogo.secondary,
        pattern: "stripes",
        sponsor: "Parimatch",
      },
      {
        id: "away",
        label: "Reserva",
        primary: CLUB_COLORS.botafogo.secondary,
        secondary: CLUB_COLORS.botafogo.primary,
        pattern: "solid",
        sponsor: "Parimatch",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: "oklch(0.78 0.18 75)",
        secondary: CLUB_COLORS.botafogo.primary,
        pattern: "diagonal",
        sponsor: "Parimatch",
      },
    ],
  },
  {
    id: "fluminense",
    name: "Fluminense Football Club",
    shortName: "Fluminense",
    abbr: "FLU",
    city: "Rio de Janeiro",
    state: "RJ",
    stadium: "Maracana",
    stadiumCapacity: 78838,
    founded: 1902,
    colors: CLUB_COLORS.fluminense,
    crestUrl: "https://media.api-sports.io/football/teams/124.png",
    formation: "4-2-3-1",
    style: "Equilibrado",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.fluminense.primary,
        secondary: CLUB_COLORS.fluminense.secondary,
        pattern: "hoops",
        sponsor: "Umbro",
      },
      {
        id: "away",
        label: "Reserva",
        primary: "oklch(0.95 0 0)",
        secondary: CLUB_COLORS.fluminense.primary,
        pattern: "solid",
        sponsor: "Umbro",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: "oklch(0.15 0 0)",
        secondary: CLUB_COLORS.fluminense.primary,
        pattern: "diagonal",
        sponsor: "Umbro",
      },
    ],
  },
  {
    id: "vasco",
    name: "Club de Regatas Vasco da Gama",
    shortName: "Vasco",
    abbr: "VAS",
    city: "Rio de Janeiro",
    state: "RJ",
    stadium: "Sao Januario",
    stadiumCapacity: 21880,
    founded: 1898,
    colors: CLUB_COLORS.vasco,
    crestUrl: "https://media.api-sports.io/football/teams/133.png",
    formation: "4-3-3",
    style: "Ofensivo",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.vasco.secondary,
        secondary: CLUB_COLORS.vasco.primary,
        pattern: "half",
        sponsor: "Kappa",
      },
      {
        id: "away",
        label: "Reserva",
        primary: CLUB_COLORS.vasco.primary,
        secondary: CLUB_COLORS.vasco.secondary,
        pattern: "solid",
        sponsor: "Kappa",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: "oklch(0.78 0.18 75)",
        secondary: CLUB_COLORS.vasco.primary,
        pattern: "solid",
        sponsor: "Kappa",
      },
    ],
  },
  {
    id: "gremio",
    name: "Gremio Foot-Ball Porto Alegrense",
    shortName: "Gremio",
    abbr: "GRE",
    city: "Porto Alegre",
    state: "RS",
    stadium: "Arena do Gremio",
    stadiumCapacity: 55662,
    founded: 1903,
    colors: CLUB_COLORS.gremio,
    crestUrl: "https://media.api-sports.io/football/teams/130.png",
    formation: "4-3-3",
    style: "Equilibrado",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.gremio.primary,
        secondary: CLUB_COLORS.gremio.secondary,
        pattern: "stripes",
        sponsor: "Umbro",
      },
      {
        id: "away",
        label: "Reserva",
        primary: "oklch(0.95 0 0)",
        secondary: CLUB_COLORS.gremio.primary,
        pattern: "solid",
        sponsor: "Umbro",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: CLUB_COLORS.gremio.secondary,
        secondary: CLUB_COLORS.gremio.primary,
        pattern: "diagonal",
        sponsor: "Umbro",
      },
    ],
  },
  {
    id: "internacional",
    name: "Sport Club Internacional",
    shortName: "Internacional",
    abbr: "INT",
    city: "Porto Alegre",
    state: "RS",
    stadium: "Beira-Rio",
    stadiumCapacity: 50128,
    founded: 1909,
    colors: CLUB_COLORS.internacional,
    crestUrl: "https://media.api-sports.io/football/teams/119.png",
    formation: "4-2-3-1",
    style: "Ofensivo",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.internacional.primary,
        secondary: CLUB_COLORS.internacional.secondary,
        pattern: "solid",
        sponsor: "Adidas",
      },
      {
        id: "away",
        label: "Reserva",
        primary: CLUB_COLORS.internacional.secondary,
        secondary: CLUB_COLORS.internacional.primary,
        pattern: "solid",
        sponsor: "Adidas",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: "oklch(0.15 0 0)",
        secondary: CLUB_COLORS.internacional.primary,
        pattern: "diagonal",
        sponsor: "Adidas",
      },
    ],
  },
  {
    id: "tombense",
    name: "Tombense Futebol Clube",
    shortName: "Tombense",
    abbr: "TOM",
    city: "Tombos",
    state: "MG",
    stadium: "Estadio Antonio Guimaraes de Almeida",
    stadiumCapacity: 3000,
    founded: 1914,
    colors: CLUB_COLORS.tombense,
    crestUrl: "https://media.api-sports.io/football/teams/7848.png",
    formation: "4-3-3",
    style: "Ofensivo",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.tombense.primary,
        secondary: CLUB_COLORS.tombense.secondary,
        pattern: "stripes",
        sponsor: "Tombense",
      },
      {
        id: "away",
        label: "Reserva",
        primary: "oklch(0.95 0 0)",
        secondary: CLUB_COLORS.tombense.primary,
        pattern: "solid",
        sponsor: "Tombense",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: CLUB_COLORS.tombense.secondary,
        secondary: CLUB_COLORS.tombense.primary,
        pattern: "diagonal",
        sponsor: "Tombense",
      },
    ],
  },
  {
    id: "america-mg",
    name: "America Futebol Clube",
    shortName: "America-MG",
    abbr: "AME",
    city: "Belo Horizonte",
    state: "MG",
    stadium: "Independencia",
    stadiumCapacity: 23018,
    founded: 1912,
    colors: CLUB_COLORS.americaMG,
    crestUrl: "https://media.api-sports.io/football/teams/1065.png",
    formation: "4-3-3",
    style: "Equilibrado",
    kits: [
      {
        id: "home",
        label: "Titular",
        primary: CLUB_COLORS.americaMG.primary,
        secondary: CLUB_COLORS.americaMG.secondary,
        pattern: "solid",
        sponsor: "America",
      },
      {
        id: "away",
        label: "Reserva",
        primary: CLUB_COLORS.americaMG.secondary,
        secondary: CLUB_COLORS.americaMG.primary,
        pattern: "solid",
        sponsor: "America",
      },
      {
        id: "third",
        label: "Alternativo",
        primary: "oklch(0.15 0 0)",
        secondary: CLUB_COLORS.americaMG.primary,
        pattern: "diagonal",
        sponsor: "America",
      },
    ],
  },
]

// Helper para encontrar clube por ID
export function getClubById(id: string): Club | undefined {
  return CLUBS.find((club) => club.id === id)
}

// Helper para encontrar clube por abreviacao
export function getClubByAbbr(abbr: string): Club | undefined {
  return CLUBS.find((club) => club.abbr === abbr)
}

// Clubes do usuario e adversario padroes
export const USER_CLUB_ID = "atletico-mg"
export const DEFAULT_OPPONENT_ID = "cruzeiro"
