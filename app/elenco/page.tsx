"use client"

import { useState, useMemo, memo } from "react"
import Link from "next/link"
import {
  ChevronRight,
  Filter,
  Search,
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
  Heart,
  Activity,
  Siren,
  Ban,
  FileText,
  Dumbbell,
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
import { cn } from "@/lib/utils"
import { PlayerAvatar } from "@/components/player-avatar"
import { useUserTeam } from "@/lib/save-system"
import { useCareerData } from "@/hooks/use-career-data"
import { type PlayerCareerData, INJURY_LABELS, canPlayerPlay, calculateEffectiveOverall } from "@/lib/season-system"

// Retirement age threshold
const RETIREMENT_WARNING_AGE = 34

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

function formatSalary(weekly: number) {
  const monthly = weekly * 4
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(monthly) + "/mes"
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

// Player card memoizado para performance
const PlayerCard = memo(function PlayerCard({
  player,
  isSelected,
  teamColor,
  onClick,
}: {
  player: PlayerCareerData
  isSelected: boolean
  teamColor: string
  onClick: () => void
}) {
  const { canPlay, reason } = canPlayerPlay(player)
  const effectiveOverall = calculateEffectiveOverall(player)
  
  // Calcula valor de mercado baseado no overall e idade
  const marketValue = Math.floor(
    (player.overall * player.overall * 500) * 
    (player.age < 25 ? 1.3 : player.age > 30 ? 0.7 : 1)
  )

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl bg-[#141414] border p-4 text-left transition-all",
        isSelected 
          ? "border-[#1db954] ring-1 ring-[#1db954]" 
          : "border-white/5 hover:border-white/10",
        !canPlay && "opacity-60"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Player Avatar */}
        <div className="relative">
          <PlayerAvatar 
            name={player.name} 
            teamColor={teamColor}
            size="lg" 
          />
          <div className={cn(
            "absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-md border",
            positionColors[player.position] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
          )}>
            <span className="text-[10px] font-bold">{player.position}</span>
          </div>
          
          {/* Status indicators */}
          {player.injury && (
            <div className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
              <Siren className="h-3 w-3" />
            </div>
          )}
          {player.suspension && (
            <div className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white">
              <Ban className="h-3 w-3" />
            </div>
          )}
        </div>

        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-white truncate">{player.name}</h3>
            <span className={cn("text-xl font-bold", getOverallColor(effectiveOverall))}>
              {effectiveOverall}
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
            <span>{formatValue(marketValue)}</span>
          </div>
          
          {/* Status bars */}
          <div className="mt-2 grid grid-cols-2 gap-1">
            <div className="flex items-center gap-1">
              <Heart className="h-3 w-3 text-red-400" />
              <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    player.condition > 70 ? "bg-[#1db954]" : player.condition > 40 ? "bg-yellow-400" : "bg-red-400"
                  )}
                  style={{ width: `${player.condition}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-blue-400" />
              <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    player.morale > 70 ? "bg-[#1db954]" : player.morale > 40 ? "bg-yellow-400" : "bg-red-400"
                  )}
                  style={{ width: `${player.morale}%` }}
                />
              </div>
            </div>
          </div>

          {/* Injury/Suspension indicator */}
          {!canPlay && (
            <div className="mt-2 text-[10px] text-red-400 truncate">
              {reason}
            </div>
          )}
        </div>
      </div>
    </button>
  )
})

export default function ElencoPage() {
  const { team: userTeam, hydrated: teamHydrated } = useUserTeam()
  const { 
    players, 
    teamMorale,
    setTrainingFocus,
    getInjuredPlayers,
    getSuspendedPlayers,
    getExpiringContracts,
    getWeeklySalaryBill,
    getSquadAverageOverall,
    hydrated: careerHydrated,
  } = useCareerData()

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [trainingOpen, setTrainingOpen] = useState(false)
  const [negotiationOpen, setNegotiationOpen] = useState(false)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [retirementModalOpen, setRetirementModalOpen] = useState(false)
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

  const selectedPlayer = useMemo(() => 
    players.find(p => p.playerId === selectedPlayerId) || players[0],
    [players, selectedPlayerId]
  )

  const filteredPlayers = useMemo(() => {
    return players.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchesTab = filter === "all" || 
        (filter === "gol" && p.position === "GOL") ||
        (filter === "def" && ["ZAG", "LD", "LE"].includes(p.position)) ||
        (filter === "mei" && ["VOL", "MEI"].includes(p.position)) ||
        (filter === "ata" && ["PD", "PE", "ATA"].includes(p.position)) ||
        (filter === "injured" && p.injury !== null) ||
        (filter === "suspended" && p.suspension !== null)
      const matchesPosition = filters.positions.length === 0 || filters.positions.includes(p.position)
      const matchesOverall = p.overall >= filters.minOverall && p.overall <= filters.maxOverall
      const matchesAge = p.age >= filters.minAge && p.age <= filters.maxAge
      return matchesSearch && matchesTab && matchesPosition && matchesOverall && matchesAge
    })
  }, [players, search, filter, filters])

  const handleTrainingConfirm = (attribute: string) => {
    if (selectedPlayer) {
      setTrainingFocus(selectedPlayer.playerId, attribute as PlayerCareerData["trainingFocus"])
    }
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.positions.length > 0) count++
    if (filters.minOverall > 0 || filters.maxOverall < 99) count++
    if (filters.minAge > 16 || filters.maxAge < 45) count++
    return count
  }, [filters])

  // Stats do elenco
  const injuredCount = getInjuredPlayers().length
  const suspendedCount = getSuspendedPlayers().length
  const expiringCount = getExpiringContracts().length
  const squadAverage = getSquadAverageOverall()
  const salaryBill = getWeeklySalaryBill()

  const confirmRetirement = () => {
    // No sistema real, isso removeria o jogador
    setRetired(true)
    setTimeout(() => {
      setRetirementModalOpen(false)
      setRetired(false)
    }, 1500)
  }

  if (!teamHydrated || !careerHydrated) {
    return (
      <div className="min-h-screen pl-[72px] bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white/50">Carregando elenco...</div>
      </div>
    )
  }

  const { canPlay: selectedCanPlay, reason: selectedReason } = selectedPlayer 
    ? canPlayerPlay(selectedPlayer) 
    : { canPlay: true, reason: undefined }

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
                <p className="text-sm text-white/50 mt-1">
                  {players.length} jogadores - Media OVR {squadAverage}
                </p>
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

            {/* Squad Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-[#141414] border border-white/5 p-3">
                <div className="flex items-center gap-2 text-[10px] text-white/40 font-medium tracking-wider">
                  <Activity className="h-3.5 w-3.5 text-[#1db954]" />
                  MORAL
                </div>
                <div className="mt-1 text-lg font-semibold text-white">{teamMorale}%</div>
              </div>
              <div className="rounded-lg bg-[#141414] border border-white/5 p-3">
                <div className="flex items-center gap-2 text-[10px] text-white/40 font-medium tracking-wider">
                  <Siren className="h-3.5 w-3.5 text-red-400" />
                  LESIONADOS
                </div>
                <div className={cn("mt-1 text-lg font-semibold", injuredCount > 0 ? "text-red-400" : "text-white")}>
                  {injuredCount}
                </div>
              </div>
              <div className="rounded-lg bg-[#141414] border border-white/5 p-3">
                <div className="flex items-center gap-2 text-[10px] text-white/40 font-medium tracking-wider">
                  <Ban className="h-3.5 w-3.5 text-orange-400" />
                  SUSPENSOS
                </div>
                <div className={cn("mt-1 text-lg font-semibold", suspendedCount > 0 ? "text-orange-400" : "text-white")}>
                  {suspendedCount}
                </div>
              </div>
              <div className="rounded-lg bg-[#141414] border border-white/5 p-3">
                <div className="flex items-center gap-2 text-[10px] text-white/40 font-medium tracking-wider">
                  <FileText className="h-3.5 w-3.5 text-yellow-400" />
                  CONTRATOS
                </div>
                <div className={cn("mt-1 text-lg font-semibold", expiringCount > 0 ? "text-yellow-400" : "text-white")}>
                  {expiringCount} exp.
                </div>
              </div>
            </div>

            {/* Position Filter */}
            <Tabs value={filter} onValueChange={setFilter} className="w-full">
              <TabsList className="bg-[#1a1a1a] border border-white/10 p-1 h-auto flex-wrap">
                <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-3 py-2">Todos</TabsTrigger>
                <TabsTrigger value="gol" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-3 py-2">GOL</TabsTrigger>
                <TabsTrigger value="def" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-3 py-2">DEF</TabsTrigger>
                <TabsTrigger value="mei" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-3 py-2">MEI</TabsTrigger>
                <TabsTrigger value="ata" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-3 py-2">ATA</TabsTrigger>
                {injuredCount > 0 && (
                  <TabsTrigger value="injured" className="text-xs data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400 text-red-400/50 px-3 py-2">
                    Lesionados ({injuredCount})
                  </TabsTrigger>
                )}
                {suspendedCount > 0 && (
                  <TabsTrigger value="suspended" className="text-xs data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-orange-400/50 px-3 py-2">
                    Suspensos ({suspendedCount})
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>

            {/* Players Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredPlayers.map((player) => (
                <PlayerCard
                  key={player.playerId}
                  player={player}
                  isSelected={selectedPlayer?.playerId === player.playerId}
                  teamColor={userTeam.cor1}
                  onClick={() => setSelectedPlayerId(player.playerId)}
                />
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
          {selectedPlayer && (
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
                      {calculateEffectiveOverall(selectedPlayer)}
                    </span>
                    {selectedPlayer.overall !== calculateEffectiveOverall(selectedPlayer) && (
                      <div className="text-right text-xs text-white/40 mt-1">
                        Base: {selectedPlayer.overall}
                      </div>
                    )}
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
                        positionColors[selectedPlayer.position] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
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
                  {/* Condition bars */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-white/40 font-medium tracking-wider flex items-center gap-1">
                          <Heart className="h-3 w-3 text-red-400" />
                          CONDICAO
                        </span>
                        <span className={cn(
                          "text-sm font-bold",
                          selectedPlayer.condition > 70 ? "text-[#1db954]" : selectedPlayer.condition > 40 ? "text-yellow-400" : "text-red-400"
                        )}>
                          {selectedPlayer.condition}%
                        </span>
                      </div>
                      <Progress value={selectedPlayer.condition} className="h-1.5" />
                    </div>
                    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-white/40 font-medium tracking-wider flex items-center gap-1">
                          <Activity className="h-3 w-3 text-blue-400" />
                          MORAL
                        </span>
                        <span className={cn(
                          "text-sm font-bold",
                          selectedPlayer.morale > 70 ? "text-[#1db954]" : selectedPlayer.morale > 40 ? "text-yellow-400" : "text-red-400"
                        )}>
                          {selectedPlayer.morale}%
                        </span>
                      </div>
                      <Progress value={selectedPlayer.morale} className="h-1.5" />
                    </div>
                  </div>

                  {/* Attributes */}
                  <div className="grid grid-cols-2 gap-3">
                    <StatItem icon={Zap} label="RITMO" value={selectedPlayer.currentAttributes.pace} />
                    <StatItem icon={Target} label="FINALIZACAO" value={selectedPlayer.currentAttributes.shooting} />
                    <StatItem icon={Footprints} label="PASSE" value={selectedPlayer.currentAttributes.passing} />
                    <StatItem icon={Star} label="DRIBLE" value={selectedPlayer.currentAttributes.dribbling} />
                    <StatItem icon={Shield} label="DEFESA" value={selectedPlayer.currentAttributes.defending} />
                    <StatItem icon={TrendingUp} label="FISICO" value={selectedPlayer.currentAttributes.physical} />
                  </div>

                  {/* Contract info */}
                  <div className="pt-4 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Salario</span>
                      <span className="font-medium text-white">{formatSalary(selectedPlayer.contract.weeklySalary)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Contrato expira em</span>
                      <span className={cn(
                        "font-medium",
                        selectedPlayer.contract.weeksRemaining <= 26 ? "text-yellow-400" : "text-white"
                      )}>
                        {Math.floor(selectedPlayer.contract.weeksRemaining / 52)} ano(s)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
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
                    {selectedPlayer.trainingFocus && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Foco de treino</span>
                        <span className="font-medium text-primary capitalize">{selectedPlayer.trainingFocus}</span>
                      </div>
                    )}
                  </div>

                  {/* Season stats */}
                  <div className="pt-4 border-t border-white/10">
                    <div className="text-[10px] text-white/40 font-medium tracking-wider mb-3">ESTATISTICAS DA TEMPORADA</div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-lg font-bold text-white">{selectedPlayer.stats.matchesPlayed}</div>
                        <div className="text-[9px] text-white/40">JOGOS</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-lg font-bold text-[#1db954]">{selectedPlayer.stats.goals}</div>
                        <div className="text-[9px] text-white/40">GOLS</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-lg font-bold text-blue-400">{selectedPlayer.stats.assists}</div>
                        <div className="text-[9px] text-white/40">ASSIS</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-lg font-bold text-yellow-400">
                          {selectedPlayer.stats.avgRating.toFixed(1)}
                        </div>
                        <div className="text-[9px] text-white/40">MEDIA</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status alerts */}
              {!selectedCanPlay && (
                <div className={cn(
                  "rounded-xl border p-4",
                  selectedPlayer.injury ? "bg-red-500/10 border-red-500/20" : "bg-orange-500/10 border-orange-500/20"
                )}>
                  <div className="flex items-start gap-3">
                    {selectedPlayer.injury ? (
                      <Siren className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <Ban className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className={cn(
                        "text-sm font-medium",
                        selectedPlayer.injury ? "text-red-400" : "text-orange-400"
                      )}>
                        {selectedPlayer.injury ? "Lesionado" : "Suspenso"}
                      </h4>
                      <p className="text-xs text-white/50 mt-1">
                        {selectedReason}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setTrainingOpen(true)}
                  disabled={!!selectedPlayer.injury}
                  className="border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Dumbbell className="mr-2 h-4 w-4" />
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
              {selectedPlayer.age >= RETIREMENT_WARNING_AGE && (
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
                        onClick={() => setRetirementModalOpen(true)}
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
          )}
        </div>
      </main>

      <MusicPlayer />

      {/* Modals */}
      <TrainingModal
        open={trainingOpen}
        onOpenChange={setTrainingOpen}
        player={selectedPlayer ? {
          id: 0,
          name: selectedPlayer.name,
          position: selectedPlayer.position,
          age: selectedPlayer.age,
          overall: selectedPlayer.overall,
          potential: selectedPlayer.potential,
          value: 0,
          pace: selectedPlayer.currentAttributes.pace,
          shooting: selectedPlayer.currentAttributes.shooting,
          passing: selectedPlayer.currentAttributes.passing,
          dribbling: selectedPlayer.currentAttributes.dribbling,
          defending: selectedPlayer.currentAttributes.defending,
          physical: selectedPlayer.currentAttributes.physical,
        } : null}
        onConfirm={handleTrainingConfirm}
      />

      <NegotiationModal
        open={negotiationOpen}
        onOpenChange={setNegotiationOpen}
        player={selectedPlayer ? {
          id: 0,
          name: selectedPlayer.name,
          position: selectedPlayer.position,
          overall: selectedPlayer.overall,
          value: Math.floor((selectedPlayer.overall * selectedPlayer.overall * 500) * (selectedPlayer.age < 25 ? 1.3 : selectedPlayer.age > 30 ? 0.7 : 1)),
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
                {selectedPlayer && (
                  <PlayerAvatar 
                    name={selectedPlayer.name} 
                    teamColor="#1db954"
                    size="xl" 
                    className="rounded-full"
                  />
                )}
              </div>
              <h3 className="text-lg font-semibold text-white">{selectedPlayer?.name}</h3>
              <p className="text-sm text-white/50 mt-2">
                Encerrou sua carreira apos {selectedPlayer?.age} anos de idade.
              </p>
              <p className="text-xs text-white/40 mt-1">
                Obrigado pelos servicos prestados ao clube!
              </p>
            </div>
          ) : (
            <>
              <div className="py-4">
                {selectedPlayer && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                    <PlayerAvatar 
                      name={selectedPlayer.name} 
                      teamColor={userTeam.cor1}
                      size="lg" 
                    />
                    <div>
                      <h3 className="font-medium text-white">{selectedPlayer.name}</h3>
                      <p className="text-sm text-white/50">{selectedPlayer.position} - {selectedPlayer.age} anos</p>
                      <p className="text-xs text-white/40 mt-1">Overall: {selectedPlayer.overall}</p>
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
