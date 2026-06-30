// PHASE 2 — Central da Temporada (HUB principal)
// Status: skeleton — esqueleto da página. Substituirá o dashboard como hub principal
// quando implementado. Conteúdo deve consumir season-engine + news-engine + transfer-engine.

"use client"

import { Calendar, Target, TrendingUp, AlertCircle, Newspaper, ShoppingCart, Star, Zap } from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { useUserTeam, useGameState } from "@/lib/save-system"

export default function CentralDaTemporadaPage() {
  const { team } = useUserTeam()
  const { state } = useGameState()

  const cards = [
    { icon: Calendar, label: "Próximo jogo", desc: "season-engine + calendar-engine" },
    { icon: Target, label: "Objetivo da diretoria", desc: "board-engine.generateObjectives" },
    { icon: TrendingUp, label: "Situação na tabela", desc: "table-engine + careerEngine.sortStandings" },
    { icon: Star, label: "Melhor / pior fase", desc: "morale-engine.calcSquadMorale" },
    { icon: AlertCircle, label: "Risco de lesão", desc: "injury-engine.rollInjuryRisk" },
    { icon: Newspaper, label: "Notícias", desc: "news-engine.listForWeek" },
    { icon: Zap, label: "Eventos pendentes", desc: "events-engine + dressing-room-engine" },
    { icon: ShoppingCart, label: "Janela de transferências", desc: "transfer-engine.tickTransferWindow" },
  ]

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={team} />
      <main className="p-6 space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-white tracking-tight">CENTRAL DA TEMPORADA</h1>
          <p className="text-white/50 mt-1">Hub principal · Temporada {state.season} · Rodada {state.currentRound || 0}</p>
        </header>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-200/80 text-sm">
          Skeleton (Fase 2). Esta página é o futuro hub. Os engines necessários estão definidos mas não implementados.
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map(c => (
            <div key={c.label} className="rounded-xl bg-[#141414] border border-white/5 p-4">
              <c.icon className="h-5 w-5 text-[#1db954]" />
              <div className="mt-3 text-sm font-semibold text-white">{c.label}</div>
              <div className="mt-1 text-xs text-white/40 font-mono">{c.desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
