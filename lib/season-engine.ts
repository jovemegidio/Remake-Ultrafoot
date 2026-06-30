// PHASE 1 — Core do modo carreira: motor de temporada
// Status: skeleton — define API. Implementação real consumirá career-engine + table-engine.
// Responsabilidade: avançar a temporada rodada por rodada, encerrar temporada,
// promover/rebaixar, gerar troféus, calcular ranking de técnicos.

import type {
  StandingEntry,
  MatchFixture,
  MatchResult,
  SeasonRecord,
} from "@/lib/career-types"
import type { GameState, SavedTeam } from "@/lib/save-system"

export type SeasonPhase =
  | "pre_temporada"
  | "estadual"
  | "regular"
  | "mata_mata"
  | "fim_temporada"

export interface SeasonContext {
  season: number
  round: number
  phase: SeasonPhase
  fixtures: MatchFixture[]
  standings: StandingEntry[]
  results: MatchResult[]
}

export interface SeasonAdvanceResult {
  state: GameState
  newResults: MatchResult[]
  seasonEnded: boolean
  nextSeason?: number
}

/** Avança 1 rodada (simula CPU + processa rodada do usuário se já jogou). */
export function advanceRound(_state: GameState): SeasonAdvanceResult {
  throw new Error("season-engine.advanceRound: not implemented")
}

/** Encerra a temporada: define campeão, promovidos, rebaixados, gera SeasonRecord. */
export function finalizeSeason(_state: GameState): {
  record: SeasonRecord
  championCurto: string
  promotedCurtos: string[]
  relegatedCurtos: string[]
} {
  throw new Error("season-engine.finalizeSeason: not implemented")
}

/** Inicializa nova temporada (gera fixtures, zera tabela, mantém histórico). */
export function startNewSeason(_state: GameState, _userTeam: SavedTeam): GameState {
  throw new Error("season-engine.startNewSeason: not implemented")
}

/** Calcula a fase atual da temporada com base no calendário. */
export function getSeasonPhase(round: number, totalRounds = 38): SeasonPhase {
  if (round <= 0) return "pre_temporada"
  if (round >= totalRounds) return "fim_temporada"
  return "regular"
}
