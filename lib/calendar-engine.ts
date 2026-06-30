// PHASE 37 — Calendário realista
// Status: skeleton — rodadas oficiais, copas, datas FIFA, viagens, descanso, adiamentos.

import type { MatchFixture } from "@/lib/career-types"

export interface CalendarSlot {
  date: string                     // ISO 8601
  weekday: "Sun"|"Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"
  type: "match" | "training" | "rest" | "fifa_window" | "travel" | "press"
  competition?: string
  fixtureId?: string
  travelHours?: number
  isDoubleHeader?: boolean
}

export interface FifaWindow {
  startDate: string
  endDate: string
  type: "amistoso" | "eliminatorias" | "copa"
}

/** Gera calendário detalhado da temporada com slots dia-a-dia. */
export function buildSeasonCalendar(_fixtures: MatchFixture[], _seasonStartDate: string): CalendarSlot[] {
  throw new Error("calendar-engine.buildSeasonCalendar: not implemented")
}

/** Detecta conflitos (rodada brasileiro x copa do brasil mid-week). */
export function detectClashes(_calendar: CalendarSlot[]): { date: string; reason: string }[] {
  throw new Error("calendar-engine.detectClashes: not implemented")
}

/** Adia partida (reagenda no próximo slot livre). */
export function postponeMatch(_calendar: CalendarSlot[], _fixtureId: string): CalendarSlot[] {
  throw new Error("calendar-engine.postponeMatch: not implemented")
}

/** Datas FIFA: jogadores convocados ficam fora dos compromissos do clube. */
export function applyFifaWindow(_calendar: CalendarSlot[], _window: FifaWindow): CalendarSlot[] {
  throw new Error("calendar-engine.applyFifaWindow: not implemented")
}
