"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Zap, Target, Footprints, Star, Shield, TrendingUp, Check, Dumbbell } from "lucide-react"
import { cn } from "@/lib/utils"

interface Player {
  id: number
  name: string
  position: string
  overall: number
  potential: number
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
}

interface TrainingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player | null
  onConfirm?: (attribute: string) => void
}

const trainingOptions = [
  { id: "pace", label: "Ritmo", icon: Zap, color: "text-yellow-500", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/30" },
  { id: "shooting", label: "Finalizacao", icon: Target, color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500/30" },
  { id: "passing", label: "Passe", icon: Footprints, color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30" },
  { id: "dribbling", label: "Drible", icon: Star, color: "text-purple-500", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/30" },
  { id: "defending", label: "Defesa", icon: Shield, color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/30" },
  { id: "physical", label: "Fisico", icon: TrendingUp, color: "text-orange-500", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/30" },
]

export function TrainingModal({
  open,
  onOpenChange,
  player,
  onConfirm,
}: TrainingModalProps) {
  const [selectedTraining, setSelectedTraining] = useState<string | null>(null)
  const [step, setStep] = useState<"select" | "training" | "result">("select")
  const [improvement, setImprovement] = useState(0)

  if (!player) return null

  const getAttributeValue = (attr: string): number => {
    switch (attr) {
      case "pace": return player.pace
      case "shooting": return player.shooting
      case "passing": return player.passing
      case "dribbling": return player.dribbling
      case "defending": return player.defending
      case "physical": return player.physical
      default: return 0
    }
  }

  const handleStartTraining = () => {
    if (!selectedTraining) return
    setStep("training")
    
    setTimeout(() => {
      // Calculate improvement based on potential and current value
      const currentValue = getAttributeValue(selectedTraining)
      const maxImprovement = Math.min(player.potential - player.overall, 3)
      const improvement = Math.max(1, Math.floor(Math.random() * maxImprovement) + 1)
      setImprovement(currentValue < 90 ? improvement : 0)
      setStep("result")
    }, 2000)
  }

  const handleClose = () => {
    setStep("select")
    setSelectedTraining(null)
    setImprovement(0)
    onOpenChange(false)
  }

  const handleConfirm = () => {
    if (selectedTraining) {
      onConfirm?.(selectedTraining)
    }
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-[#141414] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Centro de Treinamento</DialogTitle>
          <DialogDescription className="text-white/50">
            Selecione uma area para treinar {player.name}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-6 py-4">
            {/* Player Stats Overview */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                <span className="font-bold text-2xl text-white/40">
                  {player.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{player.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-yellow-500">{player.overall}</span>
                    <TrendingUp className="h-4 w-4 text-[#1db954]" />
                    <span className="text-sm text-[#1db954]">{player.potential}</span>
                  </div>
                </div>
                <div className="text-sm text-white/50">{player.position}</div>
              </div>
            </div>

            {/* Training Options */}
            <div className="grid grid-cols-2 gap-3">
              {trainingOptions.map((option) => {
                const Icon = option.icon
                const value = getAttributeValue(option.id)
                const isSelected = selectedTraining === option.id
                
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedTraining(option.id)}
                    className={cn(
                      "p-4 rounded-lg border text-left transition-all",
                      isSelected 
                        ? `${option.bgColor} ${option.borderColor} ring-1 ring-offset-1 ring-offset-[#141414]`
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    )}
                    style={isSelected ? { ringColor: option.color.replace("text-", "") } : {}}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={cn("h-5 w-5", option.color)} />
                      {isSelected && <Check className={cn("h-4 w-4", option.color)} />}
                    </div>
                    <div className="font-medium text-white text-sm">{option.label}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={value} className="h-1.5 flex-1" />
                      <span className={cn("text-sm font-bold", option.color)}>{value}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Training Info */}
            {selectedTraining && (
              <div className="p-3 rounded-lg bg-[#1db954]/10 border border-[#1db954]/30">
                <div className="flex items-center gap-2 text-sm text-[#1db954]">
                  <Dumbbell className="h-4 w-4" />
                  <span>O jogador treinara {trainingOptions.find(o => o.id === selectedTraining)?.label} por 1 semana</span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "training" && (
          <div className="py-12 text-center">
            <div className="animate-bounce">
              <div className="h-16 w-16 mx-auto rounded-full bg-[#1db954]/20 flex items-center justify-center mb-4">
                <Dumbbell className="h-8 w-8 text-[#1db954]" />
              </div>
            </div>
            <div className="text-lg font-medium text-white">Treinando...</div>
            <div className="text-sm text-white/50 mt-1">{player.name} esta treinando {trainingOptions.find(o => o.id === selectedTraining)?.label}</div>
            <Progress value={66} className="mt-6 max-w-xs mx-auto" />
          </div>
        )}

        {step === "result" && (
          <div className="py-8 text-center">
            <div className={cn(
              "h-16 w-16 mx-auto rounded-full flex items-center justify-center mb-4",
              improvement > 0 ? "bg-[#1db954]/20" : "bg-yellow-500/20"
            )}>
              {improvement > 0 ? (
                <TrendingUp className="h-8 w-8 text-[#1db954]" />
              ) : (
                <Dumbbell className="h-8 w-8 text-yellow-500" />
              )}
            </div>
            <div className={cn(
              "text-lg font-medium",
              improvement > 0 ? "text-[#1db954]" : "text-yellow-500"
            )}>
              {improvement > 0 ? "Treino Concluido!" : "Treino Mantido"}
            </div>
            <div className="text-sm text-white/50 mt-1">
              {improvement > 0 
                ? `${trainingOptions.find(o => o.id === selectedTraining)?.label} aumentou +${improvement} pontos!`
                : "O jogador manteve seu nivel atual. Continue treinando!"
              }
            </div>
            {improvement > 0 && selectedTraining && (
              <div className="flex items-center justify-center gap-2 mt-4 text-lg">
                <span className="text-white/50">{getAttributeValue(selectedTraining)}</span>
                <TrendingUp className="h-4 w-4 text-[#1db954]" />
                <span className="text-[#1db954] font-bold">{getAttributeValue(selectedTraining) + improvement}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "select" && (
            <>
              <Button variant="outline" onClick={handleClose} className="border-white/10 text-white/70">
                Cancelar
              </Button>
              <Button 
                onClick={handleStartTraining} 
                disabled={!selectedTraining}
                className="bg-[#1db954] text-black hover:bg-[#1ed760] disabled:opacity-50"
              >
                Iniciar Treino
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={handleConfirm} className="bg-[#1db954] text-black hover:bg-[#1ed760]">
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
