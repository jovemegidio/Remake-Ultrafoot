"use client"

import { useState } from "react"
import {
<<<<<<< HEAD
  Calendar as CalendarIcon,
=======
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
  ChevronLeft,
  ChevronRight,
  MapPin,
  Trophy,
  Clock,
<<<<<<< HEAD
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"

const userTeam = getTeamByShort("RBB") || serieATeams[0]

// Generate season fixtures
const generateFixtures = () => {
  const fixtures = []
  const teams = serieATeams.filter(t => t.curto !== userTeam.curto)
  
  for (let i = 0; i < 38; i++) {
    const opponent = teams[i % teams.length]
    const isHome = i % 2 === 0
    const date = new Date(2026, 0, 15 + i * 7)
    
    fixtures.push({
      id: i + 1,
      round: i + 1,
      home: isHome ? userTeam : opponent,
      away: isHome ? opponent : userTeam,
      date,
      time: i % 3 === 0 ? "16:00" : i % 3 === 1 ? "18:30" : "21:00",
      competition: "Brasileirao Serie A",
      venue: isHome ? userTeam.estadio_nome : opponent.estadio_nome,
      status: i < 0 ? "played" : i === 0 ? "next" : "scheduled",
      homeScore: i < 0 ? Math.floor(Math.random() * 4) : undefined,
      awayScore: i < 0 ? Math.floor(Math.random() * 4) : undefined,
    })
=======
  Play,
  Calendar as CalendarIcon,
} from "lucide-react"
import Image from "next/image"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

const userTeam = getTeamByShort("RBB") || serieATeams[0]

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
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
  }
  
  return fixtures
}

<<<<<<< HEAD
const fixtures = generateFixtures()

=======
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
const months = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

<<<<<<< HEAD
const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

export default function CalendarioPage() {
  const [currentMonth, setCurrentMonth] = useState(0) // January 2026
  const [view, setView] = useState<"calendar" | "list">("list")

  const filteredFixtures = fixtures.filter(f => f.date.getMonth() === currentMonth)
=======
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
>>>>>>> bfedf7d (Atualizar estrutura do projeto)

  const nextMonth = () => setCurrentMonth(m => (m + 1) % 12)
  const prevMonth = () => setCurrentMonth(m => (m - 1 + 12) % 12)

<<<<<<< HEAD
  return (
    <div className="min-h-screen pl-16 pb-20">
      <GameSidebar />

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-display tracking-widest text-primary">ULTRAFOOT</span>
          <span className="text-border">/</span>
          <span className="text-foreground">Calendario</span>
        </div>
        <div className="flex items-center gap-2">
          <TeamCrest team={userTeam} size="sm" />
          <span className="text-sm font-medium">{userTeam.nome}</span>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display-italic text-3xl tracking-tight">CALENDARIO</h1>
            <p className="text-sm text-muted-foreground">Temporada 2026 - {fixtures.length} partidas programadas</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={view === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("list")}
              className="font-display text-xs tracking-wider"
            >
              LISTA
            </Button>
            <Button
              variant={view === "calendar" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("calendar")}
              className="font-display text-xs tracking-wider"
            >
              CALENDARIO
            </Button>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <span className="font-display text-xl tracking-wider">
              {months[currentMonth]} 2026
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Fixtures List */}
        <div className="space-y-3">
          {filteredFixtures.length === 0 ? (
            <div className="eafc-card p-8 text-center">
              <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nenhuma partida programada para este mes</p>
            </div>
          ) : (
            filteredFixtures.map((fixture) => (
              <FixtureRow key={fixture.id} fixture={fixture} userTeam={userTeam} />
            ))
          )}
        </div>

        {/* Season Overview */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest mb-2">
              <Trophy className="h-4 w-4 text-gold" />
              COMPETICOES
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Brasileirao Serie A</span>
                <span className="text-xs text-muted-foreground">38 jogos</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Copa do Brasil</span>
                <span className="text-xs text-muted-foreground">A definir</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Paulistao</span>
                <span className="text-xs text-muted-foreground">A definir</span>
              </div>
            </div>
          </div>

          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest mb-2">
              <MapPin className="h-4 w-4 text-primary" />
              ESTADIO
            </div>
            <div className="space-y-2">
              <div className="font-medium">{userTeam.estadio_nome}</div>
              <div className="text-sm text-muted-foreground">
                Capacidade: {userTeam.estadio_cap.toLocaleString()} lugares
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredFixtures.filter(f => f.home.curto === userTeam.curto).length} jogos em casa neste mes
              </div>
            </div>
          </div>

          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest mb-2">
              <Clock className="h-4 w-4 text-accent" />
              PROXIMA PARTIDA
            </div>
            {fixtures.find(f => f.status === "next") ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TeamCrest team={fixtures[0].home} size="sm" />
                  <span className="text-sm">vs</span>
                  <TeamCrest team={fixtures[0].away} size="sm" />
                </div>
                <div className="text-sm text-muted-foreground">
                  {fixtures[0].date.toLocaleDateString('pt-BR')} - {fixtures[0].time}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma partida proxima</p>
            )}
          </div>
        </section>
      </main>
=======
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
>>>>>>> bfedf7d (Atualizar estrutura do projeto)

      <MusicPlayer />
    </div>
  )
}
<<<<<<< HEAD

function FixtureRow({ 
  fixture, 
  userTeam 
}: { 
  fixture: {
    id: number
    round: number
    home: Team
    away: Team
    date: Date
    time: string
    competition: string
    venue: string
    status: string
    homeScore?: number
    awayScore?: number
  }
  userTeam: Team 
}) {
  const isHome = fixture.home.curto === userTeam.curto
  const isNext = fixture.status === "next"

  return (
    <div className={`eafc-card p-4 transition-all ${isNext ? "ring-2 ring-accent" : ""}`}>
      <div className="flex items-center justify-between gap-4">
        {/* Date & Round */}
        <div className="w-24 shrink-0">
          <div className="text-xs font-display tracking-widest text-muted-foreground">
            RODADA {fixture.round}
          </div>
          <div className="text-sm mt-1">
            {fixture.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </div>
          <div className="text-xs text-muted-foreground">{fixture.time}</div>
        </div>

        {/* Teams */}
        <div className="flex-1 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className={`text-sm ${fixture.home.curto === userTeam.curto ? "font-semibold" : ""}`}>
              {fixture.home.nome}
            </span>
            <TeamCrest team={fixture.home} size="md" />
          </div>

          <div className="w-16 text-center">
            {fixture.status === "played" ? (
              <span className="font-display-italic text-xl">
                {fixture.homeScore} - {fixture.awayScore}
              </span>
            ) : (
              <span className="font-display text-lg text-muted-foreground">VS</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-1">
            <TeamCrest team={fixture.away} size="md" />
            <span className={`text-sm ${fixture.away.curto === userTeam.curto ? "font-semibold" : ""}`}>
              {fixture.away.nome}
            </span>
          </div>
        </div>

        {/* Status/Venue */}
        <div className="w-32 shrink-0 text-right">
          <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-display tracking-wider ${
            isHome 
              ? "bg-accent/15 text-accent border border-accent/30" 
              : "bg-muted text-muted-foreground border border-border"
          }`}>
            {isHome ? "CASA" : "FORA"}
          </span>
          {isNext && (
            <div className="mt-1 text-[10px] text-accent font-display tracking-wider">
              PROXIMA PARTIDA
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
=======
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
