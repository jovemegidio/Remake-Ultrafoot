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
import { Slider } from "@/components/ui/slider"
import { TeamCrest } from "@/components/team-crest"
import { formatCurrency, type Team } from "@/lib/teams-data"
import { DollarSign, TrendingUp, TrendingDown, Check, X, AlertCircle } from "lucide-react"

interface Player {
  id: number
  name: string
  position: string
  overall: number
  value: number
  team?: Team
}

interface NegotiationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player | null
  type: "buy" | "sell" | "loan"
  team?: Team
  onConfirm?: (offer: number) => void
}

export function NegotiationModal({
  open,
  onOpenChange,
  player,
  type,
  team,
  onConfirm,
}: NegotiationModalProps) {
  const [offer, setOffer] = useState(player?.value || 0)
  const [step, setStep] = useState<"offer" | "response" | "result">("offer")
  const [accepted, setAccepted] = useState(false)

  if (!player) return null

  const minOffer = Math.floor(player.value * 0.5)
  const maxOffer = Math.floor(player.value * 1.5)
  const fairValue = player.value
  const offerPercentage = Math.round((offer / fairValue) * 100)

  const getOfferStatus = () => {
    if (offerPercentage >= 110) return { label: "Excelente", color: "text-[#1db954]", chance: 95 }
    if (offerPercentage >= 100) return { label: "Justa", color: "text-[#1db954]", chance: 75 }
    if (offerPercentage >= 90) return { label: "Razoavel", color: "text-yellow-500", chance: 50 }
    if (offerPercentage >= 80) return { label: "Baixa", color: "text-orange-500", chance: 25 }
    return { label: "Insultuosa", color: "text-red-500", chance: 5 }
  }

  const status = getOfferStatus()

  const handleSubmitOffer = () => {
    setStep("response")
    setTimeout(() => {
      const random = Math.random() * 100
      setAccepted(random <= status.chance)
      setStep("result")
    }, 1500)
  }

  const handleClose = () => {
    setStep("offer")
    setOffer(player.value)
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm?.(offer)
    handleClose()
  }

  const title = type === "buy" ? "Negociar Compra" : type === "sell" ? "Negociar Venda" : "Negociar Emprestimo"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#141414] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-white/50">
            {type === "buy" 
              ? `Faca uma proposta por ${player.name}`
              : type === "sell"
              ? `Defina o valor de venda para ${player.name}`
              : `Negocie o emprestimo de ${player.name}`
            }
          </DialogDescription>
        </DialogHeader>

        {step === "offer" && (
          <div className="space-y-6 py-4">
            {/* Player Info */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                <span className="font-bold text-2xl text-white/40">
                  {player.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{player.name}</span>
                  <span className="text-xl font-bold text-yellow-500">{player.overall}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <span>{player.position}</span>
                  {player.team && (
                    <>
                      <span className="text-white/20">|</span>
                      <TeamCrest team={player.team} size="xs" />
                      <span>{player.team.curto}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Value Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Valor de Mercado</div>
                <div className="text-lg font-semibold text-white mt-1">{formatCurrency(fairValue)}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Sua Oferta</div>
                <div className={`text-lg font-semibold mt-1 ${status.color}`}>{formatCurrency(offer)}</div>
              </div>
            </div>

            {/* Offer Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Valor da Proposta</span>
                <span className={`font-medium ${status.color}`}>
                  {offerPercentage}% do valor
                </span>
              </div>
              <Slider
                value={[offer]}
                onValueChange={([value]) => setOffer(value)}
                min={minOffer}
                max={maxOffer}
                step={100000}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-white/40">
                <span>{formatCurrency(minOffer)}</span>
                <span>{formatCurrency(maxOffer)}</span>
              </div>
            </div>

            {/* Offer Status */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${
              status.chance >= 75 ? "bg-[#1db954]/10 border-[#1db954]/30" :
              status.chance >= 50 ? "bg-yellow-500/10 border-yellow-500/30" :
              "bg-red-500/10 border-red-500/30"
            }`}>
              <AlertCircle className={`h-5 w-5 ${status.color}`} />
              <div className="flex-1">
                <div className={`text-sm font-medium ${status.color}`}>Proposta {status.label}</div>
                <div className="text-xs text-white/50">{status.chance}% de chance de aceitacao</div>
              </div>
            </div>
          </div>
        )}

        {step === "response" && (
          <div className="py-12 text-center">
            <div className="animate-pulse">
              <div className="h-16 w-16 mx-auto rounded-full bg-white/10 flex items-center justify-center mb-4">
                <DollarSign className="h-8 w-8 text-white/40" />
              </div>
              <div className="text-lg font-medium text-white">Aguardando resposta...</div>
              <div className="text-sm text-white/50 mt-1">O clube esta analisando sua proposta</div>
            </div>
          </div>
        )}

        {step === "result" && (
          <div className="py-8 text-center">
            <div className={`h-16 w-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
              accepted ? "bg-[#1db954]/20" : "bg-red-500/20"
            }`}>
              {accepted ? (
                <Check className="h-8 w-8 text-[#1db954]" />
              ) : (
                <X className="h-8 w-8 text-red-500" />
              )}
            </div>
            <div className={`text-lg font-medium ${accepted ? "text-[#1db954]" : "text-red-500"}`}>
              {accepted ? "Proposta Aceita!" : "Proposta Recusada"}
            </div>
            <div className="text-sm text-white/50 mt-1">
              {accepted 
                ? `A transferencia de ${player.name} foi concluida por ${formatCurrency(offer)}`
                : "O clube recusou sua oferta. Tente novamente com um valor maior."
              }
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "offer" && (
            <>
              <Button variant="outline" onClick={handleClose} className="border-white/10 text-white/70">
                Cancelar
              </Button>
              <Button onClick={handleSubmitOffer} className="bg-[#1db954] text-black hover:bg-[#1ed760]">
                Enviar Proposta
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={accepted ? handleConfirm : handleClose} className={
              accepted ? "bg-[#1db954] text-black hover:bg-[#1ed760]" : ""
            }>
              {accepted ? "Concluir" : "Fechar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
