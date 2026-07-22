"use client"

import { useEffect } from "react"
import Image from "next/image"
import { Sprout, Star, ArrowUp, AlertTriangle, RefreshCw, Send } from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { SystemMediaPlayer } from "@/components/system-media-player"
import { Button } from "@/components/ui/button"
import { useUserTeam, useGameState, type SquadPlayer } from "@/lib/save-system"
import { formatCurrency } from "@/lib/teams-data"
import { generateYouthProspects } from "@/lib/youth-academy"
import { advanceYouthMonth, generateYouthBatch, loanYouth, runTryout } from "@/lib/youth-engine"
import {
  capacidadeDaBase, vagasNaBase, evoluirSemana, propostaPorJovem,
  valorDeMercadoJovem, cobrancaDaDiretoria, type JovemBase,
} from "@/lib/youth-academy-rules"
import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"
import { useNotifications } from "@/components/notifications-system"
import { useGameEngine } from "@/lib/game-engine"

const PROMOTION_FEE = 200_000

export default function BasePage() {
  const { team } = useUserTeam()
  const { state, setState } = useGameState()
  const { addNotification } = useNotifications()
  const youth = state.youthPlayers ?? []
  const balance = state.balance && state.balance > 0 ? state.balance : team.saldo
  // Capacidade da base escala com a academia (ate 100 no nivel 5). O nivel vive
  // no game-engine (infraestrutura), nao no save da carreira.
  const nivelAcademia = useGameEngine(st => st.clubInfrastructure?.youthAcademyLevel) ?? 1
  const capacidade = capacidadeDaBase(nivelAcademia)
  const vagas = vagasNaBase(youth.length, nivelAcademia)

  // SEMEIA a base quando vazia.
  //
  // BUG que isto corrige ("os juniores nao funcionam"): a pagina le state.youthPlayers,
  // mas ninguem populava esse campo — o motor jogava os jovens gerados direto no elenco
  // profissional. A base ficava SEMPRE VAZIA. Aqui geramos os prospectos de forma
  // deterministica (clube + temporada) na primeira visita de cada temporada; promover e
  // dispensar seguem persistindo por cima.
  useEffect(() => {
    if (!team?.curto) return
    // Semeia na primeira visita da temporada. Usar `youthSeededSeason !== season` (e nao
    // "youthPlayers === undefined") cobre os dois casos: a primeira vez de todas, E o
    // inicio de uma temporada nova — quando youthPlayers pode ter ficado [] da anterior.
    if (state.youthSeededSeason !== state.season) {
      setState({
        youthPlayers: generateYouthProspects(team.curto, state.season, team.prestigio ?? 60),
        youthSeededSeason: state.season,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.curto, state.season])

  // ENVELHECIMENTO + PROMOÇÃO AUTOMÁTICA AOS 18 (pedido do usuário).
  //
  // A cada virada de temporada, a base envelhece um ano e QUEM COMPLETA 18 sobe
  // automaticamente ao profissional — não mais em bloco após 3 temporadas. O
  // `youthAgedSeason` garante que a idade só avança uma vez por temporada, mesmo
  // reabrindo a tela. Roda depois da semeadura, então a turma nova (14-17) do ano
  // não é promovida no mesmo tick.
  useEffect(() => {
    if (state.youthSeededSeason !== state.season) return // espera semear
    if (state.youthAgedSeason === state.season || youth.length === 0) return
    const envelhecida = youth.map(p => ({ ...p, age: (p.age ?? 16) + 1 }))
    const sobem = envelhecida.filter(p => (p.age ?? 0) >= 18)
    const ficam = envelhecida.filter(p => (p.age ?? 0) < 18)
    const promovidos = sobem.map((p, i) => ({
      ...p,
      id: `pro_auto_${state.season}_${i}_${p.id}`,
      fromTeam: "Categoria de Base",
      seasonSigned: state.season,
    }))
    setState({
      youthPlayers: ficam,
      squadPlayers: promovidos.length ? [...(state.squadPlayers ?? []), ...promovidos] : state.squadPlayers,
      youthAgedSeason: state.season,
    })
    if (promovidos.length) {
      addNotification({
        type: "system", priority: "medium",
        title: `${promovidos.length} da base subiu ao profissional`,
        message: `${promovidos.map(p => p.name).join(", ")} completou 18 anos e foi promovido automaticamente.`,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.season, state.youthSeededSeason, state.youthAgedSeason, youth.length])

  // COBRANÇA DA DIRETORIA pelo uso da base, em momentos definidos da temporada
  // (pedido). Dispara uma vez por janela, marcada em youthBoardCheckWeek.
  useEffect(() => {
    const semana = state.week ?? 0
    const cob = cobrancaDaDiretoria({
      semana,
      nivelAcademia,
      promovidosNaTemporada: (state.squadPlayers ?? [])
        .filter(p => p.fromTeam === "Categoria de Base" && p.seasonSigned === state.season).length,
    })
    if (!cob || state.youthBoardCheckWeek === semana) return
    setState({ youthBoardCheckWeek: semana })
    addNotification({
      type: "system", priority: cob.cumprida ? "medium" : "high",
      title: cob.titulo, message: cob.mensagem,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.week, state.season, nivelAcademia])

  const replacementFor = (player: SquadPlayer): SquadPlayer => {
    const generated = generateYouthBatch(state.season, 1, team.prestigio ?? 60)[0]
    return { ...generated, id: `replacement_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, position: player.position, fromTeam: "Nova geração da base" }
  }

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
      youthPlayers: [...youth.filter(p => p.id !== player.id), replacementFor(player)],
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
    setState({ youthPlayers: [...youth.filter(p => p.id !== player.id), replacementFor(player)] })
  }

  const holdTryout = () => {
    const fee = 100_000
    if (balance < fee) return window.alert("Saldo insuficiente para realizar a peneira.")
    const intake = runTryout(state, "sub17")
    setState({ youthPlayers: [...youth, ...intake.players], balance: balance - fee })
  }

  const developMonth = () => {
    const result = advanceYouthMonth(state)
    setState({ youthPlayers: result.state.youthPlayers, updatedAt: result.state.updatedAt })
    window.alert(`${result.report.highlights.length} jovem(ns) evoluíram neste mês.`)
  }

  /** Uma semana de trabalho na base — o acompanhamento semanal pedido. */
  const acompanharSemana = () => {
    const r = evoluirSemana(youth as unknown as JovemBase[], nivelAcademia)
    setState({ youthPlayers: r.jovens as unknown as SquadPlayer[] })
    if (r.destaques.length === 0) {
      addNotification({ type: "system", priority: "low", title: "Semana na base",
        message: "Semana sem evolução relevante entre os garotos." })
      return
    }
    addNotification({
      type: "system", priority: "medium",
      title: `${r.destaques.length} garoto(s) evoluíram nesta semana`,
      message: r.destaques.slice(0, 6).map(d => `${d.nome} +${d.ganho}`).join(", ")
        + (r.prontosParaSubir.length ? ` — pronto(s) para o profissional: ${r.prontosParaSubir.join(", ")}.` : ""),
    })
  }

  /** Vende um garoto: proposta gerada pelo valor de promessa, com negociação. */
  const venderJovem = (player: SquadPlayer) => {
    const j = player as unknown as JovemBase
    const clubes = ["Benfica", "Ajax", "Porto", "Shakhtar", "Red Bull Salzburg", "Palmeiras", "Flamengo"]
    const p = propostaPorJovem(j, clubes[Math.floor(Math.random() * clubes.length)])
    const justo = valorDeMercadoJovem(j)
    const texto = `${p.clube} oferece ${formatCurrency(p.valor)} por ${player.name}.\n` +
      `Valor estimado: ${formatCurrency(justo)}${p.abaixoDoValor ? "\n\nA proposta está ABAIXO do valor do atleta." : ""}\n\nAceitar a venda?`
    if (typeof window !== "undefined" && !window.confirm(texto)) return
    setState({
      youthPlayers: youth.filter(x => x.id !== player.id),
      balance: balance + p.valor,
    })
    addNotification({ type: "transfer", priority: "medium", title: `${player.name} vendido`,
      message: `${p.clube} contratou ${player.name} da base por ${formatCurrency(p.valor)}.` })
  }

  const sendOnLoan = (player: SquadPlayer) => {
    const club = window.prompt("Clube de destino do empréstimo:")?.trim()
    if (!club) return
    const result = loanYouth(state, player.id, club)
    setState({ youthPlayers: [...(result.youthPlayers ?? []), replacementFor(player)], updatedAt: result.updatedAt })
  }

  return (
    // Mesmo tratamento visual do pre-office (pedido): fundo do escritorio,
    // brilho radial e escurecimento, no lugar do preto chapado.
    <div className="relative min-h-screen pl-[72px] pb-24">
      <div className="fixed inset-0 bg-[#050508]" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <Image src="/images/office-bg-1.png" alt="" fill priority unoptimized className="office-bg-a object-cover" />
        <Image src="/images/office-bg-2.png" alt="" fill unoptimized className="office-bg-b object-cover" />
      </div>
      <div className="pointer-events-none fixed inset-0" style={{
        background: "radial-gradient(ellipse 90% 70% at 50% 20%, rgba(34,197,94,0.14) 0%, transparent 60%)",
      }} />
      <div className="pointer-events-none fixed inset-0 bg-black/60" />

      <div className="relative z-10">
      <GameSidebar />
      <GameHeader team={team} />
      <main className="p-6 space-y-6">
        <header className="flex flex-wrap items-center gap-3">
          <Sprout className="h-7 w-7 text-[#1db954]" />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">CATEGORIA DE BASE</h1>
            {/* Ocupação x capacidade: a base tem teto (ate 100 na academia nivel 5). */}
            <p className="text-white/50 mt-1">
              <span className={cn("font-semibold", vagas === 0 ? "text-amber-400" : "text-white/70")}>
                {youth.length}/{capacidade}
              </span>{" "}
              garotos • {vagas} vaga{vagas !== 1 ? "s" : ""} • Promoção: R$ {(PROMOTION_FEE / 1000).toFixed(0)}k
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={acompanharSemana} className="border-white/15 text-white">
              <RefreshCw className="mr-2 h-4 w-4" /> Acompanhar semana
            </Button>
            <Button variant="outline" onClick={developMonth} className="border-white/15 text-white">
              <RefreshCw className="mr-2 h-4 w-4" /> Evoluir um mês
            </Button>
            <Button
              onClick={holdTryout}
              disabled={vagas === 0}
              title={vagas === 0 ? "Base lotada — dispense ou promova alguém" : undefined}
              className="bg-[#1db954] text-black hover:bg-[#1ed760] disabled:opacity-40"
            >
              <Sprout className="mr-2 h-4 w-4" /> Peneira Sub-17 · R$ 100 mil
            </Button>
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
                      onClick={() => sendOnLoan(p)}
                      title="Emprestar"
                      className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10 text-xs"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    {/* Negociar o garoto: proposta pelo valor de PROMESSA. */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => venderJovem(p)}
                      title={`Vender — vale ~${formatCurrency(valorDeMercadoJovem(p as unknown as JovemBase))}`}
                      className="border-amber-400/40 text-amber-300 hover:bg-amber-400/10 text-xs"
                    >
                      Vender
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
