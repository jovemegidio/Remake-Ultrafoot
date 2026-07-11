"use client"

import { storeGet, storeSet, storeRemove } from "@/lib/persistent-store"

const KEY = (fileKey: string) => `ultrafoot:team-override:${fileKey}`

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

export function getTeamOverride(fileKey: string): TeamOverride | null {
  const raw = storeGet(KEY(fileKey))
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
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
