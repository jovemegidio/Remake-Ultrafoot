// PHASE 14 — Narração textual estilo rádio
// Status: skeleton — gera linhas de comentário a partir de eventos do match-engine.
// Compatível com múltiplos narradores via packs (ver pack-engine).

import type { MatchEvent } from "@/lib/match-engine"

export type CommentaryEventType =
  | "kickoff"
  | "goal"
  | "shot_on_target"
  | "shot_off_target"
  | "save"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "corner"
  | "foul"
  | "free_kick"
  | "penalty"
  | "offside"
  | "pressure"
  | "counter_attack"
  | "halftime"
  | "fulltime"
  | "derby_intro"

export type CommentaryIntensity = "calm" | "excited" | "explosive"

export interface CommentaryLine {
  id: string
  text: string
  intensity: CommentaryIntensity
  audioKey?: string                // chave do clipe de áudio (audio-commentary)
  durationMs?: number              // estimado
}

export interface CommentaryPack {
  id: string
  name: string
  language: string                 // "pt-br"
  variant: string                  // "default", "fanatico", "academico", etc
  templates: Record<CommentaryEventType, string[]> // texto com placeholders {player}, {team}, {score}
  audioBasePath?: string           // /audio/commentary/pt-br/<variant>/
}

/** Renderiza um evento de partida em linha de comentário. */
export function renderEvent(_event: MatchEvent, _pack: CommentaryPack): CommentaryLine {
  throw new Error("commentary-engine.renderEvent: not implemented")
}

/** Pack default em pt-BR. */
export const DEFAULT_PACK: CommentaryPack = {
  id: "default-pt-br",
  name: "Narração padrão",
  language: "pt-br",
  variant: "default",
  templates: {} as Record<CommentaryEventType, string[]>,
}

/** Carrega pack de narração (custom ou default). */
export function loadPack(_packId: string): CommentaryPack {
  throw new Error("commentary-engine.loadPack: not implemented")
}
