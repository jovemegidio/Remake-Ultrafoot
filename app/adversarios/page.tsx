"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Eye,
  Search,
  Target,
  Shield,
  Zap,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Calendar,
  MapPin,
  Users,
  BarChart3,
  Play,
  Pause,
  ChevronRight,
  Star,
  Info
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useGameState } from "@/lib/save-system"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { useGameEngine, type OpponentAnalysis } from "@/lib/game-engine"

// Dados detalhados de adversarios
const OPPONENT_DATA: Record<string, {
  formation: string
  mentality: string
  keyPlayers: { name: string; position: string; overall: number; threat: number }[]
  style: string[]
  weaknesses: string[]
  strengths: string[]
  recentForm: ("W" | "D" | "L")[]
  homeRecord: { w: number; d: number; l: number }
  awayRecord: { w: number; d: number; l: number }
  avgGoalsScored: number
  avgGoalsConceded: number
  dangerZones: string[]
  setpieces: string
}> = {
  FLA: {
    formation: "4-3-3",
    mentality: "Ofensivo",
    keyPlayers: [
      { name: "Gabigol", position: "ATA", overall: 84, threat: 95 },
      { name: "De Arrascaeta", position: "MEI", overall: 85, threat: 90 },
      { name: "Gerson", position: "VOL", overall: 83, threat: 70 },
    ],
    style: ["Posse de bola", "Pressao alta", "Jogo pelas laterais"],
    weaknesses: ["Laterais sobem muito", "Vulneravel em contra-ataques rapidos", "Bola aerea defensiva"],
    strengths: ["Meio-campo criativo", "Finalizacao precisa", "Banco de qualidade"],
    recentForm: ["W", "W", "D", "W", "L"],
    homeRecord: { w: 8, d: 2, l: 1 },
    awayRecord: { w: 5, d: 3, l: 3 },
    avgGoalsScored: 2.1,
    avgGoalsConceded: 0.9,
    dangerZones: ["Dentro da area", "Jogadas pela esquerda"],
    setpieces: "Perigoso em escanteios - Gabigol marca muito de cabeca"
  },
  PAL: {
    formation: "4-4-2",
    mentality: "Equilibrado",
    keyPlayers: [
      { name: "Endrick", position: "ATA", overall: 82, threat: 92 },
      { name: "Raphael Veiga", position: "MEI", overall: 83, threat: 85 },
      { name: "Gustavo Gomez", position: "ZAG", overall: 84, threat: 50 },
    ],
    style: ["Transicao rapida", "Solidez defensiva", "Jogo direto"],
    weaknesses: ["Saida de bola lenta", "Pouca criatividade pelo centro"],
    strengths: ["Defesa organizada", "Eficiencia em finalizacoes", "Forca fisica"],
    recentForm: ["W", "W", "W", "D", "W"],
    homeRecord: { w: 9, d: 1, l: 1 },
    awayRecord: { w: 6, d: 2, l: 3 },
    avgGoalsScored: 1.8,
    avgGoalsConceded: 0.7,
    dangerZones: ["Contra-ataques rapidos", "Segundas bolas"],
    setpieces: "Forte em faltas - Veiga e cobrador oficial"
  },
  COR: {
    formation: "4-2-3-1",
    mentality: "Equilibrado",
    keyPlayers: [
      { name: "Yuri Alberto", position: "ATA", overall: 80, threat: 85 },
      { name: "Renato Augusto", position: "MEI", overall: 81, threat: 80 },
      { name: "Fagner", position: "LD", overall: 79, threat: 55 },
    ],
    style: ["Jogo aereo", "Cruzamentos", "Pressao moderada"],
    weaknesses: ["Falta velocidade na defesa", "Dependente de jogadas aereas"],
    strengths: ["Experiencia", "Entrosamento", "Jogo aereo ofensivo"],
    recentForm: ["D", "W", "L", "W", "D"],
    homeRecord: { w: 6, d: 3, l: 2 },
    awayRecord: { w: 4, d: 4, l: 3 },
    avgGoalsScored: 1.4,
    avgGoalsConceded: 1.1,
    dangerZones: ["Area em cruzamentos", "Bola parada"],
    setpieces: "Muito perigoso em escanteios"
  },
  BOT: {
    formation: "4-3-3",
    mentality: "Muito Ofensivo",
    keyPlayers: [
      { name: "Luiz Henrique", position: "PD", overall: 82, threat: 90 },
      { name: "Savarino", position: "PE", overall: 81, threat: 85 },
      { name: "Junior Santos", position: "ATA", overall: 80, threat: 88 },
    ],
    style: ["Pressao alta intensa", "Jogo rapido", "Muita movimentacao"],
    weaknesses: ["Espacos na defesa", "Desgaste fisico", "Goleiro questionavel"],
    strengths: ["Velocidade no ataque", "Transicao ofensiva", "Intensidade"],
    recentForm: ["W", "W", "W", "W", "D"],
    homeRecord: { w: 10, d: 0, l: 1 },
    awayRecord: { w: 7, d: 2, l: 2 },
    avgGoalsScored: 2.4,
    avgGoalsConceded: 1.0,
    dangerZones: ["Contra-ataques", "1v1 pelas pontas"],
    setpieces: "Moderado - nao depende muito"
  }
}

// Lista de times para analisar
const TEAMS_TO_ANALYZE = [
  "FLA", "PAL", "COR", "SAO", "INT", "GRE", "CAM", "FLU", "BOT", "BAH",
  "CRU", "FOR", "VAS", "CAP", "SAN", "VIT", "JUV", "MIR", "SPT", "CEA"
]

export default function AdversariosPage() {
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
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const gameEngine = useGameEngine()
  
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null)
  const [analysisData, setAnalysisData] = useState<Record<string, number>>({})
  
  const { opponentAnalyses, analyzeOpponent, currentWeek } = gameEngine

  // Filtrar times (excluir o time do usuario)
  const availableTeams = useMemo(() => {
    return TEAMS_TO_ANALYZE.filter(t => t !== userTeam.curto)
  }, [userTeam])

  // Buscar analise existente
  const getAnalysis = (teamShort: string) => {
    return opponentAnalyses.find(a => a.teamShort === teamShort)
  }

  // Iniciar analise
  const startAnalysis = (teamShort: string) => {
    setIsAnalyzing(teamShort)
    analyzeOpponent(teamShort)
    
    // Simular progresso
    let progress = analysisData[teamShort] || 0
    const interval = setInterval(() => {
      progress += 5
      setAnalysisData(prev => ({ ...prev, [teamShort]: Math.min(100, progress) }))
      
      if (progress >= 100) {
        clearInterval(interval)
        setIsAnalyzing(null)
      }
    }, 300)
  }

  const selectedTeamData = selectedTeam ? OPPONENT_DATA[selectedTeam] : null
  const selectedTeamInfo = selectedTeam ? getTeamByShort(selectedTeam) : null
  const selectedAnalysis = selectedTeam ? getAnalysis(selectedTeam) : null

  return (
    <div className="h-screen md:pl-16 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />
      
      <main className="flex-1 p-4 md:p-6 overflow-y-auto scrollbar-premium">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Analise de Adversarios</h1>
            <p className="text-sm text-white/50">Estude seus oponentes para criar a estrategia perfeita</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Lista de Times */}
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-4">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Times da Serie A
            </h2>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin pr-2">
              {availableTeams.map(teamShort => {
                const team = getTeamByShort(teamShort)
                const analysis = getAnalysis(teamShort)
                const progress = analysisData[teamShort] || analysis?.analysisProgress || 0
                const isCurrentlyAnalyzing = isAnalyzing === teamShort
                
                if (!team) return null
                
                return (
                  <motion.button
                    key={teamShort}
                    onClick={() => setSelectedTeam(teamShort)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-all flex items-center gap-3",
                      selectedTeam === teamShort
                        ? "bg-primary/20 border border-primary"
                        : "bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10"
                    )}
                  >
                    <TeamCrest team={team} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{team.nome}</div>
                      {progress > 0 && (
                        <div className="mt-1">
                          <Progress value={progress} className="h-1.5" />
                        </div>
                      )}
                    </div>
                    {progress >= 100 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : isCurrentlyAnalyzing ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Search className="h-4 w-4 text-primary" />
                      </motion.div>
                    ) : progress > 0 ? (
                      <span className="text-xs text-white/50">{progress}%</span>
                    ) : (
                      <ChevronRight className="h-4 w-4 text-white/30" />
                    )}
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Detalhes do Time */}
          <div className="lg:col-span-2">
            {selectedTeam && selectedTeamInfo ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedTeam}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Cabecalho do Time */}
                  <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <TeamCrest team={selectedTeamInfo} size="lg" />
                        <div>
                          <h2 className="text-2xl font-bold text-white">{selectedTeamInfo.nome}</h2>
                          <p className="text-sm text-white/50">{selectedTeamInfo.estadio_nome}</p>
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => startAnalysis(selectedTeam)}
                        disabled={isAnalyzing === selectedTeam || (analysisData[selectedTeam] || 0) >= 100}
                        className={cn(
                          "gap-2",
                          (analysisData[selectedTeam] || 0) >= 100 
                            ? "bg-green-600 hover:bg-green-700"
                            : ""
                        )}
                      >
                        {isAnalyzing === selectedTeam ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              <Search className="h-4 w-4" />
                            </motion.div>
                            Analisando...
                          </>
                        ) : (analysisData[selectedTeam] || 0) >= 100 ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Analise Completa
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4" />
                            Iniciar Analise
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Progresso da Analise */}
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-white/70">Progresso da Analise</span>
                        <span className="text-primary font-medium">{analysisData[selectedTeam] || 0}%</span>
                      </div>
                      <Progress value={analysisData[selectedTeam] || 0} className="h-3" />
                    </div>

                    {/* Informacoes reveladas conforme progresso */}
                    {(analysisData[selectedTeam] || 0) >= 25 && selectedTeamData && (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-white/5 rounded-lg">
                          <div className="text-xl font-bold text-white">{selectedTeamData.formation}</div>
                          <div className="text-xs text-white/50">Formacao</div>
                        </div>
                        <div className="text-center p-3 bg-white/5 rounded-lg">
                          <div className="text-xl font-bold text-orange-400">{selectedTeamData.mentality}</div>
                          <div className="text-xs text-white/50">Mentalidade</div>
                        </div>
                        <div className="text-center p-3 bg-white/5 rounded-lg">
                          <div className="flex justify-center gap-1">
                            {selectedTeamData.recentForm.map((f, i) => (
                              <span
                                key={i}
                                className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                  f === "W" ? "bg-green-500/20 text-green-400" :
                                  f === "D" ? "bg-[#ffd700]/20 text-yellow-400" :
                                  "bg-red-500/20 text-red-400"
                                )}
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-white/50 mt-1">Ultimos 5</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Jogadores-Chave */}
                  {(analysisData[selectedTeam] || 0) >= 50 && selectedTeamData && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6"
                    >
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Star className="h-5 w-5 text-[#ffd700]" />
                        Jogadores-Chave
                      </h3>
                      
                      <div className="grid gap-3">
                        {selectedTeamData.keyPlayers.map((player, i) => (
                          <div key={i} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-sm font-bold text-white">
                              {player.position}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-white">{player.name}</div>
                              <div className="text-xs text-white/50">OVR {player.overall}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-red-400">Ameaca</div>
                              <Progress value={player.threat} className="h-2 w-24" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Estilo e Estatisticas */}
                  {(analysisData[selectedTeam] || 0) >= 75 && selectedTeamData && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid md:grid-cols-2 gap-6"
                    >
                      {/* Estilo de Jogo */}
                      <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Zap className="h-5 w-5 text-primary" />
                          Estilo de Jogo
                        </h3>
                        
                        <div className="space-y-2">
                          {selectedTeamData.style.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-white/80">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Estatisticas */}
                      <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-primary" />
                          Estatisticas
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-white/5 rounded-lg">
                            <div className="text-xl font-bold text-green-400">{selectedTeamData.avgGoalsScored.toFixed(1)}</div>
                            <div className="text-xs text-white/50">Gols/Jogo</div>
                          </div>
                          <div className="text-center p-3 bg-white/5 rounded-lg">
                            <div className="text-xl font-bold text-red-400">{selectedTeamData.avgGoalsConceded.toFixed(1)}</div>
                            <div className="text-xs text-white/50">Sofridos/Jogo</div>
                          </div>
                          <div className="text-center p-3 bg-white/5 rounded-lg">
                            <div className="text-sm font-bold text-white">
                              {selectedTeamData.homeRecord.w}V {selectedTeamData.homeRecord.d}E {selectedTeamData.homeRecord.l}D
                            </div>
                            <div className="text-xs text-white/50">Em Casa</div>
                          </div>
                          <div className="text-center p-3 bg-white/5 rounded-lg">
                            <div className="text-sm font-bold text-white">
                              {selectedTeamData.awayRecord.w}V {selectedTeamData.awayRecord.d}E {selectedTeamData.awayRecord.l}D
                            </div>
                            <div className="text-xs text-white/50">Fora</div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Pontos Fortes e Fracos */}
                  {(analysisData[selectedTeam] || 0) >= 100 && selectedTeamData && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid md:grid-cols-2 gap-6"
                    >
                      {/* Pontos Fortes */}
                      <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl border border-green-500/20 p-6">
                        <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Pontos Fortes
                        </h3>
                        
                        <div className="space-y-2">
                          {selectedTeamData.strengths.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-white/80">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Pontos Fracos */}
                      <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 rounded-xl border border-red-500/20 p-6">
                        <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5" />
                          Vulnerabilidades
                        </h3>
                        
                        <div className="space-y-2">
                          {selectedTeamData.weaknesses.map((w, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-white/80">
                              <Target className="h-4 w-4 text-red-500" />
                              {w}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recomendações Táticas */}
                      <div className="md:col-span-2 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-6">
                        <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                          <Info className="h-5 w-5" />
                          Recomendações Táticas
                        </h3>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-white/70 mb-2">Zonas de Perigo</h4>
                            <div className="space-y-1">
                              {selectedTeamData.dangerZones.map((z, i) => (
                                <div key={i} className="text-sm text-white/80 flex items-center gap-2">
                                  <AlertTriangle className="h-3 w-3 text-[#ffd700]" />
                                  {z}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-white/70 mb-2">Bolas Paradas</h4>
                            <p className="text-sm text-white/80">{selectedTeamData.setpieces}</p>
                          </div>
                        </div>
                        
                        <div className="mt-4 p-4 bg-white/5 rounded-lg">
                          <h4 className="text-sm font-medium text-white mb-2">Estrategia Sugerida</h4>
                          <p className="text-sm text-white/70">
                            {selectedTeamData.mentality === "Muito Ofensivo" 
                              ? "Adote uma postura mais defensiva e explore contra-ataques. Mantenha a linha defensiva compacta."
                              : selectedTeamData.mentality === "Ofensivo"
                              ? "Pressione a saida de bola e explore as laterais. Fique atento aos jogadores-chave."
                              : "Jogo equilibrado. Imponha seu ritmo e controle a posse de bola."}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-12 flex flex-col items-center justify-center text-center h-full">
                <Eye className="h-16 w-16 text-white/20 mb-4" />
                <h3 className="text-xl font-bold text-white/60 mb-2">Selecione um Adversario</h3>
                <p className="text-sm text-white/40 max-w-md">
                  Escolha um time na lista para analisar suas taticas, jogadores-chave e vulnerabilidades.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
