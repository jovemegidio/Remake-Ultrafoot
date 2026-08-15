// Dados dos times brasileiros importados do repositório Ultrafoot
// https://github.com/jovemegidio/Ultrafoot

import { gameAssetUrl, isTauri } from "@/lib/game-asset"
import { normalizeCountry } from "@/lib/country-normalize"
import { applyTeamOverride, getTeamOverride } from "@/lib/team-overrides"
export { formatCurrency, formatCurrencyFor, formatNumber } from "@/lib/currency"
// ⚠️ NAO ADIANTA TROCAR ESTE IMPORT POR UM SEED "SO DE CLUBES" (testado e
// MEDIDO em 07/08/2026 — a mediana por tela PIOROU de 15,19 para 16,21 MB).
//
// A tentacao e obvia: este modulo e importado por 92 arquivos, usa o seed numa
// linha so (`allPoolTeams`) e o `PoolTeamRaw` abaixo nao le `jogadores`, que e
// 7,85 dos 8,91 MB do arquivo. Derivei o arquivo enxuto (1,01 MB) e apontei
// para ca — e o completo continuou entrando em 49 das 56 telas assim mesmo,
// porque `lib/game-engine.ts` e `lib/use-game-manager.ts` importam
// `players-data`, que o puxa. Resultado: 1 MB SOMADO, nada removido.
//
// Cortar de verdade exige tornar `players-data` assincrono (o `allPlayers` e um
// `const` exportado, consumido de forma sincrona) — nao basta mexer aqui.
/**
 * ÍNDICE LEVE DO POOL — não o seed completo.
 *
 * `imported-bf2026.json` tem 8,91 MB porque cada um dos 2.994 clubes carrega o
 * array `jogadores` embutido. Este arquivo é importado por 77 módulos, ou seja,
 * por praticamente toda tela — e `PoolTeamRaw` (abaixo) **não lê `jogadores`**.
 * O jogo fazia parse de 8,9 MB para descartar os elencos, e isso viajava no
 * chunk compartilhado de TODA rota: era a causa das telas demorarem a abrir.
 *
 * O índice tem os mesmos 2.994 clubes sem os elencos: 0,88 MB (-90%). Quem
 * PRECISA de elenco (players-data, player-photos) segue lendo o arquivo cheio.
 *
 * ⚠️ O índice é DERIVADO: gerado por `scripts/gerar-indice-do-pool.mjs`. Mudou o
 * seed, rode o script de novo — editar o índice à mão faz o clube existir na
 * lista e sumir do elenco.
 */
import importedBF2026 from "@/data/seeds/imported-bf2026-index.json"
// Tabela de acesso/rebaixamento ja consumada em 2026. Ver `_divisoes2026`.
import divisionOverrides2026 from "@/data/seeds/division_overrides_2026.json"
import { repairMojibake } from "@/lib/text-normalization"
import { getNationalKitUrl } from "@/lib/national-assets"
import { UEFA_EXPANSION_FEDERATIONS, type UefaExpansionDivision } from "@/lib/uefa-expansion"
import { OFFICIAL_EUROPEAN_PARTICIPANTS_2026 } from "@/lib/official-european-participants-2026"
import { DIVISOES_DE_ACESSO, IDS_DE_ACESSO, acessoDoPais } from "@/lib/divisao-de-acesso"

const ULTRAFOOT_RAW_URL = "https://raw.githubusercontent.com/jovemegidio/Ultrafoot/main"

// Divisões / regiões suportadas pelo jogo
export type Divisao =
  | "serie_a"
  | "serie_b"
  | "serie_c"
  | "serie_d"
  /**
   * DIVISOES DE ACESSO — a base da piramide, em 16 paises.
   *
   * Ate a 1.0.318 os 1.618 clubes do pool ficavam em `pool:<Pais>`, que NAO e
   * divisao: apareciam no editor, tinham escudo e elenco, e nao podiam ser
   * dirigidos nem subir para lugar nenhum. Era o relato "Cariacica, Vitoria-ES
   * e afins nao tem como chegar na Serie D" — e o mesmo valia no resto do mundo.
   *
   * Os ids sao PERMANENTES (vao para o save) e vivem em `lib/divisao-de-acesso`.
   * A uniao abaixo aceita qualquer um deles; o catalogo e quem decide quais
   * existem, e o teste confere que os dois lados batem.
   */
  | "divisao_acesso_br"
  | `acesso_${string}`
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
  | "super_league_gre"
  | "superliga_den"
  | "fortuna_liga_cze"
  | "premyer_liqa_aze"
  | "eliteserien_nor"
  | "protathlima_cyp"
  | "premier_liga_kaz"
  // Americas - Sul
  | "liga_argentina"
  | "primera_a_col"
  | "primera_div_chi"
  | "primera_div_ury"
  | "primera_a_ecu"
  | "primera_div_per"
  | "primera_div_bol"
  | "primera_div_par"
  | "primera_div_ven"
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
  | "betinia_liga"
  | "obos_ligaen"
  | "second_div_cyp"
  | "chance_narodni_liga"
  // 2as divisões - Americas
  | "primera_b_arg"
  | "torneo_betplay"
  | "primera_b_chi"
  | "segunda_div_ury"
  | "liga_2_per"
  | "copa_simon_bolivar"
  | "division_intermedia_par"
  | "liga_futve_2"
  // Segundas divisoes que faltavam para o pais ter rebaixamento de verdade.
  // Sao montadas com o pool do proprio pais (ver PAIS_DA_DIVISAO).
  | "scottish_champ"
  | "serie_b_ecu"
  // 2as divisões - Asia
  | "saudi_first_div"
  | "j2_league"
  | "k_league_2"
  | "china_league_one"
  // Profundidade internacional equivalente às ligas jogáveis do FM26.
  | "league_one_eng"
  | "league_two_eng"
  | "national_league_eng"
  | "national_league_ns_eng"
  | "primera_federacion_esp"
  | "segunda_federacion_esp"
  | "dritte_liga_ger"
  | "national_fra"
  | "liga_3_por"
  | "campeonato_portugal"
  | "scottish_league_one"
  | "scottish_league_two"
  | "first_national_bel"
  | "tff_2_lig"
  | "super_league_2_gre"
  // Estaduais
  | "paulistao"
  | "carioca"
  | "mineiro"
  | "gaucho"
  | UefaExpansionDivision

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
  /** Equipes B/reservas podem disputar a liga, mas não subir à divisão da matriz. */
  promotionEligible?: boolean
  reserveTeamOf?: string
  /** Qualidade/proveniência do cadastro esportivo, exibível pelos auditores. */
  dataQuality?: "official-verified" | "federation-snapshot" | "provisional"
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
  // WebP SEM PERDAS no empacotado (bitmap idêntico ao PNG, ~30% menor). O
  // `getRemoteCamisaUrl` continua em `.png`: aquele repositório é de terceiros.
  return `/${folder}/${key}.webp`
}

export function getCamisaUrl(fileKey: string, variant: "home" | "away" | "third" = "home", teamName = ""): string {
  // Uniforme importado pelo usuario no editor de clubes tem prioridade — igual ao
  // escudo customizado. Leitura sincrona do cache do persistent-store; se o clube
  // tiver um kit importado, ele e usado no jogo inteiro no lugar do padrao.
  const overrideKit = getTeamOverride(fileKey)?.kits?.[variant]
  if (overrideKit?.disabled) return ""
  const custom = overrideKit?.imageUrl
  if (custom) return custom
  if (fileKey.startsWith("nation_")) {
    return getNationalKitUrl(fileKey.slice("nation_".length), variant)
  }

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

/** Variantes marcadas como inexistentes no editor nao aparecem nos seletores do jogo. */
export function isKitVariantAvailable(fileKey: string, variant: "home" | "away" | "third"): boolean {
  return getTeamOverride(fileKey)?.kits?.[variant]?.disabled !== true
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

// ── IDENTIDADE DO CLUBE (para o filtro de copias) ────────────────────────────
//
// O filtro por file_key/nome exato deixava passar a mesma equipe escrita de dois
// jeitos: "Eibar" e "SD Eibar", "Celta Vigo" e "Celta de Vigo", "Stuttgart" e
// "VfB Stuttgart" — copias visiveis lado a lado no editor.
//
// A chave de identidade tira o que NAO identifica o clube: conectores em
// qualquer posicao e as siglas societarias (FC, SD, VfB, US...) quando estao no
// COMECO ou no FIM do nome, que e onde elas aparecem de verdade.
//
// O que fica de fora da lista de propósito: `sport`, `atletico`, `athletic`,
// `sporting`, `sportivo`, `ce`, `ca`, `aa`, `ad`. Essas palavras SAO o nome de
// alguns clubes (Sport, Atlético-CE) ou uma sigla de estado brasileiro — apagá-las
// juntaria clubes diferentes, que e o erro caro: some elenco de verdade.
const _CONECTORES = new Set(["de", "do", "da", "dos", "das", "del", "della", "di", "du", "la", "le", "les", "los", "el", "of", "the", "and", "e", "y"])
const _AFIXOS = new Set([
  "fc", "cf", "sc", "afc", "cd", "ud", "sd", "rc", "rcd", "cp", "cs", "csd", "ec",
  "sk", "fk", "nk", "bk", "if", "ff", "sv", "vfb", "vfl", "tsv", "fsv", "msv", "ksc",
  "bsc", "tsg", "spvgg", "ssc", "ss", "as", "us", "kv", "vv", "rk",
  "club", "clube", "futebol", "football", "futbol", "fussball", "calcio", "fotbal",
])

/** Nome -> chave de identidade. Vazia/curta demais devolve o nome normalizado. */
const _identidade = (nome: string): string => {
  const palavras = (nome || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().split(" ")
    .filter(p => p && !_CONECTORES.has(p))
  // Afixos so caem nas pontas (e "1" de "1. FC Koln", que e ordinal, nao nome).
  while (palavras.length > 1 && (_AFIXOS.has(palavras[0]) || palavras[0] === "1")) palavras.shift()
  while (palavras.length > 1 && (_AFIXOS.has(palavras[palavras.length - 1]) || palavras[palavras.length - 1] === "1")) palavras.pop()
  const chave = palavras.join("")
  return chave.length >= 3 ? chave : _normKey(nome)
}

/** Identidade + pais: o mesmo nome em paises diferentes continua sendo dois clubes. */
const _identidadeComPais = (nome: string, pais: string) =>
  `${normalizeCountry(pais) || "?"}|${_identidade(nome)}`

// Os clubes brasileiros curados nao tem `pais` — so `estado` (a UF). normalizeCountry
// resolve UF -> Brasil, entao o fallback para `estado` faz o curado cair no MESMO
// pais do clube do pool; sem isso a peneira nunca via as copias brasileiras.
const _curatedIdentities = new Set<string>()
for (const t of allTeams) _curatedIdentities.add(_identidadeComPais(t.nome, t.pais ?? t.estado ?? ""))

/**
 * Linhas do banco importado que NAO sao clube. "Sem Contrato - 18/19/20" e um
 * balde de jogadores livres do arquivo de origem; no editor aparecia como tres
 * "clubes" iguais, sem pais e sem escudo.
 */
const _naoEhClube = (nome: string) => /^sem\s*contrato/i.test(nome.trim())

interface PoolTeamRaw {
  nome?: string; curto?: string; cor1?: string; cor2?: string; prestigio?: number
  saldo?: number; fileKey?: string; estadio?: string; escudo?: string
  escudoDisponivel?: boolean; pais?: string; estado?: string
}

const _seenPoolTeams = new Set<string>()
/**
 * UFs brasileiras — o clube curado do Brasil guarda a UF em `estado` e nao tem
 * `pais`.
 *
 * ⚠️ Fica AQUI, e nao junto de `_paisCanonico` como antes, porque `_ufDoPoolBR`
 * logo abaixo o consulta durante a construcao de `allPoolTeams`, que roda na
 * carga do modulo. Declarado depois, o `const` estaria na zona morta temporal e
 * o jogo quebraria ao importar `teams-data` — sem tela, sem erro util.
 */
const UFS_BRASIL = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"])

/**
 * UF DE UM CLUBE BRASILEIRO DO POOL, quando o campo `estado` veio vazio.
 *
 * 138 dos 268 brasileiros do pool nao trazem `estado`. Sem UF eles nao tem
 * regiao, e a Divisao de Acesso nao consegue montar a tabela com vizinhos — o
 * capixaba pegaria adversario do Amapa. A UF, porem, esta la: ou no sufixo do
 * `file_key` (`serra_es`, `nacional_pb`) ou no proprio nome ("Santos - AP").
 *
 * Recupera 108 dos 138, com **zero conflitos** medidos contra os clubes que JA
 * declaram `estado` — esse foi o teste de controle antes de confiar na regra
 * (`scripts/test-piramide-brasileira.ts` mantem o numero travado).
 *
 * ⚠️ Deliberadamente NAO adivinha pelas duas ultimas letras do radical. Seria
 * tentador (`muricial` -> AL, `atleticopi` -> PI), mas o mesmo palpite le
 * `amapa_bra` como **PA** quando o Amapa e **AP** — e uma UF errada e pior que
 * UF nenhuma: manda o clube para a regiao errada em silencio. Os 30 restantes
 * ficam sem UF e caem na faixa "sem proximidade", que e um resultado honesto.
 */
const _ufDoPoolBR = (fileKey: string, nome: string): string | undefined => {
  const doArquivo = /_([a-z]{2})$/i.exec(fileKey)?.[1]?.toUpperCase()
  if (doArquivo && UFS_BRASIL.has(doArquivo)) return doArquivo
  const doNome = /[-–]\s*([A-Za-z]{2})\s*$/.exec(nome.trim())?.[1]?.toUpperCase()
  if (doNome && UFS_BRASIL.has(doNome)) return doNome
  return undefined
}

export const allPoolTeams: Team[] = (((importedBF2026 as { teams?: PoolTeamRaw[] }).teams) ?? [])
  .filter((t) => {
    const nome = repairMojibake(String(t.nome ?? ""))
    const fk = _normKey(String(t.fileKey ?? ""))
    const nm = _normKey(nome)
    const unique = `${nm}:${String(t.pais ?? "")}`
    const raiz = _semSufixoDePais(fk)
    const apelido = _MESMO_CLUBE[raiz]
    if (!fk || _naoEhClube(nome)) return false
    if (_curatedKeys.has(fk) || _curatedKeys.has(nm) || _seenPoolTeams.has(unique)) return false
    if (_curatedStems.has(raiz)) return false
    if (apelido && _curatedKeys.has(apelido)) return false
    // Ultima peneira: mesma identidade (sem sigla societaria) no mesmo pais.
    // Pega tanto a copia de um curado quanto a copia de outro clube do pool.
    const identidade = _identidadeComPais(nome, String(t.pais ?? ""))
    if (_curatedIdentities.has(identidade) || _seenPoolTeams.has(identidade)) return false
    _seenPoolTeams.add(unique)
    _seenPoolTeams.add(identidade)
    return true
  })
  .map((t): Team => ({
    nome: repairMojibake(String(t.nome ?? "")),
    curto: String(t.curto ?? String(t.nome ?? "").slice(0, 3).toUpperCase()),
    cidade: "",
    // A UF derivada so entra quando o campo veio VAZIO — o valor declarado
    // sempre vence, e por isso a derivacao nao pode contradizer dado existente.
    estado: String(t.estado ?? "").trim()
      || (normalizeCountry(t.pais) === "Brasil"
        ? (_ufDoPoolBR(String(t.fileKey ?? ""), repairMojibake(String(t.nome ?? ""))) ?? "")
        : ""),
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

/** Liga oficial 2026/27 por identidade global. Diferentemente do pool antigo,
 * esta tabela não depende de prestígio nem da ordem do seed. */
const _officialEuropeanDivisionByFileKey: Record<string, string> = {}
const _officialEuropeanTeamsByDivision = new Map<string, Team[]>()

{
  const candidates = [...allTeams, ...allPoolTeams]
  const byName = new Map<string, Team[]>()
  for (const team of candidates) {
    const key = _normKey(team.nome)
    const list = byName.get(key) ?? []
    list.push(team)
    byName.set(key, list)
  }
  const used = new Set<string>()
  let generated = 0
  const slug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")

  for (const [division, snapshot] of Object.entries(OFFICIAL_EUROPEAN_PARTICIPANTS_2026)) {
    const country = division === "premier_league" || division === "championship" ? "Inglaterra"
      : division === "la_liga" || division === "la_liga_2" ? "Espanha"
        : division === "primeira_liga" || division === "liga_portugal_2" ? "Portugal"
          : division === "eredivisie" || division === "eerste_divisie" ? "Holanda"
            : division === "super_lig" || division === "tff_1_lig" ? "Turquia"
              : division === "russian_prem" || division === "russian_first" ? "Russia"
      : division === "bundesliga" || division === "bundesliga_2" ? "Alemanha"
        : division === "ligue_1" || division === "ligue_2" ? "Franca"
          : division === "serie_a_ita" || division === "serie_b_ita" ? "Italia"
            : division === "pro_league_bel" || division === "challenger_pro" ? "Belgica" : "Escocia"
    const teams: Team[] = []
    for (const participant of snapshot.participants) {
      const aliases = [participant.name, ...(participant.aliases ?? [])]
      let team: Team | undefined
      for (const alias of aliases) {
        team = (byName.get(_normKey(alias)) ?? []).find(candidate =>
          !used.has(candidate.file_key)
          && _normKey(normalizeCountry(candidate.pais ?? candidate.estado)) === _normKey(normalizeCountry(country)),
        )
        if (team) break
      }
      if (!team) {
        generated++
        team = {
          nome: participant.name,
          curto: `O26${String(generated).padStart(3, "0")}`,
          cidade: participant.name,
          estado: country,
          pais: country,
          cor1: "#173B57",
          cor2: "#E8F1F7",
          prestigio: division.includes("_2") || division === "championship" || division === "eerste_divisie" || division === "tff_1_lig" || division === "russian_first" || division === "challenger_pro" || division === "scottish_champ" ? 54 : 70,
          torcida: 150000,
          estadio_cap: 9000,
          saldo: 4_000_000,
          file_key: `${slug(participant.name)}_official_26`,
          estadio_nome: "",
          patrocinador: "",
          escudo_url: "",
          divisao: division as Divisao,
          regiao: "europa",
          dataQuality: "official-verified",
        }
        allTeams.push(team)
        byName.set(_normKey(team.nome), [team])
      }
      used.add(team.file_key)
      _officialEuropeanDivisionByFileKey[team.file_key] = division
      teams.push(team)
    }
    _officialEuropeanTeamsByDivision.set(division, teams)
  }
}

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

/**
 * CLUBES CRIADOS PELO JOGADOR — mesmo padrão de `_clubDivisions`, e pelo mesmo
 * motivo.
 *
 * ⚠️ Eles NÃO podem entrar em `allTeams`. As listas deste arquivo são montadas
 * na carga do módulo, e um clube criado vive no persistent-store, que só é lido
 * depois — no primeiro render ele ainda não existe. Colocá-lo numa lista
 * estática daria um array que às vezes tem o clube e às vezes não, dependendo de
 * qual tela importou o módulo primeiro.
 *
 * Quem alimenta este registro é `components/clubes-proprios-bridge`, ao ouvir
 * `ultrafoot:store:ready`; as telas que listam clube revisam no mesmo evento.
 */
let _clubesPersonalizados: Team[] = []
export function setClubesPersonalizados(times: Team[]): void {
  _clubesPersonalizados = times
}
export function getClubesPersonalizados(): Team[] {
  return _clubesPersonalizados
}

/** Clubes do pool que pertencem a alguma divisão jogável da pirâmide. */
export function getPlayablePoolTeams(): Team[] {
  return allPoolTeams
    .filter(team => PROMOVIDOS_DO_POOL[team.file_key] || _poolInitialDivisionByFileKey[team.file_key])
    .map(team => _withPlayablePoolIdentity(applyTeamOverride(team)))
}

/** Chave global e estável usada pela pirâmide. Saves antigos por `curto` continuam legíveis. */
export function clubDivisionKey(team: { file_key: string }): string {
  return `club:${team.file_key}`
}
/**
 * DIVISOES BRASILEIRAS DE 2026 — o acesso e o rebaixamento que ja tinham
 * acontecido quando a carreira comeca.
 *
 * `data/seeds/division_overrides_2026.json` existe no repositorio desde sempre,
 * com a tabela CERTA de 2026 (Coritiba, RB Bragantino, Remo e Chapecoense na
 * Serie A; Ceara, Fortaleza, Sport e Juventude na B). So que ninguem no jogo o
 * lia — o unico consumidor era `scripts/publicar-uniformes-pasta.mjs`. As listas
 * estaticas logo acima ficaram na temporada ANTERIOR, e como `_clubDivisions`
 * nasce vazio, toda CARREIRA NOVA comecava com 22 clubes na divisao errada.
 *
 * A ordem de precedencia importa: a piramide viva do save (`_clubDivisions`)
 * vem primeiro, senao um save de 2029 seria puxado de volta para 2026 a cada
 * leitura.
 */
/**
 * O MESMO clube grafado diferente nas duas fontes. NAO e para "limpar sufixos"
 * automaticamente: neste projeto tirar palavra da chave de identidade ja juntou
 * clubes distintos. Cada linha aqui foi conferida uma a uma.
 *
 * Chave = nome no catalogo curado; valor = nome no arquivo de 2026.
 * Contraexemplos deliberados (parecem alias e NAO sao):
 *   Sao Raimundo-AM  x  "São Raimundo-RR"  — clubes de estados diferentes
 *   Guarany de Sobral x  "Guarany Bagé"    — CE e RS
 */
const _ALIAS_DIVISAO_2026: Record<string, string> = {
  amazonas: "amazonasfc",
  ypirangars: "ypiranga",
  saojosers: "saojose",
}

const _divisoes2026: Record<string, string> = (() => {
  const mapa: Record<string, string> = {}
  // Nome (normalizado) -> divisao oficial de 2026.
  const divisaoPorNome = new Map<string, string>()
  for (const [divisao, nomes] of Object.entries(
    divisionOverrides2026 as Record<string, string[]>,
  )) {
    for (const nome of nomes) divisaoPorNome.set(_normKey(nome), divisao)
  }

  const resolver = (nome: string): string | undefined => {
    const chave = _normKey(nome)
    return divisaoPorNome.get(chave) ?? divisaoPorNome.get(_ALIAS_DIVISAO_2026[chave] ?? "")
  }

  // 1) Catalogo curado. So BRASILEIROS: o arquivo lista nomes curtos
  //    ("Botafogo", "Guarani") que tambem existem fora do Brasil.
  for (const t of [...serieATeams, ...serieBTeams, ...serieCTeams, ...serieDTeams]) {
    const divisao = resolver(t.nome)
    if (divisao) mapa[t.curto] = divisao
  }

  // NAO estendemos isto ao POOL. Tentei, e o resultado foi Serie A com
  // "Cruzeiro - AL", "Bragantino-PA" e um segundo "Coritiba": o pool tem `curto`
  // repetido e dezenas de nomes quase iguais, entao casar por nome ali duplica
  // clube e importa homonimo de outro estado. A Serie C fica com menos clubes
  // curados e `completarLigaComPool` completa por prestigio, como ja fazia —
  // divisao incompleta e melhor que divisao com o clube errado.
  return mapa
})()

/**
 * CLUBES DO POOL PROMOVIDOS A UMA DIVISAO REAL — por `file_key`, na mao.
 *
 * O comentario acima explica por que o casamento por NOME nao pode ser estendido
 * ao pool: `curto` se repete, ha dezenas de nomes quase iguais e a tentativa
 * anterior colocou "Cruzeiro - AL" e um segundo "Coritiba" na Serie A.
 *
 * Mas a Serie C ficava com 12 dos 20 clubes que o proprio
 * `division_overrides_2026.json` declara, e as 8 vagas eram preenchidas por
 * prestigio com clube sorteado — o tecnico da Serie C enfrentava adversario que
 * nao esta na Serie C. Como o clube do usuario pode SUBIR para ca (acesso da
 * Serie D), essa e a divisao que mais aparece com o elenco errado.
 *
 * A solucao e o par explicito, igual ao que ja se faz com escudo: `file_key` e
 * unico, entao nao ha homonimo possivel. As quatro armadilhas que o nome teria
 * caido estao anotadas — todas foram conferidas uma a uma.
 */
const PROMOVIDOS_DO_POOL: Record<string, string> = {
  ituano_sp: "serie_c",
  anapolisgo_bra: "serie_c",      // ⚠️ por nome casaria com "Grêmio Anápolis" (prestigio maior)
  brusquesc_bra: "serie_c",
  "maranhãoqtt_bra": "serie_c",
  maringapr: "serie_c",           // ⚠️ por nome casaria com "Galo Maringá"
  ferroviaria_sp: "serie_c",      // ⚠️ por nome casaria com "Desportiva Ferroviária" (ES)
  itabaiana_se: "serie_c",
  barra_sc: "serie_c",            // ⚠️ por nome casaria com "Barranquilla" (Colômbia)
}
Object.assign(PROMOVIDOS_DO_POOL, _officialEuropeanDivisionByFileKey)

/** Os clubes do pool promovidos, ja como Team, prontos para entrar na divisao. */
const _promovidosDoPool: Team[] = allPoolTeams.filter(t => PROMOVIDOS_DO_POOL[t.file_key])

/** Divisão inicial reservada para clubes do pool nas pirâmides profundas. */
const _poolInitialDivisionByFileKey: Record<string, string> = {}
const _pyramidDivisionByCountryShort: Record<string, string> = {}
const _playableShortByFileKey: Record<string, string> = {}

/**
 * PRESTIGIO REESCALONADO — a correcao sem a qual o quinto nivel nasce mais forte
 * que a Serie B.
 *
 * As duas fontes medem forca em escalas DIFERENTES, e isso e medido, nao supo-
 * sicao (`scripts/test-piramide-brasileira.ts` trava os numeros):
 *
 *   catalogo curado   Serie A 43-93 · Serie B 19-75 · Serie C 16-71 · Serie D 10-45
 *   pool brasileiro   50-98, mediana 69
 *
 * O prestigio do pool e um ranking INTERNO do pool — ele diz quem e mais forte
 * entre os clubes do pool, nao onde eles ficam na piramide nacional. Jogados
 * crus num nivel abaixo da Serie D, os 268 clubes chegariam com forca de Serie
 * A/B; e como `evolvePyramids` ordena por prestigio as divisoes que o jogo nao
 * simula, eles subiriam TODOS na primeira virada de temporada. A piramide
 * inverteria em silencio — nada quebraria, o jogo so ficaria errado.
 *
 * ⚠️ Esta e a terceira aparicao da mesma familia de defeito ("duas escalas para
 * a mesma grandeza", como o leilao e o caixa dos clubes). A regra da casa e:
 * antes de inventar um numero de forca, procure a escala que o jogo ja usa.
 * Aqui a escala de destino e a do CATALOGO CURADO, que e quem manda no Brasil.
 *
 * ⚠️ NAO reescalone `allPoolTeams` global. O mesmo prestigio alimenta o editor,
 * o completamento de liga de outros 30 paises e os sorteios continentais —
 * mexer nele ali recalibra o jogo inteiro. O ajuste vale so para o clube que
 * entrou na piramide brasileira, e o mapa abaixo e a fronteira disso.
 */
const _prestigioNaPiramideDoPais: Record<string, number> = {}


function _withPlayablePoolIdentity(team: Team): Team {
  const curto = _playableShortByFileKey[team.file_key]
  const prestigio = _prestigioNaPiramideDoPais[team.file_key]
  if (!curto && prestigio === undefined) return team
  const ajustado: Team = { ...team }
  if (curto && curto !== team.curto) ajustado.curto = curto
  if (prestigio !== undefined) ajustado.prestigio = prestigio
  return ajustado
}

/** Quanto do arquivo de 2026 casou com o catalogo curado (para o teste conferir). */
export function getDivisoes2026(): Record<string, string> {
  return _divisoes2026
}

/** Divisao ATUAL do clube: piramide do save > tabela de 2026 > divisao estatica. */
export function initialDivision(team: { curto: string; divisao: string; file_key?: string }): string {
  return (team.file_key ? _officialEuropeanDivisionByFileKey[team.file_key] : undefined)
    ?? (team.file_key ? PROMOVIDOS_DO_POOL[team.file_key] : undefined)
    ?? (team.file_key ? _poolInitialDivisionByFileKey[team.file_key] : undefined)
    ?? _divisoes2026[team.curto]
    ?? team.divisao
}

export function effectiveDivision(team: { curto: string; divisao: string; file_key?: string }): string {
  const canonical = team.file_key ? _clubDivisions[clubDivisionKey({ file_key: team.file_key })] : undefined
  return canonical ?? _clubDivisions[team.curto] ?? initialDivision(team)
}

export function getTeamsByDivision(divisao: string): Team[] {
  const curados = allTeams.filter(t => effectiveDivision(t) === divisao).map(applyTeamOverride)
  // Os promovidos do pool entram AQUI, e nao em `allTeams`: manter o catalogo
  // curado intocado evita que um `curto` repetido do pool atropele um clube
  // curado em toda tela que resolve clube por codigo.
  const doPool = allPoolTeams
    .filter(t => PROMOVIDOS_DO_POOL[t.file_key] || _poolInitialDivisionByFileKey[t.file_key])
    .filter(t => effectiveDivision(t) === divisao)
    .filter(t => !curados.some(c => c.file_key === t.file_key))
    .map(team => _withPlayablePoolIdentity(applyTeamOverride(team)))
  const result = [...curados, ...doPool]
  const snapshot = _officialEuropeanTeamsByDivision.get(divisao)
  if (!snapshot || Object.keys(_clubDivisions).length > 0) return _comClubesProprios(result, divisao)
  const byKey = new Map(result.map(team => [team.file_key, team]))
  return _comClubesProprios(
    snapshot.map(team => byKey.get(team.file_key) ?? applyTeamOverride(team)),
    divisao,
  )
}

/**
 * Acrescenta os clubes criados pelo jogador que pertencem a esta divisão.
 *
 * ⚠️ Passa pelas DUAS saídas de `getTeamsByDivision`. A segunda usa a fotografia
 * oficial europeia, e um clube próprio criado numa liga europeia sumiria por ali
 * — o tipo de falha que só aparece meses depois, em um país só.
 */
function _comClubesProprios(times: Team[], divisao: string): Team[] {
  if (!_clubesPersonalizados.length) return times
  const meus = _clubesPersonalizados
    .filter(t => effectiveDivision(t) === divisao)
    .filter(t => !times.some(c => c.file_key === t.file_key))
  return meus.length ? [...times, ...meus] : times
}

/** Abaixo disto o turno-returno não sustenta um campeonato. */
export const MIN_TIMES_PARA_LIGA = 8

/**
 * TAMANHO OFICIAL DE CADA LIGA — quantos clubes ela deve ter na tabela.
 *
 * Existe porque doze divisoes tinham MENOS clubes curados do que a competicao
 * declarava, e nada corrigia a diferenca: a Bundesliga 2 rodava com 13 clubes
 * anunciando 18, a Ligue 2 com 14 anunciando 18, a MLS com 24 anunciando 30. O
 * calendario e as rodadas SAO derivados do elenco real (`buildRoundRobin`), de
 * modo que o campeonato funcionava — so que menor do que o regulamento na tela.
 *
 * ⚠️ E O ALVO DO COMPLETAMENTO, nao um corte. `completarLigaComPool` so
 * ACRESCENTA clubes do proprio pais; liga que ja tem mais que o alvo fica como
 * esta (o Chile tem 19 curados para 16 vagas oficiais, e apagar clube curado
 * seria pior do que uma tabela com tres a mais).
 *
 * Os numeros sao os das edicoes de 2026 e batem com `teams` em
 * `competitionsByLeague` — as duas listas sao conferidas pelo
 * `scripts/auditar-ligas-consistencia.mjs`.
 */
export const TAMANHO_OFICIAL_DA_LIGA: Record<string, number> = {
  serie_a: 20, serie_b: 20, serie_c: 20, serie_d: 20,
  // Divisoes de acesso: 20 como as outras. O gerador de tabela monta
  // turno-returno a partir do ELENCO da divisao, entao um numero maior nao e
  // "mais clubes disponiveis", e sim mais rodadas na temporada do jogador — e
  // sao 1.618 clubes livres no mundo disputando essas vagas.
  ...Object.fromEntries(IDS_DE_ACESSO.map(id => [id, 20])),
  premier_league: 20, championship: 24,
  la_liga: 20, la_liga_2: 22,
  serie_a_ita: 20, serie_b_ita: 20,
  bundesliga: 18, bundesliga_2: 18,
  ligue_1: 18, ligue_2: 18,
  primeira_liga: 18, eredivisie: 18, scottish_prem: 12, super_lig: 18,
  pro_league_bel: 18, russian_prem: 16,
  super_league_gre: 14, superliga_den: 12, fortuna_liga_cze: 16,
  premyer_liqa_aze: 12, eliteserien_nor: 16, protathlima_cyp: 14,
  premier_liga_kaz: 16,
  saudi_pro: 18, saudi_first_div: 18,
  j_league: 20, k_league_1: 12, chinese_super: 16,
  mls: 30, liga_mx: 18,
  liga_argentina: 30, primera_a_col: 20, primera_a_ecu: 16,
  primera_div_chi: 16, primera_b_chi: 16, primera_div_ury: 16,
  primera_div_per: 18, primera_div_bol: 16, primera_div_par: 12, primera_div_ven: 14,
  liga_2_per: 18, copa_simon_bolivar: 24, division_intermedia_par: 16, liga_futve_2: 14,
  // Segundas divisoes montadas com o pool do proprio pais (ver PAIS_DA_DIVISAO).
  liga_portugal_2: 18, eerste_divisie: 20, challenger_pro: 15,
  tff_1_lig: 20, russian_first: 18, primera_b_arg: 36,
  betinia_liga: 12, obos_ligaen: 16, second_div_cyp: 16, chance_narodni_liga: 16,
  torneo_betplay: 16, segunda_div_ury: 14, china_league_one: 16,
  scottish_champ: 10, serie_b_ecu: 10,
  league_one_eng: 24, league_two_eng: 24,
  national_league_eng: 24, national_league_ns_eng: 12,
  primera_federacion_esp: 20, segunda_federacion_esp: 20,
  dritte_liga_ger: 20, national_fra: 18,
  // Divisões regionalizadas: o save carrega o grupo do clube, não todos os
  // grupos nacionais ao mesmo tempo (mesma estratégia de desempenho do FM).
  liga_3_por: 10, campeonato_portugal: 14,
  scottish_league_one: 10, scottish_league_two: 10,
  first_national_bel: 14, tff_2_lig: 18, super_league_2_gre: 16,
  ...Object.fromEntries(UEFA_EXPANSION_FEDERATIONS.flatMap(federation =>
    [federation.top, federation.second]
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry?.participants.length))
      .map(entry => [entry.id, entry.participants.length]),
  )),
}

/** Alvo de clubes para a divisao, com o padrao antigo (18) para o que nao esta na tabela. */
export function tamanhoDaLiga(divisao: string): number {
  return TAMANHO_OFICIAL_DA_LIGA[divisao] ?? 18
}

/**
 * PAIS DE UMA DIVISAO QUE NAO TEM NENHUM CLUBE CURADO.
 *
 * Onze segundas divisoes ja estavam TOTALMENTE declaradas — tipo `Divisao`,
 * competicao em `competitionsByLeague`, nome, premio, acesso e rebaixamento — e
 * nunca tiveram um unico clube. Elas nao apareciam em lugar nenhum e, pior,
 * deixavam a PRIMEIRA divisao do pais anunciando rebaixamento sem ter para onde
 * rebaixar: onze paises com zona de queda decorativa.
 *
 * `completarLigaComPool` descobre o pais olhando o primeiro clube da divisao; com
 * a divisao vazia nao ha o que olhar, e e este mapa que responde. Os clubes saem
 * do pool importado — sao clubes REAIS do pais, os de maior prestigio que ainda
 * nao estao na primeira divisao.
 */
const PAIS_DA_DIVISAO: Record<string, string> = {
  // As divisoes de acesso nascem SEM nenhum clube curado — os 20 saem todos do
  // pool. Sem estas entradas `completarLigaComPool` nao teria como descobrir o
  // pais delas (ele olha o primeiro clube da divisao, e nao ha nenhum).
  ...Object.fromEntries(DIVISOES_DE_ACESSO.map(d => [d.id, d.country])),
  liga_portugal_2: "Portugal", eerste_divisie: "Holanda", challenger_pro: "Belgica",
  tff_1_lig: "Turquia", russian_first: "Russia", primera_b_arg: "Argentina",
  torneo_betplay: "Colombia", segunda_div_ury: "Uruguai",
  china_league_one: "China", scottish_champ: "Escocia", serie_b_ecu: "Equador",
  liga_2_per: "Peru", copa_simon_bolivar: "Bolivia",
  division_intermedia_par: "Paraguai", liga_futve_2: "Venezuela",
  betinia_liga: "Dinamarca", obos_ligaen: "Noruega", second_div_cyp: "Chipre", chance_narodni_liga: "Chequia",
  league_one_eng: "Inglaterra", league_two_eng: "Inglaterra",
  national_league_eng: "Inglaterra", national_league_ns_eng: "Inglaterra",
  primera_federacion_esp: "Espanha", segunda_federacion_esp: "Espanha",
  dritte_liga_ger: "Alemanha", national_fra: "Franca",
  liga_3_por: "Portugal", campeonato_portugal: "Portugal",
  scottish_league_one: "Escocia", scottish_league_two: "Escocia",
  first_national_bel: "Belgica", tff_2_lig: "Turquia", super_league_2_gre: "Grecia",
  // ⚠️ Japao (11 clubes livres no pool), China (11) e Coreia do Sul (ZERO) nao
  // sustentam a segunda divisao que declaram. Ficam de fora de proposito: uma
  // liga com tres clubes e pior do que nenhuma.
}

/**
 * País em forma comparável. O catálogo curado e o pool importado escrevem o
 * MESMO país de formas diferentes — "Grecia" x "Grécia", "Bolivia" x "Bolívia",
 * "Azerbaijao" x "Azerbaijão" —, e comparar as strings cruas fazia o Olympiacos
 * não achar nenhum dos trinta clubes gregos que existem no pool.
 */
const _paisComparavel = (p: string) =>
  (p ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

/**
 * Grafias distintas do mesmo país. Acento o `_paisComparavel` resolve; isto aqui
 * é para quando os dois lados escolheram palavras diferentes ("Chequia" no
 * catálogo, "Tchéquia" no pool).
 */
const APELIDOS_DE_PAIS: Record<string, string> = {
  chequia: "tchequia", "republica tcheca": "tchequia",
  tch: "tchequia",
  azb: "azerbaijao", aze: "azerbaijao",
  cyp: "chipre", caz: "cazaquistao", kaz: "cazaquistao",
  holanda: "paises baixos",
  eua: "estados unidos", "estados unidos da america": "estados unidos",
  // ⚠️ O seed grava a Arabia Saudita como `ARA` (a sigla do arquivo e ARB, e a
  // do jogo, ARA). Sem este apelido as duas divisoes sauditas nao achavam um
  // unico clube do proprio pais no pool e ficavam com 17 e 15 clubes.
  ara: "arabia saudita", arb: "arabia saudita", ksa: "arabia saudita",
  "coreia do sul": "coreia do sul", "korea do sul": "coreia do sul",
}

const _paisCanonico = (p: string) => {
  const base = _paisComparavel(p)
  return APELIDOS_DE_PAIS[base] ?? base
}

/**
 * PAIS DE UM CLUBE, RESOLVENDO A UF BRASILEIRA.
 *
 * ⚠️ Nao troque isto por `_paisCanonico(team.pais ?? team.estado)`. O clube
 * brasileiro CURADO nao tem o campo `pais` — ele guarda a UF em `estado` —, e
 * `_paisCanonico("SP")` devolve `"sp"`, nao `"brasil"`. Com a comparacao crua, o
 * laco das piramides profundas contaria ZERO curados no Brasil e concluiria que
 * faltam 20 clubes em CADA divisao: Serie A, B, C e D seriam preenchidas com
 * clubes do pool por cima dos curados — o desastre do "Cruzeiro - AL na Serie A"
 * que o comentario de `_divisoes2026` descreve.
 *
 * A mesma pegadinha ja tinha custado caro em `completarLigaComPool` (a Serie D
 * ficava sem pais nenhum com 184 brasileiros disponiveis no pool). Aqui ela esta
 * resolvida num lugar so, para nao ser redescoberta uma terceira vez.
 */
const _paisDoClube = (team: { pais?: string; estado?: string }): string => {
  const declarado = String(team.pais ?? "").trim()
  if (declarado) return _paisCanonico(declarado)
  const uf = String(team.estado ?? "").trim().toUpperCase()
  if (UFS_BRASIL.has(uf)) return "brasil"
  return _paisCanonico(String(team.estado ?? ""))
}

/**
 * Reserva clubes reais do pool para um único nível nacional. Sem esta partição,
 * o mesmo clube era usado para completar a segunda, a terceira e a quarta
 * divisão ao mesmo tempo. A ordem é do topo para a base e o prestígio decide
 * quem ocupa cada faixa na primeira temporada.
 */
const PIRAMIDES_PROFUNDAS_DO_POOL: readonly { country: string; tiers: readonly string[] }[] = [
  // BRASIL. As quatro divisoes ja tem 20 clubes curados cada, entao o laco
  // calcula `missing = 0` para todas elas e NAO mexe na Serie A/B/C/D — o unico
  // nivel que ele preenche e a Divisao de Acesso, que nasce vazia. Isso so vale
  // porque `_paisDoClube` enxerga a UF do curado; ver o aviso la.
  { country: "Brasil", tiers: ["serie_a", "serie_b", "serie_c", "serie_d"] },
  { country: "Inglaterra", tiers: ["premier_league", "championship", "league_one_eng", "league_two_eng", "national_league_eng", "national_league_ns_eng"] },
  { country: "Espanha", tiers: ["la_liga", "la_liga_2", "primera_federacion_esp", "segunda_federacion_esp"] },
  { country: "Alemanha", tiers: ["bundesliga", "bundesliga_2", "dritte_liga_ger"] },
  { country: "Franca", tiers: ["ligue_1", "ligue_2", "national_fra"] },
  { country: "Portugal", tiers: ["primeira_liga", "liga_portugal_2", "liga_3_por", "campeonato_portugal"] },
  { country: "Escocia", tiers: ["scottish_prem", "scottish_champ", "scottish_league_one", "scottish_league_two"] },
  { country: "Belgica", tiers: ["pro_league_bel", "challenger_pro", "first_national_bel"] },
  { country: "Turquia", tiers: ["super_lig", "tff_1_lig", "tff_2_lig"] },
  { country: "Grecia", tiers: ["super_league_gre", "super_league_2_gre"] },
  // ── Paises que so entraram aqui por causa da Divisao de Acesso ────────────
  //
  // ⚠️ A ESCADA INTEIRA, e nao so o degrau de baixo. O laco preenche na ordem e
  // RESERVA o clube para um nivel so; listar apenas o acesso faria os 139
  // argentinos livres serem reservados para ele, e `completarLigaComPool`
  // deixaria de achar clube para a Primera Nacional (que precisa de 36) — a
  // divisao de cima encolheria em silencio, que e exatamente o defeito que esta
  // particao existe para evitar.
  //
  // As listas espelham `PYRAMIDS` de lib/league-pyramid; o
  // `scripts/test-divisao-de-acesso.ts` compara as duas e falha se divergirem.
  { country: "Argentina", tiers: ["liga_argentina", "primera_b_arg"] },
  { country: "Italia", tiers: ["serie_a_ita", "serie_b_ita"] },
  { country: "Holanda", tiers: ["eredivisie", "eerste_divisie"] },
  { country: "Russia", tiers: ["russian_prem", "russian_first"] },
  { country: "Chile", tiers: ["primera_div_chi", "primera_b_chi"] },
  { country: "Peru", tiers: ["primera_div_per", "liga_2_per"] },
  { country: "Paraguai", tiers: ["primera_div_par", "division_intermedia_par"] },
  { country: "Bolivia", tiers: ["primera_div_bol", "copa_simon_bolivar"] },
  { country: "China", tiers: ["chinese_super", "china_league_one"] },
].map(layout => {
  // O degrau de acesso e ANEXADO ao fim da escada do pais, nunca escrito a mao
  // em cada linha: a lista acima ja saiu de sincronia com `PYRAMIDS` uma vez.
  const acesso = acessoDoPais(layout.country)
  if (!acesso) return layout
  if (acesso.acima !== layout.tiers[layout.tiers.length - 1]) return layout
  return { ...layout, tiers: [...layout.tiers, acesso.id] }
})

const _nomePoolComparavel = (nome: string) =>
  (nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim()

for (const layout of PIRAMIDES_PROFUNDAS_DO_POOL) {
  const country = _paisCanonico(layout.country)
  const tiers = new Set(layout.tiers)
  const curatedNames = new Set(allTeams
    .filter(team => _paisDoClube(team) === country)
    .map(team => _nomePoolComparavel(team.nome)))
  const reservedShorts = new Set(allTeams
    .filter(team => _paisDoClube(team) === country)
    .map(team => team.curto))
  const candidateShorts = new Set<string>()
  for (const team of allTeams.filter(team => _paisDoClube(team) === country)) {
    const initial = _officialEuropeanDivisionByFileKey[team.file_key]
      ?? _divisoes2026[team.curto]
      ?? String(team.divisao)
    if (tiers.has(initial)) _pyramidDivisionByCountryShort[`${country}:${team.curto}`] = initial
  }

  const candidates = allPoolTeams
    .filter(team => _paisDoClube(team) === country)
    .filter(team => !curatedNames.has(_nomePoolComparavel(team.nome)))
    .sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0) || a.file_key.localeCompare(b.file_key))
    .filter(team => {
      if (reservedShorts.has(team.curto) || candidateShorts.has(team.curto)) return false
      candidateShorts.add(team.curto)
      return true
    })

  const assigned = new Set<string>()
  // Fotografias oficiais e promoções explícitas vencem a distribuição por força.
  for (const team of candidates) {
    const fixed = _officialEuropeanDivisionByFileKey[team.file_key] ?? PROMOVIDOS_DO_POOL[team.file_key]
    if (fixed && tiers.has(fixed)) {
      _poolInitialDivisionByFileKey[team.file_key] = fixed
      _pyramidDivisionByCountryShort[`${country}:${team.curto}`] = fixed
      assigned.add(team.file_key)
    }
  }

  for (const division of layout.tiers) {
    const curated = allTeams.filter(team => {
      const initial = _officialEuropeanDivisionByFileKey[team.file_key]
        ?? _divisoes2026[team.curto]
        ?? String(team.divisao)
      return initial === division
    }).length
    const fixedPool = candidates.filter(team => _poolInitialDivisionByFileKey[team.file_key] === division).length
    let missing = Math.max(0, tamanhoDaLiga(division) - curated - fixedPool)
    for (const team of candidates) {
      if (missing <= 0) break
      if (assigned.has(team.file_key)) continue
      _poolInitialDivisionByFileKey[team.file_key] = division
      _pyramidDivisionByCountryShort[`${country}:${team.curto}`] = division
      assigned.add(team.file_key)
      missing--
    }
  }

  // `curto` participa das chaves de tabela e resultado. Equipes B do pool
  // frequentemente repetem o código da matriz; somente nesses conflitos
  // geramos um sufixo determinístico a partir do file_key.
  const usedPlayableShorts = new Set(allTeams
    .filter(team => _paisDoClube(team) === country)
    .map(team => team.curto))
  const playablePool = allPoolTeams
    .filter(team => {
      const division = _officialEuropeanDivisionByFileKey[team.file_key]
        ?? PROMOVIDOS_DO_POOL[team.file_key]
        ?? _poolInitialDivisionByFileKey[team.file_key]
      return Boolean(division && tiers.has(division))
    })
    .sort((a, b) => a.file_key.localeCompare(b.file_key))
  for (const team of playablePool) {
    let curto = team.curto
    if (usedPlayableShorts.has(curto)) {
      const clean = team.file_key.replace(/[^a-z0-9]/gi, "").toUpperCase()
      const stem = curto.slice(0, 7)
      let size = 2
      do {
        curto = `${stem}${clean.slice(-size)}`
        size++
      } while (usedPlayableShorts.has(curto))
    }
    _playableShortByFileKey[team.file_key] = curto
    usedPlayableShorts.add(curto)
  }
}

// ── Prestigio das divisoes de acesso na escala do catalogo de cada pais ─────
//
// Roda DEPOIS do laco das piramides porque depende de `_poolInitialDivisionByFileKey`
// ja estar preenchido. Mapeamento linear e determinstico, preservando a ordem de
// forca entre os clubes: o melhor do pool vira o melhor do acesso, e nao o
// melhor do Brasil. Ver o aviso em `_prestigioNaPiramideDoPais`.
for (const acesso of DIVISOES_DE_ACESSO) {
  const paisDoAcesso = _paisCanonico(acesso.country)
  // ⚠️ TODOS os clubes livres do pais entram, nao so os 20 que cabem na tabela.
  //
  // O laco acima para em `tamanhoDaLiga`, que e o certo para as divisoes do
  // meio: elas tem tamanho fixo. Mas a BASE da piramide e o balde de quem nao
  // esta em nenhuma outra — parar em 20 deixaria 248 clubes brasileiros ainda
  // sem divisao alguma, que e exatamente o defeito que este nivel existe para
  // corrigir (o Serra-ES continuaria intocavel, so o Flamengo-PI ganharia
  // divisao).
  //
  // A tabela JOGADA continua com 20: `completarLigaComPool` apara por prestigio,
  // e `getLeagueTeams` garante a vaga do clube do usuario mesmo quando ele nao
  // esta entre os 20 mais fortes. Ou seja: 268 clubes disputam o nivel, 20 jogam
  // a temporada visivel, e `evolvePyramids` promove 4 deles.
  for (const team of allPoolTeams) {
    if (_paisDoClube(team) !== paisDoAcesso) continue
    if (_poolInitialDivisionByFileKey[team.file_key]) continue
    if (_officialEuropeanDivisionByFileKey[team.file_key] || PROMOVIDOS_DO_POOL[team.file_key]) continue
    _poolInitialDivisionByFileKey[team.file_key] = acesso.id
  }

  const noAcesso = allPoolTeams.filter(
    team => _poolInitialDivisionByFileKey[team.file_key] === acesso.id,
  )
  // ⚠️ A faixa de destino e calculada CONTRA A DIVISAO DE CIMA, e nao fixa em
  // 6-34 como era na versao so-Brasil. As piramides do mundo tem escalas bem
  // diferentes — a Serie D brasileira vai a 45 e a `national_fra` a outra coisa
  // —, e uma faixa unica poria a base francesa acima da sua propria segunda
  // divisao. O teto do acesso e o PISO da divisao de cima; abaixo dele, a faixa
  // se abre proporcionalmente.
  if (noAcesso.length) {
    const acima = getTeamsByDivision(acesso.acima).map(t => t.prestigio ?? 0)
    const pisoDeCima = acima.length ? Math.min(...acima) : 15
    const max = Math.max(4, pisoDeCima - 1)
    const min = Math.max(1, Math.round(max * 0.2))

    const forcas = noAcesso.map(team => team.prestigio ?? 0)
    const menor = Math.min(...forcas)
    const maior = Math.max(...forcas)
    for (const team of noAcesso) {
      // Todos com o mesmo prestigio (amplitude zero) cairiam numa divisao por
      // zero; nesse caso o nivel inteiro vale o meio da faixa.
      const posicao = maior > menor ? ((team.prestigio ?? 0) - menor) / (maior - menor) : 0.5
      _prestigioNaPiramideDoPais[team.file_key] = Math.round(min + posicao * (max - min))
    }
  }
}

/**
 * Confederação do país, para completar uma liga curta com vizinhos de verdade
 * em vez de clubes de outro continente.
 */
/** Confederação pelo país, tolerando acento e grafia (ver `_paisCanonico`). */
const _confederacao = (pais: string): string | undefined =>
  CONFEDERACAO_DO_PAIS[_paisCanonico(pais)]

// CHAVES EM FORMA CANONICA (sem acento, minusculas) — as duas bases escrevem os
// mesmos paises de jeitos diferentes, e uma chave acentuada aqui nunca casaria
// com o "Grecia" do catalogo. Sempre consultar via `_confederacao`.
const CONFEDERACAO_DO_PAIS: Record<string, string> = {
  brasil: "CONMEBOL", argentina: "CONMEBOL", uruguai: "CONMEBOL", chile: "CONMEBOL",
  colombia: "CONMEBOL", peru: "CONMEBOL", paraguai: "CONMEBOL", bolivia: "CONMEBOL",
  equador: "CONMEBOL", venezuela: "CONMEBOL",
  inglaterra: "UEFA", espanha: "UEFA", italia: "UEFA", alemanha: "UEFA", franca: "UEFA",
  portugal: "UEFA", "paises baixos": "UEFA", belgica: "UEFA",
  escocia: "UEFA", turquia: "UEFA", russia: "UEFA", austria: "UEFA", suica: "UEFA",
  ucrania: "UEFA", servia: "UEFA", suecia: "UEFA", noruega: "UEFA", dinamarca: "UEFA",
  grecia: "UEFA", croacia: "UEFA", tchequia: "UEFA", polonia: "UEFA", chipre: "UEFA",
  azerbaijao: "UEFA", cazaquistao: "UEFA", romenia: "UEFA", hungria: "UEFA",
  finlandia: "UEFA", islandia: "UEFA", irlanda: "UEFA", israel: "UEFA",
  eslovaquia: "UEFA", eslovenia: "UEFA", bulgaria: "UEFA", albania: "UEFA",
  "estados unidos": "CONCACAF", mexico: "CONCACAF", canada: "CONCACAF",
  japao: "AFC", "coreia do sul": "AFC", china: "AFC", "arabia saudita": "AFC",
  "emirados arabes unidos": "AFC", catar: "AFC", ira: "AFC",
}

/**
 * COMPLETA UMA LIGA CURTA COM CLUBES DO PAÍS CERTO.
 *
 * O problema que isto resolve, medido em 31/07/2026: onze divisões tinham menos
 * de oito clubes curados — sete delas tinham UM só. E o que o jogo fazia com
 * elas era pior do que não ter liga nenhuma:
 *
 *   • `getLeagueTeams` (career-engine) caía em `serieATeams`. Escolher o
 *     Olympiacos montava um campeonato com DEZENOVE clubes da Série A
 *     brasileira — o grego jogava o Brasileirão.
 *   • `getUserLeagueTeams` devolvia a divisão como estava, e um único clube gera
 *     zero confrontos: o calendário simplesmente não tinha liga.
 *
 * O pool importado tem 2.453 clubes indexados por PAÍS (`pool:Grécia`), e é dele
 * que vêm os adversários. A ordem é deliberada:
 *
 *   1. os curados da divisão (têm elenco, escudo e identidade de verdade);
 *   2. clubes do MESMO PAÍS no pool, os de maior prestígio primeiro;
 *   3. só se ainda faltar, vizinhos da MESMA CONFEDERAÇÃO.
 *
 * O passo 3 existe para Chipre, Tchéquia e Cazaquistão, que nem com o pool
 * chegam a oito. Um campeonato cipriota com alguns europeus a mais é estranho;
 * um campeonato cipriota disputado contra Flamengo e Palmeiras é absurdo.
 */
/**
 * REGIAO DA UF — usada so para montar a Divisao de Acesso perto de casa.
 *
 * O quinto nivel brasileiro tem 260 clubes disputando 20 vagas na tabela. Aparar
 * so por prestigio entregava a mesma liga para todo mundo: os 20 mais fortes do
 * pais inteiro. Quem escolhesse o Serra-ES entrava com forca 8 numa liga em que
 * todos os outros eram 25-34 — uma temporada perdida antes do primeiro jogo, e o
 * oposto de "clube pequeno consegue subir".
 *
 * Agrupar por regiao tambem e o que a Serie D faz de verdade: a CBF preenche as
 * vagas por federacao estadual, e os grupos sao montados por proximidade.
 */
const REGIAO_DA_UF: Record<string, string> = {
  AC: "N", AM: "N", AP: "N", PA: "N", RO: "N", RR: "N", TO: "N",
  AL: "NE", BA: "NE", CE: "NE", MA: "NE", PB: "NE", PE: "NE", PI: "NE", RN: "NE", SE: "NE",
  DF: "CO", GO: "CO", MT: "CO", MS: "CO",
  ES: "SE", MG: "SE", RJ: "SE", SP: "SE",
  PR: "S", RS: "S", SC: "S",
}

/**
 * @param ancora clube em torno do qual a tabela e montada, quando a divisao tem
 *   muito mais clubes do que vagas. Hoje so a Divisao de Acesso esta nessa
 *   situacao; para as outras divisoes o parametro nao muda nada.
 */
export function completarLigaComPool(
  divisao: string,
  alvo = tamanhoDaLiga(divisao),
  ancora?: { file_key?: string; estado?: string; prestigio?: number },
): Team[] {
  const base = getTeamsByDivision(divisao)

  // Divisao com clubes DEMAIS e uma ancora: os companheiros de tabela saem da
  // vizinhanca do clube, e nao do topo nacional. Sem ancora o comportamento
  // antigo (aparar por prestigio) continua valendo.
  // Sem UF na ancora nao ha regiao, mas a vaga dela na propria liga continua
  // valendo: 30 clubes do pool nao tem UF recuperavel, e ficar de fora do
  // proprio campeonato seria pior do que pegar adversario de outra regiao.
  if (ancora && base.length > alvo) {
    const ufAncora = String(ancora.estado ?? "").toUpperCase()
    const regiaoAncora = REGIAO_DA_UF[ufAncora]
    const forcaAncora = ancora.prestigio ?? 0
    // Ancora sem UF conhecida: nao ha vizinhanca para calcular, entao todos
    // empatam em distancia e quem decide e so a proximidade de FORCA. Sem esta
    // saida, `REGIAO_DA_UF[""]` seria `undefined` e casaria com os outros
    // clubes sem UF por acidente — agrupamento por falta de dado, nao por
    // geografia.
    const proximidade = (t: Team) => {
      if (!regiaoAncora) return 0
      const uf = String(t.estado ?? "").toUpperCase()
      if (uf === ufAncora) return 0
      if (REGIAO_DA_UF[uf] === regiaoAncora) return 1
      return 2
    }
    const escolhidos = [...base].sort((a, b) =>
      proximidade(a) - proximidade(b)
      // Dentro da mesma faixa de distancia, quem estiver mais perto em FORCA:
      // uma liga equilibrada e o que torna o acesso disputavel.
      || Math.abs((a.prestigio ?? 0) - forcaAncora) - Math.abs((b.prestigio ?? 0) - forcaAncora)
      || a.file_key.localeCompare(b.file_key))
    // O proprio clube da ancora nunca pode ficar de fora da propria liga.
    const eu = ancora.file_key ? base.find(t => t.file_key === ancora.file_key) : undefined
    const semEu = escolhidos.filter(t => t.file_key !== eu?.file_key)
    return eu ? [eu, ...semEu].slice(0, alvo) : escolhidos.slice(0, alvo)
  }

  // ⚠️ O CORTE ERA `>= 8`, e nao `>= alvo`. Bastava a divisao ter oito clubes
  // para o completamento parar, entao doze ligas rodavam menores do que o
  // proprio regulamento anunciava — Bundesliga 2 com 13 de 18, Ligue 2 com 14
  // de 18, MLS com 24 de 30. Nada acusava: as rodadas saem do elenco real.
  //
  // ⚠️⚠️ E FALTAVA O OUTRO LADO: a divisao que tem clubes DEMAIS.
  //
  // A funcao so sabia COMPLETAR, nunca APARAR. A Serie D tinha 27 clubes
  // curados contra as 20 do regulamento, e os 27 iam inteiros para o
  // calendario. Tres estragos de uma vez:
  //   1. numero IMPAR — `generateBrasileirao` monta N-1 rodadas com um folga por
  //      rodada e NENHUM clube completa o turno-returno;
  //   2. 52 rodadas em vez de 38, empurrando a temporada ate a semana 86;
  //   3. dezembro com 455 jogos, porque tudo que passa de 31/dez e grampeado la.
  // Ver [lib/use-game-manager] resolveLeagueTeams e o caso da Portuguesa.
  //
  // Aparar e por PRESTIGIO: quem fica sao os mais fortes da divisao, que e o
  // criterio que o resto do jogo ja usa para ordenar clube.
  if (base.length > alvo) {
    return [...base].sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0)).slice(0, alvo)
  }
  if (base.length === alvo) return base

  const jaTem = new Set(base.map(t => t.file_key))
  // ⚠️ CLUBE BRASILEIRO CURADO NAO TEM O CAMPO `pais` — ele guarda a UF em
  // `estado` ("DF", "SP"). Procurando so por `pais`, a Serie D ficava sem pais
  // nenhum e nao achava um unico clube do pool para completar as 20 vagas, com
  // 184 brasileiros disponiveis ali.
  // ⚠️ Os fallbacks devolvem `undefined`, nunca "": `??` nao cai com string
  // vazia, e um "" no meio da cadeia impediria o mapa de ser consultado.
  const paisCru = base.map(t => String(t.pais ?? "").trim()).find(Boolean)
    ?? (base.some(t => UFS_BRASIL.has(String(t.estado ?? "").toUpperCase())) ? "Brasil" : undefined)
    // Divisao sem clube curado nenhum: o pais so pode vir do mapa.
    ?? PAIS_DA_DIVISAO[divisao]
    ?? ""
  const paisDaLiga = _paisCanonico(paisCru)
  const porPrestigio = (a: Team, b: Team) => (b.prestigio ?? 0) - (a.prestigio ?? 0)

  const doPais = allPoolTeams
    .filter(t => !jaTem.has(t.file_key) && _paisCanonico(String(t.pais ?? "")) === paisDaLiga)
    .filter(t => !_poolInitialDivisionByFileKey[t.file_key] || _poolInitialDivisionByFileKey[t.file_key] === divisao)
    .filter(t => !_pyramidDivisionByCountryShort[`${paisDaLiga}:${t.curto}`]
      || _pyramidDivisionByCountryShort[`${paisDaLiga}:${t.curto}`] === divisao)
    .sort(porPrestigio)

  const resultado = [...base]
  for (const t of doPais) {
    if (resultado.length >= alvo) break
    resultado.push(_withPlayablePoolIdentity(t)); jaTem.add(t.file_key)
  }
  if (resultado.length >= MIN_TIMES_PARA_LIGA) return resultado

  // Ainda curta: vizinhos da mesma confederação, nunca de outro continente.
  const confed = _confederacao(paisDaLiga)
  if (confed) {
    const vizinhos = allPoolTeams
      .filter(t => !jaTem.has(t.file_key) && _confederacao(String(t.pais ?? "")) === confed)
      .filter(t => !_poolInitialDivisionByFileKey[t.file_key] || _poolInitialDivisionByFileKey[t.file_key] === divisao)
      .sort(porPrestigio)
    for (const t of vizinhos) {
      if (resultado.length >= MIN_TIMES_PARA_LIGA) break
      resultado.push(_withPlayablePoolIdentity(t)); jaTem.add(t.file_key)
    }
  }
  return resultado
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
  const pool = allPoolTeams.map(team => _withPlayablePoolIdentity(applyTeamOverride(team)))
  // ⚠️ O clube PRÓPRIO vem primeiro. Se ele ficasse por último, um código curto
  // que por acaso exista no pool (são ~134 códigos para 3.000 clubes) devolveria
  // outro clube — e a tela mostraria escudo, cores e elenco alheios para o time
  // que o jogador criou. A validação impede a colisão na criação, mas a ordem
  // aqui é a garantia que não depende de o registro estar íntegro.
  if (divisao) {
    return _clubesPersonalizados.find(t => t.curto === curto && effectiveDivision(t) === divisao)
      ?? curados.find(t => t.curto === curto && effectiveDivision(t) === divisao)
      ?? pool.find(t => t.curto === curto && effectiveDivision(t) === divisao)
  }
  return _clubesPersonalizados.find(t => t.curto === curto)
    ?? curados.find(t => t.curto === curto)
    ?? pool.find(t => t.curto === curto)
}

// Função para buscar time por file_key
export function getTeamByFileKey(fileKey: string): Team | undefined {
  const proprio = _clubesPersonalizados.find(t => t.file_key === fileKey)
  if (proprio) return proprio
  const team = allTeams.find(t => t.file_key === fileKey)
    ?? allPoolTeams.find(t => t.file_key === fileKey)
  return team ? _withPlayablePoolIdentity(applyTeamOverride(team)) : undefined
}

/**
 * Siglas de TIPO de clube — elas não identificam ninguém e só atrapalham o
 * casamento por nome ("FC Porto" x "Porto", "AFC Ajax" x "Ajax").
 */
const SIGLAS_DE_CLUBE = new Set([
  "fc", "sc", "ec", "ca", "cr", "ac", "se", "afc", "cf", "ud", "cd", "sl", "ss",
  "as", "us", "rc", "cs", "ce", "aa", "clube", "club", "futebol", "football",
])

const _semAcento = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Nome comparável: sem acento, sem pontuação e sem as siglas de tipo de clube. */
function _nomeComparavel(nome: string): string {
  return _semAcento(nome)
    .replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ").filter(p => p && !SIGLAS_DE_CLUBE.has(p)).join(" ")
}

/**
 * Busca time por nome, tolerando as formas com que o mesmo clube é escrito.
 *
 * Era só igualdade exata (case-insensitive), e isso derrubava quem escreve o
 * nome "curto": o Mercado de Juniores pede "Ajax" e "Porto", enquanto o catálogo
 * guarda "AFC Ajax" e "FC Porto" — dois dos oito clubes formadores caíam no
 * escudo DESENHADO, que foi o relato.
 *
 * A busca vai do mais estrito ao mais tolerante e PARA no primeiro acerto, então
 * nenhum casamento que já funcionava muda de resultado:
 *
 *   1. nome exato;
 *   2. nome normalizado (acento/pontuação);
 *   3. nome sem as siglas de tipo ("FC Porto" -> "porto").
 *
 * O passo 3 não é um `includes`: "Porto" NÃO pode casar com "Porto Velho". A
 * comparação continua sendo de igualdade — só que sobre o nome já limpo. Havendo
 * empate (ex.: dois "Nacional"), vence o de maior prestígio, que é o clube que
 * quem digitou o nome curto quase sempre quis dizer.
 */
export function getTeamByName(nome: string): Team | undefined {
  const times = allTeams.map(applyTeamOverride)

  const exato = times.find(t => t.nome.toLowerCase() === nome.toLowerCase())
  if (exato) return exato

  const alvoNorm = _semAcento(nome).replace(/[^a-z0-9]+/g, " ").trim()
  const porNorm = times.filter(t => _semAcento(t.nome).replace(/[^a-z0-9]+/g, " ").trim() === alvoNorm)
  if (porNorm.length) return _maisPrestigiado(porNorm)

  const alvoLimpo = _nomeComparavel(nome)
  if (!alvoLimpo) return undefined
  const porLimpo = times.filter(t => _nomeComparavel(t.nome) === alvoLimpo)
  return porLimpo.length ? _maisPrestigiado(porLimpo) : undefined
}

function _maisPrestigiado(times: Team[]): Team {
  return times.reduce((a, b) => ((b.prestigio ?? 0) > (a.prestigio ?? 0) ? b : a))
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
