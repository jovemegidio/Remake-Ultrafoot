// PHASE 14 — Voz: fila de áudio de narração
// Status: skeleton — usa howler.js (TODO: adicionar a package.json antes da implementação real).
// Estrutura: /public/audio/commentary/pt-br/<variant>/<eventType>/<id>.mp3
// Compatível com Tauri (asset protocol).

import type { CommentaryLine } from "@/lib/commentary-engine"

// TODO: when implementing, add to package.json:
//   "howler": "^2.2.4"
//   "@types/howler": "^2.2.11"

export interface AudioConfig {
  enabled: boolean
  volume: number                   // 0..1
  mute: boolean
  preload: boolean
  fallbackToText: boolean
  pack: string                     // "default", "fanatico", etc
  language: string                 // "pt-br"
}

export interface AudioQueueItem {
  id: string
  audioKey: string                 // ex: "goal/explosive_001"
  intensity: "calm" | "excited" | "explosive"
  priority: number                 // gols/lance final ganham prioridade
  enqueuedAt: number
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  enabled: true,
  volume: 0.8,
  mute: false,
  preload: true,
  fallbackToText: true,
  pack: "default",
  language: "pt-br",
}

/** Inicializa pool de Howl instances pra preload. */
export function initAudio(_config: AudioConfig): void {
  throw new Error("audio-commentary.initAudio: not implemented")
}

/** Enfileira clipe (goal interrompe lower priority). */
export function enqueue(_line: CommentaryLine): void {
  throw new Error("audio-commentary.enqueue: not implemented")
}

/** Cancela tudo (ex: gol durante outro clipe). */
export function clearQueue(): void {
  throw new Error("audio-commentary.clearQueue: not implemented")
}

/** Mute/unmute (não persiste no disco — fica no localStorage via save-engine). */
export function setMute(_mute: boolean): void {
  throw new Error("audio-commentary.setMute: not implemented")
}

/** Ajusta volume. */
export function setVolume(_v: number): void {
  throw new Error("audio-commentary.setVolume: not implemented")
}
