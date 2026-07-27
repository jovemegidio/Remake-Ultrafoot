// Datas FIFA: detecta as janelas internacionais dentro do calendario do clube e
// decide qual competicao de selecao se joga em cada janela (o mais fiel possivel
// ao calendario real). As janelas interrompem o clube: ao cair numa janela, o
// jogo leva o usuario para a Selecao e, ao terminar os jogos, volta ao clube.

import type { Confederation } from "@/lib/national-teams"

// Janelas FIFA reais (mes 0-indexed): Marco, Junho, Setembro, Outubro, Novembro.
export const FIFA_WINDOW_MONTHS = [2, 5, 8, 9, 10] as const

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export function isFifaWindowMonth(month: number): boolean {
  return (FIFA_WINDOW_MONTHS as readonly number[]).includes(month)
}

/** Chave unica de uma janela por temporada+mes (ex.: "2026-5"). */
export function windowKey(season: number, month: number): string {
  return `${season}-${month}`
}

/** Rotulo amigavel da janela (ex.: "Data FIFA de Junho"). */
export function windowLabel(month: number): string {
  return `Data FIFA de ${MONTH_LABELS[month] ?? ""}`.trim()
}

// Fase do ciclo de 4 anos ancorada em 2026 (Copa do Mundo).
//  - "wc"          -> ano de Copa do Mundo (2026, 2030, ...)
//  - "off"         -> ano seguinte a Copa (Liga das Nacoes/amistosos)
//  - "continental" -> ano de Copa America/Eurocopa (2024, 2028, ...)
//  - "qual_early"  -> ano de Eliminatorias antes da Copa (2025, 2029, ...)
export type CyclePhase = "wc" | "off" | "continental" | "qual_early"

export function cyclePhase(season: number): CyclePhase {
  const y = (((season - 2026) % 4) + 4) % 4
  if (y === 0) return "wc"
  if (y === 1) return "off"
  if (y === 2) return "continental"
  return "qual_early"
}

// Edicoes reais da Copa do Mundo por ano-sede, para imersao na pausa do Mundial.
export const WORLD_CUP_EDITIONS: Record<number, { hosts: string; note?: string }> = {
  2026: { hosts: "EUA, Canada e Mexico" },
  2030: { hosts: "Espanha, Portugal e Marrocos", note: "Centenario: jogos de abertura na Argentina, Paraguai e Uruguai" },
  2034: { hosts: "Arabia Saudita" },
}

/** Pais(es)-sede da Copa do Mundo daquele ano (vazio se nao for edicao conhecida). */
export function worldCupHosts(season: number): string {
  return WORLD_CUP_EDITIONS[season]?.hosts ?? ""
}

/** Nota extra da edicao (ex.: centenario 2030). */
export function worldCupNote(season: number): string {
  return WORLD_CUP_EDITIONS[season]?.note ?? ""
}

export interface WindowPlan {
  /** Id da competicao a iniciar/continuar nesta janela. */
  competitionId: string
  /** Quantos jogos do usuario disputar nesta janela antes de voltar ao clube. */
  gamesTarget: number
  /** Torneios em bloco unico (Copa do Mundo/Continental): jogar ate o fim na janela. */
  isFinalTournament: boolean
}

interface PlanInput {
  season: number
  month: number
  confederation: Confederation
}

// Numero alto usado como "sem limite" (Infinity nao sobrevive ao JSON do save).
const NO_CAP = 999

const QUALIFIER_BY_CONFEDERATION: Record<Confederation, string> = {
  CONMEBOL: "eliminatorias_conmebol",
  UEFA: "eliminatorias_uefa",
  CONCACAF: "eliminatorias_concacaf",
  AFC: "eliminatorias_afc",
  CAF: "eliminatorias_caf",
  OFC: "eliminatorias_ofc",
}

const CONTINENTAL_BY_CONFEDERATION: Record<Confederation, string> = {
  CONMEBOL: "copa_america",
  UEFA: "eurocopa",
  CONCACAF: "copa_ouro",
  AFC: "copa_asia",
  CAF: "copa_africana",
  OFC: "copa_oceania",
}

/**
 * Decide o que se joga numa janela FIFA, aproximando o calendario real:
 * - Junho: Copa do Mundo (ano de Copa), Copa America/Euro (ano continental) ou amistosos.
 * - Demais janelas: Eliminatorias (ciclo de classificacao), Liga das Nacoes ou amistosos.
 */
export function planWindowCompetition({ season, month, confederation }: PlanInput): WindowPlan {
  const isJune = month === 5
  const phase = cyclePhase(season)
  const hasNations = confederation === "UEFA" || confederation === "CONCACAF"

  if (isJune) {
    if (phase === "wc") {
      return { competitionId: "copa_mundo", gamesTarget: NO_CAP, isFinalTournament: true }
    }
    if (phase === "continental" || (phase === "off" && !["UEFA", "CONMEBOL"].includes(confederation))) {
      return { competitionId: CONTINENTAL_BY_CONFEDERATION[confederation], gamesTarget: NO_CAP, isFinalTournament: true }
    }
    return { competitionId: "amistosos", gamesTarget: 3, isFinalTournament: false }
  }

  // Janelas de Marco/Setembro/Outubro/Novembro
  if (phase === "qual_early" || phase === "continental") {
    return { competitionId: QUALIFIER_BY_CONFEDERATION[confederation], gamesTarget: 2, isFinalTournament: false }
  }
  if (hasNations) {
    return { competitionId: confederation === "UEFA" ? "nations_league_uefa" : "nations_league_concacaf", gamesTarget: 2, isFinalTournament: false }
  }
  return { competitionId: "amistosos", gamesTarget: 2, isFinalTournament: false }
}
