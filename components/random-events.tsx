"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  Shield,
  TrendingUp,
  TrendingDown,
  Zap,
  X,
  ChevronRight
} from "lucide-react"
import type { RandomEvent, EventChoice } from "@/lib/game-engine"

interface RandomEventsProps {
  events?: RandomEvent[]
  onResolveEvent?: (eventId: number, choiceId: number) => void
  compact?: boolean
}

export function RandomEvents({ events = [], onResolveEvent, compact = false }: RandomEventsProps) {
  const [selectedEvent, setSelectedEvent] = useState<RandomEvent | null>(null)
  const [processingChoice, setProcessingChoice] = useState<number | null>(null)

  const activeEvents = events.filter(e => !e.resolved)
  const resolvedEvents = events.filter(e => e.resolved)

  const getSeverityColor = (severity: RandomEvent["severity"]) => {
    switch (severity) {
      case "baixa": return "text-[#00ffc8] bg-[#00ffc8]/10 border-[#00ffc8]/30"
      case "media": return "text-amber-400 bg-amber-400/10 border-amber-400/30"
      case "alta": return "text-red-400 bg-red-400/10 border-red-400/30"
    }
  }

  const getSeverityIcon = (severity: RandomEvent["severity"]) => {
    switch (severity) {
      case "baixa": return <CheckCircle2 className="h-4 w-4" />
      case "media": return <AlertCircle className="h-4 w-4" />
      case "alta": return <AlertTriangle className="h-4 w-4" />
    }
  }

  const handleChoice = async (eventId: number, choiceId: number) => {
    setProcessingChoice(choiceId)
    
    // Simular processamento
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    if (onResolveEvent) {
      onResolveEvent(eventId, choiceId)
    }
    
    setProcessingChoice(null)
    setSelectedEvent(null)
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {activeEvents.length === 0 ? (
          <div className="p-4 rounded-lg bg-white/5 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto text-[#00ffc8]/40 mb-2" />
            <p className="text-sm text-white/40">Nenhum evento pendente</p>
          </div>
        ) : (
          activeEvents.slice(0, 3).map((event) => (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              className={cn(
                "w-full p-3 rounded-lg border text-left transition-all hover:scale-[1.02]",
                getSeverityColor(event.severity)
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getSeverityIcon(event.severity)}
                  <span className="font-medium text-sm">{event.title}</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-50" />
              </div>
            </button>
          ))
        )}
        {activeEvents.length > 3 && (
          <p className="text-xs text-white/40 text-center">
            +{activeEvents.length - 3} eventos pendentes
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Eventos Ativos */}
      {activeEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            Eventos Pendentes ({activeEvents.length})
          </h3>
          <div className="space-y-3">
            {activeEvents.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-4 rounded-xl border transition-all cursor-pointer hover:scale-[1.01]",
                  getSeverityColor(event.severity)
                )}
                onClick={() => setSelectedEvent(event)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getSeverityIcon(event.severity)}</div>
                    <div>
                      <h4 className="font-semibold">{event.title}</h4>
                      <p className="text-sm opacity-80 mt-1 line-clamp-2">{event.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs opacity-60">
                    <Clock className="h-3 w-3" />
                    Sem. {event.week}
                  </div>
                </div>
                
                <div className="mt-3 flex items-center gap-4 text-xs">
                  {event.financialImpact !== 0 && (
                    <span className={cn(
                      "flex items-center gap-1",
                      event.financialImpact > 0 ? "text-[#00ffc8]" : "text-red-400"
                    )}>
                      <DollarSign className="h-3 w-3" />
                      {event.financialImpact > 0 ? "+" : ""}
                      {(event.financialImpact / 1000).toFixed(0)}K
                    </span>
                  )}
                  {event.moraleImpact !== 0 && (
                    <span className={cn(
                      "flex items-center gap-1",
                      event.moraleImpact > 0 ? "text-[#00ffc8]" : "text-red-400"
                    )}>
                      {event.moraleImpact > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      Moral {event.moraleImpact > 0 ? "+" : ""}{event.moraleImpact}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Eventos Resolvidos */}
      {resolvedEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/50 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Eventos Resolvidos ({resolvedEvents.length})
          </h3>
          <div className="space-y-2">
            {resolvedEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className="p-3 rounded-lg bg-white/5 border border-white/[0.04] opacity-60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{event.title}</span>
                  <span className="text-xs text-white/40">Sem. {event.week}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sem eventos */}
      {activeEvents.length === 0 && resolvedEvents.length === 0 && (
        <div className="p-8 rounded-xl bg-[#111] border border-white/[0.04] text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-[#00ffc8]/30 mb-3" />
          <p className="text-white/50">Nenhum evento no momento</p>
          <p className="text-white/30 text-sm mt-1">Eventos aleatorios aparecerao conforme o jogo avanca</p>
        </div>
      )}

      {/* Modal de Evento */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-[#1a1a1a] border border-white/10 overflow-hidden"
            >
              {/* Header */}
              <div className={cn(
                "p-4 border-b",
                getSeverityColor(selectedEvent.severity)
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getSeverityIcon(selectedEvent.severity)}
                    <div>
                      <h3 className="font-bold text-lg">{selectedEvent.title}</h3>
                      <p className="text-xs opacity-70">Semana {selectedEvent.week}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 opacity-60 hover:opacity-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-white/80 mb-6">{selectedEvent.description}</p>

                {/* Impactos */}
                <div className="flex items-center gap-4 mb-6 p-3 rounded-lg bg-white/5">
                  {selectedEvent.financialImpact !== 0 && (
                    <div className={cn(
                      "flex items-center gap-2",
                      selectedEvent.financialImpact > 0 ? "text-[#00ffc8]" : "text-red-400"
                    )}>
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {selectedEvent.financialImpact > 0 ? "+" : ""}
                        R$ {Math.abs(selectedEvent.financialImpact).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  )}
                  {selectedEvent.moraleImpact !== 0 && (
                    <div className={cn(
                      "flex items-center gap-2",
                      selectedEvent.moraleImpact > 0 ? "text-[#00ffc8]" : "text-red-400"
                    )}>
                      {selectedEvent.moraleImpact > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      <span className="text-sm font-medium">
                        Moral {selectedEvent.moraleImpact > 0 ? "+" : ""}{selectedEvent.moraleImpact}
                      </span>
                    </div>
                  )}
                </div>

                {/* Escolhas */}
                <h4 className="text-sm font-semibold text-white/60 mb-3">Como deseja agir?</h4>
                <div className="space-y-3">
                  {selectedEvent.choices.map((choice) => (
                    <button
                      key={choice.id}
                      onClick={() => handleChoice(selectedEvent.id, choice.id)}
                      disabled={processingChoice !== null}
                      className={cn(
                        "w-full p-4 rounded-xl border text-left transition-all",
                        processingChoice === choice.id
                          ? "bg-[#00ffc8]/20 border-[#00ffc8]/50"
                          : "bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-white">{choice.text}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-white/50">
                            {choice.cost > 0 && (
                              <span className="text-red-400">
                                -R$ {choice.cost.toLocaleString("pt-BR")}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {choice.successChance}% sucesso
                            </span>
                          </div>
                        </div>
                        {processingChoice === choice.id && (
                          <div className="w-5 h-5 border-2 border-[#00ffc8] border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
