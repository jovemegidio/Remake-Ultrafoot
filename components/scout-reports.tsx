"use client"

import { useMemo, useState } from "react"
import {
  Search,
  Target,
  Globe,
  Star,
  TrendingUp,
  Clock,
  User,
  ChevronRight,
  Play,
  Pause,
  DollarSign,
  MapPin,
  Calendar,
  Shield,
  Loader2,
} from "lucide-react"
import { useGameEngine, type Scout, AVAILABLE_SCOUTS, type ScoutedPlayer } from "@/lib/game-engine"
import { formatCurrency } from "@/lib/teams-data"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

const REGIONS = [
  { id: "Brasil", name: "Brasil", flag: "BR" },
  { id: "Americas", name: "Americas", flag: "AR" },
  { id: "Europa", name: "Europa", flag: "EU" },
  { id: "Africa", name: "Africa", flag: "NG" },
  { id: "Asia", name: "Asia", flag: "JP" },
]

export function ScoutReports() {
  const gameEngine = useGameEngine()
  const [selectedScout, setSelectedScout] = useState<Scout | null>(null)
  const [showHireModal, setShowHireModal] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  
  // Olheiros contratados
  const hiredScouts = gameEngine.scouts
  
  // Olheiros disponiveis para contratar
  const availableScouts = useMemo(() => {
    const hiredIds = hiredScouts.map(s => s.id)
    return AVAILABLE_SCOUTS.filter(s => !hiredIds.includes(s.id))
  }, [hiredScouts])
  
  // IDs dos jogadores descobertos (foundPlayers é number[])
  const discoveredPlayerIds = useMemo(() => {
    return hiredScouts.flatMap(s => s.foundPlayers || [])
  }, [hiredScouts])

  // Converte IDs em objetos ScoutedPlayer para display
  const discoveredPlayers = useMemo((): ScoutedPlayer[] => {
    return discoveredPlayerIds
      .map(id => {
        const p = gameEngine.getPlayerById(id)
        if (!p) return null
        return {
          id: p.id,
          name: p.name,
          position: p.position,
          team: "Mercado",
          age: p.age,
          nationality: p.nationality,
          overall: p.overall,
          potential: p.potential,
          value: p.marketValue,
          reportProgress: 100,
        } as ScoutedPlayer
      })
      .filter((p): p is ScoutedPlayer => p !== null)
  }, [discoveredPlayerIds, gameEngine])
  
  const handleHireScout = (scoutData: typeof AVAILABLE_SCOUTS[0]) => {
    const newScout: Scout = {
      ...scoutData,
      isSearching: false,
      searchProgress: 0,
      searchTarget: null,
      foundPlayers: [],
      weeksSearching: 0,
    }
    gameEngine.hireScout(newScout)
    setShowHireModal(false)
  }
  
  const handleStartSearch = (scoutId: number, region: string) => {
    gameEngine.startScoutSearch(scoutId, region)
    setSelectedRegion(null)
  }
  
  const handleStopSearch = (scoutId: number) => {
    gameEngine.stopScoutSearch(scoutId)
  }
  
  const handleFireScout = (scoutId: number) => {
    gameEngine.fireScout(scoutId)
    setSelectedScout(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Departamento de Olheiros</h2>
          <p className="text-sm text-white/50">
            {hiredScouts.length} olheiro(s) contratado(s) - {discoveredPlayers.length} jogador(es) descoberto(s)
          </p>
        </div>
        <button
          onClick={() => setShowHireModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-ink)] text-sm font-semibold hover:bg-[var(--brand-2)] transition-colors"
        >
          <User className="h-4 w-4" />
          Contratar Olheiro
        </button>
      </div>

      {/* Scouts Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {hiredScouts.map(scout => (
          <ScoutCard 
            key={scout.id} 
            scout={scout}
            onSelect={() => setSelectedScout(scout)}
            onStartSearch={(region) => handleStartSearch(scout.id, region)}
            onStopSearch={() => handleStopSearch(scout.id)}
          />
        ))}
        
        {hiredScouts.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Target className="h-8 w-8 text-white/30" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Nenhum olheiro contratado</h3>
            <p className="text-sm text-white/50 max-w-md mb-4">
              Contrate olheiros para descobrir novos talentos ao redor do mundo.
            </p>
            <button
              onClick={() => setShowHireModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-ink)] text-sm font-semibold hover:bg-[var(--brand-2)] transition-colors"
            >
              <User className="h-4 w-4" />
              Contratar Primeiro Olheiro
            </button>
          </div>
        )}
      </div>

      {/* Discovered Players */}
      {discoveredPlayers.length > 0 && (
        <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-400" />
              <h3 className="text-xs font-medium text-white tracking-wider uppercase">
                Jogadores Descobertos
              </h3>
            </div>
            <span className="text-xs text-white/40">{discoveredPlayers.length} jogador(es)</span>
          </div>
          <div className="divide-y divide-white/5 max-h-96 overflow-y-auto scrollbar-thin">
            {discoveredPlayers.map(player => (
              <DiscoveredPlayerRow key={player.id} player={player} />
            ))}
          </div>
        </div>
      )}

      {/* Hire Modal */}
      {showHireModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-2xl mx-4 rounded-xl bg-[#1a1a1a] border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
              <h3 className="text-lg font-semibold text-white">Contratar Olheiro</h3>
              <button
                onClick={() => setShowHireModal(false)}
                className="text-white/50 hover:text-white"
              >
                &times;
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {availableScouts.length > 0 ? (
                <div className="space-y-3">
                  {availableScouts.map(scout => (
                    <div
                      key={scout.id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.03] border border-white/[0.04] hover:border-white/10 transition-colors"
                    >
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                        <User className="h-6 w-6 text-white/50" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{scout.name}</span>
                          <span className="text-xs text-white/40">{scout.nationality}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/50 mt-1">
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {scout.region}
                          </span>
                          <span className="flex items-center gap-1">
                            {[...Array(scout.skill)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                            ))}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-white">{formatCurrency(scout.salary)}/sem</div>
                        <button
                          onClick={() => handleHireScout(scout)}
                          className="mt-1 text-xs text-[var(--brand)] hover:underline"
                        >
                          Contratar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/50">
                  Nenhum olheiro disponivel para contratacao
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ScoutCard({ 
  scout, 
  onSelect,
  onStartSearch,
  onStopSearch
}: { 
  scout: Scout
  onSelect: () => void
  onStartSearch: (region: string) => void
  onStopSearch: () => void
}) {
  const [showRegions, setShowRegions] = useState(false)
  const gameEngine = useGameEngine()
  
  return (
    <div className="rounded-xl bg-[#1a1a1a] border border-white/10 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-white">{scout.name}</div>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span>{scout.nationality}</span>
              <span className="flex items-center gap-0.5">
                {[...Array(scout.skill)].map((_, i) => (
                  <Star key={i} className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                ))}
              </span>
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="text-white/40">Salario</div>
            <div className="font-medium text-white">{formatCurrency(scout.salary)}/sem</div>
          </div>
        </div>
        
        {/* Search Status */}
        {scout.isSearching ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Buscando em {scout.searchTarget}</span>
              <span className="text-[var(--brand)]">{scout.searchProgress}%</span>
            </div>
            <Progress value={scout.searchProgress} className="h-1.5" />
            <div className="flex items-center gap-2">
              <button
                onClick={onStopSearch}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
              >
                <Pause className="h-3.5 w-3.5" />
                Parar Busca
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {showRegions ? (
              <div className="space-y-2">
                <div className="text-xs text-white/40 mb-2">Selecione uma regiao:</div>
                <div className="grid grid-cols-2 gap-2">
                  {REGIONS.map(region => (
                    <button
                      key={region.id}
                      onClick={() => {
                        onStartSearch(region.id)
                        setShowRegions(false)
                      }}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white transition-colors"
                    >
                      {region.name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowRegions(false)}
                  className="w-full py-2 text-xs text-white/50 hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowRegions(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-ink)] text-xs font-semibold hover:bg-[var(--brand-2)] transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                Iniciar Busca
              </button>
            )}
          </div>
        )}
        
        {/* Found Players Count */}
        {scout.foundPlayers && scout.foundPlayers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs">
            <span className="text-white/50">Jogadores descobertos</span>
            <span className="font-medium text-[var(--brand)]">{scout.foundPlayers.length}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function DiscoveredPlayerRow({ player }: { player: ScoutedPlayer }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
        <User className="h-5 w-5 text-white/50" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white truncate">{player.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">{player.position}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/50 mt-0.5">
          <span>{player.team}</span>
          <span>{player.age} anos</span>
          <span>{player.nationality}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-lg font-bold text-[var(--brand)]">{player.overall}</div>
          <div className="text-[10px] text-white/40">OVR</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-yellow-400">{player.potential}</div>
          <div className="text-[10px] text-white/40">POT</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-white">{formatCurrency(player.value)}</div>
          <div className="text-[10px] text-white/40">Valor</div>
        </div>
      </div>
      
      {/* Report Progress */}
      <div className="w-20">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-white/40">Relatorio</span>
          <span className="text-white">{player.reportProgress}%</span>
        </div>
        <Progress value={player.reportProgress} className="h-1" />
      </div>
    </div>
  )
}
