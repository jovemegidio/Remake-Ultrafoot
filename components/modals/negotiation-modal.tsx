"use client"

import { useState, useEffect } from "react"
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
import { PlayerAvatar } from "@/components/player-avatar"
import { formatCurrency, type Team } from "@/lib/teams-data"
import { DollarSign, TrendingUp, TrendingDown, Check, X, AlertCircle, Handshake, Clock, ArrowRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

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
  const [responseProgress, setResponseProgress] = useState(0)

  // Reset state when modal opens
  useEffect(() => {
    if (open && player) {
      setOffer(player.value)
      setStep("offer")
      setAccepted(false)
      setResponseProgress(0)
    }
  }, [open, player])

  if (!player) return null

  // For loans, calculate monthly fee instead of full value
  const isLoan = type === "loan"
  const loanMonthlyRate = 0.02 // 2% of value per month
  const loanMonths = 12
  
  const minOffer = isLoan 
    ? Math.floor(player.value * loanMonthlyRate * 6) // 6 months minimum
    : Math.floor(player.value * 0.5)
  const maxOffer = isLoan
    ? Math.floor(player.value * loanMonthlyRate * 24) // 24 months maximum
    : Math.floor(player.value * 1.5)
  const fairValue = isLoan 
    ? Math.floor(player.value * loanMonthlyRate * loanMonths)
    : player.value
  const offerPercentage = Math.round((offer / fairValue) * 100)

  const getOfferStatus = () => {
    if (offerPercentage >= 110) return { label: "Excelente", color: "text-[#1db954]", bgColor: "bg-[#1db954]", chance: 95 }
    if (offerPercentage >= 100) return { label: "Justa", color: "text-[#1db954]", bgColor: "bg-[#1db954]", chance: 75 }
    if (offerPercentage >= 90) return { label: "Razoavel", color: "text-yellow-500", bgColor: "bg-yellow-500", chance: 50 }
    if (offerPercentage >= 80) return { label: "Baixa", color: "text-orange-500", bgColor: "bg-orange-500", chance: 25 }
    return { label: "Insultuosa", color: "text-red-500", bgColor: "bg-red-500", chance: 5 }
  }

  const status = getOfferStatus()

  const handleSubmitOffer = () => {
    setStep("response")
    setResponseProgress(0)
    
    // Animate the progress bar
    const interval = setInterval(() => {
      setResponseProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 2
      })
    }, 30)
    
    // Show result after animation
    setTimeout(() => {
      const random = Math.random() * 100
      setAccepted(random <= status.chance)
      setStep("result")
    }, 1800)
  }

  const handleClose = () => {
    setStep("offer")
    setOffer(player.value)
    setResponseProgress(0)
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm?.(offer)
    handleClose()
  }

  const title = type === "buy" ? "Negociar Compra" : type === "sell" ? "Negociar Venda" : "Negociar Emprestimo"
  const actionIcon = type === "loan" ? <Clock className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-[#141414] border-white/10 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            {actionIcon}
            {title}
          </DialogTitle>
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
          <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Player Info */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/10">
              <div className="relative">
                <PlayerAvatar 
                  name={player.name} 
                  teamColor={player.team?.cor1}
                  size="lg" 
                />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center border-2 border-[#141414]">
                  <span className="text-xs font-bold text-black">{player.overall}</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-lg">{player.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/50 mt-1">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-xs font-medium">{player.position}</span>
                  {player.team && (
                    <>
                      <TeamCrest team={player.team} size="xs" />
                      <span>{player.team.curto}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Value Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full" />
                <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                  {isLoan ? "Taxa de Emprestimo (12 meses)" : "Valor de Mercado"}
                </div>
                <div className="text-xl font-bold text-white mt-2">{formatCurrency(fairValue)}</div>
                {isLoan && (
                  <div className="text-[10px] text-white/30 mt-1">Valor total: {formatCurrency(player.value)}</div>
                )}
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
                <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                  {isLoan ? "Sua Proposta de Emprestimo" : "Sua Oferta"}
                </div>
                <div className={cn("text-xl font-bold mt-2", status.color)}>{formatCurrency(offer)}</div>
              </div>
            </div>

            {/* Offer Slider */}
            <div className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Valor da Proposta</span>
                <span className={cn("font-medium px-2 py-0.5 rounded", status.color, status.bgColor + "/20")}>
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
                <span className="text-white/20">|</span>
                <span>{formatCurrency(maxOffer)}</span>
              </div>
            </div>

            {/* Offer Status */}
            <div className={cn(
              "flex items-center gap-3 p-4 rounded-xl border transition-all",
              status.chance >= 75 ? "bg-[#1db954]/10 border-[#1db954]/30" :
              status.chance >= 50 ? "bg-yellow-500/10 border-yellow-500/30" :
              status.chance >= 25 ? "bg-orange-500/10 border-orange-500/30" :
              "bg-red-500/10 border-red-500/30"
            )}>
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", status.bgColor + "/20")}>
                <AlertCircle className={cn("h-5 w-5", status.color)} />
              </div>
              <div className="flex-1">
                <div className={cn("text-sm font-semibold", status.color)}>Proposta {status.label}</div>
                <div className="text-xs text-white/50">{status.chance}% de chance de aceitacao</div>
              </div>
              <div className="text-right">
                <div className={cn("text-2xl font-bold", status.color)}>{status.chance}%</div>
              </div>
            </div>
          </div>
        )}

        {step === "response" && (
          <div className="py-16 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="relative inline-block">
              {/* Animated rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-2 border-primary/20 animate-ping" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border border-primary/30 animate-pulse" />
              </div>
              
              {/* Main icon */}
              <div className="relative h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/30">
                <Handshake className="h-10 w-10 text-primary animate-pulse" />
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mt-8 px-8">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-100 ease-linear"
                  style={{ width: `${responseProgress}%` }}
                />
              </div>
            </div>
            
            <div className="mt-6">
              <div className="text-lg font-semibold text-white">Negociando...</div>
              <div className="text-sm text-white/50 mt-1 flex items-center justify-center gap-2">
                <span>O clube esta analisando sua proposta</span>
                <span className="inline-flex gap-1">
                  <span className="w-1 h-1 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          </div>
        )}

        {step === "result" && (
          <div className="py-12 text-center animate-in fade-in zoom-in-95 duration-500">
            {/* Result animation */}
            <div className="relative">
              {accepted ? (
                <>
                  {/* Success sparkles */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="absolute -top-4 -left-4 h-6 w-6 text-[#1db954] animate-pulse" />
                    <Sparkles className="absolute -top-2 right-0 h-4 w-4 text-yellow-500 animate-pulse" style={{ animationDelay: "200ms" }} />
                    <Sparkles className="absolute bottom-0 -left-2 h-5 w-5 text-[#1db954] animate-pulse" style={{ animationDelay: "400ms" }} />
                  </div>
                  
                  <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-[#1db954] to-[#1db954]/60 flex items-center justify-center shadow-lg shadow-[#1db954]/30 animate-in zoom-in-50 duration-500">
                    <Check className="h-10 w-10 text-white" strokeWidth={3} />
                  </div>
                </>
              ) : (
                <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-red-500 to-red-500/60 flex items-center justify-center shadow-lg shadow-red-500/30 animate-in zoom-in-50 duration-500">
                  <X className="h-10 w-10 text-white" strokeWidth={3} />
                </div>
              )}
            </div>
            
            <div className={cn(
              "text-2xl font-bold mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300",
              accepted ? "text-[#1db954]" : "text-red-500"
            )} style={{ animationDelay: "200ms" }}>
              {accepted ? "Proposta Aceita!" : "Proposta Recusada"}
            </div>
            
            <div className="text-sm text-white/50 mt-3 max-w-xs mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "300ms" }}>
              {accepted 
                ? isLoan
                  ? `O emprestimo de ${player.name} foi acordado por ${formatCurrency(offer)} (12 meses)`
                  : `A transferencia de ${player.name} foi concluida por ${formatCurrency(offer)}`
                : isLoan
                  ? "O clube recusou o emprestimo. Tente um valor maior ou duracao diferente."
                  : "O clube recusou sua oferta. Tente novamente com um valor maior."
              }
            </div>

            {/* Transfer summary for accepted offers */}
            {accepted && (
              <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10 mx-4 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: "400ms" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar name={player.name} teamColor={player.team?.cor1} size="sm" />
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">{player.name}</div>
                      <div className="text-[10px] text-white/40">{player.team?.nome}</div>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-[#1db954]" />
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[#1db954]">Seu Clube</div>
                    <div className="text-[10px] text-white/40">{isLoan ? "Emprestimo" : "Contratado"}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "offer" && (
            <>
              <Button variant="outline" onClick={handleClose} className="border-white/10 text-white/70 hover:bg-white/5">
                Cancelar
              </Button>
              <Button onClick={handleSubmitOffer} className="bg-[#1db954] text-black hover:bg-[#1ed760] font-semibold gap-2">
                <Handshake className="h-4 w-4" />
                Enviar Proposta
              </Button>
            </>
          )}
          {step === "result" && (
            <Button 
              onClick={accepted ? handleConfirm : handleClose} 
              className={cn(
                "w-full font-semibold",
                accepted 
                  ? "bg-[#1db954] text-black hover:bg-[#1ed760]" 
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              {accepted ? "Concluir Transferencia" : "Fechar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
