// PHASE 25 — Receitas
// Status: skeleton — camisas vendidas, sócios, bilheteria, marketing, popularidade.
// Coexiste com career-engine.calcRoundFinances que já cobre TV/patrocínio/bilheteria/salário.

import type { FinanceEntry } from "@/lib/career-types"

export interface RevenueBreakdown {
  matchdayTickets: number
  shirtSales: number
  members: number                  // sócios
  marketing: number
  tv: number
  sponsorship: number
  prizeMoney: number
  transferIncome: number
}

export interface RevenueDrivers {
  popularity: number               // 0..100
  marketingFacilityLevel: number   // 0..10
  starPowerInSquad: number         // 0..100 (média dos overall acima de 80)
  recentForm: ("W"|"D"|"L")[]
  isClasicoWeek: boolean
  attendanceRate: number           // 0..1
  stadiumCap: number
}

/** Calcula receita mensal (todas as fontes). */
export function calcMonthlyRevenue(_drivers: RevenueDrivers): RevenueBreakdown {
  throw new Error("revenue-engine.calcMonthlyRevenue: not implemented")
}

/** Converte breakdown em FinanceEntry[] pra append no save. */
export function toFinanceEntries(
  _breakdown: RevenueBreakdown,
  _week: number,
  _season: number,
): FinanceEntry[] {
  throw new Error("revenue-engine.toFinanceEntries: not implemented")
}
