"use client"

import { useState } from "react"
import {
  Trophy,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Calendar,
  Users,
  Target,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getTeamByShort, serieATeams, serieBTeams, type Team } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

const userTeam = getTeamByShort("BGT") || serieATeams[0]

// Generate standings with random stats
const generateStandings = (teams: Team[]) => {
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
    isUser: team.curto === userTeam.curto,
  }))
}

const serieAStandings = generateStandings(serieATeams)
const serieBStandings = generateStandings(serieBTeams)

const competitions = [
  { 
    id: "brasileirao", 
    name: "Brasileirao Serie A", 
    type: "Liga", 
    teams: 20, 
    status: "Em andamento",
    userPosition: serieAStandings.findIndex(s => s.isUser) + 1,
    icon: Trophy,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30"
  },
  { 
    id: "copa-do-brasil", 
    name: "Copa do Brasil", 
    type: "Copa", 
    teams: 92, 
    status: "Fase de grupos",
    userPosition: null,
    icon: Trophy,
    color: "text-[#1db954]",
    bgColor: "bg-[#1db954]/10",
    borderColor: "border-[#1db954]/30"
  },
  { 
    id: "paulistao", 
    name: "Campeonato Paulista", 
    type: "Estadual", 
    teams: 16, 
    status: "A iniciar",
    userPosition: null,
    icon: Trophy,
    color: "text-white/50",
    bgColor: "bg-white/5",
    borderColor: "border-white/10"
  },
  { 
    id: "libertadores", 
    name: "Copa Libertadores", 
    type: "Continental", 
    teams: 47, 
    status: "Classificacao pendente",
    userPosition: null,
    icon: Trophy,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/30"
  },
]

export default function CompeticoesPage() {
  const [activeTab, setActiveTab] = useState("brasileirao")

  return (
    <div className="h-screen pl-[72px] bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Competicoes</h1>
            <p className="text-sm text-white/50 mt-1">Temporada 2026 - Acompanhe suas competicoes</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141414] border border-white/5">
              <Calendar className="h-4 w-4 text-[#1db954]" />
              <span className="text-sm text-white/70">Semana 0/48</span>
            </div>
          </div>
        </div>

        {/* Competition Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {competitions.map((comp) => {
            const Icon = comp.icon
            const isActive = activeTab === comp.id
            
            return (
              <button
                key={comp.id}
                onClick={() => setActiveTab(comp.id)}
                className={cn(
                  "rounded-xl bg-[#141414] border p-5 text-left transition-all",
                  isActive 
                    ? "border-[#1db954] ring-1 ring-[#1db954]" 
                    : "border-white/5 hover:border-white/10"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    comp.bgColor
                  )}>
                    <Icon className={cn("h-5 w-5", comp.color)} />
                  </div>
                  {comp.userPosition && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1db954]/20 text-sm font-bold text-[#1db954]">
                      {comp.userPosition}°
                    </span>
                  )}
                </div>
                <h3 className="mt-4 font-semibold text-white text-sm">{comp.name}</h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
                  <span>{comp.type}</span>
                  <span className="text-white/20">|</span>
                  <Users className="h-3 w-3" />
                  <span>{comp.teams} times</span>
                </div>
                <div className={cn(
                  "mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider",
                  comp.bgColor,
                  comp.color
                )}>
                  {comp.status}
                </div>
              </button>
            )
          })}
        </div>

        {/* Standings Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#1a1a1a] border border-white/10 p-1 h-auto">
            <TabsTrigger 
              value="brasileirao" 
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              Serie A
            </TabsTrigger>
            <TabsTrigger 
              value="serie-b" 
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              Serie B
            </TabsTrigger>
            <TabsTrigger 
              value="copa-do-brasil" 
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              Copa do Brasil
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brasileirao" className="mt-4">
            <StandingsTable standings={serieAStandings} userTeam={userTeam} />
          </TabsContent>

          <TabsContent value="serie-b" className="mt-4">
            <StandingsTable standings={serieBStandings} userTeam={userTeam} />
          </TabsContent>

          <TabsContent value="copa-do-brasil" className="mt-4">
            <div className="rounded-xl bg-[#141414] border border-white/5 p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1db954]/10 mx-auto mb-4">
                <Trophy className="h-8 w-8 text-[#1db954]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Copa do Brasil 2026</h3>
              <p className="text-sm text-white/50 mt-2">
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
    <div className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[40px_1fr_40px_40px_40px_40px_50px_50px_50px_60px_100px] gap-2 px-4 py-3 text-[10px] font-medium tracking-widest text-white/40 uppercase border-b border-white/5 bg-white/[0.02]">
        <span className="text-center">#</span>
        <span>Clube</span>
        <span className="text-center">J</span>
        <span className="text-center">V</span>
        <span className="text-center">E</span>
        <span className="text-center">D</span>
        <span className="text-center">GP</span>
        <span className="text-center">GC</span>
        <span className="text-center">SG</span>
        <span className="text-center">PTS</span>
        <span className="text-center">Forma</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5">
        {standings.map((row) => (
          <div
            key={row.team.curto}
            className={cn(
              "grid grid-cols-[40px_1fr_40px_40px_40px_40px_50px_50px_50px_60px_100px] gap-2 px-4 py-3 items-center transition-colors hover:bg-white/[0.02]",
              row.isUser && "bg-[#1db954]/10 border-l-2 border-[#1db954]"
            )}
          >
            <span className={cn(
              "text-center text-sm font-medium",
              row.position <= 4 ? "text-[#1db954]" :
              row.position <= 6 ? "text-blue-400" :
              row.position >= 17 ? "text-red-500" :
              "text-white/50"
            )}>
              {row.position}
            </span>
            
            <div className="flex items-center gap-2 min-w-0">
              <TeamCrest team={row.team} size="sm" />
              <span className={cn(
                "truncate text-sm",
                row.isUser ? "font-semibold text-white" : "text-white/80"
              )}>
                {row.team.nome}
              </span>
              {row.isUser && <Star className="h-3 w-3 text-yellow-500 shrink-0" />}
            </div>

            <span className="text-center text-sm tabular-nums text-white/70">{row.played}</span>
            <span className="text-center text-sm tabular-nums text-[#1db954]">{row.won}</span>
            <span className="text-center text-sm tabular-nums text-white/50">{row.drawn}</span>
            <span className="text-center text-sm tabular-nums text-red-500">{row.lost}</span>
            <span className="text-center text-sm tabular-nums text-white/70">{row.goalsFor}</span>
            <span className="text-center text-sm tabular-nums text-white/70">{row.goalsAgainst}</span>
            <span className={cn(
              "text-center text-sm tabular-nums",
              row.goalDiff > 0 ? "text-[#1db954]" :
              row.goalDiff < 0 ? "text-red-500" :
              "text-white/50"
            )}>
              {row.goalDiff > 0 ? "+" : ""}{row.goalDiff}
            </span>
            <span className="text-center text-sm tabular-nums font-bold text-white">{row.points}</span>

            <div className="flex items-center justify-center gap-1">
              {row.form.map((result, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center",
                    result === "W" ? "bg-[#1db954]/20 text-[#1db954]" :
                    result === "D" ? "bg-white/10 text-white/50" :
                    result === "L" ? "bg-red-500/20 text-red-500" :
                    "bg-white/5 text-white/20"
                  )}
                >
                  {result || "-"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-3 text-[10px] text-white/50 border-t border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#1db954]" />
          <span>Libertadores</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-400" />
          <span>Sul-Americana</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span>Rebaixamento</span>
        </div>
      </div>
    </div>
  )
}
