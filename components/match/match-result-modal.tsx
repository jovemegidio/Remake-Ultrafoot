"use client"

import Link from "next/link"
import { Trophy, RotateCcw, ChevronRight, BarChart3, Home } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Team } from "@/lib/teams-data"
import type { MatchState } from "@/lib/match-engine"

interface MatchResultModalProps {
  open: boolean
  homeTeam: Team
  awayTeam: Team
  state: MatchState
  userSide: "home" | "away"
  isFinal?: boolean // Se true, mostra opção "Ver Tela de Campeão"
  onClose: () => void
}

export function MatchResultModal({
  open,
  homeTeam,
  awayTeam,
  state,
  userSide,
  isFinal,
  onClose,
}: MatchResultModalProps) {
  if (!open) return null

  const userGoals = userSide === "home" ? state.home.goals : state.away.goals
  const oppGoals = userSide === "home" ? state.away.goals : state.home.goals
  const result: "win" | "draw" | "loss" =
    userGoals > oppGoals ? "win" : userGoals < oppGoals ? "loss" : "draw"

  const resultConfig = {
    win: {
      label: "VITÓRIA",
      color: "#1db954",
      bg: "from-[#1db954]/30 via-transparent to-transparent",
    },
    draw: {
      label: "EMPATE",
      color: "#eab308",
      bg: "from-yellow-500/20 via-transparent to-transparent",
    },
    loss: {
      label: "DERROTA",
      color: "#ef4444",
      bg: "from-red-500/30 via-transparent to-transparent",
    },
  }[result]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] border border-white/10 overflow-hidden shadow-2xl">
        {/* Hero */}
        <div className={cn("relative bg-gradient-to-b p-8 text-center", resultConfig.bg)}>
          <div
            className="text-[10px] font-black tracking-[0.5em] mb-2"
            style={{ color: resultConfig.color }}
          >
            FIM DE JOGO
          </div>
          <div
            className="text-5xl font-black tracking-tight"
            style={{ color: resultConfig.color }}
          >
            {resultConfig.label}
          </div>

          <div className="mt-8 flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <TeamCrest team={homeTeam} size="xl" />
              <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                {homeTeam.curto}
              </span>
            </div>

            <div className="flex items-center gap-3 px-6">
              <div
                className={cn(
                  "text-6xl font-black tabular-nums leading-none",
                  state.home.goals > state.away.goals ? "text-white" : "text-white/40",
                )}
              >
                {state.home.goals}
              </div>
              <div className="text-2xl font-light text-white/30">×</div>
              <div
                className={cn(
                  "text-6xl font-black tabular-nums leading-none",
                  state.away.goals > state.home.goals ? "text-white" : "text-white/40",
                )}
              >
                {state.away.goals}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <TeamCrest team={awayTeam} size="xl" />
              <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                {awayTeam.curto}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="p-6 border-t border-white/5 grid grid-cols-3 gap-px bg-white/5 rounded-lg overflow-hidden mx-6 mt-2">
          <StatLine label="POSSE" home={`${state.home.possession}%`} away={`${state.away.possession}%`} />
          <StatLine label="FINALIZAÇÕES" home={state.home.shots} away={state.away.shots} />
          <StatLine label="NO ALVO" home={state.home.shotsOnTarget} away={state.away.shotsOnTarget} />
          <StatLine label="xG" home={state.home.xG.toFixed(2)} away={state.away.xG.toFixed(2)} />
          <StatLine label="ESCANTEIOS" home={state.home.corners} away={state.away.corners} />
          <StatLine label="FALTAS" home={state.home.fouls} away={state.away.fouls} />
        </div>

        {/* Actions */}
        <div className="p-6 flex flex-col sm:flex-row items-center gap-3 justify-center">
          {isFinal && result === "win" && (
            <Link href="/campeao" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-gradient-to-r from-yellow-500 to-amber-400 text-black hover:opacity-90 font-bold tracking-wider"
              >
                <Trophy className="mr-2 h-5 w-5" />
                CERIMÔNIA DE CAMPEÃO
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white"
            >
              <Home className="mr-2 h-4 w-4" />
              Voltar ao Dashboard
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
            className="w-full sm:w-auto border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Ver Estatísticas
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatLine({
  label,
  home,
  away,
}: {
  label: string
  home: string | number
  away: string | number
}) {
  return (
    <div className="bg-[#0d0d0d] p-3">
      <div className="text-[9px] font-bold tracking-wider text-white/40 mb-1.5 text-center">
        {label}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-base font-bold tabular-nums text-white">{home}</span>
        <span className="text-base font-bold tabular-nums text-white">{away}</span>
      </div>
    </div>
  )
}
