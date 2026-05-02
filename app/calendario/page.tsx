"use client"

import { useState } from "react"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Trophy,
  Clock,
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
  }
  
  return fixtures
}

const fixtures = generateFixtures()

const months = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

export default function CalendarioPage() {
  const [currentMonth, setCurrentMonth] = useState(0) // January 2026
  const [view, setView] = useState<"calendar" | "list">("list")

  const filteredFixtures = fixtures.filter(f => f.date.getMonth() === currentMonth)

  const nextMonth = () => setCurrentMonth(m => (m + 1) % 12)
  const prevMonth = () => setCurrentMonth(m => (m - 1 + 12) % 12)

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

      <MusicPlayer />
    </div>
  )
}

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
