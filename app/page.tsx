"use client"

import { useEffect, useState } from "react"
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
import { useTranslation } from "@/lib/i18n"
import { useNationalTeam } from "@/lib/use-national-team"
import { Flag } from "lucide-react"

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
  const { hydrated, userTeam, seasonCalendar, currentStandings, currentCompetition, userPosition, currentSeason, saveState } = useGameManager()
  // Tabela do campeonato EM DISPUTA (antes mostrava sempre a Serie A, mesmo no estadual)
  const standings = currentStandings
  const { offers: nationalOffers, hasNationalTeam } = useNationalTeam()
  const gameEngine = useGameEngine()
  const t = useTranslation()
  const [sessionChecked, setSessionChecked] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)

  useEffect(() => {
    setSessionActive(window.sessionStorage.getItem("ultrafoot:session-active") === "true")
    setSessionChecked(true)
  }, [])

  // Redireciona para splash quando a home foi aberta fora do fluxo do jogo.
  useEffect(() => {
    if (hydrated && sessionChecked && (!saveState.selectedTeamShort || !sessionActive)) {
      hardNavigate("/splash", true)
    }
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
  if (!hydrated || !sessionChecked || !sessionActive || !userTeam) {
    return (
      <div className="h-screen bg-[#050508] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#00ffc8] border-t-transparent animate-spin" />
          <span className="text-white/40 text-sm">{t.common.loading}</span>
        </div>
      </div>
    )
  }

  const nextMatches = seasonCalendar.fixtures
    .filter(f => f.isUserMatch && !f.played)
    .slice(0, 5)

  const recentResults = seasonCalendar.fixtures
    .filter(f => f.isUserMatch && f.played)
    .slice(-3)

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
    <div className="relative h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      {/* Fundo do escritorio: dois fundos alternando com crossfade suave */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/images/office-bg-1.png"
          alt=""
          fill
          priority
          unoptimized
          className="office-bg-a object-cover"
        />
        <Image
          src="/images/office-bg-2.png"
          alt=""
          fill
          unoptimized
          className="office-bg-b object-cover"
        />
        {/* Escurecimento para manter a leitura do conteudo */}
        <div className="absolute inset-0 bg-[#050508]/82" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Proposta de selecao nacional */}
        {!hasNationalTeam && nationalOffers.length > 0 && (
          <Link
            href="/selecao"
            className="group flex items-center gap-4 rounded-xl border border-[#00ffc8]/30 bg-[#00ffc8]/[0.06] p-4 transition-colors hover:bg-[#00ffc8]/[0.1]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#00ffc8]/15">
              <Flag className="h-5 w-5 text-[#00ffc8]" />
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
            <ChevronRight className="h-5 w-5 shrink-0 text-[#00ffc8] transition-transform group-hover:translate-x-1" />
          </Link>
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
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#00ffc8]">Rodada {round}</span>
                    <span className="h-px flex-1 bg-gradient-to-r from-[#00ffc8]/40 to-transparent" />
                  </div>

                  {/* Proximo jogo */}
                  {homeTeam && awayTeam ? (
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
                            ? "rounded-lg border border-[#00ffc8]/40 bg-[#00ffc8]/[0.06] hover:bg-[#00ffc8]/[0.1]"
                            : "border-b border-white/[0.06] hover:bg-white/5"
                        )}
                      >
                        <task.icon className={cn("h-5 w-5 shrink-0", task.highlight ? "text-[#00ffc8]" : "text-white/50")} />
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
                    <Calendar className="h-4 w-4 text-[#00ffc8]" />
                    {t.dashboard.nextMatches}
                  </div>
                  <Link href="/calendario" className="text-xs text-[#00ffc8] hover:text-[#00c8ff] transition-colors">
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

            {/* Classificacao */}
            <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-white/60">
                  <Trophy className="h-4 w-4 shrink-0 text-[#ffd700]" />
                  <span className="shrink-0">{t.dashboard.standings}</span>
                  {currentCompetition && (
                    <span className="truncate text-[10px] uppercase tracking-wider text-[#00ffc8]/80">
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
                {standings.slice(0, 8).map((s, i) => {
                  const standingTeam = getTeamByShort(s.teamShort)
                  return (
                    <div
                      key={s.teamShort}
                      className={cn(
                        "grid grid-cols-[32px_1fr_40px_32px_32px_32px] gap-1 px-4 py-2.5 items-center text-sm",
                        s.teamShort === userTeam.curto && "bg-primary/10 border-l-2 border-primary"
                      )}
                    >
                      <span className={cn("text-xs font-medium", i < 4 ? "text-[#00ffc8]" : i >= 16 ? "text-red-500" : "text-white/50")}>{i + 1}</span>
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
                <CircleDollarSign className="h-4 w-4 text-[#00ffc8]" />
                {t.dashboard.finances}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">{t.dashboard.currentBalance}</span>
                  <span className="text-lg font-bold text-[#00ffc8]">{formatCurrency(balance)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">{t.finances.weeklyIncome}</span>
                  <span className="text-sm font-medium text-white flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-[#00ffc8]" />
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
        <span className={cn("text-[10px] font-medium tracking-wider uppercase", tone === "success" ? "text-[#00ffc8]" : "text-primary")}>{title}</span>
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
    <div className={cn("flex items-center gap-4 px-5 py-3", isNext && "bg-[#00ffc8]/5")}>
      <div className="w-20 text-xs">
        <div className="text-white/80">Rod. {fixture.round}</div>
        <div className="text-[10px] text-white/45">{fixtureDateLine(fixture.round, fixture.month)}</div>
        <div className={cn("text-[10px] font-medium", fixture.played ? (
          fixture.homeScore !== undefined && fixture.awayScore !== undefined
            ? (isHome ? fixture.homeScore > fixture.awayScore! : fixture.awayScore! > fixture.homeScore) ? "text-[#00ffc8]"
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

      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", isHome ? "bg-[#00ffc8]/20 text-[#00ffc8]" : "bg-white/10 text-white/60")}>
        {isHome ? homeLabel : awayLabel}
      </span>

      {isNext && !fixture.played && (
        <span className="px-2 py-0.5 rounded bg-[#00ffc8] text-black text-[10px] font-semibold">{nextLabel}</span>
      )}
    </div>
  )
}
