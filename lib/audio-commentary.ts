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

// CAMADA BASE DE EFEITOS — o `padrao` deixou de ser um narrador rival.
//
// Os nove pacotes eram mutuamente exclusivos: quem escolhia Cleber Machado
// ouvia a voz e perdia PARA SEMPRE os sete efeitos curtos do `padrao` (apito de
// fim, reacao da torcida no gol, vaia na expulsao). Sao 0,09s a 1,73s, mono,
// 8-44 kHz: efeito sonoro, nao narracao — nunca foram concorrentes da voz.
//
// Agora o `padrao` toca SEMPRE, por baixo de qualquer narrador. Quem fica no
// proprio `padrao` nao ouve nada em dobro: a voz e o efeito seriam o mesmo
// arquivo, entao a fila e pulada.
const PACOTE_BASE = "padrao"

/** Eventos com efeito gravado no pacote base (evita 404 e preload inutil). */
const EVENTOS_BASE = ["contusao", "expulsao", "fimjogo", "gol1", "goladv", "intervalo", "penalty"] as const

/** Ganho do efeito quando ha voz por cima: abaixa para a narracao continuar inteligivel. */
const ABAFAR_SOB_VOZ = 0.7

/** Um <audio> modelo por evento — os toques sao clones, para nao cortar o anterior. */
const modelosBase = new Map<string, HTMLAudioElement>()
/** Clones no ar, para o mute/volume/clearQueue alcancarem o que ja esta tocando. */
const efeitosNoAr = new Set<HTMLAudioElement>()

function ganhoDoEfeitoBase(): number {
  return config.volume * (config.pack === PACOTE_BASE ? 1 : ABAFAR_SOB_VOZ)
}

function modeloDoEvento(evento: string): HTMLAudioElement {
  let modelo = modelosBase.get(evento)
  if (!modelo) {
    modelo = new Audio(gameAssetUrl(`/audio/commentary/${PACOTE_BASE}/${evento}.wav`))
    modelo.preload = "auto"
    modelosBase.set(evento, modelo)
  }
  return modelo
}

function tocarEfeitoBase(evento: string): void {
  if (!EVENTOS_BASE.includes(evento as (typeof EVENTOS_BASE)[number])) return
  const som = modeloDoEvento(evento).cloneNode() as HTMLAudioElement
  som.volume = ganhoDoEfeitoBase()
  efeitosNoAr.add(som)
  const soltar = () => efeitosNoAr.delete(som)
  som.addEventListener("ended", soltar)
  som.addEventListener("error", soltar)
  void som.play().catch(soltar)
}

function pararEfeitosBase(): void {
  for (const som of efeitosNoAr) { som.pause(); som.removeAttribute("src") }
  efeitosNoAr.clear()
}

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

  // Aquece os sete efeitos: sao ~140 KB no total e o primeiro gol nao pode
  // esperar o disco. Sem isto o efeito chega depois da voz que ele deveria abrir.
  if (config.preload) for (const evento of EVENTOS_BASE) modeloDoEvento(evento)
}

/** Enfileira clipe (goal interrompe lower priority). */
export function enqueue(line: CommentaryLine): void {
  if (line.audioKey) enqueueEvent(line.audioKey)
}

export function enqueueEvent(event: string): void {
  if (!config.enabled || config.mute || typeof window === "undefined") return
  const evento = event.replace(/\.wav$/i, "")

  // Efeito primeiro: e curto e imediato, enquanto a voz espera a fila esvaziar.
  tocarEfeitoBase(evento)

  // No pacote base a voz E o efeito — enfileirar tocaria o mesmo arquivo duas vezes.
  if (config.pack === PACOTE_BASE) return

  queue.push(gameAssetUrl(`/audio/commentary/${config.pack}/${evento}.wav`))
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
  pararEfeitosBase()
}

/** Mute/unmute (não persiste no disco — fica no localStorage via save-engine). */
export function setMute(mute: boolean): void {
  config.mute = mute
  if (audio) audio.muted = mute
  if (mute) pararEfeitosBase()
}

/** Ajusta volume. */
export function setVolume(v: number): void {
  config.volume = Math.max(0, Math.min(1, v))
  if (audio) audio.volume = config.volume
  // Alcanca o efeito que ja esta tocando: sao ate 1,73s, tempo de sobra para o
  // jogador arrastar o slider e nao entender por que so a voz obedeceu.
  const ganho = ganhoDoEfeitoBase()
  for (const som of efeitosNoAr) som.volume = ganho
}
