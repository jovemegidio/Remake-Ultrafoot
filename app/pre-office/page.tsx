"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  MessageSquare,
  FileText,
  Target,
  Dumbbell,
  Users,
  Calendar,
  ChevronRight,
  Trophy,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { GamepadControlsBar } from "@/components/gamepad-controls-bar"
import { NewsFeed } from "@/components/news-feed"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTeamByShort } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"

const diasSemana = ["DOMINGO", "SEGUNDA-FEIRA", "TERCA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SABADO"]
const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]

const mockTasks = [
  {
    id: 1,
    title: "Revisar Planos de Treinamento",
    icon: Dumbbell,
    action: "/treinamento",
    actionLabel: "Abrir Treinamento",
    priority: "high"
  },
  {
    id: 2,
    title: "Criar Preset Tatico",
    icon: Target,
    action: "/elenco/taticas",
    actionLabel: "Abrir Taticas",
    priority: "medium"
  },
  {
    id: 3,
    title: "Revisar Objetivos da Diretoria",
    icon: FileText,
    action: "/reunioes",
    actionLabel: "Ver Objetivos",
    priority: "medium"
  },
  {
    id: 4,
    title: "Responder Mensagens Pendentes",
    icon: MessageSquare,
    action: "/mensagens",
    actionLabel: "Abrir Mensagens",
    priority: "low"
  },
  {
    id: 5,
    title: "Avaliar Relatorio de Olheiro",
    icon: Users,
    action: "/olheiros",
    actionLabel: "Ver Relatorios",
    priority: "low"
  },
]

const mockEvents = [
  { type: "match", opponent: "Palmeiras", competition: "Brasileirao", daysUntil: 3 },
  { type: "training", title: "Treino Tatico", daysUntil: 1 },
  { type: "transfer", title: "Janela Abre", daysUntil: 19 },
]

export default function PreOfficePage() {
  const router = useRouter()
  const { team: userTeam } = useUserTeam()

  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 3, 1))
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [selectedTask, setSelectedTask] = useState(0)

  const nextEvent = mockEvents.reduce((min, event) =>
    event.daysUntil < min.daysUntil ? event : min
  , mockEvents[0])

  const dayOfWeek = diasSemana[currentDate.getDay()]
  const day = currentDate.getDate().toString().padStart(2, '0')
  const month = meses[currentDate.getMonth()]

  const handleAdvance = useCallback(() => {
    setIsAdvancing(true)
    setTimeout(() => {
      setCurrentDate(prev => {
        const newDate = new Date(prev)
        newDate.setDate(newDate.getDate() + 1)
        return newDate
      })
      setIsAdvancing(false)
    }, 1500)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (btn === 'B') router.back()
      if (btn === 'A') {
        const task = mockTasks[selectedTask]
        if (task) router.push(task.action)
      }
      if (btn === 'X') handleAdvance()
      if (btn === 'DPAD_UP') setSelectedTask(prev => Math.max(0, prev - 1))
      if (btn === 'DPAD_DOWN') setSelectedTask(prev => Math.min(mockTasks.length - 1, prev + 1))
    }
    window.addEventListener('gamepad:button', handler)
    return () => window.removeEventListener('gamepad:button', handler)
  }, [router, selectedTask, handleAdvance])

  const hasMatchToday = nextEvent.type === "match" && nextEvent.daysUntil === 0

  return (
    <div className="relative flex h-screen md:pl-16 pl-0 pb-20 md:pb-0 overflow-hidden">
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

        <div className="flex-1 p-6 md:p-8 overflow-y-auto pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-8 max-w-7xl mx-auto">

            {/* Left Column - Date, Event, Tasks */}
            <div className="space-y-6">

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentDate.toISOString()}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-1"
                >
                  <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                    {dayOfWeek}, {month} {day}
                  </h1>
                </motion.div>
              </AnimatePresence>

              <motion.div
                className="flex items-center gap-4 text-white/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <span className="text-lg">Proximo Evento em {nextEvent.daysUntil} dias</span>
              </motion.div>

              {/* Event Preview */}
              <div className="flex flex-col items-center py-4">
                {hasMatchToday ? (
                  <div className="flex items-center gap-4">
                    <TeamCrest team={userTeam} size="lg" />
                    <span className="text-white text-2xl font-bold">vs</span>
                    <TeamCrest team={getTeamByShort("PAL")} size="lg" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      {nextEvent.type === "match" ? (
                        <Trophy className="w-8 h-8 text-white/40" />
                      ) : nextEvent.type === "training" ? (
                        <Dumbbell className="w-8 h-8 text-white/40" />
                      ) : (
                        <Calendar className="w-8 h-8 text-white/40" />
                      )}
                    </div>
                    <span className="text-white/60 text-sm">
                      {nextEvent.type === "match"
                        ? `${nextEvent.competition} vs ${nextEvent.opponent}`
                        : nextEvent.title
                      }
                    </span>
                  </div>
                )}
              </div>

              {/* Task List */}
              <div className="space-y-3">
                <h2 className="text-white/50 text-sm font-medium">
                  Lista de Tarefas ({mockTasks.length})
                </h2>

                <div className="space-y-2">
                  {mockTasks.map((task, index) => {
                    const Icon = task.icon
                    const isSelected = index === selectedTask

                    return (
                      <motion.button
                        key={task.id}
                        onClick={() => {
                          setSelectedTask(index)
                          router.push(task.action)
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

                {/* Bottom Buttons */}
                <div className="flex items-center gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
                    onClick={() => router.push("/central")}
                  >
                    Ver Todas as Tarefas
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

            {/* Right Column - News Feed */}
            <div className="space-y-4">
              <NewsFeed />
            </div>
          </div>
        </div>

        <GamepadControlsBar
          customActions={[
            { button: "A", label: "Selecionar" },
            { button: "B", label: "Voltar" },
            { button: "X", label: "Avancar Dia" },
          ]}
        />
      </main>

      {/* Day Advance Overlay */}
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
