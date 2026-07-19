"use client"

import { useMemo } from "react"
import { BarChart3, ChevronRight, CircleEqual, Goal, Trophy } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { getTeamByShort } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

export interface RoundResult {
  competition: string
  homeTeam: string   // curto
  awayTeam: string   // curto
  homeScore: number
  awayScore: number
}

// Tela pos-jogo: todos os jogos da rodada (todas as competicoes que rodaram nesta
// semana), agrupados por competicao. Aparece entre o placar final e a coletiva.
export function RoundResultsModal({
  open,
  results,
  userHome,
  userAway,
  onContinue,
}: {
  open: boolean
  results: RoundResult[]
  userHome?: string
  userAway?: string
  onContinue: () => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, RoundResult[]>()
    for (const r of results) {
      const arr = map.get(r.competition) ?? []
      arr.push(r)
      map.set(r.competition, arr)
    }
    return Array.from(map.entries())
      .map(([competition, matches]) => [competition, [...matches].sort((a, b) => Number(isUserResult(b)) - Number(isUserResult(a)))] as const)
      .sort((a, b) => Number(b[1].some(isUserResult)) - Number(a[1].some(isUserResult)) || b[1].length - a[1].length)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, userHome, userAway])

  const summary = useMemo(() => ({
    matches: results.length,
    goals: results.reduce((sum, r) => sum + r.homeScore + r.awayScore, 0),
    homeWins: results.filter(r => r.homeScore > r.awayScore).length,
    draws: results.filter(r => r.homeScore === r.awayScore).length,
    awayWins: results.filter(r => r.awayScore > r.homeScore).length,
  }), [results])

  if (!open) return null

  const isUserMatch = (r: RoundResult) =>
    (r.homeTeam === userHome && r.awayTeam === userAway) ||
    (r.homeTeam === userAway && r.awayTeam === userHome)

  function isUserResult(r: RoundResult) {
    return (r.homeTeam === userHome && r.awayTeam === userAway) ||
      (r.homeTeam === userAway && r.awayTeam === userHome)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#020607]/92 backdrop-blur-md p-3 sm:p-6">
      <div className="relative w-full max-w-5xl max-h-[92vh] rounded-2xl bg-[#091012] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,.7)] flex flex-col overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00ffc8] to-transparent" />
        <div className="shrink-0 px-5 sm:px-7 py-5 border-b border-white/[0.07] flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-xl border border-[#00ffc8]/20 bg-[#00ffc8]/10">
              <Trophy className="h-5 w-5 text-[#00ffc8]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#00ffc8]">Central da partida</p>
              <h2 className="mt-0.5 text-xl font-black text-white">Resultados da Rodada</h2>
              <p className="text-xs text-white/40">Resumo oficial antes da coletiva de imprensa</p>
            </div>
          </div>
          <button
            onClick={onContinue}
            className="flex items-center gap-2 rounded-xl bg-[#00ffc8] px-4 sm:px-6 py-2.5 text-sm font-black text-black transition hover:brightness-110"
          >
            Continuar <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid shrink-0 grid-cols-2 sm:grid-cols-5 border-b border-white/[0.06] bg-black/20">
          {[
            { label: "Partidas", value: summary.matches, icon: BarChart3 },
            { label: "Gols", value: summary.goals, icon: Goal },
            { label: "Vitórias mandante", value: summary.homeWins, icon: Trophy },
            { label: "Empates", value: summary.draws, icon: CircleEqual },
            { label: "Vitórias visitante", value: summary.awayWins, icon: Trophy },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center justify-center gap-3 border-r border-white/[0.05] px-3 py-3.5 last:border-r-0">
              <Icon className="hidden h-4 w-4 text-[#00ffc8]/65 md:block" />
              <div><div className="text-lg font-black tabular-nums text-white">{value}</div><div className="text-[9px] font-bold uppercase tracking-wider text-white/35">{label}</div></div>
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 sm:px-7 py-5 space-y-6">
          {grouped.length === 0 ? (
            <p className="text-center text-white/30 py-10 text-sm">Nenhum outro jogo nesta rodada.</p>
          ) : (
            grouped.map(([competition, matches]) => (
              <div key={competition}>
                <div className="mb-2.5 flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <h3 className="text-xs font-black uppercase tracking-[.16em] text-[#00ffc8]/85">{competition}</h3>
                  <span className="text-[10px] font-bold text-white/30">{matches.length} {matches.length === 1 ? "partida" : "partidas"}</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {matches.map((r, i) => {
                    const home = getTeamByShort(r.homeTeam)
                    const away = getTeamByShort(r.awayTeam)
                    const mine = isUserMatch(r)
                    return (
                      <div
                        key={`${r.homeTeam}-${r.awayTeam}-${i}`}
                        className={cn(
                          "relative flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
                          mine ? "border-[#00ffc8]/35 bg-[#00ffc8]/10 shadow-[inset_3px_0_0_#00ffc8]" : "border-white/[0.05] bg-white/[0.025]"
                        )}
                      >
                        {mine && <span className="absolute right-2 top-1 rounded-full bg-[#00ffc8] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-black">Seu clube</span>}
                        <div className="flex flex-1 items-center gap-2 min-w-0 justify-end">
                          <span className={cn("truncate text-right", r.homeScore > r.awayScore ? "text-white font-semibold" : "text-white/60")}>
                            {home?.nome ?? r.homeTeam}
                          </span>
                          {home && <TeamCrest team={home} size="xs" />}
                        </div>
                        <div className="shrink-0 rounded-lg bg-black/35 px-3 py-1.5 tabular-nums font-black text-white">
                          {r.homeScore} <span className="mx-1 text-white/25">–</span> {r.awayScore}
                        </div>
                        <div className="flex flex-1 items-center gap-2 min-w-0">
                          {away && <TeamCrest team={away} size="xs" />}
                          <span className={cn("truncate", r.awayScore > r.homeScore ? "text-white font-semibold" : "text-white/60")}>
                            {away?.nome ?? r.awayTeam}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
