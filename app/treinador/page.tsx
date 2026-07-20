"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { GameHeader } from "@/components/game-header"
import { useGameState, useUserTeam } from "@/lib/save-system"
import { useGameEngine } from "@/lib/game-engine"
import { useGameManager } from "@/lib/use-game-manager"
import { buildCareerStats, rankInHistory } from "@/lib/hall-of-fame-engine"
import { listJobOffers, removeJobOffer, type PendingJobOffer } from "@/lib/career-moves"
import { cn } from "@/lib/utils"
import { Award, Briefcase, ClipboardList, Star, TrendingDown, TrendingUp, Trophy, UserCircle } from "lucide-react"

/**
 * Área do Treinador — a carreira sob a ótica do técnico, não do clube.
 *
 * Reúne o que estava espalhado: reputação e XP (save), histórico de temporadas
 * (hall-of-fame-engine), últimos resultados (game-engine) e propostas de outros
 * clubes (career-moves, que só apareciam no escritório e sumiam da vista).
 */
export default function TreinadorPage() {
  const router = useRouter()
  const { team: userTeam } = useUserTeam()
  const { state } = useGameState()
  const { currentSeason } = useGameManager()
  const matchResults = useGameEngine(s => s.matchResults)

  const [ofertas, setOfertas] = useState<PendingJobOffer[]>([])
  const atualizarOfertas = useCallback(() => {
    setOfertas(listJobOffers(currentSeason, state.week ?? 0))
  }, [currentSeason, state.week])

  useEffect(() => {
    atualizarOfertas()
    const handler = () => atualizarOfertas()
    window.addEventListener("ultrafoot:job-offers:changed", handler)
    return () => window.removeEventListener("ultrafoot:job-offers:changed", handler)
  }, [atualizarOfertas])

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.button === "B") router.back()
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router])

  const carreira = useMemo(() => {
    const historico = state.seasonHistory ?? []
    return historico.length > 0 ? buildCareerStats(historico) : null
  }, [state.seasonHistory])
  const ranking = useMemo(() => (carreira ? rankInHistory(carreira) : null), [carreira])

  // Últimos resultados do clube do usuário, do mais recente para o mais antigo.
  const ultimos = useMemo(() => {
    const curto = state.selectedTeamShort ?? userTeam.curto
    return [...matchResults]
      .filter(r => r.homeTeam === curto || r.awayTeam === curto)
      .slice(-10)
      .reverse()
      .map(r => {
        const emCasa = r.homeTeam === curto
        const meus = emCasa ? r.homeScore : r.awayScore
        const deles = emCasa ? r.awayScore : r.homeScore
        return {
          chave: `${r.season}-${r.week}-${r.homeTeam}-${r.awayTeam}`,
          adversario: emCasa ? r.awayTeam : r.homeTeam,
          placar: `${meus} x ${deles}`,
          local: emCasa ? "Casa" : "Fora",
          competicao: r.competition,
          resultado: meus > deles ? "V" : meus < deles ? "D" : "E",
        }
      })
  }, [matchResults, state.selectedTeamShort, userTeam.curto])

  const aproveitamentoRecente = useMemo(() => {
    if (ultimos.length === 0) return null
    const pontos = ultimos.reduce((s, r) => s + (r.resultado === "V" ? 3 : r.resultado === "E" ? 1 : 0), 0)
    return Math.round((pontos / (ultimos.length * 3)) * 100)
  }, [ultimos])

  return (
    <div className="h-screen overflow-hidden bg-[#050508] pb-20 md:pb-0">
      <GameHeader team={userTeam} />

      <main className="flex h-[calc(100vh-48px-56px)] flex-col">
        <div className="border-b border-white/[0.04] bg-[#0d0d0d] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold text-white">
                <UserCircle className="h-5 w-5 text-[#00ffc8]" />
                {state.managerName || "Técnico"}
              </h1>
              <p className="mt-0.5 text-xs text-white/50">
                {userTeam.nome} · Temporada {currentSeason}
                {ranking && ` · ~${ranking.position}º entre os técnicos`}
              </p>
            </div>
            <div className="flex items-center gap-4 text-right">
              {/* A reputação vem do hall-of-fame-engine (derivada de títulos,
                  aproveitamento e acessos). `coachReputation` no save pertence
                  ao YouthCareerState — carreira de base —, não a esta. */}
              <div>
                <p className="text-[10px] uppercase text-white/40">Reputação</p>
                <p className="text-sm font-semibold text-[#ffd700]">{carreira?.reputation ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-white/40">XP</p>
                <p className="text-sm font-semibold text-[#00ffc8]">{state.coachXP ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-game">
          {/* Propostas — antes só apareciam no escritório e passavam despercebidas. */}
          <section className={cn(
            "rounded-xl border p-5",
            ofertas.length > 0 ? "border-[#ffd700]/30 bg-[#ffd700]/[0.05]" : "border-white/[0.06] bg-[#0c0c10]",
          )}>
            <h2 className="flex items-center gap-2 text-base font-bold text-white">
              <Briefcase className="h-4 w-4 text-[#ffd700]" />
              Propostas de trabalho
              {ofertas.length > 0 && (
                <span className="rounded-full bg-[#ffd700] px-2 py-0.5 text-[10px] font-black text-black">
                  {ofertas.length}
                </span>
              )}
            </h2>

            {ofertas.length === 0 ? (
              <p className="mt-2 text-sm text-white/45">
                Nenhuma proposta no momento. Entregue resultado e outros clubes procuram você.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {ofertas.map(oferta => (
                  <div key={oferta.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-black/30 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">
                        {oferta.clubName}
                        {oferta.kind === "national" && (
                          <span className="ml-2 rounded bg-[#00ffc8]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#00ffc8]">SELEÇÃO</span>
                        )}
                      </p>
                      <p className="text-[11px] leading-4 text-white/45">{oferta.reason}</p>
                    </div>
                    <span className="text-[11px] text-white/40">prestígio {oferta.clubPrestige}</span>
                    <button
                      onClick={() => { removeJobOffer(oferta.id); atualizarOfertas() }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white/40 hover:bg-white/5 hover:text-white/70"
                    >
                      Recusar
                    </button>
                  </div>
                ))}
                <p className="text-[10px] text-white/35">
                  Para aceitar uma proposta, use o card do Escritório — é lá que a troca de clube acontece.
                </p>
              </div>
            )}
          </section>

          {/* Últimos resultados */}
          <section className="mt-4 rounded-xl border border-white/[0.06] bg-[#0c0c10] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-white">
                <ClipboardList className="h-4 w-4 text-[#00ffc8]" />
                Últimos resultados
              </h2>
              {aproveitamentoRecente !== null && (
                <span className={cn(
                  "flex items-center gap-1 text-xs font-semibold",
                  aproveitamentoRecente >= 50 ? "text-[#00ffc8]" : "text-red-400",
                )}>
                  {aproveitamentoRecente >= 50 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {aproveitamentoRecente}% de aproveitamento
                </span>
              )}
            </div>

            {ultimos.length === 0 ? (
              <p className="mt-2 text-sm text-white/45">Nenhuma partida disputada ainda.</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {ultimos.map(jogo => (
                  <div key={jogo.chave} className="flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2">
                    <span className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-black",
                      jogo.resultado === "V" ? "bg-[#00ffc8]/20 text-[#00ffc8]"
                        : jogo.resultado === "D" ? "bg-red-400/20 text-red-300"
                        : "bg-white/10 text-white/60",
                    )}>
                      {jogo.resultado}
                    </span>
                    <span className="w-16 shrink-0 font-mono text-sm text-white">{jogo.placar}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-white/70">{jogo.adversario}</span>
                    <span className="hidden shrink-0 text-[11px] text-white/35 sm:block">{jogo.competicao}</span>
                    <span className="shrink-0 text-[10px] text-white/30">{jogo.local}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Carreira */}
          <section className="mt-4 rounded-xl border border-white/[0.06] bg-[#0c0c10] p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-white">
              <Trophy className="h-4 w-4 text-[#ffd700]" />
              Carreira
            </h2>

            {!carreira ? (
              <p className="mt-2 text-sm text-white/45">
                Sua trajetória começa a ser registrada ao encerrar a primeira temporada.
              </p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
                  {[
                    ["Temporadas", String(carreira.totalSeasons), Star],
                    ["Partidas", String(carreira.totalMatches), ClipboardList],
                    ["Aproveitamento", `${carreira.winRate}%`, TrendingUp],
                    ["Títulos", String(carreira.trophies.length), Trophy],
                    ["Reputação", `${carreira.reputation}/100`, Award],
                  ].map(([rotulo, valor, Icone]) => {
                    const Ico = Icone as typeof Star
                    return (
                      <div key={rotulo as string} className="rounded-lg bg-black/30 p-3">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40">
                          <Ico className="h-3 w-3" />{rotulo as string}
                        </div>
                        <p className="mt-1 text-xl font-bold text-white">{valor as string}</p>
                      </div>
                    )
                  })}
                </div>

                {carreira.clubs.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Clubes treinados</p>
                    <div className="mt-2 space-y-1.5">
                      {carreira.clubs.map(clube => (
                        <div key={clube.clubCurto} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2">
                          <span className="text-sm text-white">{clube.clubNome}</span>
                          <span className="text-[11px] text-white/40">
                            {clube.fromSeason}–{clube.toSeason} · {clube.wins}/{clube.matches} vitórias · {clube.trophies} título(s)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ranking && (
                  <p className="mt-4 text-[11px] text-white/40">
                    Comparável a: {ranking.similarTo.join(", ")}
                  </p>
                )}
              </>
            )}
          </section>

        </div>
      </main>
    </div>
  )
}
