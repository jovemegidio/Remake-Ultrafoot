"use client"

// Tela cheia. No desktop (Tauri) usa a API de janela nativa; no navegador usa a
// Fullscreen API. O estado fica no persistent-store (sobrevive a reinstalacao) e e
// reaplicado no boot. Permissoes core:window:allow-set-fullscreen / allow-is-fullscreen
// ja estao no capabilities/default.json.

import { storeGet, storeSet, initPersistentStore } from "@/lib/persistent-store"
import { isTauri } from "@/lib/game-asset"

const KEY = "ultrafoot:fullscreen"

export function isFullscreenEnabled(): boolean {
  return storeGet(KEY) === "1"
}

export async function setFullscreen(on: boolean): Promise<void> {
  storeSet(KEY, on ? "1" : "0")
  try {
    if (isTauri()) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window")
      await getCurrentWindow().setFullscreen(on)
    } else if (typeof document !== "undefined") {
      if (on) await document.documentElement.requestFullscreen?.()
      else if (document.fullscreenElement) await document.exitFullscreen?.()
    }
  } catch (e) {
    console.warn("[fullscreen] falha ao aplicar:", e)
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ultrafoot:fullscreen:changed", { detail: { on } }))
  }
}

export async function toggleFullscreen(): Promise<void> {
  await setFullscreen(!isFullscreenEnabled())
}

/** Reaplica o estado salvo de tela cheia no boot (apos o store carregar). */
export async function applySavedFullscreen(): Promise<void> {
  await initPersistentStore()
  if (isFullscreenEnabled()) await setFullscreen(true)
}
