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
  const form = _drivers.recentForm.reduce((score, result) => score + (result === "W" ? 3 : result === "D" ? 1 : 0), 0) / Math.max(1, _drivers.recentForm.length * 3)
  const popularity = Math.max(0, Math.min(100, _drivers.popularity))
  const attendance = Math.round(_drivers.stadiumCap * Math.max(0, Math.min(1, _drivers.attendanceRate)) * (18 + popularity * 0.9) * (_drivers.isClasicoWeek ? 1.18 : 1))
  return {
    matchdayTickets: attendance,
    shirtSales: Math.round((popularity * 18000 + _drivers.starPowerInSquad * 12000) * (0.8 + form * 0.5)),
    members: Math.round(popularity ** 2 * 140),
    marketing: Math.round(popularity * (1 + _drivers.marketingFacilityLevel * 0.16) * 18000),
    tv: Math.round(250000 + popularity * 35000),
    sponsorship: Math.round(100000 + popularity * 25000 + _drivers.marketingFacilityLevel * 80000),
    prizeMoney: 0,
    transferIncome: 0,
  }
}

/** Converte breakdown em FinanceEntry[] pra append no save. */
export function toFinanceEntries(
  _breakdown: RevenueBreakdown,
  _week: number,
  _season: number,
): FinanceEntry[] {
  const labels: [keyof RevenueBreakdown, string, "bilheteria"|"patrocinio"|"tv"|"premiacao"|"transferencia"|"outros"][] = [
    ["matchdayTickets", "Bilheteria", "bilheteria"], ["shirtSales", "Venda de camisas", "outros"],
    ["members", "Sócios-torcedores", "outros"], ["marketing", "Marketing", "outros"],
    ["tv", "Direitos de TV", "tv"], ["sponsorship", "Patrocínios", "patrocinio"],
    ["prizeMoney", "Premiações", "premiacao"], ["transferIncome", "Venda de atletas", "transferencia"],
  ]
  return labels.filter(([key]) => _breakdown[key] > 0).map(([key, description, category]) => ({
    id: `revenue_${_season}_${_week}_${key}`, type: "income", description,
    value: Math.round(_breakdown[key]), week: _week, season: _season, category,
  }))
}
