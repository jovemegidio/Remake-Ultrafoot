"use client"

/** TypeScript types for BF2026-27 imported data */
import { normalizeCountry } from "@/lib/country-normalize"

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
    // Sem normalizar, o mesmo país aparecia partido em várias entradas: 126
    // clubes brasileiros trazem a SIGLA DO ESTADO no campo `pais` (Nova Iguaçu
    // = "RJ", Cruzeiro = "BR"), e códigos de 3 letras convivem com o nome por
    // extenso. Ver lib/country-normalize.ts.
    const pais = normalizeCountry(team.pais)
    if (!result.has(pais)) result.set(pais, new Map())
    const leagues = result.get(pais)!
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
    const pais = normalizeCountry(t.pais)
    if (regiao === "all" || getRegiao(pais) === regiao) {
      paisSet.add(pais)
    }
  }
  const counts = new Map<string, number>()
  for (const t of teams) {
    const pais = normalizeCountry(t.pais)
    if (paisSet.has(pais)) counts.set(pais, (counts.get(pais) || 0) + 1)
  }
  return [...paisSet].sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))
}
