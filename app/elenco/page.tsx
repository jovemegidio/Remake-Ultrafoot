"use client"

import { useState, useMemo } from "react"
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
  AlertTriangle,
  Clock,
  Check,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrainingModal } from "@/components/modals/training-modal"
import { NegotiationModal } from "@/components/modals/negotiation-modal"
import { FilterModal } from "@/components/modals/filter-modal"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { type Team } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { cn } from "@/lib/utils"
import { PlayerAvatar } from "@/components/player-avatar"

// Mock players data - includes one player close to retirement
const playersData = [
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
  { id: 13, name: "Marcelo Souza", position: "VOL", age: 36, overall: 74, potential: 74, value: 2000000, pace: 58, shooting: 55, passing: 72, dribbling: 68, defending: 76, physical: 65 },
]

// Retirement age threshold
const RETIREMENT_WARNING_AGE = 34
const RETIREMENT_AGE = 38

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
  if (overall >= 80) return "text-yellow-500"
  if (overall >= 70) return "text-gray-300"
  return "text-amber-600"
}

function formatValue(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}

interface FilterOptions {
  positions: string[]
  minOverall: number
  maxOverall: number
  minAge: number
  maxAge: number
  minValue: number
  maxValue: number
}

export default function ElencoPage() {
  const { team: userTeam } = useUserTeam()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [players, setPlayers] = useState(playersData)
  const [selectedPlayer, setSelectedPlayer] = useState(players[0])
  const [trainingOpen, setTrainingOpen] = useState(false)
  const [negotiationOpen, setNegotiationOpen] = useState(false)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [retirementModalOpen, setRetirementModalOpen] = useState(false)
  const [playerToRetire, setPlayerToRetire] = useState<typeof playersData[0] | null>(null)
  const [retired, setRetired] = useState(false)
  const [filters, setFilters] = useState<FilterOptions>({
    positions: [],
    minOverall: 0,
    maxOverall: 99,
    minAge: 16,
    maxAge: 45,
    minValue: 0,
    maxValue: 100000000,
  })

  const filteredPlayers = useMemo(() => {
    return players.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchesTab = filter === "all" || 
        (filter === "gol" && p.position === "GOL") ||
        (filter === "def" && ["ZAG", "LD", "LE"].includes(p.position)) ||
        (filter === "mei" && ["VOL", "MEI"].includes(p.position)) ||
        (filter === "ata" && ["PD", "PE", "ATA"].includes(p.position))
      const matchesPosition = filters.positions.length === 0 || filters.positions.includes(p.position)
      const matchesOverall = p.overall >= filters.minOverall && p.overall <= filters.maxOverall
      const matchesAge = p.age >= filters.minAge && p.age <= filters.maxAge
      return matchesSearch && matchesTab && matchesPosition && matchesOverall && matchesAge
    })
  }, [players, search, filter, filters])

  const handleTrainingConfirm = (attribute: string) => {
    // Update player stats (mock implementation)
    setPlayers(prev => prev.map(p => {
      if (p.id === selectedPlayer.id) {
        const improvement = Math.floor(Math.random() * 2) + 1
        return {
          ...p,
          [attribute]: Math.min(99, p[attribute as keyof typeof p] as number + improvement)
        }
      }
      return p
    }))
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.positions.length > 0) count++
    if (filters.minOverall > 0 || filters.maxOverall < 99) count++
    if (filters.minAge > 16 || filters.maxAge < 45) count++
    return count
  }, [filters])

  // Players close to retirement
  const playersNearRetirement = useMemo(() => {
    return players.filter(p => p.age >= RETIREMENT_WARNING_AGE)
  }, [players])

  // Handle retirement confirmation
  const handleRetirePlayer = (player: typeof playersData[0]) => {
    setPlayerToRetire(player)
    setRetirementModalOpen(true)
    setRetired(false)
  }

  const confirmRetirement = () => {
    if (playerToRetire) {
      setPlayers(prev => prev.filter(p => p.id !== playerToRetire.id))
      setRetired(true)
      setTimeout(() => {
        setRetirementModalOpen(false)
        setPlayerToRetire(null)
        setRetired(false)
        // Select another player if the retired one was selected
        if (selectedPlayer.id === playerToRetire.id) {
          const remaining = players.filter(p => p.id !== playerToRetire.id)
          setSelectedPlayer(remaining[0])
        }
      }, 1500)
    }
  }

  // Check if selected player can retire
  const canRetire = selectedPlayer.age >= RETIREMENT_WARNING_AGE

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
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <Input
                    placeholder="Buscar jogador..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 w-[200px] bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setFilterModalOpen(true)}
                  className="border-white/10 relative"
                >
                  <Filter className="h-4 w-4" />
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1db954] text-[10px] text-black font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
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
                  className={cn(
                    "rounded-xl bg-[#141414] border p-4 text-left transition-all",
                    selectedPlayer.id === player.id 
                      ? "border-[#1db954] ring-1 ring-[#1db954]" 
                      : "border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* Player Avatar */}
                    <div className="relative">
                      <PlayerAvatar 
                        name={player.name} 
                        teamColor={userTeam.cor1}
                        size="lg" 
                      />
                      <div className={cn(
                        "absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-md border",
                        positionColors[player.position]
                      )}>
                        <span className="text-[10px] font-bold">{player.position}</span>
                      </div>
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium text-white truncate">{player.name}</h3>
                        <span className={cn("text-xl font-bold", getOverallColor(player.overall))}>
                          {player.overall}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
                        <span className={cn(player.age >= RETIREMENT_WARNING_AGE && "text-amber-400")}>
                          {player.age} anos
                          {player.age >= RETIREMENT_WARNING_AGE && (
                            <AlertTriangle className="inline h-3 w-3 ml-1" />
                          )}
                        </span>
                        <span className="text-white/20">|</span>
                        <span>{formatValue(player.value)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#1db954] to-[#1ed760] rounded-full"
                            style={{ width: `${player.overall}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-white/40 ml-1">POT {player.potential}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {filteredPlayers.length === 0 && (
              <div className="rounded-xl bg-[#141414] border border-white/5 p-12 text-center">
                <Users className="h-12 w-12 mx-auto text-white/20 mb-4" />
                <h3 className="font-semibold text-white">Nenhum jogador encontrado</h3>
                <p className="text-sm text-white/50 mt-2">
                  Ajuste os filtros ou busque por outro nome
                </p>
              </div>
            )}
          </section>

          {/* Player Detail */}
          <section className="space-y-4">
            <div className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
              {/* Player Header */}
              <div 
                className="relative p-6"
                style={{
                  background: `linear-gradient(135deg, ${userTeam.cor1}40, ${userTeam.cor2}20)`
                }}
              >
                <div className="absolute top-4 right-4">
                  <span className={cn("text-5xl font-bold", getOverallColor(selectedPlayer.overall))}>
                    {selectedPlayer.overall}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <PlayerAvatar 
                    name={selectedPlayer.name} 
                    teamColor={userTeam.cor1}
                    size="xl" 
                    className="rounded-2xl"
                  />
                  <div>
                    <div className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border",
                      positionColors[selectedPlayer.position]
                    )}>
                      {selectedPlayer.position}
                    </div>
                    <h2 className="mt-1 text-2xl font-bold text-white">{selectedPlayer.name}</h2>
                    <div className="flex items-center gap-2 mt-1 text-sm text-white/60">
                      <span>{selectedPlayer.age} anos</span>
                      <span className="text-white/30">|</span>
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

                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Valor de mercado</span>
                    <span className="font-medium text-[#1db954]">{formatValue(selectedPlayer.value)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-white/60">Potencial</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-lg font-bold", getOverallColor(selectedPlayer.potential))}>
                        {selectedPlayer.potential}
                      </span>
                      {selectedPlayer.potential > selectedPlayer.overall && (
                        <TrendingUp className="h-4 w-4 text-[#1db954]" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                onClick={() => setTrainingOpen(true)}
                className="border-white/10 text-white/70 hover:text-white hover:bg-white/10"
              >
                Treinar
              </Button>
              <Button 
                variant="outline"
                onClick={() => setNegotiationOpen(true)}
                className="border-white/10 text-white/70 hover:text-white hover:bg-white/10"
              >
                Negociar
              </Button>
            </div>

            {/* Retirement Warning */}
            {canRetire && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-amber-400">Proximo da Aposentadoria</h4>
                    <p className="text-xs text-white/50 mt-1">
                      {selectedPlayer.name} tem {selectedPlayer.age} anos e pode se aposentar em breve.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetirePlayer(selectedPlayer)}
                      className="mt-3 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                    >
                      <Clock className="mr-2 h-3.5 w-3.5" />
                      Aposentar Jogador
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <MusicPlayer />

      {/* Modals */}
      <TrainingModal
        open={trainingOpen}
        onOpenChange={setTrainingOpen}
        player={selectedPlayer}
        onConfirm={handleTrainingConfirm}
      />

      <NegotiationModal
        open={negotiationOpen}
        onOpenChange={setNegotiationOpen}
        player={selectedPlayer ? {
          id: selectedPlayer.id,
          name: selectedPlayer.name,
          position: selectedPlayer.position,
          overall: selectedPlayer.overall,
          value: selectedPlayer.value,
        } : null}
        type="sell"
      />

      <FilterModal
        open={filterModalOpen}
        onOpenChange={setFilterModalOpen}
        filters={filters}
        onApply={setFilters}
        type="player"
      />

      {/* Retirement Modal */}
      <Dialog open={retirementModalOpen} onOpenChange={setRetirementModalOpen}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {retired ? (
                <>
                  <Check className="h-5 w-5 text-[#1db954]" />
                  Aposentadoria Confirmada
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-amber-400" />
                  Aposentar Jogador
                </>
              )}
            </DialogTitle>
            {!retired && (
              <DialogDescription className="text-white/50">
                Confirme a aposentadoria do jogador
              </DialogDescription>
            )}
          </DialogHeader>
          
          {retired ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex justify-center">
                {playerToRetire && (
                  <PlayerAvatar 
                    name={playerToRetire.name} 
                    teamColor="#1db954"
                    size="xl" 
                    className="rounded-full"
                  />
                )}
              </div>
              <h3 className="text-lg font-semibold text-white">{playerToRetire?.name}</h3>
              <p className="text-sm text-white/50 mt-2">
                Encerrou sua carreira apos {playerToRetire?.age} anos de idade.
              </p>
              <p className="text-xs text-white/40 mt-1">
                Obrigado pelos servicos prestados ao clube!
              </p>
            </div>
          ) : (
            <>
              <div className="py-4">
                {playerToRetire && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                    <PlayerAvatar 
                      name={playerToRetire.name} 
                      teamColor={userTeam.cor1}
                      size="lg" 
                    />
                    <div>
                      <h3 className="font-medium text-white">{playerToRetire.name}</h3>
                      <p className="text-sm text-white/50">{playerToRetire.position} - {playerToRetire.age} anos</p>
                      <p className="text-xs text-white/40 mt-1">Overall: {playerToRetire.overall}</p>
                    </div>
                  </div>
                )}
                <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-400">
                    <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                    Esta acao e irreversivel. O jogador sera removido permanentemente do elenco.
                  </p>
                </div>
              </div>
              
              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setRetirementModalOpen(false)}
                  className="border-white/10 text-white/70"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={confirmRetirement}
                  className="bg-amber-500 text-black hover:bg-amber-400"
                >
                  Confirmar Aposentadoria
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
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
    if (val >= 80) return "text-[#1db954]"
    if (val >= 70) return "text-yellow-500"
    if (val >= 60) return "text-white"
    return "text-white/60"
  }

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-widest text-white/40 mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("text-xl font-bold", getStatColor(value))}>{value}</span>
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#1db954] to-[#1ed760] rounded-full transition-all"
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    </div>
  )
}
