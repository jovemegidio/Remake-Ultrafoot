"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  Dumbbell,
  Target,
  Zap,
  Shield,
  Heart,
  Brain,
  TrendingUp,
  Clock,
  Star,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Timer,
  Users,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Progress } from "@/components/ui/progress"
import { useRouter } from "next/navigation"
import { useUserTeam } from "@/lib/save-system"
import { useGameEngine, type Player } from "@/lib/game-engine"
import { cn } from "@/lib/utils"

// Tipos de treinamento disponiveis
const trainingTypes = [
  { 
    id: "pace", 
    name: "Velocidade", 
    icon: Zap, 
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    description: "Melhora sprint e aceleracao"
  },
  { 
    id: "shooting", 
    name: "Finalizacao", 
    icon: Target, 
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    description: "Melhora chute e precisao"
  },
  { 
    id: "passing", 
    name: "Passe", 
    icon: TrendingUp, 
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    description: "Melhora passes curtos e longos"
  },
  { 
    id: "dribbling", 
    name: "Dribles", 
    icon: Star, 
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    description: "Melhora controle de bola"
  },
  { 
    id: "defending", 
    name: "Defesa", 
    icon: Shield, 
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    description: "Melhora marcacao e desarme"
  },
  { 
    id: "physical", 
    name: "Fisico", 
    icon: Dumbbell, 
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    description: "Melhora forca e resistencia"
  },
]

// Posicoes com seus atributos recomendados
const positionTrainingRecommendations: Record<string, string[]> = {
  "GOL": ["physical", "passing"],
  "LD": ["pace", "defending", "physical"],
  "LE": ["pace", "defending", "physical"],
  "ZAG": ["defending", "physical", "passing"],
  "VOL": ["defending", "passing", "physical"],
  "MEI": ["passing", "dribbling", "shooting"],
  "MC": ["passing", "physical", "shooting"],
  "PD": ["pace", "dribbling", "shooting"],
  "PE": ["pace", "dribbling", "shooting"],
  "ATA": ["shooting", "pace", "dribbling"],
  "SA": ["shooting", "dribbling", "passing"],
}

function getRecommendedTraining(position: string): string[] {
  return positionTrainingRecommendations[position] || ["physical", "passing"]
}

export default function TreinamentoPage() {
  const { team: userTeam } = useUserTeam()
  const { squadPlayers, trainPlayer, currentWeek } = useGameEngine()
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedTraining, setSelectedTraining] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "available" | "training">("all")
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filtra jogadores
  const filteredPlayers = useMemo(() => {
    let players = [...squadPlayers]
    
    if (filter === "available") {
      players = players.filter(p => !p.training.currentFocus && !p.injury)
    } else if (filter === "training") {
      players = players.filter(p => p.training.currentFocus)
    }
    
    // Ordena por overall
    return players.sort((a, b) => b.overall - a.overall)
  }, [squadPlayers, filter])

  const router = useRouter()
  const [gpPlayerIdx, setGpPlayerIdx] = useState(0)

  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (!btn) return
      if (btn === "B") {
        if (selectedPlayer) { setSelectedPlayer(null); return }
        router.back(); return
      }
      const filterOrder: ("all" | "available" | "training")[] = ["all", "available", "training"]
      if (btn === "LB") setFilter(f => filterOrder[Math.max(0, filterOrder.indexOf(f) - 1)])
      if (btn === "RB") setFilter(f => filterOrder[Math.min(filterOrder.length - 1, filterOrder.indexOf(f) + 1)])
      if (btn === "DPAD_DOWN") {
        setGpPlayerIdx(prev => {
          const next = Math.min(prev + 1, filteredPlayers.length - 1)
          setSelectedPlayer(filteredPlayers[next] ?? null)
          return next
        })
      }
      if (btn === "DPAD_UP") {
        setGpPlayerIdx(prev => {
          const next = Math.max(prev - 1, 0)
          setSelectedPlayer(filteredPlayers[next] ?? null)
          return next
        })
      }
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router, selectedPlayer, filteredPlayers])

  // Contagem de jogadores em treinamento
  const playersInTraining = squadPlayers.filter(p => p.training.currentFocus).length

  // Inicia treinamento
  const handleStartTraining = () => {
    if (selectedPlayer && selectedTraining) {
      const type = trainingTypes.find(t => t.id === selectedTraining)
      trainPlayer(selectedPlayer.id, selectedTraining)
      const label = type?.name ?? selectedTraining
      setFeedback(`+1 ${label} em progresso para ${selectedPlayer.name}!`)
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
      feedbackTimer.current = setTimeout(() => setFeedback(null), 3000)
      setSelectedPlayer(null)
      setSelectedTraining(null)
    }
  }

  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current) }, [])

  // Verifica se jogador pode treinar
  const canTrain = (player: Player) => {
    return !player.injury && player.energy >= 30
  }

  return (
    <div className="h-screen pl-16 bg-[#050508] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />

      {/* Toast de feedback de treinamento */}
      {feedback && (
        <div className="fixed top-20 right-6 z-50 px-5 py-3 rounded-xl bg-[#00ffc8] text-black font-bold text-sm shadow-2xl animate-in slide-in-from-right-4 duration-300">
          {feedback}
        </div>
      )}

      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Centro de Treinamento</h1>
            <p className="text-sm text-white/50 mt-1">Desenvolva os atributos dos seus jogadores</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0c0c10] border border-white/[0.04]">
              <Dumbbell className="h-4 w-4 text-[#00ffc8]" />
              <span className="text-sm text-white/70">{playersInTraining} em treinamento</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Lista de Jogadores */}
          <div className="lg:col-span-2 rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
            {/* Filtros */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                <Users className="h-4 w-4 text-[#00ffc8]" />
                ELENCO
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilter("all")}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                    filter === "all" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
                  )}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilter("available")}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                    filter === "available" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
                  )}
                >
                  Disponiveis
                </button>
                <button
                  onClick={() => setFilter("training")}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                    filter === "training" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
                  )}
                >
                  Em Treino
                </button>
              </div>
            </div>

            {/* Lista */}
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {filteredPlayers.map(player => {
                const isSelected = selectedPlayer?.id === player.id
                const isTraining = !!player.training.currentFocus
                const canPlayerTrain = canTrain(player)
                const recommended = getRecommendedTraining(player.position)
                
                return (
                  <button
                    key={player.id}
                    onClick={() => canPlayerTrain && !isTraining && setSelectedPlayer(player)}
                    disabled={!canPlayerTrain || isTraining}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-4 text-left transition-colors",
                      isSelected && "bg-[#00ffc8]/10 border-l-2 border-[#00ffc8]",
                      !isSelected && canPlayerTrain && !isTraining && "hover:bg-white/5",
                      (!canPlayerTrain || isTraining) && "opacity-60"
                    )}
                  >
                    {/* Avatar / Info basica */}
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-sm font-bold text-white">
                          {player.overall}
                        </div>
                        {player.injury && (
                          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                            <AlertCircle className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">{player.name}</div>
                        <div className="text-xs text-white/50">{player.position} · {player.age} anos</div>
                      </div>
                    </div>

                    {/* Atributos */}
                    <div className="flex-1 grid grid-cols-6 gap-2">
                      {trainingTypes.map(type => {
                        const value = player[type.id as keyof Player] as number
                        const isRecommended = recommended.includes(type.id)
                        const Icon = type.icon
                        
                        return (
                          <div key={type.id} className="text-center">
                            <div className={cn(
                              "text-[10px] text-white/40 flex items-center justify-center gap-1",
                              isRecommended && "text-[#00ffc8]"
                            )}>
                              <Icon className="h-3 w-3" />
                            </div>
                            <div className={cn(
                              "text-sm font-medium",
                              value >= 80 ? "text-[#00ffc8]" : 
                              value >= 70 ? "text-white" : "text-white/60"
                            )}>
                              {value}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Status */}
                    <div className="min-w-[120px] text-right">
                      {isTraining ? (
                        <div className="flex items-center gap-2 justify-end">
                          <Timer className="h-4 w-4 text-[#ffd700]" />
                          <span className="text-xs text-[#ffd700]">
                            {player.training.currentFocus} ({player.training.weeksTrained}/4 sem)
                          </span>
                        </div>
                      ) : player.injury ? (
                        <div className="flex items-center gap-2 justify-end">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span className="text-xs text-red-500">Lesionado</span>
                        </div>
                      ) : player.energy < 30 ? (
                        <div className="flex items-center gap-2 justify-end">
                          <Heart className="h-4 w-4 text-orange-500" />
                          <span className="text-xs text-orange-500">Cansado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 justify-end">
                          <CheckCircle2 className="h-4 w-4 text-[#00ffc8]" />
                          <span className="text-xs text-[#00ffc8]">Disponivel</span>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Painel de Treinamento */}
          <div className="space-y-4">
            {/* Jogador Selecionado */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60 mb-4">
                <Target className="h-4 w-4 text-[#00ffc8]" />
                JOGADOR SELECIONADO
              </div>

              {selectedPlayer ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#00ffc8]/20 to-[#00ffc8]/5 flex items-center justify-center text-xl font-bold text-[#00ffc8]">
                      {selectedPlayer.overall}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{selectedPlayer.name}</div>
                      <div className="text-sm text-white/50">{selectedPlayer.position} · {selectedPlayer.age} anos</div>
                      <div className="text-xs text-white/40">Potencial: {selectedPlayer.potential}</div>
                    </div>
                  </div>

                  {/* Energia */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">Energia</span>
                      <span className="text-white">{selectedPlayer.energy}%</span>
                    </div>
                    <Progress value={selectedPlayer.energy} className="h-2" />
                  </div>

                  {/* Recomendacoes */}
                  <div className="pt-2 border-t border-white/[0.04]">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Treinos Recomendados</div>
                    <div className="flex flex-wrap gap-1">
                      {getRecommendedTraining(selectedPlayer.position).map(rec => {
                        const type = trainingTypes.find(t => t.id === rec)
                        if (!type) return null
                        return (
                          <span key={rec} className={cn("px-2 py-1 rounded text-[10px] font-medium", type.bgColor, type.color)}>
                            {type.name}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-white/40 text-sm">
                  Selecione um jogador para treinar
                </div>
              )}
            </div>

            {/* Tipos de Treinamento */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60 mb-4">
                <Dumbbell className="h-4 w-4 text-[#00ffc8]" />
                TIPO DE TREINAMENTO
              </div>

              <div className="space-y-2">
                {trainingTypes.map(type => {
                  const Icon = type.icon
                  const isSelected = selectedTraining === type.id
                  const currentValue = selectedPlayer ? (selectedPlayer[type.id as keyof Player] as number) : 0
                  const maxValue = selectedPlayer?.potential || 99
                  const canImprove = currentValue < maxValue
                  
                  return (
                    <button
                      key={type.id}
                      onClick={() => selectedPlayer && canImprove && setSelectedTraining(type.id)}
                      disabled={!selectedPlayer || !canImprove}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                        isSelected 
                          ? "border-[#00ffc8] bg-[#00ffc8]/10" 
                          : "border-white/[0.04] hover:border-white/10 hover:bg-white/5",
                        (!selectedPlayer || !canImprove) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", type.bgColor)}>
                        <Icon className={cn("h-5 w-5", type.color)} />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{type.name}</div>
                        <div className="text-[10px] text-white/40">{type.description}</div>
                      </div>
                      {selectedPlayer && (
                        <div className="text-right">
                          <div className="text-sm font-bold text-white">{currentValue}</div>
                          <div className="text-[10px] text-white/40">max {maxValue}</div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Botao de Iniciar */}
            <button
              onClick={handleStartTraining}
              disabled={!selectedPlayer || !selectedTraining}
              className={cn(
                "w-full py-4 rounded-xl font-semibold text-sm transition-colors",
                selectedPlayer && selectedTraining
                  ? "bg-[#00ffc8] text-black hover:bg-[#00c8ff]"
                  : "bg-white/5 text-white/30 cursor-not-allowed"
              )}
            >
              {selectedPlayer && selectedTraining 
                ? `Iniciar Treinamento de ${trainingTypes.find(t => t.id === selectedTraining)?.name}`
                : "Selecione jogador e treinamento"
              }
            </button>

            {/* Info */}
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-white/60">
                  <p className="font-medium text-white/80 mb-1">Como funciona</p>
                  <p>O treinamento dura 4 semanas. Ao final, o jogador tem 70% de chance de melhorar +1 no atributo escolhido, limitado ao seu potencial maximo.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}
