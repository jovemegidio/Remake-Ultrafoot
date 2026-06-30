// A temporada comeca em 01/01 do ano informado e cada rodada avanca exatamente
// 7 dias (uma rodada por semana) — calendario linear e consistente, em vez de
// aproximar meses/dias a partir do numero da rodada.
export function getGameDate(season: number, week: number): Date {
  const date = new Date(season, 0, 1)
  date.setDate(date.getDate() + Math.max(0, week - 1) * 7)
  return date
}
