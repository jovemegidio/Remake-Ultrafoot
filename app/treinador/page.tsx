"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { GameHeader } from "@/components/game-header"
import { useGameState, useUserTeam } from "@/lib/save-system"
import { useGameEngine } from "@/lib/game-engine"
import { useGameManager } from "@/lib/use-game-manager"
import { buildCareerStats, rankInHistory } from "@/lib/hall-of-fame-engine"
import { listJobOffers, removeJobOffer, assumirClube, podeTrocarDeClube, type PendingJobOffer } from "@/lib/career-moves"
import { ofertasParaDesempregado, coachStandingScore } from "@/lib/coach-market"
import { allTeams } from "@/lib/teams-data"
import { hardNavigate } from "@/lib/hard-navigation"
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
  const { state, setState } = useGameState()
  const { currentSeason } = useGameManager()
  const matchResults = useGameEngine(s => s.matchResults)
  const initializeGame = useGameEngine(s => s.initializeGame)

  // Aceitar a proposta AQUI (antes so dava para recusar; aceitar exigia ir ao
  // Escritorio). Mesma troca de emprego, pela funcao compartilhada.
  const [avisoTroca, setAvisoTroca] = useState<string | null>(null)
  const aceitarOferta = useCallback((oferta: PendingJobOffer) => {
    // Trava de meio de temporada: quem acabou de assumir precisa cumprir o ano.
    const permissao = podeTrocarDeClube(state.contratadoEm, state.season, Boolean(state.selectedTeamShort))
    if (!permissao.pode) {
      setAvisoTroca(permissao.motivo ?? "Não é possível trocar de clube agora.")
      return
    }
    assumirClube(oferta.clubShort, {
      initializeGame,
      setEngineTime: (week, season) => useGameEngine.setState({ currentWeek: week, currentSeason: season }),
      setSaveState: (patch) => setState(patch as Parameters<typeof setState>[0]),
      navigate: hardNavigate,
      week: state.week,
      season: state.season,
    })
  }, [initializeGame, setState, state.week, state.season, state.contratadoEm, state.selectedTeamShort])

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

  // ── ESTADO SEM CLUBE ──────────────────────────────────────────────────────
  // Ao pedir demissao ou ser demitido, o tecnico vem PARA CA (nao mais para uma
  // tela separada) e fica aqui ate assumir um clube. As propostas SEMPRE
  // aparecem, ancoradas na reputacao (ver lib/coach-market). "Aguardar novas
  // propostas" avanca uma rodada da carreira e traz outro lote.
  const desempregado = !state.selectedTeamShort
  const [rodadaMercado, setRodadaMercado] = useState(0)
  const standing = useMemo(() => {
    const rep = carreira?.reputation ?? 0
    return {
      reputation: rep,
      totalTitles: (state.coachTotalTitles ?? 0) + (state.coachLegacy?.totalTitles ?? 0),
      reputationLevel: state.coachLegacy?.reputationLevel ?? 0,
    }
  }, [carreira, state.coachTotalTitles, state.coachLegacy])
  const patamar = useMemo(() => {
    const s = coachStandingScore(standing)
    return s >= 80 ? "Elite" : s >= 60 ? "Consolidada" : s >= 35 ? "Em ascensão" : "Iniciante"
  }, [standing])
  const ofertasDesemprego = useMemo<PendingJobOffer[]>(() => {
    if (!desempregado) return []
    return ofertasParaDesempregado(allTeams, standing, (state.week ?? 0) + rodadaMercado).map(t => ({
      id: `free_${t.curto}_${rodadaMercado}`,
      clubShort: t.curto,
      clubName: t.nome,
      clubPrestige: t.prestigio,
      kind: "club" as const,
      reason: `${String(t.divisao).replaceAll("_", " ")} · abriu o cargo e quer conversar com você.`,
      season: state.season ?? 2026,
      week: state.week ?? 0,
    }))
  }, [desempregado, standing, state.week, state.season, rodadaMercado])

  const aguardarPropostas = useCallback(() => {
    // Passa uma semana da carreira (o futebol segue) e reembaralha as ofertas.
    setState({ week: (state.week ?? 0) + 1 } as Parameters<typeof setState>[0])
    setRodadaMercado(r => r + 1)
  }, [setState, state.week])

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
    <div className="relative h-screen overflow-hidden bg-[#050508] pb-20 md:pb-0">
      {/* Mesmo pano de fundo do escritório (pedido: visual profissional igual
          ao office/pre-office): crossfade das fotos + véu para leitura. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Image src="/images/office-bg-1.png" alt="" fill priority unoptimized className="office-bg-a object-cover" />
        <Image src="/images/office-bg-2.png" alt="" fill unoptimized className="office-bg-b object-cover" />
        <div className="absolute inset-0 bg-[#050508]/72" />
      </div>

      <div className="relative z-10">
      <GameHeader team={userTeam} />

      <main className="flex h-[calc(100vh-48px-56px)] flex-col">
        {/* Hero do técnico — identidade em destaque, como o cabeçalho do office */}
        <div className="border-b border-white/[0.06] bg-black/35 px-4 py-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00ffc8]/30 bg-[#00ffc8]/10">
                <UserCircle className="h-8 w-8 text-[#00ffc8]" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white">
                  {state.managerName || "Técnico"}
                </h1>
                <p className="mt-0.5 text-xs text-white/55">
                  {desempregado
                    ? `Sem clube · Reputação ${patamar} · Temporada ${currentSeason}`
                    : `${userTeam.nome} · Temporada ${currentSeason}`}
                  {ranking && ` · ~${ranking.position}º entre os técnicos`}
                </p>
              </div>
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
          {(() => {
            // Sem clube: mostra as propostas por reputacao (sempre ha). Empregado:
            // mostra as propostas que chegaram enquanto trabalha.
            const lista = desempregado ? ofertasDesemprego : ofertas
            return (
          <section className={cn(
            "rounded-xl border p-5",
            desempregado ? "border-[#00ffc8]/40 bg-[#00ffc8]/[0.06]"
              : lista.length > 0 ? "border-[#ffd700]/30 bg-[#ffd700]/[0.05]" : "border-white/10 bg-black/40 backdrop-blur-md shadow-lg shadow-black/30",
          )}>
            <div className="mb-1 flex items-center gap-3"><h2 className="flex items-center gap-2 text-base font-bold text-white">
              <Briefcase className="h-4 w-4 text-[#ffd700]" />
              {desempregado ? "Mercado de treinadores" : "Propostas de trabalho"}
              {lista.length > 0 && (
                <span className="rounded-full bg-[#ffd700] px-2 py-0.5 text-[10px] font-black text-black">
                  {lista.length}
                </span>
              )}
            </h2><span className="h-px flex-1 bg-gradient-to-r from-[#ffd700]/40 to-transparent" /></div>

            {desempregado && (
              <p className="mt-1 mb-2 text-xs text-white/55">
                Você está sem clube. Estas diretorias abriram o cargo para você — aceite uma para voltar ao trabalho, ou aguarde novas sondagens.
              </p>
            )}

            {avisoTroca && (
              <p className="mt-1 mb-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                {avisoTroca}
              </p>
            )}

            {lista.length === 0 ? (
              <p className="mt-2 text-sm text-white/45">
                Nenhuma proposta no momento. Entregue resultado e outros clubes procuram você.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {lista.map(oferta => (
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
                      onClick={() => aceitarOferta(oferta)}
                      className="rounded-lg bg-[#00ffc8] px-3 py-1.5 text-xs font-black text-black hover:brightness-110"
                    >
                      Aceitar
                    </button>
                    {!desempregado && (
                      <button
                        onClick={() => { removeJobOffer(oferta.id); atualizarOfertas() }}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white/40 hover:bg-white/5 hover:text-white/70"
                      >
                        Recusar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {desempregado && (
              <button
                onClick={aguardarPropostas}
                className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/5"
              >
                Aguardar novas propostas (avança 1 semana)
              </button>
            )}
          </section>
            )
          })()}

          {/* Últimos resultados */}
          <section className="mt-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md shadow-lg shadow-black/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="mb-1 flex items-center gap-3"><h2 className="flex items-center gap-2 text-base font-bold text-white">
                <ClipboardList className="h-4 w-4 text-[#00ffc8]" />
                Últimos resultados
              </h2><span className="h-px flex-1 bg-gradient-to-r from-[#00ffc8]/40 to-transparent" /></div>
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
          <section className="mt-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md shadow-lg shadow-black/30 p-5">
            <div className="mb-1 flex items-center gap-3"><h2 className="flex items-center gap-2 text-base font-bold text-white">
              <Trophy className="h-4 w-4 text-[#ffd700]" />
              Carreira
            </h2><span className="h-px flex-1 bg-gradient-to-r from-[#00ffc8]/40 to-transparent" /></div>

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
    </div>
  )
}
