// Dados dos times brasileiros importados do repositório Ultrafoot
// https://github.com/jovemegidio/Ultrafoot

const ULTRAFOOT_RAW_URL = "https://raw.githubusercontent.com/jovemegidio/Ultrafoot/main"

// Divisões / regiões suportadas pelo jogo
export type Divisao =
  | "serie_a"
  | "serie_b"
  | "serie_c"
  | "serie_d"
  // Internacionais
  | "premier_league"
  | "la_liga"
  | "serie_a_ita"
  | "bundesliga"
  | "ligue_1"
  | "saudi_pro"
  | "j_league"
  | "mls"
  | "liga_mx"
  | "primeira_liga"
  // Estaduais
  | "paulistao"
  | "carioca"
  | "mineiro"
  | "gaucho"

export type Regiao = "brasil" | "europa" | "asia" | "americas"

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
  divisao: Divisao | string
  regiao?: Regiao
  pais?: string
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

// Mapeamento de file_keys para escudos locais (times brasileiros)
const localEscudoMap: Record<string, string> = {
  "botafogorj_bra": "/escudos/brasil/botafogo.png",
  "palmeiras": "/escudos/brasil/palmeiras.png",
  "flarj": "/escudos/brasil/flamengo.png",
  "corinthians_bra": "/escudos/brasil/corinthians.png",
  "saopaulo_bra": "/escudos/brasil/saopaulo.png",
  "flurj": "/escudos/brasil/fluminense.png",
  "vasco": "/escudos/brasil/vasco.png",
  "santos": "/escudos/brasil/santos.png",
  "gremio": "/escudos/brasil/gremio.png",
  "internacional_bra": "/escudos/brasil/internacional.png",
  "atleticomg_bra": "/escudos/brasil/atleticomg.png",
  "cruzeiro_bra": "/escudos/brasil/cruzeiro.png",
  "bahia": "/escudos/brasil/bahia.png",
  "fortaleza": "/escudos/brasil/fortaleza.png",
  "vitoria": "/escudos/brasil/vitoria.png",
  "atleticopr_bra": "/escudos/brasil/atleticopr.png",
  "ceara_bra": "/escudos/brasil/ceara.png",
  "sport": "/escudos/brasil/sport.png",
  "bragantino_bra": "/escudos/brasil/bragantino.png",
  "juventude": "/escudos/brasil/juventude.png",
  // Premier League
  "manchester_city": "/escudos/premier_league/manchester_city.png",
  "arsenal": "/escudos/premier_league/arsenal.png",
  "liverpool": "/escudos/premier_league/liverpool.png",
  "manchester_united": "/escudos/premier_league/manchester_united.png",
  "chelsea": "/escudos/premier_league/chelsea.png",
  "tottenham": "/escudos/premier_league/tottenham.png",
  "newcastle": "/escudos/premier_league/newcastle.png",
  "aston_villa": "/escudos/premier_league/aston_villa.png",
  "west_ham": "/escudos/premier_league/west_ham.png",
  "brighton": "/escudos/premier_league/brighton.png",
  "everton": "/escudos/premier_league/everton.png",
  "crystal_palace": "/escudos/premier_league/crystal_palace.png",
  "bournemouth": "/escudos/premier_league/bournemouth.png",
  "wolves": "/escudos/premier_league/wolves.png",
  "fulham": "/escudos/premier_league/fulham.png",
  "brentford": "/escudos/premier_league/brentford.png",
  "nottingham_forest": "/escudos/premier_league/nottingham_forest.png",
  "leicester": "/escudos/premier_league/leicester.png",
  "southampton": "/escudos/premier_league/southampton.png",
  "ipswich": "/escudos/premier_league/ipswich.png",
  // La Liga
  "real_madrid": "/escudos/la_liga/real_madrid.png",
  "barcelona": "/escudos/la_liga/barcelona.png",
  "atletico_madrid": "/escudos/la_liga/atletico_madrid.png",
  "sevilla": "/escudos/la_liga/sevilla.png",
  "villarreal": "/escudos/la_liga/villarreal.png",
  "real_sociedad": "/escudos/la_liga/real_sociedad.png",
  "athletic_bilbao": "/escudos/la_liga/athletic_bilbao.png",
  "valencia": "/escudos/la_liga/valencia.png",
  "real_betis": "/escudos/la_liga/real_betis.png",
  "girona": "/escudos/la_liga/girona.png",
  "celta_vigo": "/escudos/la_liga/celta_vigo.png",
  "getafe": "/escudos/la_liga/getafe.png",
  "rayo_vallecano": "/escudos/la_liga/rayo_vallecano.png",
  "osasuna": "/escudos/la_liga/osasuna.png",
  "espanyol": "/escudos/la_liga/espanyol.png",
  "las_palmas": "/escudos/la_liga/las_palmas.png",
  "alaves": "/escudos/la_liga/alaves.png",
  "leganes": "/escudos/la_liga/leganes.png",
  "valladolid": "/escudos/la_liga/valladolid.png",
  "mallorca": "/escudos/la_liga/mallorca.png",
  // Serie A Italia
  "inter": "/escudos/serie_a_ita/inter.png",
  "ac_milan": "/escudos/serie_a_ita/ac_milan.png",
  "juventus": "/escudos/serie_a_ita/juventus.png",
  "napoli": "/escudos/serie_a_ita/napoli.png",
  "roma": "/escudos/serie_a_ita/roma.png",
  "lazio": "/escudos/serie_a_ita/lazio.png",
  "atalanta": "/escudos/serie_a_ita/atalanta.png",
  "fiorentina": "/escudos/serie_a_ita/fiorentina.png",
  "bologna": "/escudos/serie_a_ita/bologna.png",
  "torino": "/escudos/serie_a_ita/torino.png",
  "udinese": "/escudos/serie_a_ita/udinese.png",
  "genoa": "/escudos/serie_a_ita/genoa.png",
  "verona": "/escudos/serie_a_ita/verona.png",
  "sassuolo": "/escudos/serie_a_ita/sassuolo.png",
  "empoli": "/escudos/serie_a_ita/empoli.png",
  "lecce": "/escudos/serie_a_ita/lecce.png",
  "cagliari": "/escudos/serie_a_ita/cagliari.png",
  "como": "/escudos/serie_a_ita/como.png",
  "parma": "/escudos/serie_a_ita/parma.png",
  "venezia": "/escudos/serie_a_ita/venezia.png",
  // Bundesliga
  "bayern_munich": "/escudos/bundesliga/bayern_munich.png",
  "borussia_dortmund": "/escudos/bundesliga/borussia_dortmund.png",
  "rb_leipzig": "/escudos/bundesliga/rb_leipzig.png",
  "bayer_leverkusen": "/escudos/bundesliga/bayer_leverkusen.png",
  "eintracht_frankfurt": "/escudos/bundesliga/eintracht_frankfurt.png",
  "freiburg": "/escudos/bundesliga/freiburg.png",
  "wolfsburg": "/escudos/bundesliga/wolfsburg.png",
  "borussia_monchengladbach": "/escudos/bundesliga/borussia_monchengladbach.png",
  "werder_bremen": "/escudos/bundesliga/werder_bremen.png",
  "hoffenheim": "/escudos/bundesliga/hoffenheim.png",
  "union_berlin": "/escudos/bundesliga/union_berlin.png",
  "mainz": "/escudos/bundesliga/mainz.png",
  "vfb_stuttgart": "/escudos/bundesliga/vfb_stuttgart.png",
  "fc_koln": "/escudos/bundesliga/fc_koln.png",
  "augsburg": "/escudos/bundesliga/augsburg.png",
  "bochum": "/escudos/bundesliga/bochum.png",
  "heidenheim": "/escudos/bundesliga/heidenheim.png",
  "darmstadt": "/escudos/bundesliga/darmstadt.png",
  // Ligue 1
  "psg": "/escudos/ligue_1/psg.png",
  "monaco": "/escudos/ligue_1/monaco.png",
  "marseille": "/escudos/ligue_1/marseille.png",
  "lille": "/escudos/ligue_1/lille.png",
  "lyon": "/escudos/ligue_1/lyon.png",
  "rennes": "/escudos/ligue_1/rennes.png",
  "nice": "/escudos/ligue_1/nice.png",
  "lens": "/escudos/ligue_1/lens.png",
  "reims": "/escudos/ligue_1/reims.png",
  "nantes": "/escudos/ligue_1/nantes.png",
  "strasbourg": "/escudos/ligue_1/strasbourg.png",
  "montpellier": "/escudos/ligue_1/montpellier.png",
  "angers": "/escudos/ligue_1/angers.png",
  "toulouse": "/escudos/ligue_1/toulouse.png",
  "brest": "/escudos/ligue_1/brest.png",
  "auxerre": "/escudos/ligue_1/auxerre.png",
  "le_havre": "/escudos/ligue_1/le_havre.png",
  "saint_etienne": "/escudos/ligue_1/saint_etienne.png",
}

export function getEscudoUrl(fileKey: string): string {
  // Primeiro verifica se tem escudo local
  if (localEscudoMap[fileKey]) {
    return localEscudoMap[fileKey]
  }
  // Fallback para o repositorio remoto
  const key = escudoMap[fileKey] || fileKey
  return `${ULTRAFOOT_RAW_URL}/teams/escudos/${key}.png`
}

export function getEscudoMiniUrl(fileKey: string): string {
  // Usa o mesmo escudo local em tamanho menor via CSS
  if (localEscudoMap[fileKey]) {
    return localEscudoMap[fileKey]
  }
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
    curto: "BOT",
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
    curto: "PAL",
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
    curto: "FLA",
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
    curto: "FOR",
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
    curto: "INT",
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
    curto: "SAO",
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
    curto: "COR",
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
    curto: "CRU",
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
    curto: "CAM",
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
    curto: "FLU",
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
    curto: "VAS",
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
    curto: "GRE",
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
    curto: "VIT",
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
    curto: "CAP",
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
    curto: "JUV",
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
    curto: "SAN",
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
    curto: "MIR",
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
    curto: "SPT",
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
    curto: "AME",
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
    curto: "CFC",
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
    curto: "PAY",
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
    curto: "CHA",
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
    curto: "VIL",
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
    curto: "AMA",
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
    curto: "OPE",
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
    curto: "NOV",
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
    curto: "BSP",
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
    curto: "BGT",
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

// Serie C - 20 times principais
export const serieCTeams: Team[] = [
  { nome: "Remo", curto: "REM", cidade: "Belem", estado: "PA", cor1: "#003399", cor2: "#ffffff", prestigio: 45, torcida: 920000, estadio_cap: 14932, saldo: 12000000, file_key: "remo_pa", estadio_nome: "Baenao", patrocinador: "Dafabet", escudo_url: getEscudoUrl("remo_pa"), divisao: "serie_c" },
  { nome: "ABC", curto: "ABC", cidade: "Natal", estado: "RN", cor1: "#ffffff", cor2: "#000000", prestigio: 35, torcida: 280000, estadio_cap: 31076, saldo: 5600000, file_key: "abc_rn", estadio_nome: "Frasqueirao", patrocinador: "Betano", escudo_url: getEscudoUrl("abc_rn"), divisao: "serie_c" },
  { nome: "Nautico", curto: "NAU", cidade: "Recife", estado: "PE", cor1: "#dd0000", cor2: "#ffffff", prestigio: 48, torcida: 750000, estadio_cap: 16500, saldo: 11000000, file_key: "nautico_pe", estadio_nome: "Aflitos", patrocinador: "Pixbet", escudo_url: getEscudoUrl("nautico_pe"), divisao: "serie_c" },
  { nome: "Santa Cruz", curto: "STC", cidade: "Recife", estado: "PE", cor1: "#dd0000", cor2: "#000000", prestigio: 42, torcida: 640000, estadio_cap: 60044, saldo: 8500000, file_key: "santacruz_pe", estadio_nome: "Arruda", patrocinador: "Betnacional", escudo_url: getEscudoUrl("santacruz_pe"), divisao: "serie_c" },
  { nome: "CSA", curto: "CSA", cidade: "Maceio", estado: "AL", cor1: "#003399", cor2: "#ffffff", prestigio: 38, torcida: 420000, estadio_cap: 19385, saldo: 6800000, file_key: "csa_al", estadio_nome: "Rei Pele", patrocinador: "Dafabet", escudo_url: getEscudoUrl("csa_al"), divisao: "serie_c" },
  { nome: "Sampaio Correa", curto: "SAM", cidade: "Sao Luis", estado: "MA", cor1: "#ffcc00", cor2: "#000000", prestigio: 32, torcida: 180000, estadio_cap: 11000, saldo: 4200000, file_key: "sampaio_ma", estadio_nome: "Castelao", patrocinador: "Betano", escudo_url: getEscudoUrl("sampaio_ma"), divisao: "serie_c" },
  { nome: "Figueirense", curto: "FIG", cidade: "Florianopolis", estado: "SC", cor1: "#000000", cor2: "#ffffff", prestigio: 44, torcida: 380000, estadio_cap: 19584, saldo: 9500000, file_key: "figueirense_sc", estadio_nome: "Orlando Scarpelli", patrocinador: "Pixbet", escudo_url: getEscudoUrl("figueirense_sc"), divisao: "serie_c" },
  { nome: "Londrina", curto: "LON", cidade: "Londrina", estado: "PR", cor1: "#003399", cor2: "#ffffff", prestigio: 36, torcida: 220000, estadio_cap: 20000, saldo: 5800000, file_key: "londrina_pr", estadio_nome: "Cafe", patrocinador: "Betnacional", escudo_url: getEscudoUrl("londrina_pr"), divisao: "serie_c" },
  { nome: "Tombense", curto: "TOM", cidade: "Tombos", estado: "MG", cor1: "#dd0000", cor2: "#000000", prestigio: 25, torcida: 45000, estadio_cap: 3000, saldo: 2200000, file_key: "tombense_mg", estadio_nome: "Soares de Azevedo", patrocinador: "Betano", escudo_url: getEscudoUrl("tombense_mg"), divisao: "serie_c" },
  { nome: "Botafogo-PB", curto: "BPB", cidade: "Joao Pessoa", estado: "PB", cor1: "#000000", cor2: "#ffffff", prestigio: 30, torcida: 150000, estadio_cap: 20300, saldo: 3500000, file_key: "botafogo_pb", estadio_nome: "Almeidao", patrocinador: "Dafabet", escudo_url: getEscudoUrl("botafogo_pb"), divisao: "serie_c" },
  { nome: "Aparecidense", curto: "APA", cidade: "Aparecida de Goiania", estado: "GO", cor1: "#003399", cor2: "#ffffff", prestigio: 20, torcida: 25000, estadio_cap: 4500, saldo: 1500000, file_key: "aparecidense_go", estadio_nome: "Annibal", patrocinador: "Pixbet", escudo_url: getEscudoUrl("aparecidense_go"), divisao: "serie_c" },
  { nome: "Ferroviario", curto: "FRV", cidade: "Fortaleza", estado: "CE", cor1: "#dd0000", cor2: "#ffffff", prestigio: 28, torcida: 95000, estadio_cap: 5508, saldo: 2800000, file_key: "ferroviario_ce", estadio_nome: "Elzir Cabral", patrocinador: "Betano", escudo_url: getEscudoUrl("ferroviario_ce"), divisao: "serie_c" },
  { nome: "Confianca", curto: "CON", cidade: "Aracaju", estado: "SE", cor1: "#003399", cor2: "#ffffff", prestigio: 26, torcida: 85000, estadio_cap: 3680, saldo: 2400000, file_key: "confianca_se", estadio_nome: "Batistao", patrocinador: "Dafabet", escudo_url: getEscudoUrl("confianca_se"), divisao: "serie_c" },
  { nome: "Volta Redonda", curto: "VRD", cidade: "Volta Redonda", estado: "RJ", cor1: "#ffcc00", cor2: "#000000", prestigio: 22, torcida: 35000, estadio_cap: 6000, saldo: 1800000, file_key: "voltaredonda_rj", estadio_nome: "Raulino de Oliveira", patrocinador: "Pixbet", escudo_url: getEscudoUrl("voltaredonda_rj"), divisao: "serie_c" },
  { nome: "Altos", curto: "ALT", cidade: "Altos", estado: "PI", cor1: "#dd0000", cor2: "#ffffff", prestigio: 18, torcida: 18000, estadio_cap: 4000, saldo: 1200000, file_key: "altos_pi", estadio_nome: "Feliciano Caceira", patrocinador: "Betano", escudo_url: getEscudoUrl("altos_pi"), divisao: "serie_c" },
  { nome: "Floresta", curto: "FLO", cidade: "Fortaleza", estado: "CE", cor1: "#006633", cor2: "#ffffff", prestigio: 16, torcida: 12000, estadio_cap: 5000, saldo: 900000, file_key: "floresta_ce", estadio_nome: "Ronaldao", patrocinador: "Dafabet", escudo_url: getEscudoUrl("floresta_ce"), divisao: "serie_c" },
  { nome: "Ypiranga-RS", curto: "YPI", cidade: "Erechim", estado: "RS", cor1: "#ffcc00", cor2: "#000000", prestigio: 23, torcida: 40000, estadio_cap: 8000, saldo: 2000000, file_key: "ypiranga_rs", estadio_nome: "Colosso da Lagoa", patrocinador: "Pixbet", escudo_url: getEscudoUrl("ypiranga_rs"), divisao: "serie_c" },
  { nome: "Sao Jose-RS", curto: "SJR", cidade: "Porto Alegre", estado: "RS", cor1: "#ff6600", cor2: "#ffffff", prestigio: 24, torcida: 55000, estadio_cap: 4500, saldo: 2100000, file_key: "saojose_rs", estadio_nome: "Passo d'Areia", patrocinador: "Betano", escudo_url: getEscudoUrl("saojose_rs"), divisao: "serie_c" },
  { nome: "Athletic Club", curto: "ATH", cidade: "Sao Joao del Rei", estado: "MG", cor1: "#000000", cor2: "#ffcc00", prestigio: 19, torcida: 22000, estadio_cap: 3000, saldo: 1400000, file_key: "athletic_mg", estadio_nome: "Joaquim Portugal", patrocinador: "Dafabet", escudo_url: getEscudoUrl("athletic_mg"), divisao: "serie_c" },
  { nome: "Caxias", curto: "CAX", cidade: "Caxias do Sul", estado: "RS", cor1: "#6b0020", cor2: "#ffffff", prestigio: 27, torcida: 75000, estadio_cap: 20000, saldo: 2600000, file_key: "caxias_rs", estadio_nome: "Centenario", patrocinador: "Pixbet", escudo_url: getEscudoUrl("caxias_rs"), divisao: "serie_c" },
]

// Serie D - Times regionais importantes
export const serieDTeams: Team[] = [
  { nome: "Brasiliense", curto: "BRS", cidade: "Brasilia", estado: "DF", cor1: "#ffcc00", cor2: "#006633", prestigio: 28, torcida: 95000, estadio_cap: 10000, saldo: 2800000, file_key: "brasiliense_df", estadio_nome: "Serejao", patrocinador: "Betano", escudo_url: getEscudoUrl("brasiliense_df"), divisao: "serie_d" },
  { nome: "River-PI", curto: "RIV", cidade: "Teresina", estado: "PI", cor1: "#dd0000", cor2: "#ffffff", prestigio: 22, torcida: 45000, estadio_cap: 12000, saldo: 1800000, file_key: "river_pi", estadio_nome: "Albertao", patrocinador: "Dafabet", escudo_url: getEscudoUrl("river_pi"), divisao: "serie_d" },
  { nome: "Inter de Limeira", curto: "ILM", cidade: "Limeira", estado: "SP", cor1: "#dd0000", cor2: "#ffffff", prestigio: 24, torcida: 65000, estadio_cap: 14000, saldo: 2200000, file_key: "inter_sp", estadio_nome: "Major Jose Levy Sobrinho", patrocinador: "Pixbet", escudo_url: getEscudoUrl("inter_sp"), divisao: "serie_d" },
  { nome: "Porto Velho", curto: "PVE", cidade: "Porto Velho", estado: "RO", cor1: "#003399", cor2: "#ffffff", prestigio: 15, torcida: 18000, estadio_cap: 9000, saldo: 800000, file_key: "portovelho_ro", estadio_nome: "Aluizio Ferreira", patrocinador: "Betano", escudo_url: getEscudoUrl("portovelho_ro"), divisao: "serie_d" },
  { nome: "Trem", curto: "TRM", cidade: "Macapa", estado: "AP", cor1: "#006633", cor2: "#ffffff", prestigio: 12, torcida: 12000, estadio_cap: 5000, saldo: 500000, file_key: "trem_ap", estadio_nome: "Milton de Souza Correa", patrocinador: "Dafabet", escudo_url: getEscudoUrl("trem_ap"), divisao: "serie_d" },
  { nome: "Sao Raimundo-AM", curto: "SRA", cidade: "Manaus", estado: "AM", cor1: "#003399", cor2: "#ffcc00", prestigio: 14, torcida: 15000, estadio_cap: 5000, saldo: 600000, file_key: "saoraimundo_am", estadio_nome: "Ismael Benigno", patrocinador: "Pixbet", escudo_url: getEscudoUrl("saoraimundo_am"), divisao: "serie_d" },
  { nome: "Real Noroeste", curto: "RNO", cidade: "Aguia Branca", estado: "ES", cor1: "#006633", cor2: "#ffffff", prestigio: 10, torcida: 8000, estadio_cap: 3000, saldo: 400000, file_key: "realnoroeste_es", estadio_nome: "Bento Goncalves", patrocinador: "Betano", escudo_url: getEscudoUrl("realnoroeste_es"), divisao: "serie_d" },
  { nome: "Nova Iguacu", curto: "NIG", cidade: "Nova Iguacu", estado: "RJ", cor1: "#ff6600", cor2: "#000000", prestigio: 18, torcida: 28000, estadio_cap: 4000, saldo: 1200000, file_key: "novaiguacu_rj", estadio_nome: "Laranjao", patrocinador: "Dafabet", escudo_url: getEscudoUrl("novaiguacu_rj"), divisao: "serie_d" },
  { nome: "Moto Club", curto: "MOT", cidade: "Sao Luis", estado: "MA", cor1: "#dd0000", cor2: "#ffffff", prestigio: 20, torcida: 35000, estadio_cap: 8000, saldo: 1500000, file_key: "motoclub_ma", estadio_nome: "Castelao", patrocinador: "Pixbet", escudo_url: getEscudoUrl("motoclub_ma"), divisao: "serie_d" },
  { nome: "Guarany de Sobral", curto: "GUA", cidade: "Sobral", estado: "CE", cor1: "#000000", cor2: "#ffffff", prestigio: 16, torcida: 20000, estadio_cap: 5000, saldo: 1000000, file_key: "guarany_ce", estadio_nome: "Junco", patrocinador: "Betano", escudo_url: getEscudoUrl("guarany_ce"), divisao: "serie_d" },
]

// Importar times internacionais
import { allInternationalTeams } from "./international-teams"

// Todos os times brasileiros
export const allBrazilianTeams = [...serieATeams, ...serieBTeams, ...serieCTeams, ...serieDTeams]

// Todos os times (incluindo internacionais)
export const allTeams = [...allBrazilianTeams, ...allInternationalTeams]

// Times por divisao
export function getTeamsByDivision(divisao: string): Team[] {
  return allTeams.filter(t => t.divisao === divisao)
}

// Função para buscar time por curto (busca tambem por divisao para evitar duplicatas)
export function getTeamByShort(curto: string, divisao?: string): Team | undefined {
  if (divisao) {
    return allTeams.find(t => t.curto === curto && t.divisao === divisao)
  }
  return allTeams.find(t => t.curto === curto)
}

// Função para buscar time por file_key
export function getTeamByFileKey(fileKey: string): Team | undefined {
  return allTeams.find(t => t.file_key === fileKey)
}

// Função para buscar time por nome
export function getTeamByName(nome: string): Team | undefined {
  return allTeams.find(t => t.nome.toLowerCase() === nome.toLowerCase())
}

// Uniformes dos times (baseado nas cores reais)
export function getTeamUniforms(team: Team): TeamUniforms {
  // Determinar padrão baseado no time
  const hasStripes = ["FLA", "BOT", "VAS", "CAM", "SAO", "GRE", "SAN", "BAH", "INT", "VIT", "SPT"].includes(team.curto)
  
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
