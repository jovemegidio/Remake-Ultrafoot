"use client"

import { useMemo, useState, useEffect } from "react"
import {
  Filter,
  Search,
  SortAsc,
  Star,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUserTeam } from "@/lib/save-system"
import { getPlayersForTeam, sortByPosition, type Player } from "@/lib/players-data"

interface UiPlayer {
  id: string
  name: string
  position: string
  age: number
  overall: number
  potential: number
  value: number
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
}

// Deterministic pseudo-random in [0,1) so the same player always derives the
// same stats across reloads (no hydration mismatch, no flicker on re-renders).
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function jitter(seed: string, base: number, spread = 8): number {
  const r = hashStr(seed)
  return Math.max(20, Math.min(99, Math.round(base - spread / 2 + r * spread)))
}

// Map seed positions (LD/LE/VOL/MEI/ATA) to richer per-stat profiles.
const POSITION_PROFILE: Record<
  string,
  Partial<Record<keyof UiPlayer, number>>
> = {
  GOL: { pace: 45, shooting: 20, passing: 55, dribbling: 35, defending: 75, physical: 70 },
  ZAG: { pace: 65, shooting: 40, passing: 60, dribbling: 55, defending: 82, physical: 80 },
  LD:  { pace: 80, shooting: 55, passing: 70, dribbling: 72, defending: 74, physical: 72 },
  LE:  { pace: 80, shooting: 55, passing: 70, dribbling: 72, defending: 74, physical: 72 },
  VOL: { pace: 72, shooting: 60, passing: 76, dribbling: 70, defending: 76, physical: 76 },
  MEI: { pace: 75, shooting: 72, passing: 80, dribbling: 80, defending: 55, physical: 68 },
  PD:  { pace: 86, shooting: 72, passing: 70, dribbling: 80, defending: 35, physical: 65 },
  PE:  { pace: 86, shooting: 72, passing: 70, dribbling: 80, defending: 35, physical: 65 },
  ATA: { pace: 78, shooting: 82, passing: 68, dribbling: 76, defending: 38, physical: 76 },
}

function toUiPlayer(p: Player, idx: number): UiPlayer {
  const profile = POSITION_PROFILE[p.pos] ?? POSITION_PROFILE.MEI
  const seed = `${p.time}:${p.nome}:${idx}`
  const valueFactor = 0.5 + hashStr(seed + "v") * 1.6
  return {
    id: seed,
    name: p.nome,
    position: p.pos,
    age: p.idade,
    overall: p.base,
    potential: Math.min(99, p.base + Math.round(Math.max(0, 30 - p.idade) / 6)),
    value: Math.round(p.base * p.base * 12000 * valueFactor),
    pace: jitter(seed + "pa", profile.pace ?? 70),
    shooting: jitter(seed + "sh", profile.shooting ?? 60),
    passing: jitter(seed + "ps", profile.passing ?? 65),
    dribbling: jitter(seed + "dr", profile.dribbling ?? 65),
    defending: jitter(seed + "de", profile.defending ?? 50),
    physical: jitter(seed + "ph", profile.physical ?? 70),
  }
}

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
  const { team: userTeam } = useUserTeam()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")

  const players = useMemo<UiPlayer[]>(() => {
    const raw = sortByPosition(getPlayersForTeam(userTeam))
    return raw.map((p, i) => toUiPlayer(p, i))
  }, [userTeam])

  const [selectedPlayer, setSelectedPlayer] = useState<UiPlayer | null>(
    players[0] ?? null,
  )

  // Reselect when team (and so player list) changes.
  useEffect(() => {
    setSelectedPlayer(players[0] ?? null)
  }, [players])

  const filteredPlayers = useMemo(
    () =>
      players.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
        const matchesFilter =
          filter === "all" ||
          (filter === "gol" && p.position === "GOL") ||
          (filter === "def" && ["ZAG", "LD", "LE"].includes(p.position)) ||
          (filter === "mei" && ["VOL", "MEI"].includes(p.position)) ||
          (filter === "ata" && ["PD", "PE", "ATA"].includes(p.position))
        return matchesSearch && matchesFilter
      }),
    [players, search, filter],
  )

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
                <h1 className="font-display-italic text-3xl tracking-tight">ELENCO</h1>
                <p className="text-sm text-muted-foreground">{players.length} jogadores no elenco principal</p>
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
              <TabsList className="bg-card border border-border">
                <TabsTrigger value="all" className="font-display text-xs tracking-wider">TODOS</TabsTrigger>
                <TabsTrigger value="gol" className="font-display text-xs tracking-wider">GOL</TabsTrigger>
                <TabsTrigger value="def" className="font-display text-xs tracking-wider">DEF</TabsTrigger>
                <TabsTrigger value="mei" className="font-display text-xs tracking-wider">MEI</TabsTrigger>
                <TabsTrigger value="ata" className="font-display text-xs tracking-wider">ATA</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Players Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayer(player)}
                  className={`eafc-card p-4 text-left transition-all ${
                    selectedPlayer?.id === player.id ? "ring-2 ring-primary" : ""
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
            {selectedPlayer ? (
            <>
            <div className="eafc-card overflow-hidden">
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
            </>
            ) : (
              <div className="eafc-card p-8 text-center text-sm text-muted-foreground">
                Nenhum jogador cadastrado para {userTeam.nome}.
              </div>
            )}
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
