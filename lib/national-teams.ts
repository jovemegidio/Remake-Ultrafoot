// Selecoes nacionais derivadas dos clubes de cada pais.
// Como os jogadores do jogo nao tem nacionalidade explicita, o elenco de uma
// selecao e formado pelos melhores atletas que atuam em clubes daquele pais
// (abordagem "selecao com base nos jogadores da liga local").

import { allTeams, allBrazilianTeams, type Team } from "@/lib/teams-data"
import { getPlayersForTeam, sortByPosition, type Player } from "@/lib/players-data"

export type Confederation = "CONMEBOL" | "UEFA" | "CONCACAF" | "AFC"

export interface NationalTeam {
  id: string
  name: string
  code: string
  confederation: Confederation
  cor1: string
  cor2: string
  // Nome do pais usado no campo `pais` dos clubes (vazio = clubes brasileiros)
  countryKey: string
}

// Catalogo de selecoes suportadas. countryKey casa com o campo `pais` dos clubes.
export const NATIONAL_TEAMS: NationalTeam[] = [
  // CONMEBOL
  { id: "brasil", name: "Brasil", code: "BRA", confederation: "CONMEBOL", cor1: "#ffd400", cor2: "#009b3a", countryKey: "" },
  { id: "argentina", name: "Argentina", code: "ARG", confederation: "CONMEBOL", cor1: "#6cace4", cor2: "#ffffff", countryKey: "Argentina" },
  { id: "uruguai", name: "Uruguai", code: "URU", confederation: "CONMEBOL", cor1: "#5cbfeb", cor2: "#ffffff", countryKey: "Uruguai" },
  { id: "colombia", name: "Colombia", code: "COL", confederation: "CONMEBOL", cor1: "#fcd116", cor2: "#003893", countryKey: "Colombia" },
  { id: "chile", name: "Chile", code: "CHI", confederation: "CONMEBOL", cor1: "#d52b1e", cor2: "#0039a6", countryKey: "Chile" },
  // UEFA
  { id: "inglaterra", name: "Inglaterra", code: "ENG", confederation: "UEFA", cor1: "#ffffff", cor2: "#cf081f", countryKey: "Inglaterra" },
  { id: "espanha", name: "Espanha", code: "ESP", confederation: "UEFA", cor1: "#c60b1e", cor2: "#ffc400", countryKey: "Espanha" },
  { id: "italia", name: "Italia", code: "ITA", confederation: "UEFA", cor1: "#0066cc", cor2: "#ffffff", countryKey: "Italia" },
  { id: "franca", name: "Franca", code: "FRA", confederation: "UEFA", cor1: "#0055a4", cor2: "#ef4135", countryKey: "Franca" },
  { id: "alemanha", name: "Alemanha", code: "GER", confederation: "UEFA", cor1: "#000000", cor2: "#dd0000", countryKey: "Alemanha" },
  { id: "portugal", name: "Portugal", code: "POR", confederation: "UEFA", cor1: "#006600", cor2: "#cf0921", countryKey: "Portugal" },
  { id: "holanda", name: "Holanda", code: "NED", confederation: "UEFA", cor1: "#f36c21", cor2: "#21468b", countryKey: "Holanda" },
  { id: "belgica", name: "Belgica", code: "BEL", confederation: "UEFA", cor1: "#e30613", cor2: "#fdda24", countryKey: "Belgica" },
  { id: "turquia", name: "Turquia", code: "TUR", confederation: "UEFA", cor1: "#e30a17", cor2: "#ffffff", countryKey: "Turquia" },
  { id: "russia", name: "Russia", code: "RUS", confederation: "UEFA", cor1: "#0039a6", cor2: "#d52b1e", countryKey: "Russia" },
  { id: "escocia", name: "Escocia", code: "SCO", confederation: "UEFA", cor1: "#0065bf", cor2: "#ffffff", countryKey: "Escocia" },
  // CONCACAF
  { id: "mexico", name: "Mexico", code: "MEX", confederation: "CONCACAF", cor1: "#006847", cor2: "#ce1126", countryKey: "Mexico" },
  { id: "estados_unidos", name: "Estados Unidos", code: "USA", confederation: "CONCACAF", cor1: "#0a3161", cor2: "#b31942", countryKey: "Estados Unidos" },
  { id: "canada", name: "Canada", code: "CAN", confederation: "CONCACAF", cor1: "#d52b1e", cor2: "#ffffff", countryKey: "Canada" },
  // AFC
  { id: "japao", name: "Japao", code: "JPN", confederation: "AFC", cor1: "#0a1e5e", cor2: "#ffffff", countryKey: "Japao" },
  { id: "coreia_do_sul", name: "Coreia do Sul", code: "KOR", confederation: "AFC", cor1: "#c60c30", cor2: "#003478", countryKey: "Coreia do Sul" },
  { id: "arabia_saudita", name: "Arabia Saudita", code: "KSA", confederation: "AFC", cor1: "#006c35", cor2: "#ffffff", countryKey: "Arabia Saudita" },
  { id: "china", name: "China", code: "CHN", confederation: "AFC", cor1: "#de2910", cor2: "#ffde00", countryKey: "China" },
]

const NT_BY_ID = new Map(NATIONAL_TEAMS.map(nt => [nt.id, nt]))

export function getNationalTeamById(id: string | null | undefined): NationalTeam | undefined {
  if (!id) return undefined
  return NT_BY_ID.get(id)
}

export function getNationalTeamsByConfederation(conf: Confederation): NationalTeam[] {
  return NATIONAL_TEAMS.filter(nt => nt.confederation === conf)
}

// Clubes que alimentam o elenco da selecao
function getClubsForNationalTeam(nt: NationalTeam): Team[] {
  if (nt.id === "brasil") return allBrazilianTeams
  return allTeams.filter(t => t.pais === nt.countryKey)
}

// Pool completo de jogadores disponiveis para a selecao
export function getNationalPlayerPool(nt: NationalTeam): Player[] {
  return getClubsForNationalTeam(nt).flatMap(getPlayersForTeam)
}

// Normaliza posicoes para os 4 setores
function sectorOf(pos: string): "GOL" | "DEF" | "MEI" | "ATA" {
  const p = pos.toUpperCase()
  if (p === "GOL") return "GOL"
  if (["ZAG", "LD", "LE", "LAT", "DEF"].includes(p)) return "DEF"
  if (["VOL", "MEI", "MC", "ME", "MD", "CA"].includes(p)) return "MEI"
  return "ATA"
}

// Monta uma convocacao equilibrada (~23 jogadores) com os melhores de cada setor.
/** Chave estavel de um jogador (nome + clube) — usada por cortes/convocacoes manuais. */
export function nationalPlayerKey(p: { nome: string; time?: string }): string {
  return `${p.nome}__${p.time ?? ""}`
}

/**
 * Convocacao da selecao.
 *
 * Antes era 100% automatica (23 melhores por cota). Agora o tecnico pode intervir:
 *   - `cuts`: jogadores CORTADOS — saem e o proximo melhor entra no lugar;
 *   - `calls`: jogadores CONVOCADOS a dedo — entram primeiro, mesmo fora do top por cota.
 * Sem cuts/calls, o comportamento e identico ao automatico de antes.
 */
export function getNationalSquad(
  nt: NationalTeam,
  opts: { cuts?: string[]; calls?: string[] } = {},
): Player[] {
  const cuts = new Set(opts.cuts ?? [])
  const calls = new Set(opts.calls ?? [])
  const pool = [...getNationalPlayerPool(nt)]
    .filter((p) => !cuts.has(nationalPlayerKey(p)))
    .sort((a, b) => b.base - a.base)

  const quotas: Record<"GOL" | "DEF" | "MEI" | "ATA", number> = { GOL: 3, DEF: 8, MEI: 7, ATA: 5 }
  const picked: Player[] = []
  const counters = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 }
  const seen = new Set<string>()

  // 1) Convocados a dedo entram primeiro (respeitando o limite de 23).
  for (const p of pool) {
    if (!calls.has(nationalPlayerKey(p))) continue
    const key = nationalPlayerKey(p)
    if (seen.has(key)) continue
    picked.push(p)
    counters[sectorOf(p.pos)]++
    seen.add(key)
    if (picked.length >= 23) break
  }

  // 2) Preenche por cota com os melhores restantes.
  for (const p of pool) {
    const key = nationalPlayerKey(p)
    if (seen.has(key)) continue
    const sector = sectorOf(p.pos)
    if (counters[sector] >= quotas[sector]) continue
    picked.push(p)
    counters[sector]++
    seen.add(key)
    if (picked.length >= 23) break
  }

  // 3) Completa com os melhores restantes caso falte gente em algum setor
  if (picked.length < 23) {
    for (const p of pool) {
      const key = nationalPlayerKey(p)
      if (seen.has(key)) continue
      picked.push(p)
      seen.add(key)
      if (picked.length >= 23) break
    }
  }

  return sortByPosition(picked)
}

// Forca da selecao = media dos 11 melhores (0-100)
export function getNationalStrength(nt: NationalTeam): number {
  const pool = [...getNationalPlayerPool(nt)].sort((a, b) => b.base - a.base)
  const top = pool.slice(0, 11)
  if (!top.length) return 55
  return Math.round(top.reduce((s, p) => s + p.base, 0) / top.length)
}

// Cache simples das forcas (nao muda durante a sessao)
let strengthCache: Record<string, number> | null = null
export function getAllNationalStrengths(): Record<string, number> {
  if (strengthCache) return strengthCache
  strengthCache = Object.fromEntries(NATIONAL_TEAMS.map(nt => [nt.id, getNationalStrength(nt)]))
  return strengthCache
}

export const CONFEDERATION_LABEL: Record<Confederation, string> = {
  CONMEBOL: "CONMEBOL (America do Sul)",
  UEFA: "UEFA (Europa)",
  CONCACAF: "CONCACAF (America do Norte/Central)",
  AFC: "AFC (Asia)",
}
