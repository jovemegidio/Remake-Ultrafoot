// Dados dos times brasileiros importados do repositório Ultrafoot
// https://github.com/jovemegidio/Ultrafoot

import { gameAssetUrl, isTauri } from "@/lib/game-asset"
import { normalizeCountry } from "@/lib/country-normalize"
import { applyTeamOverride, getTeamOverride } from "@/lib/team-overrides"
import { getCurrency } from "@/lib/currency"
import importedBF2026 from "@/data/seeds/imported-bf2026.json"
import { repairMojibake } from "@/lib/text-normalization"

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
  // Europa - demais ligas
  | "eredivisie"
  | "scottish_prem"
  | "super_lig"
  | "pro_league_bel"
  | "russian_prem"
  // Americas - Sul
  | "liga_argentina"
  | "primera_a_col"
  | "primera_div_chi"
  | "primera_div_ury"
  | "primera_a_ecu"
  // Asia
  | "k_league_1"
  | "chinese_super"
  // 2as divisões - Europa
  | "championship"
  | "la_liga_2"
  | "serie_b_ita"
  | "bundesliga_2"
  | "ligue_2"
  | "liga_portugal_2"
  | "eerste_divisie"
  | "challenger_pro"
  | "tff_1_lig"
  | "russian_first"
  // 2as divisões - Americas
  | "primera_b_arg"
  | "torneo_betplay"
  | "primera_b_chi"
  | "segunda_div_ury"
  // 2as divisões - Asia
  | "saudi_first_div"
  | "j2_league"
  | "k_league_2"
  | "china_league_one"
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

// Mapeamento de file_keys internacionais → nome do arquivo local em /public/camisas/
const localCamisaMap: Record<string, string> = {
  // Premier League
  "manchester_city": "machestercity_ing",
  "manchester_united": "utdman_ing",
  "arsenal": "arsenal",
  "liverpool": "liverpool_ing",
  "chelsea": "chelsea",
  "tottenham": "tottenhamhotspur_ing",
  "newcastle": "newcastle_ing",
  "aston_villa": "astonvilla_ing",
  "west_ham": "westham_eng",
  "brighton": "brighton_ing",
  "everton": "everton_ing",
  "crystal_palace": "crystalpalace_ing",
  "bournemouth": "bournemouth_ing",
  "wolves": "wolverhampton_ing",
  "fulham": "fulham",
  "brentford": "brentford_ing",
  "nottingham_forest": "nottinghamforest_ing",
  "leicester": "leicestercity_ing",
  "southampton": "southampton_eng",
  "ipswich": "ipswichtown_ing",
  // La Liga
  "real_madrid": "realmadrid_esp",
  "barcelona": "barcelona_esp",
  "atletico_madrid": "atleticomadrid_esp",
  "sevilla": "sevilla_esp",
  "villarreal": "villareal_esp",
  "real_sociedad": "realsociedad_esp",
  "athletic_bilbao": "atleticobilbao_esp",
  "valencia": "valencia_esp",
  "real_betis": "betis_esp",
  "girona": "girona_esp",
  "celta_vigo": "celtadevigo_esp",
  "getafe": "getafe_esp",
  "rayo_vallecano": "rayovallecano_esp",
  "osasuna": "osasuna_esp",
  "espanyol": "espanyol_esp",
  "las_palmas": "laspalmas_esp",
  "alaves": "alaves_esp",
  "leganes": "leganes_esp",
  "valladolid": "valladolid_esp",
  "mallorca": "mallorca_esp",
  // Serie A Italia
  "inter": "inter_it",
  "inter_milan": "inter_it",
  "ac_milan": "milan_it",
  "juventus": "juventus_it",
  "napoli": "napoli_it",
  "roma": "roma_it",
  "lazio": "lazio_it",
  "atalanta": "atalanta_it",
  "fiorentina": "fiorentina_ita",
  "bologna": "bologna_it",
  "torino": "torino_it",
  "udinese": "udinese_it",
  "genoa": "genoa_it",
  "verona": "verona_it",
  "hellas_verona": "verona_it",
  "sassuolo": "sassuolo_it",
  "empoli": "empoli_it",
  "lecce": "lecce_ita",
  "cagliari": "cagliari_it",
  "como": "como_it",
  "parma": "parma_ita",
  "venezia": "venezia_ita",
  "monza": "monza_ita",
  // Bundesliga
  "bayern_munich": "bayern_ale",
  "borussia_dortmund": "borussia_ale",
  "rb_leipzig": "leipzig_ale",
  "bayer_leverkusen": "bayerleverkusen_ale",
  "eintracht_frankfurt": "Frankfurt_ale",
  "freiburg": "freiburg_ale",
  "wolfsburg": "wolfsburg_ale",
  "borussia_mgladbach": "monchengladbach_ale",
  "borussia_monchengladbach": "monchengladbach_ale",
  "werder_bremen": "werderbremen_ale",
  "union_berlin": "unionberlin_ale",
  "mainz": "fsvmainz_ale",
  "fc_koln": "fckoln_ale",
  "augsburg": "augsburg_ale",
  "bochum": "bochum_ale",
  "heidenheim": "heidenheim_ale",
  "darmstadt": "darmstadt98_ale",
  "st_pauli": "stpauli_ale",
  "holstein_kiel": "holsteinkiel_ale",
  // Ligue 1
  "psg": "paris_fra",
  "monaco": "monaco_fr",
  "marseille": "olympiquemarseile_fra",
  "lille": "lille_fra",
  "lyon": "lyon",
  "rennes": "rennes_fr",
  "nice": "nice_fra",
  "lens": "lens_fr",
  "reims": "reims_fr",
  "nantes": "nantes_fr",
  "strasbourg": "strasbourg_fra",
  "montpellier": "montpellier_fra",
  "angers": "angers_fr",
  "toulouse": "toulouse_fr",
  "brest": "brest_fr",
  "auxerre": "auxerre_fr",
  "le_havre": "lehavre_fr",
  "lorient": "lorient_fr",
  "clermont": "clermont_fr",
  // Saudi Pro League
  "al_hilal": "al_hilal",
  "al_nassr": "alnassr_ara",
  "al_ittihad": "alittihad_ara",
  "al_ahli": "al_ahli_ara",
  "al_ahli_saudi": "al_ahli_ara",
  "al_shabab": "al_shabab_ara",
  "al_taawoun": "al_taawon_ara",
  "al_fateh": "al_fateh_ara",
  "al_fayha": "al_fayha_ara",
  "al_ettifaq": "ettifaq_ara",
  "damac": "damacfc_ara",
  "al_riyadh": "alriyadh_ara",
  "al_raed": "al_raed_ara",
  "al_hazm": "al_hazem_ara",
  "al_orobah": "alorobah_ara",
  "al_wehda": "al_wehda_ara",
  "al_qadisiyah": "al_qadisiya_ara",
  // MLS
  "inter_miami": "intermiami433_eua",
  "la_galaxy": "lagalaxy433_eua",
  "lafc": "lafc433_eua",
  "atlanta_united": "atlantaunited_eua",
  "seattle_sounders": "seattlesounders433_eua",
  "new_york_city": "newyorkcity433_eua",
  "nycfc": "newyorkcity433_eua",
  "toronto_fc": "toronto433_eua",
  "cf_montreal": "montreal433_eua",
  "austin_fc": "austin_usa",
  "columbus_crew": "columbuscrew_eua",
  "fc_cincinnati": "cincinnati433_eua",
  "nashville_sc": "nashville433_eua",
  "orlando_city": "orlandocity433_eua",
  "portland_timbers": "portlandtimbers_eua",
  "minnesota_united": "minnesota433_eua",
  "charlotte_fc": "charlotte433_eua",
  "dc_united": "dcunited433_eua",
  "houston_dynamo": "houstondynamo433_eua",
  // Liga MX
  "club_america": "america_mex",
  "chivas": "dep_guadalajara_mex",
  "cruz_azul": "cruzazul_mex",
  "tigres": "tigres_mex",
  "monterrey": "monterrey_mex",
  "pumas": "pumasunam_mex",
  "leon": "leon_mex",
  "santos_laguna": "santos_mex",
  "toluca": "toluca_mex",
  "pachuca": "pachuca_mex",
  "tijuana": "tijuana_mex",
  // Primeira Liga Portugal
  "benfica": "benfica_por",
  "porto": "porto",
  "sporting": "sporting_por",
  "braga": "sportingbraga_por",
  "vitoria_guimaraes": "vitoriaguimaraes_por",
  "boavista": "boavista_por",
  "santa_clara": "santaclara_por",
  "famalicao": "famalicao_por",
  "rio_ave": "rioave_por",
  "moreirense": "moreirense_por",
  "gil_vicente": "gilvicente_por",
  "arouca": "arouca_por",
  "estoril": "estoril_por",
  "nacional": "nacional_por",
  "estrela_amadora": "estrelaamadora_por",
  "farense": "farense_por",
  "avs": "avs_por",
}

// Importar funcoes de escudo do arquivo separado (evita dependencia circular)
import { getEscudoUrl, getEscudoMiniUrl, getRemoteEscudoUrl } from "./escudos-map"
import importedKits from "@/data/seeds/kits-manifest.json"
export { getEscudoUrl, getEscudoMiniUrl, getRemoteEscudoUrl }

const importedKitMap = importedKits as Record<string, { home?: string; away?: string; third?: string; club?: string; needsReview?: boolean }>
const importedKitKeys = Object.keys(importedKitMap)
const normalizeKitKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase()

// O mapeamento recebido usa nomes editoriais ("Athletic_Club_Bilbao"), enquanto o
// banco interno usa chaves curtas ("athletic_bilbao"). Comparar apenas prefixo/sufixo
// fazia o arquivo existir no instalador, mas nunca ser selecionado pela interface.
const KIT_STOP_WORDS = new Set([
  "club", "clube", "fc", "cf", "ac", "afc", "sc", "ec", "fk", "cd", "ud",
  "ca", "gd", "us", "as", "ss", "aa", "cs", "kv", "kvc", "vfb", "vfl", "vsc",
  "de", "da", "do", "dos", "das", "the", "football", "futbol", "calcio",
  "bra", "esp", "eng", "ita", "ger", "fra", "por", "ned", "bel", "tur",
])
const canonicalKitKey = (value: string) => normalizeKitKey(value)
  .split("_")
  .filter(token => token && !KIT_STOP_WORDS.has(token))
  .join("_")
const importedKitCanonical = new Map<string, (typeof importedKitMap)[string] | null>()
for (const key of importedKitKeys) {
  const canonical = canonicalKitKey(key)
  if (!canonical) continue
  // Chaves ambiguas nao sao escolhidas automaticamente.
  importedKitCanonical.set(canonical, importedKitCanonical.has(canonical) ? null : importedKitMap[key])
}
const approvedImportedKits = importedKitKeys
  .filter(key => !importedKitMap[key].needsReview)
  .map(key => ({ key, canonical: canonicalKitKey(key), kit: importedKitMap[key] }))

function findConservativeFuzzyKit(candidates: string[]): (typeof importedKitMap)[string] | undefined {
  let best: { score: number; kit: (typeof importedKitMap)[string] } | null = null
  let second = 0
  for (const candidate of candidates) {
    const a = new Set(canonicalKitKey(candidate).split("_").filter(Boolean))
    if (a.size < 2) continue // nome curto demais gera homonimos perigosos
    for (const entry of approvedImportedKits) {
      const b = new Set(entry.canonical.split("_").filter(Boolean))
      const intersection = [...a].filter(token => b.has(token)).length
      if (intersection === 0) continue
      const union = new Set([...a, ...b]).size
      const score = intersection / Math.max(1, union)
      if (!best || score > best.score) { second = best?.score ?? second; best = { score, kit: entry.kit } }
      else if (score > second) second = score
    }
  }
  // So aceita equivalencia forte e sem outro candidato proximo.
  return best && best.score >= 0.72 && best.score - second >= 0.12 ? best.kit : undefined
}

/** Caminho do pacote legado instalado, separado para auditoria e testes offline. */
export function getLocalCamisaPath(fileKey: string, variant: "home" | "away" | "third" = "home"): string {
  // O pacote recebido do Manchester United possui somente a arte principal.
  const legacyVariant = fileKey === "manchester_united" && variant !== "home" ? "home" : variant
  const folder = legacyVariant === "home" ? "camisas" : legacyVariant === "away" ? "camisas2" : "camisas3"
  const key = localCamisaMap[fileKey] ?? (escudoMap[fileKey] || fileKey)
  return `/${folder}/${key}.png`
}

export function getCamisaUrl(fileKey: string, variant: "home" | "away" | "third" = "home", teamName = ""): string {
  // Uniforme importado pelo usuario no editor de clubes tem prioridade — igual ao
  // escudo customizado. Leitura sincrona do cache do persistent-store; se o clube
  // tiver um kit importado, ele e usado no jogo inteiro no lugar do padrao.
  const custom = getTeamOverride(fileKey)?.kits?.[variant]?.imageUrl
  if (custom) return custom

  const candidates = [normalizeKitKey(fileKey), normalizeKitKey(teamName), normalizeKitKey(localCamisaMap[fileKey] ?? ""), normalizeKitKey(escudoMap[fileKey] ?? "")].filter(Boolean)
  let imported = candidates.map(key => importedKitMap[key]).find(Boolean)
  if (!imported) {
    imported = candidates
      .map(key => importedKitCanonical.get(canonicalKitKey(key)))
      .find((value): value is (typeof importedKitMap)[string] => Boolean(value))
  }
  if (!imported) {
    const suffix = candidates[0]
    const key = importedKitKeys.find(name => name.endsWith(`_${suffix}`) || suffix.endsWith(`_${name}`))
    if (key) imported = importedKitMap[key]
  }
  if (!imported) imported = findConservativeFuzzyKit(candidates)
  const importedFile = imported?.[variant]
  if (importedFile) return gameAssetUrl(`/kits-imported/${importedFile}`)

  // No app desktop (Tauri) as camisas sao empacotadas localmente.
  // Na web nao existe pasta public/camisas, entao usamos o repositorio remoto
  // (padrao /teams/camisas/{file_key}.png), igual aos escudos, evitando 404.
  const localPath = getLocalCamisaPath(fileKey, variant)
  if (isTauri()) return gameAssetUrl(localPath)
  const [folder, filename] = localPath.replace(/^\//, "").split("/")
  return `${ULTRAFOOT_RAW_URL}/teams/${folder}/${filename}`
}

export function getRemoteCamisaUrl(fileKey: string, variant: "home" | "away" | "third" = "home"): string {
  const key = escudoMap[fileKey] || fileKey
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
    saldo: 185700000,
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
    saldo: 250000000,
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
    saldo: 250000000,
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
    saldo: 4000000,
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
    saldo: 171800000,
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
    saldo: 250000000,
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
    saldo: 10000000,
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
    saldo: 87700000,
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
    saldo: 10000000,
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
    saldo: 10000000,
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
    saldo: 150000000,
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
    saldo: 10000000,
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
    saldo: 208900000,
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
    saldo: 10000000,
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
    saldo: 100800000,
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
    saldo: 7200000,
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
    saldo: 21500000,
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
    saldo: 78500000,
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
    saldo: 4000000,
    file_key: "sport",
    estadio_nome: "Ilha do Retiro",
    patrocinador: "Betano",
    escudo_url: getEscudoUrl("sport"),
    divisao: "serie_a"
  },
  {
    nome: "Ceará",
    curto: "CEA",
    cidade: "Fortaleza",
    estado: "CE",
    cor1: "#000000",
    cor2: "#ffffff",
    prestigio: 74,
    torcida: 7400000,
    estadio_cap: 63904,
    saldo: 15600000,
    file_key: "ceara_bra",
    estadio_nome: "Arena Castelao",
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
    saldo: 8000000,
    file_key: "americamg_bra",
    estadio_nome: "Independencia",
    patrocinador: "Betano",
    escudo_url: getEscudoUrl("americamg_bra"),
    divisao: "serie_b"
  },
  {
    nome: "Goiás",
    curto: "GOI",
    cidade: "Goiania",
    estado: "GO",
    cor1: "#008040",
    cor2: "#ffffff",
    prestigio: 63,
    torcida: 1890000,
    estadio_cap: 14450,
    saldo: 8000000,
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
    saldo: 25400000,
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
    saldo: 8000000,
    file_key: "crb_bra",
    estadio_nome: "Rei Pele",
    patrocinador: "Vai de Bet",
    escudo_url: getEscudoUrl("crb_bra"),
    divisao: "serie_b"
  },
  {
    nome: "Avaí",
    curto: "AVA",
    cidade: "Florianopolis",
    estado: "SC",
    cor1: "#0155a6",
    cor2: "#ffffff",
    prestigio: 59,
    torcida: 1770000,
    estadio_cap: 17800,
    saldo: 8000000,
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
    saldo: 2400000,
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
    saldo: 25400000,
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
    saldo: 8000000,
    file_key: "vilago",
    estadio_nome: "OBA",
    patrocinador: "Pixbet",
    escudo_url: getEscudoUrl("vilago"),
    divisao: "serie_b"
  },
  {
    nome: "Amazonas",
    curto: "AMA",
    cidade: "Manaus",
    estado: "AM",
    cor1: "#ffcc00",
    cor2: "#000000",
    prestigio: 20,
    torcida: 60000,
    estadio_cap: 10000,
    saldo: 2400000,
    file_key: "amazonas_am",
    estadio_nome: "Arena da Amazonia",
    patrocinador: "Betano",
    escudo_url: getEscudoUrl("amazonas_am"),
    divisao: "serie_b"
  },
  {
    nome: "Operário-PR",
    curto: "OPE",
    cidade: "Ponta Grossa",
    estado: "PR",
    cor1: "#ffffff",
    cor2: "#000000",
    prestigio: 41,
    torcida: 410000,
    estadio_cap: 10632,
    saldo: 8000000,
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
    saldo: 8000000,
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
    saldo: 188000000,
    file_key: "bragantino_bra",
    estadio_nome: "Nabi Abi Chedid",
    patrocinador: "Red Bull",
    escudo_url: getEscudoUrl("bragantino_bra"),
    divisao: "serie_b"
  },
  {
    nome: "São Bernardo",
    curto: "SBC",
    cidade: "Sao Bernardo do Campo",
    estado: "SP",
    cor1: "#1a3a6c",
    cor2: "#ffffff",
    prestigio: 32,
    torcida: 120000,
    estadio_cap: 15000,
    saldo: 8600000,
    file_key: "saobernardo_sp",
    estadio_nome: "Primeiro de Maio",
    patrocinador: "Pixbet",
    escudo_url: getEscudoUrl("saobernardo_sp"),
    divisao: "serie_b"
  },
  {
    nome: "Guarani",
    curto: "GRN",
    cidade: "Campinas",
    estado: "SP",
    cor1: "#006400",
    cor2: "#ffffff",
    prestigio: 55,
    torcida: 1300000,
    estadio_cap: 23000,
    saldo: 2700000,
    file_key: "guaranisp_bra",
    estadio_nome: "Brinco de Ouro",
    patrocinador: "Betano",
    escudo_url: getEscudoUrl("guaranisp_bra"),
    divisao: "serie_b"
  },
  {
    nome: "Ponte Preta",
    curto: "PON",
    cidade: "Campinas",
    estado: "SP",
    cor1: "#000000",
    cor2: "#ffffff",
    prestigio: 57,
    torcida: 1600000,
    estadio_cap: 20000,
    saldo: 8600000,
    file_key: "pontepreta_bra",
    estadio_nome: "Moises Lucarelli",
    patrocinador: "Pixbet",
    escudo_url: getEscudoUrl("pontepreta_bra"),
    divisao: "serie_b"
  },
  {
    nome: "Criciúma",
    curto: "CRI",
    cidade: "Criciuma",
    estado: "SC",
    cor1: "#f5c400",
    cor2: "#000000",
    prestigio: 58,
    torcida: 1200000,
    estadio_cap: 19960,
    saldo: 8000000,
    file_key: "criciuma_bra",
    estadio_nome: "Heriberto Hulse",
    patrocinador: "Esportes da Sorte",
    escudo_url: getEscudoUrl("criciuma_bra"),
    divisao: "serie_b"
  },
  {
    nome: "Cuiabá",
    curto: "CUI",
    cidade: "Cuiaba",
    estado: "MT",
    cor1: "#f7c000",
    cor2: "#006600",
    prestigio: 62,
    torcida: 1800000,
    estadio_cap: 43468,
    saldo: 8000000,
    file_key: "cuiaba_bra",
    estadio_nome: "Arena Pantanal",
    patrocinador: "Superbet",
    escudo_url: getEscudoUrl("cuiaba_bra"),
    divisao: "serie_b"
  },
  {
    nome: "Atletico-GO",
    curto: "ACG",
    cidade: "Goiania",
    estado: "GO",
    cor1: "#dd0000",
    cor2: "#000000",
    prestigio: 65,
    torcida: 2000000,
    estadio_cap: 11000,
    saldo: 8000000,
    file_key: "atleticogo_bra",
    estadio_nome: "Antonio Accioly",
    patrocinador: "Betnacional",
    escudo_url: getEscudoUrl("atleticogo_bra"),
    divisao: "serie_b"
  },
  {
    nome: "Agua Santa",
    curto: "AGS",
    cidade: "Diadema",
    estado: "SP",
    cor1: "#003399",
    cor2: "#ffffff",
    prestigio: 45,
    torcida: 300000,
    estadio_cap: 8000,
    saldo: 1000000,
    file_key: "aguasanta_sp",
    estadio_nome: "Inamar",
    patrocinador: "Pixbet",
    escudo_url: getEscudoUrl("aguasanta_sp"),
    divisao: "serie_b"
  }
]

// Serie C - 20 times principais
export const serieCTeams: Team[] = [
  { nome: "Remo", curto: "REM", cidade: "Belem", estado: "PA", cor1: "#003399", cor2: "#ffffff", prestigio: 45, torcida: 920000, estadio_cap: 14932, saldo: 25400000, file_key: "remo_pa", estadio_nome: "Baenao", patrocinador: "Dafabet", escudo_url: getEscudoUrl("remo_pa"), divisao: "serie_c" },
  { nome: "ABC", curto: "ABC", cidade: "Natal", estado: "RN", cor1: "#ffffff", cor2: "#000000", prestigio: 35, torcida: 280000, estadio_cap: 31076, saldo: 1000000, file_key: "abc_rn", estadio_nome: "Frasqueirao", patrocinador: "Betano", escudo_url: getEscudoUrl("abc_rn"), divisao: "serie_c" },
  { nome: "Náutico", curto: "NAU", cidade: "Recife", estado: "PE", cor1: "#dd0000", cor2: "#ffffff", prestigio: 48, torcida: 750000, estadio_cap: 16500, saldo: 8600000, file_key: "nautico_pe", estadio_nome: "Aflitos", patrocinador: "Pixbet", escudo_url: getEscudoUrl("nautico_pe"), divisao: "serie_c" },
  { nome: "Santa Cruz", curto: "STC", cidade: "Recife", estado: "PE", cor1: "#dd0000", cor2: "#000000", prestigio: 42, torcida: 640000, estadio_cap: 60044, saldo: 3000000, file_key: "santacruz_pe", estadio_nome: "Arruda", patrocinador: "Betnacional", escudo_url: getEscudoUrl("santacruz_pe"), divisao: "serie_c" },
  { nome: "CSA", curto: "CSA", cidade: "Maceio", estado: "AL", cor1: "#003399", cor2: "#ffffff", prestigio: 38, torcida: 420000, estadio_cap: 19385, saldo: 1000000, file_key: "csa_al", estadio_nome: "Rei Pele", patrocinador: "Dafabet", escudo_url: getEscudoUrl("csa_al"), divisao: "serie_c" },
  { nome: "Sampaio Correa", curto: "SAM", cidade: "Sao Luis", estado: "MA", cor1: "#ffcc00", cor2: "#000000", prestigio: 32, torcida: 180000, estadio_cap: 11000, saldo: 1000000, file_key: "sampaio_ma", estadio_nome: "Castelao", patrocinador: "Betano", escudo_url: getEscudoUrl("sampaio_ma"), divisao: "serie_c" },
  { nome: "Figueirense", curto: "FIG", cidade: "Florianopolis", estado: "SC", cor1: "#000000", cor2: "#ffffff", prestigio: 44, torcida: 380000, estadio_cap: 19584, saldo: 2700000, file_key: "figueirense_sc", estadio_nome: "Orlando Scarpelli", patrocinador: "Pixbet", escudo_url: getEscudoUrl("figueirense_sc"), divisao: "serie_c" },
  { nome: "Londrina", curto: "LON", cidade: "Londrina", estado: "PR", cor1: "#003399", cor2: "#ffffff", prestigio: 36, torcida: 220000, estadio_cap: 20000, saldo: 8600000, file_key: "londrina_pr", estadio_nome: "Cafe", patrocinador: "Betnacional", escudo_url: getEscudoUrl("londrina_pr"), divisao: "serie_c" },
  { nome: "Tombense", curto: "TOM", cidade: "Tombos", estado: "MG", cor1: "#dd0000", cor2: "#000000", prestigio: 25, torcida: 45000, estadio_cap: 3000, saldo: 1000000, file_key: "tombense_mg", estadio_nome: "Soares de Azevedo", patrocinador: "Betano", escudo_url: getEscudoUrl("tombense_mg"), divisao: "serie_c" },
  { nome: "Botafogo-PB", curto: "BPB", cidade: "Joao Pessoa", estado: "PB", cor1: "#000000", cor2: "#ffffff", prestigio: 30, torcida: 150000, estadio_cap: 20300, saldo: 2700000, file_key: "botafogo_pb", estadio_nome: "Almeidao", patrocinador: "Dafabet", escudo_url: getEscudoUrl("botafogo_pb"), divisao: "serie_c" },
  { nome: "Aparecidense", curto: "APA", cidade: "Aparecida de Goiania", estado: "GO", cor1: "#003399", cor2: "#ffffff", prestigio: 20, torcida: 25000, estadio_cap: 4500, saldo: 1000000, file_key: "aparecidense_go", estadio_nome: "Annibal", patrocinador: "Pixbet", escudo_url: getEscudoUrl("aparecidense_go"), divisao: "serie_c" },
  { nome: "Ferroviario", curto: "FRV", cidade: "Fortaleza", estado: "CE", cor1: "#dd0000", cor2: "#ffffff", prestigio: 28, torcida: 95000, estadio_cap: 5508, saldo: 1000000, file_key: "ferroviario_ce", estadio_nome: "Elzir Cabral", patrocinador: "Betano", escudo_url: getEscudoUrl("ferroviario_ce"), divisao: "serie_c" },
  { nome: "Confiança", curto: "CON", cidade: "Aracaju", estado: "SE", cor1: "#003399", cor2: "#ffffff", prestigio: 26, torcida: 85000, estadio_cap: 3680, saldo: 2700000, file_key: "confianca_se", estadio_nome: "Batistao", patrocinador: "Dafabet", escudo_url: getEscudoUrl("confianca_se"), divisao: "serie_c" },
  { nome: "Volta Redonda", curto: "VRD", cidade: "Volta Redonda", estado: "RJ", cor1: "#ffcc00", cor2: "#000000", prestigio: 22, torcida: 35000, estadio_cap: 6000, saldo: 2400000, file_key: "voltaredonda_rj", estadio_nome: "Raulino de Oliveira", patrocinador: "Pixbet", escudo_url: getEscudoUrl("voltaredonda_rj"), divisao: "serie_c" },
  { nome: "Altos", curto: "ALT", cidade: "Altos", estado: "PI", cor1: "#dd0000", cor2: "#ffffff", prestigio: 18, torcida: 18000, estadio_cap: 4000, saldo: 1000000, file_key: "altos_pi", estadio_nome: "Feliciano Caceira", patrocinador: "Betano", escudo_url: getEscudoUrl("altos_pi"), divisao: "serie_c" },
  { nome: "Floresta", curto: "FLO", cidade: "Fortaleza", estado: "CE", cor1: "#006633", cor2: "#ffffff", prestigio: 16, torcida: 12000, estadio_cap: 5000, saldo: 2700000, file_key: "floresta_ce", estadio_nome: "Ronaldao", patrocinador: "Dafabet", escudo_url: getEscudoUrl("floresta_ce"), divisao: "serie_c" },
  { nome: "Ypiranga-RS", curto: "YPI", cidade: "Erechim", estado: "RS", cor1: "#ffcc00", cor2: "#000000", prestigio: 23, torcida: 40000, estadio_cap: 8000, saldo: 2700000, file_key: "ypiranga_rs", estadio_nome: "Colosso da Lagoa", patrocinador: "Pixbet", escudo_url: getEscudoUrl("ypiranga_rs"), divisao: "serie_c" },
  { nome: "Sao Jose-RS", curto: "SJR", cidade: "Porto Alegre", estado: "RS", cor1: "#ff6600", cor2: "#ffffff", prestigio: 24, torcida: 55000, estadio_cap: 4500, saldo: 1000000, file_key: "saojose_rs", estadio_nome: "Passo d'Areia", patrocinador: "Betano", escudo_url: getEscudoUrl("saojose_rs"), divisao: "serie_c" },
  { nome: "Athletic Club", curto: "ATH", cidade: "Sao Joao del Rei", estado: "MG", cor1: "#000000", cor2: "#ffcc00", prestigio: 19, torcida: 22000, estadio_cap: 3000, saldo: 8000000, file_key: "athletic_mg", estadio_nome: "Joaquim Portugal", patrocinador: "Dafabet", escudo_url: getEscudoUrl("athletic_mg"), divisao: "serie_c" },
  { nome: "Caxias", curto: "CAX", cidade: "Caxias do Sul", estado: "RS", cor1: "#6b0020", cor2: "#ffffff", prestigio: 27, torcida: 75000, estadio_cap: 20000, saldo: 2700000, file_key: "caxias_rs", estadio_nome: "Centenario", patrocinador: "Pixbet", escudo_url: getEscudoUrl("caxias_rs"), divisao: "serie_c" },
]

// Serie D - Times regionais importantes
export const serieDTeams: Team[] = [
  { nome: "Brasiliense", curto: "BRS", cidade: "Brasilia", estado: "DF", cor1: "#ffcc00", cor2: "#006633", prestigio: 28, torcida: 95000, estadio_cap: 10000, saldo: 1000000, file_key: "brasiliense_df", estadio_nome: "Serejao", patrocinador: "Betano", escudo_url: getEscudoUrl("brasiliense_df"), divisao: "serie_d" },
  { nome: "River-PI", curto: "RIV", cidade: "Teresina", estado: "PI", cor1: "#dd0000", cor2: "#ffffff", prestigio: 22, torcida: 45000, estadio_cap: 12000, saldo: 1800000, file_key: "river_pi", estadio_nome: "Albertao", patrocinador: "Dafabet", escudo_url: getEscudoUrl("river_pi"), divisao: "serie_d" },
  { nome: "Inter de Limeira", curto: "ILM", cidade: "Limeira", estado: "SP", cor1: "#dd0000", cor2: "#ffffff", prestigio: 24, torcida: 65000, estadio_cap: 14000, saldo: 3000000, file_key: "inter_sp", estadio_nome: "Major Jose Levy Sobrinho", patrocinador: "Pixbet", escudo_url: getEscudoUrl("inter_sp"), divisao: "serie_d" },
  { nome: "Porto Velho", curto: "PVE", cidade: "Porto Velho", estado: "RO", cor1: "#003399", cor2: "#ffffff", prestigio: 15, torcida: 18000, estadio_cap: 9000, saldo: 1000000, file_key: "portovelho_ro", estadio_nome: "Aluizio Ferreira", patrocinador: "Betano", escudo_url: getEscudoUrl("portovelho_ro"), divisao: "serie_d" },
  { nome: "Trem", curto: "TRM", cidade: "Macapa", estado: "AP", cor1: "#006633", cor2: "#ffffff", prestigio: 12, torcida: 12000, estadio_cap: 5000, saldo: 1000000, file_key: "trem_ap", estadio_nome: "Milton de Souza Correa", patrocinador: "Dafabet", escudo_url: getEscudoUrl("trem_ap"), divisao: "serie_d" },
  { nome: "Sao Raimundo-AM", curto: "SRA", cidade: "Manaus", estado: "AM", cor1: "#003399", cor2: "#ffcc00", prestigio: 14, torcida: 15000, estadio_cap: 5000, saldo: 600000, file_key: "saoraimundo_am", estadio_nome: "Ismael Benigno", patrocinador: "Pixbet", escudo_url: getEscudoUrl("saoraimundo_am"), divisao: "serie_d" },
  { nome: "Real Noroeste", curto: "RNO", cidade: "Aguia Branca", estado: "ES", cor1: "#006633", cor2: "#ffffff", prestigio: 10, torcida: 8000, estadio_cap: 3000, saldo: 1000000, file_key: "realnoroeste_es", estadio_nome: "Bento Goncalves", patrocinador: "Betano", escudo_url: getEscudoUrl("realnoroeste_es"), divisao: "serie_d" },
  { nome: "Nova Iguacu", curto: "NIG", cidade: "Nova Iguacu", estado: "RJ", cor1: "#ff6600", cor2: "#000000", prestigio: 18, torcida: 28000, estadio_cap: 4000, saldo: 1000000, file_key: "novaiguacu_rj", estadio_nome: "Laranjao", patrocinador: "Dafabet", escudo_url: getEscudoUrl("novaiguacu_rj"), divisao: "serie_d" },
  { nome: "Moto Club", curto: "MOT", cidade: "Sao Luis", estado: "MA", cor1: "#dd0000", cor2: "#ffffff", prestigio: 20, torcida: 35000, estadio_cap: 8000, saldo: 1000000, file_key: "motoclub_ma", estadio_nome: "Castelao", patrocinador: "Pixbet", escudo_url: getEscudoUrl("motoclub_ma"), divisao: "serie_d" },
  { nome: "Guarany de Sobral", curto: "GUA", cidade: "Sobral", estado: "CE", cor1: "#000000", cor2: "#ffffff", prestigio: 16, torcida: 20000, estadio_cap: 5000, saldo: 1000000, file_key: "guarany_ce", estadio_nome: "Junco", patrocinador: "Betano", escudo_url: getEscudoUrl("guarany_ce"), divisao: "serie_d" },

  // ── Clubes de estadual (RJ) — completam o Campeonato Carioca (12 clubes) ─────
  { nome: "Bangu", curto: "BGU", cidade: "Rio de Janeiro", estado: "RJ", cor1: "#dd0000", cor2: "#ffffff", prestigio: 18, torcida: 40000, estadio_cap: 8000, saldo: 1200000, file_key: "bangu", estadio_nome: "Moca Bonita", patrocinador: "Pixbet", escudo_url: getEscudoUrl("bangu"), divisao: "serie_d" },
  { nome: "Madureira", curto: "MAD", cidade: "Rio de Janeiro", estado: "RJ", cor1: "#009933", cor2: "#ffcc00", prestigio: 16, torcida: 25000, estadio_cap: 5000, saldo: 1000000, file_key: "madureira_bra", estadio_nome: "Conselheiro Galvao", patrocinador: "Betano", escudo_url: getEscudoUrl("madureira_bra"), divisao: "serie_d" },
  { nome: "Portuguesa-RJ", curto: "PRJ", cidade: "Rio de Janeiro", estado: "RJ", cor1: "#dd0000", cor2: "#006633", prestigio: 15, torcida: 18000, estadio_cap: 5000, saldo: 1000000, file_key: "portuguesarj_bra", estadio_nome: "Luso-Brasileiro", patrocinador: "Dafabet", escudo_url: getEscudoUrl("portuguesarj_bra"), divisao: "serie_d" },
  { nome: "Boavista", curto: "BOA", cidade: "Saquarema", estado: "RJ", cor1: "#003399", cor2: "#ffffff", prestigio: 15, torcida: 12000, estadio_cap: 5000, saldo: 850000, file_key: "boavista_bra", estadio_nome: "Elcyr Resende", patrocinador: "Pixbet", escudo_url: getEscudoUrl("boavista_bra"), divisao: "serie_d" },
  { nome: "Marica", curto: "MRC", cidade: "Marica", estado: "RJ", cor1: "#0066cc", cor2: "#ffffff", prestigio: 14, torcida: 8000, estadio_cap: 3000, saldo: 1000000, file_key: "marica_rj", estadio_nome: "Joao Saldanha", patrocinador: "Betano", escudo_url: getEscudoUrl("marica_rj"), divisao: "serie_d" },
  { nome: "Sampaio Correa-RJ", curto: "SCR", cidade: "Saquarema", estado: "RJ", cor1: "#006633", cor2: "#dd0000", prestigio: 14, torcida: 6000, estadio_cap: 3000, saldo: 1000000, file_key: "sampaiocorrea_rj", estadio_nome: "Joao Saldanha", patrocinador: "Dafabet", escudo_url: getEscudoUrl("sampaiocorrea_rj"), divisao: "serie_d" },

  // ── Clubes de estadual (SP) — completam o Campeonato Paulista (16 clubes) ────
  { nome: "Portuguesa", curto: "LUS", cidade: "Sao Paulo", estado: "SP", cor1: "#dd0000", cor2: "#006633", prestigio: 22, torcida: 300000, estadio_cap: 21000, saldo: 1000000, file_key: "portuguesa_bra", estadio_nome: "Caninde", patrocinador: "Betano", escudo_url: getEscudoUrl("portuguesa_bra"), divisao: "serie_d" },
  { nome: "Velo Clube", curto: "VEL", cidade: "Rio Claro", estado: "SP", cor1: "#dd0000", cor2: "#000000", prestigio: 15, torcida: 10000, estadio_cap: 8000, saldo: 1000000, file_key: "veloclube_sp", estadio_nome: "Benito Agnelo Castellano", patrocinador: "Pixbet", escudo_url: getEscudoUrl("veloclube_sp"), divisao: "serie_d" },
  { nome: "Noroeste", curto: "NOR", cidade: "Bauru", estado: "SP", cor1: "#dd0000", cor2: "#ffffff", prestigio: 16, torcida: 30000, estadio_cap: 15000, saldo: 1000000, file_key: "noroeste_sp", estadio_nome: "Alfredo de Castilho", patrocinador: "Dafabet", escudo_url: getEscudoUrl("noroeste_sp"), divisao: "serie_d" },
]

// Importar times internacionais
import { allInternationalTeams } from "./international-teams"

// Todos os times brasileiros
// PAIS dos clubes brasileiros curados. 79 deles nao tinham o campo `pais`
// preenchido (so `divisao: serie_a..d`), o que fazia qualquer inferencia por
// pais do clube falhar — a coluna PAIS do editor ficava "-" e o agrupamento por
// pais os deixava de fora. A divisao ja diz que sao do Brasil; preenchemos aqui
// em vez de editar centenas de entradas a mao.
const _comPaisBR = <T extends { pais?: string }>(t: T): T =>
  String(t.pais ?? "").trim() ? t : { ...t, pais: "Brasil" }

export const allBrazilianTeams = [...serieATeams, ...serieBTeams, ...serieCTeams, ...serieDTeams]
  .map(_comPaisBR)

// Todos os times (incluindo internacionais)
export const allTeams = [...allBrazilianTeams, ...allInternationalTeams]

// `curto` funciona como chave esportiva em tabela, calendário e resultados. A base
// possuía siglas repetidas (Birmingham/Bristol = BC, Stoke/Swansea = SC e três CC na
// La Liga 2), fazendo o round-robin montar "um clube contra ele mesmo" e reapresentar
// partidas. Mantemos a primeira sigla e geramos uma chave estável pelo file_key para
// cada colisão seguinte, sem alterar nome, escudo, uniforme ou elenco.
const _usedCurto = new Set<string>()
for (const team of allTeams) {
  const original = team.curto.trim().toLocaleUpperCase()
  if (!_usedCurto.has(original)) {
    team.curto = original
    _usedCurto.add(original)
    continue
  }
  const stableBase = (team.file_key || team.nome)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLocaleUpperCase()
    .slice(0, 8) || "CLUBE"
  let candidate = stableBase
  let suffix = 2
  while (_usedCurto.has(candidate)) {
    candidate = `${stableBase.slice(0, Math.max(1, 8 - String(suffix).length))}${suffix}`
    suffix++
  }
  team.curto = candidate
  _usedCurto.add(candidate)
}

// Pirâmide nacional vigente em 2026. Os objetos continuam os mesmos (escudos e dados
// licenciados não são tocados), apenas a divisão esportiva é corrigida após os acessos e
// rebaixamentos de 2025. Centralizar aqui faz calendário, mercado e competições enxergarem
// a mesma liga.
const BRAZIL_SERIE_A_2026 = new Set([
  "Botafogo", "Palmeiras", "Flamengo", "Internacional", "Sao Paulo", "São Paulo",
  "Corinthians", "Bahia", "Cruzeiro", "Atletico-MG", "Atlético-MG", "Fluminense",
  "Vasco da Gama", "Gremio", "Grêmio", "Vitoria", "Vitória", "Athletico-PR",
  "Santos", "Mirassol", "RB Bragantino", "Coritiba", "Chapecoense", "Remo",
])
const BRAZIL_SERIE_B_2026 = new Set([
  "Ceará", "Fortaleza", "Juventude", "Sport", "Ponte Preta", "Criciúma", "Vila Nova",
  "Botafogo-SP", "Operário-PR", "Gremio Novorizontino", "Grêmio Novorizontino",
  "São Bernardo", "Avaí", "Náutico", "CRB", "Goiás", "Londrina", "America-MG",
  "América-MG", "Athletic Club", "Cuiabá", "Atletico-GO", "Atlético-GO",
])
for (const team of allBrazilianTeams) {
  if (BRAZIL_SERIE_A_2026.has(team.nome)) team.divisao = "serie_a"
  else if (BRAZIL_SERIE_B_2026.has(team.nome)) team.divisao = "serie_b"
}
serieATeams.splice(0, serieATeams.length, ...allBrazilianTeams.filter(t => t.divisao === "serie_a"))
serieBTeams.splice(0, serieBTeams.length, ...allBrazilianTeams.filter(t => t.divisao === "serie_b"))
serieCTeams.splice(0, serieCTeams.length, ...allBrazilianTeams.filter(t => t.divisao === "serie_c"))
serieDTeams.splice(0, serieDTeams.length, ...allBrazilianTeams.filter(t => t.divisao === "serie_d"))

// ── POOL BF2026 (~2947 clubes reais) como Team ────────────────────────────────
// O jogo carrega ~2947 clubes no pool (imported-bf2026.json), mas so os CURADOS
// apareciam no editor — dai a impressao de "faltam times / o editor nao mostra os
// 2000+". Aqui convertemos o pool em Team e excluimos os que ja existem curados
// (por file_key ou nome), para o editor listar TODOS agrupados por pais.
const _normKey = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")

const _curatedKeys = new Set<string>()
for (const t of allTeams) { _curatedKeys.add(_normKey(t.file_key)); _curatedKeys.add(_normKey(t.nome)) }

/**
 * A chave do pool traz o sufixo do pais (`brighton_ing`, `pisa_it`), a do curado
 * nao (`brighton`). Sem tirar o sufixo, o filtro de duplicatas abaixo nao via
 * que eram o mesmo clube e o editor listava os dois — "Brighton" e
 * "Brighton & Hove Albion", "Tottenham" e "Tottenham Hotspur".
 */
const _semSufixoDePais = (chave: string) => chave.replace(/(ing|ita|esp|ale|fra|por|hol|bel|arg|bra|rus|tur|eua|chn|ara|mex|col|chi|per|uru|par|esc|sui|ucr|sue|aut|gre|din|nor|jap|cat|egi|mar|aus|it|fr|ar|pt|pl|ru|hk|en)$/, "")
const _curatedStems = new Set<string>()
for (const t of allTeams) _curatedStems.add(_semSufixoDePais(_normKey(t.file_key)))

/**
 * Mesmo clube com nome diferente nas duas fontes, conferido um a um. NAO entra
 * aqui time B nem xara: Benfica B, Zenit Penza, Independiente Chivilcoy e
 * Stuttgarter Kickers sao clubes DIFERENTES, e uni-los apagaria elenco de
 * verdade. O criterio foi: mesmo pais, mesma cidade e mesmo clube real.
 */
const _MESMO_CLUBE: Record<string, string> = {
  tottenhamhotspur: "tottenham",
  ascoli: "ascolicalcio1898",
  mantova: "mantova1911",
  pisa: "pisasportingclub",
  carrarese: "carraresecalcio",
  antalyspor: "antalyaspor",
  ural: "uralsyekaterinburg",
  fakel: "fakelvoronezh",
  jaguares: "jaguarescordoba",
  alfaisaly: "alfaisalyharma",
  sanmartinsj: "sanmartinsj",
}

interface PoolTeamRaw {
  nome?: string; curto?: string; cor1?: string; cor2?: string; prestigio?: number
  saldo?: number; fileKey?: string; estadio?: string; escudo?: string
  escudoDisponivel?: boolean; pais?: string; estado?: string
}

const _seenPoolTeams = new Set<string>()
export const allPoolTeams: Team[] = (((importedBF2026 as { teams?: PoolTeamRaw[] }).teams) ?? [])
  .filter((t) => {
    const fk = _normKey(String(t.fileKey ?? ""))
    const nm = _normKey(repairMojibake(String(t.nome ?? "")))
    const unique = `${nm}:${String(t.pais ?? "")}`
    const raiz = _semSufixoDePais(fk)
    const apelido = _MESMO_CLUBE[raiz]
    if (!fk || _curatedKeys.has(fk) || _curatedKeys.has(nm) || _seenPoolTeams.has(unique)) return false
    if (_curatedStems.has(raiz)) return false
    if (apelido && _curatedKeys.has(apelido)) return false
    _seenPoolTeams.add(unique)
    return true
  })
  .map((t): Team => ({
    nome: repairMojibake(String(t.nome ?? "")),
    curto: String(t.curto ?? String(t.nome ?? "").slice(0, 3).toUpperCase()),
    cidade: "",
    estado: String(t.estado ?? ""),
    cor1: String(t.cor1 ?? "#666666"),
    cor2: String(t.cor2 ?? "#ffffff"),
    prestigio: Number(t.prestigio ?? 45),
    torcida: 0,
    estadio_cap: 0,
    saldo: Number(t.saldo ?? 0),
    file_key: String(t.fileKey ?? ""),
    estadio_nome: String(t.estadio ?? ""),
    patrocinador: "",
    // So aponta escudo quando o arquivo existe (senao cai no fallback do editor).
    escudo_url: t.escudoDisponivel ? String(t.escudo ?? "") : "",
    // normalizeCountry: o campo `pais` do banco importado mistura nome por
    // extenso com CODIGO ("IT" e "Itália", "ARA" e "Arábia Saudita") e, nos
    // clubes brasileiros, com a UF. Sem normalizar aqui, a divisao do pool saía
    // `pool:IT` e a Juventus ficava numa "liga" separada da Serie A. O modulo
    // ja existia e era usado no editor e no bf-loader — faltava nesta porta.
    divisao: `pool:${normalizeCountry(t.pais) || "INT"}`,
    pais: normalizeCountry(t.pais) || undefined,
  }))

// Times por divisao
// PIRAMIDE VIVA: override global de divisao por clube. Depois de cada temporada,
// rivais sobem/descem (lib/league-pyramid.ts) e o resultado fica aqui — um mapa
// curto -> divisao atual. getTeamsByDivision passa a montar as ligas por este
// mapa, entao a Serie A do ano que vem tem os clubes que REALMENTE subiram.
// O game-manager chama setClubDivisions ao carregar o save e ao virar a temporada.
let _clubDivisions: Record<string, string> = {}
export function setClubDivisions(map: Record<string, string> | undefined): void {
  _clubDivisions = map ?? {}
}
export function getClubDivisions(): Record<string, string> {
  return _clubDivisions
}
/** Divisao ATUAL do clube: o override da piramide, ou a divisao estatica. */
export function effectiveDivision(team: { curto: string; divisao: string }): string {
  return _clubDivisions[team.curto] ?? team.divisao
}

export function getTeamsByDivision(divisao: string): Team[] {
  return allTeams.filter(t => effectiveDivision(t) === divisao).map(applyTeamOverride)
}

// Função para buscar time por curto (busca tambem por divisao para evitar duplicatas)
/**
 * Procura o clube pelo codigo curto. Olha os CURADOS primeiro e so entao o POOL:
 * o codigo nao e unico na base (134 codigos para ~3.000 clubes) e, na duvida, o
 * curado — que tem elenco, escudo e liga de verdade — tem de vencer.
 *
 * O pool nao era consultado, e isso quebrava mais do que parece: getTeamByShort
 * devolvia undefined para Ituano, Taubate, Capivariano e companhia, entao os
 * clubes da Paulista A2/A3 nao achavam o proprio regulamento estadual e ficavam
 * sem divisao. Qualquer tela que resolva clube por codigo tinha o mesmo furo.
 */
export function getTeamByShort(curto: string, divisao?: string): Team | undefined {
  const curados = allTeams.map(applyTeamOverride)
  if (divisao) {
    return curados.find(t => t.curto === curto && t.divisao === divisao)
      ?? allPoolTeams.find(t => t.curto === curto && t.divisao === divisao)
  }
  return curados.find(t => t.curto === curto) ?? allPoolTeams.find(t => t.curto === curto)
}

// Função para buscar time por file_key
export function getTeamByFileKey(fileKey: string): Team | undefined {
  const team = allTeams.find(t => t.file_key === fileKey)
  return team ? applyTeamOverride(team) : undefined
}

// Função para buscar time por nome
export function getTeamByName(nome: string): Team | undefined {
  return allTeams.map(applyTeamOverride).find(t => t.nome.toLowerCase() === nome.toLowerCase())
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
// Formatacao DETERMINISTICA (sem Intl 'compact').
//
// Intl.NumberFormat com notation:'compact' — e ate o 'standard' quando o Node do build tem
// small-icu (so en-US) — produz saida DIFERENTE no servidor (build estatico) e no navegador,
// quebrando a hidratacao do React (erro #418, visto no /mercado). Aqui formatamos no padrao
// BR na mao (ponto pra milhar, virgula decimal), igual nos dois lados.
function groupBR(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}
function compactBR(value: number, prefix: string): string {
  const neg = value < 0 ? "-" : ""
  const v = Math.abs(value)
  if (v >= 1_000_000) {
    const n = (v / 1_000_000).toFixed(1).replace(/.0$/, "").replace(".", ",")
    return `${neg}${prefix}${n} mi`
  }
  if (v >= 1_000 && prefix === "") {
    const n = (v / 1_000).toFixed(1).replace(/.0$/, "").replace(".", ",")
    return `${neg}${n} mil`
  }
  return `${neg}${prefix}${groupBR(v)}`
}

export function formatCurrency(value: number): string {
  // getCurrency() comeca em BRL (rate 1, "R$") no build/1o render -> identico ao anterior,
  // sem risco de hidratacao. So muda apos o provider sincronizar a preferencia pos-mount.
  const c = getCurrency()
  return compactBR(value * c.rate, `${c.symbol} `)
}

// Formatar número com sufixo (milhões, mil)
export function formatNumber(value: number): string {
  return compactBR(value, "")
}
