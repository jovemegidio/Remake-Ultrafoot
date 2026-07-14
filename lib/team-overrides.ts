"use client"

import { storeGet, storeSet, storeRemove } from "@/lib/persistent-store"
// Edicoes de clube EMBUTIDAS no jogo (escudos, uniformes, cores, nomes).
//
// Sem isto, o que voce edita no editor de clubes fica so no SEU save (persistent-store)
// e NUNCA chega aos outros jogadores. Este seed viaja dentro do build: e o canal para
// as suas edicoes valerem para todo mundo que instalar o jogo.
//
// Fluxo: edita no editor -> "Exportar edicoes" -> roda scripts/merge-team-overrides.mjs
// -> as edicoes entram neste arquivo -> o proximo build ja sai com elas.
import bundledOverrides from "@/data/seeds/team-overrides.json"

const KEY = (fileKey: string) => `ultrafoot:team-override:${fileKey}`

const BUNDLED = bundledOverrides as Record<string, TeamOverride>

export type KitPattern = "solid" | "stripes" | "diagonal" | "halves"

export interface KitData {
  primary: string
  secondary: string
  pattern: KitPattern
  imageUrl?: string // base64 data URL para imagem customizada
}

export interface TeamOverride {
  nome?: string
  curto?: string
  cor1?: string
  cor2?: string
  prestigio?: number
  estadio_nome?: string
  estadio_cap?: number
  patrocinador?: string
  kits?: {
    home?: KitData
    away?: KitData
    third?: KitData
  }
}

/**
 * Edicao do clube. O save LOCAL vence (o jogador pode personalizar o proprio jogo),
 * e o seed EMBUTIDO e o fallback — e por ele que as suas edicoes chegam a todo mundo.
 */
export function getTeamOverride(fileKey: string): TeamOverride | null {
  const raw = storeGet(KEY(fileKey))
  if (raw) {
    try {
      const local = JSON.parse(raw) as TeamOverride
      // Faz merge por cima do embutido: o jogador pode ter mudado so a cor, e o escudo
      // que voce enviou no build deve continuar valendo.
      const base = BUNDLED[fileKey]
      return base ? { ...base, ...local, kits: { ...base.kits, ...local.kits } } : local
    } catch { /* save corrompido: cai no embutido */ }
  }
  return BUNDLED[fileKey] ?? null
}

/** Todas as edicoes locais — usado pelo editor para exportar. */
export function listLocalTeamOverrides(): Record<string, TeamOverride> {
  const out: Record<string, TeamOverride> = {}
  if (typeof window === "undefined") return out
  // O persistent-store espelha as chaves no localStorage; varremos pelo prefixo.
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith("ultrafoot:team-override:")) continue
    const fileKey = k.replace("ultrafoot:team-override:", "")
    const raw = storeGet(k)
    if (!raw) continue
    try { out[fileKey] = JSON.parse(raw) } catch { /* ignora entrada corrompida */ }
  }
  return out
}

export function setTeamOverride(fileKey: string, override: TeamOverride): void {
  if (!fileKey) return
  storeSet(KEY(fileKey), JSON.stringify(override))
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ultrafoot:team:changed", { detail: { key: fileKey } }))
}

export function clearTeamOverride(fileKey: string): void {
  storeRemove(KEY(fileKey))
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ultrafoot:team:changed", { detail: { key: fileKey } }))
}

export function applyTeamOverride<T extends { file_key?: string; cor1?: string; cor2?: string }>(team: T): T {
  if (!team.file_key) return team
  const override = getTeamOverride(team.file_key)
  if (!override) return team
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ...team, ...(override as any) }
}
