"use client"

/** TypeScript types for BF2026-27 imported data */

export interface BFTeam {
  id: string
  nome: string
  curto: string
  cor1: string
  cor2: string
  estadio: string
  tecnico: string
  pais: string
  liga: string
  divisao: string
  prestigio: number
  saldo: number
  escudo: string
  escudoDisponivel: boolean
  fileKey: string
  nJogadores: number
}

export interface BFTeamsIndex {
  version: string
  count: number
  teams: BFTeam[]
}

/** Region groupings for UI filtering */
export const REGIOES: Record<string, string[]> = {
  brasil: ["Brasil"],
  europa: ["Inglaterra","Espanha","Alemanha","Itália","França","Portugal","Holanda",
           "Bélgica","Áustria","Suíça","Turquia","Rússia","Ucrânia","Croácia","Sérvia",
           "Grécia","Noruega","Suécia","Dinamarca","Escócia"],
  americas: ["Argentina","Uruguai","Chile","Colômbia","Paraguai","Peru","Equador",
             "Bolívia","Venezuela","EUA","México","Brasil"],
  africa_asia: ["Japão","Austrália","Marrocos","Egito","Emirados","Catar","Arábia Saudita"],
}

/** Flags for countries */
export const PAIS_FLAG: Record<string, string> = {
  Brasil: "🇧🇷", Argentina: "🇦🇷", Uruguai: "🇺🇾", Chile: "🇨🇱",
  Colômbia: "🇨🇴", Paraguai: "🇵🇾", Peru: "🇵🇪", Equador: "🇪🇨",
  Bolívia: "🇧🇴", Venezuela: "🇻🇪", EUA: "🇺🇸", México: "🇲🇽",
  Inglaterra: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Espanha: "🇪🇸", Alemanha: "🇩🇪", Itália: "🇮🇹",
  França: "🇫🇷", Portugal: "🇵🇹", Holanda: "🇳🇱", Bélgica: "🇧🇪",
  Áustria: "🇦🇹", Suíça: "🇨🇭", Turquia: "🇹🇷", Rússia: "🇷🇺",
  Ucrânia: "🇺🇦", Croácia: "🇭🇷", Sérvia: "🇷🇸", Grécia: "🇬🇷",
  Noruega: "🇳🇴", Suécia: "🇸🇪", Dinamarca: "🇩🇰", Escócia: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  Japão: "🇯🇵", Austrália: "🇦🇺", Marrocos: "🇲🇦", Egito: "🇪🇬",
  Emirados: "🇦🇪", Catar: "🇶🇦", "Arábia Saudita": "🇸🇦",
}

let cachedIndex: BFTeamsIndex | null = null

export async function loadBFTeams(): Promise<BFTeamsIndex> {
  if (cachedIndex) return cachedIndex
  const res = await fetch("/data/teams-index.json")
  if (!res.ok) throw new Error(`Failed to load teams index: ${res.status}`)
  cachedIndex = await res.json() as BFTeamsIndex
  return cachedIndex
}

/** Group teams by country, then by league within each country */
export function groupByCountryAndLeague(teams: BFTeam[]): Map<string, Map<string, BFTeam[]>> {
  const result = new Map<string, Map<string, BFTeam[]>>()
  for (const team of teams) {
    if (!result.has(team.pais)) result.set(team.pais, new Map())
    const leagues = result.get(team.pais)!
    if (!leagues.has(team.liga)) leagues.set(team.liga, [])
    leagues.get(team.liga)!.push(team)
  }
  return result
}

/** Get region name for a country */
export function getRegiao(pais: string): string {
  for (const [regiao, paises] of Object.entries(REGIOES)) {
    if (paises.includes(pais)) return regiao
  }
  return "outros"
}

/** Get flag emoji for country */
export function getFlag(pais: string): string {
  return PAIS_FLAG[pais] ?? "🌍"
}

/** Sort countries in a region by team count (desc) */
export function sortedCountries(teams: BFTeam[], regiao: string): string[] {
  const paisSet = new Set<string>()
  for (const t of teams) {
    if (regiao === "all" || getRegiao(t.pais) === regiao) {
      paisSet.add(t.pais)
    }
  }
  const counts = new Map<string, number>()
  for (const t of teams) {
    if (paisSet.has(t.pais)) counts.set(t.pais, (counts.get(t.pais) || 0) + 1)
  }
  return [...paisSet].sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))
}
