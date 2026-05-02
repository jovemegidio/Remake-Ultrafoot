// Dados dos times brasileiros importados do repositório Ultrafoot
// https://github.com/jovemegidio/Ultrafoot

const ULTRAFOOT_RAW_URL = "https://raw.githubusercontent.com/jovemegidio/Ultrafoot/main"

export interface Team {
  nome: string
  curto: string
  cidade: string
  estado: string
  cor1: string
  cor2: string
  prestigio: number
  torcida: number
  estadio_cap: number
  saldo: number
  file_key: string
  estadio_nome: string
  patrocinador: string
  escudo_url: string
  divisao: string
}

export interface TeamUniforms {
  home: { primary: string; secondary: string; pattern: "solid" | "stripes" | "diagonal" }
  away: { primary: string; secondary: string; pattern: "solid" | "stripes" | "diagonal" }
  third: { primary: string; secondary: string; pattern: "solid" | "stripes" | "diagonal" }
}

// Mapeamento de escudos para times brasileiros
const escudoMap: Record<string, string> = {
  "botafogorj_bra": "botafogorj_bra",
  "palmeiras": "palmeiras",
  "flarj": "flarj",
  "fortaleza": "fortaleza",
  "internacional_bra": "internacional_bra",
  "saopaulo_bra": "saopaulo_bra",
  "corinthians_bra": "corinthians_bra",
  "bahia": "bahia",
  "cruzeiro_bra": "cruzeiro_bra",
  "atleticomg_bra": "atleticomg_bra",
  "flurj": "flurj",
  "vasco": "vasco",
  "gremio": "gremio",
  "vitoria": "vitoria",
  "atleticopr_bra": "atleticopr_bra",
  "juventude": "juventude",
  "santos": "santos",
  "miirassol_sp": "miirassol_sp",
  "sport": "sport",
  "ceara_bra": "ceara_bra",
  "americamg_bra": "americamg_bra",
  "goias": "goias",
  "coritiba_bra": "coritiba_bra",
  "crb_bra": "crb_bra",
  "avai_bra": "avai_bra",
  "paysandu": "paysandu",
  "chapecoense_bra": "chapecoense_bra",
  "vilago": "vilago",
  "amazonas_am": "amazonas_am",
  "operario_pr": "operario_pr",
  "novorinzontino_sp": "novorinzontino_sp",
  "botafogosp_bra": "botafogosp_bra",
  "bragantino_bra": "bragantino_bra",
}

export function getEscudoUrl(fileKey: string): string {
  const key = escudoMap[fileKey] || fileKey
  return `${ULTRAFOOT_RAW_URL}/teams/escudos/${key}.png`
}

export function getEscudoMiniUrl(fileKey: string): string {
  const key = escudoMap[fileKey] || fileKey
  return `${ULTRAFOOT_RAW_URL}/teams/escudosMini/${key}.png`
}

export function getCamisaUrl(fileKey: string, variant: "home" | "away" | "third" = "home"): string {
  const key = escudoMap[fileKey] || fileKey
  // home -> camisas, away -> camisas2, third -> camisas3
  const folder = variant === "home" ? "camisas" : variant === "away" ? "camisas2" : "camisas3"
  return `${ULTRAFOOT_RAW_URL}/teams/${folder}/${key}.png`
}

export function getLogoUrl(): string {
  return `${ULTRAFOOT_RAW_URL}/Logo%20-%20UF26%20III.png`
}

export function getIconeUrl(): string {
  return `${ULTRAFOOT_RAW_URL}/Icone.png`
}

// Times da Série A
export const serieATeams: Team[] = [
  {
    nome: "Botafogo",
    curto: "BTF",
    cidade: "Rio de Janeiro",
    estado: "RJ",
    cor1: "#181818",
    cor2: "#a9a9a9",
    prestigio: 80,
    torcida: 8000000,
    estadio_cap: 46931,
    saldo: 80000000,
    file_key: "botafogorj_bra",
    estadio_nome: "Engenhao",
    patrocinador: "Parimatch",
    escudo_url: getEscudoUrl("botafogorj_bra"),
    divisao: "serie_a"
  },
  {
    nome: "Palmeiras",
    curto: "PLM",
    cidade: "Sao Paulo",
    estado: "SP",
    cor1: "#02693a",
    cor2: "#ffffff",
    prestigio: 85,
    torcida: 25500000,
    estadio_cap: 43713,
    saldo: 170000000,
    file_key: "palmeiras",
    estadio_nome: "Allianz Parque",
    patrocinador: "Crefisa",
    escudo_url: getEscudoUrl("palmeiras"),
    divisao: "serie_a"
  },
  {
    nome: "Flamengo",
    curto: "FLM",
    cidade: "Rio de Janeiro",
    estado: "RJ",
    cor1: "#dd2c2c",
    cor2: "#1b1b1b",
    prestigio: 93,
    torcida: 27900000,
    estadio_cap: 78838,
    saldo: 186000000,
    file_key: "flarj",
    estadio_nome: "Maracana",
    patrocinador: "Pixbet",
    escudo_url: getEscudoUrl("flarj"),
    divisao: "serie_a"
  },
  {
    nome: "Fortaleza",
    curto: "FRT",
    cidade: "Fortaleza",
    estado: "CE",
    cor1: "#66ccff",
    cor2: "#660000",
    prestigio: 75,
    torcida: 7500000,
    estadio_cap: 63904,
    saldo: 75000000,
    file_key: "fortaleza",
    estadio_nome: "Castelao",
    patrocinador: "Novibet",
    escudo_url: getEscudoUrl("fortaleza"),
    divisao: "serie_a"
  },
  {
    nome: "Internacional",
    curto: "NTR",
    cidade: "Porto Alegre",
    estado: "RS",
    cor1: "#c01616",
    cor2: "#ffffff",
    prestigio: 78,
    torcida: 7800000,
    estadio_cap: 50128,
    saldo: 78000000,
    file_key: "internacional_bra",
    estadio_nome: "Beira Rio",
    patrocinador: "Banrisul",
    escudo_url: getEscudoUrl("internacional_bra"),
    divisao: "serie_a"
  },
  {
    nome: "Sao Paulo",
    curto: "SPL",
    cidade: "Sao Paulo",
    estado: "SP",
    cor1: "#ffffff",
    cor2: "#ac1313",
    prestigio: 88,
    torcida: 26400000,
    estadio_cap: 67428,
    saldo: 176000000,
    file_key: "saopaulo_bra",
    estadio_nome: "Morumbi",
    patrocinador: "Superbet",
    escudo_url: getEscudoUrl("saopaulo_bra"),
    divisao: "serie_a"
  },
  {
    nome: "Corinthians",
    curto: "CRN",
    cidade: "Sao Paulo",
    estado: "SP",
    cor1: "#000000",
    cor2: "#ffffff",
    prestigio: 85,
    torcida: 25500000,
    estadio_cap: 48000,
    saldo: 170000000,
    file_key: "corinthians_bra",
    estadio_nome: "Neo Quimica Arena",
    patrocinador: "Esportes da Sorte",
    escudo_url: getEscudoUrl("corinthians_bra"),
    divisao: "serie_a"
  },
  {
    nome: "Bahia",
    curto: "BAH",
    cidade: "Salvador",
    estado: "BA",
    cor1: "#398de0",
    cor2: "#7c0a1c",
    prestigio: 74,
    torcida: 7400000,
    estadio_cap: 50000,
    saldo: 74000000,
    file_key: "bahia",
    estadio_nome: "Fonte Nova",
    patrocinador: "Betnacional",
    escudo_url: getEscudoUrl("bahia"),
    divisao: "serie_a"
  },
  {
    nome: "Cruzeiro",
    curto: "CRZ",
    cidade: "Belo Horizonte",
    estado: "MG",
    cor1: "#0d52a8",
    cor2: "#ffffff",
    prestigio: 81,
    torcida: 8100000,
    estadio_cap: 61846,
    saldo: 81000000,
    file_key: "cruzeiro_bra",
    estadio_nome: "Mineirao",
    patrocinador: "Betfair",
    escudo_url: getEscudoUrl("cruzeiro_bra"),
    divisao: "serie_a"
  },
  {
    nome: "Atletico-MG",
    curto: "TLT",
    cidade: "Belo Horizonte",
    estado: "MG",
    cor1: "#000000",
    cor2: "#ffffff",
    prestigio: 79,
    torcida: 7900000,
    estadio_cap: 46000,
    saldo: 79000000,
    file_key: "atleticomg_bra",
    estadio_nome: "Arena MRV",
    patrocinador: "BetMGM",
    escudo_url: getEscudoUrl("atleticomg_bra"),
    divisao: "serie_a"
  },
  {
    nome: "Fluminense",
    curto: "FL1",
    cidade: "Rio de Janeiro",
    estado: "RJ",
    cor1: "#ffffff",
    cor2: "#007700",
    prestigio: 88,
    torcida: 26400000,
    estadio_cap: 78838,
    saldo: 176000000,
    file_key: "flurj",
    estadio_nome: "Maracana",
    patrocinador: "Superbet",
    escudo_url: getEscudoUrl("flurj"),
    divisao: "serie_a"
  },
  {
    nome: "Vasco da Gama",
    curto: "VDG",
    cidade: "Rio de Janeiro",
    estado: "RJ",
    cor1: "#000000",
    cor2: "#ffffff",
    prestigio: 76,
    torcida: 7600000,
    estadio_cap: 21880,
    saldo: 76000000,
    file_key: "vasco",
    estadio_nome: "Sao Januario",
    patrocinador: "Betano",
    escudo_url: getEscudoUrl("vasco"),
    divisao: "serie_a"
  },
  {
    nome: "Gremio",
    curto: "GRM",
    cidade: "Porto Alegre",
    estado: "RS",
    cor1: "#328ce9",
    cor2: "#000000",
    prestigio: 78,
    torcida: 7800000,
    estadio_cap: 55662,
    saldo: 78000000,
    file_key: "gremio",
    estadio_nome: "Arena do Gremio",
    patrocinador: "Banrisul",
    escudo_url: getEscudoUrl("gremio"),
    divisao: "serie_a"
  },
  {
    nome: "Vitoria",
    curto: "VTR",
    cidade: "Salvador",
    estado: "BA",
    cor1: "#000000",
    cor2: "#ff4242",
    prestigio: 65,
    torcida: 1950000,
    estadio_cap: 30793,
    saldo: 32500000,
    file_key: "vitoria",
    estadio_nome: "Barradao",
    patrocinador: "Betano",
    escudo_url: getEscudoUrl("vitoria"),
    divisao: "serie_a"
  },
  {
    nome: "Athletico-PR",
    curto: "THL",
    cidade: "Curitiba",
    estado: "PR",
    cor1: "#000000",
    cor2: "#ea0000",
    prestigio: 74,
    torcida: 7400000,
    estadio_cap: 42372,
    saldo: 74000000,
    file_key: "atleticopr_bra",
    estadio_nome: "Arena da Baixada",
    patrocinador: "Esportes da Sorte",
    escudo_url: getEscudoUrl("atleticopr_bra"),
    divisao: "serie_a"
  },
  {
    nome: "Juventude",
    curto: "JVN",
    cidade: "Caxias do Sul",
    estado: "RS",
    cor1: "#009933",
    cor2: "#ffffff",
    prestigio: 51,
    torcida: 1530000,
    estadio_cap: 23726,
    saldo: 25500000,
    file_key: "juventude",
    estadio_nome: "Alfredo Jaconi",
    patrocinador: "Sicredi",
    escudo_url: getEscudoUrl("juventude"),
    divisao: "serie_a"
  },
  {
    nome: "Santos",
    curto: "SNT",
    cidade: "Santos",
    estado: "SP",
    cor1: "#e6e6e6",
    cor2: "#000000",
    prestigio: 77,
    torcida: 7700000,
    estadio_cap: 16068,
    saldo: 77000000,
    file_key: "santos",
    estadio_nome: "Vila Belmiro",
    patrocinador: "Blaze",
    escudo_url: getEscudoUrl("santos"),
    divisao: "serie_a"
  },
  {
    nome: "Mirassol",
    curto: "MRS",
    cidade: "Mirassol",
    estado: "SP",
    cor1: "#ffff00",
    cor2: "#277600",
    prestigio: 43,
    torcida: 430000,
    estadio_cap: 15000,
    saldo: 8600000,
    file_key: "miirassol_sp",
    estadio_nome: "Jose Maia",
    patrocinador: "Pixbet",
    escudo_url: getEscudoUrl("miirassol_sp"),
    divisao: "serie_a"
  },
  {
    nome: "Sport",
    curto: "SPR",
    cidade: "Recife",
    estado: "PE",
    cor1: "#000000",
    cor2: "#ff3535",
    prestigio: 67,
    torcida: 2010000,
    estadio_cap: 35000,
    saldo: 33500000,
    file_key: "sport",
    estadio_nome: "Ilha do Retiro",
    patrocinador: "Betano",
    escudo_url: getEscudoUrl("sport"),
    divisao: "serie_a"
  },
  {
    nome: "Ceara",
    curto: "CEA",
    cidade: "Fortaleza",
    estado: "CE",
    cor1: "#000000",
    cor2: "#ffffff",
    prestigio: 74,
    torcida: 7400000,
    estadio_cap: 63904,
    saldo: 74000000,
    file_key: "ceara_bra",
    estadio_nome: "Castelao",
    patrocinador: "Esportes da Sorte",
    escudo_url: getEscudoUrl("ceara_bra"),
    divisao: "serie_a"
  }
]

// Times da Série B
export const serieBTeams: Team[] = [
  {
    nome: "America-MG",
    curto: "MRC",
    cidade: "Belo Horizonte",
    estado: "MG",
    cor1: "#00b754",
    cor2: "#000000",
    prestigio: 63,
    torcida: 1890000,
    estadio_cap: 25000,
    saldo: 31500000,
    file_key: "americamg_bra",
    estadio_nome: "Independencia",
    patrocinador: "Betano",
    escudo_url: getEscudoUrl("americamg_bra"),
    divisao: "serie_b"
  },
  {
    nome: "Goias",
    curto: "GOI",
    cidade: "Goiania",
    estado: "GO",
    cor1: "#008040",
    cor2: "#ffffff",
    prestigio: 63,
    torcida: 1890000,
    estadio_cap: 14450,
    saldo: 31500000,
    file_key: "goias",
    estadio_nome: "Serrinha",
    patrocinador: "Esportes da Sorte",
    escudo_url: getEscudoUrl("goias"),
    divisao: "serie_b"
  },
  {
    nome: "Coritiba",
    curto: "CRT",
    cidade: "Curitiba",
    estado: "PR",
    cor1: "#003f2e",
    cor2: "#ffffff",
    prestigio: 73,
    torcida: 7300000,
    estadio_cap: 40502,
    saldo: 73000000,
    file_key: "coritiba_bra",
    estadio_nome: "Couto Pereira",
    patrocinador: "EsportivaBet",
    escudo_url: getEscudoUrl("coritiba_bra"),
    divisao: "serie_b"
  },
  {
    nome: "CRB",
    curto: "CRB",
    cidade: "Maceio",
    estado: "AL",
    cor1: "#ffffff",
    cor2: "#c40000",
    prestigio: 49,
    torcida: 490000,
    estadio_cap: 20800,
    saldo: 9800000,
    file_key: "crb_bra",
    estadio_nome: "Rei Pele",
    patrocinador: "Vai de Bet",
    escudo_url: getEscudoUrl("crb_bra"),
    divisao: "serie_b"
  },
  {
    nome: "Avai",
    curto: "AVA",
    cidade: "Florianopolis",
    estado: "SC",
    cor1: "#0155a6",
    cor2: "#ffffff",
    prestigio: 59,
    torcida: 1770000,
    estadio_cap: 17800,
    saldo: 29500000,
    file_key: "avai_bra",
    estadio_nome: "Ressacada",
    patrocinador: "Betnacional",
    escudo_url: getEscudoUrl("avai_bra"),
    divisao: "serie_b"
  },
  {
    nome: "Paysandu",
    curto: "PYS",
    cidade: "Belem",
    estado: "PA",
    cor1: "#006699",
    cor2: "#ffffff",
    prestigio: 52,
    torcida: 1560000,
    estadio_cap: 16400,
    saldo: 26000000,
    file_key: "paysandu",
    estadio_nome: "Curuzu",
    patrocinador: "Dafabet",
    escudo_url: getEscudoUrl("paysandu"),
    divisao: "serie_b"
  },
  {
    nome: "Chapecoense",
    curto: "CHP",
    cidade: "Chapeco",
    estado: "SC",
    cor1: "#14894f",
    cor2: "#ffffff",
    prestigio: 61,
    torcida: 1830000,
    estadio_cap: 22600,
    saldo: 30500000,
    file_key: "chapecoense_bra",
    estadio_nome: "Arena Conda",
    patrocinador: "Esportes da Sorte",
    escudo_url: getEscudoUrl("chapecoense_bra"),
    divisao: "serie_b"
  },
  {
    nome: "Vila Nova",
    curto: "VLN",
    cidade: "Goiania",
    estado: "GO",
    cor1: "#ff0000",
    cor2: "#ffffff",
    prestigio: 29,
    torcida: 87000,
    estadio_cap: 11788,
    saldo: 2900000,
    file_key: "vilago",
    estadio_nome: "OBA",
    patrocinador: "Pixbet",
    escudo_url: getEscudoUrl("vilago"),
    divisao: "serie_b"
  },
  {
    nome: "Amazonas FC",
    curto: "MZN",
    cidade: "Manaus",
    estado: "AM",
    cor1: "#ffcc00",
    cor2: "#000000",
    prestigio: 20,
    torcida: 60000,
    estadio_cap: 10000,
    saldo: 2000000,
    file_key: "amazonas_am",
    estadio_nome: "Arena da Amazonia",
    patrocinador: "Betano",
    escudo_url: getEscudoUrl("amazonas_am"),
    divisao: "serie_b"
  },
  {
    nome: "Operario-PR",
    curto: "PRR",
    cidade: "Ponta Grossa",
    estado: "PR",
    cor1: "#ffffff",
    cor2: "#000000",
    prestigio: 41,
    torcida: 410000,
    estadio_cap: 10632,
    saldo: 8200000,
    file_key: "operario_pr",
    estadio_nome: "Germano Kruger",
    patrocinador: "Pixbet",
    escudo_url: getEscudoUrl("operario_pr"),
    divisao: "serie_b"
  },
  {
    nome: "Gremio Novorizontino",
    curto: "GR1",
    cidade: "Novo Horizonte",
    estado: "SP",
    cor1: "#ffcc00",
    cor2: "#000000",
    prestigio: 41,
    torcida: 410000,
    estadio_cap: 14096,
    saldo: 8200000,
    file_key: "novorinzontino_sp",
    estadio_nome: "Jorge Ismael de Biasi",
    patrocinador: "Superbet",
    escudo_url: getEscudoUrl("novorinzontino_sp"),
    divisao: "serie_b"
  },
  {
    nome: "Botafogo-SP",
    curto: "BT1",
    cidade: "Ribeirao Preto",
    estado: "SP",
    cor1: "#ffffff",
    cor2: "#000000",
    prestigio: 47,
    torcida: 470000,
    estadio_cap: 29292,
    saldo: 9400000,
    file_key: "botafogosp_bra",
    estadio_nome: "Santa Cruz",
    patrocinador: "Betano",
    escudo_url: getEscudoUrl("botafogosp_bra"),
    divisao: "serie_b"
  },
  {
    nome: "RB Bragantino",
    curto: "RBB",
    cidade: "Braganca Paulista",
    estado: "SP",
    cor1: "#ffffff",
    cor2: "#c72d2d",
    prestigio: 55,
    torcida: 1650000,
    estadio_cap: 17022,
    saldo: 27500000,
    file_key: "bragantino_bra",
    estadio_nome: "Nabi Abi Chedid",
    patrocinador: "Red Bull",
    escudo_url: getEscudoUrl("bragantino_bra"),
    divisao: "serie_b"
  }
]

// Todos os times
export const allTeams = [...serieATeams, ...serieBTeams]

// Função para buscar time por curto
export function getTeamByShort(curto: string): Team | undefined {
  return allTeams.find(t => t.curto === curto)
}

// Função para buscar time por file_key
export function getTeamByFileKey(fileKey: string): Team | undefined {
  return allTeams.find(t => t.file_key === fileKey)
}

// Uniformes dos times (baseado nas cores reais)
export function getTeamUniforms(team: Team): TeamUniforms {
  // Determinar padrão baseado no time
  const hasStripes = ["FLM", "BTF", "VDG", "TLT", "SPL", "GRM", "SNT", "BAH", "NTR", "VTR", "SPR"].includes(team.curto)
  
  return {
    home: {
      primary: team.cor1,
      secondary: team.cor2,
      pattern: hasStripes ? "stripes" : "solid"
    },
    away: {
      primary: team.cor2,
      secondary: team.cor1,
      pattern: "solid"
    },
    third: {
      primary: "#1a1a2e",
      secondary: team.cor1,
      pattern: "diagonal"
    }
  }
}

// Formatar valor monetário brasileiro
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: value >= 1000000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(value)
}

// Formatar número com sufixo (milhões, etc)
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}
