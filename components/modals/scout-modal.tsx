"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Search, 
  MapPin, 
  Star, 
  DollarSign,
  Globe,
  Users,
  Eye,
  Clock,
  CheckCircle2,
  Plus,
  TrendingUp
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type Scout, type Player } from "@/lib/game-engine"

interface ScoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scouts: Scout[]
  discoveredPlayers: Player[]
  onHireScout?: (scout: Scout) => void
  onStartSearch?: (scoutId: number, region: string) => void
  onViewPlayer?: (player: Player) => void
  teamBalance: number
}

const regions = [
  { id: "brasil", name: "Brasil", icon: "BR", color: "text-green-500", bgColor: "bg-green-500/10" },
  { id: "americas", name: "Americas", icon: "AM", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { id: "europa", name: "Europa", icon: "EU", color: "text-[#ffd700]", bgColor: "bg-[#ffd700]/10" },
  { id: "asia", name: "Asia & Oceania", icon: "AS", color: "text-red-500", bgColor: "bg-red-500/10" },
]

const availableScouts: Scout[] = [
  { id: 101, name: "Carlos Mendes", region: "Brasil", skill: 4, salary: 25000, isSearching: false, searchProgress: 0, foundPlayers: [], weeksToComplete: 4, searchCost: 10000 },
  { id: 102, name: "Roberto Alves", region: "Brasil", skill: 3, salary: 15000, isSearching: false, searchProgress: 0, foundPlayers: [], weeksToComplete: 4, searchCost: 8000 },
  { id: 103, name: "Juan Garcia", region: "Americas", skill: 4, salary: 30000, isSearching: false, searchProgress: 0, foundPlayers: [], weeksToComplete: 6, searchCost: 20000 },
  { id: 104, name: "Hans Mueller", region: "Europa", skill: 5, salary: 50000, isSearching: false, searchProgress: 0, foundPlayers: [], weeksToComplete: 8, searchCost: 40000 },
  { id: 105, name: "Pierre Dupont", region: "Europa", skill: 4, salary: 35000, isSearching: false, searchProgress: 0, foundPlayers: [], weeksToComplete: 8, searchCost: 30000 },
  { id: 106, name: "Kenji Tanaka", region: "Asia", skill: 3, salary: 20000, isSearching: false, searchProgress: 0, foundPlayers: [], weeksToComplete: 10, searchCost: 25000 },
]

export function ScoutModal({
  open,
  onOpenChange,
  scouts,
  discoveredPlayers,
  onHireScout,
  onStartSearch,
  onViewPlayer,
  teamBalance,
}: ScoutModalProps) {
  const [activeTab, setActiveTab] = useState<"scouts" | "discover" | "hire">("scouts")
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [selectedScout, setSelectedScout] = useState<Scout | null>(null)

  const formatSalary = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`
    return `R$ ${(value / 1000).toFixed(0)}K`
  }

  const renderStars = (skill: number) => {
    return Array(5).fill(0).map((_, i) => (
      <Star 
        key={i} 
        className={cn(
          "h-3 w-3",
          i < skill ? "fill-yellow-400 text-yellow-400" : "text-white/20"
        )} 
      />
    ))
  }

  const unhiredScouts = useMemo(() => {
    return availableScouts.filter(s => !scouts.find(hired => hired.id === s.id))
  }, [scouts])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-[#0c0c10] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Eye className="h-5 w-5 text-[var(--brand)]" />
            Central de Olheiros
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Descubra novos talentos pelo mundo
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-white/5">
          <button
            onClick={() => setActiveTab("scouts")}
            className={cn(
              "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all",
              activeTab === "scouts" 
                ? "bg-[var(--brand)] text-[var(--brand-ink)]" 
                : "text-white/50 hover:text-white"
            )}
          >
            Meus Olheiros ({scouts.length})
          </button>
          <button
            onClick={() => setActiveTab("discover")}
            className={cn(
              "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all",
              activeTab === "discover" 
                ? "bg-[var(--brand)] text-[var(--brand-ink)]" 
                : "text-white/50 hover:text-white"
            )}
          >
            Descobertas ({discoveredPlayers.length})
          </button>
          <button
            onClick={() => setActiveTab("hire")}
            className={cn(
              "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all",
              activeTab === "hire" 
                ? "bg-[var(--brand)] text-[var(--brand-ink)]" 
                : "text-white/50 hover:text-white"
            )}
          >
            Contratar
          </button>
        </div>

        <div className="min-h-[400px] py-4">
          {/* My Scouts Tab */}
          {activeTab === "scouts" && (
            <div className="space-y-4">
              {scouts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-white/30" />
                  </div>
                  <p className="text-white/50">Voce ainda nao tem olheiros contratados</p>
                  <Button 
                    onClick={() => setActiveTab("hire")}
                    className="mt-4 bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Contratar Olheiro
                  </Button>
                </div>
              ) : (
                scouts.map(scout => (
                  <div key={scout.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-[var(--brand)]/20 flex items-center justify-center">
                        <Eye className="h-6 w-6 text-[var(--brand)]" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-white">{scout.name}</div>
                        <div className="flex items-center gap-2 text-sm text-white/50">
                          <MapPin className="h-3 w-3" />
                          {scout.region}
                          <span className="text-white/20">|</span>
                          <div className="flex">{renderStars(scout.skill)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white/50">Salario</div>
                        <div className="font-semibold text-white">{formatSalary(scout.salary)}/sem</div>
                      </div>
                    </div>

                    {scout.isSearching ? (
                      <div className="mt-4 p-3 rounded-lg bg-[var(--brand)]/10 border border-[var(--brand)]/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-[var(--brand)]">Buscando em {scout.region}...</span>
                          <span className="text-sm text-white">{scout.searchProgress}%</span>
                        </div>
                        <Progress value={scout.searchProgress} className="h-2" />
                      </div>
                    ) : (
                      <div className="mt-4 flex gap-2">
                        {regions.map(region => (
                          <button
                            key={region.id}
                            onClick={() => onStartSearch?.(scout.id, region.id)}
                            className={cn(
                              "flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all border",
                              region.bgColor,
                              region.color,
                              "border-white/10 hover:border-white/20"
                            )}
                          >
                            Buscar em {region.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Discoveries Tab */}
          {activeTab === "discover" && (
            <div className="space-y-3">
              {discoveredPlayers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-white/30" />
                  </div>
                  <p className="text-white/50">Nenhum jogador descoberto ainda</p>
                  <p className="text-xs text-white/30 mt-2">Envie seus olheiros para buscar talentos</p>
                </div>
              ) : (
                discoveredPlayers.map(player => (
                  <button
                    key={player.id}
                    onClick={() => onViewPlayer?.(player)}
                    className="w-full p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-lg font-bold text-white">
                          {player.name.charAt(0)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#ffd700] flex items-center justify-center text-xs font-bold text-black">
                          {player.overall}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-white group-hover:text-[var(--brand)] transition-colors">
                          {player.name}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/50">
                          <span>{player.position}</span>
                          <span className="text-white/20">|</span>
                          <span>{player.age} anos</span>
                          <span className="text-white/20">|</span>
                          <span>{player.nationality}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-[var(--brand)]">
                          <TrendingUp className="h-4 w-4" />
                          <span className="font-bold">{player.potential}</span>
                        </div>
                        <div className="text-xs text-white/50">Potencial</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-white">{formatSalary(player.marketValue)}</div>
                        <div className="text-xs text-white/50">Valor</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Hire Tab */}
          {activeTab === "hire" && (
            <div className="space-y-3">
              {unhiredScouts.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-[var(--brand)] mb-4" />
                  <p className="text-white">Todos os olheiros disponiveis foram contratados!</p>
                </div>
              ) : (
                unhiredScouts.map(scout => (
                  <div key={scout.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white/50" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-white">{scout.name}</div>
                        <div className="flex items-center gap-2 text-sm text-white/50">
                          <Globe className="h-3 w-3" />
                          Especialista em {scout.region}
                          <span className="text-white/20">|</span>
                          <div className="flex">{renderStars(scout.skill)}</div>
                        </div>
                      </div>
                      <div className="text-right mr-4">
                        <div className="text-sm text-white/50">Salario</div>
                        <div className="font-semibold text-[#ffd700]">{formatSalary(scout.salary)}/sem</div>
                      </div>
                      <Button
                        onClick={() => onHireScout?.(scout)}
                        disabled={teamBalance < scout.salary * 4}
                        className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)] disabled:opacity-50"
                      >
                        Contratar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="border-white/10 text-white/70"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
