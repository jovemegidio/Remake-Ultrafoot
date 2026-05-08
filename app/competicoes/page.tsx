"use client"

import { useState, useMemo } from "react"
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
import { useUserTeam } from "@/lib/save-system"
import { useGameManager } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"

// Generate standings with random stats (fallback for Serie B)
const generateStandings = (teams: Team[], userTeamShort: string) => {
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
    isUser: team.curto === userTeamShort,
  }))
}

export default function CompeticoesPage() {
  const { team: userTeam } = useUserTeam()
  const { standings: gameStandings, currentWeek, currentSeason, userPosition } = useGameManager()
  const [activeTab, setActiveTab] = useState("brasileirao")

  // Converte standings do game engine para o formato da tabela
  const serieAStandings = useMemo(() => {
    if (gameStandings.length === 0) {
      return generateStandings(serieATeams, userTeam.curto)
    }
    
    return gameStandings.map((entry, index) => ({
      position: index + 1,
      team: getTeamByShort(entry.teamShort) || serieATeams[0],
      played: entry.played,
      won: entry.won,
      drawn: entry.drawn,
      lost: entry.lost,
      goalsFor: entry.goalsFor,
      goalsAgainst: entry.goalsAgainst,
      goalDiff: entry.goalsFor - entry.goalsAgainst,
      points: entry.points,
      form: [...entry.form.slice(-5), "", "", "", "", ""].slice(0, 5) as ("W" | "D" | "L" | "")[],
      isUser: entry.teamShort === userTeam.curto,
    }))
  }, [gameStandings, userTeam.curto])

  const serieBStandings = useMemo(() => generateStandings(serieBTeams, userTeam.curto), [userTeam.curto])

  const competitions = [
    { 
      id: "brasileirao", 
      name: "Brasileirao Serie A", 
      type: "Liga", 
      teams: 20, 
      status: currentWeek > 0 ? "Em andamento" : "A iniciar",
      userPosition: userPosition > 0 ? userPosition : null,
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
              <span className="text-sm text-white/70">Rodada {currentWeek}/38</span>
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
            <CopaBracket userTeam={userTeam} />
          </TabsContent>
        </Tabs>
      </main>

      <MusicPlayer />
    </div>
  )
}

// Copa do Brasil Bracket
function CopaBracket({ userTeam }: { userTeam: Team }) {
  const [bracketDrawn, setBracketDrawn] = useState(false)
  const [bracket, setBracket] = useState<{
    oitavas: { id: number; team1: string; team2: string; score1: number | null; score2: number | null }[];
    quartas: { id: number; team1: string | null; team2: string | null; score1: number | null; score2: number | null }[];
    semis: { id: number; team1: string | null; team2: string | null; score1: number | null; score2: number | null }[];
    final: { id: number; team1: string | null; team2: string | null; score1: number | null; score2: number | null }[];
  }>({
    oitavas: [],
    quartas: [],
    semis: [],
    final: []
  })

  const drawBracket = () => {
    // Sortear times para as oitavas
    const teams = ["FLA", "COR", "PAL", "SAO", "GRE", "INT", "BOT", "CAM", 
                   userTeam.curto, "FLU", "FOR", "CRU", "BAH", "VAS", "CAP", "SAN"]
    const shuffled = [...teams].sort(() => Math.random() - 0.5)
    
    const oitavas = []
    for (let i = 0; i < 8; i++) {
      oitavas.push({
        id: i + 1,
        team1: shuffled[i * 2],
        team2: shuffled[i * 2 + 1],
        score1: null,
        score2: null
      })
    }
    
    setBracket({
      oitavas,
      quartas: Array(4).fill(null).map((_, i) => ({ id: i + 1, team1: null, team2: null, score1: null, score2: null })),
      semis: Array(2).fill(null).map((_, i) => ({ id: i + 1, team1: null, team2: null, score1: null, score2: null })),
      final: [{ id: 1, team1: null, team2: null, score1: null, score2: null }]
    })
    setBracketDrawn(true)
  }

  const getTeamData = (short: string | null) => {
    if (!short) return null
    return getTeamByShort(short)
  }

  if (!bracketDrawn) {
    return (
      <div className="rounded-xl bg-[#141414] border border-white/5 p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1db954]/10 mx-auto mb-6">
          <Trophy className="h-10 w-10 text-[#1db954]" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Copa do Brasil 2026</h3>
        <p className="text-sm text-white/50 mb-6">
          Clique para realizar o sorteio das oitavas de final
        </p>
        <button
          onClick={drawBracket}
          className="px-6 py-3 rounded-lg bg-[#1db954] text-black font-semibold hover:bg-[#1ed760] transition-colors"
        >
          Sortear Chaves
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-[#141414] border border-white/5 p-6 overflow-x-auto">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="h-5 w-5 text-[#1db954]" />
        <h3 className="text-lg font-semibold text-white">Copa do Brasil 2026 - Mata-mata</h3>
      </div>

      <div className="flex gap-8 min-w-[900px]">
        {/* Oitavas */}
        <div className="flex-1">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-3 text-center">Oitavas</div>
          <div className="space-y-2">
            {bracket.oitavas.map((match) => {
              const team1 = getTeamData(match.team1)
              const team2 = getTeamData(match.team2)
              const isUserMatch = match.team1 === userTeam.curto || match.team2 === userTeam.curto
              
              return (
                <div 
                  key={match.id} 
                  className={cn(
                    "p-2 rounded-lg border",
                    isUserMatch ? "bg-[#1db954]/10 border-[#1db954]/30" : "bg-white/5 border-white/10"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {team1 && <TeamCrest team={team1} size="xs" />}
                    <span className={cn("text-xs flex-1", match.team1 === userTeam.curto && "font-bold text-white")}>
                      {match.team1}
                    </span>
                    <span className="text-xs text-white/50">{match.score1 ?? "-"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {team2 && <TeamCrest team={team2} size="xs" />}
                    <span className={cn("text-xs flex-1", match.team2 === userTeam.curto && "font-bold text-white")}>
                      {match.team2}
                    </span>
                    <span className="text-xs text-white/50">{match.score2 ?? "-"}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quartas */}
        <div className="flex-1">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-3 text-center">Quartas</div>
          <div className="space-y-4 pt-6">
            {bracket.quartas.map((match) => (
              <div key={match.id} className="p-2 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs flex-1 text-white/50">{match.team1 || "A definir"}</span>
                  <span className="text-xs text-white/50">-</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs flex-1 text-white/50">{match.team2 || "A definir"}</span>
                  <span className="text-xs text-white/50">-</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Semis */}
        <div className="flex-1">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-3 text-center">Semifinal</div>
          <div className="space-y-8 pt-16">
            {bracket.semis.map((match) => (
              <div key={match.id} className="p-2 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs flex-1 text-white/50">{match.team1 || "A definir"}</span>
                  <span className="text-xs text-white/50">-</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs flex-1 text-white/50">{match.team2 || "A definir"}</span>
                  <span className="text-xs text-white/50">-</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Final */}
        <div className="flex-1">
          <div className="text-xs text-yellow-500 uppercase tracking-wider mb-3 text-center font-semibold">Final</div>
          <div className="pt-32">
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-3 w-3 text-yellow-500" />
                <span className="text-xs flex-1 text-white/50">{bracket.final[0]?.team1 || "A definir"}</span>
                <span className="text-xs text-white/50">-</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3" />
                <span className="text-xs flex-1 text-white/50">{bracket.final[0]?.team2 || "A definir"}</span>
                <span className="text-xs text-white/50">-</span>
              </div>
            </div>
          </div>
        </div>
      </div>
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
