"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar,
  Play,
  FastForward,
  Clock,
  AlertTriangle,
  Trophy,
  Users,
  Newspaper,
  TrendingUp,
  Flag,
  ChevronRight,
  ChevronDown,
  Activity,
  Zap,
  Target,
  Shield,
  X,
  Check,
  Star
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TeamCrest } from "@/components/team-crest"
import { cn } from "@/lib/utils"
import { useGameState } from "@/lib/save-system"
import { useGameEngine, type MatchResult, INJURY_TYPES, getInjuryRecoveryTime } from "@/lib/game-engine"
import { useGameManager } from "@/lib/use-game-manager"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"

interface TimeAdvanceProps {
  onWeekAdvanced?: () => void
}

interface WeekEvent {
  type: "match" | "transfer" | "injury" | "contract" | "nationalTeam" | "news" | "training" | "recovery"
  title: string
  description: string
  icon: React.ElementType
  color: string
  priority: number
}

interface SimulatedMatch {
  homeTeam: Team
  awayTeam: Team
  homeScore: number
  awayScore: number
}

export function TimeAdvanceButton({ onWeekAdvanced }: TimeAdvanceProps) {
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [weekEvents, setWeekEvents] = useState<WeekEvent[]>([])
  const [simulatedMatches, setSimulatedMatches] = useState<SimulatedMatch[]>([])
  const [expandedResults, setExpandedResults] = useState(false)
  
  const { state, setState } = useGameState()
  const gameEngine = useGameEngine()
  const { advanceWeek, seasonCalendar, currentWeek, currentSeason } = useGameManager()

  const handleAdvanceWeek = async () => {
    setIsAdvancing(true)
    
    // Simular processamento
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Gerar eventos da semana
    const events: WeekEvent[] = []
    const matches: SimulatedMatch[] = []
    
    // Obter partidas da rodada (excluindo do usuario)
    const roundFixtures = seasonCalendar.fixtures.filter(
      f => f.week === currentWeek + 1 && !f.isUserMatch && !f.played
    )
    
    // Simular cada partida
    for (const fixture of roundFixtures) {
      const homeStrength = fixture.homeTeam.prestigio + 5
      const awayStrength = fixture.awayTeam.prestigio
      const totalStrength = homeStrength + awayStrength
      const homeChance = homeStrength / totalStrength
      
      const homeExpectedGoals = 1.3 + (homeChance * 1.5)
      const awayExpectedGoals = 1.1 + ((1 - homeChance) * 1.5)
      
      const homeScore = Math.floor(Math.random() * 4 * (homeExpectedGoals / 2))
      const awayScore = Math.floor(Math.random() * 4 * (awayExpectedGoals / 2))
      
      matches.push({
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        homeScore,
        awayScore
      })
    }
    
    setSimulatedMatches(matches)
    
    // Verificar proxima partida do usuario
    const nextUserMatch = seasonCalendar.fixtures.find(
      f => f.week === currentWeek + 1 && f.isUserMatch && !f.played
    )
    
    if (nextUserMatch) {
      events.push({
        type: "match",
        title: "Proxima Partida",
        description: `${nextUserMatch.homeTeam.nome} vs ${nextUserMatch.awayTeam.nome} - Rodada ${nextUserMatch.round}`,
        icon: Trophy,
        color: "text-yellow-500",
        priority: 1
      })
    }
    
    // Sistema de lesoes - 15% de chance por semana
    const players = gameEngine.squadPlayers.filter(p => !p.injury && p.energy < 70)
    for (const player of players) {
      if (Math.random() < 0.15) {
        const severities: ("leve" | "media" | "grave")[] = ["leve", "media", "grave"]
        const severity = severities[Math.floor(Math.random() * (player.energy < 40 ? 3 : 2))]
        const injuryType = INJURY_TYPES[Math.floor(Math.random() * INJURY_TYPES.length)]
        const weeksRemaining = getInjuryRecoveryTime(severity)
        
        // Aplicar lesao
        gameEngine.injurePlayer(player.id, {
          type: injuryType,
          severity,
          weeksRemaining,
          startWeek: currentWeek + 1
        })
        
        events.push({
          type: "injury",
          title: "Lesao no Treino",
          description: `${player.name} sofreu ${injuryType} (${severity}) - ${weeksRemaining} semanas`,
          icon: AlertTriangle,
          color: severity === "grave" ? "text-red-500" : severity === "media" ? "text-orange-500" : "text-yellow-500",
          priority: 2
        })
      }
    }
    
    // Verificar jogadores se recuperando
    const recoveringPlayers = gameEngine.squadPlayers.filter(p => p.injury && p.injury.weeksRemaining === 1)
    for (const player of recoveringPlayers) {
      events.push({
        type: "recovery",
        title: "Recuperacao Completa",
        description: `${player.name} esta disponivel novamente`,
        icon: Activity,
        color: "text-green-500",
        priority: 3
      })
    }
    
    // Verificar contratos expirando (menos de 8 semanas)
    const expiringContracts = gameEngine.squadPlayers.filter(p => {
      if (!p.contract) return false
      const weeksRemaining = p.contract.endDate - (currentWeek + 1)
      return weeksRemaining > 0 && weeksRemaining <= 8
    })
    
    if (expiringContracts.length > 0) {
      events.push({
        type: "contract",
        title: "Contratos Expirando",
        description: `${expiringContracts.length} jogador(es) com contrato proximo do fim`,
        icon: Users,
        color: "text-orange-500",
        priority: 4
      })
    }
    
    // Verificar datas FIFA
    const newWeek = currentWeek + 1
    const fifaDates = [10, 11, 22, 23, 36, 37, 40, 41]
    if (fifaDates.includes(newWeek)) {
      const nationalPlayers = gameEngine.squadPlayers.filter(p => p.nationalTeam)
      if (nationalPlayers.length > 0) {
        // Convocar jogadores
        for (const player of nationalPlayers.slice(0, 3)) {
          if (Math.random() > 0.5) {
            gameEngine.callUpPlayer(player.id, {
              playerId: player.id,
              playerName: player.name,
              country: player.nationalTeam || "Brasil",
              competition: "Eliminatorias",
              weeksAway: 2,
              startWeek: newWeek
            })
          }
        }
        
        events.push({
          type: "nationalTeam",
          title: "Data FIFA",
          description: `Jogadores convocados para selecoes nacionais`,
          icon: Flag,
          color: "text-green-500",
          priority: 3
        })
      }
    }
    
    // Noticia aleatoria
    if (Math.random() > 0.7) {
      const newsTypes = [
        { title: "Torcida Apoiando", description: "Torcida organizada prepara mosaico para proxima partida" },
        { title: "Destaque da Rodada", description: "Imprensa elogia desempenho do elenco" },
        { title: "Investimento", description: "Diretoria anuncia melhorias no CT" },
      ]
      const news = newsTypes[Math.floor(Math.random() * newsTypes.length)]
      events.push({
        type: "news",
        title: news.title,
        description: news.description,
        icon: Newspaper,
        color: "text-primary",
        priority: 5
      })
    }
    
    // Ordenar eventos por prioridade
    events.sort((a, b) => a.priority - b.priority)
    
    // Avancar semana no sistema
    await advanceWeek()
    
    setWeekEvents(events)
    setIsAdvancing(false)
    setShowEvents(true)
    
    onWeekAdvanced?.()
  }

  const closeEvents = () => {
    setShowEvents(false)
    setWeekEvents([])
    setSimulatedMatches([])
    setExpandedResults(false)
  }

  return (
    <>
      {/* Advance Button */}
      <button
        onClick={handleAdvanceWeek}
        disabled={isAdvancing}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
          isAdvancing 
            ? "bg-white/5 text-white/50 cursor-not-allowed" 
            : "bg-[#1db954] text-black hover:bg-[#1ed760]"
        )}
      >
        {isAdvancing ? (
          <>
            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm font-medium">Simulando...</span>
          </>
        ) : (
          <>
            <FastForward className="h-4 w-4" />
            <span className="text-sm font-medium">Avancar Semana</span>
          </>
        )}
      </button>

      {/* Events Modal - Redesigned */}
      <AnimatePresence>
        {showEvents && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={closeEvents}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-full max-w-2xl max-h-[85vh] rounded-2xl bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative px-6 py-5 border-b border-white/10 bg-gradient-to-r from-[#1db954]/10 to-transparent">
                <button 
                  onClick={closeEvents}
                  className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-[#1db954]/20 flex items-center justify-center">
                    <Calendar className="h-7 w-7 text-[#1db954]" />
                  </div>
                  <div>
                    <div className="text-xs text-[#1db954] font-medium tracking-wider uppercase mb-1">
                      Resumo da Semana
                    </div>
                    <h3 className="text-2xl font-bold text-white">
                      Rodada {currentWeek} <span className="text-white/40 font-normal">/ {currentSeason}</span>
                    </h3>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-premium">
                {/* Resultados da Rodada */}
                {simulatedMatches.length > 0 && (
                  <div>
                    <button
                      onClick={() => setExpandedResults(!expandedResults)}
                      className="w-full flex items-center justify-between mb-3"
                    >
                      <div className="flex items-center gap-2 text-xs font-medium text-white/60 uppercase tracking-wider">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        Resultados da Rodada ({simulatedMatches.length} partidas)
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 text-white/40 transition-transform",
                        expandedResults && "rotate-180"
                      )} />
                    </button>
                    
                    <AnimatePresence>
                      {expandedResults && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid gap-2">
                            {simulatedMatches.map((match, idx) => (
                              <motion.div
                                key={idx}
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <TeamCrest team={match.homeTeam} size="xs" />
                                  <span className="text-xs text-white truncate">{match.homeTeam.curto}</span>
                                </div>
                                
                                <div className="flex items-center gap-2 px-3 py-1 rounded bg-white/10">
                                  <span className={cn(
                                    "text-sm font-bold",
                                    match.homeScore > match.awayScore ? "text-[#1db954]" : "text-white"
                                  )}>
                                    {match.homeScore}
                                  </span>
                                  <span className="text-white/30">-</span>
                                  <span className={cn(
                                    "text-sm font-bold",
                                    match.awayScore > match.homeScore ? "text-[#1db954]" : "text-white"
                                  )}>
                                    {match.awayScore}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                                  <span className="text-xs text-white truncate">{match.awayTeam.curto}</span>
                                  <TeamCrest team={match.awayTeam} size="xs" />
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {!expandedResults && (
                      <div className="flex flex-wrap gap-2">
                        {simulatedMatches.slice(0, 4).map((match, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 text-[10px] text-white/60"
                          >
                            <span>{match.homeTeam.curto}</span>
                            <span className="font-bold text-white">{match.homeScore}-{match.awayScore}</span>
                            <span>{match.awayTeam.curto}</span>
                          </div>
                        ))}
                        {simulatedMatches.length > 4 && (
                          <div className="flex items-center px-2 py-1 rounded bg-white/5 text-[10px] text-white/40">
                            +{simulatedMatches.length - 4} mais
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Eventos */}
                {weekEvents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
                      <Zap className="h-4 w-4 text-primary" />
                      Eventos da Semana
                    </div>
                    
                    <div className="space-y-2">
                      {weekEvents.map((event, index) => {
                        const Icon = event.icon
                        return (
                          <motion.div
                            key={index}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn("p-2.5 rounded-lg bg-white/5", event.color)}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-white text-sm">{event.title}</div>
                                <div className="text-xs text-white/50 mt-0.5 line-clamp-2">{event.description}</div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-white/20 flex-shrink-0" />
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Mensagem se nao houver eventos */}
                {weekEvents.length === 0 && simulatedMatches.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-16 w-16 rounded-full bg-[#1db954]/10 flex items-center justify-center mb-4">
                      <Check className="h-8 w-8 text-[#1db954]" />
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2">Semana Tranquila</h4>
                    <p className="text-sm text-white/50 max-w-xs">
                      Nenhum evento importante aconteceu esta semana. Continue seu trabalho!
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/10 bg-black/30">
                <Button
                  onClick={closeEvents}
                  className="w-full bg-[#1db954] text-black hover:bg-[#1ed760] font-semibold py-3"
                >
                  Continuar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Componente para exibir a semana atual no header
export function CurrentWeekDisplay() {
  const { state } = useGameState()
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
      <Calendar className="h-4 w-4 text-[#1db954]" />
      <span className="text-sm text-white/70">
        Semana <span className="font-semibold text-white">{state.week}</span>/48
      </span>
      <span className="text-white/30">|</span>
      <span className="text-sm text-white/70">{state.season}</span>
    </div>
  )
}

// Componente compacto para header
export function CompactWeekAdvance() {
  const { currentWeek, currentSeason, advanceWeek, seasonCalendar } = useGameManager()
  const [isAdvancing, setIsAdvancing] = useState(false)

  const handleAdvance = async () => {
    setIsAdvancing(true)
    await new Promise(resolve => setTimeout(resolve, 300))
    await advanceWeek()
    setIsAdvancing(false)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
        <Calendar className="h-3 w-3 text-[#1db954]" />
        <span className="text-[10px] text-white/60">{currentSeason}</span>
        <span className="text-white/20">|</span>
        <span className="text-[10px] text-white/60">Rod</span>
        <span className="text-[10px] text-white font-medium">
          {currentWeek}<span className="text-white/40">/38</span>
        </span>
      </div>
      
      <button
        onClick={handleAdvance}
        disabled={isAdvancing}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider rounded transition-colors",
          isAdvancing 
            ? "bg-white/5 text-white/50 cursor-not-allowed"
            : "bg-[#1db954] text-black hover:bg-[#1ed760]"
        )}
      >
        {isAdvancing ? (
          <div className="h-3 w-3 border border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <FastForward className="h-3.5 w-3.5" />
        )}
        <span>Avancar</span>
      </button>
    </div>
  )
}
