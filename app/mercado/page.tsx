"use client"

import { useState, useMemo } from "react"
import {
  Search,
  User,
  MapPin,
  ArrowLeftRight,
  Trophy,
  Shield,
  Flag,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Star,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { NegotiationModal } from "@/components/modals/negotiation-modal"
import { getTeamByShort, serieATeams, formatCurrency, type Team } from "@/lib/teams-data"
import { PlayerAvatar } from "@/components/player-avatar"
import { cn } from "@/lib/utils"

const userTeam = getTeamByShort("BGT") || serieATeams[0]

// Mock transfer targets
const palTeam = serieATeams[1]
const flaTeam = serieATeams[2]
const corTeam = serieATeams[6]
const saoTeam = serieATeams[5]
const intTeam = serieATeams[4]

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

export default function MercadoPage() {
  const [activeTab, setActiveTab] = useState("buscar")
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("nome")
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(transferTargets[0])
  const [negotiationOpen, setNegotiationOpen] = useState(false)
  const [playerListIndex, setPlayerListIndex] = useState(0)
  const [positionFilter, setPositionFilter] = useState<string>("Tudo")

  // Filter cards for search
  const filterCards: FilterCard[] = [
    { id: "nome", label: "Nome", icon: <User className="h-10 w-10 text-white/30" />, value: "Qualquer" },
    { id: "posicao", label: "Posicao", icon: null, value: "Qualquer" },
    { id: "nacionalidade", label: "Nacionalidade/Regiao", icon: <Flag className="h-10 w-10 text-white/30" />, value: "Qualquer" },
    { id: "status", label: "Status transferencia", icon: <ArrowLeftRight className="h-10 w-10 text-white/30" />, value: "Qualquer" },
    { id: "idade", label: "Idade", icon: null, value: "16 - 35" },
    { id: "pais", label: "Pais/regiao", icon: <Flag className="h-8 w-8 text-white/30" />, value: "Qualquer" },
    { id: "liga", label: "Liga", icon: <Trophy className="h-10 w-10 text-white/30" />, value: "Qualquer" },
    { id: "time", label: "Time", icon: <Shield className="h-12 w-12 text-white/20" />, value: "Qualquer" },
  ]

  // Filter players by position
  const filteredPlayers = useMemo(() => {
    if (positionFilter === "Tudo") return transferTargets
    return transferTargets.filter(p => 
      p.position === positionFilter || p.secondaryPositions?.includes(positionFilter)
    )
  }, [positionFilter])

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

  const handleNegotiate = () => {
    if (selectedPlayer) {
      setNegotiationOpen(true)
    }
  }

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="p-6">
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
                Buscar Atletas
              </TabsTrigger>
              <span className="text-white/20">|</span>
              <TabsTrigger 
                value="rede" 
                className="bg-transparent border-0 px-0 py-0 text-base data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
              >
                Rede Mundial de Transferencias
              </TabsTrigger>
              <span className="text-white/20">|</span>
              <TabsTrigger 
                value="olheiros" 
                className="bg-transparent border-0 px-0 py-0 text-base data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
              >
                Olheiros
              </TabsTrigger>
            </TabsList>

            <div className="ml-auto flex items-center gap-4">
              <span className="text-sm text-white/40">Filtros de Busca</span>
            </div>
          </div>

          {/* Search Filters Tab */}
          <TabsContent value="buscar" className="mt-0">
            <div className="grid grid-cols-4 gap-4">
              {/* First Row */}
              <FilterCardComponent 
                card={filterCards[0]} 
                selected={selectedFilter === "nome"}
                onClick={() => setSelectedFilter("nome")}
                customContent={
                  <div className="flex flex-col items-center justify-center h-full">
                    <User className="h-16 w-16 text-white/20 mb-2" />
                    <span className="text-white/50 text-sm">Qualquer</span>
                  </div>
                }
              />
              <FilterCardComponent 
                card={filterCards[1]} 
                selected={selectedFilter === "posicao"}
                onClick={() => setSelectedFilter("posicao")}
                customContent={
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <span className="text-white/50 text-sm">Qualquer</span>
                    <div className="font-semibold text-white">Funcao</div>
                    <span className="text-white/50 text-sm">Qualquer</span>
                  </div>
                }
              />
              <FilterCardComponent 
                card={filterCards[2]} 
                selected={selectedFilter === "nacionalidade"}
                onClick={() => setSelectedFilter("nacionalidade")}
                customContent={
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="flex gap-1 mb-2">
                      <div className="w-8 h-6 bg-white/20 rounded" />
                      <div className="w-8 h-6 bg-white/20 rounded" />
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
                    <ArrowLeftRight className="h-12 w-12 text-white/30 mb-2" />
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
                  <div className="flex flex-col items-start justify-center h-full px-4 gap-3">
                    <div className="flex justify-between w-full text-sm">
                      <span className="text-white/50">MIN.</span>
                      <span className="text-white">16</span>
                    </div>
                    <div className="flex justify-between w-full text-sm">
                      <span className="text-white/50">MAX.</span>
                      <span className="text-white">35</span>
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
                    <div className="flex gap-1 mb-2">
                      <div className="w-8 h-6 bg-white/20 rounded" />
                      <div className="w-8 h-6 bg-white/20 rounded" />
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
                    <Trophy className="h-12 w-12 text-white/30 mb-2" />
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
                    <Shield className="h-16 w-16 text-white/15 mb-2" />
                    <span className="text-white/40 text-sm">Qualquer</span>
                  </div>
                }
                highlight
              />
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center gap-6 mt-8 text-xs text-white/50">
              <div className="flex items-center gap-2">
                <span className="border border-white/30 rounded px-1.5 py-0.5">Enter</span>
                <span>Selecionar</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="border border-white/30 rounded px-1.5 py-0.5">Esc</span>
                <span>Voltar</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="border border-white/30 rounded px-1.5 py-0.5">s</span>
                <span>Restaurar</span>
              </div>
              <button 
                onClick={() => setActiveTab("rede")}
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <span className="border border-white/30 rounded px-1.5 py-0.5">d</span>
                <span>Buscar</span>
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
                <Star className="h-4 w-4 text-yellow-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Player List */}
              <div className="space-y-4">
                {Object.entries(groupedPlayers).map(([group, players]) => (
                  players.length > 0 && (
                    <div key={group} className="rounded-xl bg-[#141414]/80 border border-white/5 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-semibold">{group}</h3>
                        <span className="text-xs text-white/40">Pronto para jogar, Reserva</span>
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
                <div className="rounded-xl bg-[#141414]/80 border border-white/5 p-8 flex flex-col items-center justify-center text-center">
                  <User className="h-20 w-20 text-white/10 mb-4" />
                  <h3 className="text-white/40 text-lg">Selecione um jogador</h3>
                  <p className="text-white/30 text-sm mt-2">Clique em um jogador para ver seus detalhes</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Scouts Tab */}
          <TabsContent value="olheiros" className="mt-0">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-white font-semibold">Olheiros</span>
              <span className="text-white/20">|</span>
              <span className="text-white/40">Instrucoes</span>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Scouts Grid */}
              <div className="col-span-2 grid grid-cols-3 gap-4">
                {scouts.map((scout, index) => (
                  <ScoutCard key={scout.id} scout={scout} selected={index === 4} />
                ))}
                <button className="rounded-xl bg-[#141414]/50 border border-white/5 p-6 flex items-center justify-center hover:border-primary/30 transition-colors">
                  <span className="text-white/60 font-medium">Contratar Olheiro</span>
                </button>
              </div>

              {/* Info Panel */}
              <div className="space-y-4">
                <div className="rounded-xl bg-[#141414]/80 border border-white/5 p-6">
                  <p className="text-white/70 text-sm leading-relaxed">
                    Seus olheiros podem criar redes no mundo todo para descobrir novos nomes.
                  </p>
                  <p className="text-white/50 text-sm leading-relaxed mt-4">
                    Se quiser receber relatorios de atletas dos proximos times adversarios, deixe livre um de seus olheiros.
                  </p>
                </div>

                <div className="rounded-xl bg-[#141414]/50 border border-white/5 p-6">
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
        </Tabs>
      </main>

      <MusicPlayer />

      <NegotiationModal
        open={negotiationOpen}
        onOpenChange={setNegotiationOpen}
        player={selectedPlayer}
        type="buy"
        team={selectedPlayer?.team}
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
        "relative rounded-xl p-4 h-40 text-left transition-all",
        "bg-gradient-to-br from-[#1a2a2e] to-[#0f1a1c]",
        selected 
          ? "ring-2 ring-primary shadow-lg shadow-primary/20" 
          : "border border-white/10 hover:border-white/20",
        highlight && "opacity-60"
      )}
    >
      <h3 className={cn(
        "text-sm font-semibold mb-4",
        highlight ? "text-white/40" : "text-white"
      )}>
        {card.label}
      </h3>
      {customContent}
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
          : "border border-white/5 hover:border-white/10"
      )}
    >
      {/* Alert indicator */}
      {isNew && (
        <AlertCircle className="absolute -top-1 -left-1 h-4 w-4 text-yellow-500" />
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
function PlayerDetailsPanel({ player, onNegotiate }: { player: Player, onNegotiate: () => void }) {
  const isNew = player.scoutProgress && player.scoutProgress < 100
  const isNotScouted = !player.scoutedBy

  return (
    <div className="rounded-xl bg-[#141414]/80 border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isNew && <AlertCircle className="h-4 w-4 text-yellow-500" />}
            <span className="text-white/60 text-sm font-medium">
              {isNew ? "NOVO" : isNotScouted ? "NAO OBSERVADO" : "OBSERVADO"}
            </span>
          </div>
          <button 
            onClick={onNegotiate}
            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Negociar
          </button>
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
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-white/5">
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
        : "border border-white/5 hover:border-white/10"
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
              i < scout.stars ? "text-yellow-500 fill-yellow-500" : "text-white/20"
            )} 
          />
        ))}
      </div>
    </div>
  )
}
