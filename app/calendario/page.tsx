"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trophy,
  Star,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { GameSidebar } from "@/components/game-sidebar"
import { ActionHint, GamepadButton, ShoulderHints } from "@/components/gamepad-icons"
import { TeamCrest } from "@/components/team-crest"
import { getTeamByShort } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { useGameManager, type Fixture } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"
import { useDiscordActivity } from "@/hooks/use-discord-rpc"

// Mapeia rodadas para meses aproximados (temporada de Abril a Dezembro)
function roundToMonth(round: number): number {
  const monthOffset = Math.floor((round - 1) * 9 / 38)
  return Math.min(11, 3 + monthOffset)
}

function roundToDay(round: number): number {
  const daysInRound = [1, 5, 8, 12, 15, 19, 22, 26, 29]
  return daysInRound[(round - 1) % 9] || 15
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
    hydrated
  } = useGameManager()

  const [currentMonth, setCurrentMonth] = useState(3) // Abril
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [showChampionScreen, setShowChampionScreen] = useState(false)
  const [championTeam, setChampionTeam] = useState<string | null>(null)

  // Filtra fixtures por mes
  const monthFixtures = useMemo(() => {
    return seasonCalendar.fixtures.filter(f => {
      const fixtureMonth = roundToMonth(f.round)
      return fixtureMonth === currentMonth
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

  const canSimulate = currentWeek < 38 && !isSimulating

  useEffect(() => {
    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      switch (button) {
        case "B":
          router.back()
          break
        case "LB":
          setCurrentMonth(m => (m - 1 + 12) % 12)
          break
        case "RB":
          setCurrentMonth(m => (m + 1) % 12)
          break
      }
    }
    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [router])

  useEffect(() => {
    if (nextUserMatch) {
      const day = roundToDay(nextUserMatch.round)
      setSelectedDay(day)
    }
  }, [nextUserMatch])

  if (!hydrated) {
    return (
      <div className="h-screen overflow-hidden md:pl-16 pl-0 pb-20 md:pb-0 bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  // Data atual formatada
  const matchDate = nextUserMatch ? new Date(2026, roundToMonth(nextUserMatch.round), roundToDay(nextUserMatch.round)) : new Date(2026, 3, 15)
  const dayOfWeek = WEEKDAY_NAMES[matchDate.getDay()]
  const dayNum = matchDate.getDate()
  const monthName = MONTH_NAMES_SHORT[matchDate.getMonth()].toUpperCase()

  return (
  <div className="h-screen overflow-hidden md:pl-16 pl-0 pb-20 md:pb-0 relative">
  <GameSidebar />
  
  {/* Background Image - Futuristic Grid */}
  <div className="absolute inset-0 md:ml-16">
  <Image
  src="/images/calendario-bg.png"
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
          <span className="text-white/60 text-sm font-medium">Office</span>
          <span className="text-white text-sm font-bold">Calendar</span>
          {/* Month Tabs */}
          <div className="flex items-center gap-1 ml-4">
            <button 
              onClick={() => setCurrentMonth(m => (m - 1 + 12) % 12)}
              className="p-1 text-white/40 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {MONTH_NAMES.slice(3, 12).map((month, i) => {
              const monthIndex = i + 3
              return (
                <button
                  key={month}
                  onClick={() => setCurrentMonth(monthIndex)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium transition-all rounded",
                    monthIndex === currentMonth 
                      ? "bg-white/20 text-white" 
                      : "text-white/50 hover:text-white/80"
                  )}
                >
                  {month}
                </button>
              )
            })}
            <button 
              onClick={() => setCurrentMonth(m => (m + 1) % 12)}
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
                      "relative p-2 border-r border-b border-white/5 flex flex-col transition-all",
                      item.isCurrentMonth ? "hover:bg-white/5" : "opacity-30",
                      isSelected && "bg-white/10",
                    )}
                  >
                    {/* Day number */}
                    <span className={cn(
                      "text-2xl font-bold",
                      !item.isCurrentMonth && "text-white/20",
                      item.isCurrentMonth && !hasMatch && "text-white/50",
                      hasMatch && "text-white"
                    )}>
                      {item.day}
                    </span>

                    {/* Match Card (EA FC Style) */}
                    {hasMatch && opponent && (
                      <div className={cn(
                        "absolute bottom-2 left-2 right-2 rounded-lg p-2 flex flex-col items-center gap-1",
                        isHome 
                          ? "bg-[#0088ff]/30 border border-[#0088ff]/50" 
                          : "bg-[#00cc66]/30 border border-[#00cc66]/50"
                      )}>
                        <TeamCrest team={opponent} size="sm" />
                        <div className={cn(
                          "text-[10px] font-bold uppercase",
                          isHome ? "text-[#66bbff]" : "text-[#66ff99]"
                        )}>
                          {isHome ? "Home" : "Away"}
                        </div>
                        <div className="text-[9px] font-medium text-white/60 uppercase">
                          {item.fixture?.competition === "Brasileirao Serie A" ? "LEAGUE" : "CUP"}
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
            <span>Sim To Date</span>
          </button>
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 hover:text-white transition-colors"
          >
            <GamepadButton button="circle" platform="playstation" size="sm" />
            <span>Back</span>
          </button>
          {nextUserMatch && (
            <Link 
              href="/partida"
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <GamepadButton button="square" platform="playstation" size="sm" />
              <span>View Fixture</span>
            </Link>
          )}
          <div className="flex items-center gap-1.5">
            <GamepadButton button="l1" platform="playstation" size="xs" />
            <GamepadButton button="r1" platform="playstation" size="xs" />
            <span className="ml-1">Month</span>
          </div>
        </div>

        {/* FC HUB */}
        <div className="flex items-center gap-2 text-white/50 text-xs">
          <span>FC HUB</span>
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
