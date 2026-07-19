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
export function buildSeasonCalendar(fixtures: MatchFixture[], seasonStartDate: string): CalendarSlot[] {
  const start=new Date(`${seasonStartDate}T12:00:00Z`), names:CalendarSlot["weekday"][]=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
  return fixtures.map((f,i): CalendarSlot=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+Math.max(0,f.round-1)*7+(i%2?3:0));return{date:d.toISOString().slice(0,10),weekday:names[d.getUTCDay()],type:"match",competition:f.competition,fixtureId:f.id}}).sort((a,b)=>a.date.localeCompare(b.date))
}

/** Detecta conflitos (rodada brasileiro x copa do brasil mid-week). */
export function detectClashes(calendar: CalendarSlot[]): { date: string; reason: string }[] {
  const counts=new Map<string,number>();for(const s of calendar)if(s.type==="match")counts.set(s.date,(counts.get(s.date)??0)+1)
  return [...counts].filter(([,n])=>n>1).map(([date])=>({date,reason:"Duas partidas programadas no mesmo dia"}))
}

/** Adia partida (reagenda no próximo slot livre). */
export function postponeMatch(calendar: CalendarSlot[], fixtureId: string): CalendarSlot[] {
  const next=structuredClone(calendar), item=next.find(s=>s.fixtureId===fixtureId);if(!item)return next
  const occupied=new Set(next.filter(s=>s!==item&&s.type==="match").map(s=>s.date)),d=new Date(`${item.date}T12:00:00Z`);do d.setUTCDate(d.getUTCDate()+1);while(occupied.has(d.toISOString().slice(0,10)))
  const names:CalendarSlot["weekday"][]=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];item.date=d.toISOString().slice(0,10);item.weekday=names[d.getUTCDay()];return next.sort((a,b)=>a.date.localeCompare(b.date))
}

/** Datas FIFA: jogadores convocados ficam fora dos compromissos do clube. */
export function applyFifaWindow(calendar: CalendarSlot[], window: FifaWindow): CalendarSlot[] {
  const next=structuredClone(calendar),start=new Date(`${window.startDate}T12:00:00Z`),end=new Date(`${window.endDate}T12:00:00Z`),names:CalendarSlot["weekday"][]=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
  for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1))next.push({date:d.toISOString().slice(0,10),weekday:names[d.getUTCDay()],type:"fifa_window",competition:window.type})
  return next.sort((a,b)=>a.date.localeCompare(b.date))
}
