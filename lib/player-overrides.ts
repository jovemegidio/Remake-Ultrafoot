"use client"

// Edicoes de JOGADOR (nome, posicao, overall) feitas no editor.
//
// Espelha o sistema de team-overrides: o save LOCAL vence, e um seed EMBUTIDO no build
// (data/seeds/player-overrides.json) e o fallback — e por ele que suas edicoes de jogador
// chegam a todos os jogadores. Aplicado em players-data.getPlayersForTeam.
//
// Chave: `${file_key}__${nomeOriginalNormalizado}` — usa o nome ORIGINAL para a edicao
// sobreviver mesmo depois de voce renomear o jogador.

import { storeGet, storeSet, storeRemove } from "@/lib/persistent-store"
import bundled from "@/data/seeds/player-overrides.json"

export interface PlayerOverride {
  nome?: string
  pos?: string
  base?: number
}

const BUNDLED = bundled as Record<string, PlayerOverride>
const KEY = (k: string) => `ultrafoot:player-override:${k}`

export function normPlayerName(name: string): string {
  return (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}
export function playerOverrideKey(fileKey: string, originalName: string): string {
  return `${fileKey}__${normPlayerName(originalName)}`
}

export function getPlayerOverride(fileKey: string, originalName: string): PlayerOverride | null {
  const k = playerOverrideKey(fileKey, originalName)
  const raw = typeof window === "undefined" ? null : storeGet(KEY(k))
  if (raw) {
    try {
      const local = JSON.parse(raw) as PlayerOverride
      return { ...BUNDLED[k], ...local }
    } catch { /* save corrompido: cai no embutido */ }
  }
  return BUNDLED[k] ?? null
}

export function setPlayerOverride(fileKey: string, originalName: string, ov: PlayerOverride): void {
  if (!fileKey || !originalName) return
  storeSet(KEY(playerOverrideKey(fileKey, originalName)), JSON.stringify(ov))
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ultrafoot:player:changed", { detail: { fileKey, originalName } }))
}

export function clearPlayerOverride(fileKey: string, originalName: string): void {
  storeRemove(KEY(playerOverrideKey(fileKey, originalName)))
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ultrafoot:player:changed", { detail: { fileKey, originalName } }))
}

/** Todas as edicoes locais de jogador — para o editor exportar. */
export function listLocalPlayerOverrides(): Record<string, PlayerOverride> {
  const out: Record<string, PlayerOverride> = {}
  if (typeof window === "undefined") return out
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith("ultrafoot:player-override:")) continue
    const raw = storeGet(k)
    if (!raw) continue
    try { out[k.replace("ultrafoot:player-override:", "")] = JSON.parse(raw) } catch { /* ignora */ }
  }
  return out
}
