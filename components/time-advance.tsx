"use client"

import { useState, useEffect } from "react"
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
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useGameState } from "@/lib/save-system"
import { useGameEngine } from "@/lib/game-engine"

interface TimeAdvanceProps {
  onWeekAdvanced?: () => void
}

interface WeekEvent {
  type: "match" | "transfer" | "injury" | "contract" | "nationalTeam" | "news"
  title: string
  description: string
  icon: React.ElementType
  color: string
}

export function TimeAdvanceButton({ onWeekAdvanced }: TimeAdvanceProps) {
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [weekEvents, setWeekEvents] = useState<WeekEvent[]>([])
  
  const { state, setState } = useGameState()
  const gameEngine = useGameEngine()

  const handleAdvanceWeek = () => {
    setIsAdvancing(true)

    const currentWeek = (state.week ?? 0) + 1
    gameEngine.advanceWeek()
    setState({ week: currentWeek })

    const updated = useGameEngine.getState()
    const events: WeekEvent[] = []
    const nextFixture = (state.fixtures ?? [])
      .filter(fixture => !fixture.played && fixture.round >= currentWeek)
      .sort((a, b) => a.round - b.round)[0]
    if (nextFixture) events.push({
      type: "match",
      title: "Próxima partida",
      description: `${nextFixture.homeNome} x ${nextFixture.awayNome} · ${nextFixture.competition} · Rodada ${nextFixture.round}`,
      icon: Trophy,
      color: "text-[#ffd700]",
    })

    for (const player of updated.squadPlayers.filter(player => player.injury)) events.push({
      type: "injury",
      title: "Departamento médico",
      description: `${player.name}: ${player.injury!.type} (${player.injury!.weeksRemaining} semana(s))`,
      icon: AlertTriangle,
      color: "text-red-500",
    })

    const absoluteWeek = ((state.season ?? 2026) - 2026) * 46 + currentWeek
    for (const player of updated.squadPlayers.filter(player => player.contract && player.contract.endDate >= absoluteWeek && player.contract.endDate - absoluteWeek <= 26)) events.push({
      type: "contract",
      title: "Contrato próximo do fim",
      description: `${player.name}: ${player.contract!.endDate - absoluteWeek} semana(s) restantes`,
      icon: Users,
      color: "text-orange-500",
    })

    for (const call of updated.nationalTeamCalls) events.push({
      type: "nationalTeam",
      title: "Convocação registrada",
      description: `${call.playerName} · ${call.country} · ${call.competition}`,
      icon: Flag,
      color: "text-green-500",
    })

    setWeekEvents(events)
    setIsAdvancing(false)
    setShowEvents(true)
    onWeekAdvanced?.()
  }

  const closeEvents = () => {
    setShowEvents(false)
    setWeekEvents([])
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
            : "bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)]"
        )}
      >
        {isAdvancing ? (
          <>
            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm font-medium">Avancando...</span>
          </>
        ) : (
          <>
            <FastForward className="h-4 w-4" />
            <span className="text-sm font-medium">Avancar Semana</span>
          </>
        )}
      </button>

      {/* Events Modal */}
      <AnimatePresence>
        {showEvents && weekEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center uf-veu p-4"
            onClick={closeEvents}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-xl bg-[var(--uf-bg-surface)] border border-white/10 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-[var(--brand)]/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-[var(--brand)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Semana {state.week}</h3>
                  <p className="text-sm text-white/50">Eventos da semana</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {weekEvents.map((event, index) => {
                  const Icon = event.icon
                  return (
                    <motion.div
                      key={index}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-lg bg-white/5", event.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-white text-sm">{event.title}</div>
                          <div className="text-xs text-white/50 mt-0.5">{event.description}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-white/30" />
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              <Button
                onClick={closeEvents}
                className="w-full bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)]"
              >
                Continuar
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No Events - Just close */}
      {showEvents && weekEvents.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center uf-veu p-4"
          onClick={closeEvents}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm rounded-xl bg-[var(--uf-bg-surface)] border border-white/10 p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 w-12 rounded-full bg-[var(--brand)]/20 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-6 w-6 text-[var(--brand)]" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Semana {state.week}</h3>
            <p className="text-sm text-white/50 mb-6">Nenhum evento importante esta semana.</p>
            <Button
              onClick={closeEvents}
              className="w-full bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)]"
            >
              Continuar
            </Button>
          </motion.div>
        </motion.div>
      )}
    </>
  )
}

// Componente para exibir a semana atual no header
export function CurrentWeekDisplay() {
  const { state } = useGameState()
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
      <Calendar className="h-4 w-4 text-[var(--brand)]" />
      <span className="text-sm text-white/70">
        Semana <span className="font-semibold text-white">{state.week}</span>/48
      </span>
      <span className="text-white/30">|</span>
      <span className="text-sm text-white/70">{state.season}</span>
    </div>
  )
}
