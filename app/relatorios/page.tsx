"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Shield,
  Award,
  Clock,
  Calendar,
  ChevronRight,
  Star,
  AlertTriangle,
  CheckCircle2,
  Users,
  Activity,
  Footprints,
  Goal
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatarCircle } from "@/components/player-avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useGameEngine } from "@/lib/game-engine"
import { useUserTeam } from "@/lib/time-da-carreira"

type TabType = "individuais" | "coletivos" | "comparativos" | "tendencias"

export default function RelatoriosPage() {
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
  const { team: userTeam } = useUserTeam()
  const gameEngine = useGameEngine()
  
  const [activeTab, setActiveTab] = useState<TabType>("individuais")
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [reportPeriod, setReportPeriod] = useState<"semana" | "mes" | "temporada">("mes")
  
  const { squadPlayers, generatePerformanceReport, matchResults, myTeamShort } = gameEngine

  /** Estatísticas SOMENTE das súmulas persistidas do clube do jogador. */
  const teamStats = useMemo(() => {
    const clube = myTeamShort || userTeam.curto
    const jogos = matchResults.filter(r => r.homeTeam === clube || r.awayTeam === clube)
    let wins = 0, draws = 0, losses = 0, goalsScored = 0, goalsConceded = 0, cleanSheets = 0
    let xG = 0, xGA = 0, shots = 0, shotsOnTarget = 0, oppShots = 0
    let corners = 0, fouls = 0, yellows = 0, reds = 0, passes = 0
    let possession = 0, passAccuracy = 0, xA = 0, boxEntries = 0, highRecoveries = 0
    let performanceMatches = 0, xACount = 0, boxEntriesCount = 0, recoveriesCount = 0

    for (const jogo of jogos) {
      const home = jogo.homeTeam === clube
      const pro = home ? jogo.homeScore : jogo.awayScore
      const contra = home ? jogo.awayScore : jogo.homeScore
      goalsScored += pro; goalsConceded += contra
      if (pro > contra) wins++; else if (pro === contra) draws++; else losses++
      if (contra === 0) cleanSheets++

      const nossa = jogo.performance?.[home ? "home" : "away"]
      const rival = jogo.performance?.[home ? "away" : "home"]
      if (!nossa || !rival) continue
      performanceMatches++
      xG += nossa.xG; xGA += rival.xG
      shots += nossa.shots; shotsOnTarget += nossa.shotsOnTarget; oppShots += rival.shots
      corners += nossa.corners; fouls += nossa.fouls; yellows += nossa.yellows; reds += nossa.reds
      passes += nossa.passes; possession += nossa.possession; passAccuracy += nossa.passAccuracy
      if (nossa.xA != null) { xA += nossa.xA; xACount++ }
      if (nossa.boxEntries != null) { boxEntries += nossa.boxEntries; boxEntriesCount++ }
      if (nossa.highRecoveries != null) { highRecoveries += nossa.highRecoveries; recoveriesCount++ }
    }
    const media = (valor: number) => performanceMatches ? valor / performanceMatches : null
    return {
      matches: jogos.length, wins, draws, losses, goalsScored, goalsConceded, cleanSheets,
      performanceMatches,
      xG: performanceMatches ? xG : null,
      xGA: performanceMatches ? xGA : null,
      shotsPerGame: media(shots), shotsOnTargetPerGame: media(shotsOnTarget),
      opponentShotsPerGame: media(oppShots), cornersPerGame: media(corners), foulsPerGame: media(fouls),
      conversionRate: shots ? goalsScored / shots * 100 : null,
      yellows, reds, passesPerGame: media(passes), possession: media(possession), passAccuracy: media(passAccuracy),
      xA: xACount ? xA : null, boxEntries: boxEntriesCount ? boxEntries : null,
      highRecoveries: recoveriesCount ? highRecoveries : null,
    }
  }, [matchResults, myTeamShort, userTeam.curto])

  const numero = (valor: number | null, casas = 1) => valor == null ? "—" : valor.toFixed(casas)

  const tabs: { id: TabType; label: string; icon: typeof BarChart3 }[] = [
    { id: "individuais", label: "Individuais", icon: Users },
    { id: "coletivos", label: "Coletivos", icon: Shield },
    { id: "comparativos", label: "Comparativos", icon: BarChart3 },
    { id: "tendencias", label: "Tendencias", icon: TrendingUp },
  ]

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null
    return squadPlayers.find(p => p.id === selectedPlayerId)
  }, [selectedPlayerId, squadPlayers])

  const playerReport = useMemo(() => {
    if (!selectedPlayerId) return null
    return generatePerformanceReport(selectedPlayerId, reportPeriod)
  }, [selectedPlayerId, reportPeriod, generatePerformanceReport])

  // Ordenar jogadores por overall
  const sortedPlayers = useMemo(() => {
    return [...squadPlayers].sort((a, b) => b.overall - a.overall)
  }, [squadPlayers])

  // Calcular estatisticas comparativas
  const playerComparisons = useMemo(() => {
    const divisor = Math.max(squadPlayers.length, 1)
    const avgOverall = squadPlayers.reduce((sum, p) => sum + p.overall, 0) / divisor
    const avgForm = squadPlayers.reduce((sum, p) => sum + p.form, 0) / divisor
    
    return {
      avgOverall,
      avgForm,
      topScorer: squadPlayers.reduce((top, p) => 
        p.seasonStats.goals > (top?.seasonStats.goals || 0) ? p : top, squadPlayers[0]),
      topAssister: squadPlayers.reduce((top, p) => 
        p.seasonStats.assists > (top?.seasonStats.assists || 0) ? p : top, squadPlayers[0]),
      mostMinutes: squadPlayers.reduce((top, p) => 
        p.seasonStats.minutesPlayed > (top?.seasonStats.minutesPlayed || 0) ? p : top, squadPlayers[0]),
      bestForm: squadPlayers.reduce((top, p) => 
        p.form > (top?.form || 0) ? p : top, squadPlayers[0])
    }
  }, [squadPlayers])

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return "text-yellow-400"
    if (rating >= 7) return "text-green-400"
    if (rating >= 6) return "text-lime-400"
    if (rating >= 5) return "text-orange-400"
    return "text-red-400"
  }

  return (
    <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameHeader team={userTeam} />
      
      <main className="flex-1 p-4 md:p-6 overflow-y-auto scrollbar-premium">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Central de Relatorios</h1>
            <p className="text-sm text-white/50">Estatisticas avancadas e analise de desempenho</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-thin">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all",
                activeTab === tab.id
                  ? "bg-primary text-white"
                  : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "individuais" && (
            <motion.div
              key="individuais"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid lg:grid-cols-3 gap-6"
            >
              {/* Lista de Jogadores */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-4">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Jogadores
                </h2>
                
                {/* Filtro de Periodo */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(["semana", "mes", "temporada"] as const).map(period => (
                    <button
                      key={period}
                      onClick={() => setReportPeriod(period)}
                      className={cn(
                        "py-1.5 px-2 rounded-lg text-xs font-medium transition-all",
                        reportPeriod === period
                          ? "bg-primary text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/15"
                      )}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
                </div>
                
                <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
                  {sortedPlayers.map(player => {
                    const rating = (player.overall + player.form) / 20
                    return (
                      <button
                        key={player.id}
                        onClick={() => setSelectedPlayerId(player.id)}
                        className={cn(
                          "w-full p-3 rounded-lg text-left transition-all flex items-center gap-3",
                          selectedPlayerId === player.id
                            ? "bg-primary/20 border border-primary"
                            : "bg-white/5 border border-transparent hover:bg-white/10"
                        )}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-xs font-bold text-white">
                          {player.position}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{player.name}</div>
                          <div className="text-xs text-white/50">OVR {player.overall} | Forma {player.form}</div>
                        </div>
                        <div className={cn("text-lg font-bold", getRatingColor(rating))}>
                          {rating.toFixed(1)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Relatorio do Jogador */}
              <div className="lg:col-span-2 bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                {selectedPlayer && playerReport ? (
                  <>
                    {/* Cabecalho */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xl font-bold text-white">
                        {selectedPlayer.position}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-white">{selectedPlayer.name}</h2>
                        <p className="text-sm text-white/50">
                          {selectedPlayer.age} anos | {selectedPlayer.nationality}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={cn("text-3xl font-bold", playerReport.avgRating > 0 ? getRatingColor(playerReport.avgRating) : "text-white/40")}>
                          {playerReport.avgRating > 0 ? playerReport.avgRating.toFixed(1) : "—"}
                        </div>
                        <div className="text-xs text-white/50">Nota Media</div>
                      </div>
                    </div>

                    {/* Comparacoes */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 bg-white/5 rounded-lg text-center">
                        <div className={cn(
                          "text-xl font-bold flex items-center justify-center gap-1",
                          "text-white/50"
                        )}>
                          —
                        </div>
                        <div className="text-xs text-white/50">Sem série histórica</div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-lg text-center">
                        <div className={cn(
                          "text-xl font-bold",
                          playerReport.vsSquadAvg > 0 ? "text-green-400" : playerReport.vsSquadAvg < 0 ? "text-red-400" : "text-white/50"
                        )}>
                          {playerReport.vsSquadAvg > 0 ? "+" : ""}{playerReport.vsSquadAvg}%
                        </div>
                        <div className="text-xs text-white/50">vs Media do Elenco</div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-lg text-center">
                        <div className={cn(
                          "text-xl font-bold",
                          playerReport.vsPositionAvg > 0 ? "text-green-400" : playerReport.vsPositionAvg < 0 ? "text-red-400" : "text-white/50"
                        )}>
                          {playerReport.vsPositionAvg > 0 ? "+" : ""}{playerReport.vsPositionAvg}%
                        </div>
                        <div className="text-xs text-white/50">vs Media da Posicao</div>
                      </div>
                    </div>

                    {/* Atributos */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <h3 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Pontos Fortes
                        </h3>
                        <div className="space-y-2">
                          {playerReport.strengths.length > 0 ? (
                            playerReport.strengths.map((s, i) => (
                              <div key={i} className="text-sm text-white/80 flex items-center gap-2">
                                <Star className="h-3 w-3 text-[#ffd700]" />
                                {s}
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-white/50">Nenhum destaque identificado</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          Pontos a Melhorar
                        </h3>
                        <div className="space-y-2">
                          {playerReport.weaknesses.length > 0 ? (
                            playerReport.weaknesses.map((w, i) => (
                              <div key={i} className="text-sm text-white/80 flex items-center gap-2">
                                <Target className="h-3 w-3 text-orange-500" />
                                {w}
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-white/50">Nenhuma fraqueza critica</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Estatisticas */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="p-3 bg-white/5 rounded-lg text-center">
                        <Goal className="h-5 w-5 text-green-400 mx-auto mb-1" />
                        <div className="text-xl font-bold text-white">{selectedPlayer.seasonStats.goals}</div>
                        <div className="text-xs text-white/50">Gols</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg text-center">
                        <Footprints className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                        <div className="text-xl font-bold text-white">{selectedPlayer.seasonStats.assists}</div>
                        <div className="text-xs text-white/50">Assistencias</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg text-center">
                        <Activity className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                        <div className="text-xl font-bold text-white">{selectedPlayer.seasonStats.matchesPlayed}</div>
                        <div className="text-xs text-white/50">Jogos</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg text-center">
                        <Clock className="h-5 w-5 text-orange-400 mx-auto mb-1" />
                        <div className="text-xl font-bold text-white">{selectedPlayer.seasonStats.minutesPlayed}</div>
                        <div className="text-xs text-white/50">Minutos</div>
                      </div>
                    </div>

                    {/* Recomendacao */}
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <h3 className="text-sm font-medium text-primary mb-2">Recomendacao da Comissao Tecnica</h3>
                      <p className="text-sm text-white/80">{playerReport.recommendation}</p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <BarChart3 className="h-16 w-16 text-white/20 mb-4" />
                    <h3 className="text-xl font-bold text-white/60 mb-2">Selecione um Jogador</h3>
                    <p className="text-sm text-white/40">
                      Escolha um jogador na lista para ver seu relatorio de desempenho detalhado.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "coletivos" && (
            <motion.div
              key="coletivos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Visao Geral */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-4 text-center">
                  <div className="text-3xl font-bold text-white">{teamStats.matches}</div>
                  <div className="text-xs text-white/50">Jogos</div>
                </div>
                <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl border border-green-500/20 p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">{teamStats.wins}</div>
                  <div className="text-xs text-white/50">Vitorias</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 rounded-xl border border-[#ffd700]/20 p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-400">{teamStats.draws}</div>
                  <div className="text-xs text-white/50">Empates</div>
                </div>
                <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 rounded-xl border border-red-500/20 p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">{teamStats.losses}</div>
                  <div className="text-xs text-white/50">Derrotas</div>
                </div>
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-4 text-center">
                  <div className="text-3xl font-bold text-primary">{teamStats.cleanSheets}</div>
                  <div className="text-xs text-white/50">Clean Sheets</div>
                </div>
              </div>

              {/* Estatisticas Detalhadas */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* Ataque */}
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-red-500" />
                    Ataque
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Gols Marcados</span>
                      <span className="font-bold text-white">{teamStats.goalsScored}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">xG</span>
                      <span className="font-bold text-white">{numero(teamStats.xG)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Finalizacoes/Jogo</span>
                      <span className="font-bold text-white">{numero(teamStats.shotsPerGame)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">No Alvo/Jogo</span>
                      <span className="font-bold text-white">{numero(teamStats.shotsOnTargetPerGame)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Taxa Conversao</span>
                      <span className="font-bold text-white">{teamStats.conversionRate == null ? "—" : `${numero(teamStats.conversionRate)}%`}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Escanteios/Jogo</span>
                      <span className="font-bold text-white">{numero(teamStats.cornersPerGame)}</span>
                    </div>
                  </div>
                </div>

                {/* Defesa */}
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-500" />
                    Defesa
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Gols Sofridos</span>
                      <span className="font-bold text-white">{teamStats.goalsConceded}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">xGA</span>
                      <span className="font-bold text-white">{numero(teamStats.xGA)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Finalizações rivais/Jogo</span>
                      <span className="font-bold text-white">{numero(teamStats.opponentShotsPerGame)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Faltas/Jogo</span>
                      <span className="font-bold text-white">{numero(teamStats.foulsPerGame)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Cartões amarelos</span>
                      <span className="font-bold text-white">{teamStats.performanceMatches ? teamStats.yellows : "—"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Cartões vermelhos</span>
                      <span className="font-bold text-white">{teamStats.performanceMatches ? teamStats.reds : "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Passe */}
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    Construcao
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Passes/Jogo</span>
                      <span className="font-bold text-white">{numero(teamStats.passesPerGame, 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Precisao Passes</span>
                      <span className="font-bold text-white">{teamStats.passAccuracy == null ? "—" : `${numero(teamStats.passAccuracy)}%`}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Posse média</span>
                      <span className="font-bold text-white">{teamStats.possession == null ? "—" : `${numero(teamStats.possession)}%`}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Assistências esperadas (xA)</span>
                      <span className="font-bold text-white">{numero(teamStats.xA)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Entradas na área</span>
                      <span className="font-bold text-white">{numero(teamStats.boxEntries, 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Recuperações altas</span>
                      <span className="font-bold text-white">{numero(teamStats.highRecoveries, 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "comparativos" && (
            <motion.div
              key="comparativos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Destaques */}
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 rounded-xl border border-[#ffd700]/20 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Goal className="h-8 w-8 text-[#ffd700]" />
                    <div>
                      <div className="text-xs text-white/50">Artilheiro</div>
                      <div className="font-bold text-white">{playerComparisons.topScorer?.name}</div>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-yellow-400">
                    {playerComparisons.topScorer?.seasonStats.goals} gols
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl border border-blue-500/20 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Footprints className="h-8 w-8 text-blue-500" />
                    <div>
                      <div className="text-xs text-white/50">Garcom</div>
                      <div className="font-bold text-white">{playerComparisons.topAssister?.name}</div>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-blue-400">
                    {playerComparisons.topAssister?.seasonStats.assists} assist.
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl border border-green-500/20 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <TrendingUp className="h-8 w-8 text-green-500" />
                    <div>
                      <div className="text-xs text-white/50">Melhor Forma</div>
                      <div className="font-bold text-white">{playerComparisons.bestForm?.name}</div>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-green-400">
                    {playerComparisons.bestForm?.form}%
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl border border-purple-500/20 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Clock className="h-8 w-8 text-purple-500" />
                    <div>
                      <div className="text-xs text-white/50">Mais Minutos</div>
                      <div className="font-bold text-white">{playerComparisons.mostMinutes?.name}</div>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-purple-400">
                    {playerComparisons.mostMinutes?.seasonStats.minutesPlayed}
                  </div>
                </div>
              </div>

              {/* Ranking de Jogadores */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4">Ranking do Elenco por Overall</h3>
                
                <div className="space-y-2">
                  {sortedPlayers.slice(0, 10).map((player, i) => (
                    <div key={player.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        i === 0 ? "bg-[#ffd700]/20 text-yellow-400" :
                        i === 1 ? "bg-gray-400/20 text-gray-300" :
                        i === 2 ? "bg-orange-600/20 text-orange-400" :
                        "bg-white/10 text-white/50"
                      )}>
                        {i + 1}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                        {player.position}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">{player.name}</div>
                        <div className="text-xs text-white/50">{player.age} anos</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-white">{player.overall}</div>
                        <div className="text-xs text-white/50">OVR</div>
                      </div>
                      <div className="w-24">
                        <Progress value={player.overall} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "tendencias" && (
            <motion.div
              key="tendencias"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* Jogadores em Alta */}
              <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl border border-green-500/20 p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Jogadores em Alta
                </h3>
                
                <div className="space-y-3">
                  {squadPlayers.filter(p => p.form >= 75).slice(0, 5).map(player => (
                    <div key={player.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                        {player.position}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">{player.name}</div>
                        <div className="text-xs text-green-400">Forma: {player.form}%</div>
                      </div>
                      <TrendingUp className="h-5 w-5 text-green-400" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Jogadores em Baixa */}
              <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 rounded-xl border border-red-500/20 p-6">
                <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  Jogadores em Baixa
                </h3>
                
                <div className="space-y-3">
                  {squadPlayers.filter(p => p.form < 70).slice(0, 5).map(player => (
                    <div key={player.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                        {player.position}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">{player.name}</div>
                        <div className="text-xs text-red-400">Forma: {player.form}%</div>
                      </div>
                      <TrendingDown className="h-5 w-5 text-red-400" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Medias do Elenco */}
              <div className="md:col-span-2 bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4">Medias do Elenco</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white/5 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">{playerComparisons.avgOverall.toFixed(1)}</div>
                    <div className="text-xs text-white/50">Overall Medio</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">{playerComparisons.avgForm.toFixed(1)}%</div>
                    <div className="text-xs text-white/50">Forma Media</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">
                      {(squadPlayers.reduce((sum, p) => sum + p.age, 0) / squadPlayers.length).toFixed(1)}
                    </div>
                    <div className="text-xs text-white/50">Idade Media</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">
                      {squadPlayers.filter(p => p.injury).length}
                    </div>
                    <div className="text-xs text-white/50">Lesionados</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
