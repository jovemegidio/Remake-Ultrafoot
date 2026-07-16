// Jogadores brasileiros — carregados das seeds locais (offline).
// Origem: https://github.com/jovemegidio/Ultrafoot (data/seeds/players_br.json)

import playersBR from "@/data/seeds/players_br.json"
import importedBF2026 from "@/data/seeds/imported-bf2026.json"
// Elencos REAIS por clube (gerado por scripts/import-real-positions.mjs a partir dos
// CSVs). Corrige as posicoes que o seed atribui por indice E o elenco desatualizado.
import realSquadsJson from "@/data/seeds/real-positions.json"
import { allTeams, type Team } from "@/lib/teams-data"
import { getPlayerOverride } from "@/lib/player-overrides"

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
}

const RAW = playersBR as Record<string, Array<{ nome: string; pos: string; idade: number; base: number }>>
const IMPORTED = importedBF2026 as {
  teams?: Array<{
    id?: string
    nome: string
    curto?: string
    jogadores?: Array<{ nome: string; posicao: string; idade: number; overall: number }>
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
  if (normalized === "ATA") return "ATA"
  return normalized
}

const MAX_IMPORTED_OVERALL = 92

export const playersByTeam: Record<string, Player[]> = Object.fromEntries(
  Object.entries(RAW).map(([time, list]) => [
    time,
    list.map(p => ({ ...p, time })),
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

function ensurePlayableSquad(team: Team, players: Player[]): Player[] {
  if (players.length >= MIN_PLAYABLE_SQUAD_SIZE) return players

  const baseRating = Math.max(48, Math.min(68, Math.round(team.prestigio * 0.7)))
  const fillers = Array.from({ length: MIN_PLAYABLE_SQUAD_SIZE - players.length }, (_, index) => {
    const squadNumber = players.length + index + 1
    return {
      nome: `Reserva ${team.curto} ${squadNumber}`,
      pos: FILLER_POSITION_ORDER[(players.length + index) % FILLER_POSITION_ORDER.length],
      idade: 19 + ((team.prestigio + index) % 13),
      base: Math.max(45, baseRating - (index % 6)),
      time: team.nome,
    }
  })

  return [...players, ...fillers]
}

function getImportedPlayersForTeam(team: Team): Player[] {
  const aliases = [
    ...(teamAliasOverrides[team.file_key] ?? []),
    team.nome,
    team.curto,
    team.file_key,
  ]

  const importedTeam = aliases
    .map((alias) => importedTeamMap.get(normalizeTeamName(alias)))
    .find((match) => match && match.jogadores?.length)

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

    return realSquad.map((p, i) => {
      const seed = seedByName.get(normalizeTeamName(p.nome))
      // Titular tende a ser melhor que reserva — degrada levemente pela ordem.
      const estimated = Math.max(55, median - Math.floor(i / 6))
      return {
        nome: p.nome,
        pos: p.pos as Posicao,
        idade: seed?.idade ?? 25,
        base: seed ? Math.min(seed.overall, MAX_IMPORTED_OVERALL) : estimated,
        time: team.nome,
      }
    })
  }

  // Sem CSV para este clube: segue o seed como antes.
  return importedTeam.jogadores
    .filter((player) => player.posicao?.toUpperCase() !== "BAN")
    .map((player) => ({
      nome: player.nome,
      pos: toPlayerPosition(player.posicao),
      idade: player.idade ?? 25,
      base: Math.min(player.overall, MAX_IMPORTED_OVERALL),
      time: team.nome,
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

export function getPlayersForTeam(team: Team, opts?: { raw?: boolean }): Player[] {
  const players = ensurePlayableSquad(team, getPlayersByTeam(team.nome))
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
    return {
      ...p,
      ...(ov.nome ? { nome: ov.nome } : {}),
      ...(ov.pos ? { pos: ov.pos } : {}),
      ...(ov.base != null ? { base: ov.base } : {}),
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
  CA: 5,
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
