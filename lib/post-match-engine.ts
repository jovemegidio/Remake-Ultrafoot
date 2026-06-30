// PHASE 15 — Pós-jogo
// Status: skeleton — melhores momentos, estatísticas (xG, posse, notas),
// impacto moral/tabela, coletiva, notícias.

import type { MatchEvent, MatchState } from "@/lib/match-engine"
import type { MatchResult } from "@/lib/career-types"

export interface MatchStats {
  homeShots: number
  awayShots: number
  homeShotsOnTarget: number
  awayShotsOnTarget: number
  homePossession: number           // 0..100
  awayPossession: number
  homeXG: number
  awayXG: number
  homeCorners: number
  awayCorners: number
  homeFouls: number
  awayFouls: number
  homeYellowCards: number
  awayYellowCards: number
  homeRedCards: number
  awayRedCards: number
}

export interface PlayerRating {
  playerId: string
  playerName: string
  position: string
  rating: number                   // 0..10
  goals: number
  assists: number
  highlights: string[]
}

export interface MatchHighlight {
  minute: number
  type: "goal" | "save" | "miss" | "card" | "decisive"
  description: string
  eventId: string
}

export interface PressConferencePrompt {
  id: string
  question: string
  options: { text: string; impact: { moral: number; press: number; fans: number } }[]
}

/** Calcula estatísticas finais a partir do MatchState. */
export function calcStats(_state: MatchState): MatchStats {
  throw new Error("post-match-engine.calcStats: not implemented")
}

/** Atribui notas (0..10) por jogador baseado em eventos. */
export function calcPlayerRatings(_state: MatchState): PlayerRating[] {
  throw new Error("post-match-engine.calcPlayerRatings: not implemented")
}

/** Extrai melhores momentos pro replay. */
export function extractHighlights(_events: MatchEvent[]): MatchHighlight[] {
  throw new Error("post-match-engine.extractHighlights: not implemented")
}

/** Gera prompts pra coletiva pós-jogo. */
export function generatePressConference(_result: MatchResult): PressConferencePrompt[] {
  throw new Error("post-match-engine.generatePressConference: not implemented")
}
