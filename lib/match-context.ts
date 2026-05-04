// Contexto da partida: passa times e configurações entre /partida e /partida/ao-vivo
// Armazenamento em sessionStorage (limpo ao fechar aba) para evitar conflito com save principal

"use client"

import type { Team } from "@/lib/teams-data"

const KEY = "ultrafoot:current-match"

export interface MatchContext {
  homeShort: string
  awayShort: string
  homeKit: "home" | "away" | "third"
  awayKit: "home" | "away" | "third"
  competition: string
  round: string
  duration: number // minutos (45, 90)
  weather: "sunny" | "cloudy" | "rain"
  matchMode: "normal" | "highlights" | "commentary"
  // Resultado preenchido após simular rápido
  result?: {
    homeGoals: number
    awayGoals: number
    homeXg: number
    awayXg: number
  }
}

export const DEFAULT_MATCH_CONTEXT: MatchContext = {
  homeShort: "BGT",
  awayShort: "PAL",
  homeKit: "home",
  awayKit: "away",
  competition: "Brasileirão Série A",
  round: "Rodada 1",
  duration: 90,
  weather: "sunny",
  matchMode: "normal",
}

export function loadMatchContext(): MatchContext {
  if (typeof window === "undefined") return DEFAULT_MATCH_CONTEXT
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return DEFAULT_MATCH_CONTEXT
    return { ...DEFAULT_MATCH_CONTEXT, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_MATCH_CONTEXT
  }
}

export function saveMatchContext(ctx: Partial<MatchContext>): void {
  if (typeof window === "undefined") return
  const current = loadMatchContext()
  const next = { ...current, ...ctx }
  window.sessionStorage.setItem(KEY, JSON.stringify(next))
}

export function clearMatchContext(): void {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(KEY)
}

export function setMatchTeams(home: Team, away: Team) {
  saveMatchContext({ homeShort: home.curto, awayShort: away.curto })
}
