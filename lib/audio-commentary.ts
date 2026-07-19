// PHASE 14 — Voz: fila de áudio de narração
// Status: skeleton — usa howler.js (TODO: adicionar a package.json antes da implementação real).
// Estrutura: /public/audio/commentary/pt-br/<variant>/<eventType>/<id>.mp3
// Compatível com Tauri (asset protocol).

import type { CommentaryLine } from "@/lib/commentary-engine"
import { gameAssetUrl } from "@/lib/game-asset"

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

let config: AudioConfig = { ...DEFAULT_AUDIO_CONFIG }
let audio: HTMLAudioElement | null = null
const queue: string[] = []

/** Inicializa o player nativo do WebView, sem dependencia pesada. */
export function initAudio(next: AudioConfig): void {
  config = { ...next }
  if (typeof window === "undefined") return
  if (!audio) {
    audio = new Audio()
    audio.preload = "metadata"
    audio.addEventListener("ended", playNext)
    audio.addEventListener("error", playNext)
  }
  audio.volume = config.volume
  audio.muted = config.mute || !config.enabled
}

/** Enfileira clipe (goal interrompe lower priority). */
export function enqueue(line: CommentaryLine): void {
  if (line.audioKey) enqueueEvent(line.audioKey)
}

export function enqueueEvent(event: string): void {
  if (!config.enabled || config.mute || typeof window === "undefined") return
  queue.push(gameAssetUrl(`/audio/commentary/${config.pack}/${event.replace(/\.wav$/i, "")}.wav`))
  if (!audio || audio.paused) playNext()
}

function playNext(): void {
  if (!audio || !config.enabled || config.mute) return
  const src = queue.shift()
  if (!src) return
  audio.src = src
  audio.volume = config.volume
  void audio.play().catch(playNext)
}

/** Cancela tudo (ex: gol durante outro clipe). */
export function clearQueue(): void {
  queue.length = 0
  if (audio) { audio.pause(); audio.removeAttribute("src") }
}

/** Mute/unmute (não persiste no disco — fica no localStorage via save-engine). */
export function setMute(mute: boolean): void {
  config.mute = mute
  if (audio) audio.muted = mute
}

/** Ajusta volume. */
export function setVolume(v: number): void {
  config.volume = Math.max(0, Math.min(1, v))
  if (audio) audio.volume = config.volume
}
