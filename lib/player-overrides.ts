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
  idade?: number
  // Atributos individuais editados no editor (0-99). Aplicados na montagem do time da
  // partida (players-data). Quando ausentes, o jogo usa os valores padrao derivados do
  // overall+posicao.
  pace?: number
  shooting?: number
  passing?: number
  dribbling?: number
  defending?: number
  physical?: number
}

/** Atributos padrao derivados do overall + posicao (mesma logica do motor de partida). */
export function defaultPlayerAttributes(base: number, pos: string): {
  pace: number; shooting: number; passing: number; dribbling: number; defending: number; physical: number
} {
  const isGK = pos === "GOL"
  const isAtt = ["ATA", "PE", "PD", "SA", "CA"].includes(pos)
  const isDef = ["ZAG", "LD", "LE", "ALD", "ALE"].includes(pos)
  const clamp = (n: number) => Math.max(40, Math.min(99, Math.round(n)))
  return {
    pace: clamp(isGK ? 45 : isDef ? base - 4 : isAtt ? base + 2 : base),
    shooting: clamp(isGK ? 20 : isAtt ? base + 3 : isDef ? base - 18 : base - 6),
    passing: clamp(isGK ? base - 12 : isDef ? base - 6 : base),
    dribbling: clamp(isGK ? 25 : isAtt ? base + 1 : isDef ? base - 12 : base - 2),
    defending: clamp(isGK ? base - 5 : isDef ? base + 2 : isAtt ? base - 22 : base - 8),
    physical: clamp(isGK ? base : base - 2),
  }
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
