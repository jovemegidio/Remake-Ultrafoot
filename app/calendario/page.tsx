"use client"

import { useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Trophy,
  Clock,
  Play,
  Calendar as CalendarIcon,
} from "lucide-react"
import Image from "next/image"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { serieATeams, type Team } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { cn } from "@/lib/utils"

// Generate fixtures for the month given the user's team.
const generateMonthFixtures = (month: number, userShort: string) => {
  const fixtures: {
    day: number
    fixture?: {
      opponent: Team
      isHome: boolean
      competition: string
      competitionShort: string
      time: string
    }
  }[] = []

  const teams = serieATeams.filter(t => t.curto !== userShort)
  const daysInMonth = new Date(2026, month + 1, 0).getDate()
  
  // Generate some fixtures for the month
  const fixtureIndices = [1, 5, 8, 15, 18, 22, 25, 29].filter(d => d <= daysInMonth)
  
  for (let i = 1; i <= daysInMonth; i++) {
    const fixtureIndex = fixtureIndices.indexOf(i)
    if (fixtureIndex !== -1) {
      const opponent = teams[fixtureIndex % teams.length]
      fixtures.push({
        day: i,
        fixture: {
          opponent,
          isHome: fixtureIndex % 2 === 0,
          competition: fixtureIndex % 3 === 0 ? "Copa do Brasil" : "Brasileirao",
          competitionShort: fixtureIndex % 3 === 0 ? "CDB" : "BRA",
          time: fixtureIndex % 2 === 0 ? "16:00" : "21:00"
        }
      })
    } else {
      fixtures.push({ day: i })
    }
  }
  
  return fixtures
}

const months = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

const monthsShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

export default function CalendarioPage() {
  const { team: userTeam } = useUserTeam()
  const [currentMonth, setCurrentMonth] = useState(0) // January 2026
  const [selectedDay, setSelectedDay] = useState<number | null>(22)

  const fixtures = generateMonthFixtures(currentMonth, userTeam.curto)
  const selectedFixture = selectedDay ? fixtures.find(f => f.day === selectedDay)?.fixture : null
  
  // Get first day of month (0 = Sunday, adjust for Monday start)
  const firstDayOfMonth = new Date(2026, currentMonth, 1).getDay()
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1

  const nextMonth = () => setCurrentMonth(m => (m + 1) % 12)
  const prevMonth = () => setCurrentMonth(m => (m - 1 + 12) % 12)

  // Find next fixture
  const nextFixtureData = fixtures.find(f => f.fixture)

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      {/* EA FC Style Layout */}
      <div className="flex h-[calc(100vh-48px-90px)]">
        {/* Left Panel - Match Info */}
        <aside className="w-72 flex-shrink-0 border-r border-white/5 bg-[#0d0d0d] p-5 flex flex-col">
          {/* Current Date */}
          <div className="mb-6">
            <div className="text-xs text-white/40 uppercase tracking-wider">
              {weekDays[new Date(2026, currentMonth, selectedDay || 1).getDay() === 0 ? 6 : new Date(2026, currentMonth, selectedDay || 1).getDay() - 1]}
            </div>
            <div className="text-2xl font-semibold text-white">
              {months[currentMonth]} {selectedDay || 1}
            </div>
            <div className="text-sm text-white/50">2026</div>
          </div>

          {/* Next Match */}
          {selectedFixture ? (
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wider text-primary mb-3">
                {selectedFixture.competition}
              </div>
              
              <div className="flex items-center gap-3 mb-4">
                <TeamCrest team={selectedFixture.isHome ? userTeam : selectedFixture.opponent} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">
                    {selectedFixture.isHome ? userTeam.nome : selectedFixture.opponent.nome}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <TeamCrest team={selectedFixture.isHome ? selectedFixture.opponent : userTeam} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">
                    {selectedFixture.isHome ? selectedFixture.opponent.nome : userTeam.nome}
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-white/60">
                  <Clock className="h-4 w-4" />
                  <span>{selectedFixture.time}</span>
                </div>
                <div className="flex items-center gap-2 text-white/60">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">{selectedFixture.isHome ? userTeam.estadio_nome : selectedFixture.opponent.estadio_nome}</span>
                </div>
              </div>

              <button className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#1db954] text-black text-sm font-semibold hover:bg-[#1ed760] transition-colors">
                <Play className="h-4 w-4 fill-current" />
                Simular Partida
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <CalendarIcon className="h-12 w-12 text-white/20 mb-3" />
              <div className="text-white/40 text-sm">Nenhuma partida neste dia</div>
            </div>
          )}

          {/* Transfer Window */}
          <div className="mt-auto pt-4 border-t border-white/10">
            <div className="text-xs text-white/40 mb-1">Janela de Transferencias</div>
            <div className="text-lg font-semibold text-white">Fechada</div>
            <div className="text-xs text-white/50">Abre em 71 dias</div>
          </div>

          {/* Bottom Actions */}
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-[10px] text-white/40">
            <span className="px-2 py-1 rounded bg-white/5">A</span>
            <span>Sim. ate Data</span>
            <span className="px-2 py-1 rounded bg-white/5 ml-auto">B</span>
            <span>Voltar</span>
          </div>
        </aside>

        {/* Main Calendar */}
        <main className="flex-1 p-6 overflow-auto">
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
          <div className="bg-[#141414]/50 rounded-xl border border-white/5 overflow-hidden">
            {/* Week days header */}
            <div className="grid grid-cols-7 border-b border-white/5">
              {weekDays.map((day) => (
                <div key={day} className="p-3 text-center text-xs font-medium text-white/40 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {/* Empty cells for offset */}
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square p-2 border-r border-b border-white/5 bg-black/20" />
              ))}
              
              {fixtures.map(({ day, fixture }) => {
                const isSelected = day === selectedDay
                const isToday = day === 22 && currentMonth === 0
                
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "aspect-square p-2 border-r border-b border-white/5 flex flex-col items-start transition-colors relative group",
                      isSelected ? "bg-white/10" : "hover:bg-white/5",
                      fixture && "cursor-pointer"
                    )}
                  >
                    {/* Day number */}
                    <span className={cn(
                      "text-lg font-medium mb-1",
                      isToday ? "text-primary" : isSelected ? "text-white" : "text-white/60"
                    )}>
                      {day}
                    </span>

                    {/* Fixture indicator */}
                    {fixture && (
                      <div className={cn(
                        "absolute bottom-2 left-2 right-2 rounded px-2 py-1 text-[10px] font-medium flex items-center gap-1.5",
                        fixture.isHome 
                          ? "bg-[#1db954]/20 text-[#1db954] border border-[#1db954]/30" 
                          : "bg-white/10 text-white/70 border border-white/10"
                      )}>
                        <TeamCrest team={fixture.opponent} size="xs" />
                        <span className="truncate">{fixture.isHome ? "Casa" : "Fora"}</span>
                        <span className="ml-auto text-[9px] opacity-60">{fixture.competitionShort}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </main>

        {/* Right Panel - News Feed (opcional, como na imagem de referencia) */}
        <aside className="w-80 flex-shrink-0 border-l border-white/5 bg-[#0d0d0d] p-5 hidden xl:flex flex-col">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-4">Destaques</div>
          
          {/* Featured news */}
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden bg-[#1a1a1a] border border-white/5">
              <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-accent/10">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Trophy className="h-12 w-12 text-primary/50" />
                </div>
              </div>
              <div className="p-3">
                <div className="text-xs text-primary mb-1">COMPETICAO</div>
                <div className="text-sm font-medium text-white line-clamp-2">
                  Brasileirao Serie A - Tabela atualizada
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-white/40">
                  <span>338.2K</span>
                  <span>13.2K</span>
                </div>
              </div>
            </div>

            {/* Team of the week */}
            <div className="rounded-lg bg-[#1a1a1a] border border-white/5 p-3">
              <div className="flex items-center gap-3 mb-3">
                <TeamCrest team={userTeam} size="sm" />
                <div>
                  <div className="text-xs text-white/40">{userTeam.curto}</div>
                  <div className="text-sm font-medium text-white">{userTeam.nome}</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="aspect-square rounded bg-white/5" />
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <MusicPlayer />
    </div>
  )
}
