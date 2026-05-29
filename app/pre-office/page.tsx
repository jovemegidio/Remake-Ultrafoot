"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Heart,
  MessageSquare,
  PlayCircle,
  AlertTriangle,
  FileText,
  Dumbbell,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Newspaper,
  TrendingUp,
  ShoppingBag,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { GamepadControlsBar } from "@/components/gamepad-controls-bar"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useGameManager } from "@/lib/use-game-manager"
import { useGameEngine, getContractStatus } from "@/lib/game-engine"
import { hardNavigate } from "@/lib/hard-navigation"

const WEEKDAYS = ["DOMINGO", "SEGUNDA-FEIRA", "TERCA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SABADO"]
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]

function roundToMonth(round: number): number {
  const monthOffset = Math.floor((round - 1) * 9 / 38)
  return Math.min(11, 3 + monthOffset)
}

function roundToDay(round: number): number {
  const days = [1, 5, 8, 12, 15, 19, 22, 26, 29]
  return days[(round - 1) % 9] || 15
}

// Mock news - mantido enquanto nao ha sistema de noticias real no engine
const MOCK_NEWS = [
  {
    id: 1,
    source: "FC FOOTBALL",
    date: "Hoje",
    title: "Brasileirao Esquenta na Reta Final",
    description: "Disputa acirrada pelo titulo com 5 times na briga pela lideranca...",
    likes: 1800,
    comments: 156,
    isNew: true
  },
  {
    id: 2,
    source: "MERCADO DA BOLA",
    date: "Ontem",
    title: "Clubes Europeus de Olho no Brasil",
    description: "Jovens promessas atraem olheiros de grandes clubes do Velho Continente...",
    likes: 3200,
    comments: 234,
    isNew: false
  },
  {
    id: 3,
    source: "ESPORTE NEWS",
    date: "2 dias",
    title: "Janela de Transferencias em Alta",
    description: "Movimentacoes intensas esperadas nos proximos dias entre os clubes...",
    likes: 2400,
    comments: 88,
    isNew: false
  }
]

export default function PreOfficePage() {
  const {
    hydrated,
    userTeam,
    seasonCalendar,
    currentRound,
    advanceWeek,
    saveState,
  } = useGameManager()
  const gameEngine = useGameEngine()

  const [isAdvancing, setIsAdvancing] = useState(false)
  const [selectedTask, setSelectedTask] = useState(0)
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0)

  // Data do jogo derivada da semana real do saveState
  const gameDate = useMemo(() => {
    const week = Math.max(1, saveState.week)
    return new Date(saveState.season, roundToMonth(week), roundToDay(week))
  }, [saveState.week, saveState.season])

  const dayOfWeek = WEEKDAYS[gameDate.getDay()]
  const day = gameDate.getDate().toString().padStart(2, '0')
  const month = MONTHS[gameDate.getMonth()]

  const nextUserMatch = seasonCalendar.nextUserMatch

  // Dias ate proxima partida (aprox 7 dias por rodada)
  const daysUntilMatch = nextUserMatch
    ? Math.max(1, (nextUserMatch.round - currentRound) * 7)
    : null

  // Adversario da proxima partida
  const nextOpponent = nextUserMatch && userTeam
    ? (nextUserMatch.homeTeam.curto === userTeam.curto
        ? nextUserMatch.awayTeam
        : nextUserMatch.homeTeam)
    : null

  // Tarefas dinamicas baseadas em dados reais do jogo
  const realTasks = useMemo(() => {
    if (!userTeam) return []
    const engineWeek = gameEngine.currentWeek
    const tasks: Array<{
      id: number
      title: string
      icon: React.ElementType
      action: string
      actionLabel: string
      priority: "high" | "medium" | "low"
    }> = []

    // Proxima partida
    if (nextUserMatch) {
      const opponent = nextUserMatch.homeTeam.curto === userTeam.curto
        ? nextUserMatch.awayTeam.nome
        : nextUserMatch.homeTeam.nome
      tasks.push({
        id: 1,
        title: `Preparar para ${opponent}`,
        icon: Trophy,
        action: "/partida",
        actionLabel: "Ir para Partida",
        priority: "high"
      })
    }

    // Jogadores lesionados
    const injured = gameEngine.squadPlayers.filter(p => p.injury)
    if (injured.length > 0) {
      tasks.push({
        id: 2,
        title: `${injured.length} Jogador${injured.length > 1 ? "es" : ""} Lesionado${injured.length > 1 ? "s" : ""}`,
        icon: AlertTriangle,
        action: "/elenco",
        actionLabel: "Ver Elenco",
        priority: "high"
      })
    }

    // Contratos expirando
    const expiring = gameEngine.squadPlayers.filter(p =>
      getContractStatus(p, engineWeek) === "expiring" ||
      getContractStatus(p, engineWeek) === "expired"
    )
    if (expiring.length > 0) {
      tasks.push({
        id: 3,
        title: `${expiring.length} Contrato${expiring.length > 1 ? "s" : ""} Expirando`,
        icon: FileText,
        action: "/elenco",
        actionLabel: "Renovar Contratos",
        priority: "medium"
      })
    }

    // Ofertas de transferencia pendentes
    const pendingOffers = gameEngine.transferOffers.filter(o => o.status === "pendente")
    if (pendingOffers.length > 0) {
      tasks.push({
        id: 4,
        title: `${pendingOffers.length} Oferta${pendingOffers.length > 1 ? "s" : ""} de Transferencia`,
        icon: ShoppingBag,
        action: "/mercado",
        actionLabel: "Ver Mercado",
        priority: "medium"
      })
    }

    // Treino (sempre disponivel)
    tasks.push({
      id: 5,
      title: "Sessao de Treinamento",
      icon: Dumbbell,
      action: "/treinamento",
      actionLabel: "Abrir Treino",
      priority: tasks.length === 0 ? "high" : "low"
    })

    // Classificacao (sempre disponivel)
    tasks.push({
      id: 6,
      title: "Ver Classificacao",
      icon: TrendingUp,
      action: "/competicoes",
      actionLabel: "Ver Tabela",
      priority: "low"
    })

    return tasks
  }, [gameEngine.squadPlayers, gameEngine.transferOffers, gameEngine.currentWeek, nextUserMatch, userTeam])

  // Avanca rodada real e navega conforme resultado
  const handleAdvance = useCallback(async () => {
    setIsAdvancing(true)
    try {
      const result = await advanceWeek()
      if (result?.newSeason) {
        hardNavigate("/", true)
        return
      }
      const nextMatch = result?.nextUserMatch
      if (nextMatch && nextMatch.round === (saveState.week + 1)) {
        hardNavigate("/partida", true)
      } else {
        hardNavigate("/", true)
      }
    } finally {
      setIsAdvancing(false)
    }
  }, [advanceWeek, saveState.week])

  // Suporte a gamepad
  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (btn === 'B') hardNavigate("/")
      if (btn === 'A') {
        const task = realTasks[selectedTask]
        if (task) hardNavigate(task.action)
      }
      if (btn === 'X') handleAdvance()
      if (btn === 'DPAD_UP') setSelectedTask(prev => Math.max(0, prev - 1))
      if (btn === 'DPAD_DOWN') setSelectedTask(prev => Math.min(realTasks.length - 1, prev + 1))
      if (btn === 'RB') setCurrentNewsIndex(prev => (prev + 1) % MOCK_NEWS.length)
      if (btn === 'LB') setCurrentNewsIndex(prev => (prev - 1 + MOCK_NEWS.length) % MOCK_NEWS.length)
    }
    window.addEventListener('gamepad:button', handler)
    return () => window.removeEventListener('gamepad:button', handler)
  }, [selectedTask, realTasks, handleAdvance])

  if (!hydrated || !userTeam) {
    return (
      <div className="h-screen bg-[#050508] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#00ffc8] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative flex h-screen md:pl-16 pl-0 pb-20 md:pb-0 overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/pre-office-bg.png')" }}
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 120% 100% at 80% 50%, transparent 40%, rgba(0,0,0,0.6) 100%)"
      }} />
      <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/30" />

      <GameSidebar />

      <main className="relative z-10 flex-1 overflow-hidden flex flex-col">
        <GameHeader team={userTeam} />

        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-8 max-w-7xl mx-auto">

            {/* Coluna Esquerda */}
            <div className="space-y-6">

              {/* Data atual do jogo */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={gameDate.toISOString()}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                    {dayOfWeek}, {month} {day}
                  </h1>
                </motion.div>
              </AnimatePresence>

              {/* Proximo evento */}
              <motion.div
                className="flex items-center gap-4 text-white/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {daysUntilMatch !== null ? (
                  <span className="text-lg">
                    Proxima Partida em {daysUntilMatch} dia{daysUntilMatch !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-lg text-white/40">Sem partidas agendadas</span>
                )}
              </motion.div>

              {/* Preview da proxima partida */}
              <div className="flex flex-col items-center py-4">
                {nextUserMatch && nextOpponent ? (
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <TeamCrest team={userTeam} size="lg" />
                      <span className="text-xs text-white/50">Seu time</span>
                    </div>
                    <span className="text-white text-2xl font-bold">vs</span>
                    <div className="flex flex-col items-center gap-2">
                      <TeamCrest team={nextOpponent} size="lg" />
                      <span className="text-xs text-white/50">{nextOpponent.curto}</span>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-xs text-white/40 uppercase tracking-wider">{nextUserMatch.competition}</div>
                      <div className="text-sm text-white/70">Rod. {nextUserMatch.round}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-white/40" />
                    </div>
                    <span className="text-white/40 text-sm">Nenhuma partida proxima</span>
                  </div>
                )}
              </div>

              {/* Lista de Tarefas dinamica */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-white/50 text-sm font-medium">
                    Lista de Tarefas ({realTasks.length})
                  </h2>
                  {saveState.week > 0 && (
                    <span className="text-xs text-white/30">Rodada {saveState.week}</span>
                  )}
                </div>

                <div className="space-y-2">
                  {realTasks.map((task, index) => {
                    const Icon = task.icon
                    const isSelected = index === selectedTask

                    return (
                      <motion.button
                        key={task.id}
                        onClick={() => {
                          setSelectedTask(index)
                          hardNavigate(task.action)
                        }}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left",
                          "bg-gradient-to-r from-white/[0.03] to-transparent",
                          "border border-white/[0.06]",
                          isSelected && "border-white/20 bg-white/[0.06]",
                          "hover:border-white/15 hover:bg-white/[0.04]"
                        )}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center",
                          "bg-gradient-to-br from-white/10 to-white/5",
                          task.priority === "high" && "from-amber-500/20 to-amber-500/5"
                        )}>
                          <Icon className={cn(
                            "w-6 h-6",
                            task.priority === "high" ? "text-amber-400" : "text-white/60"
                          )} />
                        </div>

                        <div className="flex-1">
                          <h3 className="text-white font-medium">{task.title}</h3>
                          <div className="flex items-center gap-2 text-white/40 text-sm mt-0.5">
                            <span className="text-xs bg-white/10 rounded px-1.5 py-0.5">A</span>
                            <span>{task.actionLabel}</span>
                          </div>
                        </div>

                        <ChevronRight className="w-5 h-5 text-white/20" />
                      </motion.button>
                    )
                  })}
                </div>

                {/* Botoes */}
                <div className="flex items-center gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
                    onClick={() => hardNavigate("/")}
                  >
                    Voltar ao Dashboard
                  </Button>
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90"
                    onClick={handleAdvance}
                    disabled={isAdvancing}
                  >
                    {isAdvancing ? "Avancando..." : "Avancar"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Coluna Direita - Feed de Noticias */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white/50 text-sm font-medium flex items-center gap-2">
                  <Newspaper className="w-4 h-4" />
                  Feed de Noticias
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentNewsIndex(prev => (prev - 1 + MOCK_NEWS.length) % MOCK_NEWS.length)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-white/60" />
                  </button>
                  <button
                    onClick={() => setCurrentNewsIndex(prev => (prev + 1) % MOCK_NEWS.length)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-white/60" />
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentNewsIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-2xl overflow-hidden bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06]"
                >
                  <div className="relative aspect-[16/10] bg-gradient-to-br from-green-900/50 to-green-800/30">
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-80"
                      style={{ backgroundImage: "url('/stadium-bg.jpg')" }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    {MOCK_NEWS[currentNewsIndex].isNew && (
                      <span className="absolute top-3 right-3 px-3 py-1 rounded-lg bg-[#c8ff00] text-black text-xs font-bold">
                        New
                      </span>
                    )}
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">FC</span>
                      </div>
                      <span className="text-white font-semibold text-sm">
                        {MOCK_NEWS[currentNewsIndex].source}
                      </span>
                      <span className="text-white/40 text-sm">
                        {MOCK_NEWS[currentNewsIndex].date}
                      </span>
                    </div>

                    <p className="text-white/80 text-sm leading-relaxed">
                      {MOCK_NEWS[currentNewsIndex].title} — {MOCK_NEWS[currentNewsIndex].description}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                      <div className="flex items-center gap-4">
                        <button className="flex items-center gap-1.5 text-white/50 hover:text-red-400 transition-colors">
                          <Heart className="w-4 h-4" />
                          <span className="text-sm">
                            {MOCK_NEWS[currentNewsIndex].likes >= 1000
                              ? `${(MOCK_NEWS[currentNewsIndex].likes / 1000).toFixed(1)}K`
                              : MOCK_NEWS[currentNewsIndex].likes}
                          </span>
                        </button>
                        <button className="flex items-center gap-1.5 text-white/50 hover:text-primary transition-colors">
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-sm">{MOCK_NEWS[currentNewsIndex].comments}</span>
                        </button>
                      </div>
                      <button className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm">
                        <PlayCircle className="w-4 h-4" />
                        Ver Comentarios
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-center gap-2">
                {MOCK_NEWS.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentNewsIndex(index)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      index === currentNewsIndex ? "bg-white w-6" : "bg-white/30 hover:bg-white/50"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <GamepadControlsBar
          customActions={[
            { button: "A", label: "Selecionar Tarefa" },
            { button: "B", label: "Voltar" },
            { button: "X", label: "Avancar Rodada" },
            { button: "LB", label: "Feed Anterior" },
            { button: "RB", label: "Proximo Feed" },
          ]}
        />
      </main>

      {/* Overlay de avanco de rodada */}
      <AnimatePresence>
        {isAdvancing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, ease: "linear", repeat: Infinity }}
                className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6"
              />
              <h2 className="text-3xl font-bold text-white mb-2">Avancando...</h2>
              <p className="text-white/60">Processando eventos do dia</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
