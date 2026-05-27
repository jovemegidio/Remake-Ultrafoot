"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Play,
  Calendar as CalendarIcon,
  Home,
  Plane,
  FastForward,
  SkipForward,
  Check,
  Loader2,
  Trophy,
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
  // Distribui 38 rodadas linearmente por 9 meses: Abril(3) ate Dezembro(11)
  const monthOffset = Math.floor((round - 1) * 9 / 38)
  return Math.min(11, 3 + monthOffset)
}

function roundToDay(round: number): number {
  // Distribui os jogos ao longo do mes
  const daysInRound = [1, 5, 8, 12, 15, 19, 22, 26, 29]
  return daysInRound[(round - 1) % 9] || 15
}

export default function CalendarioPage() {
  const router = useRouter()
  const { team: userTeam } = useUserTeam()
  useDiscordActivity("Vendo o calendário", userTeam.nome)
  const t = useTranslation()
  const monthsShort = t.calendar.months
  const weekDays = t.calendar.days
  const {
    seasonCalendar,
    currentWeek,
    currentSeason,
    advanceWeek,
    standings,
    userPosition,
    hydrated
  } = useGameManager()

  const [currentMonth, setCurrentMonth] = useState(3) // Abril (inicio da temporada)
  const [selectedRound, setSelectedRound] = useState<number | null>(currentWeek + 1)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationResults, setSimulationResults] = useState<{
    round: number;
    matches: { home: string; away: string; homeScore: number; awayScore: number }[];
  } | null>(null)
  const [showChampionScreen, setShowChampionScreen] = useState(false)
  const [championTeam, setChampionTeam] = useState<string | null>(null)

  // Filtra fixtures por mes
  const monthFixtures = useMemo(() => {
    return seasonCalendar.fixtures.filter(f => {
      const fixtureMonth = roundToMonth(f.round)
      return fixtureMonth === currentMonth
    })
  }, [seasonCalendar.fixtures, currentMonth])

  // Fixture selecionada (partida do usuario na rodada)
  const selectedFixture = useMemo(() => {
    if (!selectedRound) return null
    return seasonCalendar.fixtures.find(f => f.round === selectedRound && f.isUserMatch)
  }, [seasonCalendar.fixtures, selectedRound])

  // Todas as partidas da rodada selecionada
  const roundMatches = useMemo(() => {
    if (!selectedRound) return []
    return seasonCalendar.fixtures.filter(f => f.round === selectedRound)
  }, [seasonCalendar.fixtures, selectedRound])

  // Proximas partidas do usuario
  const nextUserFixtures = useMemo(() => {
    return seasonCalendar.fixtures
      .filter(f => f.isUserMatch && !f.played)
      .slice(0, 6)
  }, [seasonCalendar.fixtures])

  // Avanca uma rodada completa
  const handleAdvanceRound = useCallback(async () => {
    setIsSimulating(true)
    try {
      const result = await advanceWeek()
      if (result?.newSeason) {
        setChampionTeam(standings[0]?.teamShort ?? null)
        setShowChampionScreen(true)
        return
      }
      
      // Mostra resultados simulados
      const simulatedMatches = seasonCalendar.fixtures
        .filter(f => f.round === currentWeek + 1 && !f.isUserMatch && f.played)
        .map(f => ({
          home: f.homeTeam.curto,
          away: f.awayTeam.curto,
          homeScore: f.homeScore || 0,
          awayScore: f.awayScore || 0
        }))
      
      setSimulationResults({
        round: currentWeek + 1,
        matches: simulatedMatches
      })
      
      // Limpa apos 3 segundos
      setTimeout(() => setSimulationResults(null), 3000)
    } catch (error) {
      console.error("[v0] Error advancing week:", error)
    } finally {
      setIsSimulating(false)
    }
  }, [advanceWeek, currentWeek, seasonCalendar.fixtures])

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
        // Pequeno delay para mostrar progresso
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } catch (error) {
      console.error("[v0] Error simulating:", error)
    } finally {
      setIsSimulating(false)
    }
  }, [advanceWeek, currentWeek, seasonCalendar.nextUserMatch])

  const nextMonth = () => setCurrentMonth(m => (m + 1) % 12)
  const prevMonth = () => setCurrentMonth(m => (m - 1 + 12) % 12)

  // Primeira partida disponivel para simular
  const canSimulate = currentWeek < 38 && !isSimulating

  // Navegacao por controle no calendario
  useEffect(() => {
    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      switch (button) {
        case "B":
          router.back()
          break
        case "A":
          if (canSimulate) handleAdvanceRound()
          break
        case "X":
          if (canSimulate) handleSimulateToNextMatch()
          break
        case "LB":
          prevMonth()
          break
        case "RB":
          nextMonth()
          break
        case "DPAD_UP":
          setSelectedRound(prev => prev != null ? Math.max(1, prev - 1) : currentWeek + 1)
          break
        case "DPAD_DOWN":
          setSelectedRound(prev => prev != null ? Math.min(38, prev + 1) : currentWeek + 1)
          break
        case "Y":
          if (seasonCalendar.nextUserMatch) {
            setSelectedRound(seasonCalendar.nextUserMatch.round)
          }
          break
      }
    }

    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [router, canSimulate, handleAdvanceRound, handleSimulateToNextMatch, currentWeek, seasonCalendar.nextUserMatch])

  // Dias do calendario com partidas
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(2026, currentMonth + 1, 0).getDate()
    const firstDayOfMonth = new Date(2026, currentMonth, 1).getDay()
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
    
    const days: { day: number; fixture: Fixture | null; isOffset: boolean }[] = []
    
    // Offset days
    for (let i = 0; i < startOffset; i++) {
      days.push({ day: 0, fixture: null, isOffset: true })
    }
    
    // Dias do mes
    for (let d = 1; d <= daysInMonth; d++) {
      // Encontra fixture para este dia
      const fixture = monthFixtures.find(f => {
        const fixtureDay = roundToDay(f.round)
        return fixtureDay === d && f.isUserMatch
      })
      days.push({ day: d, fixture: fixture || null, isOffset: false })
    }
    
    return days
  }, [currentMonth, monthFixtures])

  // Janela de transferencias
  const transferWindow = useMemo(() => {
    const currentMonthNum = currentMonth + 1
    const isOpen = currentMonthNum >= 1 && currentMonthNum <= 2 || currentMonthNum >= 7 && currentMonthNum <= 8
    const nextOpenMonth = currentMonthNum < 7 ? 7 : 1
    const daysUntil = isOpen ? 0 : Math.abs((nextOpenMonth - currentMonthNum) * 30)
    return { isOpen, daysUntil }
  }, [currentMonth])

  if (!hydrated) {
    return (
      <div className="h-screen overflow-hidden pl-16 bg-[#050508] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden pl-16 bg-[#050508]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <div className="flex h-[calc(100vh-48px)]">
        {/* Left Panel - Match Info */}
        <aside className="w-80 flex-shrink-0 border-r border-white/[0.04] bg-[#0d0d0d] p-5 flex flex-col overflow-y-auto scrollbar-thin">
          {/* Current Date */}
          <div className="mb-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
              {t.common.season} {currentSeason}
            </div>
            <div className="text-xl font-semibold text-white">
              {t.common.week} {currentWeek}<span className="text-white/40">/38</span>
            </div>
            <div className="text-sm text-white/50 mt-1">
              {userPosition > 0 ? t.calendar.positionLabel(userPosition) : t.calendar.positionPending}
            </div>
          </div>

          {/* Simulation Controls */}
          <div className="mb-4 space-y-2">
            <button
              onClick={handleAdvanceRound}
              disabled={!canSimulate}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                canSimulate
                  ? "bg-[#00ffc8] text-black hover:bg-[#00c8ff]"
                  : "bg-white/10 text-white/40 cursor-not-allowed"
              )}
            >
              {isSimulating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FastForward className="h-4 w-4" />
              )}
              {t.calendar.advanceRound}
            </button>
            
            {seasonCalendar.nextUserMatch && currentWeek < seasonCalendar.nextUserMatch.round - 1 && (
              <button
                onClick={handleSimulateToNextMatch}
                disabled={isSimulating}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors",
                  "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                <SkipForward className="h-3.5 w-3.5" />
                {t.calendar.simulateToNext}
              </button>
            )}
          </div>

          {/* Simulation Results Toast */}
          {simulationResults && (
            <div className="mb-4 p-3 rounded-lg bg-[#00ffc8]/10 border border-[#00ffc8]/30 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[#00ffc8] mb-2">
                <Check className="h-3.5 w-3.5" />
                {t.calendar.roundSimulated(simulationResults.round)}
              </div>
              <div className="space-y-1 text-[10px] text-white/60">
                {simulationResults.matches.slice(0, 3).map((m, i) => (
                  <div key={i}>
                    {m.home} {m.homeScore} x {m.awayScore} {m.away}
                  </div>
                ))}
                {simulationResults.matches.length > 3 && (
                  <div className="text-white/40">{t.calendar.moreMatches(simulationResults.matches.length - 3)}</div>
                )}
              </div>
            </div>
          )}

          {/* Selected Match */}
          {selectedFixture ? (
            <div className="mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-wider text-[#00ffc8] font-medium">
                  {selectedFixture.competition}
                </div>
                {selectedFixture.played && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/60">
                    {t.calendar.finished}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3 mb-3">
                <TeamCrest team={selectedFixture.homeTeam} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {selectedFixture.homeTeam.nome}
                  </div>
                  {selectedFixture.played && (
                    <div className="text-xl font-bold text-white">{selectedFixture.homeScore}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <TeamCrest team={selectedFixture.awayTeam} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {selectedFixture.awayTeam.nome}
                  </div>
                  {selectedFixture.played && (
                    <div className="text-xl font-bold text-white">{selectedFixture.awayScore}</div>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-white/50">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{t.common.week} {selectedFixture.round}</span>
                </div>
                <div className="flex items-center gap-2 text-white/50">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {selectedFixture.homeTeam.curto === userTeam.curto 
                      ? userTeam.estadio_nome 
                      : selectedFixture.homeTeam.estadio_nome}
                  </span>
                </div>
              </div>

              {!selectedFixture.played && selectedFixture.round === currentWeek + 1 && (
                <Link
                  href="/partida"
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#00ffc8] text-black text-xs font-semibold hover:bg-[#00c8ff] transition-colors"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {t.match.playMatch}
                </Link>
              )}
            </div>
          ) : (
            <div className="mb-4 pb-4 border-b border-white/10 flex flex-col items-center justify-center text-center py-4">
              <CalendarIcon className="h-8 w-8 text-white/20 mb-2" />
              <div className="text-white/40 text-xs">{t.calendar.selectRound}</div>
            </div>
          )}

          {/* Round Matches */}
          {selectedRound && roundMatches.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-medium tracking-wider text-white/40 uppercase mb-3">
                {t.calendar.roundAllMatches(selectedRound)}
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                {roundMatches.map((f) => (
                  <div
                    key={f.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg text-xs",
                      f.isUserMatch 
                        ? "bg-[#00ffc8]/10 border border-[#00ffc8]/30" 
                        : "bg-white/[0.02] border border-white/[0.04]"
                    )}
                  >
                    <TeamCrest team={f.homeTeam} size="xs" />
                    <span className="flex-1 truncate text-white/80">{f.homeTeam.curto}</span>
                    {f.played ? (
                      <span className="font-bold text-white">
                        {f.homeScore} - {f.awayScore}
                      </span>
                    ) : (
                      <span className="text-white/40">vs</span>
                    )}
                    <span className="flex-1 truncate text-right text-white/80">{f.awayTeam.curto}</span>
                    <TeamCrest team={f.awayTeam} size="xs" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proximas Partidas */}
          <div className="flex-1">
            <div className="text-[10px] font-medium tracking-wider text-white/40 uppercase mb-3">
              {t.dashboard.nextMatches}
            </div>
            <div className="space-y-2">
              {nextUserFixtures.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedRound(f.round)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg border transition-colors text-left",
                    f.round === selectedRound 
                      ? "border-[#00ffc8] bg-[#00ffc8]/10" 
                      : "border-white/[0.04] bg-white/[0.02] hover:border-white/10"
                  )}
                >
                  <TeamCrest team={f.homeTeam.curto === userTeam.curto ? f.awayTeam : f.homeTeam} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">
                      {f.homeTeam.curto === userTeam.curto ? "vs" : "@"} {f.homeTeam.curto === userTeam.curto ? f.awayTeam.nome : f.homeTeam.nome}
                    </div>
                    <div className="text-[10px] text-white/40">
                      {t.common.week} {f.round}
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-center justify-center h-6 w-6 rounded",
                    f.homeTeam.curto === userTeam.curto
                      ? "bg-[#00ffc8]/20 text-[#00ffc8]" 
                      : "bg-white/10 text-white/60"
                  )}>
                    {f.homeTeam.curto === userTeam.curto ? <Home className="h-3 w-3" /> : <Plane className="h-3 w-3" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Transfer Window */}
          <div className="pt-4 border-t border-white/10 mt-4">
            <div className="text-[10px] text-white/40 font-medium tracking-wider mb-1">{t.calendar.transferWindow}</div>
            <div className="text-sm font-semibold text-white">
              {transferWindow.isOpen ? (
                <span className="text-[#00ffc8]">{t.calendar.windowOpen}</span>
              ) : (
                t.calendar.windowClosed
              )}
            </div>
            {!transferWindow.isOpen && (
              <div className="text-[10px] text-white/50">{t.calendar.windowOpensIn(transferWindow.daysUntil)}</div>
            )}
          </div>
        </aside>

        {/* Main Calendar */}
        <main className="flex-1 p-4 overflow-hidden flex flex-col">
          {/* Month Navigation */}
          <div className="flex items-center gap-2 mb-6">
            <button 
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-1">
              {monthsShort.map((m, i) => (
                <button
                  key={m}
                  onClick={() => setCurrentMonth(i)}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                    i === currentMonth 
                      ? "bg-white/10 text-white" 
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <button 
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 bg-[#0c0c10]/50 rounded-xl border border-white/[0.04] overflow-hidden flex flex-col">
            {/* Week days header */}
            <div className="grid grid-cols-7 border-b border-white/[0.04]">
              {weekDays.map((day) => (
                <div key={day} className="p-3 text-center text-xs font-medium text-white/40 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr">
              {calendarDays.map((item, i) => {
                if (item.isOffset) {
                  return (
                    <div key={`empty-${i}`} className="p-2 border-r border-b border-white/[0.04] bg-black/20" />
                  )
                }
                
                const isSelected = item.fixture?.round === selectedRound
                const isPlayed = item.fixture?.played
                
                return (
                  <button
                    key={item.day}
                    onClick={() => item.fixture && setSelectedRound(item.fixture.round)}
                    className={cn(
                      "p-2 border-r border-b border-white/[0.04] flex flex-col items-start transition-colors relative",
                      isSelected ? "bg-white/10" : item.fixture ? "hover:bg-white/5 cursor-pointer" : "",
                    )}
                  >
                    {/* Day number */}
                    <span className={cn(
                      "text-lg font-medium mb-1",
                      isSelected ? "text-white" : "text-white/60"
                    )}>
                      {item.day}
                    </span>

                    {/* Fixture indicator */}
                    {item.fixture && (
                      <div className={cn(
                        "absolute bottom-2 left-2 right-2 rounded px-2 py-1 text-[10px] font-medium flex items-center gap-1.5",
                        isPlayed
                          ? "bg-white/10 text-white/70 border border-white/10"
                          : item.fixture.homeTeam.curto === userTeam.curto
                            ? "bg-[#00ffc8]/20 text-[#00ffc8] border border-[#00ffc8]/30" 
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      )}>
                        <TeamCrest team={item.fixture.homeTeam.curto === userTeam.curto ? item.fixture.awayTeam : item.fixture.homeTeam} size="xs" />
                        <span className="truncate flex items-center gap-1">
                          {item.fixture.homeTeam.curto === userTeam.curto ? <Home className="h-2.5 w-2.5" /> : <Plane className="h-2.5 w-2.5" />}
                          {isPlayed ? `${item.fixture.homeScore}-${item.fixture.awayScore}` : item.fixture.homeTeam.curto === userTeam.curto ? t.common.home : t.common.away}
                        </span>
                        <span className="ml-auto text-[9px] opacity-60">R{item.fixture.round}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </main>

        {/* Right Panel - Standings Quick View */}
        <aside className="w-72 flex-shrink-0 border-l border-white/[0.04] bg-[#0d0d0d] p-4 hidden xl:flex flex-col overflow-hidden">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-4">{t.calendar.standings}</div>
          
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="space-y-1">
              {standings.slice(0, 10).map((entry, index) => {
                const team = getTeamByShort(entry.teamShort)
                if (!team) return null
                
                const isUser = entry.teamShort === userTeam.curto
                
                return (
                  <div
                    key={entry.teamShort}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg",
                      isUser && "bg-[#00ffc8]/10 border border-[#00ffc8]/30"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-bold w-5 text-center",
                      index < 4 ? "text-[#00ffc8]" : index >= 16 ? "text-red-500" : "text-white/50"
                    )}>
                      {index + 1}
                    </span>
                    <TeamCrest team={team} size="xs" />
                    <span className="flex-1 text-xs text-white truncate">{team.curto}</span>
                    <span className="text-xs font-bold text-white">{entry.points}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <Link 
            href="/competicoes"
            className="mt-4 text-center text-xs text-primary hover:text-primary/80 transition-colors"
          >
            {t.common.viewFullTable}
          </Link>
        </aside>
      </div>

      {/* Tela de campeao — aparece automaticamente ao fim da temporada */}
      {showChampionScreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative flex flex-col items-center gap-6 rounded-2xl bg-[#0c0c10] border border-yellow-400/30 p-10 max-w-md w-full mx-4 text-center shadow-2xl">
            <Trophy className="h-16 w-16 text-yellow-400" />
            <h2 className="text-3xl font-black text-yellow-400 tracking-tight">CAMPEÃO!</h2>
            {championTeam && (
              <div className="flex flex-col items-center gap-3">
                <TeamCrest team={getTeamByShort(championTeam) ?? undefined} size="2xl" />
                <p className="text-xl font-bold text-white">
                  {getTeamByShort(championTeam)?.nome ?? championTeam}
                </p>
              </div>
            )}
            <p className="text-white/50 text-sm">Temporada {currentSeason} encerrada. Nova temporada iniciando!</p>
            <button
              onClick={() => setShowChampionScreen(false)}
              className="mt-2 px-8 py-3 rounded-xl bg-yellow-400 text-black font-bold text-lg hover:bg-yellow-300 transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
