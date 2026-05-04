"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ChevronRight,
  Filter,
  Search,
  SortAsc,
  Star,
  Users,
  Zap,
  TrendingUp,
  Target,
  Shield,
  Footprints,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"

const userTeam = getTeamByShort("RBB") || serieATeams[0]

// Mock players data
const players = [
  { id: 1, name: "Cleiton", position: "GOL", age: 28, overall: 78, potential: 80, value: 8500000, pace: 45, shooting: 20, passing: 55, dribbling: 35, defending: 25, physical: 70 },
  { id: 2, name: "Nathan Mendes", position: "LD", age: 24, overall: 75, potential: 82, value: 6200000, pace: 82, shooting: 55, passing: 70, dribbling: 72, defending: 74, physical: 70 },
  { id: 3, name: "Pedro Henrique", position: "ZAG", age: 27, overall: 77, potential: 78, value: 7800000, pace: 68, shooting: 45, passing: 60, dribbling: 55, defending: 80, physical: 82 },
  { id: 4, name: "Eduardo Santos", position: "ZAG", age: 25, overall: 76, potential: 80, value: 7200000, pace: 70, shooting: 42, passing: 58, dribbling: 52, defending: 78, physical: 80 },
  { id: 5, name: "Luan Candido", position: "LE", age: 23, overall: 74, potential: 83, value: 5800000, pace: 85, shooting: 58, passing: 72, dribbling: 75, defending: 70, physical: 68 },
  { id: 6, name: "Jadsom Silva", position: "VOL", age: 22, overall: 73, potential: 84, value: 5500000, pace: 72, shooting: 60, passing: 75, dribbling: 72, defending: 76, physical: 75 },
  { id: 7, name: "Eric Ramires", position: "VOL", age: 26, overall: 77, potential: 79, value: 8000000, pace: 75, shooting: 65, passing: 78, dribbling: 74, defending: 75, physical: 78 },
  { id: 8, name: "Lincoln", position: "MEI", age: 24, overall: 78, potential: 85, value: 12000000, pace: 80, shooting: 75, passing: 80, dribbling: 82, defending: 55, physical: 68 },
  { id: 9, name: "Vitinho", position: "PD", age: 25, overall: 76, potential: 80, value: 7500000, pace: 88, shooting: 72, passing: 70, dribbling: 80, defending: 35, physical: 65 },
  { id: 10, name: "Helinho", position: "PE", age: 22, overall: 75, potential: 84, value: 6800000, pace: 90, shooting: 70, passing: 72, dribbling: 82, defending: 32, physical: 62 },
  { id: 11, name: "Eduardo Sasha", position: "ATA", age: 30, overall: 79, potential: 79, value: 9500000, pace: 78, shooting: 82, passing: 68, dribbling: 75, defending: 38, physical: 76 },
  { id: 12, name: "Thiago Borbas", position: "ATA", age: 21, overall: 72, potential: 86, value: 4500000, pace: 85, shooting: 74, passing: 62, dribbling: 76, defending: 30, physical: 70 },
]

const positionColors: Record<string, string> = {
  GOL: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  ZAG: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  LD: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  LE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  VOL: "bg-green-500/20 text-green-400 border-green-500/30",
  MEI: "bg-green-500/20 text-green-400 border-green-500/30",
  PD: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  PE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ATA: "bg-red-500/20 text-red-400 border-red-500/30",
}

function getOverallColor(overall: number) {
  if (overall >= 80) return "overall-gold"
  if (overall >= 70) return "overall-silver"
  return "overall-bronze"
}

function formatValue(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}

export default function ElencoPage() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [selectedPlayer, setSelectedPlayer] = useState(players[0])

  const filteredPlayers = players.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === "all" || 
      (filter === "gol" && p.position === "GOL") ||
      (filter === "def" && ["ZAG", "LD", "LE"].includes(p.position)) ||
      (filter === "mei" && ["VOL", "MEI"].includes(p.position)) ||
      (filter === "ata" && ["PD", "PE", "ATA"].includes(p.position))
    return matchesSearch && matchesFilter
  })

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Player List */}
          <section className="lg:col-span-2 space-y-4">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">Elenco</h1>
                <p className="text-sm text-white/50 mt-1">{players.length} jogadores no elenco principal</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar jogador..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 w-[200px] bg-card border-border"
                  />
                </div>
                <Button variant="outline" size="icon" className="border-border">
                  <Filter className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="border-border">
                  <SortAsc className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Position Filter */}
            <Tabs value={filter} onValueChange={setFilter} className="w-full">
              <TabsList className="bg-[#1a1a1a] border border-white/10 p-1 h-auto">
                <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">Todos</TabsTrigger>
                <TabsTrigger value="gol" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">GOL</TabsTrigger>
                <TabsTrigger value="def" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">DEF</TabsTrigger>
                <TabsTrigger value="mei" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">MEI</TabsTrigger>
                <TabsTrigger value="ata" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">ATA</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Players Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayer(player)}
                  className={`rounded-xl bg-[#141414] border p-4 text-left transition-all ${
                    selectedPlayer.id === player.id ? "border-[#1db954] ring-1 ring-[#1db954]" : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Player Avatar */}
                    <div className="relative">
                      <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-card to-muted flex items-center justify-center">
                        <span className="font-display-italic text-2xl text-muted-foreground">
                          {player.name.charAt(0)}
                        </span>
                      </div>
                      <div className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-md border ${positionColors[player.position]}`}>
                        <span className="text-[10px] font-bold">{player.position}</span>
                      </div>
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium truncate">{player.name}</h3>
                        <span className={`font-display-italic text-xl ${getOverallColor(player.overall)}`}>
                          {player.overall}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{player.age} anos</span>
                        <span className="text-border">|</span>
                        <span>{formatValue(player.value)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div 
                            className="h-full stat-bar rounded-full"
                            style={{ width: `${player.overall}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground ml-1">POT {player.potential}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Player Detail */}
          <section className="space-y-4">
            <div className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
              {/* Player Header */}
              <div 
                className="relative p-6 bg-gradient-to-br"
                style={{
                  background: `linear-gradient(135deg, ${userTeam.cor1}40, ${userTeam.cor2}20)`
                }}
              >
                <div className="absolute top-4 right-4">
                  <span className={`font-display-italic text-5xl ${getOverallColor(selectedPlayer.overall)}`}>
                    {selectedPlayer.overall}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-24 w-24 rounded-2xl bg-card/80 backdrop-blur flex items-center justify-center">
                    <span className="font-display-italic text-4xl text-muted-foreground">
                      {selectedPlayer.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${positionColors[selectedPlayer.position]}`}>
                      {selectedPlayer.position}
                    </div>
                    <h2 className="mt-1 font-display-italic text-2xl">{selectedPlayer.name}</h2>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span>{selectedPlayer.age} anos</span>
                      <span className="text-border">|</span>
                      <TeamCrest team={userTeam} size="xs" />
                      <span>{userTeam.curto}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatItem icon={Zap} label="RITMO" value={selectedPlayer.pace} />
                  <StatItem icon={Target} label="FINALIZACAO" value={selectedPlayer.shooting} />
                  <StatItem icon={Footprints} label="PASSE" value={selectedPlayer.passing} />
                  <StatItem icon={Star} label="DRIBLE" value={selectedPlayer.dribbling} />
                  <StatItem icon={Shield} label="DEFESA" value={selectedPlayer.defending} />
                  <StatItem icon={TrendingUp} label="FISICO" value={selectedPlayer.physical} />
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valor de mercado</span>
                    <span className="font-display text-accent">{formatValue(selectedPlayer.value)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Potencial</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-display-italic text-lg ${getOverallColor(selectedPlayer.potential)}`}>
                        {selectedPlayer.potential}
                      </span>
                      {selectedPlayer.potential > selectedPlayer.overall && (
                        <TrendingUp className="h-4 w-4 text-accent" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="font-display text-xs tracking-wider border-border">
                TREINAR
              </Button>
              <Button variant="outline" className="font-display text-xs tracking-wider border-border">
                NEGOCIAR
              </Button>
            </div>
          </section>
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}

function StatItem({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number 
}) {
  const getStatColor = (val: number) => {
    if (val >= 80) return "text-accent"
    if (val >= 70) return "text-gold"
    if (val >= 60) return "text-foreground"
    return "text-muted-foreground"
  }

  return (
    <div className="rounded-lg bg-card/50 border border-border p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-display tracking-widest text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-display-italic text-xl ${getStatColor(value)}`}>{value}</span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div 
            className="h-full stat-bar rounded-full transition-all"
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    </div>
  )
}
