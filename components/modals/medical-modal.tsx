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
import { 
  HeartPulse, 
  Activity, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  Syringe,
  Bed,
  TrendingUp
} from "lucide-react"
import { PlayerAvatar } from "@/components/player-avatar"
import { cn } from "@/lib/utils"
import { type Player, type PlayerInjury, INJURY_TYPES, getInjuryRecoveryTime } from "@/lib/game-engine"

interface MedicalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player | null
  onTreatment?: (playerId: number, treatment: string) => void
}

const treatments = [
  { 
    id: "conservative", 
    label: "Tratamento Conservador", 
    description: "Recuperacao natural sem intervencao",
    icon: Bed,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    speedBonus: 0
  },
  { 
    id: "physiotherapy", 
    label: "Fisioterapia Intensiva", 
    description: "Acelera recuperacao em 20%",
    icon: Activity,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    speedBonus: 0.2,
    cost: 50000
  },
  { 
    id: "surgery", 
    label: "Cirurgia", 
    description: "Para lesoes graves, recuperacao garantida",
    icon: Syringe,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    speedBonus: -0.3, // demora mais mas e mais seguro
    cost: 200000
  },
]

export function MedicalModal({
  open,
  onOpenChange,
  player,
  onTreatment,
}: MedicalModalProps) {
  const [selectedTreatment, setSelectedTreatment] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  if (!player) return null

  const handleTreatment = () => {
    if (!selectedTreatment) return
    setIsProcessing(true)
    
    setTimeout(() => {
      onTreatment?.(player.id, selectedTreatment)
      setIsProcessing(false)
      setSelectedTreatment(null)
      onOpenChange(false)
    }, 1500)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "leve": return "text-[#ffd700]"
      case "media": return "text-orange-500"
      case "grave": return "text-red-500"
      default: return "text-white/50"
    }
  }

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case "leve": return "bg-[#ffd700]/10"
      case "media": return "bg-orange-500/10"
      case "grave": return "bg-red-500/10"
      default: return "bg-white/5"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[#0c0c10] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-red-500" />
            Departamento Medico
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Status de saude e tratamento de {player.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Player Info */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
            <PlayerAvatar name={player.name} size="md" />
            <div className="flex-1">
              <div className="font-semibold text-white">{player.name}</div>
              <div className="text-sm text-white/50">{player.position} - {player.age} anos</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-white/50">Energia</div>
              <div className="flex items-center gap-2">
                <Progress value={player.energy} className="w-16 h-2" />
                <span className={cn(
                  "text-sm font-bold",
                  player.energy > 70 ? "text-green-500" :
                  player.energy > 40 ? "text-[#ffd700]" : "text-red-500"
                )}>
                  {player.energy}%
                </span>
              </div>
            </div>
          </div>

          {/* Injury Status */}
          {player.injury ? (
            <div className={cn(
              "p-4 rounded-lg border",
              getSeverityBg(player.injury.severity),
              player.injury.severity === "leve" ? "border-[#ffd700]/30" :
              player.injury.severity === "media" ? "border-orange-500/30" : "border-red-500/30"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className={getSeverityColor(player.injury.severity)} />
                <span className={cn("font-semibold", getSeverityColor(player.injury.severity))}>
                  Lesao Ativa
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Tipo:</span>
                  <span className="text-white">{player.injury.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Gravidade:</span>
                  <span className={getSeverityColor(player.injury.severity)}>
                    {player.injury.severity.charAt(0).toUpperCase() + player.injury.severity.slice(1)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Tempo restante:</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-white/50" />
                    <span className="text-white font-semibold">
                      {player.injury.weeksRemaining} {player.injury.weeksRemaining === 1 ? 'semana' : 'semanas'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Treatment Options */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-3">
                  Opcoes de Tratamento
                </div>
                <div className="space-y-2">
                  {treatments.map((treatment) => {
                    const Icon = treatment.icon
                    const isSelected = selectedTreatment === treatment.id
                    
                    // Cirurgia apenas para lesoes graves
                    if (treatment.id === "surgery" && player.injury?.severity !== "grave") {
                      return null
                    }
                    
                    return (
                      <button
                        key={treatment.id}
                        onClick={() => setSelectedTreatment(treatment.id)}
                        className={cn(
                          "w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3",
                          isSelected 
                            ? `${treatment.bgColor} ${treatment.borderColor}`
                            : "bg-white/5 border-white/10 hover:border-white/20"
                        )}
                      >
                        <Icon className={cn("h-5 w-5", treatment.color)} />
                        <div className="flex-1">
                          <div className="font-medium text-white text-sm">{treatment.label}</div>
                          <div className="text-xs text-white/50">{treatment.description}</div>
                        </div>
                        {treatment.cost && (
                          <div className="text-xs text-[#ffd700] font-semibold">
                            R$ {(treatment.cost / 1000).toFixed(0)}K
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-green-500">Jogador Saudavel</span>
              </div>
              <p className="text-sm text-white/50 mt-2">
                {player.name} esta em plenas condicoes fisicas e pronto para jogar.
              </p>
            </div>
          )}

          {/* Physical Status */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-3">
              Status Fisico
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-white/50 mb-1">Energia</div>
                <div className="flex items-center gap-2">
                  <Progress value={player.energy} className="flex-1 h-2" />
                  <span className="text-sm font-bold text-white">{player.energy}%</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-white/50 mb-1">Forma</div>
                <div className="flex items-center gap-2">
                  <Progress value={player.form} className="flex-1 h-2" />
                  <span className="text-sm font-bold text-white">{player.form}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="border-white/10 text-white/70"
          >
            Fechar
          </Button>
          {player.injury && selectedTreatment && (
            <Button 
              onClick={handleTreatment}
              disabled={isProcessing}
              className="bg-[#00ffc8] text-black hover:bg-[#00c8ff]"
            >
              {isProcessing ? "Aplicando..." : "Aplicar Tratamento"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
