"use client"

import { useMemo } from "react"
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
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [results])

  if (!open) return null

  const isUserMatch = (r: RoundResult) =>
    (r.homeTeam === userHome && r.awayTeam === userAway) ||
    (r.homeTeam === userAway && r.awayTeam === userHome)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[88vh] rounded-2xl bg-[#0c1214] border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Resultados da Rodada</h2>
            <p className="text-xs text-white/40">Todos os jogos das competições em disputa</p>
          </div>
          <button
            onClick={onContinue}
            className="rounded-lg bg-[#00ffc8] px-5 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90"
          >
            Continuar →
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-6 py-4 space-y-6">
          {grouped.length === 0 ? (
            <p className="text-center text-white/30 py-10 text-sm">Nenhum outro jogo nesta rodada.</p>
          ) : (
            grouped.map(([competition, matches]) => (
              <div key={competition}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#00ffc8]/80 mb-2">{competition}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {matches.map((r, i) => {
                    const home = getTeamByShort(r.homeTeam)
                    const away = getTeamByShort(r.awayTeam)
                    const mine = isUserMatch(r)
                    return (
                      <div
                        key={`${r.homeTeam}-${r.awayTeam}-${i}`}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                          mine ? "bg-[#00ffc8]/10 ring-1 ring-[#00ffc8]/30" : "bg-white/[0.03]"
                        )}
                      >
                        <div className="flex flex-1 items-center gap-2 min-w-0 justify-end">
                          <span className={cn("truncate text-right", r.homeScore > r.awayScore ? "text-white font-semibold" : "text-white/60")}>
                            {home?.nome ?? r.homeTeam}
                          </span>
                          {home && <TeamCrest team={home} size="xs" />}
                        </div>
                        <div className="shrink-0 tabular-nums font-bold text-white px-2">
                          {r.homeScore} <span className="text-white/30">×</span> {r.awayScore}
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
