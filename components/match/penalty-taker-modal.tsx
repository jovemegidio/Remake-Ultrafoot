"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { TeamCrest } from "@/components/team-crest"
import type { Team } from "@/lib/teams-data"
import { Button } from "@/components/ui/button"
import { Target, Zap, Star } from "lucide-react"

interface Player {
  id: number
  name: string
  number: number
  position: string
  rating?: number
  shooting?: number
  stamina?: number
}

interface PenaltyTakerModalProps {
  isOpen: boolean
  team: Team
  players: Player[]
  onSelectPlayer: (player: Player) => void
  onClose: () => void
}

export function PenaltyTakerModal({ 
  isOpen, 
  team, 
  players, 
  onSelectPlayer, 
  onClose 
}: PenaltyTakerModalProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [hoveredPlayer, setHoveredPlayer] = useState<Player | null>(null)

  // Ordena jogadores por habilidade de finalizacao (shooting)
  const sortedPlayers = [...players].sort((a, b) => (b.shooting || 70) - (a.shooting || 70))

  const handleConfirm = () => {
    if (selectedPlayer) {
      onSelectPlayer(selectedPlayer)
      setSelectedPlayer(null)
    }
  }

  // Calcula a probabilidade de gol baseado nos atributos
  const getScoreChance = (player: Player) => {
    const shooting = player.shooting || 70
    const stamina = player.stamina || 80
    const baseChance = 50 + (shooting - 50) * 0.5 + (stamina / 100) * 10
    return Math.min(95, Math.max(40, Math.round(baseChance)))
  }

  // Cor baseada na chance de gol
  const getChanceColor = (chance: number) => {
    if (chance >= 80) return "text-emerald-400"
    if (chance >= 65) return "text-amber-400"
    return "text-red-400"
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
      >
        {/* Fundo animado */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ 
              background: [
                `radial-gradient(circle at 30% 50%, ${team.cor1}20, transparent 50%)`,
                `radial-gradient(circle at 70% 50%, ${team.cor1}20, transparent 50%)`,
                `radial-gradient(circle at 30% 50%, ${team.cor1}20, transparent 50%)`
              ]
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute inset-0"
          />
        </div>

        <motion.div
          initial={{ scale: 0.9, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 50 }}
          className="relative w-full max-w-2xl mx-4"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1a2a2a] to-[#0d1a1a] rounded-t-2xl border border-white/10 border-b-0 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Target className="w-10 h-10 text-amber-400" />
                </motion.div>
                <div>
                  <h2 className="text-2xl font-bold text-white">PENALTI!</h2>
                  <p className="text-white/60 text-sm">Escolha o batedor</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <TeamCrest team={team} size="lg" />
                <span className="text-white font-semibold">{team.nome}</span>
              </div>
            </div>
          </div>

          {/* Lista de jogadores */}
          <div className="bg-[#0d1a1a]/95 backdrop-blur-sm border border-white/10 border-t-0 max-h-[50vh] overflow-y-auto">
            <div className="p-2">
              {sortedPlayers.map((player, index) => {
                const chance = getScoreChance(player)
                const isSelected = selectedPlayer?.id === player.id
                const isHovered = hoveredPlayer?.id === player.id
                const isRecommended = index === 0

                return (
                  <motion.button
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedPlayer(player)}
                    onMouseEnter={() => setHoveredPlayer(player)}
                    onMouseLeave={() => setHoveredPlayer(null)}
                    className={cn(
                      "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                      isSelected 
                        ? "bg-[#00ffc8]/20 border-2 border-[#00ffc8]" 
                        : isHovered
                          ? "bg-white/10"
                          : "bg-white/5 border-2 border-transparent",
                      "hover:bg-white/10"
                    )}
                  >
                    {/* Numero */}
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg",
                      isSelected ? "bg-[#00ffc8] text-black" : "bg-white/10 text-white"
                    )}>
                      {player.number}
                    </div>

                    {/* Nome e posicao */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">{player.name}</span>
                        {isRecommended && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded uppercase">
                            Recomendado
                          </span>
                        )}
                      </div>
                      <span className="text-white/40 text-sm">{player.position}</span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4">
                      {/* Finalizacao */}
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase">
                          <Zap className="w-3 h-3" />
                          <span>FIN</span>
                        </div>
                        <span className="text-white font-bold">{player.shooting || 70}</span>
                      </div>

                      {/* Chance de gol */}
                      <div className="text-center min-w-[60px]">
                        <div className="text-white/40 text-[10px] uppercase">Chance</div>
                        <span className={cn("font-bold text-lg", getChanceColor(chance))}>
                          {chance}%
                        </span>
                      </div>

                      {/* Indicador de selecao */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-full bg-[#00ffc8] flex items-center justify-center"
                        >
                          <Star className="w-4 h-4 text-black fill-black" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Footer com botao de confirmar */}
          <div className="bg-gradient-to-r from-[#1a2a2a] to-[#0d1a1a] rounded-b-2xl border border-white/10 border-t-0 p-4">
            <div className="flex items-center justify-between">
              <div className="text-white/40 text-sm">
                {selectedPlayer ? (
                  <span>
                    Batedor: <span className="text-white font-semibold">{selectedPlayer.name}</span>
                  </span>
                ) : (
                  "Selecione um jogador"
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="border-white/20 text-white/60 hover:bg-white/10"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedPlayer}
                  className={cn(
                    "font-bold transition-all",
                    selectedPlayer
                      ? "bg-[#00ffc8] text-black hover:bg-[#00e6b5]"
                      : "bg-white/10 text-white/40"
                  )}
                >
                  <Target className="w-4 h-4 mr-2" />
                  BATER PENALTI
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
