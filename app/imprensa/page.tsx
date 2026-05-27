"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Mic,
  MicOff,
  MessageCircle,
  Camera,
  Newspaper,
  Radio,
  Tv,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  ChevronRight,
  User,
  Quote,
  Sparkles,
  Flame,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Meh
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useGameState } from "@/lib/save-system"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameEngine, type PressQuestion } from "@/lib/game-engine"

// Perguntas de conferencia
const PRESS_QUESTIONS: PressQuestion[] = [
  {
    id: 1,
    type: "match",
    question: "Como avalia o desempenho do time na ultima partida?",
    options: [
      { text: "Estou muito satisfeito, jogamos muito bem e merecemos a vitoria.", tone: "positivo", impact: 5 },
      { text: "Foi um resultado justo, mas podemos melhorar em alguns aspectos.", tone: "neutro", impact: 0 },
      { text: "Nao estou feliz com o que vi, precisamos reagir urgentemente.", tone: "negativo", impact: -3 }
    ]
  },
  {
    id: 2,
    type: "player",
    question: "O que pensa sobre o momento do seu atacante titular?",
    options: [
      { text: "Esta em grande fase, merece todos os elogios.", tone: "positivo", impact: 4 },
      { text: "Confio nele, os gols vao sair naturalmente.", tone: "neutro", impact: 1 },
      { text: "Precisa melhorar, estou cobrando mais dedicacao.", tone: "negativo", impact: -4 }
    ]
  },
  {
    id: 3,
    type: "rival",
    question: "O que espera do confronto contra o lider do campeonato?",
    options: [
      { text: "Vamos jogar para vencer, respeitamos mas nao tememos ninguem.", tone: "positivo", impact: 3 },
      { text: "Sera um jogo muito dificil, estamos nos preparando bem.", tone: "neutro", impact: 1 },
      { text: "Eles sao favoritos, mas podemos surpreender.", tone: "negativo", impact: -2 }
    ]
  },
  {
    id: 4,
    type: "tactics",
    question: "Pretende fazer mudancas taticas para o proximo jogo?",
    options: [
      { text: "Sempre fazemos ajustes, mas a essencia do time permanece.", tone: "neutro", impact: 1 },
      { text: "Estamos bem como estamos, nao vejo necessidade de mudar.", tone: "positivo", impact: 2 },
      { text: "Nao vou revelar nossa estrategia para a imprensa.", tone: "agressivo", impact: -1 }
    ]
  },
  {
    id: 5,
    type: "transfer",
    question: "O clube esta no mercado por reforcos nesta janela?",
    options: [
      { text: "Estamos sempre atentos a oportunidades que facam sentido.", tone: "positivo", impact: 2 },
      { text: "Confio no elenco que temos, sao jogadores de qualidade.", tone: "neutro", impact: 3 },
      { text: "Precisamos de reforcos, isso e evidente para todos.", tone: "negativo", impact: -5 }
    ]
  },
  {
    id: 6,
    type: "injury",
    question: "Como esta a situacao medica do elenco?",
    options: [
      { text: "Todos estao bem, nao temos preocupacoes nesse sentido.", tone: "positivo", impact: 2 },
      { text: "Temos alguns jogadores em recuperacao, mas nada grave.", tone: "neutro", impact: 0 },
      { text: "Estamos com muitos desfalques, e uma situacao complicada.", tone: "negativo", impact: -3 }
    ]
  },
  {
    id: 7,
    type: "match",
    question: "O time esta pressionado apos os ultimos resultados?",
    options: [
      { text: "Pressao faz parte do futebol, sabemos lidar com isso.", tone: "positivo", impact: 3 },
      { text: "Estamos focados no trabalho, os resultados virao.", tone: "neutro", impact: 1 },
      { text: "A situacao e delicada, precisamos de uma reacao imediata.", tone: "negativo", impact: -4 }
    ]
  },
  {
    id: 8,
    type: "player",
    question: "O que diz sobre as criticas da torcida a alguns jogadores?",
    options: [
      { text: "A torcida tem direito de cobrar, mas confio em todos.", tone: "positivo", impact: 4 },
      { text: "Entendo a frustracao, estamos trabalhando para melhorar.", tone: "neutro", impact: 1 },
      { text: "Alguns jogadores realmente precisam corresponder mais.", tone: "negativo", impact: -6 }
    ]
  }
]

// Tipos de jornalista
const JOURNALIST_TYPES = [
  { icon: Tv, name: "TV Globo", color: "text-red-400" },
  { icon: Radio, name: "Radio CBN", color: "text-blue-400" },
  { icon: Newspaper, name: "Folha de SP", color: "text-orange-400" },
  { icon: Camera, name: "ESPN Brasil", color: "text-yellow-400" },
]

// Historico de conferencias
interface ConferenceHistory {
  week: number
  questionsAnswered: number
  overallTone: "positivo" | "neutro" | "negativo"
  moraleImpact: number
  headlines: string[]
}

export default function ImprensaPage() {
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
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isConferenceActive, setIsConferenceActive] = useState(false)
  const [answeredQuestions, setAnsweredQuestions] = useState<{ questionId: number; tone: string; impact: number }[]>([])
  const [conferenceHistory, setConferenceHistory] = useState<ConferenceHistory[]>([
    { week: 8, questionsAnswered: 3, overallTone: "positivo", moraleImpact: 8, headlines: ["Treinador confiante apos vitoria"] },
    { week: 4, questionsAnswered: 3, overallTone: "neutro", moraleImpact: 2, headlines: ["Tecnico pede calma a torcida"] },
    { week: 1, questionsAnswered: 3, overallTone: "negativo", moraleImpact: -5, headlines: ["Coletiva tensa apos derrota"] },
  ])
  const [showResult, setShowResult] = useState(false)
  
  const { currentWeek, addMoraleEvent, squadMorale } = gameEngine

  // Selecionar 3 perguntas aleatorias
  const selectedQuestions = useMemo(() => {
    const shuffled = [...PRESS_QUESTIONS].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 3)
  }, [isConferenceActive])

  const currentQuestion = selectedQuestions[currentQuestionIndex]

  // Iniciar conferencia
  const startConference = () => {
    setIsConferenceActive(true)
    setCurrentQuestionIndex(0)
    setAnsweredQuestions([])
    setShowResult(false)
  }

  // Responder pergunta
  const answerQuestion = (optionIndex: number) => {
    const option = currentQuestion.options[optionIndex]
    
    setAnsweredQuestions(prev => [...prev, {
      questionId: currentQuestion.id,
      tone: option.tone,
      impact: option.impact
    }])

    if (currentQuestionIndex < selectedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else {
      // Finalizar conferencia
      finishConference()
    }
  }

  // Finalizar conferencia
  const finishConference = () => {
    const totalImpact = answeredQuestions.reduce((sum, q) => sum + q.impact, 0) + 
      (currentQuestion ? currentQuestion.options[0].impact : 0)
    
    const positiveCount = answeredQuestions.filter(q => q.tone === "positivo").length
    const negativeCount = answeredQuestions.filter(q => q.tone === "negativo").length
    
    let overallTone: "positivo" | "neutro" | "negativo" = "neutro"
    if (positiveCount > negativeCount) overallTone = "positivo"
    else if (negativeCount > positiveCount) overallTone = "negativo"

    // Gerar manchetes
    const headlines = [
      overallTone === "positivo" 
        ? "Treinador elogia dedicacao do grupo" 
        : overallTone === "negativo"
        ? "Tecnico admite problemas no elenco"
        : "Coletiva tranquila no clube"
    ]

    // Adicionar ao historico
    setConferenceHistory(prev => [{
      week: currentWeek,
      questionsAnswered: 3,
      overallTone,
      moraleImpact: totalImpact,
      headlines
    }, ...prev])

    // Aplicar impacto na moral
    addMoraleEvent({
      type: totalImpact > 0 ? "elogio" : totalImpact < 0 ? "conflito" : "elogio",
      description: `Conferencia de imprensa: ${headlines[0]}`,
      impact: totalImpact
    })

    setShowResult(true)
    setIsConferenceActive(false)
  }

  const getToneColor = (tone: string) => {
    switch (tone) {
      case "positivo": return "text-green-400"
      case "neutro": return "text-yellow-400"
      case "negativo": return "text-red-400"
      case "agressivo": return "text-orange-400"
      default: return "text-white/50"
    }
  }

  const getToneIcon = (tone: string) => {
    switch (tone) {
      case "positivo": return ThumbsUp
      case "neutro": return Meh
      case "negativo": return ThumbsDown
      case "agressivo": return Flame
      default: return MessageCircle
    }
  }

  return (
    <div className="h-screen pl-16 bg-[#050508] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />
      
      <main className="flex-1 p-4 md:p-6 overflow-y-auto scrollbar-premium">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Sala de Imprensa</h1>
            <p className="text-sm text-white/50">Gerencie sua relacao com a midia e imagem publica</p>
          </div>
          
          {!isConferenceActive && !showResult && (
            <Button onClick={startConference} className="gap-2">
              <Mic className="h-4 w-4" />
              Iniciar Coletiva
            </Button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {isConferenceActive && currentQuestion ? (
            <motion.div
              key="conference"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
              {/* Progresso */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/70">Pergunta {currentQuestionIndex + 1} de {selectedQuestions.length}</span>
                  <span className="text-primary font-medium">
                    {Math.round(((currentQuestionIndex) / selectedQuestions.length) * 100)}%
                  </span>
                </div>
                <Progress value={(currentQuestionIndex / selectedQuestions.length) * 100} className="h-2" />
              </div>

              {/* Sala de Imprensa */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-8">
                {/* Jornalista */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                    {(() => {
                      const journalist = JOURNALIST_TYPES[currentQuestionIndex % JOURNALIST_TYPES.length]
                      return <journalist.icon className={cn("h-6 w-6", journalist.color)} />
                    })()}
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {JOURNALIST_TYPES[currentQuestionIndex % JOURNALIST_TYPES.length].name}
                    </div>
                    <div className="text-sm text-white/50">Jornalista</div>
                  </div>
                </div>

                {/* Pergunta */}
                <div className="mb-8">
                  <div className="flex items-start gap-3">
                    <Quote className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <p className="text-xl text-white leading-relaxed">
                      {currentQuestion.question}
                    </p>
                  </div>
                </div>

                {/* Opcoes de Resposta */}
                <div className="space-y-3">
                  {currentQuestion.options.map((option, i) => {
                    const ToneIcon = getToneIcon(option.tone)
                    return (
                      <motion.button
                        key={i}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => answerQuestion(i)}
                        className="w-full p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all text-left group"
                      >
                        <div className="flex items-start gap-3">
                          <ToneIcon className={cn("h-5 w-5 mt-0.5", getToneColor(option.tone))} />
                          <div className="flex-1">
                            <p className="text-white group-hover:text-white transition-colors">
                              &ldquo;{option.text}&rdquo;
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full",
                                option.tone === "positivo" ? "bg-green-500/20 text-green-400" :
                                option.tone === "neutro" ? "bg-yellow-500/20 text-yellow-400" :
                                option.tone === "negativo" ? "bg-red-500/20 text-red-400" :
                                "bg-orange-500/20 text-orange-400"
                              )}>
                                {option.tone.charAt(0).toUpperCase() + option.tone.slice(1)}
                              </span>
                              <span className={cn(
                                "text-xs",
                                option.impact > 0 ? "text-green-400" : option.impact < 0 ? "text-red-400" : "text-white/50"
                              )}>
                                {option.impact > 0 ? "+" : ""}{option.impact} moral
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-white/60 transition-colors" />
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          ) : showResult ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                  <MicOff className="h-8 w-8 text-primary" />
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2">Coletiva Encerrada</h2>
                <p className="text-white/60 mb-8">Veja como a imprensa reagiu as suas respostas</p>

                {/* Resumo */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="text-2xl font-bold text-green-400">
                      {answeredQuestions.filter(q => q.tone === "positivo").length}
                    </div>
                    <div className="text-xs text-white/50">Respostas Positivas</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-400">
                      {answeredQuestions.filter(q => q.tone === "neutro").length}
                    </div>
                    <div className="text-xs text-white/50">Respostas Neutras</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="text-2xl font-bold text-red-400">
                      {answeredQuestions.filter(q => q.tone === "negativo" || q.tone === "agressivo").length}
                    </div>
                    <div className="text-xs text-white/50">Respostas Negativas</div>
                  </div>
                </div>

                {/* Impacto */}
                <div className="p-4 bg-white/5 rounded-lg mb-6">
                  <div className="text-sm text-white/70 mb-2">Impacto na Moral do Elenco</div>
                  <div className={cn(
                    "text-3xl font-bold",
                    answeredQuestions.reduce((s, q) => s + q.impact, 0) > 0 
                      ? "text-green-400" 
                      : answeredQuestions.reduce((s, q) => s + q.impact, 0) < 0 
                        ? "text-red-400" 
                        : "text-yellow-400"
                  )}>
                    {answeredQuestions.reduce((s, q) => s + q.impact, 0) > 0 ? "+" : ""}
                    {answeredQuestions.reduce((s, q) => s + q.impact, 0)}
                  </div>
                </div>

                <Button onClick={() => setShowResult(false)} className="w-full">
                  Fechar
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid lg:grid-cols-2 gap-6"
            >
              {/* Status Atual */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Reputacao na Midia
                </h2>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-white/5 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">{squadMorale.overall}%</div>
                    <div className="text-xs text-white/50">Moral do Elenco</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">{conferenceHistory.length}</div>
                    <div className="text-xs text-white/50">Coletivas Realizadas</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-white/80">Coletivas Positivas</span>
                    </div>
                    <span className="text-sm font-bold text-green-400">
                      {conferenceHistory.filter(c => c.overallTone === "positivo").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Meh className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm text-white/80">Coletivas Neutras</span>
                    </div>
                    <span className="text-sm font-bold text-yellow-400">
                      {conferenceHistory.filter(c => c.overallTone === "neutro").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4 text-red-400" />
                      <span className="text-sm text-white/80">Coletivas Negativas</span>
                    </div>
                    <span className="text-sm font-bold text-red-400">
                      {conferenceHistory.filter(c => c.overallTone === "negativo").length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Historico */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-primary" />
                  Historico de Coletivas
                </h2>
                
                <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
                  {conferenceHistory.map((conf, i) => (
                    <div key={i} className="p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-white/50" />
                          <span className="text-sm text-white/70">Semana {conf.week}</span>
                        </div>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          conf.overallTone === "positivo" ? "bg-green-500/20 text-green-400" :
                          conf.overallTone === "negativo" ? "bg-red-500/20 text-red-400" :
                          "bg-yellow-500/20 text-yellow-400"
                        )}>
                          {conf.overallTone.charAt(0).toUpperCase() + conf.overallTone.slice(1)}
                        </span>
                      </div>
                      <div className="text-sm text-white mb-2">{conf.headlines[0]}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-white/50">{conf.questionsAnswered} perguntas</span>
                        <span className="text-white/30">|</span>
                        <span className={cn(
                          conf.moraleImpact > 0 ? "text-green-400" : 
                          conf.moraleImpact < 0 ? "text-red-400" : "text-white/50"
                        )}>
                          {conf.moraleImpact > 0 ? "+" : ""}{conf.moraleImpact} moral
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dicas */}
              <div className="lg:col-span-2 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Dicas para Coletivas
                </h2>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white/5 rounded-lg">
                    <ThumbsUp className="h-6 w-6 text-green-400 mb-2" />
                    <h3 className="font-medium text-white mb-1">Respostas Positivas</h3>
                    <p className="text-xs text-white/60">
                      Aumentam a moral do elenco e criam um ambiente positivo no vestiario.
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg">
                    <Meh className="h-6 w-6 text-yellow-400 mb-2" />
                    <h3 className="font-medium text-white mb-1">Respostas Neutras</h3>
                    <p className="text-xs text-white/60">
                      Sao seguras e mantem a estabilidade, sem grandes riscos.
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg">
                    <Flame className="h-6 w-6 text-red-400 mb-2" />
                    <h3 className="font-medium text-white mb-1">Respostas Agressivas</h3>
                    <p className="text-xs text-white/60">
                      Podem motivar alguns jogadores, mas tambem gerar conflitos.
                    </p>
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
