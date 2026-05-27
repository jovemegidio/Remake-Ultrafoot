"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Plane,
  FastForward,
  SkipForward,
  Loader2,
  Trophy,
  Clock,
} from "lucide-react"
import Link from "next/link"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { getTeamByShort } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { useGameManager, type Fixture } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
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

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

export default function CalendarioPage() {
  const router = useRouter()
  const { team: userTeam } = useUserTeam()
  useDiscordActivity("Vendo o calendario", userTeam.nome)
  const t = useTranslation()
  const {
    seasonCalendar,
    currentWeek,
    currentSeason,
    advanceWeek,
    standings,
    hydrated
  } = useGameManager()

  const [currentMonth, setCurrentMonth] = useState(3) // Abril (inicio da temporada)
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

  // Fixture selecionada (do dia clicado)
  const selectedFixture = useMemo(() => {
    if (!selectedDay) return nextUserMatch
    return monthFixtures.find(f => {
      const fixtureDay = roundToDay(f.round)
      return fixtureDay === selectedDay && f.isUserMatch
    }) || nextUserMatch
  }, [selectedDay, monthFixtures, nextUserMatch])

  // Dias do calendario com partidas
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(2026, currentMonth + 1, 0).getDate()
    const firstDayOfMonth = new Date(2026, currentMonth, 1).getDay()
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
    
    // Dias do mes anterior para preencher
    const prevMonthDays = new Date(2026, currentMonth, 0).getDate()
    
    const days: { day: number; isCurrentMonth: boolean; fixture: Fixture | null }[] = []
    
    // Dias do mes anterior
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isCurrentMonth: false, fixture: null })
    }
    
    // Dias do mes atual
    for (let d = 1; d <= daysInMonth; d++) {
      const fixture = monthFixtures.find(f => {
        const fixtureDay = roundToDay(f.round)
        return fixtureDay === d && f.isUserMatch
      })
      days.push({ day: d, isCurrentMonth: true, fixture: fixture || null })
    }
    
    // Dias do proximo mes para completar a grade
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

  // Avanca uma rodada completa
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

  // Simula ate a proxima partida do usuario
  const handleSimulateToNextMatch = useCallback(async () => {
    setIsSimulating(true)
    try {
      const nextMatch = seasonCalendar.nextUserMatch
      if (!nextMatch) return
      
      let currentRound = currentWeek
      while (currentRound < nextMatch.round - 1) {
        const r = await advanceWeek()
        if (r?.newSeason) {
          setChampionTeam(standings[0]?.teamShort ?? null)
          setShowChampionScreen(true)
          return
        }
        currentRound++
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } finally {
      setIsSimulating(false)
    }
  }, [advanceWeek, currentWeek, seasonCalendar.nextUserMatch, standings])

  const canSimulate = currentWeek < 38 && !isSimulating

  // Navegacao por controle
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

  // Define o dia selecionado inicial
  useEffect(() => {
    if (nextUserMatch) {
      const day = roundToDay(nextUserMatch.round)
      setSelectedDay(day)
    }
  }, [nextUserMatch])

  if (!hydrated) {
    return (
      <div className="h-screen overflow-hidden md:pl-16 pl-0 pb-20 md:pb-0 bg-[#f5f5f0] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0ea5e9]" />
      </div>
    )
  }

  // Calcula dia da semana para a data atual
  const currentDayOfWeek = nextUserMatch ? 
    new Date(2026, roundToMonth(nextUserMatch.round), roundToDay(nextUserMatch.round)).toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase() :
    "QUARTA-FEIRA"
  
  const currentDateStr = nextUserMatch ?
    `${roundToDay(nextUserMatch.round)} ${MONTH_NAMES[roundToMonth(nextUserMatch.round)].toUpperCase().slice(0, 3)} ${2026}` :
    `15 ABR 2026`

  return (
    <div className="h-screen overflow-hidden md:pl-16 pl-0 pb-20 md:pb-0 bg-gradient-to-br from-[#f0f0eb] via-[#e8e8e3] to-[#ddddd8]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 ml-16 pointer-events-none opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative flex h-[calc(100vh-48px)]">
        {/* Left Panel - Match Preview (EA FC Style) */}
        <aside className="w-80 flex-shrink-0 p-6 flex flex-col">
          {/* Current Date */}
          <div className="mb-6">
            <div className="text-xs font-bold text-gray-500 tracking-wider">
              {currentDayOfWeek}
            </div>
            <div className="text-2xl font-black text-gray-800 tracking-tight">
              {currentDateStr}
            </div>
          </div>

          {/* Competition Badge */}
          {selectedFixture && (
            <div className="mb-6">
              <div className="text-sm font-bold text-[#0ea5e9]">
                {selectedFixture.competition}
              </div>
            </div>
          )}

          {/* Opponent Team Crest (Large) */}
          {selectedFixture && (
            <div className="flex flex-col items-start mb-6">
              <div className="relative mb-4">
                <div 
                  className="absolute inset-0 blur-3xl opacity-30"
                  style={{ 
                    backgroundColor: selectedFixture.homeTeam.curto === userTeam.curto 
                      ? selectedFixture.awayTeam.cor1 
                      : selectedFixture.homeTeam.cor1 
                  }}
                />
                <TeamCrest 
                  team={selectedFixture.homeTeam.curto === userTeam.curto ? selectedFixture.awayTeam : selectedFixture.homeTeam} 
                  size="2xl" 
                />
              </div>
              <div className="text-2xl font-black text-gray-800">
                {selectedFixture.homeTeam.curto === userTeam.curto 
                  ? selectedFixture.awayTeam.nome 
                  : selectedFixture.homeTeam.nome}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Transfer Window Info */}
          <div className="mt-auto pt-6 border-t border-gray-300">
            <div className="text-xs font-medium text-gray-500 mb-1">
              {transferWindow.isOpen ? "Janela de Transferencias" : "Janela de Transferencias Fechada"}
            </div>
            {!transferWindow.isOpen && (
              <>
                <div className="text-4xl font-black text-gray-800">
                  {transferWindow.daysUntil} Dias
                </div>
                <div className="text-xs text-gray-500">
                  Ate Abrir
                </div>
              </>
            )}
            {transferWindow.isOpen && (
              <div className="text-lg font-bold text-[#00c853]">
                Aberta
              </div>
            )}
          </div>
        </aside>

        {/* Main Calendar Area */}
        <main className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Month Tabs (EA FC Style) */}
          <div className="flex items-center gap-1 mb-4 px-2">
            {MONTH_NAMES.slice(3, 12).map((month, i) => {
              const monthIndex = i + 3
              return (
                <button
                  key={month}
                  onClick={() => setCurrentMonth(monthIndex)}
                  className={cn(
                    "px-4 py-2 rounded-t-lg text-sm font-semibold transition-all",
                    monthIndex === currentMonth 
                      ? "bg-white text-gray-800 shadow-sm" 
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {month}
                </button>
              )
            })}
          </div>

          {/* Calendar Grid (EA FC Style) */}
          <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden flex flex-col">
            {/* Week days header */}
            <div className="grid grid-cols-7 bg-gray-100/50">
              {WEEK_DAYS.map((day) => (
                <div key={day} className="p-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr">
              {calendarDays.map((item, i) => {
                const isSelected = item.isCurrentMonth && item.day === selectedDay
                const hasMatch = item.fixture !== null
                const isHome = item.fixture?.homeTeam.curto === userTeam.curto
                const isPlayed = item.fixture?.played
                
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (item.isCurrentMonth) {
                        setSelectedDay(item.day)
                      }
                    }}
                    disabled={!item.isCurrentMonth}
                    className={cn(
                      "relative p-2 border-r border-b border-gray-100 flex flex-col transition-all min-h-[80px]",
                      item.isCurrentMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50/50",
                      isSelected && "ring-2 ring-[#0ea5e9] ring-inset bg-[#0ea5e9]/5",
                    )}
                  >
                    {/* Day number */}
                    <span className={cn(
                      "text-lg font-bold mb-1",
                      !item.isCurrentMonth && "text-gray-300",
                      item.isCurrentMonth && !hasMatch && "text-gray-600",
                      hasMatch && "text-gray-800"
                    )}>
                      {item.day}
                    </span>

                    {/* Match indicator */}
                    {hasMatch && item.fixture && (
                      <div className={cn(
                        "absolute bottom-1 left-1 right-1 rounded-lg p-1.5 flex flex-col items-center gap-1",
                        isPlayed 
                          ? "bg-gray-200" 
                          : isHome 
                            ? "bg-[#0ea5e9]/20" 
                            : "bg-[#00c853]/20"
                      )}>
                        <TeamCrest 
                          team={isHome ? item.fixture.awayTeam : item.fixture.homeTeam} 
                          size="sm" 
                        />
                        <div className={cn(
                          "text-[9px] font-bold uppercase tracking-wide",
                          isPlayed ? "text-gray-500" : isHome ? "text-[#0ea5e9]" : "text-[#00c853]"
                        )}>
                          {isHome ? "Casa" : "Fora"}
                        </div>
                        <div className="text-[8px] font-medium text-gray-500 uppercase">
                          {item.fixture.competition === "Brasileirao Serie A" ? "LEAGUE" : "CUP"}
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bottom Action Bar (EA FC Style) */}
          <div className="flex items-center justify-between mt-4 px-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl">
            <div className="flex items-center gap-6 text-xs text-gray-500">
              <button 
                onClick={handleAdvanceRound}
                disabled={!canSimulate}
                className="flex items-center gap-2 hover:text-gray-700 disabled:opacity-50"
              >
                <span className="w-6 h-6 rounded bg-[#0ea5e9] flex items-center justify-center text-white font-bold text-[10px]">A</span>
                <span>Sim To Date</span>
              </button>
              <button 
                onClick={() => router.back()}
                className="flex items-center gap-2 hover:text-gray-700"
              >
                <span className="w-6 h-6 rounded bg-gray-300 flex items-center justify-center text-gray-700 font-bold text-[10px]">B</span>
                <span>Voltar</span>
              </button>
              {nextUserMatch && (
                <Link 
                  href="/partida"
                  className="flex items-center gap-2 hover:text-gray-700"
                >
                  <span className="w-6 h-6 rounded bg-yellow-400 flex items-center justify-center text-gray-800 font-bold text-[10px]">X</span>
                  <span>Ver Partida</span>
                </Link>
              )}
              <button 
                onClick={() => setCurrentMonth(m => (m - 1 + 12) % 12)}
                className="flex items-center gap-2 hover:text-gray-700"
              >
                <span className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-[10px]">LB</span>
                <ChevronLeft className="h-3 w-3" />
              </button>
              <button 
                onClick={() => setCurrentMonth(m => (m + 1) % 12)}
                className="flex items-center gap-2 hover:text-gray-700"
              >
                <span className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-[10px]">RB</span>
                <span>Mes</span>
              </button>
            </div>

            {/* User Team Badge */}
            <div className="flex items-center gap-3">
              <TeamCrest team={userTeam} size="sm" />
              <span className="text-sm font-bold text-gray-700">{userTeam.nome}</span>
            </div>
          </div>
        </main>
      </div>

      {/* Champion Screen */}
      {showChampionScreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative flex flex-col items-center gap-6 rounded-2xl bg-white p-10 max-w-md w-full mx-4 text-center shadow-2xl">
            <Trophy className="h-16 w-16 text-yellow-500" />
            <h2 className="text-3xl font-black text-gray-800 tracking-tight">CAMPEAO!</h2>
            {championTeam && (
              <div className="flex flex-col items-center gap-3">
                <TeamCrest team={getTeamByShort(championTeam) ?? undefined} size="2xl" />
                <p className="text-xl font-bold text-gray-700">
                  {getTeamByShort(championTeam)?.nome ?? championTeam}
                </p>
              </div>
            )}
            <p className="text-gray-500 text-sm">Temporada {currentSeason} encerrada. Nova temporada iniciando!</p>
            <button
              onClick={() => setShowChampionScreen(false)}
              className="mt-2 px-8 py-3 rounded-xl bg-[#0ea5e9] text-white font-bold text-lg hover:bg-[#0284c7] transition-colors"
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
