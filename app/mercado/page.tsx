"use client"

import { useState, useMemo } from "react"
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Star,
  DollarSign,
  ArrowLeftRight,
  UserPlus,
  UserMinus,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { NegotiationModal } from "@/components/modals/negotiation-modal"
import { FilterModal } from "@/components/modals/filter-modal"
import { SearchPlayerModal } from "@/components/modals/search-player-modal"
import { serieATeams, formatCurrency, type Team } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { PlayerAvatar } from "@/components/player-avatar"

// Mock transfer targets - use index-based fallback for reliability
// serieATeams order: [0]=BOT, [1]=PAL, [2]=FLA, [3]=FOR, [4]=INT, [5]=SAO, [6]=COR
const palTeam = serieATeams[1] // Palmeiras
const flaTeam = serieATeams[2] // Flamengo
const corTeam = serieATeams[6] // Corinthians
const saoTeam = serieATeams[5] // Sao Paulo

const transferTargets = [
  { id: 1, name: "Gabriel Veron", team: palTeam, position: "PD", age: 21, overall: 78, value: 18000000, trend: "up" as const },
  { id: 2, name: "Gustavo Scarpa", team: palTeam, position: "MEI", age: 30, overall: 81, value: 12000000, trend: "down" as const },
  { id: 3, name: "Bruno Henrique", team: flaTeam, position: "PE", age: 33, overall: 80, value: 8000000, trend: "down" as const },
  { id: 4, name: "Yuri Alberto", team: corTeam, position: "ATA", age: 23, overall: 79, value: 22000000, trend: "up" as const },
  { id: 5, name: "Luciano", team: saoTeam, position: "ATA", age: 30, overall: 80, value: 15000000, trend: "stable" as const },
  { id: 6, name: "Dudu", team: palTeam, position: "PE", age: 32, overall: 82, value: 10000000, trend: "down" as const },
  { id: 7, name: "Raphael Veiga", team: palTeam, position: "MEI", age: 29, overall: 83, value: 25000000, trend: "up" as const },
  { id: 8, name: "Arrascaeta", team: flaTeam, position: "MEI", age: 30, overall: 85, value: 30000000, trend: "stable" as const },
  { id: 9, name: "Pedro", team: flaTeam, position: "ATA", age: 27, overall: 84, value: 35000000, trend: "up" as const },
]

// Mock transfer offers received - initial data
const initialOffers = [
  { id: 1, player: "Lincoln", from: flaTeam, value: 15000000, status: "pending" as "pending" | "accepted" | "rejected" },
  { id: 2, player: "Helinho", from: saoTeam, value: 8500000, status: "pending" as "pending" | "accepted" | "rejected" },
]

// Mock loans
const loansAvailable = [
  { id: 1, name: "Wesley", team: palTeam, position: "PD", age: 19, overall: 72, value: 5000000, loanFee: 500000, trend: "up" as const },
  { id: 2, name: "Giovani", team: corTeam, position: "MEI", age: 20, overall: 70, value: 3000000, loanFee: 300000, trend: "stable" as const },
]

interface FilterOptions {
  positions: string[]
  minOverall: number
  maxOverall: number
  minAge: number
  maxAge: number
  minValue: number
  maxValue: number
}

export default function MercadoPage() {
  const { team: userTeam } = useUserTeam()
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("comprar")
  const [selectedPlayer, setSelectedPlayer] = useState<typeof transferTargets[0] | null>(null)
  const [negotiationOpen, setNegotiationOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [negotiationType, setNegotiationType] = useState<"buy" | "sell" | "loan">("buy")
  const [offers, setOffers] = useState(initialOffers)
  const [filters, setFilters] = useState<FilterOptions>({
    positions: [],
    minOverall: 0,
    maxOverall: 99,
    minAge: 16,
    maxAge: 45,
    minValue: 0,
    maxValue: 100000000,
  })

  const pendingOffers = offers.filter(o => o.status === "pending")
  const processedOffers = offers.filter(o => o.status !== "pending")

  const handleAcceptOffer = (offerId: number) => {
    setOffers(prev => prev.map(o => 
      o.id === offerId ? { ...o, status: "accepted" as const } : o
    ))
  }

  const handleRejectOffer = (offerId: number) => {
    setOffers(prev => prev.map(o => 
      o.id === offerId ? { ...o, status: "rejected" as const } : o
    ))
  }

  const filteredTargets = useMemo(() => {
    return transferTargets.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchesPosition = filters.positions.length === 0 || filters.positions.includes(p.position)
      const matchesOverall = p.overall >= filters.minOverall && p.overall <= filters.maxOverall
      const matchesAge = p.age >= filters.minAge && p.age <= filters.maxAge
      const matchesValue = p.value >= filters.minValue && p.value <= filters.maxValue
      return matchesSearch && matchesPosition && matchesOverall && matchesAge && matchesValue
    })
  }, [search, filters])

  const handleNegotiate = (player: typeof transferTargets[0], type: "buy" | "sell" | "loan") => {
    setSelectedPlayer(player)
    setNegotiationType(type)
    setNegotiationOpen(true)
  }

  const handleSearchSelect = (player: typeof transferTargets[0]) => {
    handleNegotiate(player, "buy")
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.positions.length > 0) count++
    if (filters.minOverall > 0 || filters.maxOverall < 99) count++
    if (filters.minAge > 16 || filters.maxAge < 45) count++
    if (filters.minValue > 0 || filters.maxValue < 100000000) count++
    return count
  }, [filters])

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Mercado</h1>
            <p className="text-sm text-white/50 mt-1">Janela de transferencias aberta</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => setSearchModalOpen(true)}
              className="border-white/10 text-white/70 hover:text-white hover:bg-white/10"
            >
              <Search className="h-4 w-4 mr-2" />
              Buscar Jogador
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setFilterOpen(true)}
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

        {/* Transfer Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <DollarSign className="h-4 w-4 text-[#1db954]" />
              VERBA TOTAL
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#1db954]">{formatCurrency(15000000)}</div>
          </div>
          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <UserPlus className="h-4 w-4 text-blue-400" />
              CONTRATACOES
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">0</div>
          </div>
          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <UserMinus className="h-4 w-4 text-red-400" />
              VENDAS
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">0</div>
          </div>
          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <ArrowLeftRight className="h-4 w-4 text-yellow-400" />
              PROPOSTAS
            </div>
            <div className="mt-2 text-2xl font-semibold text-yellow-400">{pendingOffers.length}</div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#1a1a1a] border border-white/10 p-1 h-auto">
            <TabsTrigger value="comprar" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">Comprar</TabsTrigger>
            <TabsTrigger value="vender" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">Vender</TabsTrigger>
            <TabsTrigger value="propostas" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">
              Propostas
              {pendingOffers.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] text-black font-bold">
                  {pendingOffers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="emprestimos" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">Emprestimos</TabsTrigger>
          </TabsList>

          {/* Buy Tab */}
          <TabsContent value="comprar" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTargets.map((player) => (
                <PlayerCard 
                  key={player.id} 
                  player={player} 
                  onNegotiate={() => handleNegotiate(player, "buy")} 
                />
              ))}
            </div>
            {filteredTargets.length === 0 && (
              <div className="rounded-xl bg-[#141414] border border-white/5 p-12 text-center">
                <Search className="h-12 w-12 mx-auto text-white/20 mb-4" />
                <h3 className="font-semibold text-white">Nenhum jogador encontrado</h3>
                <p className="text-sm text-white/50 mt-2">
                  Ajuste os filtros ou busque por outro jogador
                </p>
              </div>
            )}
          </TabsContent>

          {/* Sell Tab */}
          <TabsContent value="vender" className="mt-6">
            <div className="rounded-xl bg-[#141414] border border-white/5 p-8 text-center">
              <UserMinus className="h-12 w-12 mx-auto text-white/20 mb-4" />
              <h3 className="font-semibold text-white">Liste Jogadores para Venda</h3>
              <p className="text-sm text-white/50 mt-2">
                Acesse o elenco para colocar jogadores disponiveis para transferencia
              </p>
              <Button className="mt-4 bg-[#1db954] text-black hover:bg-[#1ed760]">
                Ir para Elenco
              </Button>
            </div>
          </TabsContent>

          {/* Offers Tab */}
          <TabsContent value="propostas" className="mt-6">
            <div className="space-y-6">
              {/* Pending Offers */}
              {pendingOffers.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">Propostas Pendentes</h3>
                  {pendingOffers.map((offer) => (
                    <div key={offer.id} className="rounded-xl bg-[#141414] border border-yellow-500/20 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <PlayerAvatar 
                            name={offer.player} 
                            teamColor="#eab308"
                            size="sm" 
                          />
                          <div>
                            <div className="font-medium text-white">{offer.player}</div>
                            <div className="flex items-center gap-2 text-sm text-white/50">
                              <span>Proposta de</span>
                              <TeamCrest team={offer.from} size="xs" />
                              <span>{offer.from.nome}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xl font-semibold text-[#1db954]">{formatCurrency(offer.value)}</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-wider">Oferta</div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              className="bg-[#1db954] text-black hover:bg-[#1ed760]"
                              onClick={() => handleAcceptOffer(offer.id)}
                            >
                              Aceitar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                              onClick={() => handleRejectOffer(offer.id)}
                            >
                              Recusar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Processed Offers */}
              {processedOffers.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider">Historico</h3>
                  {processedOffers.map((offer) => (
                    <div key={offer.id} className={`rounded-xl bg-[#141414] border p-4 ${
                      offer.status === "accepted" ? "border-[#1db954]/20" : "border-red-500/20"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <PlayerAvatar 
                            name={offer.player} 
                            teamColor={offer.status === "accepted" ? "#1db954" : "#ef4444"}
                            size="sm" 
                          />
                          <div>
                            <div className="font-medium text-white/70">{offer.player}</div>
                            <div className="flex items-center gap-2 text-sm text-white/40">
                              <span>Proposta de</span>
                              <TeamCrest team={offer.from} size="xs" />
                              <span>{offer.from.nome}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className={`text-xl font-semibold ${
                              offer.status === "accepted" ? "text-[#1db954]" : "text-white/40 line-through"
                            }`}>{formatCurrency(offer.value)}</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-wider">Oferta</div>
                          </div>
                          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                            offer.status === "accepted" 
                              ? "bg-[#1db954]/20 text-[#1db954]" 
                              : "bg-red-500/20 text-red-400"
                          }`}>
                            {offer.status === "accepted" ? "Aceita" : "Recusada"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {offers.length === 0 && (
                <div className="rounded-xl bg-[#141414] border border-white/5 p-12 text-center">
                  <ArrowLeftRight className="h-12 w-12 mx-auto text-white/20 mb-4" />
                  <h3 className="font-semibold text-white">Nenhuma proposta recebida</h3>
                  <p className="text-sm text-white/50 mt-2">
                    Quando outros clubes fizerem ofertas pelos seus jogadores, elas aparecerão aqui
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Loans Tab */}
          <TabsContent value="emprestimos" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {loansAvailable.map((player) => (
                <div key={player.id} className="rounded-xl bg-[#141414] border border-white/5 p-4">
                  <div className="flex items-center gap-4">
                    <PlayerAvatar 
                      name={player.name} 
                      teamColor={player.team.cor1}
                      size="md" 
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{player.name}</span>
                        <span className="text-lg font-bold text-yellow-500">{player.overall}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white/50">
                        <TeamCrest team={player.team} size="xs" />
                        <span>{player.team.nome}</span>
                        <span className="text-white/20">|</span>
                        <span>{player.position}</span>
                        <span className="text-white/20">|</span>
                        <span>{player.age} anos</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-white/50">Taxa: {formatCurrency(player.loanFee)}/temporada</span>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleNegotiate({ ...player, value: player.loanFee }, "loan")}
                          className="border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                        >
                          Negociar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <MusicPlayer />

      {/* Modals */}
      <NegotiationModal
        open={negotiationOpen}
        onOpenChange={setNegotiationOpen}
        player={selectedPlayer}
        type={negotiationType}
        team={selectedPlayer?.team}
      />

      <FilterModal
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={setFilters}
        type="transfer"
      />

      <SearchPlayerModal
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
        players={transferTargets}
        onSelect={handleSearchSelect}
      />
    </div>
  )
}

function PlayerCard({ 
  player, 
  onNegotiate 
}: { 
  player: {
    id: number
    name: string
    team: Team
    position: string
    age: number
    overall: number
    value: number
    trend: "up" | "down" | "stable"
  }
  onNegotiate: () => void
}) {
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

  return (
    <div className="rounded-xl bg-[#141414] border border-white/5 p-4 transition-all hover:border-white/10">
      <div className="flex items-start gap-4">
        <div className="relative">
          <PlayerAvatar 
            name={player.name} 
            teamColor={player.team.cor1}
            size="lg" 
          />
          <div className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-md border ${positionColors[player.position]}`}>
            <span className="text-[10px] font-bold">{player.position}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-white truncate">{player.name}</h3>
            <span className="text-xl font-bold text-yellow-500">{player.overall}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
            <TeamCrest team={player.team} size="xs" />
            <span>{player.team.nome}</span>
            <span className="text-white/20">|</span>
            <span>{player.age} anos</span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-[#1db954]">{formatCurrency(player.value)}</span>
              {player.trend === "up" && <TrendingUp className="h-3 w-3 text-[#1db954]" />}
              {player.trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={onNegotiate}
              className="border-white/10 text-white/70 hover:text-white hover:bg-white/10"
            >
              Negociar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
