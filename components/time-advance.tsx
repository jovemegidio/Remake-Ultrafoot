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
    
    // Simular processamento
    setTimeout(() => {
      // Gerar eventos aleatorios da semana
      const events: WeekEvent[] = []
      
      // Evento de partida
      if (Math.random() > 0.3) {
        events.push({
          type: "match",
          title: "Proxima Partida",
          description: "RB Bragantino vs Palmeiras - Rodada 16",
          icon: Trophy,
          color: "text-yellow-500"
        })
      }
      
      // Evento de lesao
      if (Math.random() > 0.8) {
        events.push({
          type: "injury",
          title: "Lesao no Treino",
          description: "Eduardo Santos sofreu uma leve distensao",
          icon: AlertTriangle,
          color: "text-red-500"
        })
      }
      
      // Evento de contrato
      if (Math.random() > 0.85) {
        events.push({
          type: "contract",
          title: "Contrato Expirando",
          description: "O contrato de Eduardo Sasha expira em 6 meses",
          icon: Users,
          color: "text-orange-500"
        })
      }
      
      // Evento de selecao
      const currentWeek = state.week + 1
      const fifaDates = [10, 11, 22, 23, 36, 37, 40, 41]
      if (fifaDates.includes(currentWeek)) {
        events.push({
          type: "nationalTeam",
          title: "Data FIFA",
          description: "Lincoln foi convocado para a Selecao Brasileira",
          icon: Flag,
          color: "text-green-500"
        })
      }
      
      // Atualizar semana
      gameEngine.advanceWeek()
      setState({ week: state.week + 1 })
      
      setWeekEvents(events)
      setIsAdvancing(false)
      setShowEvents(true)
      
      onWeekAdvanced?.()
    }, 1500)
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
            : "bg-[#00ffc8] text-black hover:bg-[#00c8ff]"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={closeEvents}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-xl bg-[#0c0c10] border border-white/10 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-[#00ffc8]/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-[#00ffc8]" />
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
                className="w-full bg-[#00ffc8] text-black hover:bg-[#00c8ff]"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closeEvents}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm rounded-xl bg-[#0c0c10] border border-white/10 p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 w-12 rounded-full bg-[#00ffc8]/20 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-6 w-6 text-[#00ffc8]" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Semana {state.week}</h3>
            <p className="text-sm text-white/50 mb-6">Nenhum evento importante esta semana.</p>
            <Button
              onClick={closeEvents}
              className="w-full bg-[#00ffc8] text-black hover:bg-[#00c8ff]"
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
      <Calendar className="h-4 w-4 text-[#00ffc8]" />
      <span className="text-sm text-white/70">
        Semana <span className="font-semibold text-white">{state.week}</span>/48
      </span>
      <span className="text-white/30">|</span>
      <span className="text-sm text-white/70">{state.season}</span>
    </div>
  )
}
