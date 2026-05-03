// Dados dos times brasileiros — carregados das seeds locais (offline).
// Origem: https://github.com/jovemegidio/Ultrafoot (data/seeds)

import teamsBR from "@/data/seeds/teams_br.json"
import metaOverrides from "@/data/seeds/team_metadata_overrides.json"
import divisionOverrides from "@/data/seeds/division_overrides_2026.json"

export type Divisao = "serie_a" | "serie_b" | "serie_c" | "serie_d" | "sem_divisao"

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
  divisao: Divisao
}

export interface TeamUniforms {
  home: { primary: string; secondary: string; pattern: "solid" | "stripes" | "diagonal" }
  away: { primary: string; secondary: string; pattern: "solid" | "stripes" | "diagonal" }
  third: { primary: string; secondary: string; pattern: "solid" | "stripes" | "diagonal" }
}

interface RawTeam {
  nome: string
  curto: string
  cidade?: string
  estado: string
  cor1: string
  cor2: string
  prestigio: number
  torcida: number
  estadio_cap: number
  saldo: number
  file_key: string
  estadio_nome?: string
  patrocinador?: string
}

const META = metaOverrides as Record<string, { estadio_nome?: string; patrocinador?: string }>

export function getEscudoUrl(fileKey: string): string {
  return `/escudos/${fileKey}.png`
}

export function getEscudoMiniUrl(fileKey: string): string {
  return `/escudos-mini/${fileKey}.png`
}

export function getLogoUrl(): string {
  return "/brand/logo.png"
}

export function getIconeUrl(): string {
  return "/brand/icone.png"
}

function normalize(raw: RawTeam, divisao: Divisao): Team {
  const meta = META[raw.file_key] ?? {}
  return {
    nome: raw.nome,
    curto: raw.curto,
    cidade: raw.cidade ?? "",
    estado: raw.estado,
    cor1: raw.cor1,
    cor2: raw.cor2,
    prestigio: raw.prestigio,
    torcida: raw.torcida,
    estadio_cap: raw.estadio_cap,
    saldo: raw.saldo,
    file_key: raw.file_key,
    estadio_nome: raw.estadio_nome ?? meta.estadio_nome ?? "",
    patrocinador: raw.patrocinador ?? meta.patrocinador ?? "",
    escudo_url: getEscudoUrl(raw.file_key),
    divisao,
  }
}

const RAW = teamsBR as Record<Divisao, RawTeam[]>

export const serieATeams: Team[] = (RAW.serie_a ?? []).map(t => normalize(t, "serie_a"))
export const serieBTeams: Team[] = (RAW.serie_b ?? []).map(t => normalize(t, "serie_b"))
export const serieCTeams: Team[] = (RAW.serie_c ?? []).map(t => normalize(t, "serie_c"))
export const serieDTeams: Team[] = (RAW.serie_d ?? []).map(t => normalize(t, "serie_d"))
export const semDivisaoTeams: Team[] = (RAW.sem_divisao ?? []).map(t => normalize(t, "sem_divisao"))

export const allTeams: Team[] = [
  ...serieATeams,
  ...serieBTeams,
  ...serieCTeams,
  ...serieDTeams,
  ...semDivisaoTeams,
]

const byShort = new Map<string, Team>(allTeams.map(t => [t.curto, t]))
const byFileKey = new Map<string, Team>(allTeams.map(t => [t.file_key, t]))
const byNome = new Map<string, Team>(allTeams.map(t => [t.nome, t]))

export function getTeamByShort(curto: string): Team | undefined {
  return byShort.get(curto)
}

export function getTeamByFileKey(fileKey: string): Team | undefined {
  return byFileKey.get(fileKey)
}

export function getTeamByNome(nome: string): Team | undefined {
  return byNome.get(nome)
}

// Times oficiais da Série A 2026 (override aplicado pela liga)
export function getOfficialSerieA2026(): Team[] {
  const names = (divisionOverrides as Record<string, string[]>).serie_a ?? []
  return names
    .map(n => byNome.get(n))
    .filter((t): t is Team => Boolean(t))
}

const STRIPE_TEAMS = new Set([
  "FLM", "BTF", "VDG", "TLT", "SPL", "GRM", "SNT", "BAH", "NTR", "VTR", "SPR",
])

export function getTeamUniforms(team: Team): TeamUniforms {
  const stripes = STRIPE_TEAMS.has(team.curto)
  return {
    home: {
      primary: team.cor1,
      secondary: team.cor2,
      pattern: stripes ? "stripes" : "solid",
    },
    away: {
      primary: team.cor2,
      secondary: team.cor1,
      pattern: "solid",
    },
    third: {
      primary: "#1a1a2e",
      secondary: team.cor1,
      pattern: "diagonal",
    },
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}
