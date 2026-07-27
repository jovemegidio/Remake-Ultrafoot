// Selecoes nacionais derivadas dos clubes de cada pais.
// Como os jogadores do jogo nao tem nacionalidade explicita, o elenco de uma
// selecao e formado pelos melhores atletas que atuam em clubes daquele pais
// (abordagem "selecao com base nos jogadores da liga local").

import { allTeams, allBrazilianTeams, type Team } from "@/lib/teams-data"
import { getPlayersForTeam, sortByPosition, type Player } from "@/lib/players-data"
import { getTeamOverride } from "@/lib/team-overrides"

export type Confederation = "CONMEBOL" | "UEFA" | "CONCACAF" | "AFC" | "CAF" | "OFC"

export interface NationalTeam {
  id: string
  name: string
  code: string
  confederation: Confederation
  cor1: string
  cor2: string
  // Nome do pais usado no campo `pais` dos clubes (vazio = clubes brasileiros)
  countryKey: string
  /** Forca-base editorial para selecoes cujo elenco ainda nao existe nos clubes locais. */
  baselineStrength?: number
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
  // Demais selecoes masculinas classificadas para a Copa do Mundo FIFA 2026.
  { id: "argelia", name: "Argelia", code: "ALG", confederation: "CAF", cor1: "#006233", cor2: "#ffffff", countryKey: "Argelia", baselineStrength: 80 },
  { id: "australia", name: "Australia", code: "AUS", confederation: "AFC", cor1: "#ffcd00", cor2: "#00843d", countryKey: "Australia", baselineStrength: 80 },
  { id: "austria", name: "Austria", code: "AUT", confederation: "UEFA", cor1: "#ed2939", cor2: "#ffffff", countryKey: "Austria", baselineStrength: 84 },
  { id: "bosnia", name: "Bosnia e Herzegovina", code: "BIH", confederation: "UEFA", cor1: "#002395", cor2: "#feca00", countryKey: "Bosnia e Herzegovina", baselineStrength: 78 },
  { id: "cabo_verde", name: "Cabo Verde", code: "CPV", confederation: "CAF", cor1: "#003893", cor2: "#cf2027", countryKey: "Cabo Verde", baselineStrength: 75 },
  { id: "congo_dr", name: "RD Congo", code: "COD", confederation: "CAF", cor1: "#007fff", cor2: "#ce1021", countryKey: "RD Congo", baselineStrength: 77 },
  { id: "costa_do_marfim", name: "Costa do Marfim", code: "CIV", confederation: "CAF", cor1: "#f77f00", cor2: "#009e60", countryKey: "Costa do Marfim", baselineStrength: 82 },
  { id: "croacia", name: "Croacia", code: "CRO", confederation: "UEFA", cor1: "#ff0000", cor2: "#ffffff", countryKey: "Croacia", baselineStrength: 86 },
  { id: "curacao", name: "Curacao", code: "CUW", confederation: "CONCACAF", cor1: "#002b7f", cor2: "#f9e814", countryKey: "Curacao", baselineStrength: 73 },
  { id: "tchequia", name: "Tchequia", code: "CZE", confederation: "UEFA", cor1: "#d7141a", cor2: "#11457e", countryKey: "Tchequia", baselineStrength: 81 },
  { id: "equador", name: "Equador", code: "ECU", confederation: "CONMEBOL", cor1: "#ffdd00", cor2: "#034ea2", countryKey: "Equador", baselineStrength: 84 },
  { id: "egito", name: "Egito", code: "EGY", confederation: "CAF", cor1: "#ce1126", cor2: "#ffffff", countryKey: "Egito", baselineStrength: 82 },
  { id: "gana", name: "Gana", code: "GHA", confederation: "CAF", cor1: "#ce1126", cor2: "#fcd116", countryKey: "Gana", baselineStrength: 80 },
  { id: "haiti", name: "Haiti", code: "HAI", confederation: "CONCACAF", cor1: "#00209f", cor2: "#d21034", countryKey: "Haiti", baselineStrength: 72 },
  { id: "ira", name: "Ira", code: "IRN", confederation: "AFC", cor1: "#239f40", cor2: "#da0000", countryKey: "Ira", baselineStrength: 80 },
  { id: "iraque", name: "Iraque", code: "IRQ", confederation: "AFC", cor1: "#ce1126", cor2: "#000000", countryKey: "Iraque", baselineStrength: 75 },
  { id: "jordania", name: "Jordania", code: "JOR", confederation: "AFC", cor1: "#007a3d", cor2: "#ce1126", countryKey: "Jordania", baselineStrength: 75 },
  { id: "marrocos", name: "Marrocos", code: "MAR", confederation: "CAF", cor1: "#c1272d", cor2: "#006233", countryKey: "Marrocos", baselineStrength: 86 },
  { id: "nova_zelandia", name: "Nova Zelandia", code: "NZL", confederation: "OFC", cor1: "#101820", cor2: "#ffffff", countryKey: "Nova Zelandia", baselineStrength: 74 },
  { id: "noruega", name: "Noruega", code: "NOR", confederation: "UEFA", cor1: "#ba0c2f", cor2: "#00205b", countryKey: "Noruega", baselineStrength: 86 },
  { id: "panama", name: "Panama", code: "PAN", confederation: "CONCACAF", cor1: "#d21034", cor2: "#ffffff", countryKey: "Panama", baselineStrength: 77 },
  { id: "paraguai", name: "Paraguai", code: "PAR", confederation: "CONMEBOL", cor1: "#d52b1e", cor2: "#0038a8", countryKey: "Paraguai", baselineStrength: 80 },
  { id: "qatar", name: "Catar", code: "QAT", confederation: "AFC", cor1: "#8a1538", cor2: "#ffffff", countryKey: "Catar", baselineStrength: 76 },
  { id: "africa_do_sul", name: "Africa do Sul", code: "RSA", confederation: "CAF", cor1: "#007749", cor2: "#ffb81c", countryKey: "Africa do Sul", baselineStrength: 76 },
  { id: "senegal", name: "Senegal", code: "SEN", confederation: "CAF", cor1: "#00853f", cor2: "#fdef42", countryKey: "Senegal", baselineStrength: 84 },
  { id: "suecia", name: "Suecia", code: "SWE", confederation: "UEFA", cor1: "#006aa7", cor2: "#fecc02", countryKey: "Suecia", baselineStrength: 81 },
  { id: "suica", name: "Suica", code: "SUI", confederation: "UEFA", cor1: "#d52b1e", cor2: "#ffffff", countryKey: "Suica", baselineStrength: 84 },
  { id: "tunisia", name: "Tunisia", code: "TUN", confederation: "CAF", cor1: "#e70013", cor2: "#ffffff", countryKey: "Tunisia", baselineStrength: 78 },
  { id: "uzbequistao", name: "Uzbequistao", code: "UZB", confederation: "AFC", cor1: "#1eb53a", cor2: "#0099b5", countryKey: "Uzbequistao", baselineStrength: 76 },
]

const NT_BY_ID = new Map(NATIONAL_TEAMS.map(nt => [nt.id, nt]))

export function nationalTeamFileKey(id: string): string {
  return `nation_${id}`
}

function applyNationalTeamOverride(nt: NationalTeam): NationalTeam {
  const override = getTeamOverride(nationalTeamFileKey(nt.id))
  if (!override) return nt
  return {
    ...nt,
    name: override.nome?.trim() || nt.name,
    code: override.curto?.trim().toUpperCase() || nt.code,
    cor1: override.cor1 || nt.cor1,
    cor2: override.cor2 || nt.cor2,
  }
}

export function getNationalTeamById(id: string | null | undefined): NationalTeam | undefined {
  if (!id) return undefined
  const team = NT_BY_ID.get(id)
  return team ? applyNationalTeamOverride(team) : undefined
}

export function getNationalTeamsByConfederation(conf: Confederation): NationalTeam[] {
  return NATIONAL_TEAMS
    .filter(nt => nt.confederation === conf)
    .map(applyNationalTeamOverride)
}

export function getAllNationalTeams(): NationalTeam[] {
  return NATIONAL_TEAMS.map(applyNationalTeamOverride)
}

// Clubes que alimentam o elenco da selecao
function getClubsForNationalTeam(nt: NationalTeam): Team[] {
  if (nt.id === "brasil") return allBrazilianTeams
  return allTeams.filter(t => t.pais === nt.countryKey)
}

/** Jogador e clube de origem, para o editor persistir a alteração no atleta real. */
export function getNationalPlayerSources(
  nt: NationalTeam,
  opts?: { raw?: boolean },
): Array<{ player: Player; team: Team }> {
  return getClubsForNationalTeam(nt).flatMap(team =>
    getPlayersForTeam(team, opts).map(player => ({ player, team })),
  )
}

// Pool completo de jogadores disponiveis para a selecao
export function getNationalPlayerPool(nt: NationalTeam): Player[] {
  return getNationalPlayerSources(nt).map(entry => entry.player)
}

// Normaliza posicoes para os 4 setores
function sectorOf(pos: string): "GOL" | "DEF" | "MEI" | "ATA" {
  const p = pos.toUpperCase()
  if (p === "GOL") return "GOL"
  if (["ZAG", "LD", "LE", "LAT", "DEF"].includes(p)) return "DEF"
  if (["VOL", "MEI", "MC", "ME", "MD"].includes(p)) return "MEI"
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
// FORCA CURADA das selecoes (hierarquia real 2026), para a Copa do Mundo, os
// amistosos e as competicoes de selecao ficarem imersivos. Antes a forca vinha
// SO da media do elenco puxado da base de clubes — e um pais forte com poucos
// jogadores na base ficava fraco (Brasil abaixo de uma selecao menor). Agora a
// forca e ANCORADA nesta tabela (ranking real) e so ajustada pelo elenco, nunca
// dominada por ele. Escala ~66 (fracas) a ~91 (Argentina, campea/1o do ranking).
export const NATIONAL_STRENGTH_2026: Record<string, number> = {
  // CONMEBOL
  argentina: 91, brasil: 89, uruguai: 84, colombia: 84, equador: 80, paraguai: 76, chile: 76,
  // UEFA
  franca: 90, espanha: 89, inglaterra: 88, portugal: 88, holanda: 87, alemanha: 87, belgica: 85,
  croacia: 85, italia: 84, noruega: 82, suica: 80, turquia: 80, austria: 79, tchequia: 78,
  suecia: 78, escocia: 77, bosnia: 76, russia: 76,
  // CONCACAF
  mexico: 82, estados_unidos: 82, canada: 79, panama: 72, curacao: 68, haiti: 66,
  // AFC
  japao: 82, coreia_do_sul: 80, ira: 79, australia: 78, arabia_saudita: 74, qatar: 74,
  uzbequistao: 73, iraque: 72, jordania: 71, china: 68,
  // CAF
  marrocos: 85, senegal: 83, costa_do_marfim: 81, argelia: 80, egito: 80, gana: 78,
  congo_dr: 76, tunisia: 76, africa_do_sul: 74, cabo_verde: 72,
  // OFC
  nova_zelandia: 68,
}

export function getNationalStrength(nt: NationalTeam, squad?: Player[]): number {
  const editedStrength = getTeamOverride(nationalTeamFileKey(nt.id))?.prestigio
  if (Number.isFinite(editedStrength)) {
    return Math.max(1, Math.min(99, Math.round(editedStrength!)))
  }
  const ancora = NATIONAL_STRENGTH_2026[nt.id] ?? nt.baselineStrength ?? 55
  const pool = [...(squad ?? getNationalPlayerPool(nt))].sort((a, b) => b.base - a.base)
  const top = pool.slice(0, 11)
  if (!top.length) return ancora
  // Ancora manda (70%); o elenco real ajusta (30%). Assim o Brasil nunca cai
  // abaixo do seu patamar por falta de jogadores na base, mas um elenco forte
  // ou fraco ainda move a agulha.
  const elenco = top.reduce((s, p) => s + p.base, 0) / top.length
  return Math.round(ancora * 0.7 + elenco * 0.3)
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
  CAF: "CAF (Africa)",
  OFC: "OFC (Oceania)",
}
