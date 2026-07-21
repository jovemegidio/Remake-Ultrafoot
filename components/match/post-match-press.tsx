"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import {
  Mic,
  MicOff,
  Quote,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Meh,
  Flame,
  Camera,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { type Team } from "@/lib/teams-data"
import { TeamCrest } from "@/components/team-crest"

// Identidade visual por veículo. Os arquivos são empacotados para o modo offline;
// nenhum modal depende de baixar imagens durante a coletiva.
const MEDIA_OUTLETS = [
  {
    id: "globo",
    name: "TV Globo",
    logo: "/logos/globo.jpg",
    bgColor: "#1e40af",
    type: "TV"
  },
  {
    id: "cbn",
    name: "CBN",
    logo: "/logos/cbn.svg",
    bgColor: "#dc2626",
    type: "Radio"
  },
  {
    id: "folha",
    name: "Folha de S.Paulo",
    logo: "/logos/folha.svg",
    bgColor: "#0ea5e9",
    type: "Jornal"
  },
  {
    id: "espn",
    name: "ESPN Brasil",
    logo: "/logos/espn.png",
    bgColor: "#ef4444",
    type: "TV"
  },
  {
    id: "ge",
    name: "ge.globo",
    logo: null,
    bgColor: "#22c55e",
    type: "Portal"
  }
]

// Perguntas de coletiva pos-jogo baseadas no resultado
interface PressQuestion {
  id: number
  condition: "win" | "loss" | "draw" | "any"
  question: string
  options: {
    text: string
    tone: "positivo" | "neutro" | "negativo" | "agressivo"
    impact: number
  }[]
}

const POST_MATCH_QUESTIONS: PressQuestion[] = [
  // Perguntas para VITORIA
  {
    id: 1,
    condition: "win",
    question: "Uma vitoria importante. O que mais agradou no desempenho do time?",
    options: [
      { text: "O grupo todo esta de parabens, jogamos com intensidade e qualidade.", tone: "positivo", impact: 5 },
      { text: "Vencemos mas ainda temos muito a melhorar para os proximos jogos.", tone: "neutro", impact: 2 },
      { text: "Hoje conseguimos, mas precisamos manter os pes no chao.", tone: "neutro", impact: 1 }
    ]
  },
  {
    id: 2,
    condition: "win",
    question: "Essa vitoria muda a perspectiva para a sequencia da temporada?",
    options: [
      { text: "Queremos mais, esse e so o comeco de uma grande campanha.", tone: "positivo", impact: 4 },
      { text: "E jogo a jogo, nao podemos pensar muito a frente.", tone: "neutro", impact: 1 },
      { text: "Ainda ha muito trabalho pela frente, nao vamos nos empolgar.", tone: "neutro", impact: 0 }
    ]
  },
  // Perguntas para DERROTA
  {
    id: 3,
    condition: "loss",
    question: "Resultado negativo. O que faltou para o time hoje?",
    options: [
      { text: "Faltou concentracao em momentos decisivos, vamos corrigir.", tone: "neutro", impact: 0 },
      { text: "O adversario foi superior, temos que reconhecer.", tone: "negativo", impact: -3 },
      { text: "Nao vou aceitar esse tipo de atuacao, vamos cobrar no vestiario.", tone: "agressivo", impact: -4 }
    ]
  },
  {
    id: 4,
    condition: "loss",
    question: "A torcida saiu decepcionada. O que diz a eles?",
    options: [
      { text: "Entendo a frustacao, vamos trabalhar para dar a volta por cima.", tone: "neutro", impact: 1 },
      { text: "Peco desculpas, eles merecem mais do que isso.", tone: "negativo", impact: -2 },
      { text: "Precisamos do apoio deles, juntos vamos sair dessa.", tone: "positivo", impact: 3 }
    ]
  },
  // Perguntas para EMPATE
  {
    id: 5,
    condition: "draw",
    question: "Um ponto conquistado ou dois perdidos?",
    options: [
      { text: "Olhando o contexto do jogo, foi um resultado justo.", tone: "neutro", impact: 1 },
      { text: "Viemos buscar a vitoria e nao conseguimos, e frustrante.", tone: "negativo", impact: -2 },
      { text: "Somamos mais um ponto, seguimos em frente.", tone: "positivo", impact: 2 }
    ]
  },
  {
    id: 6,
    condition: "draw",
    question: "O time conseguiu impor seu estilo de jogo?",
    options: [
      { text: "Sim, criamos boas chances, mas faltou eficiencia.", tone: "positivo", impact: 2 },
      { text: "Nem sempre conseguimos jogar como queremos.", tone: "neutro", impact: 0 },
      { text: "Honestamente, esperava mais do time hoje.", tone: "negativo", impact: -3 }
    ]
  },
  // Perguntas GERAIS (qualquer resultado)
  {
    id: 7,
    condition: "any",
    question: "Como avalia a arbitragem da partida?",
    options: [
      { text: "Prefiro nao comentar sobre arbitragem, foco no nosso trabalho.", tone: "neutro", impact: 0 },
      { text: "Acho que foi uma arbitragem equilibrada.", tone: "positivo", impact: 1 },
      { text: "Algumas decisoes foram duvidosas, mas nao vou usar como desculpa.", tone: "agressivo", impact: -2 }
    ]
  },
  {
    id: 8,
    condition: "any",
    question: "Algum jogador que mereca destaque na partida?",
    options: [
      { text: "O merito e coletivo, todos deram o maximo pelo time.", tone: "positivo", impact: 3 },
      { text: "Temos individualidades importantes que fizeram a diferenca.", tone: "neutro", impact: 1 },
      { text: "Prefiro nao individualizar, futebol e esporte coletivo.", tone: "neutro", impact: 0 }
    ]
  },
  {
    id: 9,
    condition: "any",
    question: "Ha preocupacao com lesoes apos o jogo?",
    options: [
      { text: "Vamos avaliar com calma, mas acredito que estao todos bem.", tone: "positivo", impact: 1 },
      { text: "Temos alguns jogadores no limite, vamos monitorar.", tone: "neutro", impact: -1 },
      { text: "O calendario e cruel, e impossivel nao ter problemas.", tone: "negativo", impact: -2 }
    ]
  }
]

interface PostMatchPressProps {
  isOpen: boolean
  onClose: () => void
  homeTeam: Team
  awayTeam: Team
  homeGoals: number
  awayGoals: number
  userSide: "home" | "away"
  /**
   * Fecha a coletiva devolvendo o efeito das respostas.
   *
   * O TOM vai junto do numero porque diretoria e elenco julgam coisas
   * diferentes: uma resposta agressiva pode levantar o vestiario e ao mesmo
   * tempo desagradar a diretoria. So o saldo de moral nao permitia distinguir.
   */
  onComplete: (efeito: { moraleImpact: number; tons: string[] }) => void
}

export function PostMatchPress({
  isOpen,
  onClose,
  homeTeam,
  awayTeam,
  homeGoals,
  awayGoals,
  userSide,
  onComplete
}: PostMatchPressProps) {
  const router = useRouter()
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState<{ tone: string; impact: number }[]>([])
  const [showResult, setShowResult] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Determina se o usuario ganhou, perdeu ou empatou
  const matchResult = useMemo(() => {
    const userGoals = userSide === "home" ? homeGoals : awayGoals
    const opponentGoals = userSide === "home" ? awayGoals : homeGoals
    if (userGoals > opponentGoals) return "win"
    if (userGoals < opponentGoals) return "loss"
    return "draw"
  }, [homeGoals, awayGoals, userSide])

  const userTeam = userSide === "home" ? homeTeam : awayTeam

  // Seleciona 3 perguntas apropriadas para o resultado
  const selectedQuestions = useMemo(() => {
    const matchQuestions = POST_MATCH_QUESTIONS.filter(
      q => q.condition === matchResult || q.condition === "any"
    )
    const shuffled = [...matchQuestions].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 3)
  }, [matchResult])

  const currentQuestion = selectedQuestions[currentQuestionIndex]
  const currentMedia = MEDIA_OUTLETS[currentQuestionIndex % MEDIA_OUTLETS.length]

  // Responder pergunta
  const answerQuestion = useCallback((optionIndex: number) => {
    if (isAnimating) return
    setIsAnimating(true)

    const option = currentQuestion.options[optionIndex]
    setAnsweredQuestions(prev => [...prev, { tone: option.tone, impact: option.impact }])

    setTimeout(() => {
      if (currentQuestionIndex < selectedQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1)
      } else {
        setShowResult(true)
      }
      setIsAnimating(false)
    }, 300)
  }, [currentQuestion, currentQuestionIndex, selectedQuestions.length, isAnimating])

  // Finalizar e voltar para o office
  const finishAndReturn = useCallback(() => {
    const totalImpact = answeredQuestions.reduce((sum, q) => sum + q.impact, 0)
    onComplete({ moraleImpact: totalImpact, tons: answeredQuestions.map(q => q.tone) })
    router.push("/")
  }, [answeredQuestions, onComplete, router])

  // Pular coletiva
  const skipPress = useCallback(() => {
    onComplete({ moraleImpact: 0, tons: [] })
    router.push("/")
  }, [onComplete, router])

  const getToneColor = (tone: string) => {
    switch (tone) {
      case "positivo": return "text-green-400 bg-green-500/20"
      case "neutro": return "text-yellow-400 bg-yellow-500/20"
      case "negativo": return "text-red-400 bg-red-500/20"
      case "agressivo": return "text-orange-400 bg-orange-500/20"
      default: return "text-white/50 bg-white/10"
    }
  }

  const getToneIcon = (tone: string) => {
    switch (tone) {
      case "positivo": return ThumbsUp
      case "neutro": return Meh
      case "negativo": return ThumbsDown
      case "agressivo": return Flame
      default: return Mic
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col"
      >
        {/* Header da coletiva */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <Mic className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Coletiva Pos-Jogo</h1>
                <p className="text-xs text-white/50">Sala de Imprensa</p>
              </div>
            </div>

            {/* Resultado da partida */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 border border-white/10 ml-4">
              <TeamCrest team={homeTeam} size="sm" />
              <span className="text-lg font-bold text-white tabular-nums">{homeGoals}</span>
              <span className="text-white/30">-</span>
              <span className="text-lg font-bold text-white tabular-nums">{awayGoals}</span>
              <TeamCrest team={awayTeam} size="sm" />
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={skipPress}
            className="text-white/50 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4 mr-1" />
            Pular
          </Button>
        </header>

        <main className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {!showResult ? (
              <motion.div
                key="questions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-3xl"
              >
                {/* Progresso */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/70">Pergunta {currentQuestionIndex + 1} de {selectedQuestions.length}</span>
                    <span className="text-[#00ffc8] font-medium">
                      {Math.round((currentQuestionIndex / selectedQuestions.length) * 100)}%
                    </span>
                  </div>
                  <Progress value={(currentQuestionIndex / selectedQuestions.length) * 100} className="h-1.5" />
                </div>

                {/* Card da pergunta */}
                <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-2xl border border-white/10 overflow-hidden">
                  {/* Barra do time */}
                  <div className="h-1" style={{ backgroundColor: userTeam.cor1 }} />
                  
                  <div className="p-8">
                    {/* Jornalista */}
                    <div className="flex items-center gap-4 mb-8">
                      <div 
                        className="w-20 h-16 rounded-xl flex items-center justify-center overflow-hidden"
                        style={{ backgroundColor: currentMedia.bgColor }}
                      >
                        {currentMedia.logo ? (
                          // object-contain, NAO object-cover: as logos tem proporcoes
                          // diferentes e o cover cortava as laterais das marcas largas
                          // (a CBN aparecia sem as bordas). Mutilar a marca e pior do
                          // que uma folga; o bgColor do veiculo preenche o resto.
                          <Image
                            src={currentMedia.logo}
                            alt={currentMedia.name}
                            width={80}
                            height={64}
                            className="h-full w-full object-contain p-1.5"
                          />
                        ) : (
                          <span className="text-white font-bold text-sm">{currentMedia.name.slice(0, 3)}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-lg">{currentMedia.name}</div>
                        <div className="text-sm text-white/50">{currentMedia.type} - Jornalista</div>
                      </div>
                    </div>

                    {/* Pergunta */}
                    <div className="mb-8">
                      <div className="flex items-start gap-3">
                        <Quote className="h-6 w-6 text-[#00ffc8] flex-shrink-0 mt-1" />
                        <p className="text-xl md:text-2xl text-white leading-relaxed font-medium">
                          {currentQuestion?.question}
                        </p>
                      </div>
                    </div>

                    {/* Opcoes de Resposta */}
                    <div className="space-y-3">
                      {currentQuestion?.options.map((option, i) => {
                        const ToneIcon = getToneIcon(option.tone)
                        return (
                          <motion.button
                            key={i}
                            whileHover={{ scale: 1.01, x: 4 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => answerQuestion(i)}
                            disabled={isAnimating}
                            className="w-full p-5 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all text-left group disabled:opacity-50"
                          >
                            <div className="flex items-start gap-4">
                              <div className={cn("p-2 rounded-lg", getToneColor(option.tone).split(" ")[1])}>
                                <ToneIcon className={cn("h-5 w-5", getToneColor(option.tone).split(" ")[0])} />
                              </div>
                              <div className="flex-1">
                                <p className="text-white text-base md:text-lg group-hover:text-white transition-colors leading-relaxed">
                                  &ldquo;{option.text}&rdquo;
                                </p>
                                <div className="flex items-center gap-3 mt-3">
                                  <span className={cn(
                                    "text-xs px-2.5 py-1 rounded-full font-medium",
                                    getToneColor(option.tone)
                                  )}>
                                    {option.tone.charAt(0).toUpperCase() + option.tone.slice(1)}
                                  </span>
                                  <span className={cn(
                                    "text-xs font-medium",
                                    option.impact > 0 ? "text-green-400" : option.impact < 0 ? "text-red-400" : "text-white/50"
                                  )}>
                                    {option.impact > 0 ? "+" : ""}{option.impact} moral
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-white/20 group-hover:text-white/60 transition-colors mt-2" />
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-2xl"
              >
                <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-2xl border border-white/10 p-8 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00ffc8]/20 to-[#00ffc8]/5 flex items-center justify-center mx-auto mb-6 border border-[#00ffc8]/30">
                    <MicOff className="h-10 w-10 text-[#00ffc8]" />
                  </div>
                  
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Coletiva Encerrada</h2>
                  <p className="text-white/60 mb-8">Confira o impacto das suas declaracoes</p>

                  {/* Resumo */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                      <div className="text-3xl font-bold text-green-400">
                        {answeredQuestions.filter(q => q.tone === "positivo").length}
                      </div>
                      <div className="text-xs text-green-400/70 mt-1">Positivas</div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                      <div className="text-3xl font-bold text-yellow-400">
                        {answeredQuestions.filter(q => q.tone === "neutro").length}
                      </div>
                      <div className="text-xs text-yellow-400/70 mt-1">Neutras</div>
                    </div>
                    <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                      <div className="text-3xl font-bold text-red-400">
                        {answeredQuestions.filter(q => q.tone === "negativo" || q.tone === "agressivo").length}
                      </div>
                      <div className="text-xs text-red-400/70 mt-1">Negativas</div>
                    </div>
                  </div>

                  {/* Impacto Total */}
                  <div className="p-6 bg-white/5 rounded-xl border border-white/10 mb-8">
                    <div className="text-sm text-white/60 mb-2">Impacto na Moral do Elenco</div>
                    <div className={cn(
                      "text-5xl font-bold",
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

                  <Button 
                    onClick={finishAndReturn} 
                    className="w-full h-12 text-base font-bold bg-gradient-to-r from-[#00ffc8] to-[#00c8ff] text-black hover:from-[#33ffd4] hover:to-[#33d4ff]"
                  >
                    Voltar ao Escritorio
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer com flashes das cameras */}
        <footer className="px-6 py-3 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {MEDIA_OUTLETS.slice(0, 4).map((media, i) => (
              <div 
                key={media.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all",
                  i === currentQuestionIndex && !showResult
                    ? "bg-white/10 border border-white/20"
                    : "opacity-50"
                )}
              >
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: media.bgColor }}
                >
                  {media.logo ? (
                    <Image src={media.logo} alt={media.name} width={16} height={16} className="object-contain" />
                  ) : (
                    <span className="text-[8px] font-bold text-white">{media.id.toUpperCase()}</span>
                  )}
                </div>
                <span className="text-xs text-white/70">{media.name}</span>
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <Camera className="h-4 w-4" />
            <span>Transmissao ao vivo</span>
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  )
}
