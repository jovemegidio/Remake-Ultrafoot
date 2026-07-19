"use client"

import { Calendar, Target, TrendingUp, AlertCircle, Newspaper, ShoppingCart, Star, Zap, Trophy } from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { useUserTeam, useGameState } from "@/lib/save-system"

export default function CentralDaTemporadaPage() {
  const { team } = useUserTeam()
  const { state } = useGameState()

  const lastAwards = state.seasonAwards?.[state.seasonAwards.length - 1]
  const nextFixture = state.fixtures?.find(fixture => !fixture.played)
  const standingIndex = state.standings?.findIndex(entry => entry.curto === (state.selectedTeamShort ?? team.curto)) ?? -1
  const standing = standingIndex >= 0 ? state.standings?.[standingIndex] : undefined
  const cards = [
    { icon: Calendar, label: "Próximo jogo", desc: nextFixture ? `${nextFixture.homeNome} × ${nextFixture.awayNome}` : "Calendário aguardando próxima rodada" },
    { icon: Target, label: "Objetivo da diretoria", desc: standing && standingIndex < 6 ? "Manter classificação continental" : "Melhorar a posição no campeonato" },
    { icon: TrendingUp, label: "Situação na tabela", desc: standing ? `${standingIndex + 1}º lugar · ${standing.points} pontos` : "Classificação ainda não iniciada" },
    { icon: Star, label: "Moral do elenco", desc: `${Math.round(state.teamMorale ?? 70)} / 100` },
    { icon: AlertCircle, label: "Departamento médico", desc: `${state.injuries?.length ?? 0} atleta(s) indisponível(is)` },
    { icon: Newspaper, label: "Temporada", desc: `${state.results?.length ?? 0} partidas registradas` },
    { icon: Zap, label: "Categoria de base", desc: `${state.youthPlayers?.length ?? 0} jovens em desenvolvimento` },
    { icon: ShoppingCart, label: "Transferências", desc: `${state.transfers?.filter(transfer => transfer.season === state.season).length ?? 0} negócio(s) na temporada` },
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map(c => (
            <div key={c.label} className="rounded-xl bg-[#141414] border border-white/5 p-4">
              <c.icon className="h-5 w-5 text-[#1db954]" />
              <div className="mt-3 text-sm font-semibold text-white">{c.label}</div>
              <div className="mt-1 text-xs text-white/40 font-mono">{c.desc}</div>
            </div>
          ))}
        </div>

        {/* Prêmios individuais — o fim de temporada só reconhecia campeão,
            acesso e rebaixamento; os feitos do elenco não apareciam em lugar algum. */}
        {lastAwards && (
          <section className="rounded-xl border border-[#ffd700]/20 bg-[#ffd700]/[0.04] p-5">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#ffd700]" />
              <h2 className="text-lg font-bold text-white">
                Prêmios da temporada {lastAwards.season}
              </h2>
              <span className="text-xs text-white/40">{lastAwards.competition}</span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {lastAwards.winners.map(winner => (
                <div key={winner.award} className="rounded-lg border border-white/[0.06] bg-black/30 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffd700]">{winner.title}</p>
                  <p className="mt-1.5 text-base font-bold text-white">{winner.playerName}</p>
                  <p className="text-xs text-white/45">{winner.detail}</p>
                </div>
              ))}
            </div>

            {lastAwards.teamOfTheSeason.length > 0 && (
              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Seleção do campeonato</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {lastAwards.teamOfTheSeason.map(player => (
                    <span
                      key={`${player.position}-${player.playerName}`}
                      className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs"
                    >
                      <span className="font-bold text-[#1db954]">{player.position}</span>
                      <span className="text-white/85">{player.playerName}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
