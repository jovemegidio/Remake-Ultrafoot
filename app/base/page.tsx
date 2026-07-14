"use client"

import { Sprout, Star, ArrowUp, AlertTriangle } from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { SystemMediaPlayer } from "@/components/system-media-player"
import { Button } from "@/components/ui/button"
import { useUserTeam, useGameState, type SquadPlayer } from "@/lib/save-system"
import { formatCurrency } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

const PROMOTION_FEE = 200_000

export default function BasePage() {
  const { team } = useUserTeam()
  const { state, setState } = useGameState()
  const youth = state.youthPlayers ?? []
  const balance = state.balance && state.balance > 0 ? state.balance : team.saldo

  const promote = (player: SquadPlayer) => {
    if (balance < PROMOTION_FEE) {
      if (typeof window !== "undefined") window.alert("Saldo insuficiente para promover (R$ 200.000).")
      return
    }
    if (typeof window !== "undefined" && !window.confirm(`Promover ${player.name} ao elenco profissional por R$ 200.000?`)) {
      return
    }
    const promoted: SquadPlayer = {
      ...player,
      id: `pro_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fromTeam: "Categoria de Base",
      seasonSigned: state.season,
    }
    setState({
      squadPlayers: [...(state.squadPlayers ?? []), promoted],
      youthPlayers: youth.filter(p => p.id !== player.id),
      balance: balance - PROMOTION_FEE,
      transfers: [...(state.transfers ?? []), {
        id: `youth_promo_${Date.now()}`,
        playerName: player.name,
        fromTeam: "Categoria de Base",
        toTeam: team.curto,
        value: PROMOTION_FEE,
        type: "buy",
        week: state.currentRound ?? 0,
        season: state.season,
      }],
    })
  }

  const releaseYouth = (player: SquadPlayer) => {
    if (typeof window !== "undefined" && !window.confirm(`Dispensar ${player.name} da categoria de base?`)) return
    setState({ youthPlayers: youth.filter(p => p.id !== player.id) })
  }

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={team} />
      <main className="p-6 space-y-6">
        <header className="flex items-center gap-3">
          <Sprout className="h-7 w-7 text-[#1db954]" />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">CATEGORIA DE BASE</h1>
            <p className="text-white/50 mt-1">{youth.length} prospecto{youth.length !== 1 ? "s" : ""} disponível{youth.length !== 1 ? "is" : ""} • Taxa de promoção: R$ {(PROMOTION_FEE / 1000).toFixed(0)}k</p>
          </div>
        </header>

        {youth.length === 0 ? (
          <div className="rounded-xl bg-[#141414] border border-white/5 p-12 text-center">
            <Sprout className="h-12 w-12 mx-auto text-white/20 mb-3" />
            <h3 className="font-semibold text-white">Nenhum prospecto disponível</h3>
            <p className="text-sm text-white/50 mt-2">Avance a próxima temporada para a coordenação revelar uma nova geração.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {youth.map(p => {
              const isGem = p.potential >= 85
              return (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-xl border p-4 transition-all",
                    isGem ? "border-yellow-500/40 bg-yellow-500/5" : "border-white/5 bg-[#141414]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-white truncate">{p.name}</h3>
                        {isGem && <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-medium">{p.position}</span>
                        <span>{p.age} anos</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold tabular-nums text-white">{p.overall}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wider">overall</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white/5 px-3 py-2">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider">Potencial</div>
                      <div className={cn("text-lg font-bold tabular-nums", isGem ? "text-yellow-400" : "text-[#1db954]")}>
                        {p.potential}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/5 px-3 py-2">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider">Crescimento</div>
                      <div className="text-lg font-bold tabular-nums text-white">+{p.potential - p.overall}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                    <Stat label="VEL" v={p.pace ?? 0} />
                    <Stat label="FIN" v={p.shooting ?? 0} />
                    <Stat label="PAS" v={p.passing ?? 0} />
                    <Stat label="DRI" v={p.dribbling ?? 0} />
                    <Stat label="DEF" v={p.defending ?? 0} />
                    <Stat label="FÍS" v={p.physical ?? 0} />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => promote(p)}
                      disabled={balance < PROMOTION_FEE}
                      className="flex-1 bg-[#1db954] text-black hover:bg-[#1ed760] disabled:opacity-40 text-xs font-bold tracking-wider"
                    >
                      <ArrowUp className="mr-1 h-3.5 w-3.5" />
                      PROMOVER
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => releaseYouth(p)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs"
                    >
                      Dispensar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-200/80">
            Saldo atual: <strong className="text-white">{formatCurrency(balance)}</strong>. Promover um jovem custa R$ 200.000 e o move para o elenco profissional. Joias (potencial ≥85) são raras e indicam grande crescimento futuro.
          </div>
        </div>
      </main>
      <SystemMediaPlayer />
    </div>
  )
}

function Stat({ label, v }: { label: string; v: number }) {
  const color = v >= 80 ? "text-[#1db954]" : v >= 70 ? "text-yellow-400" : v >= 60 ? "text-white/80" : "text-white/50"
  return (
    <div className="rounded bg-white/5 px-1.5 py-1.5">
      <div className="text-[9px] text-white/40 tracking-wider">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", color)}>{v}</div>
    </div>
  )
}
