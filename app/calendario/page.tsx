"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trophy,
  Star,
  FastForward,
  Play,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { ActionHint, GamepadButton, ShoulderHints } from "@/components/gamepad-icons"
import { TeamCrest } from "@/components/team-crest"
import { getTeamByShort } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { useGameManager, type Fixture } from "@/lib/use-game-manager"
import { hardNavigate } from "@/lib/hard-navigation"
import { getGameDate } from "@/lib/game-date"
import { cn } from "@/lib/utils"
import { useDiscordActivity } from "@/hooks/use-discord-rpc"

function roundToDay(round: number): number {
  const daysInRound = [1, 5, 8, 12, 15, 19, 22, 26, 29]
  return daysInRound[(round - 1) % 9] || 15
}

// Meses visiveis no calendario dependendo da regiao do time
const EUROPE_DIVISIONS = ["premier_league","la_liga","serie_a_ita","bundesliga","ligue_1","primeira_liga","eredivisie","scottish_prem","super_lig","pro_league_bel","russian_prem","championship","la_liga_2","serie_b_ita","bundesliga_2","ligue_2","liga_portugal_2","eerste_divisie","challenger_pro","tff_1_lig","russian_first"]
const SUMMER_LEAGUES = ["mls","j_league","k_league_1","chinese_super","j2_league","k_league_2","china_league_one"] // Fev-Nov/Dez
const SAUDI_LIKES = ["saudi_pro","saudi_first_div","liga_mx","liga_argentina","primera_a_col","primera_div_chi","primera_div_ury","primera_b_arg","torneo_betplay","primera_b_chi","segunda_div_ury"]

function getSeasonMonths(division: string): number[] {
  if (EUROPE_DIVISIONS.includes(division)) {
    // Agosto a Maio do ano seguinte: [7,8,9,10,11,0,1,2,3,4]
    return [7,8,9,10,11,0,1,2,3,4]
  }
  if (SUMMER_LEAGUES.includes(division)) {
    // Fevereiro a Dezembro
    return [1,2,3,4,5,6,7,8,9,10,11]
  }
  if (SAUDI_LIKES.includes(division)) {
    // Julho a Maio
    return [6,7,8,9,10,11,0,1,2,3,4]
  }
  // Brasileirao + outros: Janeiro a Novembro
  return [0,1,2,3,4,5,6,7,8,9,10]
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

const MONTH_NAMES_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
]

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

const WEEKDAY_NAMES = [
  "DOMINGO", "SEGUNDA-FEIRA", "TERCA-FEIRA", "QUARTA-FEIRA", 
  "QUINTA-FEIRA", "SEXTA-FEIRA", "SABADO"
]

export default function CalendarioPage() {
  const router = useRouter()
  const { team: userTeam } = useUserTeam()
  useDiscordActivity("Vendo o calendario", userTeam.nome)
  const {
    seasonCalendar,
    currentWeek,
    currentSeason,
    advanceWeek,
    standings,
    hydrated,
    league,
  } = useGameManager()

  const seasonMonths = useMemo(() => getSeasonMonths(league ?? "serie_a"), [league])
  const [currentMonth, setCurrentMonth] = useState(() => seasonMonths[0])
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [showChampionScreen, setShowChampionScreen] = useState(false)
  const [championTeam, setChampionTeam] = useState<string | null>(null)

  // Filtra fixtures por mes usando o campo month do fixture
  const monthFixtures = useMemo(() => {
    return seasonCalendar.fixtures.filter(f => {
      return f.month === currentMonth
    })
  }, [seasonCalendar.fixtures, currentMonth])

  // Proxima partida do usuario
  const nextUserMatch = seasonCalendar.nextUserMatch

  // Fixture selecionada
  const selectedFixture = useMemo(() => {
    if (!selectedDay) return nextUserMatch
    return monthFixtures.find(f => {
      const fixtureDay = roundToDay(f.round)
      return fixtureDay === selectedDay && f.isUserMatch
    }) || nextUserMatch
  }, [selectedDay, monthFixtures, nextUserMatch])

  // Data que corre na animacao (DIA a DIA, para dar imersao — antes o jogo pulava
  // de semana em semana). O engine continua avancando por semana nos bastidores:
  // a cada ~7 dias percorridos chamamos advanceWeek() (que usa refs, por isso pode
  // ser chamado em sequencia com seguranca).
  const [simDate, setSimDate] = useState<Date | null>(null)
  const [simProgress, setSimProgress] = useState(0)

  const simulateUntilMatch = useCallback(
    async (target: Fixture) => {
      if (isSimulating) return
      setIsSimulating(true)

      const weeks = Math.max(0, target.week - currentWeek - 1)
      const start = getGameDate(currentSeason, currentWeek)
      const end = new Date(currentSeason, target.month ?? start.getMonth(), roundToDay(target.round))
      const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000))

      // Quanto mais longe a data, mais rapido o dia corre (mantem a animacao curta).
      const delay = totalDays > 60 ? 18 : totalDays > 30 ? 32 : 55
      const perWeek = totalDays / Math.max(1, weeks)

      let advanced = 0
      for (let d = 1; d <= totalDays; d++) {
        setSimDate(new Date(start.getTime() + d * 86_400_000))
        setSimProgress(Math.round((d / totalDays) * 100))

        // Cruzou mais uma semana de calendario -> simula essa rodada no engine.
        if (advanced < weeks && d >= Math.round((advanced + 1) * perWeek)) {
          advanceWeek()
          advanced++
        }
        await new Promise(r => setTimeout(r, delay))
      }
      // Garante que nenhuma semana ficou para tras por arredondamento.
      while (advanced < weeks) {
        advanceWeek()
        advanced++
      }

      hardNavigate("/partida")
    },
    [advanceWeek, currentWeek, currentSeason, isSimulating],
  )

  // Dias do calendario
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(2026, currentMonth + 1, 0).getDate()
    const firstDayOfMonth = new Date(2026, currentMonth, 1).getDay()
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
    const prevMonthDays = new Date(2026, currentMonth, 0).getDate()
    
    const days: { day: number; isCurrentMonth: boolean; fixture: Fixture | null }[] = []
    
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isCurrentMonth: false, fixture: null })
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const fixture = monthFixtures.find(f => {
        const fixtureDay = roundToDay(f.round)
        return fixtureDay === d && f.isUserMatch
      })
      days.push({ day: d, isCurrentMonth: true, fixture: fixture || null })
    }
    
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, isCurrentMonth: false, fixture: null })
    }
    
    return days
  }, [currentMonth, monthFixtures])

  // Janela de transferencias
  const transferWindow = useMemo(() => {
    const currentMonthNum = currentMonth + 1
    const isOpen = (currentMonthNum >= 1 && currentMonthNum <= 2) || (currentMonthNum >= 7 && currentMonthNum <= 8)
    const nextOpenMonth = currentMonthNum < 7 ? 7 : 1
    const daysUntil = isOpen ? 0 : Math.abs((nextOpenMonth - currentMonthNum) * 30)
    return { isOpen, daysUntil }
  }, [currentMonth])

  const seasonCompetitions = useMemo(() => {
    const comps = new Set<string>()
    // Inclui todas as competicoes presentes nos fixtures do usuario
    seasonCalendar.fixtures.filter(f => f.isUserMatch).forEach(f => comps.add(f.competition))
    if (comps.size === 0) comps.add("Liga")
    return Array.from(comps)
  }, [seasonCalendar.fixtures])

  const handleAdvanceRound = useCallback(async () => {
    setIsSimulating(true)
    try {
      const result = await advanceWeek()
      if (result?.newSeason) {
        setChampionTeam(standings[0]?.teamShort ?? null)
        setShowChampionScreen(true)
      }
    } finally {
      setIsSimulating(false)
    }
  }, [advanceWeek, standings])

  const totalSeasonWeeks = useMemo(() => {
    return seasonCalendar.fixtures.length > 0
      ? Math.max(...seasonCalendar.fixtures.map(f => f.week))
      : 38
  }, [seasonCalendar.fixtures])

  const canSimulate = currentWeek < totalSeasonWeeks && !isSimulating

  useEffect(() => {
    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      switch (button) {
        case "B":
          router.back()
          break
        case "LB":
          setCurrentMonth(m => {
            const idx = seasonMonths.indexOf(m)
            return seasonMonths[(idx - 1 + seasonMonths.length) % seasonMonths.length]
          })
          break
        case "RB":
          setCurrentMonth(m => {
            const idx = seasonMonths.indexOf(m)
            return seasonMonths[(idx + 1) % seasonMonths.length]
          })
          break
      }
    }
    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [router, seasonMonths])

  useEffect(() => {
    if (nextUserMatch) {
      const day = roundToDay(nextUserMatch.round)
      setSelectedDay(day)
      // Navega para o mes da proxima partida
      setCurrentMonth(nextUserMatch.month)
    }
  }, [nextUserMatch])

  if (!hydrated) {
    return (
      <div className="h-screen overflow-hidden md:pl-0 pl-0 pb-20 md:pb-0 bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  // Data atual formatada usando month do fixture
  const matchMonth = nextUserMatch ? nextUserMatch.month : seasonMonths[0]
  const matchDay = nextUserMatch ? roundToDay(nextUserMatch.round) : 15
  const matchDate = new Date(2026, matchMonth, matchDay)
  const dayOfWeek = WEEKDAY_NAMES[matchDate.getDay()]
  const dayNum = matchDate.getDate()
  const monthName = MONTH_NAMES_SHORT[matchDate.getMonth()].toUpperCase()

  return (
  <div className="h-screen overflow-hidden md:pl-0 pl-0 pb-20 md:pb-0 relative bg-[#050508]">

  {/* Overlay de simulacao DIA A DIA (imersao: a data corre dia por dia ate a partida) */}
  {isSimulating && simDate && (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/88 backdrop-blur-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#00ffc8]">
        Simulando dias
      </div>
      <div className="mt-4 text-7xl font-black tabular-nums leading-none text-white">
        {String(simDate.getDate()).padStart(2, "0")}
        <span className="ml-3 text-4xl font-black uppercase text-white/70">
          {MONTH_NAMES_SHORT[simDate.getMonth()]}
        </span>
      </div>
      <div className="mt-3 text-sm font-medium uppercase tracking-wider text-white/45">
        {["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"][simDate.getDay()]}
      </div>
      <div className="mt-8 h-1.5 w-72 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#00ffc8] to-[#00c8ff] transition-[width] duration-100"
          style={{ width: `${simProgress}%` }}
        />
      </div>
      <div className="mt-3 text-xs text-white/35">{simProgress}%</div>
    </div>
  )}

  {/* Background Image - Futuristic Grid */}
  <div className="absolute inset-0 md:ml-16">
  <Image
  src="/images/pre-jogo/in-game-6.png"
  alt="Calendar Background"
  fill
  className="object-cover"
  priority
  />
  {/* Professional Vignette Overlays */}
  {/* Base dark overlay for readability */}
  <div className="absolute inset-0 bg-black/30" />
  
  {/* Left vignette - stronger for sidebar info */}
  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
  
  {/* Top vignette for month tabs */}
  <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />
  
  {/* Bottom vignette for footer controls */}
  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
  
  {/* Radial vignette for cinematic depth */}
  <div className="absolute inset-0" style={{ 
  background: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 30%, rgba(0,0,0,0.5) 100%)" 
  }} />
  
  {/* Subtle corner accents to complement cyan glow */}
  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/40" />
  </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 flex items-center justify-between h-12 px-6 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-6">
          <span className="text-white/60 text-sm font-medium">Escritorio</span>
          <span className="text-white text-sm font-bold">Calendario</span>
          {/* Month Tabs */}
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setCurrentMonth(m => {
                const idx = seasonMonths.indexOf(m)
                return seasonMonths[(idx - 1 + seasonMonths.length) % seasonMonths.length]
              })}
              className="p-1 text-white/40 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {seasonMonths.map((monthIndex) => (
              <button
                key={monthIndex}
                onClick={() => setCurrentMonth(monthIndex)}
                className={cn(
                  "px-3 py-1 text-xs font-medium transition-all rounded",
                  monthIndex === currentMonth
                    ? "bg-white/20 text-white"
                    : "text-white/50 hover:text-white/80"
                )}
              >
                {MONTH_NAMES[monthIndex]}
              </button>
            ))}
            <button
              onClick={() => setCurrentMonth(m => {
                const idx = seasonMonths.indexOf(m)
                return seasonMonths[(idx + 1) % seasonMonths.length]
              })}
              className="p-1 text-white/40 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* User Team */}
        <div className="flex items-center gap-2">
          <TeamCrest team={userTeam} size="xs" />
          <span className="text-white text-sm font-medium">{userTeam.nome}</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex h-[calc(100vh-48px-56px)] p-6 gap-6">
        {/* Left Panel - Match Info (EA FC Style) */}
        <aside className="w-56 flex-shrink-0 flex flex-col">
          {/* Current Date - Large */}
          <div className="mb-8">
            <div className="text-white/60 text-xs font-medium tracking-wider uppercase mb-1">
              {dayOfWeek}
            </div>
            <div className="text-white text-3xl font-black tracking-tight">
              {monthName} {dayNum}
            </div>
            <div className="text-white/50 text-sm">
              {2026}
            </div>
          </div>

          {/* Competition */}
          {selectedFixture && (
            <div className="mb-6">
              <div className="text-white text-sm font-bold">
                {selectedFixture.competition === "Brasileirao Serie A" ? "Brasileirao Serie A" : selectedFixture.competition}
              </div>
            </div>
          )}

          <Link href="/competicoes" className="mb-6 group block">
            <div className="flex items-center gap-2 text-white/50 text-xs font-medium uppercase tracking-wider mb-2 group-hover:text-white/70 transition-colors">
              <Trophy className="h-3.5 w-3.5 text-yellow-400" />
              Campeonatos
            </div>
            <div className="space-y-1.5">
              {seasonCompetitions.map((competition) => (
                <div key={competition} className="text-white/80 text-xs font-semibold leading-tight group-hover:text-white transition-colors">
                  {competition}
                </div>
              ))}
            </div>
          </Link>

          {/* Opponent Team with Stars */}
          {selectedFixture && (
            <div className="mb-8">
              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    className={cn(
                      "h-4 w-4",
                      star <= 3 ? "fill-yellow-400 text-yellow-400" : "text-white/20"
                    )} 
                  />
                ))}
              </div>
              
              {/* Large Team Crest */}
              <div className="relative mb-4">
                <TeamCrest 
                  team={selectedFixture.homeTeam.curto === userTeam.curto ? selectedFixture.awayTeam : selectedFixture.homeTeam} 
                  size="2xl" 
                />
              </div>
              
              {/* Team Name */}
              <div className="text-white text-xl font-black">
                {selectedFixture.homeTeam.curto === userTeam.curto
                  ? selectedFixture.awayTeam.nome
                  : selectedFixture.homeTeam.nome}
              </div>
            </div>
          )}

          {/* Simular ate a partida selecionada e ir para o jogo */}
          {selectedFixture && !selectedFixture.played && selectedFixture.week > currentWeek && (
            <button
              onClick={() => simulateUntilMatch(selectedFixture)}
              disabled={isSimulating}
              className={cn(
                "mb-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all",
                "bg-gradient-to-r from-[#00ffc8] to-[#00c8ff] text-black hover:brightness-110",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {isSimulating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Simulando...
                </>
              ) : selectedFixture.week === currentWeek + 1 ? (
                <>
                  <Play className="h-4 w-4" />
                  Ir para o jogo
                </>
              ) : (
                <>
                  <FastForward className="h-4 w-4" />
                  Simular ate esta partida
                </>
              )}
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Transfer Window */}
          <div className="border-t border-white/10 pt-4">
            <div className="text-white/50 text-xs font-medium mb-1">
              {transferWindow.isOpen ? "Janela de Transferencias" : "Janela de Transferencias Fechada"}
            </div>
            {!transferWindow.isOpen ? (
              <>
                <div className="text-white text-4xl font-black">
                  {transferWindow.daysUntil}
                </div>
                <div className="text-white/50 text-xs">
                  Dias Ate Abrir
                </div>
              </>
            ) : (
              <div className="text-[#00ff88] text-lg font-bold">
                Aberta
              </div>
            )}
          </div>
        </aside>

        {/* Calendar Grid (EA FC Glassmorphism Style) */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 bg-white/10 backdrop-blur-md rounded-xl overflow-hidden border border-white/10">
            {/* Week days header */}
            <div className="grid grid-cols-7 border-b border-white/10">
              {WEEK_DAYS.map((day) => (
                <div key={day} className="p-3 text-center text-xs font-bold text-white/40 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 auto-rows-fr h-[calc(100%-44px)]">
              {calendarDays.map((item, i) => {
                const isSelected = item.isCurrentMonth && item.day === selectedDay
                const hasMatch = item.fixture !== null
                const isHome = item.fixture?.homeTeam.curto === userTeam.curto
                const opponent = item.fixture ? (isHome ? item.fixture.awayTeam : item.fixture.homeTeam) : null
                
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (item.isCurrentMonth) setSelectedDay(item.day)
                    }}
                    disabled={!item.isCurrentMonth}
                    className={cn(
                      "relative overflow-hidden border-r border-b border-white/5 transition-all",
                      item.isCurrentMonth ? "hover:bg-white/5" : "opacity-30",
                      isSelected && "bg-white/10",
                    )}
                  >
                    {/* Day number */}
                    <span className={cn(
                      "absolute left-0 right-0 z-10 text-center font-bold",
                      !item.isCurrentMonth && "text-white/20",
                      item.isCurrentMonth && !hasMatch && "text-white/50",
                      hasMatch && "text-white"
                    )}
                    style={{ top: 8, fontSize: 24, lineHeight: "24px" }}
                    >
                      {item.day}
                    </span>

                    {/* Match Card (EA FC Style) */}
                    {hasMatch && opponent && (
                      <div
                        className="absolute left-2 right-2 rounded-lg px-2 flex items-center justify-center gap-1.5 overflow-hidden shadow-lg border"
                        style={{
                          bottom: 6,
                          height: 32,
                          backgroundColor: isHome ? "rgba(0, 136, 255, 0.35)" : "rgba(0, 204, 102, 0.35)",
                          borderColor: isHome ? "rgba(0, 136, 255, 0.6)" : "rgba(0, 204, 102, 0.6)",
                        }}
                      >
                        <TeamCrest team={opponent} size="xs" />
                        <div className="min-w-0 flex flex-col items-start leading-none">
                          <div
                            className="font-black uppercase"
                            style={{
                              color: isHome ? "#8ed0ff" : "#86ffb0",
                              fontSize: 9,
                              lineHeight: "10px",
                            }}
                          >
                            {isHome ? "Casa" : "Fora"}
                          </div>
                          <div
                            className="font-bold text-white/60 uppercase"
                            style={{ fontSize: 8, lineHeight: "9px" }}
                          >
                            {item.fixture?.competition === "Brasileirao Serie A" ? "Liga" : "Copa"}
                          </div>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Bottom Action Bar (EA FC Style) */}
      <footer className="absolute bottom-0 left-0 right-0 md:ml-16 h-14 flex items-center justify-between px-6 bg-black/50 backdrop-blur-sm border-t border-white/10 z-10">
        <div className="flex items-center gap-6 text-xs text-white/70">
          <button 
            onClick={handleAdvanceRound}
            disabled={!canSimulate}
            className="flex items-center gap-2 hover:text-white disabled:opacity-50 transition-colors"
          >
            <GamepadButton button="cross" platform="playstation" size="sm" />
            <span>Simular ate data</span>
          </button>
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 hover:text-white transition-colors"
          >
            <GamepadButton button="circle" platform="playstation" size="sm" />
            <span>Voltar</span>
          </button>
          {nextUserMatch && (
            <Link 
              href="/partida"
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <GamepadButton button="square" platform="playstation" size="sm" />
              <span>Ver partida</span>
            </Link>
          )}
          <Link 
            href="/competicoes"
            className="flex items-center gap-2 hover:text-white transition-colors"
          >
            <Trophy className="h-4 w-4 text-yellow-400" />
            <span>Competicoes</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <GamepadButton button="l1" platform="playstation" size="xs" />
            <GamepadButton button="r1" platform="playstation" size="xs" />
            <span className="ml-1">Mes</span>
          </div>
        </div>

        {/* FC HUB */}
        <div className="flex items-center gap-2 text-white/50 text-xs">
          <span>Central UF</span>
        </div>
      </footer>

      {/* Champion Screen */}
      {showChampionScreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative flex flex-col items-center gap-6 rounded-2xl bg-[#1a1a1a] p-10 max-w-md w-full mx-4 text-center border border-white/10">
            <Trophy className="h-16 w-16 text-yellow-500" />
            <h2 className="text-3xl font-black text-white tracking-tight">CAMPEAO!</h2>
            {championTeam && (
              <div className="flex flex-col items-center gap-3">
                <TeamCrest team={getTeamByShort(championTeam) ?? undefined} size="2xl" />
                <p className="text-xl font-bold text-white/80">
                  {getTeamByShort(championTeam)?.nome ?? championTeam}
                </p>
              </div>
            )}
            <p className="text-white/50 text-sm">Temporada {currentSeason} encerrada. Nova temporada iniciando!</p>
            <button
              onClick={() => setShowChampionScreen(false)}
              className="mt-2 px-8 py-3 rounded-xl bg-[#0088ff] text-white font-bold text-lg hover:bg-[#0066cc] transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isSimulating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
            <span className="text-white font-medium">Simulando...</span>
          </div>
        </div>
      )}
    </div>
  )
}
