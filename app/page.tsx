"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Calendar,
  ChevronRight,
  CircleDollarSign,
  Shield,
  Star,
  Target,
  TrendingUp,
  TrendingDown,
  Trophy,
  Users,
  Play,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  UserPlus,
  ClipboardList,
  ArrowLeftRight,
} from "lucide-react"

import { GameHeader } from "@/components/game-header"
import { OnboardingOverlay } from "@/components/onboarding-overlay"
import { CtaPill } from "@/components/cta-pill"
import { TeamCrest } from "@/components/team-crest"
import { Progress } from "@/components/ui/progress"
import { MatchCarousel } from "@/components/match-carousel"
import { NewsFeed } from "@/components/news-feed"
import { formatCurrency, formatNumber, getTeamByShort, type Team } from "@/lib/teams-data"
import { cn } from "@/lib/utils"
import { useGameManager, type Fixture } from "@/lib/use-game-manager"
import { useGameEngine } from "@/lib/game-engine"
import { hardNavigate } from "@/lib/hard-navigation"
// Ciclo de carreira: propostas de clubes (motor existia, nunca era chamado) e demissao
// voluntaria (nao existia — so o TIPO no hall da fama).
import {
  listJobOffers,
  removeJobOffer,
  assumirClube,
  encerrarPassagem,
  podeTrocarDeClube,
  type PendingJobOffer,
} from "@/lib/career-moves"
import { useTranslation } from "@/lib/i18n"
import { useNationalTeam } from "@/lib/use-national-team"
import { calcSeasonObjective, computeBoardConfidence, getCareerStatus } from "@/lib/board-engine"
import { Flag, Briefcase } from "lucide-react"
import { useGameState, useManagingNational } from "@/lib/save-system"
import { NationalOffice } from "@/components/national-office"
import { WorldCupCenter } from "@/components/world-cup-center"

const HOME_MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
const HOME_WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]
const HOME_WEEKDAYS_LONG = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"]
const HOME_MONTHS_LONG = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

function roundToMonth(round: number): number {
  const monthOffset = Math.floor((round - 1) * 9 / 38)
  return Math.min(11, 3 + monthOffset)
}

function roundToDay(round: number): number {
  const daysInRound = [1, 5, 8, 12, 15, 19, 22, 26, 29]
  return daysInRound[(round - 1) % 9] || 15
}

// Usa o mes real do fixture (fonte de verdade do calendario da temporada) quando
// disponivel; roundToMonth e apenas fallback. Mantem a Central sincronizada com o Calendario.
function fixtureDate(round: number, month?: number): Date {
  return new Date(2026, month ?? roundToMonth(round), roundToDay(round))
}

function fixtureDateShort(round: number, month?: number): string {
  const date = fixtureDate(round, month)
  return `${HOME_MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`
}

function fixtureDateLine(round: number, month?: number): string {
  const date = fixtureDate(round, month)
  return `${HOME_WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} ${HOME_MONTHS_SHORT[date.getMonth()]}`
}

function fixtureDateHeadline(round: number, month?: number): string {
  const date = fixtureDate(round, month)
  return `${HOME_WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()} de ${HOME_MONTHS_LONG[date.getMonth()]}`
}

export default function DashboardPage() {
  const { hydrated, userTeam, seasonCalendar, currentStandings, currentCompetition, userPosition, currentSeason, saveState, fifaPause, advancePastFifaBreak, advanceWeek } = useGameManager()
  const [avancandoFifa, setAvancandoFifa] = useState(false)
  const [worldCupOpen, setWorldCupOpen] = useState(false)
  const avancarDataFifa = useCallback(async () => {
    if (avancandoFifa) return
    setAvancandoFifa(true)
    try { await advancePastFifaBreak() } finally { setAvancandoFifa(false) }
  }, [advancePastFifaBreak, avancandoFifa])

  // A Central do Mundial mapeia UMA semana de pausa para UMA rodada da Copa. Mas a
  // pausa já fica ativa na semana anterior ao seu início (é o aviso "o campeonato
  // vai parar"), e ali `week - fromWeek` dá -1, que era travado em 0: o primeiro
  // clique em "acompanhar próxima rodada" repetia a rodada 1 e parecia não fazer
  // nada. Entrar na pausa antes de abrir a Central alinha as duas contagens.
  const abrirCentralCopa = useCallback(async () => {
    if (avancandoFifa) return
    if (fifaPause && saveState.week < fifaPause.fromWeek) {
      setAvancandoFifa(true)
      try {
        const faltam = Math.min(8, fifaPause.fromWeek - saveState.week)
        for (let i = 0; i < faltam; i++) await advanceWeek()
      } finally { setAvancandoFifa(false) }
    }
    setWorldCupOpen(true)
  }, [avancandoFifa, fifaPause, saveState.week, advanceWeek])
  // setState: usado para assumir o novo clube ao aceitar uma proposta de emprego.
  const { setState } = useGameState()
  // MODO SELEÇÃO: se o técnico assumiu uma seleção, o escritório vira o da seleção.
  const { isNational } = useManagingNational()
  // Tabela do campeonato EM DISPUTA (antes mostrava sempre a Serie A, mesmo no estadual)
  const standings = currentStandings
  const { offers: nationalOffers, hasNationalTeam } = useNationalTeam()
  const gameEngine = useGameEngine()
  const t = useTranslation()
  const [sessionChecked, setSessionChecked] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)

  // ── Propostas de outros clubes + pedir demissao ───────────────────────────
  // ATENCAO: estes hooks TEM que ficar ANTES do early-return de carregamento (mais
  // abaixo). Estavam depois dele — no render de "carregando" nao rodavam, no render
  // carregado rodavam: numero de hooks diferente entre renders = React error #310, que
  // no build estatico aparece como "This page couldn't load" no office. NAO mover para
  // depois de nenhum return condicional.
  const [jobOffers, setJobOffers] = useState<PendingJobOffer[]>([])
  const [showResign, setShowResign] = useState(false)
  // Aviso da trava de troca de clube no meio da temporada.
  const [avisoTroca, setAvisoTroca] = useState<string | null>(null)

  const refreshJobOffers = useCallback(() => {
    setJobOffers(listJobOffers(currentSeason, saveState.week ?? 0))
  }, [currentSeason, saveState.week])

  useEffect(() => {
    refreshJobOffers()
    window.addEventListener("ultrafoot:job-offers:changed", refreshJobOffers)
    return () => window.removeEventListener("ultrafoot:job-offers:changed", refreshJobOffers)
  }, [refreshJobOffers])

  useEffect(() => {
    const careerEntry = new URLSearchParams(window.location.search).get("career") === "1"
    const bootstrapRaw = window.localStorage.getItem("ultrafoot:career-bootstrap")
    let bootstrapValid = false
    if (bootstrapRaw) {
      try {
        const bootstrap = JSON.parse(bootstrapRaw) as { teamShort?: string; createdAt?: number }
        bootstrapValid = Boolean(bootstrap.teamShort) && Date.now() - (bootstrap.createdAt ?? 0) < 120_000
      } catch { /* marcador invalido e ignorado */ }
    }
    const active = careerEntry || bootstrapValid || window.sessionStorage.getItem("ultrafoot:session-active") === "true"
    if (active) window.sessionStorage.setItem("ultrafoot:session-active", "true")
    setSessionActive(active)
    setSessionChecked(true)
  }, [])

  useEffect(() => {
    if (hydrated && saveState.selectedTeamShort) {
      window.localStorage.removeItem("ultrafoot:career-bootstrap")
    }
  }, [hydrated, saveState.selectedTeamShort])

  // Redireciona para fora do escritorio quando ele nao faz sentido:
  //  - sessao inativa (home aberta fora do fluxo do jogo) -> splash;
  //  - sessao ativa mas SEM CLUBE (demissao/demitido) -> Area do Treinador, o hub
  //    do tecnico sem clube, onde as propostas aparecem. Sem isto, o botao voltar
  //    caia no escritorio com um time fallback e daqui ia para o splash.
  useEffect(() => {
    if (!hydrated || !sessionChecked) return
    if (!sessionActive) hardNavigate("/splash", true)
    else if (!saveState.selectedTeamShort) hardNavigate("/treinador", true)
  }, [hydrated, saveState.selectedTeamShort, sessionActive, sessionChecked])

  // Navegacao por controle no dashboard
  useEffect(() => {
    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      switch (button) {
        case "A":
        case "START":
          hardNavigate("/partida")
          break
        case "X":
          hardNavigate("/calendario")
          break
        case "Y":
          hardNavigate("/elenco")
          break
        case "LB":
          hardNavigate("/mercado")
          break
        case "RB":
          hardNavigate("/competicoes")
          break
      }
    }
    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [])

  // Aguarda hidratacao
  // A sessao controla o redirecionamento, mas nao pode bloquear a renderizacao. Alguns
  // WebViews descartam sessionStorage no reload e antes deixavam este spinner eterno.
  if (!hydrated || !userTeam) {
    return (
      <div className="h-screen bg-[#050508] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin" />
          <span className="text-white/40 text-sm">{t.common.loading}</span>
        </div>
      </div>
    )
  }

  // MODO SELEÇÃO tem seu próprio escritório (mesma estrutura, dados da seleção).
  // Fica após o early-return de carregamento e todos os hooks — não altera a ordem deles.
  if (isNational) return <NationalOffice />

  const nextMatches = seasonCalendar.fixtures
    .filter(f => f.isUserMatch && !f.played)
    .slice(0, 5)

  const recentResults = seasonCalendar.fixtures
    .filter(f => f.isUserMatch && f.played)
    .slice(-3)

  const standingsPreview = (() => {
    const top = standings.slice(0, 8)
    const userIndex = standings.findIndex(row => row.teamShort === userTeam.curto)
    if (userIndex < 0 || userIndex < 8) return top.map((row, index) => ({ row, position: index + 1 }))
    return [
      ...top.slice(0, 7).map((row, index) => ({ row, position: index + 1 })),
      { row: standings[userIndex], position: userIndex + 1 },
    ]
  })()

  // ── Pressao da diretoria: meta -> confianca -> risco de demissao ──────────
  // Sem isso a campanha ruim nao custa nada; e o risco que transforma tabela em carreira.
  const playedUserFixtures = seasonCalendar.fixtures.filter(f => f.isUserMatch && f.played)
  const totalUserFixtures = seasonCalendar.fixtures.filter(f => f.isUserMatch).length
  const seasonProgress = totalUserFixtures > 0 ? playedUserFixtures.length / totalUserFixtures : 0

  // Forma: mais recente primeiro
  const recentForm: ("V" | "E" | "D")[] = [...playedUserFixtures]
    .reverse()
    .slice(0, 5)
    .map(f => {
      const userIsHome = f.homeTeam.curto === userTeam.curto
      const gf = userIsHome ? (f.homeScore ?? 0) : (f.awayScore ?? 0)
      const ga = userIsHome ? (f.awayScore ?? 0) : (f.homeScore ?? 0)
      return gf > ga ? "V" : gf === ga ? "E" : "D"
    })

  const seasonObjective = calcSeasonObjective(userTeam as unknown as Parameters<typeof calcSeasonObjective>[0])
  const boardConfidence = computeBoardConfidence({
    currentPosition: userPosition > 0 ? userPosition : seasonObjective.targetPosition,
    objective: seasonObjective,
    recentForm,
    seasonProgress,
  })
  const careerStatus = getCareerStatus(boardConfidence)

  /** Aceitar proposta: assume o novo clube e limpa as propostas pendentes. */
  const handleAcceptJobOffer = (offer: PendingJobOffer) => {
    // Trava de meio de temporada (mesma da Area do Treinador): quem acabou de
    // assumir cumpre o ano antes de trocar de novo.
    const permissao = podeTrocarDeClube(saveState.contratadoEm, saveState.season, Boolean(saveState.selectedTeamShort))
    if (!permissao.pode) {
      setAvisoTroca(permissao.motivo ?? "Cumpra a temporada antes de aceitar outra proposta.")
      return
    }
    // Mesma troca de emprego da Area do Treinador, pela funcao compartilhada.
    assumirClube(offer.clubShort, {
      initializeGame: gameEngine.initializeGame,
      setEngineTime: (week, season) => useGameEngine.setState({ currentWeek: week, currentSeason: season }),
      setSaveState: (patch) => setState(patch as Parameters<typeof setState>[0]),
      navigate: hardNavigate,
      week: saveState.week,
      season: saveState.season,
      // A dívida fica com o CLUBE. Sem isto ela seguia o técnico de emprego em
      // emprego, e amortizar num clube não mudava nada ao voltar depois.
      clubeAtual: saveState.selectedTeamShort,
      dividaAtual: saveState.debt,
      dividasPorClube: saveState.debtByClub,
    })
  }

  /**
   * Pedir demissao.
   *
   * Fazia so `setSaveState({ selectedTeamShort: null })`. Duas promessas da
   * propria tela ficavam sem cumprir: "registra a passagem no seu historico"
   * (nada era gravado — ver `encerrarPassagem`) e a saida limpa do clube (o
   * motor seguia com o elenco e o mercado do time que voce acabou de deixar).
   */
  const handleResign = () => {
    encerrarPassagem("resigned", {
      teamCurto: userTeam.curto,
      teamNome: userTeam.nome,
      season: saveState.season,
      week: saveState.week,
      passagensAtuais: saveState.passagens,
      setSaveState: (patch) => setState(patch as Parameters<typeof setState>[0]),
      limparClubeNoMotor: () => useGameEngine.getState().limparClubeAtual(),
      // A dívida fica arquivada com o clube que fica para trás.
      dividaAtual: saveState.debt,
      dividasPorClube: saveState.debtByClub,
    })
    hardNavigate("/treinador")
  }

  const weeklyIncome = gameEngine.weeklyIncome ?? 0
  const weeklyExpenses = gameEngine.weeklyExpenses ?? 0
  const balance = gameEngine.balance ?? userTeam.saldo
  const monthlyWages = gameEngine.squadPlayers.reduce((sum, p) => sum + (p.contract?.salary || 0), 0) * 4
  const monthlyScoutWages = gameEngine.scouts.reduce((sum, s) => sum + s.salary, 0) * 4
  const wageBudget = gameEngine.wageBudget ?? 0
  const wageUsed = monthlyWages + monthlyScoutWages
  const wagePercentage = wageBudget > 0 ? (wageUsed / wageBudget) * 100 : 0
  const salaryCritical = wagePercentage >= 100

  return (
    <div className="relative h-screen md:pl-0 pl-0 pb-20 md:pb-12 bg-[#050508] flex flex-col overflow-hidden">
      {fifaPause?.isWorldCup && (
        <WorldCupCenter
          open={worldCupOpen}
          season={currentSeason}
          hosts={fifaPause.hosts}
          currentWeek={saveState.week}
          fromWeek={fifaPause.fromWeek}
          untilWeek={fifaPause.untilWeek}
          onClose={() => setWorldCupOpen(false)}
          onAdvance={async () => { await advanceWeek() }}
        />
      )}
      {/* Tutorial de primeira vez (aparece so uma vez). */}
      <OnboardingOverlay teamName={userTeam?.nome} />
      {/* Fundo do escritorio: dois fundos alternando com crossfade suave */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/images/office-bg-1.webp"
          alt=""
          fill
          priority
          unoptimized
          className="office-bg-a object-cover"
        />
        <Image
          src="/images/office-bg-2.webp"
          alt=""
          fill
          unoptimized
          className="office-bg-b object-cover"
        />
        {/* VINHETA NO MINIMO (pedido): sobra apenas o veu escuro que o texto
            branco precisa para ter contraste. Era /82, depois /68; agora /42 —
            abaixo disso os cartoes do escritorio comecam a perder legibilidade
            sobre as partes claras da arte. */}
        <div className="absolute inset-0 bg-[#050508]/42" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Proposta de selecao nacional */}
        {!hasNationalTeam && nationalOffers.length > 0 && (
          <Link
            href="/selecao"
            className="group flex items-center gap-4 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/[0.06] p-4 transition-colors hover:bg-[var(--brand)]/[0.1]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/15">
              <Flag className="h-5 w-5 text-[var(--brand)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">
                {nationalOffers.length === 1
                  ? `${nationalOffers[0].nationalTeamName} quer voce no comando!`
                  : `${nationalOffers.length} selecoes querem te contratar!`}
              </p>
              <p className="truncate text-sm text-white/60">
                Voce recebeu uma proposta para comandar uma selecao nacional. Toque para ver os detalhes.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-[var(--brand)] transition-transform group-hover:translate-x-1" />
          </Link>
        )}

        {/* ACESSO / REBAIXAMENTO — aviso da mudanca de divisao na virada de temporada. */}
        {saveState.divisionMovement && (
          <div className={cn(
            "flex items-center gap-4 rounded-xl border p-4",
            saveState.divisionMovement.movement === "promoted"
              ? "border-[var(--brand)]/30 bg-[var(--brand)]/[0.06]"
              : "border-red-500/30 bg-red-500/[0.06]"
          )}>
            <div className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
              saveState.divisionMovement.movement === "promoted" ? "bg-[var(--brand)]/15 text-[var(--brand)]" : "bg-red-500/15 text-red-300"
            )}>
              {saveState.divisionMovement.movement === "promoted" ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">
                {saveState.divisionMovement.movement === "promoted" ? "Acesso conquistado!" : "Rebaixamento"}
              </p>
              <p className="truncate text-sm text-white/60">{saveState.divisionMovement.message}</p>
            </div>
            <button
              onClick={() => setState({ divisionMovement: undefined })}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
            >
              Entendi
            </button>
          </div>
        )}

        {/* PROPOSTAS DE OUTROS CLUBES.
            generateJobOffers() existia completa em board-engine.ts e NUNCA era chamada:
            nenhum clube jamais procurava o tecnico, por melhor que fosse a campanha. Agora
            roda no avanco de semana e as propostas aparecem aqui. */}
        {jobOffers.length > 0 && (
          <div className="rounded-xl border border-[#ffd700]/30 bg-[#ffd700]/[0.06] p-4">
            {avisoTroca && (
              <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                {avisoTroca}
              </p>
            )}
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#ffd700]/15">
                <Briefcase className="h-5 w-5 text-[#ffd700]" />
              </div>
              <div>
                <p className="font-semibold text-white">
                  {jobOffers.length === 1
                    ? "Um clube quer você no comando"
                    : `${jobOffers.length} clubes querem você no comando`}
                </p>
                <p className="text-sm text-white/50">
                  Sua campanha chamou atenção. Aceitar encerra seu ciclo no clube atual.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {jobOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {offer.clubName}
                      <span className="ml-2 text-[10px] font-normal text-white/35">
                        prestígio {offer.clubPrestige}
                      </span>
                    </p>
                    <p className="truncate text-xs text-white/45">{offer.reason}</p>
                  </div>
                  <button
                    onClick={() => handleAcceptJobOffer(offer)}
                    className="shrink-0 rounded-lg bg-[#ffd700] px-3 py-1.5 text-xs font-bold text-black transition-opacity hover:opacity-90"
                  >
                    Aceitar
                  </button>
                  <button
                    onClick={() => { removeJobOffer(offer.id); refreshJobOffers() }}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                  >
                    Recusar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Central hub estilo EA FC */}
        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr] items-start">
          {/* Coluna esquerda: data, proximo jogo e tarefas */}
          <div>
            {(() => {
              const next = nextMatches[0]
              const round = next?.round ?? saveState?.week ?? 1
              const positionOf = (curto?: string) => {
                if (!curto) return null
                const idx = standings.findIndex(s => s.teamShort === curto)
                return idx >= 0 ? idx + 1 : null
              }
              const homeTeam = next?.homeTeam
              const awayTeam = next?.awayTeam
              const tasks = [
                { href: "/partida", icon: Play, label: t.common.nextMatch, highlight: true },
                { href: "/elenco", icon: Users, label: t.sidebar.squad, highlight: false },
                { href: "/elenco/gerenciamento", icon: ClipboardList, label: "Gerenciamento do Time", highlight: false },
                { href: "/mercado", icon: ArrowLeftRight, label: t.sidebar.market, highlight: false },
              ]
              return (
                <>
                  {/* Manchete de data */}
                  <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight text-white text-balance">
                    {fixtureDateHeadline(round, next?.month)}
                  </h1>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">Rodada {round}</span>
                    <span className="h-px flex-1 bg-gradient-to-r from-[var(--brand)]/40 to-transparent" />
                  </div>

                  {/* PAUSA FIFA / COPA DO MUNDO: o campeonato de clubes esta parado.
                      O tecnico de clube nao joga durante a janela de selecoes —
                      acompanha a Copa e avanca ate o campeonato voltar. */}
                  {fifaPause?.active ? (
                    <div className="mt-6 rounded-2xl border border-amber-400/25 bg-gradient-to-b from-amber-400/[0.08] to-transparent p-5">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                        <span className="text-base">🌍</span>
                        {fifaPause.isWorldCup ? "Copa do Mundo FIFA" : "Data FIFA"}
                      </div>
                      <h2 className="mt-2 text-xl font-black text-white">
                        {fifaPause.isWorldCup ? "Campeonato pausado para a Copa do Mundo" : "Campeonato pausado — janela de seleções"}
                      </h2>
                      {fifaPause.isWorldCup && fifaPause.hosts ? (
                        <div className="mt-1 text-xs font-semibold text-amber-300/90">
                          Sede {currentSeason}: {fifaPause.hosts}
                          {fifaPause.note ? <span className="block font-normal text-white/45">{fifaPause.note}</span> : null}
                        </div>
                      ) : null}
                      <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                        {fifaPause.isWorldCup
                          ? "As ligas de clubes param durante o Mundial. Acompanhe a Copa do Mundo e avance até o seu campeonato voltar. Se você for chamado para dirigir uma seleção, comanda a equipe pela Área do Treinador."
                          : "Os jogos de clube param na janela de seleções (amistosos e Eliminatórias). Avance a data FIFA para retomar o campeonato."}
                      </p>
                      <button
                        onClick={fifaPause.isWorldCup ? abrirCentralCopa : avancarDataFifa}
                        disabled={avancandoFifa}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-[#231a05] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {avancandoFifa ? "Avançando…" : fifaPause.isWorldCup ? "Abrir Central da Copa do Mundo" : "Avançar a data FIFA"}
                      </button>
                    </div>
                  ) : homeTeam && awayTeam ? (
                    <div className="mt-6">
                      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/45">
                        <Trophy className="h-3.5 w-3.5 text-[#ffd700]" />
                        {next?.competition ?? "Liga"}
                        <span className="text-white/30">• Hoje</span>
                      </div>
                      <div className="mt-3 flex items-center gap-4">
                        <TeamCrest team={homeTeam} size="lg" />
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold uppercase tracking-tight text-white">{homeTeam.nome}</span>
                            {positionOf(homeTeam.curto) && (
                              <span className="text-sm font-medium text-white/40">{positionOf(homeTeam.curto)}°</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold uppercase tracking-tight text-white/70">{awayTeam.nome}</span>
                            {positionOf(awayTeam.curto) && (
                              <span className="text-sm font-medium text-white/40">{positionOf(awayTeam.curto)}°</span>
                            )}
                          </div>
                        </div>
                        <TeamCrest team={awayTeam} size="lg" />
                      </div>
                      <div className="mt-5">
                        <CtaPill href="/partida">Dia de jogo</CtaPill>
                      </div>
                    </div>
                  ) : null}

                  {/* Lista de tarefas */}
                  <div className="mt-7 space-y-px">
                    {tasks.map((task, i) => (
                      <Link
                        key={i}
                        href={task.href}
                        className={cn(
                          "group flex items-center gap-3 px-4 py-3.5 transition-colors",
                          task.highlight
                            ? "rounded-lg border border-[var(--brand)]/40 bg-[var(--brand)]/[0.06] hover:bg-[var(--brand)]/[0.1]"
                            : "border-b border-white/[0.06] hover:bg-white/5"
                        )}
                      >
                        <task.icon className={cn("h-5 w-5 shrink-0", task.highlight ? "text-[var(--brand)]" : "text-white/50")} />
                        <span className="flex-1 text-sm font-medium text-white">{task.label}</span>
                        <ChevronRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    ))}
                    <div className="px-4 pt-3 text-xs text-white/40">
                      {tasks.length} tarefas
                    </div>
                  </div>
                </>
              )
            })()}
          </div>

          {/* Coluna direita: noticia em destaque */}
          <div>
            <NewsFeed />
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            {nextMatches.length > 0 && (
              <MatchCarousel
                matches={nextMatches.map((f, i) => ({
                  home: f.homeTeam,
                  away: f.awayTeam,
                  date: fixtureDateShort(f.round, f.month),
                  time: "",
                  competition: f.competition,
                  matchday: f.round,
                  stadium: f.homeTeam.estadio_nome || "Estadio",
                }))}
                userTeam={userTeam}
              />
            )}

            {/* Resultados recentes */}
            {recentResults.length > 0 && (
              <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                    <Trophy className="h-4 w-4 text-[#ffd700]" />
                    {t.dashboard.lastResults}
                  </div>
                </div>
                <div className="divide-y divide-white/5">
                  {recentResults.map(f => (
                    <FixtureRow key={f.id} fixture={f} userTeam={userTeam} />
                  ))}
                </div>
              </section>
            )}

            {/* Proximas partidas */}
            {nextMatches.length > 0 && (
              <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                    <Calendar className="h-4 w-4 text-[var(--brand)]" />
                    {t.dashboard.nextMatches}
                  </div>
                  <Link href="/calendario" className="text-xs text-[var(--brand)] hover:text-[var(--brand-2)] transition-colors">
                    {t.common.viewAll} <ChevronRight className="inline h-3 w-3 ml-0.5" />
                  </Link>
                </div>
                <div className="divide-y divide-white/5">
                  {nextMatches.slice(0, 5).map((f, i) => (
                    <FixtureRow key={f.id} fixture={f} userTeam={userTeam} isNext={i === 0} />
                  ))}
                </div>
              </section>
            )}

            {/* Metas */}
            <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                  <Target className="h-4 w-4 text-[#ffd700]" />
                  {t.dashboard.boardGoals}
                </div>
                <span className="text-xs text-white/40">{t.dashboard.satisfaction}: <span className="text-[#ffd700] font-semibold">50%</span></span>
              </div>
              <div className="p-5 grid gap-4 md:grid-cols-2">
                <GoalCard title={t.dashboard.mainGoal} description="Permanecer na Serie A" progress={userPosition ? Math.max(10, 100 - userPosition * 5) : 50} status={t.common.inProgress} tone="primary" />
                <GoalCard title={t.dashboard.minGoal} description="Nao rebaixar (Top 16)" progress={userPosition && userPosition <= 16 ? 75 : 30} status={t.common.onTrack} tone="success" />
              </div>

              {/* PEDIR DEMISSAO — a feature nao existia. So havia o TIPO
                  (`endReason: "resigned"` no hall da fama); a acao nunca foi
                  implementada, entao o tecnico ficava preso no clube sem saida. */}
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.04] px-5 py-3">
                <p className="text-[11px] leading-snug text-white/35">
                  Sair por conta própria encerra seu ciclo no {userTeam.nome} e registra a
                  passagem no seu histórico.
                </p>
                <button
                  onClick={() => setShowResign(true)}
                  className="shrink-0 rounded-lg border border-red-500/25 px-3 py-1.5 text-xs font-semibold text-red-300/80 transition-colors hover:bg-red-500/10 hover:text-red-200"
                >
                  Pedir demissão
                </button>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            {salaryCritical && (
              <section className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
                  <div>
                    <div className="text-sm font-semibold text-red-200">Folha salarial acima do limite</div>
                    <p className="mt-1 text-xs leading-relaxed text-red-100/70">
                      Uso em {wagePercentage.toFixed(0)}%. Ajuste contratos ou vendas antes de novas contratacoes.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Diretoria: meta da temporada + confianca (risco de demissao) */}
            <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                  <Flag className="h-4 w-4 text-[var(--brand)]" />
                  <span>Diretoria</span>
                </div>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  careerStatus === "safe" && "bg-[var(--brand)]/15 text-[var(--brand)]",
                  careerStatus === "warning" && "bg-yellow-500/15 text-yellow-400",
                  careerStatus === "critical" && "bg-red-500/15 text-red-400",
                )}>
                  {careerStatus === "safe" ? "Prestigiado" : careerStatus === "warning" ? "Sob pressao" : "Cargo em risco"}
                </span>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs leading-relaxed text-white/50">{seasonObjective.description}</p>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-white/40">Confianca da diretoria</span>
                    <span className={cn(
                      "font-bold tabular-nums",
                      careerStatus === "safe" && "text-[var(--brand)]",
                      careerStatus === "warning" && "text-yellow-400",
                      careerStatus === "critical" && "text-red-400",
                    )}>{boardConfidence}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        careerStatus === "safe" && "bg-[var(--brand)]",
                        careerStatus === "warning" && "bg-yellow-400",
                        careerStatus === "critical" && "bg-red-500",
                      )}
                      style={{ width: `${boardConfidence}%` }}
                    />
                  </div>
                </div>
                {recentForm.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-white/40 mr-1">Forma</span>
                    {recentForm.map((r, i) => (
                      <span
                        key={i}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
                          r === "V" && "bg-[var(--brand)]/20 text-[var(--brand)]",
                          r === "E" && "bg-white/10 text-white/50",
                          r === "D" && "bg-red-500/20 text-red-400",
                        )}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Classificacao */}
            <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-white/60">
                  <Trophy className="h-4 w-4 shrink-0 text-[#ffd700]" />
                  <span className="shrink-0">{t.dashboard.standings}</span>
                  {currentCompetition && (
                    <span className="truncate text-[10px] uppercase tracking-wider text-[var(--brand)]/80">
                      · {currentCompetition}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-white/40">TOP 8 DE {standings.length || 20}</span>
              </div>
              <div className="divide-y divide-white/5">
                <div className="grid grid-cols-[32px_1fr_40px_32px_32px_32px] gap-1 px-4 py-2 text-[10px] text-white/40 uppercase tracking-wider">
                  <span>#</span><span>{t.dashboard.col.club}</span><span className="text-center">{t.dashboard.col.pts}</span>
                  <span className="text-center">{t.dashboard.col.w}</span><span className="text-center">{t.dashboard.col.d}</span><span className="text-center">{t.dashboard.col.l}</span>
                </div>
                {standingsPreview.map(({ row: s, position }) => {
                  const standingTeam = getTeamByShort(s.teamShort)
                  return (
                    <div
                      key={s.teamShort}
                      className={cn(
                        "grid grid-cols-[32px_1fr_40px_32px_32px_32px] gap-1 px-4 py-2.5 items-center text-sm",
                        s.teamShort === userTeam.curto && "bg-primary/10 border-l-2 border-primary"
                      )}
                    >
                      <span className={cn("text-xs font-medium", position <= 4 ? "text-[var(--brand)]" : position >= 17 ? "text-red-500" : "text-white/50")}>{position}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        {standingTeam && <TeamCrest team={standingTeam} size="xs" />}
                        <span className="truncate text-xs text-white">{standingTeam?.curto ?? s.teamShort}</span>
                      </div>
                      <span className="text-center font-semibold text-white">{s.points}</span>
                      <span className="text-center text-xs text-white/50">{s.won}</span>
                      <span className="text-center text-xs text-white/50">{s.drawn}</span>
                      <span className="text-center text-xs text-white/50">{s.lost}</span>
                    </div>
                  )
                })}
              </div>
              <Link href="/competicoes" className="flex items-center justify-center gap-1 py-3 text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors border-t border-white/[0.04]">
                {t.common.viewFullTable} <ChevronRight className="h-3 w-3" />
              </Link>
            </section>

            {/* Financas */}
            <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60 mb-4">
                <CircleDollarSign className="h-4 w-4 text-[var(--brand)]" />
                {t.dashboard.finances}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">{t.dashboard.currentBalance}</span>
                  <span className="text-lg font-bold text-[var(--brand)]">{formatCurrency(balance)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">{t.finances.weeklyIncome}</span>
                  <span className="text-sm font-medium text-white flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-[var(--brand)]" />
                    {formatCurrency(weeklyIncome)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">{t.finances.salaries}</span>
                  <span className="text-sm font-medium text-white flex items-center gap-1">
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                    {formatCurrency(weeklyExpenses)}
                  </span>
                </div>
              </div>
              <Link href="/financas" className="flex items-center justify-center gap-1 mt-4 py-2 text-xs text-primary hover:text-primary/80 transition-colors">
                {t.common.viewDetails} <ChevronRight className="h-3 w-3" />
              </Link>
            </section>
          </div>
        </div>
      </main>
      </div>

      {/* Confirmacao da demissao: e irreversivel, nao pode sair por clique acidental. */}
      {showResign && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowResign(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c14] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">Pedir demissão do {userTeam.nome}?</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Sua passagem pelo clube será encerrada e registrada no seu histórico de
              carreira. Você voltará ao menu para escolher um novo desafio.
            </p>
            <p className="mt-3 text-xs text-white/35">
              Esta ação não pode ser desfeita.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowResign(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={handleResign}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400"
              >
                Confirmar demissão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GoalCard({ title, description, progress, status, tone }: {
  title: string; description: string; progress: number; status: string; tone: "primary" | "success"
}) {
  const t = useTranslation()
  return (
    <div className="rounded-lg bg-white/5 p-4 border border-white/[0.04]">
      <div className="flex items-center justify-between mb-2">
        <span className={cn("text-[10px] font-medium tracking-wider uppercase", tone === "success" ? "text-[var(--brand)]" : "text-primary")}>{title}</span>
        <span className="text-[10px] text-white/40">{status}</span>
      </div>
      <div className="text-sm font-medium text-white mb-3">{description}</div>
      <div className="space-y-1.5">
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between text-[10px] text-white/40">
          <span>{t.dashboard.progress}</span>
          <span className="font-medium text-white">{progress}%</span>
        </div>
      </div>
    </div>
  )
}

function FixtureRow({ fixture, userTeam, isNext }: { fixture: Fixture; userTeam: Team; isNext?: boolean }) {
  const isHome = fixture.homeTeam.curto === userTeam.curto
  const t = useTranslation()
  const homeLabel = t.common.home
  const awayLabel = t.common.away
  const nextLabel = t.common.nextMatch.toUpperCase()

  return (
    <div className={cn(
      "flex items-center gap-4 border-l-2 border-[var(--brand)]/60 bg-[var(--brand)]/[0.035] px-5 py-3",
      isNext && "bg-[var(--brand)]/10",
    )}>
      <div className="w-20 text-xs">
        <div className="text-white/80">Rod. {fixture.round}</div>
        <div className="text-[10px] text-white/45">{fixtureDateLine(fixture.round, fixture.month)}</div>
        <div className={cn("text-[10px] font-medium", fixture.played ? (
          fixture.homeScore !== undefined && fixture.awayScore !== undefined
            ? (isHome ? fixture.homeScore > fixture.awayScore! : fixture.awayScore! > fixture.homeScore) ? "text-[var(--brand)]"
              : (isHome ? fixture.homeScore < fixture.awayScore! : fixture.awayScore! < fixture.homeScore) ? "text-red-400"
              : "text-white/50"
            : "text-white/50"
        ) : "text-white/40")}>
          {fixture.played && fixture.homeScore !== undefined
            ? `${fixture.homeScore} - ${fixture.awayScore}`
            : "vs"}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-1">
        <TeamCrest team={fixture.homeTeam} size="sm" />
        <span className={cn("text-sm", fixture.homeTeam.curto === userTeam.curto && "font-semibold text-white")}>
          {fixture.homeTeam.curto}
        </span>
        <span className="text-white/30 mx-1">vs</span>
        <span className={cn("text-sm", fixture.awayTeam.curto === userTeam.curto && "font-semibold text-white")}>
          {fixture.awayTeam.curto}
        </span>
        <TeamCrest team={fixture.awayTeam} size="sm" />
      </div>

      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", isHome ? "bg-[var(--brand)]/20 text-[var(--brand)]" : "bg-white/10 text-white/60")}>
        {isHome ? homeLabel : awayLabel}
      </span>

      <span className="hidden rounded bg-[var(--brand)]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--brand)] sm:inline">Meu clube</span>

      {isNext && !fixture.played && (
        <span className="px-2 py-0.5 rounded bg-[var(--brand)] text-[var(--brand-ink)] text-[10px] font-semibold">{nextLabel}</span>
      )}
    </div>
  )
}
