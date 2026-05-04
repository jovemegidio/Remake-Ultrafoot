"use client"

import { useState } from "react"
import {
  Trophy,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { serieATeams, serieBTeams, type Team } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"

// Generate standings with empty stats anchored to the chosen team.
const generateStandings = (teams: Team[], userShort: string) => {
  return teams.map((team, index) => ({
    position: index + 1,
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
    form: ["", "", "", "", ""] as ("W" | "D" | "L" | "")[],
    isUser: team.curto === userShort,
  }))
}

const buildCompetitions = (userPosInA: number) => [
  {
    id: "brasileirao",
    name: "Brasileirao Serie A",
    type: "Liga",
    teams: 20,
    status: "Em andamento",
    userPosition: userPosInA,
  },
  { 
    id: "copa-do-brasil", 
    name: "Copa do Brasil", 
    type: "Copa", 
    teams: 92, 
    status: "Fase de grupos",
    userPosition: null
  },
  { 
    id: "paulistao", 
    name: "Campeonato Paulista", 
    type: "Estadual", 
    teams: 16, 
    status: "A iniciar",
    userPosition: null
  },
  { 
    id: "libertadores", 
    name: "Copa Libertadores", 
    type: "Continental", 
    teams: 47, 
    status: "Classificacao pendente",
    userPosition: null
  },
]

export default function CompeticoesPage() {
  const [activeTab, setActiveTab] = useState("brasileirao")
  const { team: userTeam } = useUserTeam()
  const serieAStandings = generateStandings(serieATeams, userTeam.curto)
  const serieBStandings = generateStandings(serieBTeams, userTeam.curto)
  const competitions = buildCompetitions(serieAStandings.findIndex(s => s.isUser) + 1 || 0)

  return (
    <div className="min-h-screen pl-[72px] pb-24">
      <GameSidebar />

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-display tracking-widest text-primary">ULTRAFOOT</span>
          <span className="text-border">/</span>
          <span className="text-foreground">Competicoes</span>
        </div>
        <div className="flex items-center gap-2">
          <TeamCrest team={userTeam} size="sm" />
          <span className="text-sm font-medium">{userTeam.nome}</span>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display-italic text-3xl tracking-tight">COMPETICOES</h1>
          <p className="text-sm text-muted-foreground">Temporada 2026 - Acompanhe suas competicoes</p>
        </div>

        {/* Competition Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {competitions.map((comp) => (
            <button
              key={comp.id}
              onClick={() => setActiveTab(comp.id)}
              className={`eafc-card p-4 text-left transition-all ${
                activeTab === comp.id ? "ring-2 ring-primary" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <Trophy className={`h-8 w-8 ${
                  comp.type === "Liga" ? "text-gold" :
                  comp.type === "Copa" ? "text-accent" :
                  comp.type === "Continental" ? "text-primary" :
                  "text-muted-foreground"
                }`} />
                {comp.userPosition && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    {comp.userPosition}
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-display tracking-wide text-sm">{comp.name}</h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{comp.type}</span>
                <span className="text-border">|</span>
                <span>{comp.teams} times</span>
              </div>
              <div className="mt-2 text-[10px] font-display tracking-wider text-primary">
                {comp.status.toUpperCase()}
              </div>
            </button>
          ))}
        </div>

        {/* Standings Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card border border-border mb-4">
            <TabsTrigger value="brasileirao" className="font-display text-xs tracking-wider">SERIE A</TabsTrigger>
            <TabsTrigger value="serie-b" className="font-display text-xs tracking-wider">SERIE B</TabsTrigger>
            <TabsTrigger value="copa-do-brasil" className="font-display text-xs tracking-wider">COPA DO BRASIL</TabsTrigger>
          </TabsList>

          <TabsContent value="brasileirao">
            <StandingsTable standings={serieAStandings} userTeam={userTeam} />
          </TabsContent>

          <TabsContent value="serie-b">
            <StandingsTable standings={serieBStandings} userTeam={userTeam} />
          </TabsContent>

          <TabsContent value="copa-do-brasil">
            <div className="eafc-card p-8 text-center">
              <Trophy className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-display text-lg">COPA DO BRASIL 2026</h3>
              <p className="text-sm text-muted-foreground mt-2">
                O sorteio dos grupos sera realizado em breve
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <MusicPlayer />
    </div>
  )
}

function StandingsTable({ 
  standings, 
  userTeam 
}: { 
  standings: {
    position: number
    team: Team
    played: number
    won: number
    drawn: number
    lost: number
    goalsFor: number
    goalsAgainst: number
    goalDiff: number
    points: number
    form: ("W" | "D" | "L" | "")[]
    isUser: boolean
  }[]
  userTeam: Team 
}) {
  return (
    <div className="eafc-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[40px_1fr_40px_40px_40px_40px_50px_50px_50px_60px_100px] gap-2 px-4 py-3 text-[10px] font-display tracking-widest text-muted-foreground border-b border-border bg-card/50">
        <span className="text-center">#</span>
        <span>CLUBE</span>
        <span className="text-center">J</span>
        <span className="text-center">V</span>
        <span className="text-center">E</span>
        <span className="text-center">D</span>
        <span className="text-center">GP</span>
        <span className="text-center">GC</span>
        <span className="text-center">SG</span>
        <span className="text-center">PTS</span>
        <span className="text-center">FORMA</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {standings.map((row) => (
          <div
            key={row.team.curto}
            className={`grid grid-cols-[40px_1fr_40px_40px_40px_40px_50px_50px_50px_60px_100px] gap-2 px-4 py-3 items-center transition-colors hover:bg-card/50 ${
              row.isUser ? "bg-primary/10 border-l-2 border-primary" : ""
            }`}
          >
            <span className={`text-center text-sm font-medium ${
              row.position <= 4 ? "text-accent" :
              row.position <= 6 ? "text-primary" :
              row.position >= 17 ? "text-destructive" :
              "text-muted-foreground"
            }`}>
              {row.position}
            </span>
            
            <div className="flex items-center gap-2 min-w-0">
              <TeamCrest team={row.team} size="sm" />
              <span className={`truncate text-sm ${row.isUser ? "font-semibold" : ""}`}>
                {row.team.nome}
              </span>
              {row.isUser && <Star className="h-3 w-3 text-gold shrink-0" />}
            </div>

            <span className="text-center text-sm tabular-nums">{row.played}</span>
            <span className="text-center text-sm tabular-nums text-accent">{row.won}</span>
            <span className="text-center text-sm tabular-nums text-muted-foreground">{row.drawn}</span>
            <span className="text-center text-sm tabular-nums text-destructive">{row.lost}</span>
            <span className="text-center text-sm tabular-nums">{row.goalsFor}</span>
            <span className="text-center text-sm tabular-nums">{row.goalsAgainst}</span>
            <span className={`text-center text-sm tabular-nums ${
              row.goalDiff > 0 ? "text-accent" :
              row.goalDiff < 0 ? "text-destructive" :
              "text-muted-foreground"
            }`}>
              {row.goalDiff > 0 ? "+" : ""}{row.goalDiff}
            </span>
            <span className="text-center text-sm tabular-nums font-bold">{row.points}</span>

            <div className="flex items-center justify-center gap-1">
              {row.form.map((result, i) => (
                <span
                  key={i}
                  className={`h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center ${
                    result === "W" ? "bg-accent/20 text-accent" :
                    result === "D" ? "bg-muted text-muted-foreground" :
                    result === "L" ? "bg-destructive/20 text-destructive" :
                    "bg-muted/50 text-muted-foreground/50"
                  }`}
                >
                  {result || "-"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3 text-[10px] text-muted-foreground border-t border-border bg-card/30">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <span>Libertadores</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span>Sul-Americana</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          <span>Rebaixamento</span>
        </div>
      </div>
    </div>
  )
}
