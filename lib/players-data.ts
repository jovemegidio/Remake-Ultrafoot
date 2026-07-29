// Jogadores brasileiros — carregados das seeds locais (offline).
// Origem: https://github.com/jovemegidio/Ultrafoot (data/seeds/players_br.json)

import playersBR from "@/data/seeds/players_br.json"
import importedBF2026 from "@/data/seeds/imported-bf2026.json"
// Elencos REAIS por clube (gerado por scripts/import-real-positions.mjs a partir dos
// CSVs). Corrige as posicoes que o seed atribui por indice E o elenco desatualizado.
import realSquadsJson from "@/data/seeds/real-positions.json"
import { allTeams, type Team } from "@/lib/teams-data"
import realSquadsTM from "@/data/seeds/real-squads-tm.json"
import { getPlayerOverride, bonusDasCaracteristicas } from "@/lib/player-overrides"
import { hasDeparted } from "@/lib/departed-players"
import { getArrivals, hasAnyArrival } from "@/lib/world-market"
import { saiuDoClube, chegouAoClube, temTransferencias } from "@/lib/atualizacao-elencos"

const REAL_SQUADS = realSquadsJson as unknown as Record<
  string,
  Array<{ nome: string; pos: string; titular: boolean }>
>

export type Posicao = "GOL" | "ZAG" | "LD" | "LE" | "VOL" | "MEI" | "ATA" | string

export interface Player {
  nome: string
  pos: Posicao
  idade: number
  base: number
  time: string
  /** Nacionalidade real (Transfermarkt), assada no seed. Ausente = desconhecida. */
  nac?: string
  // Atributos individuais (so presentes quando o jogador foi editado no editor). A partida
  // usa estes valores quando existem; senao deriva do overall+posicao.
  pace?: number
  shooting?: number
  passing?: number
  dribbling?: number
  defending?: number
  physical?: number
  preferredFoot?: "Direita" | "Esquerda" | "Ambidestro"
  reputation?: "normal" | "estrela" | "top_mundial"
  traits?: string[]
}

const RAW = playersBR as Record<string, Array<{ nome: string; pos: string; idade: number; base: number }>>
const IMPORTED = importedBF2026 as {
  teams?: Array<{
    id?: string
    nome: string
    curto?: string
    jogadores?: Array<{ nome: string; posicao: string; idade: number; overall: number; nac?: string; ft?: string }>
  }>
}

function normalizeTeamName(value: string): string {
  if (!value) return ""
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function toPlayerPosition(posicao: string): Posicao {
  const normalized = posicao.toUpperCase()
  if (normalized === "GOL") return "GOL"
  if (normalized === "DEF") return "ZAG"
  if (normalized === "LAT") return "LD"
  if (normalized === "ZAG") return "ZAG"
  if (normalized === "LD") return "LD"
  if (normalized === "LE") return "LE"
  if (normalized === "VOL") return "VOL"
  if (normalized === "MEI") return "MEI"
  // CA significa centroavante no banco de dados importado, nao "meia central".
  // Manter esta conversao aqui impede que atletas como Carlos Vinícius aparecam
  // no meio-campo no elenco, escalação, radar e seleções.
  if (normalized === "CA") return "ATA"
  if (normalized === "ATA") return "ATA"
  return normalized
}

// Índice leve usado também na migração de saves: quando uma versão antiga do
// motor transformou CA (centroavante) em MEI, recuperamos a posição oficial sem
// reprocessar o banco inteiro a cada carregamento.
const canonicalSeedPositions = new Map<string, Posicao | null>()
for (const squad of Object.values(RAW)) {
  for (const player of squad) {
    const key = normalizeTeamName(player.nome)
    const position = toPlayerPosition(player.pos)
    const previous = canonicalSeedPositions.get(key)
    canonicalSeedPositions.set(key, previous === undefined || previous === position ? position : null)
  }
}

export function getCanonicalSeedPosition(playerName: string): Posicao | undefined {
  const position = canonicalSeedPositions.get(normalizeTeamName(playerName))
  return position ?? undefined
}

const MAX_IMPORTED_OVERALL = 92

// Elencos CURADOS (players_br.json). Este era o QUARTO caminho de montagem de
// elenco — e o unico que eu nao havia ligado a nacionalidade real. Por isso
// Botafogo, Palmeiras e companhia seguiam com a coluna PAIS vazia mesmo depois
// da correcao: os clubes brasileiros curados vem daqui, nao do seed importado.
// A resolucao acontece de forma preguicosa (getter) porque `nacionalidadePorNome`
// e construido mais abaixo no arquivo.
export const playersByTeam: Record<string, Player[]> = Object.fromEntries(
  Object.entries(RAW).map(([time, list]) => [
    time,
    list.map(p => ({
      ...p,
      pos: toPlayerPosition(p.pos),
      time,
      // Resolve contra o elenco do PROPRIO clube (o nome do time e a chave aqui),
      // o que desempata apelidos comuns como Paulinho/Vitinho.
      get nac(): string | undefined {
        return resolverNac(p.nome, undefined, { nome: time, curto: "", file_key: "" } as unknown as Team)
      },
    })),
  ])
)

const normalizedTeamKeyMap = new Map(
  Object.keys(playersByTeam).map((teamName) => [normalizeTeamName(teamName), teamName])
)

const importedTeams = IMPORTED.teams ?? []
const importedTeamMap = new Map<string, (typeof importedTeams)[number]>()

for (const team of importedTeams) {
  const aliases = [
    team.nome,
    team.curto ?? "",
    team.id ?? "",
    (team.id ?? "").replace(/^bf_/, ""),
  ]

  for (const alias of aliases) {
    if (!alias) continue
    const normalized = normalizeTeamName(alias)
    if (normalized && !importedTeamMap.has(normalized)) {
      importedTeamMap.set(normalized, team)
    }
  }
}

// Indice global evita perder idade/overall quando o CSV atualizado move o atleta para
// outro clube, mas o seed antigo ainda o guarda no time anterior. So usamos nomes com
// uma unica combinacao de idade para nao confundir homonimos.
const globalImportedPlayers = new Map<string, Array<{ idade: number; overall: number; nac?: string }>>()
for (const importedTeam of importedTeams) {
  for (const player of importedTeam.jogadores ?? []) {
    const key = normalizeTeamName(player.nome)
    const list = globalImportedPlayers.get(key) ?? []
    list.push({ idade: player.idade, overall: player.overall, nac: player.nac })
    globalImportedPlayers.set(key, list)
  }
}

function findUniqueImportedPlayer(name: string): { idade: number; overall: number; nac?: string } | undefined {
  const candidates = globalImportedPlayers.get(normalizeTeamName(name)) ?? []
  const unique = new Map(candidates.map(p => [`${p.idade}:${p.overall}`, p]))
  return unique.size === 1 ? [...unique.values()][0] : undefined
}

/**
 * NACIONALIDADE REAL por nome, vinda do Transfermarkt (real-squads-tm, campo
 * `c`). O seed do pool so traz `nac` para uma fatia dos atletas — auditoria de
 * 23/07/2026: apenas 18% do elenco curado tinha pais, e 461 dos 542 clubes
 * estavam com mais da metade em branco (a coluna PAIS do editor ficava "-").
 * A coleta do TM tem o pais de 45.803 atletas; cruzamos por nome normalizado.
 * Nome com DUAS nacionalidades diferentes e descartado — melhor vazio do que
 * atribuir a bandeira errada a um homonimo.
 */
const nacionalidadePorNome: Map<string, string> = (() => {
  const mapa = new Map<string, string>()
  const conflito = new Set<string>()
  for (const elenco of Object.values(realSquadsTM as Record<string, Array<{ n?: string; c?: string }>>)) {
    if (!Array.isArray(elenco)) continue
    for (const j of elenco) {
      if (!j?.n || !j?.c) continue
      const chave = normalizeTeamName(j.n)
      if (!chave) continue
      const anterior = mapa.get(chave)
      if (anterior && anterior !== j.c) conflito.add(chave)
      else mapa.set(chave, j.c)
    }
  }
  for (const c of conflito) mapa.delete(c)
  return mapa
})()

/**
 * Nacionalidade POR CLUBE. A busca global por nome falha justamente nos casos
 * mais comuns do futebol brasileiro: "Paulinho", "Vitinho" e "Jorginho"
 * aparecem em varios clubes, entao a regra de conflito os descartava; e
 * "Arrascaeta" no TM e "Giorgian de Arrascaeta". Dentro do elenco do clube o
 * nome e praticamente unico, o que resolve os dois casos com seguranca.
 */
const nacPorClube: Map<string, Map<string, string>> = (() => {
  const mapa = new Map<string, Map<string, string>>()
  const porCurto = new Map<string, Map<string, string> | null>()

  for (const [chaveClube, elenco] of Object.entries(
    realSquadsTM as Record<string, Array<{ n?: string; c?: string }>>,
  )) {
    if (!Array.isArray(elenco)) continue
    const porNome = new Map<string, string>()
    for (const j of elenco) {
      if (!j?.n || !j?.c) continue
      porNome.set(normalizeTeamName(j.n), j.c)
    }
    // A chave do TM e "CURTO|nome". O NOME e especifico ("botafogo",
    // "botafogo sp", "botafogo pb") e pode indexar direto.
    const [curto, nome] = chaveClube.split("|")
    const kNome = normalizeTeamName(nome ?? "")
    if (kNome) mapa.set(kNome, porNome)

    // O CURTO nao e unico: BOTAFOGO cobre RJ, SP e PB. Indexar por ele faria o
    // Botafogo-RJ ler o elenco do Botafogo-PB — nacionalidade do atleta errado.
    // So indexamos curtos que apontam para UM unico clube.
    const kCurto = normalizeTeamName(curto ?? "")
    if (kCurto) porCurto.set(kCurto, porCurto.has(kCurto) ? null : porNome)
  }
  for (const [k, v] of porCurto) if (v && !mapa.has(k)) mapa.set(k, v)
  return mapa
})()

/**
 * Elenco do TM correspondente a este clube.
 *
 * Tenta nome, file_key, curto E os APELIDOS ja mapeados em teamAliasOverrides —
 * sem eles, clubes cujo nome difere entre as bases ficavam sem elenco do TM
 * ("Bayern Munich" aqui x "bayern munchen" no TM), o que zerava a nacionalidade
 * e ainda deixava as posicoes grosseiras.
 */
function elencoTmDoClube(team?: Team | null): Map<string, string> | undefined {
  if (!team) return undefined
  const candidatos = [
    team.nome,
    team.file_key,
    team.curto,
    ...(teamAliasOverrides[team.file_key ?? ""] ?? []),
  ]
  for (const c of candidatos) {
    const k = normalizeTeamName(String(c ?? ""))
    if (!k) continue
    const achado = nacPorClube.get(k)
    if (achado) return achado
  }
  return undefined
}

/**
 * Nacionalidade do atleta, em ordem de confianca:
 *   1. o que o seed ja trouxer;
 *   2. nome EXATO dentro do elenco do proprio clube (TM);
 *   3. nome PARCIAL dentro do clube ("Arrascaeta" ⊂ "Giorgian de Arrascaeta"),
 *      aceito so quando ha um unico candidato;
 *   4. nome unico globalmente.
 */
function resolverNac(nome: string, doSeed?: string, team?: Team | null): string | undefined {
  const s = String(doSeed ?? "").trim()
  if (s && s !== "?") return s
  const chave = normalizeTeamName(nome)
  if (!chave) return undefined

  const doClube = elencoTmDoClube(team)
  if (doClube) {
    const exato = doClube.get(chave)
    if (exato) return exato
    // Parcial: um contem o outro. So aceita se houver UM candidato — dois
    // "Silva" no mesmo elenco nao decidem nada.
    let unico: string | undefined
    let quantos = 0
    for (const [k, nac] of doClube) {
      if (k.length >= 4 && (k.includes(chave) || chave.includes(k))) { quantos++; unico = nac }
      if (quantos > 1) break
    }
    if (quantos === 1 && unico) return unico
  }
  return nacionalidadePorNome.get(chave)
}

const teamAliasOverrides: Record<string, string[]> = {
  saojose_rs: ["saojosers_bra", "Sao Jose", "São José"],
  inter_milan: ["Inter de Milao", "Inter de Milão"],
  liverpool: ["liverpool_ing"],
  tottenham: ["tottenhamhotspur_ing"],
  wolves: ["wolverhampton_ing", "Wolverhampton"],
  leicester: ["leicestercity_ing", "Leicester City"],
  atletico_madrid: ["atleticomadrid_esp", "Atletico de Madrid", "Atlético de Madrid"],
  celta_vigo: ["celtadevigo_esp", "Celta de Vigo"],
  las_palmas: ["laspalmas_esp"],
  leganes: ["leganes_esp"],
  valladolid: ["valladolid_esp", "Real Valladolid"],
  ac_milan: ["milan_it", "Milan"],
  lazio: ["lazio_it"],
  lecce: ["lecce_ita"],
  bayern_munich: ["bayern_ale", "Bayern Munchen", "Bayern München"],
  augsburg: ["augsburg_ale", "FC Augsburg"],
  stuttgart: ["sttutgart_ale", "VfB Stuttgart"],
  // 2.Bundesliga cujo nome curado difere do pool imported-bf2026 (senao caem em elenco
  // generico "Reserva" e o overlay real nem e alcancado).
  fc_kaiserslautern: ["Kaiserslautern"],
  hertha_bsc: ["Hertha Berlin"],
  fc_magdeburg: ["Magdeburg"],
  spvgg_greuther_furth: ["Greuther Fürth", "Greuther Furth"],
  marseille: ["olympiquemarseile_fra", "Olympique Marseille"],
  lille: ["lille_fra"],
  lens: ["lens_fr"],
  brest: ["brest_fr", "Stade Brest"],
  reims: ["reims_fr", "Stade Reims"],
  le_havre: ["lehavre_fr", "Le Havre"],
  lafc: ["lafc433_eua"],
  club_america: ["america_mex", "America do Mexico", "América do México"],
  chivas: ["dep_guadalajara_mex", "Deportivo Guadalajara"],
  pumas: ["pumasunam_mex", "UNAM Pumas"],
  toluca: ["toluca_mex", "Deportivo Toluca"],
  leon: ["leon_mex", "Club Leon", "Club León"],
  sporting: ["sporting_por"],
  braga: ["sportingbraga_por", "SC Braga"],
  vitoria_guimaraes: ["vitoriaguimaraes_por", "Vitoria de Guimaraes", "Vitória de Guimarães"],
  nycfc: ["newyorkcity433_eua", "New York City", "NYCFC"],
  ny_red_bulls: ["nwredbull433_eua", "NY Red Bulls", "New York Red Bulls"],
  borussia_mgladbach: ["monchengladbach_ale"],
  mainz: ["fsvmainz_ale"],
  // Ligue 1 extras
  psg: ["parissaintgermain_fr"],
  // La Liga extras
  real_betis: ["betis_esp"],
  alaves: ["alaves_esp"],
  // Premier League extras
  newcastle: ["newcastle_ing"],
  ipswich: ["ipswichtown_ing"],
  // Eredivisie extras
  twente: ["twente_hol"],
  groningen: ["groningen_hol"],
  go_ahead: ["goaheadeagles_hol"],
  // Belgian Pro League extras
  union_sg: ["union_bel"],
  // Primeira Liga extras
  nacional_portugal: ["nacional_por"],
  // MLS extras
  ne_revolution: ["newengland433_eua"],
  // Liga MX extras
  necaxa: ["necaxa_mex"],
  puebla: ["puebla_mex"],
  atletico_san_luis: ["sanluis_mex"],
  tijuana: ["tijuana_mex"],
  // J-League
  vissel_kobe: ["visselkobe_jap"],
  yokohama_marinos: ["yokohamamarinos_jap"],
  urawa_reds: ["urawareds_jap"],
  kashima_antlers: ["kashimaantlers_jap"],
  gamba_osaka: ["gambaosaka_jap"],
  kawasaki_frontale: ["kawasakifrontale_jap"],
  fc_tokyo: ["fctokyo_jap"],
  nagoya_grampus: ["nagoyagrampus_jap"],
  sanfrecce_hiroshima: ["sanfreccehiroshima_jap"],
  cerezo_osaka: ["cerezoosaka_jap"],
  kashiwa_reysol: ["kashiwareysol_jap", "Kashiwa Reysol"],
  avispa_fukuoka: ["avispafukuoka_jap", "Avispa Fukuoka"],
  shonan_bellmare: ["shonan_jap", "Shonan Bellmare"],
  sagan_tosu: ["sagantosu_jap", "Sagan Tosu"],
  jubilo_iwata: ["jubilo_jap", "Jubilo Iwata"],
  albirex_niigata: ["albirex_jap", "Albirex Niigata"],
  tokyo_verdy: ["tokyoverdy_jap", "Tokyo Verdy"],
  machida_zelvia: ["machida_jap", "Machida Zelvia"],
  // Scottish Premiership
  hearts: ["hearts_esc", "Heart of Midlothian"],
  kilmarnock: ["kilmarnock_esc", "Kilmarnock"],
  livingston: ["livingston_esc"],
  // Super Lig
  fenerbahce: ["fenerbahce_tur"],
  basaksehir: ["basaksehir_tur"],
  sivasspor: ["sivasspor_tur"],
  konyaspor: ["konyaspor_tur"],
  antalyaspor: ["antalyspor_tur"],
  kasimpasa: ["kasimpasa_tur"],
  fatih_karagumruk: ["fatihkaragumruk_tur"],
  rizespor: ["caykur_tur", "Rizespor"],
  // Pro League Belgium
  standard_liege: ["standardliege_bel"],
  mechelen: ["kvmechelen_bel"],
  ohl_leuven: ["ohleuven_bel"],
  sint_truiden: ["sinttruidenvv_bel", "VV Sint-Truiden"],
  eupen: ["eupen_bel"],
  // Russian Premier League
  zenit: ["zenit_rus"],
  dynamo_moscow: ["dynamo_rus"],
  lokomotiv_moscow: ["lokomotiv_rus"],
  akhmat_grozny: ["terekgroznyi_rus", "Akhmat Grozny"],
  urals_yekaterinburg: ["ural_rus", "Ural Yekaterinburg"],
  fakel_voronezh: ["fakel_rus"],
  sochi: ["fksochi_rus", "FK Sochi"],
  rubin_kazan: ["rubinkazan_rus", "Rubin Kazan"],
  rostov: ["rostov_rus"],
  krasnodar: ["krasnodar_rus"],
  cska_moscow: ["cskamoscow_rus", "CSKA Moscow"],
  spartak_moscow: ["spartakmoscow_rus", "Spartak Moscow"],
  // Liga Argentina
  estudiantes_lp: ["estudiantes_ar", "Estudiantes de La Plata"],
  velez_sarsfield: ["velezsarsfield_arg", "velez_arg"],
  talleres_cordoba: ["talleres_arg"],
  belgrano_cordoba: ["belgrano_arg"],
  colon_sf: ["colon_arg"],
  san_martin_sj: ["sanmartinsj_ar", "sanmartin_arg"],
  gimnasia_la_plata: ["gimnasialp_arg"],
  // Primera A Colombia
  atletico_nacional: ["nacional_col"],
  junior_baq: ["junior_col"],
  america_cali: ["americacali_col"],
  ind_medellin: ["indepmedellin_col"],
  la_equidad: ["laequidad_col"],
  jaguares_cordoba: ["jaguares_col"],
  boyaca_chico: ["boyaca_col"],
  aguilas_doradas: ["rionegro_col"],
  alianza_fc_col: ["alianza_col"],
  dep_pasto: ["deportivopasto_col"],
  dep_pereira: ["deportivopereira_col"],
  envigado_fc: ["envigado_col"],
  cucuta_dep: ["cucuta_col"],
  // Primera Division Chile
  u_de_chile: ["universidadchile_chi"],
  everton_vina: ["everton_chi"],
  dep_antofagasta: ["antofagasta_chi"],
  dep_iquique: ["deportesiquique_chi"],
  dep_la_serena: ["laserena_chi"],
  rangers_talca: ["rangers_chi"],
  // Primera Division Uruguay
  penarol: ["penarol_uru"],
  nacional_ury: ["nacional_uru"],
  city_torque: ["montevideotorque_uru", "Montevideo City Torque"],
  river_plate_ury: ["riverplate_uru"],
  liverpool_ury: ["liverpool_uru"],
  wanderers_ury: ["wanderers_uru"],
  fenix_ury: ["fenix_uru"],
  racing_ury: ["racing_uru"],
  sud_america_ury: ["sudamerica_uru"],
  cerro_ury: ["cerro_uru"],
  danubio_ury: ["danubio_uru"],
  progreso_ury: ["progreso_uru"],
  // K-League 1
  jeonbuk_hyundai: ["jeonbuk_cor"],
  ulsan_hd: ["ulsan_jap"],
  suwon_samsung: ["suwon_kor"],
  daegu_fc: ["daegu_cor"],
  pohang_steelers: ["pohangsteelers_cor"],
  fc_seoul: ["fcseoul_cor"],
  // Chinese Super League
  shanghai_port: ["shangaisipg_chn", "Shanghai Port"],
  shandong_taishan: ["shandong_chn", "Shandong Taishan"],
  beijing_guoan: ["beijinggoan_chn"],
  chengdu_rongcheng: ["chengduqbao_chn"],
  zhejiang_fc: ["zhejiangYiteng_chn"],
  henan_fc: ["henanjianye_chn"],
  tianjin_jinmen: ["tianjinquanjian_chn"],
  qingdao_hainiu: ["qingdao_chn"],
  shenzhen_fc: ["shenzhen_chn"],
  wuhan_fc: ["wuhanzall_chn"],
  // Saudi Pro League extras
  al_nassr: ["alnassr_ara"],
  al_ahli_saudi: ["al_ahli_ara"],
  al_kholood: ["alkholood_ara"],
  abha_club: ["abha_ara"],
  damac_fc: ["damacfc_ara"],
  // Saudi First Division extras
  al_qadisiyah: ["al_qadisiya_ara"],
  al_faisaly_harma: ["alfaisaly_ara"],
  hajer_fc: ["hajer_ara"],
}

const manualPlayersByTeam: Record<string, Player[]> = {
  "Guarany de Sobral": [
    { nome: "David Lucas", pos: "GOL", idade: 20, base: 60, time: "Guarany de Sobral" },
    { nome: "Gustavo", pos: "GOL", idade: 25, base: 58, time: "Guarany de Sobral" },
    { nome: "Joao Pedro", pos: "GOL", idade: 21, base: 57, time: "Guarany de Sobral" },
    { nome: "Caio Ruan", pos: "ZAG", idade: 31, base: 61, time: "Guarany de Sobral" },
    { nome: "F. Felipe", pos: "ZAG", idade: 26, base: 59, time: "Guarany de Sobral" },
    { nome: "Kauan", pos: "ZAG", idade: 21, base: 57, time: "Guarany de Sobral" },
    { nome: "Lucas Manga", pos: "ZAG", idade: 23, base: 58, time: "Guarany de Sobral" },
    { nome: "Mateus Pereira", pos: "ZAG", idade: 21, base: 57, time: "Guarany de Sobral" },
    { nome: "P. Rodriguez", pos: "ZAG", idade: 20, base: 58, time: "Guarany de Sobral" },
    { nome: "Vinicius Torquato", pos: "ZAG", idade: 22, base: 58, time: "Guarany de Sobral" },
    { nome: "Y. Martins", pos: "LD", idade: 21, base: 57, time: "Guarany de Sobral" },
    { nome: "Alex Cicero", pos: "MEI", idade: 23, base: 62, time: "Guarany de Sobral" },
    { nome: "Bruno Menezes", pos: "MEI", idade: 30, base: 61, time: "Guarany de Sobral" },
    { nome: "Cailan", pos: "MEI", idade: 20, base: 57, time: "Guarany de Sobral" },
    { nome: "Eurico", pos: "MEI", idade: 19, base: 56, time: "Guarany de Sobral" },
    { nome: "Gleryston", pos: "MEI", idade: 30, base: 64, time: "Guarany de Sobral" },
    { nome: "Italo Dude", pos: "MEI", idade: 29, base: 60, time: "Guarany de Sobral" },
    { nome: "Jefferson", pos: "VOL", idade: 33, base: 59, time: "Guarany de Sobral" },
    { nome: "Joao Marcelo", pos: "VOL", idade: 23, base: 59, time: "Guarany de Sobral" },
    { nome: "Pio", pos: "MEI", idade: 38, base: 62, time: "Guarany de Sobral" },
    { nome: "Rodrigo", pos: "MEI", idade: 24, base: 58, time: "Guarany de Sobral" },
    { nome: "Samuel", pos: "MEI", idade: 22, base: 58, time: "Guarany de Sobral" },
    { nome: "T. Dunha", pos: "MEI", idade: 26, base: 60, time: "Guarany de Sobral" },
    { nome: "Diego Costa", pos: "ATA", idade: 23, base: 60, time: "Guarany de Sobral" },
    { nome: "Edgo", pos: "ATA", idade: 24, base: 59, time: "Guarany de Sobral" },
    { nome: "Henrique", pos: "ATA", idade: 21, base: 58, time: "Guarany de Sobral" },
    { nome: "Luizinho", pos: "ATA", idade: 24, base: 59, time: "Guarany de Sobral" },
    { nome: "Pablo", pos: "ATA", idade: 26, base: 58, time: "Guarany de Sobral" },
  ],
}

const MIN_PLAYABLE_SQUAD_SIZE = 18
const FILLER_POSITION_ORDER: Posicao[] = [
  "GOL",
  "ZAG",
  "ZAG",
  "LD",
  "LE",
  "VOL",
  "MEI",
  "MEI",
  "ATA",
  "ATA",
  "ATA",
  "ZAG",
  "VOL",
  "MEI",
  "ATA",
  "LD",
  "LE",
  "GOL",
]

// NOMES PLAUSIVEIS para o preenchimento de elenco curto.
//
// Quando a fonte real traz menos atletas do que um time precisa para jogar, o
// jogo completa o elenco. O nome do preenchimento era o rotulo da posicao —
// "Atacante BAY 3", "Reserva PAL 17" — e denunciava o dado sintetico bem no
// meio do elenco. Sao 567 atletas em 115 clubes (saudita, mexicano, japones,
// onde a coleta traz elenco curto).
//
// Agora recebem nome coerente com o PAIS do clube. Continua sendo dado gerado,
// mas deixa de gritar. Deterministico pelo clube+indice: o mesmo elenco sai
// igual toda vez.
const NOMES_PREENCHIMENTO: Record<string, { pri: string[]; ult: string[] }> = {
  Brasil: { pri: ["Lucas", "Matheus", "Gabriel", "Rafael", "Bruno", "Thiago", "Felipe", "Diego"], ult: ["Silva", "Souza", "Oliveira", "Costa", "Ribeiro", "Almeida", "Barbosa", "Rocha"] },
  Argentina: { pri: ["Juan", "Diego", "Matías", "Nicolás", "Franco", "Lucas", "Agustín", "Tomás"], ult: ["González", "Rodríguez", "Fernández", "López", "Martínez", "Pérez", "Romero", "Díaz"] },
  Espanha: { pri: ["Sergio", "Javier", "Carlos", "Pablo", "Álvaro", "Adrián", "Iker", "Marcos"], ult: ["García", "Martín", "Sánchez", "Ruiz", "Moreno", "Navarro", "Torres", "Gil"] },
  Mexico: { pri: ["José", "Luis", "Miguel", "Ángel", "Carlos", "Jesús", "Emilio", "Andrés"], ult: ["Hernández", "Ramírez", "Flores", "Vargas", "Castillo", "Mendoza", "Reyes", "Cruz"] },
  Japao: { pri: ["Yuto", "Kenta", "Sho", "Takumi", "Riku", "Haruto", "Sota", "Kaito"], ult: ["Tanaka", "Suzuki", "Sato", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi"] },
  Arabia: { pri: ["Ahmed", "Mohammed", "Abdullah", "Faisal", "Khalid", "Omar", "Saud", "Yousef"], ult: ["Al-Harbi", "Al-Qahtani", "Al-Dossari", "Al-Ghamdi", "Al-Shehri", "Al-Otaibi", "Al-Zahrani", "Al-Amri"] },
  Padrao: { pri: ["Alex", "Marco", "David", "Daniel", "Leo", "Ivan", "Nikola", "Stefan"], ult: ["Novak", "Kovac", "Popov", "Horvat", "Petrov", "Marin", "Ilic", "Vidal"] },
}

function poolDeNomes(team: Team) {
  const pais = (team.pais ?? "").toLowerCase()
  const div = String(team.divisao)
  if (pais.includes("brasil") || div.startsWith("serie_")) return NOMES_PREENCHIMENTO.Brasil
  if (pais.includes("argentin")) return NOMES_PREENCHIMENTO.Argentina
  if (pais.includes("espanh") || pais.includes("spain")) return NOMES_PREENCHIMENTO.Espanha
  if (pais.includes("méxic") || pais.includes("mexic")) return NOMES_PREENCHIMENTO.Mexico
  if (pais.includes("jap")) return NOMES_PREENCHIMENTO.Japao
  if (pais.includes("aráb") || pais.includes("arab") || div.includes("saudi")) return NOMES_PREENCHIMENTO.Arabia
  return NOMES_PREENCHIMENTO.Padrao
}

/**
 * Nome deterministico para um atleta de preenchimento, UNICO dentro do elenco.
 *
 * O pool tem 8x8 = 64 combinacoes; sem checar colisao, um elenco de 18 repetia
 * nomes (o qa-rosters pegou: 7 duplicados no Al-Afaq). Tentamos ate achar um
 * livre e, no limite, desempatamos com o indice.
 */
function nomePreenchimento(team: Team, indice: number, usados?: Set<string>): string {
  const pool = poolDeNomes(team)
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    let h = 2166136261
    for (const c of `${team.curto}:${team.file_key ?? ""}:${indice}:${tentativa}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
    const nome = `${pool.pri[(h >>> 0) % pool.pri.length]} ${pool.ult[((h >>> 9) >>> 0) % pool.ult.length]}`
    if (!usados || !usados.has(normalizeTeamName(nome))) {
      usados?.add(normalizeTeamName(nome))
      return nome
    }
  }
  const fallback = `${pool.pri[indice % pool.pri.length]} ${pool.ult[(indice * 3) % pool.ult.length]} ${indice}`
  usados?.add(normalizeTeamName(fallback))
  return fallback
}

function ensurePlayableSquad(team: Team, players: Player[]): Player[] {
  const seenNames = new Set<string>()
  players = players.filter(player => {
    const key = normalizeTeamName(player.nome)
    if (!key || seenNames.has(key)) return false
    seenNames.add(key)
    return true
  })
  // Elenco numeroso tambem pode estar incompleto por posicao. Alguns CSVs da Holanda
  // continham apenas jogadores de linha; o retorno antecipado deixava seis clubes sem
  // goleiro. A garantia de jogabilidade precisa validar composicao, nao so quantidade.
  const withGoalkeeper = players.some((player) => player.pos === "GOL")
    ? players
    : [{ nome: nomePreenchimento(team, 0, seenNames), pos: "GOL" as Posicao, idade: 23, base: Math.max(50, Math.min(72, Math.round(team.prestigio * 0.72))), time: team.nome }, ...players]
  // Além do goleiro, garante cobertura mínima de linhas. Isso protege clubes de bases
  // incompletas sem reclassificar atletas reais: só cria uma peça de reposição quando a
  // linha inteira não existe.
  const covered = [...withGoalkeeper]
  const baseRating = Math.max(48, Math.min(68, Math.round(team.prestigio * 0.7)))
  const addMissing = (label: string, pos: Posicao, exists: (p: Player) => boolean) => {
    if (!covered.some(exists)) covered.push({ nome: nomePreenchimento(team, covered.length + 1, seenNames), pos, idade: 22, base: baseRating, time: team.nome })
  }
  addMissing("Zagueiro", "ZAG", p => ["ZAG", "LD", "LE"].includes(p.pos))
  addMissing("Meio-campista", "VOL", p => ["VOL", "MC", "MEI", "ME", "MD"].includes(p.pos))
  addMissing("Atacante", "ATA", p => ["ATA", "CA", "PE", "PD"].includes(p.pos))
  const ensureCount = (label: string, positions: string[], fallback: Posicao, minimum: number) => {
    while (covered.filter(p => positions.includes(p.pos)).length < minimum) {
      const n = covered.length + 1
      covered.push({ nome: nomePreenchimento(team, n, seenNames), pos: fallback, idade: 21 + (n % 12), base: Math.max(45, baseRating - (n % 6)), time: team.nome })
    }
  }
  ensureCount("Defensor", ["ZAG", "LD", "LE"], "ZAG", 4)
  ensureCount("Meia", ["VOL", "MC", "MEI", "ME", "MD"], "VOL", 3)
  ensureCount("Atacante", ["ATA", "CA", "PE", "PD"], "ATA", 3)
  if (covered.length >= MIN_PLAYABLE_SQUAD_SIZE) return covered

  const fillers = Array.from({ length: MIN_PLAYABLE_SQUAD_SIZE - covered.length }, (_, index) => {
    const squadNumber = covered.length + index + 1
    return {
      nome: nomePreenchimento(team, squadNumber, seenNames),
      pos: FILLER_POSITION_ORDER[(covered.length + index) % FILLER_POSITION_ORDER.length],
      idade: 19 + ((team.prestigio + index) % 13),
      base: Math.max(45, baseRating - (index % 6)),
      time: team.nome,
    }
  })

  return [...covered, ...fillers]
}

/** Time do seed importado (imported-bf2026) que corresponde a este clube, ou undefined. */
function getImportedTeamRaw(team: Team): (typeof importedTeams)[number] | undefined {
  const aliases = [
    ...(teamAliasOverrides[team.file_key] ?? []),
    team.nome,
    team.curto,
    team.file_key,
  ]
  return aliases
    .map((alias) => importedTeamMap.get(normalizeTeamName(alias)))
    .find((match) => match && match.jogadores?.length)
}

function getImportedPlayersForTeam(team: Team): Player[] {
  const importedTeam = getImportedTeamRaw(team)

  if (!importedTeam?.jogadores?.length) return []

  // ── ELENCO REAL (CSV) tem prioridade sobre o seed ────────────────────────
  //
  // O seed `imported-bf2026.json` tem dois defeitos:
  //   1) atribui posicao por INDICE do array (o 1o vira GOL, os seguintes DEF...), por
  //      isso Nick Pope e Ramsdale — goleiros — saiam como ZAGUEIROS;
  //   2) esta DESATUALIZADO (ainda lista jogadores que ja deixaram o clube).
  //
  // Quando o clube esta nos CSVs de elenco, usamos o elenco de LA: nomes e posicoes
  // reais, titulares primeiro. O overall/idade vem do seed quando o jogador existe la;
  // para quem e novo, estimamos a partir do proprio elenco do clube (e so isso — nao
  // inventamos posicao nem nome).
  // aliases saiu para getImportedTeamRaw; findRealSquad ainda precisa deles.
  const aliases = [
    ...(teamAliasOverrides[team.file_key] ?? []),
    team.nome,
    team.curto,
    team.file_key,
  ]
  const realSquad = findRealSquad(team, aliases)

  const seedByName = new Map(
    importedTeam.jogadores.map((p) => [normalizeTeamName(p.nome), p]),
  )

  if (realSquad?.length) {
    // Base para estimar o overall de quem nao esta no seed: mediana do clube.
    const seedOveralls = importedTeam.jogadores
      .map((p) => Math.min(p.overall, MAX_IMPORTED_OVERALL))
      .sort((a, b) => a - b)
    const median = seedOveralls.length
      ? seedOveralls[Math.floor(seedOveralls.length / 2)]
      : 70

    const converted = realSquad.map((p, i) => {
      const seed = seedByName.get(normalizeTeamName(p.nome))
      const globalSeed = seed ?? findUniqueImportedPlayer(p.nome)
      // Titular tende a ser melhor que reserva — degrada levemente pela ordem.
      const estimated = Math.max(55, median - Math.floor(i / 6))
      return {
        nome: p.nome,
        pos: toPlayerPosition(p.pos),
        idade: globalSeed?.idade ?? 25,
        base: globalSeed ? Math.min(globalSeed.overall, MAX_IMPORTED_OVERALL) : estimated,
        time: team.nome,
        nac: resolverNac(p.nome, globalSeed?.nac, team),
      }
    })
    if (converted.some((player) => player.pos === "GOL")) return converted

    // O CSV pode omitir goleiros; recupera os nomes reais do seed do próprio clube.
    const seedGoalkeepers = importedTeam.jogadores
      .filter((player) => toPlayerPosition(player.posicao) === "GOL")
      .map((player) => ({
        nome: player.nome,
        pos: "GOL" as Posicao,
        idade: player.idade ?? 25,
        base: Math.min(player.overall, MAX_IMPORTED_OVERALL),
        time: team.nome,
        nac: resolverNac(player.nome, player.nac, team),
      }))
    return [...seedGoalkeepers, ...converted]
  }

  // Sem CSV para este clube: segue o seed como antes. É o caminho que carrega a
  // nacionalidade real (`nac`), assada no seed pelo apply-tm-squads — a coluna
  // PAÍS do editor lia sempre "-" porque este dado nunca era propagado.
  return importedTeam.jogadores
    .map((player, index) => ({
      nome: player.nome,
      // "BAN" significa apenas banco no arquivo de origem, não uma posição. Antes esses
      // atletas eram descartados e substituídos por reservas fictícios. Preservamos os
      // nomes licenciados e distribuímos apenas os sem posição pelos setores do banco.
      pos: player.posicao?.toUpperCase() === "BAN"
        ? FILLER_POSITION_ORDER[(index - 11 + FILLER_POSITION_ORDER.length) % FILLER_POSITION_ORDER.length]
        : toPlayerPosition(player.posicao),
      idade: player.idade ?? 25,
      base: Math.min(player.overall, MAX_IMPORTED_OVERALL),
      time: team.nome,
      nac: resolverNac(player.nome, player.nac, team),
    }))
}

interface RealSquadPlayer { nome: string; pos: string; titular: boolean }

/**
 * Chave do CLUBE — tira prefixos/sufixos societarios antes de comparar.
 *
 * Sem isto o import falha EM SILENCIO: a planilha diz "FC Barcelona" e o jogo diz
 * "Barcelona"; normalizados viram "fcbarcelona" != "barcelona", nao casam, e o clube
 * simplesmente nao recebe o elenco real — sem nenhum erro aparecer. Mesmo caso de
 * "Olympique de Marseille" x "Olympique Marseille" e "AC Milan" x "Milan".
 *
 * IMPORTANTE: precisa ser identico ao clubKey() de scripts/import-real-positions.mjs.
 */
function clubKey(s: string): string {
  return normalizeTeamName(s)
    .replace(/^(fc|cf|ac|as|rc|sc|ss|afc|rcd|ud|cd|sv|ogc|losc|stade)/, "")
    .replace(/(fc|cf|cfc|ac|sc|afc|club)$/, "")
    .replace(/^olympiquede/, "olympique")
}

/** Elenco real do clube (dos CSVs), se houver. */
function findRealSquad(
  team: { nome: string; curto?: string },
  aliases: string[],
): RealSquadPlayer[] | undefined {
  for (const c of [team.nome, team.curto ?? "", ...aliases]) {
    if (!c) continue
    const hit = REAL_SQUADS[clubKey(c)]
    if (hit?.length) return hit
  }
  return undefined
}

const importedPlayersByTeam: Record<string, Player[]> = Object.fromEntries(
  allTeams.map((team) => [team.nome, getImportedPlayersForTeam(team)])
    .filter(([, players]) => players.length > 0)
)

function getCuratedPlayersByTeam(teamName: string): Player[] {
  const direct = playersByTeam[teamName]
  if (direct) return direct

  const normalizedKey = normalizedTeamKeyMap.get(normalizeTeamName(teamName))
  return normalizedKey ? playersByTeam[normalizedKey] ?? [] : []
}

export const allPlayers: Player[] = [
  ...Object.values(playersByTeam).flat(),
  ...Object.entries(importedPlayersByTeam)
    .filter(([teamName]) => !getCuratedPlayersByTeam(teamName).length)
    .flatMap(([, players]) => players),
  ...Object.entries(manualPlayersByTeam)
    .filter(([teamName]) => !getCuratedPlayersByTeam(teamName).length && !importedPlayersByTeam[teamName]?.length)
    .flatMap(([, players]) => players),
]

export function getPlayersByTeam(teamName: string): Player[] {
  const curated = getCuratedPlayersByTeam(teamName)
  if (curated.length) return curated

  return importedPlayersByTeam[teamName] ?? manualPlayersByTeam[teamName] ?? []
}

const DIVISION_RATING_CAP: Record<string, number> = {
  serie_a: 92,
  serie_b: 81,
  serie_c: 74,
  serie_d: 67,
}

// Escala comum para todo o banco. O seed legado misturava escalas (alguns clubes
// tinham atletas 100–102 e outros ficavam todos em 55). A força da liga define o
// centro, o prestígio ajusta o clube e a ordem relativa preserva quem é destaque.
const DIVISION_RATING_BASE: Record<string, number> = {
  premier_league: 76, la_liga: 75, serie_a_ita: 74, bundesliga: 74, ligue_1: 73,
  primeira_liga: 71, eredivisie: 71, pro_league_bel: 69, scottish_prem: 68,
  serie_a: 70, liga_argentina: 69, primera_a_col: 67, primera_div_chi: 66,
  primera_div_ury: 66, serie_b: 63, serie_c: 57, serie_d: 52,
  saudi_pro: 70, mls: 68, liga_mx: 68, j_league: 67, k_league_1: 66,
}

// Correspondências publicadas na base oficial FC 26. São aplicadas somente por nome
// exato normalizado; os demais recebem a calibração de liga/clube acima.
const OFFICIAL_RATING_OVERRIDES: Record<string, number> = {
  virgilvandijk: 90, judebellingham: 90, erlinghaaland: 90, raphinha: 89,
  alisson: 89, vinijr: 89, florianwirtz: 89, harrykane: 89, federicovalverde: 89,
  kevindebruyne: 87, frenkiedejong: 87, declanrice: 87, martinodegaard: 87,
  brunofernandes: 87, brunoguimaraes: 86, rubendias: 86,
}

function calibrateSquadRatings(team: Team, players: Player[]): Player[] {
  if (players.length === 0) return players
  const leagueBase = DIVISION_RATING_BASE[String(team.divisao)] ?? Math.max(52, Math.min(72, 55 + Math.round(team.prestigio * 0.2)))
  const clubAdjustment = Math.max(-4, Math.min(4, Math.round((team.prestigio - 70) * 0.16)))
  const ordered = [...players].sort((a, b) => b.base - a.base || a.nome.localeCompare(b.nome))
  const rank = new Map(ordered.map((player, index) => [player, index]))
  const middle = [...players].map(player => player.base).sort((a, b) => a - b)[Math.floor(players.length / 2)] ?? leagueBase

  return players.map(player => {
    const official = OFFICIAL_RATING_OVERRIDES[normalizeTeamName(player.nome)]
    if (official != null) return { ...player, base: official }
    const percentile = players.length <= 1 ? 0.5 : (rank.get(player) ?? 0) / (players.length - 1)
    const rankAdjustment = Math.round(7 - percentile * 13)
    const sourceSignal = Math.max(-2, Math.min(2, Math.round((player.base - middle) * 0.15)))
    return { ...player, base: Math.max(40, Math.min(91, leagueBase + clubAdjustment + rankAdjustment + sourceSignal)) }
  })
}

/**
 * Anexa nacionalidade (e a referência de foto) do seed aos jogadores CURADOS.
 *
 * O índice curado (players_br.json) tem prioridade e só guarda nome/pos/idade/
 * overall — nunca nac/ft. Era por isso que o editor mostrava PAÍS "-" para
 * Corinthians, São Paulo etc. mesmo com a nacionalidade assada no seed: o
 * caminho curado ganhava e descartava o dado. Aqui casamos por NOME dentro do
 * mesmo clube (o seed importado do próprio time) e preenchemos o que falta.
 */
function enrichWithSeedNationality(team: Team, players: Player[]): Player[] {
  if (players.every(p => p.nac)) return players
  const seedPlayers = getImportedTeamRaw(team)?.jogadores ?? []
  if (!seedPlayers.length) return players
  const byName = new Map(seedPlayers.map(p => [normalizeTeamName(p.nome), p]))
  return players.map(p => {
    if (p.nac) return p
    const seed = byName.get(normalizeTeamName(p.nome))
    return seed?.nac ? { ...p, nac: seed.nac } : p
  })
}

// ─── Elencos REAIS (Transfermarkt) ─────────────────────────────────────────────
// Camada de MAIOR prioridade: quando existe elenco real para o clube, ele
// substitui o roster (nomes/posição/nacionalidade/overall reais), em vez de só
// remendar o fictício. Gerado por scripts/build-real-squads.mjs; chave
// `<curto>|<nomeNormalizado>` (mesma do tm-squads). Clubes sem entrada aqui
// seguem pelo caminho antigo — a maioria dos ~1.050 fictícios de divisão menor.
// Chaves curtas para nao inchar o bundle (45 mil atletas):
// n=nome p=posicao c=nacionalidade f=foto i=idade o=overall
interface RealSquadPlayerTM { n: string; p: string; c?: string; f?: string; i: number; o: number }
const REAL_SQUADS_TM = realSquadsTM as Record<string, RealSquadPlayerTM[]>

/**
 * Elenco real indexado por NOME do clube, para quando a chave composta falha.
 *
 * A busca original exigia `CURTO|nome` EXATO. O `curto` do clube curado nem
 * sempre e o mesmo do Transfermarkt (curado "LIV" x TM "LIVERPOO"), entao
 * clubes grandes — Liverpool, Bayern, Dortmund, Lazio, Gremio — nao achavam o
 * proprio elenco real e caiam no caminho ficticio: perdiam nacionalidade,
 * posicoes finas (ficavam so GOL/ZAG/MEI/ATA) e o overall real.
 *
 * Nome que aparece em MAIS DE UM clube (Botafogo RJ/SP/PB) fica de fora deste
 * indice — carregar o elenco do clube errado seria pior do que nao carregar.
 */
const REAL_SQUADS_POR_NOME: Map<string, RealSquadPlayerTM[]> = (() => {
  const mapa = new Map<string, RealSquadPlayerTM[]>()
  const duplicados = new Set<string>()
  for (const [chave, roster] of Object.entries(REAL_SQUADS_TM)) {
    const nome = normalizeTeamName(chave.split("|")[1] ?? "")
    if (!nome || !roster?.length) continue
    if (mapa.has(nome)) duplicados.add(nome)
    else mapa.set(nome, roster)
  }
  for (const d of duplicados) mapa.delete(d)
  return mapa
})()

function getRealSquad(team: Team): Player[] | null {
  const roster = REAL_SQUADS_TM[`${team.curto}|${normalizeTeamName(team.nome)}`]
    ?? REAL_SQUADS_POR_NOME.get(normalizeTeamName(team.nome))
    ?? (teamAliasOverrides[team.file_key ?? ""] ?? [])
      .map(a => REAL_SQUADS_POR_NOME.get(normalizeTeamName(a)))
      .find(Boolean)
  if (!roster?.length) return null
  return roster.map(p => ({
    nome: p.n,
    pos: toPlayerPosition(p.p),
    idade: p.i,
    base: p.o,
    time: team.nome,
    nac: p.c,
  }))
}

export function getPlayersForTeam(team: Team, opts?: { raw?: boolean }): Player[] {
  const indexed = getPlayersByTeam(team.nome)
  // Clubes do pool completo não fazem parte de `allTeams` e, portanto, não entram no
  // índice curado criado no boot. Consultar a importação diretamente evita que os quase
  // 3 mil clubes recebam um elenco inteiramente genérico.
  // ORDEM DE PRIORIDADE (importa):
  //   1. overlay dos CSVs (real-positions) — e o elenco MAIS ATUAL (2026/27);
  //   2. elenco real do Transfermarkt;
  //   3. curado > importado.
  //
  // O overlay do CSV precisa vir ANTES do TM. Quando ampliei o casamento do TM
  // por nome do clube, ele passou a vencer o CSV e trouxe de volta atletas que
  // ja tinham saido (Gillespie/Ramsdale/Trippier voltaram ao Newcastle) — o
  // qa-real-positions pegou. O TM cobre os clubes que o CSV nao alcanca.
  const temOverlayCsv = Boolean(findRealSquad(team, teamAliasOverrides[team.file_key ?? ""] ?? []))
  const sourceRaw = (temOverlayCsv ? null : getRealSquad(team))
    ?? enrichWithSeedNationality(team, indexed.length ? indexed : getImportedPlayersForTeam(team))
  // Remove quem foi contratado pelo usuário: sem isto o atleta ficava nos DOIS
  // elencos (relato "contratei o Neymar mas ele continua no Santos"). O editor
  // pede `raw` e nesse modo NAO filtramos — ali o objetivo e ver o elenco
  // original do clube, edicoes e transferencias a parte.
  // Sai quem foi embora E entra quem CHEGOU. As chegadas fecham o outro lado da
  // transferencia entre clubes da IA: antes so a saida era registrada, entao o
  // atleta sumia do vendedor e nao aparecia em lugar nenhum — o mundo perdia
  // jogadores. Ver [[world-market]]. No modo `raw` (editor) nada disso se aplica.
  // ATUALIZACAO OFICIAL DE ELENCOS (servidor). Vem ANTES das transferencias da
  // partida: e o elenco de partida corrigido, nao um movimento do save. Aplica
  // tambem no modo `raw` — o editor tem de mostrar o elenco ja atualizado, senao
  // quem edita trabalha em cima de dado velho.
  const comAtualizacaoOficial = temTransferencias()
    ? (() => {
        const ficam = sourceRaw.filter(p => !saiuDoClube(team.nome, p.nome))
        const chegaram = chegouAoClube(team.nome)
        if (chegaram.length === 0) return ficam
        const jaTem = new Set(ficam.map(p => p.nome.toLowerCase()))
        const novos = chegaram
          .filter(t => !jaTem.has((t.nome ?? "").toLowerCase()))
          .map(t => ({
            nome: t.nome,
            pos: (t.pos ?? "MEI") as Player["pos"],
            idade: t.idade ?? 24,
            base: t.base ?? 70,
            time: team.nome,
            nac: t.nac,
          }))
        return [...ficam, ...novos]
      })()
    : sourceRaw

  const source = opts?.raw
    ? comAtualizacaoOficial
    : (() => {
        const semSaidas = comAtualizacaoOficial.filter(p => !hasDeparted(team.nome, p.nome))
        if (!hasAnyArrival()) return semSaidas
        const chegadas = getArrivals(team.nome)
        if (chegadas.length === 0) return semSaidas
        const jaTem = new Set(semSaidas.map(p => p.nome.toLowerCase()))
        const novos = chegadas
          .filter(a => !jaTem.has(a.nome.toLowerCase()))
          .map(a => ({ nome: a.nome, pos: a.pos as Player["pos"], idade: a.idade, base: a.base, time: team.nome, nac: a.nac }))
        return [...semSaidas, ...novos]
      })()
  const players = calibrateSquadRatings(team, ensurePlayableSquad(team, source))
  const cap = DIVISION_RATING_CAP[team.divisao as string] ?? 92
  const capped = cap >= 92 ? players : players.map(p => p.base > cap ? { ...p, base: cap } : p)
  // raw = sem overrides (o editor precisa dos NOMES ORIGINAIS para chavear as edicoes).
  return opts?.raw ? capped : applyPlayerOverrides(team.file_key, capped)
}

// Aplica as edicoes de jogador (nome/posicao/overall) feitas no editor. A chave usa o nome
// ORIGINAL, entao a edicao sobrevive mesmo depois de renomear.
function applyPlayerOverrides(fileKey: string, players: Player[]): Player[] {
  if (!fileKey) return players
  return players.map((p) => {
    const ov = getPlayerOverride(fileKey, p.nome)
    if (!ov) return p
    // AS CARACTERISTICAS VALEM NA PARTIDA. Cada uma soma no atributo que reforca
    // (Cabeceio -> fisico, Velocidade -> ritmo, e assim por diante). Sem isto
    // seriam rotulo: o editor prometeria diferenca e o motor jogaria igual.
    // Aplicado DEPOIS dos atributos editados a mao, para o bonus somar sobre o
    // valor que o editor mostra.
    const bonus = bonusDasCaracteristicas(ov.traits)
    const comBonus = (chave: keyof typeof bonus, atual?: number) => {
      const ganho = bonus[chave]
      if (!ganho || atual == null) return {}
      return { [chave]: Math.min(99, atual + ganho) }
    }
    const baseDoAtributo = {
      pace: ov.pace ?? p.pace, shooting: ov.shooting ?? p.shooting,
      passing: ov.passing ?? p.passing, dribbling: ov.dribbling ?? p.dribbling,
      defending: ov.defending ?? p.defending, physical: ov.physical ?? p.physical,
    }
    return {
      ...p,
      ...(ov.nome ? { nome: ov.nome } : {}),
      ...(ov.pos ? { pos: ov.pos } : {}),
      ...(ov.base != null ? { base: ov.base } : {}),
      ...(ov.idade != null ? { idade: ov.idade } : {}),
      ...(ov.pace != null ? { pace: ov.pace } : {}),
      ...(ov.shooting != null ? { shooting: ov.shooting } : {}),
      ...(ov.passing != null ? { passing: ov.passing } : {}),
      ...(ov.dribbling != null ? { dribbling: ov.dribbling } : {}),
      ...(ov.defending != null ? { defending: ov.defending } : {}),
      ...(ov.physical != null ? { physical: ov.physical } : {}),
      ...(ov.preferredFoot ? { preferredFoot: ov.preferredFoot } : {}),
      ...(ov.reputation ? { reputation: ov.reputation } : {}),
      ...(ov.nac ? { nac: ov.nac } : {}),
      ...(ov.traits ? { traits: ov.traits } : {}),
      ...comBonus("pace", baseDoAtributo.pace),
      ...comBonus("shooting", baseDoAtributo.shooting),
      ...comBonus("passing", baseDoAtributo.passing),
      ...comBonus("dribbling", baseDoAtributo.dribbling),
      ...comBonus("defending", baseDoAtributo.defending),
      ...comBonus("physical", baseDoAtributo.physical),
    }
  })
}

const POSITION_ORDER: Record<string, number> = {
  GOL: 0,
  ZAG: 1,
  LD: 2,
  LE: 3,
  VOL: 4,
  MC: 4,
  MEI: 5,
  ME: 5,
  MD: 5,
  CA: 6,
  ATA: 6,
  PE: 7,
  PD: 7,
}

export function sortByPosition(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const oa = POSITION_ORDER[a.pos] ?? 99
    const ob = POSITION_ORDER[b.pos] ?? 99
    if (oa !== ob) return oa - ob
    return b.base - a.base
  })
}

export function teamRating(teamName: string): number {
  const list = getPlayersByTeam(teamName)
  if (!list.length) return 0
  const top = [...list].sort((a, b) => b.base - a.base).slice(0, 11)
  return Math.round(top.reduce((s, p) => s + p.base, 0) / top.length)
}

export function teamRatings(): Record<string, number> {
  return Object.fromEntries(allTeams.map(t => [t.nome, teamRating(t.nome)]))
}

/**
 * FORCA REAL DO ELENCO POR LINHA — ataque, meio e defesa.
 *
 * Use esta, nao `teamRating`. A diferenca importa:
 *
 * `teamRating` recebe um NOME e chama `getPlayersByTeam`, que devolve o seed
 * CRU — sem passar por `calibrateSquadRatings`. O seed legado mistura escalas
 * (clubes com atletas 100+ ao lado de clubes todos em 55), e a calibracao e
 * justamente o que ancora tudo na forca da liga e no prestigio do clube.
 * Resultado: `teamRating` devolvia ~90 para Palmeiras, Corinthians, Flamengo,
 * Santos E Bahia — todos iguais e todos inflados. A tela de partida rapida
 * mostrava 88-92 e alimentava a simulacao com esse numero.
 *
 * Aqui partimos de `getPlayersForTeam(team)`, que e o elenco real ja calibrado:
 * os mesmos clubes viram 78, 78, 79, 77 e 77 — diferenciados e na escala certa.
 *
 * Cada linha usa os jogadores que de fato entrariam nela, nao o elenco inteiro,
 * senao o terceiro goleiro e o lateral reserva puxariam a media para baixo.
 * Usamos `base` (o overall calibrado) e nao os atributos individuais: eles sao
 * opcionais — so existem para atletas editados no editor — e NAO passam pela
 * calibracao, entao misturar os dois traria de volta a escala furada.
 */
export interface TeamSectorRatings {
  /** Media dos 11 melhores — o overall do time. */
  overall: number
  ata: number
  mei: number
  def: number
}

export function teamSectorRatings(team: Team): TeamSectorRatings {
  const squad = getPlayersForTeam(team)
  if (!squad.length) {
    // Sem elenco, o prestigio e a unica informacao real disponivel.
    const fromPrestige = Math.max(45, Math.min(90, 45 + Math.round(team.prestigio * 0.5)))
    return { overall: fromPrestige, ata: fromPrestige, mei: fromPrestige, def: fromPrestige }
  }

  const melhores = (posicoes: string[], quantos: number): number => {
    const grupo = squad
      .filter(p => posicoes.includes(p.pos))
      .sort((a, b) => b.base - a.base)
      .slice(0, quantos)
    if (!grupo.length) return 0
    return grupo.reduce((s, p) => s + p.base, 0) / grupo.length
  }

  const top11 = [...squad].sort((a, b) => b.base - a.base).slice(0, 11)
  const overall = Math.round(top11.reduce((s, p) => s + p.base, 0) / top11.length)

  // Quantidades de uma formacao comum (3 na frente, 4 no meio, 4 atras + goleiro).
  // Linha vazia cai no overall: melhor repetir o time do que exibir zero.
  const ata = melhores(["ATA", "PE", "PD"], 3) || overall
  const mei = melhores(["MEI", "VOL"], 4) || overall
  const defLinha = melhores(["ZAG", "LD", "LE"], 4)
  const gol = melhores(["GOL"], 1)
  const def = defLinha && gol ? (defLinha * 4 + gol) / 5 : (defLinha || gol || overall)

  return { overall, ata: Math.round(ata), mei: Math.round(mei), def: Math.round(def) }
}
