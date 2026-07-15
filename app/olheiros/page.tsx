"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { useGameManager } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"
import {
  Search,
  Globe,
  Star,
  MapPin,
  Clock,
  Users,
  DollarSign,
  Plus,
  Play,
  Pause,
  Eye,
  EyeOff,
  TrendingUp,
  Award,
  ChevronRight,
  Plane,
  Target,
  UserPlus,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  X,
  Landmark,
  Compass
} from "lucide-react"
import type { Scout } from "@/lib/game-engine"

// Regioes disponiveis para scouting
const SCOUTING_REGIONS = [
  { 
    id: "brasil", 
    name: "Brasil", 
    icon: MapPin, 
    searchCost: 50000, 
    weeksToComplete: 2,
    description: "Promessas das series A, B e C",
    avgPlayerValue: "500K - 5M"
  },
  { 
    id: "americas", 
    name: "Americas", 
    icon: Globe, 
    searchCost: 150000, 
    weeksToComplete: 3,
    description: "Argentina, Colombia, Mexico, EUA",
    avgPlayerValue: "1M - 10M"
  },
  { 
    id: "europa", 
    name: "Europa", 
    icon: Landmark, 
    searchCost: 300000, 
    weeksToComplete: 4,
    description: "Ligas europeias menores e jovens",
    avgPlayerValue: "2M - 20M"
  },
  { 
    id: "asia", 
    name: "Asia/Africa", 
    icon: Compass, 
    searchCost: 100000, 
    weeksToComplete: 3,
    description: "Mercados emergentes",
    avgPlayerValue: "200K - 3M"
  },
]

// Olheiros disponiveis para contratar
const AVAILABLE_SCOUTS: Omit<Scout, "id" | "isSearching" | "searchProgress" | "foundPlayers">[] = [
  { name: "Carlos Mendes", region: "Brasil", skill: 4, salary: 25000, weeksToComplete: 0, searchCost: 0 },
  { name: "Ricardo Alves", region: "Brasil", skill: 3, salary: 18000, weeksToComplete: 0, searchCost: 0 },
  { name: "Juan Martinez", region: "Americas", skill: 4, salary: 35000, weeksToComplete: 0, searchCost: 0 },
  { name: "Diego Fernandez", region: "Americas", skill: 3, salary: 28000, weeksToComplete: 0, searchCost: 0 },
  { name: "Pierre Dubois", region: "Europa", skill: 5, salary: 60000, weeksToComplete: 0, searchCost: 0 },
  { name: "Hans Mueller", region: "Europa", skill: 4, salary: 45000, weeksToComplete: 0, searchCost: 0 },
  { name: "Kenji Tanaka", region: "Asia", skill: 3, salary: 22000, weeksToComplete: 0, searchCost: 0 },
  { name: "Ahmed Hassan", region: "Asia", skill: 4, salary: 30000, weeksToComplete: 0, searchCost: 0 },
]

export default function OlheirosPage() {
  const router = useRouter()

  // Gamepad support
  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (btn === 'B') router.back()
    }
    window.addEventListener('gamepad:button', handler)
    return () => window.removeEventListener('gamepad:button', handler)
  }, [router])
  const { gameEngine, userTeam } = useGameManager()
  const [activeTab, setActiveTab] = useState<"meus_olheiros" | "contratar" | "descobertos">("meus_olheiros")
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [showHireModal, setShowHireModal] = useState(false)
  const [selectedScoutToHire, setSelectedScoutToHire] = useState<typeof AVAILABLE_SCOUTS[0] | null>(null)

  // Olheiros contratados e talentos descobertos vem do game-engine (persistidos no save),
  // nao mais de uma lista fixa. Comecam vazios: voce contrata olheiros e os envia buscar.
  const myScouts = gameEngine.scouts
  const discoveredPlayers = gameEngine.scoutedLeads

  const handleHireScout = (scout: typeof AVAILABLE_SCOUTS[0]) => {
    gameEngine.hireScout({
      id: Date.now(),
      ...scout,
      isSearching: false,
      searchProgress: 0,
      foundPlayers: [],
    })
    setShowHireModal(false)
    setSelectedScoutToHire(null)
  }

  const handleStartSearch = (scoutId: number, regionId: string) => {
    const region = SCOUTING_REGIONS.find(r => r.id === regionId)
    if (!region) return
    gameEngine.startScoutSearch(scoutId, region.name, region.weeksToComplete, region.searchCost)
    setSelectedRegion(null)
  }

  const handleStopSearch = (scoutId: number) => {
    gameEngine.stopScoutSearch(scoutId)
  }

  const tabs = [
    { id: "meus_olheiros", label: "Meus Olheiros", icon: Users },
    { id: "contratar", label: "Contratar", icon: UserPlus },
    { id: "descobertos", label: "Descobertos", icon: Eye },
  ]

  return (
    <div className="h-screen overflow-hidden md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508]">
      <GameHeader team={userTeam ?? undefined} />

      <main className="h-[calc(100vh-48px-56px)] flex flex-col">
        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-white/[0.04] bg-[#0d0d0d]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-[#00ffc8]/20 text-[#00ffc8]"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "descobertos" && discoveredPlayers.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#00ffc8] text-black text-[10px] font-bold">
                  {discoveredPlayers.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-game">
          <AnimatePresence mode="wait">
            {/* Meus Olheiros */}
            {activeTab === "meus_olheiros" && (
              <motion.div
                key="meus_olheiros"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Stats gerais */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-[#111] border border-white/[0.04]">
                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                      <Users className="h-3.5 w-3.5" />
                      Olheiros Ativos
                    </div>
                    <div className="text-2xl font-bold text-white">{myScouts.length}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#111] border border-white/[0.04]">
                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                      <Search className="h-3.5 w-3.5" />
                      Em Busca
                    </div>
                    <div className="text-2xl font-bold text-[#00ffc8]">{myScouts.filter(s => s.isSearching).length}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#111] border border-white/[0.04]">
                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                      <Eye className="h-3.5 w-3.5" />
                      Descobertos
                    </div>
                    <div className="text-2xl font-bold text-amber-400">{discoveredPlayers.length}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#111] border border-white/[0.04]">
                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      Custo Semanal
                    </div>
                    <div className="text-2xl font-bold text-white">
                      R$ {myScouts.reduce((acc, s) => acc + s.salary, 0).toLocaleString("pt-BR")}
                    </div>
                  </div>
                </div>

                {/* Lista de olheiros */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Meus Olheiros</h2>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("contratar")}
                      className="bg-[#00ffc8] hover:bg-[#00c8ff] text-black text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Contratar Olheiro
                    </Button>
                  </div>

                  {myScouts.length === 0 ? (
                    <div className="p-8 rounded-xl bg-[#111] border border-white/[0.04] text-center">
                      <Search className="h-12 w-12 mx-auto text-white/20 mb-3" />
                      <p className="text-white/50">Voce ainda nao tem olheiros</p>
                      <p className="text-white/30 text-sm mt-1">Contrate olheiros para descobrir talentos</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {myScouts.map((scout) => (
                        <div
                          key={scout.id}
                          className="p-4 rounded-xl bg-[#111] border border-white/[0.04] hover:border-white/10 transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                                <Briefcase className="h-5 w-5 text-white/60" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-white">{scout.name}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-white/50 flex items-center gap-1">
                                    <Globe className="h-3 w-3" />
                                    {SCOUTING_REGIONS.find(r => r.id === scout.region)?.name || scout.region}
                                  </span>
                                  <span className="text-xs text-white/50 flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    R$ {scout.salary.toLocaleString("pt-BR")}/sem
                                  </span>
                                </div>
                                <div className="flex items-center gap-0.5 mt-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={cn(
                                        "h-3 w-3",
                                        i < scout.skill ? "text-amber-400 fill-amber-400" : "text-white/20"
                                      )}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              {scout.isSearching ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-[#00ffc8]">
                                    <Search className="h-4 w-4 animate-pulse" />
                                    <span className="text-sm font-medium">Buscando...</span>
                                  </div>
                                  <div className="w-32 h-2 rounded-full bg-white/10 overflow-hidden">
                                    <motion.div
                                      className="h-full bg-[#00ffc8]"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${scout.searchProgress}%` }}
                                      transition={{ duration: 0.5 }}
                                    />
                                  </div>
                                  <p className="text-[10px] text-white/40">
                                    {scout.weeksToComplete} semana(s) restante(s)
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleStopSearch(scout.id)}
                                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                                  >
                                    <Pause className="h-3 w-3 mr-1" />
                                    Parar
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-white/40">
                                    <Clock className="h-4 w-4" />
                                    <span className="text-sm">Disponivel</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => setSelectedRegion(selectedRegion === scout.id.toString() ? null : scout.id.toString())}
                                    className="bg-[#00ffc8] hover:bg-[#00c8ff] text-black text-xs"
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Iniciar Busca
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Selecao de regiao */}
                          <AnimatePresence>
                            {selectedRegion === scout.id.toString() && !scout.isSearching && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-4 pt-4 border-t border-white/[0.04]"
                              >
                                <p className="text-xs text-white/50 mb-3">Selecione a regiao para buscar:</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {SCOUTING_REGIONS.map((region) => (
                                    <button
                                      key={region.id}
                                      onClick={() => handleStartSearch(scout.id, region.id)}
                                      className="p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.04] hover:border-[#00ffc8]/30 transition-all text-left"
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <region.icon className="h-4 w-4 text-[#00ffc8]" />
                                        <span className="text-sm font-medium text-white">{region.name}</span>
                                      </div>
                                      <p className="text-[10px] text-white/40 mb-2">{region.description}</p>
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-white/50">
                                          <Clock className="h-3 w-3 inline mr-1" />
                                          {region.weeksToComplete} sem
                                        </span>
                                        <span className="text-amber-400">
                                          R$ {region.searchCost.toLocaleString("pt-BR")}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Jogadores encontrados */}
                          {scout.foundPlayers.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/[0.04]">
                              <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-[#00ffc8]" />
                                {scout.foundPlayers.length} jogador(es) descoberto(s)
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Contratar Olheiros */}
            {activeTab === "contratar" && (
              <motion.div
                key="contratar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                    Olheiros Disponiveis para Contratacao
                  </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  {AVAILABLE_SCOUTS.filter(s => !myScouts.find(ms => ms.name === s.name)).map((scout, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[#111] border border-white/[0.04] hover:border-white/10 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                            <Briefcase className="h-5 w-5 text-white/60" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{scout.name}</h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-white/50 flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                Especialista: {scout.region}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 mt-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    "h-3 w-3",
                                    i < scout.skill ? "text-amber-400 fill-amber-400" : "text-white/20"
                                  )}
                                />
                              ))}
                              <span className="text-[10px] text-white/40 ml-2">
                                Habilidade {scout.skill}/5
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center justify-between">
                        <div>
                          <p className="text-xs text-white/40">Salario Semanal</p>
                          <p className="text-sm font-semibold text-white">
                            R$ {scout.salary.toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedScoutToHire(scout)
                            setShowHireModal(true)
                          }}
                          className="bg-[#00ffc8] hover:bg-[#00c8ff] text-black text-xs"
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" />
                          Contratar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Jogadores Descobertos */}
            {activeTab === "descobertos" && (
              <motion.div
                key="descobertos"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                    Jogadores Descobertos
                  </h2>
                  <p className="text-xs text-white/40">
                    Jogadores encontrados pelos seus olheiros
                  </p>
                </div>

                {discoveredPlayers.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#111] border border-white/[0.04] text-center">
                    <Eye className="h-12 w-12 mx-auto text-white/20 mb-3" />
                    <p className="text-white/50">Nenhum jogador descoberto ainda</p>
                    <p className="text-white/30 text-sm mt-1">Envie seus olheiros para buscar talentos</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {discoveredPlayers.map((player) => (
                      <div
                        key={player.id}
                        className="p-4 rounded-xl bg-[#111] border border-white/[0.04] hover:border-white/10 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00ffc8]/20 to-[#00ffc8]/5 flex items-center justify-center">
                                <span className="text-xl font-black text-[#00ffc8]">
                                  {player.revealedAttributes ? player.overall : "?"}
                                </span>
                              </div>
                              <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold text-white/70">
                                {player.position}
                              </div>
                            </div>
                            <div>
                              <h3 className="font-semibold text-white">{player.name}</h3>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-white/50">
                                  {player.age} anos
                                </span>
                                <span className="text-xs text-white/50">
                                  {player.nationality}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-amber-400 flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  Potencial: {player.revealedAttributes ? player.potential : "??"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right space-y-2">
                            <div>
                              <p className="text-xs text-white/40">Valor de Mercado</p>
                              <p className="text-sm font-semibold text-white">
                                R$ {player.marketValue.toLocaleString("pt-BR")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {!player.revealedAttributes && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => gameEngine.revealScoutedLead(player.id)}
                                  className="border-white/10 text-white/70 hover:text-white text-xs"
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  Revelar (R$ 50K)
                                </Button>
                              )}
                              <Button
                                size="sm"
                                className="bg-[#00ffc8] hover:bg-[#00c8ff] text-black text-xs"
                              >
                                <Target className="h-3.5 w-3.5 mr-1" />
                                Negociar
                              </Button>
                            </div>
                          </div>
                        </div>

                        {player.revealedAttributes && (
                          <div className="mt-4 pt-4 border-t border-white/[0.04] grid grid-cols-6 gap-2">
                            {[
                              { label: "RIT", value: player.pace },
                              { label: "FIN", value: player.shooting },
                              { label: "PAS", value: player.passing },
                              { label: "DRI", value: player.dribbling },
                              { label: "DEF", value: player.defending },
                              { label: "FIS", value: player.physical },
                            ].map((attr) => (
                              <div key={attr.label} className="text-center">
                                <p className="text-[10px] text-white/40">{attr.label}</p>
                                <p className={cn(
                                  "text-sm font-bold",
                                  attr.value >= 80 ? "text-[#00ffc8]" :
                                  attr.value >= 70 ? "text-amber-400" :
                                  attr.value >= 60 ? "text-white" : "text-white/50"
                                )}>
                                  {attr.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modal de contratacao */}
      <AnimatePresence>
        {showHireModal && selectedScoutToHire && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setShowHireModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md mx-4 p-6 rounded-2xl bg-[#1a1a1a] border border-white/10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Contratar Olheiro</h3>
                <button
                  onClick={() => setShowHireModal(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-white/5 mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                    <Briefcase className="h-6 w-6 text-white/60" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{selectedScoutToHire.name}</h4>
                    <p className="text-sm text-white/50">Especialista: {selectedScoutToHire.region}</p>
                    <div className="flex items-center gap-0.5 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-3 w-3",
                            i < selectedScoutToHire.skill ? "text-amber-400 fill-amber-400" : "text-white/20"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Salario Semanal</span>
                  <span className="font-medium text-white">
                    R$ {selectedScoutToHire.salary.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Custo Anual Estimado</span>
                  <span className="font-medium text-amber-400">
                    R$ {(selectedScoutToHire.salary * 52).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowHireModal(false)}
                  className="flex-1 border-white/10 text-white/70"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => handleHireScout(selectedScoutToHire)}
                  className="flex-1 bg-[#00ffc8] hover:bg-[#00c8ff] text-black"
                >
                  Confirmar Contratacao
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
