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
  Home,
  Plane,
} from "lucide-react"
import Image from "next/image"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

const userTeam = getTeamByShort("BGT") || serieATeams[0]

// Generate fixtures for the month
const generateMonthFixtures = (month: number) => {
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
  
  const teams = serieATeams.filter(t => t.curto !== userTeam.curto)
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
  const [currentMonth, setCurrentMonth] = useState(0) // January 2026
  const [selectedDay, setSelectedDay] = useState<number | null>(22)

  const fixtures = generateMonthFixtures(currentMonth)
  const selectedFixture = selectedDay ? fixtures.find(f => f.day === selectedDay)?.fixture : null
  
  // Get first day of month (0 = Sunday, adjust for Monday start)
  const firstDayOfMonth = new Date(2026, currentMonth, 1).getDay()
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1

  const nextMonth = () => setCurrentMonth(m => (m + 1) % 12)
  const prevMonth = () => setCurrentMonth(m => (m - 1 + 12) % 12)

  // Find next fixtures (4 proximas)
  const nextFixtures = fixtures.filter(f => f.fixture).slice(0, 4)

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      {/* EA FC Style Layout */}
      <div className="flex h-[calc(100vh-48px-90px)]">
        {/* Left Panel - Match Info */}
        <aside className="w-80 flex-shrink-0 border-r border-white/5 bg-[#0d0d0d] p-5 flex flex-col">
          {/* Current Date */}
          <div className="mb-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
              {weekDays[new Date(2026, currentMonth, selectedDay || 1).getDay() === 0 ? 6 : new Date(2026, currentMonth, selectedDay || 1).getDay() - 1]}
            </div>
            <div className="text-xl font-semibold text-white">
              {months[currentMonth]} {selectedDay || 1}, 2026
            </div>
          </div>

          {/* Selected Match */}
          {selectedFixture ? (
            <div className="mb-4 pb-4 border-b border-white/10">
              <div className="text-[10px] uppercase tracking-wider text-[#1db954] font-medium mb-3">
                {selectedFixture.competition}
              </div>
              
              <div className="flex items-center gap-3 mb-3">
                <TeamCrest team={selectedFixture.isHome ? userTeam : selectedFixture.opponent} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {selectedFixture.isHome ? userTeam.nome : selectedFixture.opponent.nome}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <TeamCrest team={selectedFixture.isHome ? selectedFixture.opponent : userTeam} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {selectedFixture.isHome ? selectedFixture.opponent.nome : userTeam.nome}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-white/50">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{selectedFixture.time}</span>
                </div>
                <div className="flex items-center gap-2 text-white/50">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">{selectedFixture.isHome ? userTeam.estadio_nome : selectedFixture.opponent.estadio_nome}</span>
                </div>
              </div>

              <button className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#1db954] text-black text-xs font-semibold hover:bg-[#1ed760] transition-colors">
                <Play className="h-3.5 w-3.5 fill-current" />
                Simular Partida
              </button>
            </div>
          ) : (
            <div className="mb-4 pb-4 border-b border-white/10 flex flex-col items-center justify-center text-center py-4">
              <CalendarIcon className="h-8 w-8 text-white/20 mb-2" />
              <div className="text-white/40 text-xs">Nenhuma partida neste dia</div>
            </div>
          )}

          {/* Proximas Partidas */}
          <div className="flex-1">
            <div className="text-[10px] font-medium tracking-wider text-white/40 uppercase mb-3">
              Proximas Partidas
            </div>
            <div className="space-y-2">
              {nextFixtures.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDay(f.day)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg border transition-colors text-left",
                    f.day === selectedDay 
                      ? "border-[#1db954] bg-[#1db954]/10" 
                      : "border-white/5 bg-white/[0.02] hover:border-white/10"
                  )}
                >
                  <TeamCrest team={f.fixture!.opponent} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">
                      {f.fixture!.isHome ? "vs" : "@"} {f.fixture!.opponent.nome}
                    </div>
                    <div className="text-[10px] text-white/40">
                      {months[currentMonth]} {f.day} - {f.fixture!.time}
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-center justify-center h-6 w-6 rounded",
                    f.fixture!.isHome 
                      ? "bg-[#1db954]/20 text-[#1db954]" 
                      : "bg-white/10 text-white/60"
                  )}>
                    {f.fixture!.isHome ? <Home className="h-3 w-3" /> : <Plane className="h-3 w-3" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Transfer Window */}
          <div className="pt-4 border-t border-white/10 mt-4">
            <div className="text-[10px] text-white/40 font-medium tracking-wider mb-1">Janela de Transferencias</div>
            <div className="text-sm font-semibold text-white">Fechada</div>
            <div className="text-[10px] text-white/50">Abre em 71 dias</div>
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
                        <span className="truncate flex items-center gap-1">
                          {fixture.isHome ? <Home className="h-2.5 w-2.5" /> : <Plane className="h-2.5 w-2.5" />}
                          {fixture.isHome ? "Casa" : "Fora"}
                        </span>
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
              <div className="relative aspect-video bg-gradient-to-br from-[#0a5c2b] to-[#0d7a3a]">
                <div className="absolute inset-0 flex items-center justify-center p-4">
                {/* Logo Brasileirao Serie A */}
                <Image 
                  src="/logos/brasileirao.png"
                  alt="Brasileirao Serie A"
                  width={64}
                  height={64}
                  className="object-contain drop-shadow-lg"
                />
                </div>
              </div>
              <div className="p-3">
                <div className="text-xs text-[#1db954] mb-1">COMPETICAO</div>
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
