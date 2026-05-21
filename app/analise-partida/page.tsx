"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Zap,
  Users,
  AlertTriangle,
  CheckCircle2,
  Star,
  ChevronRight,
  ChevronDown,
  Activity,
  Percent,
  Goal,
  Timer,
  ArrowRight,
  ThumbsUp,
  ThumbsDown
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useGameState } from "@/lib/save-system"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameEngine, type PostMatchAnalysis, type AnalysisPoint } from "@/lib/game-engine"

const CATEGORY_INFO: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  ataque: { label: "Ataque", icon: Zap, color: "text-red-400" },
  defesa: { label: "Defesa", icon: Shield, color: "text-blue-400" },
  meio: { label: "Meio-Campo", icon: Activity, color: "text-green-400" },
  tatica: { label: "Tatica", icon: Target, color: "text-purple-400" },
  individual: { label: "Individual", icon: Star, color: "text-yellow-400" },
  coletivo: { label: "Coletivo", icon: Users, color: "text-cyan-400" },
}

export default function AnalisePartidaPage() {
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const gameEngine = useGameEngine()
  
  const [selectedAnalysisIndex, setSelectedAnalysisIndex] = useState(0)
  const [expandedSection, setExpandedSection] = useState<"positives" | "negatives" | "players" | "stats" | null>("positives")
  
  const { postMatchAnalyses, currentWeek } = gameEngine

  const selectedAnalysis = postMatchAnalyses[selectedAnalysisIndex] || null

  // Calcula tendencias
  const recentTrend = useMemo(() => {
    if (postMatchAnalyses.length < 2) return 0
    const recent = postMatchAnalyses.slice(0, 3)
    const avgRating = recent.reduce((sum, a) => sum + a.overallRating, 0) / recent.length
    return avgRating >= 7 ? 1 : avgRating < 5 ? -1 : 0
  }, [postMatchAnalyses])

  const renderRatingBadge = (rating: number) => {
    const color = rating >= 7.5 ? "bg-green-500/20 text-green-400 border-green-500/30" :
                  rating >= 6 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                  "bg-red-500/20 text-red-400 border-red-500/30"
    return (
      <span className={cn("px-3 py-1 rounded-lg border text-lg font-bold", color)}>
        {rating.toFixed(1)}
      </span>
    )
  }

  const renderAnalysisPoint = (point: AnalysisPoint, isPositive: boolean) => {
    const catInfo = CATEGORY_INFO[point.category]
    const Icon = catInfo?.icon || Target
    
    return (
      <div className={cn(
        "p-4 rounded-xl border",
        isPositive ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
      )}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className={cn("h-4 w-4", catInfo?.color || "text-white/60")} />
          <span className="text-xs font-medium text-white/50">{catInfo?.label}</span>
          <span className={cn(
            "ml-auto text-xs px-2 py-0.5 rounded-full",
            point.impact === "alto" ? "bg-white/20 text-white" :
            point.impact === "medio" ? "bg-white/10 text-white/70" :
            "bg-white/5 text-white/50"
          )}>
            {point.impact}
          </span>
        </div>
        <h4 className="text-sm font-semibold text-white mb-1">{point.title}</h4>
        <p className="text-xs text-white/60">{point.description}</p>
      </div>
    )
  }

  return (
    <div className="h-screen pl-16 bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />
      
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  <BarChart3 className="h-7 w-7 text-primary" />
                  Analise Pos-Partida
                </h1>
                <p className="text-white/60 mt-1">
                  Avaliacao tatica detalhada das suas partidas
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-white/50">Tendencia Recente</div>
                  <div className="flex items-center gap-2">
                    {recentTrend > 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-400" />
                    ) : recentTrend < 0 ? (
                      <TrendingDown className="h-5 w-5 text-red-400" />
                    ) : (
                      <Activity className="h-5 w-5 text-yellow-400" />
                    )}
                    <span className={cn(
                      "font-medium",
                      recentTrend > 0 ? "text-green-400" :
                      recentTrend < 0 ? "text-red-400" :
                      "text-yellow-400"
                    )}>
                      {recentTrend > 0 ? "Em alta" : recentTrend < 0 ? "Em baixa" : "Estavel"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {postMatchAnalyses.length === 0 ? (
              <div className="bg-[#12121a] rounded-xl border border-white/5 p-12 text-center">
                <BarChart3 className="h-16 w-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white/60 mb-2">Nenhuma analise disponivel</h3>
                <p className="text-white/40">
                  Jogue partidas para receber analises taticas detalhadas
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-6">
                
                {/* Lista de Partidas */}
                <div className="col-span-4 bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
                  <div className="p-4 border-b border-white/5">
                    <h3 className="text-sm font-semibold text-white/80">Partidas Analisadas</h3>
                  </div>
                  
                  <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
                    {postMatchAnalyses.map((analysis, index) => {
                      const won = analysis.isHome 
                        ? analysis.result.home > analysis.result.away
                        : analysis.result.away > analysis.result.home
                      const lost = analysis.isHome
                        ? analysis.result.home < analysis.result.away
                        : analysis.result.away < analysis.result.home
                      
                      return (
                        <button
                          key={analysis.matchId}
                          onClick={() => setSelectedAnalysisIndex(index)}
                          className={cn(
                            "w-full p-4 border-b border-white/5 text-left transition-all",
                            selectedAnalysisIndex === index
                              ? "bg-primary/20 border-l-2 border-l-primary"
                              : "hover:bg-white/5"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-white/50">Semana {analysis.week}</span>
                            {renderRatingBadge(analysis.overallRating)}
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className="text-white font-medium">
                              {analysis.isHome ? userTeam.short : analysis.opponent}
                            </span>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-sm font-bold",
                              won ? "bg-green-500/20 text-green-400" :
                              lost ? "bg-red-500/20 text-red-400" :
                              "bg-white/10 text-white/60"
                            )}>
                              {analysis.result.home} - {analysis.result.away}
                            </span>
                            <span className="text-white font-medium">
                              {analysis.isHome ? analysis.opponent : userTeam.short}
                            </span>
                          </div>
                          
                          <div className="mt-2 text-xs text-white/40">
                            {analysis.isHome ? "Casa" : "Fora"} vs {analysis.opponent}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Detalhes da Analise */}
                {selectedAnalysis && (
                  <div className="col-span-8 space-y-6">
                    
                    {/* Cabecalho da Analise */}
                    <div className="bg-[#12121a] rounded-xl border border-white/5 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-sm text-white/50 mb-1">Semana {selectedAnalysis.week}</div>
                          <h2 className="text-xl font-bold text-white">
                            {selectedAnalysis.isHome ? userTeam.name : selectedAnalysis.opponent}
                            <span className="mx-3 text-primary">
                              {selectedAnalysis.result.home} - {selectedAnalysis.result.away}
                            </span>
                            {selectedAnalysis.isHome ? selectedAnalysis.opponent : userTeam.name}
                          </h2>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-xs text-white/50 mb-1">Avaliacao Geral</div>
                          {renderRatingBadge(selectedAnalysis.overallRating)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/5 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-white">{selectedAnalysis.tacticsRating.toFixed(1)}</div>
                          <div className="text-xs text-white/50">Nota Tatica</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-primary">{selectedAnalysis.tacticAdherence}%</div>
                          <div className="text-xs text-white/50">Aderencia Tatica</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-white">{selectedAnalysis.keyStats.possession}%</div>
                          <div className="text-xs text-white/50">Posse de Bola</div>
                        </div>
                      </div>
                    </div>

                    {/* Pontos Positivos */}
                    <div className="bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedSection(expandedSection === "positives" ? null : "positives")}
                        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <ThumbsUp className="h-5 w-5 text-green-400" />
                          <span className="font-semibold text-white">Pontos Positivos</span>
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                            {selectedAnalysis.positives.length}
                          </span>
                        </div>
                        <ChevronDown className={cn(
                          "h-5 w-5 text-white/40 transition-transform",
                          expandedSection === "positives" && "rotate-180"
                        )} />
                      </button>
                      
                      <AnimatePresence>
                        {expandedSection === "positives" && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-0 grid grid-cols-2 gap-3">
                              {selectedAnalysis.positives.map((point, i) => (
                                <div key={i}>{renderAnalysisPoint(point, true)}</div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Pontos Negativos */}
                    <div className="bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedSection(expandedSection === "negatives" ? null : "negatives")}
                        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <ThumbsDown className="h-5 w-5 text-red-400" />
                          <span className="font-semibold text-white">Pontos a Melhorar</span>
                          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                            {selectedAnalysis.negatives.length}
                          </span>
                        </div>
                        <ChevronDown className={cn(
                          "h-5 w-5 text-white/40 transition-transform",
                          expandedSection === "negatives" && "rotate-180"
                        )} />
                      </button>
                      
                      <AnimatePresence>
                        {expandedSection === "negatives" && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-0 grid grid-cols-2 gap-3">
                              {selectedAnalysis.negatives.map((point, i) => (
                                <div key={i}>{renderAnalysisPoint(point, false)}</div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Jogadores Destaque */}
                    <div className="bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedSection(expandedSection === "players" ? null : "players")}
                        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Star className="h-5 w-5 text-yellow-400" />
                          <span className="font-semibold text-white">Destaques Individuais</span>
                        </div>
                        <ChevronDown className={cn(
                          "h-5 w-5 text-white/40 transition-transform",
                          expandedSection === "players" && "rotate-180"
                        )} />
                      </button>
                      
                      <AnimatePresence>
                        {expandedSection === "players" && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-0 grid grid-cols-2 gap-4">
                              {/* Melhores */}
                              <div className="space-y-2">
                                <div className="text-xs text-green-400 font-medium mb-2 flex items-center gap-2">
                                  <TrendingUp className="h-3 w-3" /> Melhores em Campo
                                </div>
                                {selectedAnalysis.bestPlayers.map((player, i) => (
                                  <div key={i} className="flex items-center justify-between p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                                    <div>
                                      <div className="text-sm font-medium text-white">{player.name}</div>
                                      <div className="text-xs text-white/50">{player.reason}</div>
                                    </div>
                                    <span className="text-green-400 font-bold">{player.rating.toFixed(1)}</span>
                                  </div>
                                ))}
                              </div>
                              
                              {/* Piores */}
                              <div className="space-y-2">
                                <div className="text-xs text-red-400 font-medium mb-2 flex items-center gap-2">
                                  <TrendingDown className="h-3 w-3" /> Abaixo do Esperado
                                </div>
                                {selectedAnalysis.worstPlayers.map((player, i) => (
                                  <div key={i} className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                                    <div>
                                      <div className="text-sm font-medium text-white">{player.name}</div>
                                      <div className="text-xs text-white/50">{player.reason}</div>
                                    </div>
                                    <span className="text-red-400 font-bold">{player.rating.toFixed(1)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Estatisticas Chave */}
                    <div className="bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedSection(expandedSection === "stats" ? null : "stats")}
                        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <BarChart3 className="h-5 w-5 text-primary" />
                          <span className="font-semibold text-white">Estatisticas Chave</span>
                        </div>
                        <ChevronDown className={cn(
                          "h-5 w-5 text-white/40 transition-transform",
                          expandedSection === "stats" && "rotate-180"
                        )} />
                      </button>
                      
                      <AnimatePresence>
                        {expandedSection === "stats" && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-0 grid grid-cols-4 gap-3">
                              <div className="bg-white/5 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-white">{selectedAnalysis.keyStats.shots}</div>
                                <div className="text-xs text-white/50">Finalizacoes</div>
                              </div>
                              <div className="bg-white/5 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-white">{selectedAnalysis.keyStats.shotsOnTarget}</div>
                                <div className="text-xs text-white/50">No Gol</div>
                              </div>
                              <div className="bg-white/5 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-primary">{selectedAnalysis.keyStats.xG.toFixed(2)}</div>
                                <div className="text-xs text-white/50">xG (Esperado)</div>
                              </div>
                              <div className="bg-white/5 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-red-400">{selectedAnalysis.keyStats.xGA.toFixed(2)}</div>
                                <div className="text-xs text-white/50">xGA (Sofrido)</div>
                              </div>
                              <div className="bg-white/5 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-white">{selectedAnalysis.keyStats.passAccuracy}%</div>
                                <div className="text-xs text-white/50">Precisao Passes</div>
                              </div>
                              <div className="bg-white/5 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-white">{selectedAnalysis.keyStats.duelsWon}%</div>
                                <div className="text-xs text-white/50">Duelos Ganhos</div>
                              </div>
                              <div className="bg-white/5 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-white">{selectedAnalysis.keyStats.aerialDuelsWon}%</div>
                                <div className="text-xs text-white/50">Aereos Ganhos</div>
                              </div>
                              <div className="bg-white/5 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-white">{selectedAnalysis.keyStats.possession}%</div>
                                <div className="text-xs text-white/50">Posse</div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Recomendacoes */}
                    {selectedAnalysis.recommendations.length > 0 && (
                      <div className="bg-[#12121a] rounded-xl border border-white/5 p-5">
                        <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          Recomendacoes para Proximos Jogos
                        </h3>
                        <div className="space-y-2">
                          {selectedAnalysis.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                              <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="text-sm text-white">{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Desvios Taticos */}
                    {selectedAnalysis.tacticDeviations.length > 0 && (
                      <div className="bg-[#12121a] rounded-xl border border-white/5 p-5">
                        <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-400" />
                          Desvios do Plano Tatico
                        </h3>
                        <div className="space-y-2">
                          {selectedAnalysis.tacticDeviations.map((dev, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                              <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                              <span className="text-sm text-white/80">{dev}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                  </div>
                )}
              </div>
            )}
            
        </div>
      </main>
    </div>
  )
}
