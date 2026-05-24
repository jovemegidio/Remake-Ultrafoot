// Jogadores brasileiros — carregados das seeds locais (offline).
// Origem: https://github.com/jovemegidio/Ultrafoot (data/seeds/players_br.json)

import playersBR from "@/data/seeds/players_br.json"
import importedBF2026 from "@/data/seeds/imported-bf2026.json"
import { allTeams, type Team } from "@/lib/teams-data"

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
  nycfc: ["New York City", "NYCFC"],
  ny_red_bulls: ["NY Red Bulls", "New York Red Bulls"],
  borussia_mgladbach: ["Borussia Monchengladbach", "Borussia Mgladbach"],
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

export function getPlayersForTeam(team: Team): Player[] {
  return ensurePlayableSquad(team, getPlayersByTeam(team.nome))
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
