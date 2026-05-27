"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Search,
  User,
  ArrowLeftRight,
  Trophy,
  Shield,
  Flag,
  ChevronLeft,
  ChevronRight,
  Star,
  AlertCircle,
  Globe,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { NegotiationModal } from "@/components/modals/negotiation-modal"
import { serieATeams, formatCurrency } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { useGameEngine, type Player as EnginePlayer } from "@/lib/game-engine"
import { useDiscordActivity } from "@/hooks/use-discord-rpc"
import { PlayerAvatar } from "@/components/player-avatar"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Mock transfer targets
const palTeam = serieATeams[1]
const flaTeam = serieATeams[2]
const corTeam = serieATeams[6]
const saoTeam = serieATeams[5]

const transferTargets = [
  { 
    id: 1, name: "Gabriel Veron", team: palTeam, position: "ATA", secondaryPositions: ["PD", "PE"], 
    age: 21, overall: 78, potential: 88, value: 18000000, trend: "up" as const,
    nationality: "Brasil", height: "175 cm", weight: "68 kg", foot: "D",
    stats: { pace: 88, shooting: 76, passing: 62, dribbling: 84, defense: 42, physical: 56 },
    releaseClause: 45000000, scoutedBy: "Ricardo Silva", scoutProgress: 85
  },
  { 
    id: 2, name: "Gustavo Scarpa", team: palTeam, position: "MEI", secondaryPositions: ["ME", "MD"], 
    age: 30, overall: 81, potential: 81, value: 12000000, trend: "down" as const,
    nationality: "Brasil", height: "180 cm", weight: "72 kg", foot: "E",
    stats: { pace: 72, shooting: 78, passing: 82, dribbling: 80, defense: 58, physical: 65 },
    releaseClause: 30000000, scoutedBy: null, scoutProgress: 0
  },
  { 
    id: 3, name: "Bruno Henrique", team: flaTeam, position: "PE", secondaryPositions: ["ATA", "PD"], 
    age: 33, overall: 80, potential: 80, value: 8000000, trend: "down" as const,
    nationality: "Brasil", height: "182 cm", weight: "74 kg", foot: "D",
    stats: { pace: 85, shooting: 79, passing: 68, dribbling: 78, defense: 35, physical: 72 },
    releaseClause: 20000000, scoutedBy: "Matty Bailey", scoutProgress: 100
  },
  { 
    id: 4, name: "Yuri Alberto", team: corTeam, position: "ATA", secondaryPositions: ["PE", "PD"], 
    age: 23, overall: 79, potential: 86, value: 22000000, trend: "up" as const,
    nationality: "Brasil", height: "184 cm", weight: "78 kg", foot: "D",
    stats: { pace: 82, shooting: 80, passing: 58, dribbling: 75, defense: 38, physical: 78 },
    releaseClause: 55000000, scoutedBy: "Matty Bailey", scoutProgress: 45
  },
  { 
    id: 5, name: "Luciano", team: saoTeam, position: "ATA", secondaryPositions: ["MEI"], 
    age: 30, overall: 80, potential: 80, value: 15000000, trend: "stable" as const,
    nationality: "Brasil", height: "178 cm", weight: "71 kg", foot: "D",
    stats: { pace: 78, shooting: 82, passing: 70, dribbling: 77, defense: 42, physical: 68 },
    releaseClause: 38000000, scoutedBy: null, scoutProgress: 0
  },
  { 
    id: 6, name: "Dudu", team: palTeam, position: "PE", secondaryPositions: ["PD", "MEI"], 
    age: 32, overall: 82, potential: 82, value: 10000000, trend: "down" as const,
    nationality: "Brasil", height: "165 cm", weight: "62 kg", foot: "D",
    stats: { pace: 84, shooting: 75, passing: 78, dribbling: 86, defense: 40, physical: 58 },
    releaseClause: 25000000, scoutedBy: "Ricardo Silva", scoutProgress: 100
  },
  { 
    id: 7, name: "Raphael Veiga", team: palTeam, position: "MEI", secondaryPositions: ["ME"], 
    age: 29, overall: 83, potential: 83, value: 25000000, trend: "up" as const,
    nationality: "Brasil", height: "176 cm", weight: "70 kg", foot: "D",
    stats: { pace: 70, shooting: 84, passing: 83, dribbling: 82, defense: 52, physical: 62 },
    releaseClause: 62000000, scoutedBy: "Matty Bailey", scoutProgress: 20
  },
  { 
    id: 8, name: "Arrascaeta", team: flaTeam, position: "MEI", secondaryPositions: ["ME", "ATA"], 
    age: 30, overall: 85, potential: 85, value: 30000000, trend: "stable" as const,
    nationality: "Uruguai", height: "172 cm", weight: "68 kg", foot: "D",
    stats: { pace: 72, shooting: 82, passing: 86, dribbling: 88, defense: 45, physical: 60 },
    releaseClause: 75000000, scoutedBy: null, scoutProgress: 0
  },
]

// Mock scouts
const scouts = [
  { id: 1, name: "Dan Burrows", nationality: "Inglaterra", area: "Area Scouting", assigned: 15, stars: 4 },
  { id: 2, name: "Liam Atkins", nationality: "Inglaterra", area: "Area Scouting", assigned: 0, stars: 5 },
  { id: 3, name: "Sean Rowley", nationality: "Inglaterra", area: "Area Scouting", assigned: 0, stars: 4 },
  { id: 4, name: "Bastien Favre", nationality: "Suica", area: "Scout Available", assigned: 0, stars: 4 },
  { id: 5, name: "Marek Bosko", nationality: "Republica Tcheca", area: "Scout Available", assigned: 0, stars: 5 },
]

type Player = typeof transferTargets[0]

// Filter card types
type FilterType = "nome" | "posicao" | "nacionalidade" | "status" | "idade" | "pais" | "liga" | "time"

interface FilterCard {
  id: FilterType
  label: string
  icon: React.ReactNode
  value: string
}

function marketPlayerToEnginePlayer(p: Player): EnginePlayer {
  return {
    id: p.id + 9000,
    name: p.name,
    position: p.position,
    age: p.age,
    overall: p.overall,
    potential: p.potential,
    nationality: p.nationality,
    pace: p.stats?.pace ?? 70,
    shooting: p.stats?.shooting ?? 65,
    passing: p.stats?.passing ?? 65,
    dribbling: p.stats?.dribbling ?? 65,
    defending: p.stats?.defense ?? 55,
    physical: p.stats?.physical ?? 65,
    energy: 100,
    morale: "Normal" as const,
    form: p.overall,
    contract: { salary: Math.round(p.overall * 800), endDate: 52, releaseClause: p.releaseClause ?? null, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: p.value,
    joinedClubWeek: 0,
    joinedClubSeason: 2026,
    isLoanedIn: false,
    isStarter: false,
  }
}

export default function MercadoPage() {
  const { team: userTeam } = useUserTeam()
  const t = useTranslation()
  const { buyPlayer, loanPlayer } = useGameEngine()

  useDiscordActivity("No mercado de transferências", userTeam.nome)

  const [activeTab, setActiveTab] = useState("buscar")
  const [selectedFilter, setSelectedFilter] = useState<FilterType | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [negotiationOpen, setNegotiationOpen] = useState(false)
  const [negotiationType, setNegotiationType] = useState<"buy" | "loan">("buy")
  const [positionFilter, setPositionFilter] = useState<string>("Tudo")

  // Filter states
  const [nameFilter, setNameFilter] = useState("")
  const [selectedPosition] = useState("Tudo")
  const [minAge] = useState(16)
  const [maxAge] = useState(35)

  // Search input state for real-time filtering
  const [searchQuery, setSearchQuery] = useState("")

  // Filter cards for search
  const filterCards: FilterCard[] = [
    { id: "nome", label: t.market.name, icon: <User className="h-10 w-10 text-white/30" />, value: t.market.any },
    { id: "posicao", label: t.market.position, icon: null, value: t.market.any },
    { id: "nacionalidade", label: t.market.nationality, icon: <Flag className="h-10 w-10 text-white/30" />, value: t.market.any },
    { id: "status", label: t.market.transferStatus, icon: <ArrowLeftRight className="h-10 w-10 text-white/30" />, value: t.market.any },
    { id: "idade", label: t.market.age, icon: null, value: "16 - 35" },
    { id: "pais", label: t.market.countryRegion, icon: <Flag className="h-8 w-8 text-white/30" />, value: t.market.any },
    { id: "liga", label: t.market.league, icon: <Trophy className="h-10 w-10 text-white/30" />, value: t.market.any },
    { id: "time", label: t.market.team, icon: <Shield className="h-12 w-12 text-white/20" />, value: t.market.any },
  ]

  // Filter players by all criteria
  const filteredPlayers = useMemo(() => {
    return transferTargets.filter(p => {
      // Name filter (uses searchQuery for real-time search)
      const searchTerm = searchQuery || nameFilter
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      // Position filter
      if (selectedPosition !== "Tudo" && p.position !== selectedPosition && !p.secondaryPositions?.includes(selectedPosition)) {
        return false
      }
      // Age filter
      if (p.age < minAge || p.age > maxAge) {
        return false
      }
      // Position filter for "rede" tab
      if (positionFilter !== "Tudo" && p.position !== positionFilter && !p.secondaryPositions?.includes(positionFilter)) {
        return false
      }
      return true
    })
  }, [nameFilter, searchQuery, selectedPosition, minAge, maxAge, positionFilter])
  
  // Auto-select first player when filtered results change
  useEffect(() => {
    if (filteredPlayers.length > 0 && !selectedPlayer) {
      setSelectedPlayer(filteredPlayers[0])
    }
  }, [filteredPlayers, selectedPlayer])

  // Gamepad support
  useEffect(() => {
    const TABS = ["buscar", "rede", "olheiros"]

    const handler = (e: Event) => {
      const { button } = (e as CustomEvent).detail

      if (button === "B") {
        if (negotiationOpen) { setNegotiationOpen(false); return }
        window.history.back()
        return
      }

      if (button === "LB" || button === "RB") {
        const idx = TABS.indexOf(activeTab)
        const next = button === "LB" ? Math.max(0, idx - 1) : Math.min(TABS.length - 1, idx + 1)
        setActiveTab(TABS[next])
        return
      }

      if (activeTab === "rede") {
        if (button === "DPad_Up" || button === "DPad_Down") {
          const cur = selectedPlayer ? filteredPlayers.findIndex(p => p.id === selectedPlayer.id) : -1
          const next = button === "DPad_Up" ? Math.max(0, cur - 1) : Math.min(filteredPlayers.length - 1, cur + 1)
          if (filteredPlayers[next]) setSelectedPlayer(filteredPlayers[next])
          return
        }
        if (button === "A") { handleNegotiate("buy"); return }
        if (button === "X") { handleNegotiate("loan"); return }
      }

      if (activeTab === "buscar" && button === "A") { handleSearch(); return }
    }

    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, negotiationOpen, filteredPlayers, selectedPlayer])

  // Group players by position type
  const groupedPlayers = useMemo(() => {
    const groups: Record<string, Player[]> = {
      "Ataque": [],
      "Meio": [],
      "Defesa": []
    }
    
    filteredPlayers.forEach(player => {
      if (["ATA", "PE", "PD"].includes(player.position)) {
        groups["Ataque"].push(player)
      } else if (["MEI", "ME", "MD", "VOL"].includes(player.position)) {
        groups["Meio"].push(player)
      } else {
        groups["Defesa"].push(player)
      }
    })
    
    return groups
  }, [filteredPlayers])

  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player)
  }

  const handleNegotiate = (type: "buy" | "loan" = "buy") => {
    if (selectedPlayer) {
      setNegotiationType(type)
      setNegotiationOpen(true)
    }
  }

  const handleSearch = () => {
    setActiveTab("rede")
  }

  return (
    <div className="h-screen overflow-hidden pl-16 bg-[#050508]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="p-4 h-[calc(100vh-48px)] overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* EA FC Style Header Navigation */}
          <div className="flex items-center gap-6 mb-8">
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <span className="text-xs border border-white/20 rounded px-1.5 py-0.5">w</span>
              <span>Transferencias</span>
            </div>
            
            <TabsList className="bg-transparent border-0 p-0 h-auto gap-6">
              <TabsTrigger
                value="buscar"
                className="bg-transparent border-0 px-0 py-0 text-lg font-semibold data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
              >
                {t.market.searchAthletes}
              </TabsTrigger>
              <span className="text-white/20">|</span>
              <TabsTrigger
                value="rede"
                className="bg-transparent border-0 px-0 py-0 text-base data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
              >
                {t.market.transferNetwork}
              </TabsTrigger>
              <span className="text-white/20">|</span>
              <TabsTrigger
                value="olheiros"
                className="bg-transparent border-0 px-0 py-0 text-base data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
              >
                {t.market.scouts}
              </TabsTrigger>
              <span className="text-white/20">|</span>
              <TabsTrigger
                value="central"
                className="bg-transparent border-0 px-0 py-0 text-base data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
              >
                Central de Transf.
              </TabsTrigger>
              <span className="text-white/20">|</span>
              <TabsTrigger
                value="enviadas"
                className="bg-transparent border-0 px-0 py-0 text-base data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
              >
                Propostas Enviadas
              </TabsTrigger>
              <span className="text-white/20">|</span>
              <TabsTrigger
                value="recebidas"
                className="bg-transparent border-0 px-0 py-0 text-base data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
              >
                Propostas Recebidas
              </TabsTrigger>
            </TabsList>

            <div className="ml-auto flex items-center gap-4">
              <span className="text-sm text-white/40">{t.market.searchFilters}</span>
            </div>
          </div>

          {/* Search Filters Tab */}
          <TabsContent value="buscar" className="mt-0">
            {/* Search Input */}
            <div className="mb-6 flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                <input
                  type="text"
                  placeholder={t.market.searchByName}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setNameFilter(searchQuery)
                      handleSearch()
                    }
                  }}
                  className="w-full pl-12 pr-12 py-3 rounded-xl bg-[#1a1a1a] border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setNameFilter("")
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={handleSearch}
                className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Buscar
              </button>
            </div>
            
            {/* Quick search results preview */}
            {searchQuery.length >= 2 && filteredPlayers.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-[#1a1a1a] border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-white/60">{t.market.playersFound(filteredPlayers.length)}</span>
                  <button
                    onClick={handleSearch}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    {t.market.viewInNetwork}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {filteredPlayers.slice(0, 4).map((player) => (
                    <button
                      key={player.id}
                      onClick={() => {
                        setSelectedPlayer(player)
                        setActiveTab("rede")
                      }}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-left group"
                    >
                      <PlayerAvatar name={player.name} teamColor={player.team.cor1} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate group-hover:text-primary transition-colors">
                          {player.name}
                        </div>
                        <div className="text-[10px] text-white/40">{player.position} - {player.age} anos</div>
                      </div>
                      <span className="text-sm font-bold text-[#ffd700]">{player.overall}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-4">
              {/* First Row */}
              <FilterCardComponent 
                card={filterCards[0]} 
                selected={selectedFilter === "nome"}
                onClick={() => setSelectedFilter("nome")}
                customContent={
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-b from-white/10 to-white/5 flex items-center justify-center">
                        <User className="h-10 w-10 text-white/30" strokeWidth={1.5} />
                      </div>
                    </div>
                    <span className="text-white/50 text-sm mt-3">{nameFilter || t.market.any}</span>
                  </div>
                }
              />
              <FilterCardComponent 
                card={filterCards[1]} 
                selected={selectedFilter === "posicao"}
                onClick={() => setSelectedFilter("posicao")}
                customContent={
                  <div className="flex flex-col items-center justify-center h-full gap-1">
                    <span className="text-white/50 text-sm">{t.market.any}</span>
                    <div className="font-semibold text-white text-base">{t.market.role}</div>
                    <span className="text-white/50 text-sm">{t.market.any}</span>
                  </div>
                }
              />
              <FilterCardComponent 
                card={filterCards[2]} 
                selected={selectedFilter === "nacionalidade"}
                onClick={() => setSelectedFilter("nacionalidade")}
                customContent={
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="flex gap-2 mb-3">
                      <div className="w-10 h-7 bg-gradient-to-br from-white/15 to-white/5 rounded flex items-center justify-center border border-white/10">
                        <Flag className="h-4 w-4 text-white/40" />
                      </div>
                      <div className="w-10 h-7 bg-gradient-to-br from-white/15 to-white/5 rounded flex items-center justify-center border border-white/10">
                        <Flag className="h-4 w-4 text-white/40" />
                      </div>
                    </div>
                    <span className="text-white/50 text-sm">Qualquer</span>
                  </div>
                }
              />
              <FilterCardComponent 
                card={filterCards[3]} 
                selected={selectedFilter === "status"}
                onClick={() => setSelectedFilter("status")}
                customContent={
                  <div className="flex flex-col items-center justify-center h-full">
                    <ArrowLeftRight className="h-12 w-12 text-white/30 mb-3" strokeWidth={1.5} />
                    <span className="text-white/50 text-sm">Qualquer</span>
                  </div>
                }
              />

              {/* Second Row */}
              <FilterCardComponent 
                card={filterCards[4]} 
                selected={selectedFilter === "idade"}
                onClick={() => setSelectedFilter("idade")}
                customContent={
                  <div className="flex flex-col items-start justify-center h-full px-6 gap-4">
                    <div className="flex justify-between w-full text-sm">
                      <span className="text-white/50 font-medium">MIN.</span>
                      <span className="text-white font-medium">16</span>
                    </div>
                    <div className="flex justify-between w-full text-sm">
                      <span className="text-white/50 font-medium">MAX.</span>
                      <span className="text-white font-medium">35</span>
                    </div>
                  </div>
                }
              />
              <FilterCardComponent 
                card={filterCards[5]} 
                selected={selectedFilter === "pais"}
                onClick={() => setSelectedFilter("pais")}
                customContent={
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="flex gap-2 mb-3">
                      <div className="w-10 h-7 bg-gradient-to-br from-white/15 to-white/5 rounded flex items-center justify-center border border-white/10">
                        <Globe className="h-4 w-4 text-white/40" />
                      </div>
                      <div className="w-10 h-7 bg-gradient-to-br from-white/15 to-white/5 rounded flex items-center justify-center border border-white/10">
                        <Globe className="h-4 w-4 text-white/40" />
                      </div>
                    </div>
                    <span className="text-white/50 text-sm">Qualquer</span>
                  </div>
                }
              />
              <FilterCardComponent 
                card={filterCards[6]} 
                selected={selectedFilter === "liga"}
                onClick={() => setSelectedFilter("liga")}
                customContent={
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-14 h-14 rounded-lg bg-gradient-to-b from-white/10 to-white/5 flex items-center justify-center mb-3 border border-white/10">
                      <Trophy className="h-8 w-8 text-white/30" strokeWidth={1.5} />
                    </div>
                    <span className="text-white/50 text-sm">Qualquer</span>
                  </div>
                }
              />
              <FilterCardComponent 
                card={filterCards[7]} 
                selected={selectedFilter === "time"}
                onClick={() => setSelectedFilter("time")}
                customContent={
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-b from-white/8 to-transparent flex items-center justify-center mb-3">
                      <Shield className="h-12 w-12 text-white/15" strokeWidth={1} />
                    </div>
                    <span className="text-white/40 text-sm">Qualquer</span>
                  </div>
                }
                highlight
              />
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between mt-8">
              <div className="flex items-center gap-6 text-xs text-white/50">
                <div className="flex items-center gap-2">
                  <span className="border border-white/30 rounded px-1.5 py-0.5">Enter</span>
                  <span>Selecionar Filtro</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="border border-white/30 rounded px-1.5 py-0.5">Esc</span>
                  <span>Limpar Filtros</span>
                </div>
              </div>
              <button 
                onClick={handleSearch}
                className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                {t.market.startSearch}
              </button>
            </div>
          </TabsContent>

          {/* Transfer Network Tab */}
          <TabsContent value="rede" className="mt-0">
            {/* Position Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-1 text-xs text-white/40">
                <span className="border border-white/20 rounded px-1 py-0.5">x</span>
                <span className="border border-white/20 rounded px-1 py-0.5 ml-1">c</span>
              </div>
              {["Tudo", "Detalhes", "Ata", "Mei", "Def"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPositionFilter(filter === "Ata" ? "ATA" : filter === "Mei" ? "MEI" : filter === "Def" ? "ZAG" : filter)}
                  className={cn(
                    "text-sm transition-colors",
                    positionFilter === filter || 
                    (filter === "Ata" && positionFilter === "ATA") ||
                    (filter === "Mei" && positionFilter === "MEI") ||
                    (filter === "Def" && positionFilter === "ZAG")
                      ? "text-white"
                      : "text-white/40 hover:text-white/60"
                  )}
                >
                  {filter}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-3">
                <TeamCrest team={userTeam} size="sm" />
                <span className="text-white font-medium">{userTeam.nome}</span>
                <div className="flex gap-0.5">
                  <div className="w-12 h-1 bg-green-500 rounded-full" />
                  <div className="w-12 h-1 bg-green-500 rounded-full" />
                  <div className="w-12 h-1 bg-green-500/50 rounded-full" />
                </div>
                <Star className="h-4 w-4 text-[#ffd700]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Player List */}
              <div className="space-y-4">
                {Object.entries(groupedPlayers).map(([group, players]) => (
                  players.length > 0 && (
                    <div key={group} className="rounded-xl bg-[#0c0c10]/80 border border-white/[0.04] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-semibold">{group}</h3>
                        <span className="text-xs text-white/40">{t.market.readyToPlay}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {players.map((player) => (
                          <PlayerListCard
                            key={player.id}
                            player={player}
                            selected={selectedPlayer?.id === player.id}
                            onClick={() => handlePlayerSelect(player)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>

              {/* Player Details Panel */}
              {selectedPlayer ? (
                <PlayerDetailsPanel 
                  player={selectedPlayer}
                  onNegotiate={handleNegotiate}
                />
              ) : (
                <div className="rounded-xl bg-[#0c0c10]/80 border border-white/[0.04] p-8 flex flex-col items-center justify-center text-center">
                  <User className="h-20 w-20 text-white/10 mb-4" />
                  <h3 className="text-white/40 text-lg">{t.market.selectPlayer}</h3>
                  <p className="text-white/30 text-sm mt-2">{t.market.clickForDetails}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Scouts Tab */}
          <TabsContent value="olheiros" className="mt-0">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-white font-semibold">{t.market.scouts}</span>
              <span className="text-white/20">|</span>
              <span className="text-white/40">{t.market.instructions}</span>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Scouts Grid */}
              <div className="col-span-2 grid grid-cols-3 gap-4">
                {scouts.map((scout, index) => (
                  <ScoutCard key={scout.id} scout={scout} selected={index === 4} />
                ))}
                <button className="rounded-xl bg-[#0c0c10]/50 border border-white/[0.04] p-6 flex items-center justify-center hover:border-primary/30 transition-colors">
                  <span className="text-white/60 font-medium">{t.market.hireScout}</span>
                </button>
              </div>

              {/* Info Panel */}
              <div className="space-y-4">
                <div className="rounded-xl bg-[#0c0c10]/80 border border-white/[0.04] p-6">
                  <p className="text-white/70 text-sm leading-relaxed">
                    Seus olheiros podem criar redes no mundo todo para descobrir novos nomes.
                  </p>
                  <p className="text-white/50 text-sm leading-relaxed mt-4">
                    Se quiser receber relatorios de atletas dos proximos times adversarios, deixe livre um de seus olheiros.
                  </p>
                </div>

                <div className="rounded-xl bg-[#0c0c10]/50 border border-white/[0.04] p-6">
                  <h3 className="text-white/30 text-2xl font-light mb-2">Disponivel</h3>
                  <p className="text-white/40 text-sm">This scout is ready for missions.</p>
                </div>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-0 mt-8">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">1</div>
              <div className="w-32 h-0.5 bg-primary" />
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white/40 font-bold text-sm">2</div>
              <div className="w-32 h-0.5 bg-white/10" />
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white/40 font-bold text-sm">3</div>
            </div>
          </TabsContent>

          {/* Central de Transferencias Tab */}
          <TabsContent value="central" className="mt-0">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-xs border border-white/20 rounded px-1.5 py-0.5 text-white/50">z</span>
                <span className="text-white font-semibold">Transferencia</span>
              </div>
              <span className="text-white/20">|</span>
              <span className="text-white/40">Qualidades</span>
            </div>

            <div className="grid grid-cols-2 gap-6 h-[calc(100vh-220px)]">
              {/* Left Column - Actions and Saved Lists */}
              <div className="space-y-4">
                {/* Action Cards Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Nova Escalacao Card */}
                  <button 
                    onClick={() => setActiveTab("buscar")}
                    className="relative rounded-xl p-6 h-48 text-left transition-all overflow-hidden bg-gradient-to-br from-[#1c2b2f] via-[#162224] to-[#0d1618] border border-white/[0.04] hover:border-primary/30 group"
                  >
                    <h3 className="text-white font-semibold text-lg mb-1">Nova escalacao</h3>
                    <div className="flex items-center justify-center h-[calc(100%-3rem)]">
                      <div className="w-20 h-20 rounded-full border-4 border-white/40 flex items-center justify-center group-hover:border-primary transition-colors">
                        <svg className="w-10 h-10 text-white/60 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Importar Escalacao Card */}
                  <button className="relative rounded-xl p-6 h-48 text-left transition-all overflow-hidden bg-gradient-to-br from-[#1c2b2f] via-[#162224] to-[#0d1618] border border-white/[0.04] hover:border-primary/30 group">
                    <h3 className="text-white font-semibold text-lg mb-1">Importar escalacao</h3>
                    <div className="flex items-center justify-center h-[calc(100%-3rem)]">
                      <svg className="w-16 h-16 text-white/40 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                </div>

                {/* Saved List Card */}
                <button className="relative w-full rounded-xl p-4 text-left transition-all overflow-hidden bg-gradient-to-br from-[#1c2b2f] via-[#162224] to-[#0d1618] border border-primary hover:border-primary group">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-semibold truncate">Padrao {userTeam?.curto || "TIME"}...</h3>
                      <span className="text-white/60 text-sm">4-3-3</span>
                      <span className="text-[#00ffc8] text-sm ml-2">ABERTO</span>
                    </div>
                    <button className="p-1 hover:bg-white/10 rounded transition-colors">
                      <svg className="w-4 h-4 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>
                  </div>
                  {/* Mini field preview */}
                  <div className="mt-3 h-24 bg-[#1a3d2e] rounded-lg relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 border border-white/20 rounded-full" />
                    </div>
                    {/* Mini players dots */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-400" />
                    <div className="absolute top-6 left-1/4 w-2 h-2 rounded-full bg-blue-400" />
                    <div className="absolute top-6 right-1/4 w-2 h-2 rounded-full bg-blue-400" />
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-400" />
                    <div className="absolute top-12 left-1/3 w-2 h-2 rounded-full bg-blue-400" />
                    <div className="absolute top-12 right-1/3 w-2 h-2 rounded-full bg-blue-400" />
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-400" />
                    <div className="absolute bottom-6 left-1/4 w-2 h-2 rounded-full bg-blue-400" />
                    <div className="absolute bottom-6 right-1/4 w-2 h-2 rounded-full bg-blue-400" />
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-400" />
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-yellow-400" />
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4" />
                    <span>Nao disponivel</span>
                  </div>
                </button>
              </div>

              {/* Right Column - Big Field Preview */}
              <div className="rounded-xl p-6 bg-gradient-to-br from-[#1c2b2f] via-[#162224] to-[#0d1618] border border-white/[0.04]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white text-2xl font-bold">Padrao {userTeam?.nome?.toUpperCase() || "TIME"}</h2>
                    <span className="text-white/60">4-3-3</span>
                    <span className="text-[#00ffc8] ml-2">ABERTO</span>
                  </div>
                  <TeamCrest team={userTeam} size="lg" />
                </div>

                {/* Big Field */}
                <div className="relative w-full h-[calc(100%-80px)] bg-gradient-to-b from-[#2d5a3d] to-[#1a3d2e] rounded-xl overflow-hidden">
                  {/* Field lines */}
                  <div className="absolute inset-4 border-2 border-white/30 rounded-lg" />
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-white/30" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white/30 rounded-full" />
                  {/* Penalty areas */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-40 h-16 border-2 border-white/30 border-t-0" />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-40 h-16 border-2 border-white/30 border-b-0" />

                  {/* Players in 4-3-3 formation */}
                  {/* Goalkeeper */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="w-10 h-12 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-t-full flex items-center justify-center text-black font-bold text-xs">81</div>
                    <span className="text-white text-[10px] mt-1">Goleiro</span>
                  </div>
                  {/* Defenders */}
                  <div className="absolute bottom-20 left-[15%] flex flex-col items-center">
                    <div className="w-10 h-12 bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-full flex items-center justify-center text-white font-bold text-xs">78</div>
                    <span className="text-white text-[10px] mt-1">LE</span>
                  </div>
                  <div className="absolute bottom-20 left-[35%] flex flex-col items-center">
                    <div className="w-10 h-12 bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-full flex items-center justify-center text-white font-bold text-xs">80</div>
                    <span className="text-white text-[10px] mt-1">ZAG</span>
                  </div>
                  <div className="absolute bottom-20 right-[35%] flex flex-col items-center">
                    <div className="w-10 h-12 bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-full flex items-center justify-center text-white font-bold text-xs">79</div>
                    <span className="text-white text-[10px] mt-1">ZAG</span>
                  </div>
                  <div className="absolute bottom-20 right-[15%] flex flex-col items-center">
                    <div className="w-10 h-12 bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-full flex items-center justify-center text-white font-bold text-xs">84</div>
                    <span className="text-white text-[10px] mt-1">LD</span>
                  </div>
                  {/* Midfielders */}
                  <div className="absolute top-[45%] left-[25%] flex flex-col items-center">
                    <div className="w-10 h-12 bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-full flex items-center justify-center text-white font-bold text-xs">85</div>
                    <span className="text-white text-[10px] mt-1">MC</span>
                  </div>
                  <div className="absolute top-[45%] left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="w-10 h-12 bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-full flex items-center justify-center text-white font-bold text-xs">88</div>
                    <span className="text-white text-[10px] mt-1">MC</span>
                  </div>
                  <div className="absolute top-[45%] right-[25%] flex flex-col items-center">
                    <div className="w-10 h-12 bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-full flex items-center justify-center text-white font-bold text-xs">82</div>
                    <span className="text-white text-[10px] mt-1">MC</span>
                  </div>
                  {/* Forwards */}
                  <div className="absolute top-16 left-[20%] flex flex-col items-center">
                    <div className="w-10 h-12 bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-full flex items-center justify-center text-white font-bold text-xs">79</div>
                    <span className="text-white text-[10px] mt-1">PE</span>
                  </div>
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="w-10 h-12 bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-full flex items-center justify-center text-white font-bold text-xs">81</div>
                    <span className="text-white text-[10px] mt-1">ATA</span>
                  </div>
                  <div className="absolute top-16 right-[20%] flex flex-col items-center">
                    <div className="w-10 h-12 bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-full flex items-center justify-center text-white font-bold text-xs">79</div>
                    <span className="text-white text-[10px] mt-1">PD</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="fixed bottom-0 left-16 right-0 bg-gradient-to-t from-[#050508] via-[#050508]/95 to-transparent py-4 px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/10 rounded px-2 py-1 text-white/60">Esc</span>
                    <span className="text-white/60 text-sm">Voltar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/10 rounded px-2 py-1 text-white/60">q</span>
                    <span className="text-white/60 text-sm">Procurar atletas</span>
                  </div>
                </div>
                <TeamCrest team={userTeam} size="sm" />
              </div>
            </div>
          </TabsContent>

          {/* Propostas Enviadas Tab */}
          <TabsContent value="enviadas" className="mt-0">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-white font-semibold">Propostas Enviadas</span>
              <span className="text-white/20">|</span>
              <span className="text-white/40">Negociacoes em andamento</span>
            </div>

            <div className="grid grid-cols-2 gap-6 h-[calc(100vh-220px)]">
              {/* Left Card - Network Info */}
              <div className="rounded-xl p-8 bg-gradient-to-br from-[#1c2b2f] via-[#162224] to-[#0d1618] border border-white/[0.04] flex flex-col items-center justify-center text-center">
                <Globe className="w-16 h-16 text-white/20 mb-6" />
                <p className="text-white/60 text-lg leading-relaxed max-w-md">
                  Use a Rede Mundial de Transferencias e designe olheiros para procurar atletas, ou busque atletas por conta propria.
                </p>
                <div className="flex items-center gap-2 mt-6 text-white/80">
                  <span>Pressione</span>
                  <span className="text-xs bg-primary/20 text-primary rounded px-2 py-1 font-bold">q</span>
                  <span>para procurar atletas.</span>
                </div>
              </div>

              {/* Right Card - Shortlist */}
              <div className="rounded-xl p-8 bg-gradient-to-br from-[#1c2b2f] via-[#162224] to-[#0d1618] border border-white/[0.04] flex flex-col items-center justify-center text-center">
                <p className="text-white/60 text-lg leading-relaxed">
                  Voce nao fez nenhuma proposta ainda.
                </p>
                <p className="text-white/40 text-sm mt-4">
                  Busque jogadores na aba de transferencias e faca propostas para ve-las aqui.
                </p>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="fixed bottom-0 left-16 right-0 bg-gradient-to-t from-[#050508] via-[#050508]/95 to-transparent py-4 px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/10 rounded px-2 py-1 text-white/60">Esc</span>
                    <span className="text-white/60 text-sm">Voltar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/10 rounded px-2 py-1 text-white/60">q</span>
                    <span className="text-white/60 text-sm">Procurar atletas</span>
                  </div>
                </div>
                <TeamCrest team={userTeam} size="sm" />
              </div>
            </div>
          </TabsContent>

          {/* Propostas Recebidas Tab */}
          <TabsContent value="recebidas" className="mt-0">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-white font-semibold">Propostas Recebidas</span>
              <span className="text-white/20">|</span>
              <span className="text-white/40">Ofertas de outros clubes</span>
            </div>

            <div className="grid grid-cols-2 gap-6 h-[calc(100vh-220px)]">
              {/* Left Card */}
              <div className="rounded-xl p-8 bg-gradient-to-br from-[#1c2b2f] via-[#162224] to-[#0d1618] border border-white/[0.04] flex flex-col items-center justify-center text-center">
                <ArrowLeftRight className="w-16 h-16 text-white/20 mb-6" />
                <p className="text-white/60 text-lg leading-relaxed max-w-md">
                  Outros clubes podem fazer propostas pelos seus jogadores a qualquer momento durante a janela de transferencias.
                </p>
                <p className="text-white/40 text-sm mt-4">
                  Jogadores com alta visibilidade e bom desempenho atraem mais interessados.
                </p>
              </div>

              {/* Right Card - Received Offers */}
              <div className="rounded-xl p-8 bg-gradient-to-br from-[#1c2b2f] via-[#162224] to-[#0d1618] border border-white/[0.04] flex flex-col items-center justify-center text-center">
                <p className="text-white/60 text-lg leading-relaxed">
                  Voce nao recebeu nenhuma proposta.
                </p>
                <p className="text-white/40 text-sm mt-4">
                  Quando outros times fizerem propostas pelos seus jogadores, elas aparecerao aqui.
                </p>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="fixed bottom-0 left-16 right-0 bg-gradient-to-t from-[#050508] via-[#050508]/95 to-transparent py-4 px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/10 rounded px-2 py-1 text-white/60">Esc</span>
                    <span className="text-white/60 text-sm">Voltar</span>
                  </div>
                </div>
                <TeamCrest team={userTeam} size="sm" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <NegotiationModal
        open={negotiationOpen}
        onOpenChange={setNegotiationOpen}
        player={selectedPlayer}
        type={negotiationType}
        team={selectedPlayer?.team}
        onConfirm={(fee) => {
          if (!selectedPlayer) return
          const enginePlayer = marketPlayerToEnginePlayer(selectedPlayer)
          if (negotiationType === "loan") {
            loanPlayer(enginePlayer, 26, Math.round(fee / 26))
          } else {
            buyPlayer(enginePlayer, fee)
          }
        }}
      />
    </div>
  )
}

// Filter Card Component
function FilterCardComponent({ 
  card, 
  selected, 
  onClick, 
  customContent,
  highlight = false 
}: { 
  card: FilterCard
  selected: boolean
  onClick: () => void
  customContent?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-xl p-4 h-44 text-left transition-all overflow-hidden",
        "bg-gradient-to-br from-[#1c2b2f] via-[#162224] to-[#0d1618]",
        selected 
          ? "ring-2 ring-primary shadow-lg shadow-primary/30" 
          : "border border-white/[0.04] hover:border-primary/30",
        highlight && "opacity-70"
      )}
    >
      {/* Subtle glow effect when selected */}
      {selected && (
        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent pointer-events-none" />
      )}
      <h3 className={cn(
        "text-sm font-semibold relative z-10",
        highlight ? "text-white/50" : "text-white"
      )}>
        {card.label}
      </h3>
      <div className="relative z-10 h-[calc(100%-2rem)]">
        {customContent}
      </div>
    </button>
  )
}

// Player List Card Component
function PlayerListCard({ 
  player, 
  selected, 
  onClick 
}: { 
  player: Player
  selected: boolean
  onClick: () => void
}) {
  const isNew = player.scoutProgress && player.scoutProgress < 100

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 p-3 rounded-lg transition-all text-left",
        "bg-[#1a1a1a]/80",
        selected 
          ? "ring-2 ring-primary" 
          : "border border-white/[0.04] hover:border-white/10"
      )}
    >
      {/* Alert indicator */}
      {isNew && (
        <AlertCircle className="absolute -top-1 -left-1 h-4 w-4 text-[#ffd700]" />
      )}

      {/* Player Avatar */}
      <div className="relative">
        <PlayerAvatar name={player.name} teamColor={player.team.cor1} size="sm" />
      </div>

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 bg-green-600 rounded-sm flex items-center justify-center">
            <span className="text-[8px] text-white font-bold">BR</span>
          </div>
          <span className="text-[10px] text-white/50 uppercase">{player.name.split(" ")[0]}</span>
        </div>
        <div className="font-bold text-white text-sm truncate">{player.name.split(" ").slice(-1)[0].toUpperCase()}</div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span>Idade {player.age}</span>
          <span>|</span>
          <span>{player.position}</span>
        </div>
      </div>

      {/* Team Crest */}
      <div className="flex flex-col items-end gap-1">
        <TeamCrest team={player.team} size="xs" />
        {selected && (
          <div className="flex items-center justify-center w-5 h-5 rounded border border-white/20 text-[10px] text-white/50">
            Enter
          </div>
        )}
      </div>
    </button>
  )
}

// Player Details Panel Component
function PlayerDetailsPanel({ player, onNegotiate }: { player: Player, onNegotiate: (type: "buy" | "loan") => void }) {
  const t = useTranslation()
  const isNew = player.scoutProgress && player.scoutProgress < 100
  const isNotScouted = !player.scoutedBy

  return (
    <div className="rounded-xl bg-[#0c0c10]/80 border border-white/[0.04] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isNew && <AlertCircle className="h-4 w-4 text-[#ffd700]" />}
            <span className="text-white/60 text-sm font-medium">
              {isNew ? "NOVO" : isNotScouted ? "NAO OBSERVADO" : "OBSERVADO"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNegotiate("buy")}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {t.market.buy}
            </button>
            <button
              onClick={() => onNegotiate("loan")}
              className="px-4 py-1.5 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
            >
              {t.market.loan}
            </button>
          </div>
        </div>
      </div>

      {/* Player Info */}
      <div className="p-6">
        <div className="flex gap-6">
          {/* Left side - Avatar and basic info */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <PlayerAvatar name={player.name} teamColor={player.team.cor1} size="xl" />
              <TeamCrest team={player.team} size="md" className="absolute -bottom-2 -right-2" />
            </div>
          </div>

          {/* Right side - Details */}
          <div className="flex-1">
            {/* Position badges */}
            <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
              <span>?</span>
              <span>|</span>
              <span className="font-medium text-white">{player.position}</span>
              {player.secondaryPositions?.map(pos => (
                <span key={pos} className="text-white/40">{pos}</span>
              ))}
            </div>

            {/* Name */}
            <div className="text-xs text-white/50 uppercase">{player.name.split(" ")[0]}</div>
            <h2 className="text-2xl font-bold text-white tracking-wide">{player.name.split(" ").slice(-1)[0].toUpperCase()}</h2>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-3 text-sm">
              <div>
                <span className="text-white/50">Potencial</span>
                <div className="flex items-center gap-1">
                  <span className="text-primary font-bold">{player.overall}</span>
                  <span className="text-white/30">-</span>
                  <span className="text-primary font-bold">{player.potential}</span>
                </div>
              </div>
              <div>
                <span className="text-white/50">Idade</span>
                <div className="text-white font-bold">{player.age}</div>
              </div>
              <div>
                <span className="text-white/50">Altura e peso</span>
                <div className="text-white font-bold">{player.height}/{player.weight?.replace(" kg", "kg")}</div>
              </div>
              <div>
                <span className="text-white/50">Perna boa</span>
                <div className="text-white font-bold">{player.foot}</div>
              </div>
            </div>

            {/* Scouted by */}
            {player.scoutedBy && (
              <div className="text-xs text-white/40 mt-3">
                Encontrado por {player.scoutedBy}
              </div>
            )}
          </div>

          {/* Team badge on right */}
          <div className="flex flex-col items-center">
            <TeamCrest team={player.team} size="lg" />
            <span className="text-white/50 text-xs mt-1">{player.team.curto}</span>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          {/* Left stats */}
          <div>
            <h4 className="text-white/50 text-xs font-medium mb-3">Resumo</h4>
            <div className="space-y-2">
              {[
                { label: "Ritmo", value: player.stats.pace, potential: player.stats.pace + 8 },
                { label: "Finalizacao", value: player.stats.shooting, potential: player.stats.shooting + 10 },
                { label: "Passe", value: player.stats.passing, potential: player.stats.passing + 11 },
                { label: "Conducao", value: player.stats.dribbling, potential: player.stats.dribbling + 10 },
                { label: "Defesa", value: player.stats.defense, potential: player.stats.defense + 10 },
                { label: "Fisico", value: player.stats.physical, potential: player.stats.physical + 10 },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">{stat.label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-primary font-medium">{stat.value}</span>
                    <span className="text-white/30">-</span>
                    <span className="text-primary font-medium">{stat.potential}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Scout status */}
          <div>
            <div className="rounded-lg bg-[#1a1a1a] p-4">
              <h4 className="text-white font-semibold mb-2">
                {isNotScouted ? "Sem observar" : "Observando"}
              </h4>
              <p className="text-white/50 text-sm">
                {isNotScouted 
                  ? `${player.name.split(" ").slice(-1)[0]} nao esta sendo observado no momento.`
                  : `${player.name.split(" ").slice(-1)[0]} esta sendo observado.`
                }
              </p>
              
              {/* Scout progress */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/50">Estado do relatorio</span>
                  <span className="text-white">{player.scoutProgress || 0}%</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white/40 rounded-full transition-all"
                    style={{ width: `${player.scoutProgress || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Finances */}
            <div className="mt-4">
              <h4 className="text-white/50 text-xs font-medium mb-2">Financas</h4>
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">Multa rescisoria</span>
                <span className="text-white font-medium">{formatCurrency(player.releaseClause)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation dots */}
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-white/[0.04]">
          <button className="text-white/40 hover:text-white/60">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-white/50 text-xs">Num</span>
          <button className="text-white/40 hover:text-white/60">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="flex gap-1 ml-2">
            <div className="w-2 h-2 rounded-full bg-white" />
            <div className="w-2 h-2 rounded-full bg-white/30" />
            <div className="w-2 h-2 rounded-full bg-white/30" />
            <div className="w-2 h-2 rounded-full bg-white/30" />
            <div className="w-2 h-2 rounded-full bg-white/30" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Scout Card Component  
function ScoutCard({ scout, selected }: { scout: typeof scouts[0], selected: boolean }) {
  const flagEmoji = scout.nationality === "Inglaterra" ? "🏴󠁧󠁢󠁥󠁮󠁧󠁿" : 
                    scout.nationality === "Suica" ? "🇨🇭" : "🇨🇿"

  return (
    <div className={cn(
      "rounded-xl p-6 text-center transition-all",
      "bg-gradient-to-br from-[#1a1a1a] to-[#141414]",
      selected 
        ? "ring-2 ring-primary" 
        : "border border-white/[0.04] hover:border-white/10"
    )}>
      {/* Flag */}
      <div className="text-3xl mb-3">{flagEmoji}</div>

      {/* Name */}
      <div className="text-white font-bold text-lg uppercase tracking-wide">
        {scout.name.split(" ")[0]}
      </div>
      <div className="text-white font-bold text-lg uppercase tracking-wide">
        {scout.name.split(" ").slice(1).join(" ")}
      </div>

      {/* Area */}
      <div className="text-white/50 text-sm mt-2">{scout.area}</div>

      {/* Assigned */}
      {scout.assigned > 0 && (
        <div className="flex items-center justify-center gap-2 mt-2 text-white/60">
          <User className="h-4 w-4" />
          <span>{scout.assigned}</span>
        </div>
      )}

      {/* Arrow for available scouts */}
      {scout.area === "Scout Available" && (
        <div className="mt-2">
          <div className="w-8 h-8 mx-auto rounded-full border border-white/20 flex items-center justify-center">
            <ChevronRight className="h-4 w-4 text-white/40" />
          </div>
        </div>
      )}

      {/* Stars */}
      <div className="flex items-center justify-center gap-1 mt-3">
        <span className="text-white/50 text-xs">Judgement:</span>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star 
            key={i} 
            className={cn(
              "h-3 w-3",
              i < scout.stars ? "text-[#ffd700] fill-yellow-500" : "text-white/20"
            )} 
          />
        ))}
      </div>
    </div>
  )
}
