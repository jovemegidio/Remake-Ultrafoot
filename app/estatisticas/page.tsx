"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Trophy,
  Target,
  Footprints,
  AlertTriangle,
  Star,
  TrendingUp,
  Award,
  Users,
  Shirt
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getTeamByShort, type Team } from "@/lib/teams-data"
import { useRouter } from "next/navigation"
import { useUserTeam } from "@/lib/save-system"
import { useGameEngine } from "@/lib/game-engine"
import { useGameManager, getLeagueName } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"

// Mock data para artilharia
const topScorers = [
  { pos: 1, name: "Gabriel Barbosa", team: "FLA", goals: 12, assists: 4, matches: 15 },
  { pos: 2, name: "Endrick", team: "PAL", goals: 10, assists: 2, matches: 14 },
  { pos: 3, name: "Eduardo Sasha", team: "BGT", goals: 9, assists: 3, matches: 15, isUser: true },
  { pos: 4, name: "Luciano", team: "SAO", goals: 8, assists: 5, matches: 15 },
  { pos: 5, name: "Yuri Alberto", team: "COR", goals: 8, assists: 2, matches: 14 },
  { pos: 6, name: "Hulk", team: "CAM", goals: 7, assists: 6, matches: 15 },
  { pos: 7, name: "German Cano", team: "FLU", goals: 7, assists: 1, matches: 13 },
  { pos: 8, name: "Pedro", team: "FLA", goals: 6, assists: 4, matches: 12 },
  { pos: 9, name: "Vegetti", team: "VAS", goals: 6, assists: 2, matches: 15 },
  { pos: 10, name: "Juan Dinenno", team: "CRU", goals: 5, assists: 3, matches: 14 },
]

const topAssisters = [
  { pos: 1, name: "Hulk", team: "CAM", goals: 7, assists: 8, matches: 15 },
  { pos: 2, name: "Arrascaeta", team: "FLA", goals: 3, assists: 7, matches: 14 },
  { pos: 3, name: "Raphael Veiga", team: "PAL", goals: 4, assists: 6, matches: 15 },
  { pos: 4, name: "Lincoln", team: "BGT", goals: 5, assists: 6, matches: 15, isUser: true },
  { pos: 5, name: "Luciano", team: "SAO", goals: 8, assists: 5, matches: 15 },
  { pos: 6, name: "Everton Ribeiro", team: "BAH", goals: 2, assists: 5, matches: 14 },
  { pos: 7, name: "Gabriel Barbosa", team: "FLA", goals: 12, assists: 4, matches: 15 },
  { pos: 8, name: "Gerson", team: "FLA", goals: 3, assists: 4, matches: 15 },
  { pos: 9, name: "Pedro", team: "FLA", goals: 6, assists: 4, matches: 12 },
  { pos: 10, name: "Vitinho", team: "BGT", goals: 4, assists: 4, matches: 14, isUser: true },
]

const topYellowCards = [
  { pos: 1, name: "Felipe", team: "FOR", yellows: 8, reds: 1, matches: 15 },
  { pos: 2, name: "Thiago Santos", team: "PAL", yellows: 7, reds: 0, matches: 14 },
  { pos: 3, name: "Fabricio Bruno", team: "FLA", yellows: 6, reds: 0, matches: 15 },
  { pos: 4, name: "Ze Rafael", team: "PAL", yellows: 6, reds: 1, matches: 13 },
  { pos: 5, name: "Jadsom Silva", team: "BGT", yellows: 5, reds: 0, matches: 15, isUser: true },
]

// Mock data para estatisticas do time do usuario
const userTeamStats = {
  goalsScored: 28,
  goalsConceded: 22,
  cleanSheets: 4,
  wins: 8,
  draws: 4,
  losses: 3,
  possession: 52,
  passAccuracy: 78,
  shotsPerGame: 12.4,
  tackles: 186,
  fouls: 142,
  corners: 89,
}

// Mock data para jogadores do time
const userSquadStats = [
  { id: 1, name: "Cleiton", position: "GOL", matches: 15, goals: 0, assists: 0, yellows: 1, reds: 0, rating: 7.2, cleanSheets: 4 },
  { id: 2, name: "Nathan Mendes", position: "LD", matches: 14, goals: 1, assists: 3, yellows: 3, reds: 0, rating: 7.0 },
  { id: 3, name: "Pedro Henrique", position: "ZAG", matches: 15, goals: 2, assists: 0, yellows: 4, reds: 0, rating: 7.1 },
  { id: 4, name: "Eduardo Santos", position: "ZAG", matches: 13, goals: 1, assists: 0, yellows: 2, reds: 0, rating: 6.9 },
  { id: 5, name: "Luan Candido", position: "LE", matches: 15, goals: 0, assists: 4, yellows: 2, reds: 0, rating: 7.3 },
  { id: 6, name: "Jadsom Silva", position: "VOL", matches: 15, goals: 1, assists: 2, yellows: 5, reds: 0, rating: 7.0 },
  { id: 7, name: "Eric Ramires", position: "MEI", matches: 14, goals: 3, assists: 5, yellows: 1, reds: 0, rating: 7.4 },
  { id: 8, name: "Lincoln", position: "MEI", matches: 15, goals: 5, assists: 6, yellows: 0, reds: 0, rating: 7.8 },
  { id: 9, name: "Vitinho", position: "PD", matches: 14, goals: 4, assists: 4, yellows: 2, reds: 0, rating: 7.2 },
  { id: 10, name: "Eduardo Sasha", position: "ATA", matches: 15, goals: 9, assists: 3, yellows: 1, reds: 0, rating: 7.6 },
  { id: 11, name: "Helinho", position: "PE", matches: 12, goals: 3, assists: 2, yellows: 1, reds: 0, rating: 7.1 },
]

export default function EstatisticasPage() {
  const { team: userTeam } = useUserTeam()
  const { squadPlayers, matchResults, currentSeason } = useGameEngine()
  const { standings } = useGameManager()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("artilharia")
  const estatTabsOrder = ["artilharia", "assistencias", "cartoes", "elenco"]

  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (!btn) return
      if (btn === "B") { router.back(); return }
      if (btn === "LB") setActiveTab(t => estatTabsOrder[Math.max(0, estatTabsOrder.indexOf(t) - 1)])
      if (btn === "RB") setActiveTab(t => estatTabsOrder[Math.min(estatTabsOrder.length - 1, estatTabsOrder.indexOf(t) + 1)])
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router, activeTab])

  // Calcula estatisticas do elenco baseado nos dados do game engine
  const userSquadStatsLive = useMemo(() => {
    return squadPlayers.map(p => ({
      id: p.id,
      name: p.name,
      position: p.position,
      matches: p.seasonStats.matchesPlayed,
      goals: p.seasonStats.goals,
      assists: p.seasonStats.assists,
      yellows: p.seasonStats.yellowCards,
      reds: p.seasonStats.redCards,
      rating: 7.0 + (p.seasonStats.goals * 0.1) + (p.seasonStats.assists * 0.05),
      cleanSheets: p.seasonStats.cleanSheets
    })).sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))
  }, [squadPlayers])

  // Calcula estatisticas do time
  const userTeamStatsLive = useMemo(() => {
    const userMatches = matchResults.filter(
      m => m.homeTeam === userTeam.curto || m.awayTeam === userTeam.curto
    )
    
    let goalsScored = 0
    let goalsConceded = 0
    let wins = 0
    let draws = 0
    let losses = 0
    let cleanSheets = 0
    
    userMatches.forEach(m => {
      const isHome = m.homeTeam === userTeam.curto
      const scored = isHome ? m.homeScore : m.awayScore
      const conceded = isHome ? m.awayScore : m.homeScore
      
      goalsScored += scored
      goalsConceded += conceded
      
      if (conceded === 0) cleanSheets++
      
      if (scored > conceded) wins++
      else if (scored < conceded) losses++
      else draws++
    })
    
    return {
      goalsScored,
      goalsConceded,
      cleanSheets,
      wins,
      draws,
      losses,
      possession: 52,
      passAccuracy: 78,
      shotsPerGame: 12.4,
      tackles: 186,
      fouls: 142,
      corners: 89,
    }
  }, [matchResults, userTeam.curto])

  return (
    <div className="h-screen pl-16 bg-[#050508] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Estatisticas</h1>
            <p className="text-sm text-white/50 mt-1">Temporada {currentSeason} - {getLeagueName(userTeam.curto)}</p>
          </div>
        </div>

        {/* User Team Stats Summary */}
        <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04]">
            <TeamCrest team={userTeam} size="sm" />
            <span className="font-semibold text-white">{userTeam.nome}</span>
            <span className="text-xs text-white/50">- Resumo da Temporada</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-5">
            <StatCard label="Gols Marcados" value={userTeamStatsLive.goalsScored} icon={Target} color="text-[#00ffc8]" />
            <StatCard label="Gols Sofridos" value={userTeamStatsLive.goalsConceded} icon={Target} color="text-red-500" />
            <StatCard label="Clean Sheets" value={userTeamStatsLive.cleanSheets} icon={Shirt} color="text-blue-500" />
            <StatCard label="Vitorias" value={userTeamStatsLive.wins} icon={Trophy} color="text-yellow-500" />
            <StatCard label="Empates" value={userTeamStatsLive.draws} icon={TrendingUp} color="text-white/50" />
            <StatCard label="Derrotas" value={userTeamStatsLive.losses} icon={AlertTriangle} color="text-red-400" />
          </div>
        </section>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#1a1a1a] border border-white/10 p-1 h-auto">
            <TabsTrigger 
              value="artilharia" 
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              Artilharia
            </TabsTrigger>
            <TabsTrigger 
              value="assistencias" 
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              Assistencias
            </TabsTrigger>
            <TabsTrigger 
              value="cartoes" 
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              Cartoes
            </TabsTrigger>
            <TabsTrigger 
              value="elenco" 
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              Meu Elenco
            </TabsTrigger>
          </TabsList>

          <TabsContent value="artilharia" className="mt-4">
            <LeaderboardTable 
              title="Artilharia do Campeonato"
              data={topScorers}
              columns={[
                { key: "goals", label: "Gols", icon: Target },
                { key: "assists", label: "Assist", icon: Footprints },
                { key: "matches", label: "Jogos", icon: Shirt },
              ]}
              primaryColumn="goals"
            />
          </TabsContent>

          <TabsContent value="assistencias" className="mt-4">
            <LeaderboardTable 
              title="Garcons do Campeonato"
              data={topAssisters}
              columns={[
                { key: "assists", label: "Assist", icon: Footprints },
                { key: "goals", label: "Gols", icon: Target },
                { key: "matches", label: "Jogos", icon: Shirt },
              ]}
              primaryColumn="assists"
            />
          </TabsContent>

          <TabsContent value="cartoes" className="mt-4">
            <LeaderboardTable 
              title="Cartoes Amarelos"
              data={topYellowCards}
              columns={[
                { key: "yellows", label: "Amarelos", icon: AlertTriangle },
                { key: "reds", label: "Vermelhos", icon: AlertTriangle },
                { key: "matches", label: "Jogos", icon: Shirt },
              ]}
              primaryColumn="yellows"
              primaryColor="text-yellow-500"
            />
          </TabsContent>

          <TabsContent value="elenco" className="mt-4">
            <SquadStatsTable data={userSquadStatsLive.length > 0 ? userSquadStatsLive : userSquadStats} />
          </TabsContent>
        </Tabs>
      </main>

      <MusicPlayer />
    </div>
  )
}

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  color 
}: { 
  label: string; 
  value: string | number; 
  icon: React.ElementType; 
  color: string 
}) {
  return (
    <div className="p-4 rounded-lg bg-white/5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-xs text-white/50">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function LeaderboardTable({ 
  title, 
  data, 
  columns,
  primaryColumn,
  primaryColor = "text-[#00ffc8]"
}: { 
  title: string;
  data: { pos: number; name: string; team: string; isUser?: boolean; [key: string]: string | number | boolean | undefined }[];
  columns: { key: string; label: string; icon: React.ElementType }[];
  primaryColumn: string;
  primaryColor?: string;
}) {
  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
        <Award className="h-4 w-4 text-yellow-500" />
        <span className="font-semibold text-white">{title}</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[40px_1fr_60px_repeat(3,60px)] gap-2 px-4 py-2 text-[10px] text-white/40 uppercase tracking-wider border-b border-white/[0.04] bg-white/[0.02]">
        <span className="text-center">#</span>
        <span>Jogador</span>
        <span className="text-center">Time</span>
        {columns.map(col => (
          <span key={col.key} className="text-center">{col.label}</span>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5">
        {data.map((row) => {
          const team = getTeamByShort(row.team)
          return (
            <div
              key={row.pos}
              className={cn(
                "grid grid-cols-[40px_1fr_60px_repeat(3,60px)] gap-2 px-4 py-3 items-center transition-colors hover:bg-white/[0.02]",
                row.isUser && "bg-[#00ffc8]/10 border-l-2 border-[#00ffc8]"
              )}
            >
              <span className={cn(
                "text-center text-sm font-medium",
                row.pos <= 3 ? "text-yellow-500" : "text-white/50"
              )}>
                {row.pos <= 3 ? (
                  <div className="flex items-center justify-center">
                    <Trophy className={cn(
                      "h-4 w-4",
                      row.pos === 1 ? "text-yellow-400" :
                      row.pos === 2 ? "text-gray-400" : "text-amber-600"
                    )} />
                  </div>
                ) : row.pos}
              </span>
              
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  "truncate text-sm",
                  row.isUser ? "font-semibold text-white" : "text-white/80"
                )}>
                  {row.name}
                </span>
                {row.isUser && <Star className="h-3 w-3 text-yellow-500 shrink-0" />}
              </div>

              <div className="flex items-center justify-center">
                {team && <TeamCrest team={team} size="xs" />}
              </div>

              {columns.map((col, i) => (
                <span 
                  key={col.key} 
                  className={cn(
                    "text-center text-sm tabular-nums",
                    i === 0 ? `font-bold ${primaryColor}` : "text-white/70"
                  )}
                >
                  {row[col.key] as string | number}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SquadStatsTable({ 
  data 
}: { 
  data: { id: number; name: string; position: string; matches: number; goals: number; assists: number; yellows: number; reds: number; rating: number; cleanSheets?: number }[]
}) {
  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
        <Users className="h-4 w-4 text-[#00ffc8]" />
        <span className="font-semibold text-white">Estatisticas do Elenco</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_60px_50px_50px_50px_50px_50px_60px] gap-2 px-4 py-2 text-[10px] text-white/40 uppercase tracking-wider border-b border-white/[0.04] bg-white/[0.02]">
        <span>Jogador</span>
        <span className="text-center">Pos</span>
        <span className="text-center">J</span>
        <span className="text-center">G</span>
        <span className="text-center">A</span>
        <span className="text-center">AM</span>
        <span className="text-center">VM</span>
        <span className="text-center">Nota</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5">
        {data.sort((a, b) => b.rating - a.rating).map((player) => (
          <div
            key={player.id}
            className="grid grid-cols-[1fr_60px_50px_50px_50px_50px_50px_60px] gap-2 px-4 py-3 items-center transition-colors hover:bg-white/[0.02]"
          >
            <span className="text-sm text-white font-medium">{player.name}</span>
            <span className="text-center text-xs text-white/50">{player.position}</span>
            <span className="text-center text-sm text-white/70 tabular-nums">{player.matches}</span>
            <span className="text-center text-sm text-[#00ffc8] tabular-nums font-semibold">{player.goals}</span>
            <span className="text-center text-sm text-blue-400 tabular-nums">{player.assists}</span>
            <span className="text-center text-sm text-yellow-500 tabular-nums">{player.yellows}</span>
            <span className="text-center text-sm text-red-500 tabular-nums">{player.reds}</span>
            <span className={cn(
              "text-center text-sm font-bold tabular-nums",
              player.rating >= 7.5 ? "text-[#00ffc8]" :
              player.rating >= 7.0 ? "text-lime-400" :
              player.rating >= 6.5 ? "text-yellow-500" : "text-orange-500"
            )}>
              {player.rating.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
