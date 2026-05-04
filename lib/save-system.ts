// Sistema de save offline (localStorage). Brasfoot-like: tudo persiste localmente.

"use client"

import { useEffect, useState } from "react"
import { allTeams, getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"

const STORAGE_KEY = "ultrafoot:save"
const VERSION = 1

export interface GameState {
  version: number
  selectedTeamShort: string | null
  managerName: string
  season: number
  week: number
  language: string
  selectedUniform: "home" | "away" | "third"
  createdAt: number
  updatedAt: number
}

export const DEFAULT_STATE: GameState = {
  version: VERSION,
  selectedTeamShort: null,
  managerName: "Tecnico",
  season: 2026,
  week: 0,
  language: "pt-BR",
  selectedUniform: "home",
  createdAt: 0,
  updatedAt: 0,
}

function safeParse(raw: string | null): GameState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as GameState
    if (parsed.version !== VERSION) return null
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return null
  }
}

export function loadGameState(): GameState {
  if (typeof window === "undefined") return DEFAULT_STATE
  return safeParse(window.localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_STATE
}

export function saveGameState(state: GameState): void {
  if (typeof window === "undefined") return
  const next = { ...state, version: VERSION, updatedAt: Date.now() }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }))
}

export function clearGameState(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }))
}

export function hasSave(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(STORAGE_KEY) !== null
}

/**
 * React hook: state do jogo + sincronia com outras abas.
 * SSR-safe (retorna DEFAULT_STATE no servidor, hidrata no client).
 */
export function useGameState(): {
  state: GameState
  hydrated: boolean
  setState: (next: Partial<GameState>) => void
  reset: () => void
} {
  const [state, setStateInternal] = useState<GameState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Carrega estado inicial de forma sincrona
    const saved = loadGameState()
    setStateInternal(saved)
    setHydrated(true)
  }, [])

  useEffect(() => {
    // Listener separado para sincronizar entre abas
    if (!hydrated) return
    
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== STORAGE_KEY) return
      // Usa setTimeout para evitar setState durante render
      setTimeout(() => {
        setStateInternal(loadGameState())
      }, 0)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [hydrated])

  const setState = (next: Partial<GameState>) => {
    setStateInternal(prev => {
      const merged = { ...prev, ...next }
      // Salva de forma assincrona para nao bloquear
      queueMicrotask(() => saveGameState(merged))
      return merged
    })
  }

  const reset = () => {
    clearGameState()
    setStateInternal(DEFAULT_STATE)
  }

  return { state, hydrated, setState, reset }
}

/**
 * Time atual escolhido pelo usuario. Cai num default razoavel ate o save existir
 * (evita hydration mismatch ao retornar sempre o mesmo valor no SSR).
 */
const FALLBACK_TEAM: Team =
  getTeamByShort("BGT") ?? serieATeams[0] ?? allTeams[0]

export function useUserTeam(): { team: Team; hydrated: boolean } {
  const { state, hydrated } = useGameState()
  const team = state.selectedTeamShort
    ? getTeamByShort(state.selectedTeamShort) ?? FALLBACK_TEAM
    : FALLBACK_TEAM
  return { team, hydrated }
}

export function selectTeam(shortName: string, managerName?: string): void {
  const current = loadGameState()
  saveGameState({
    ...current,
    selectedTeamShort: shortName,
    managerName: managerName?.trim() || current.managerName || "Tecnico",
    season: current.season || 2026,
    week: 0,
    createdAt: current.createdAt || Date.now(),
  })
}
