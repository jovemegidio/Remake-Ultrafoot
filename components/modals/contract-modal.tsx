"use client"

import { useEffect, useMemo, useState } from "react"
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
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react"
import { PlayerAvatar } from "@/components/player-avatar"
import { TrilhaDePassos, GrupoDeCampos } from "@/components/modal-kit"
import { cn } from "@/lib/utils"
import { useUserTeam } from "@/lib/time-da-carreira"
import { type Player, formatWeeksToDate, getContractStatus } from "@/lib/game-engine"
import { formatCurrency } from "@/lib/currency"

interface ContractModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player | null
  currentWeek: number
  currentSeason: number
  onRenew?: (playerId: number, salary: number, weeks: number) => void
  teamBalance: number
}

export function ContractModal({
  open,
  onOpenChange,
  player,
  currentWeek,
  currentSeason,
  onRenew,
  teamBalance,
}: ContractModalProps) {
  const [newSalary, setNewSalary] = useState(0)
  const [contractLength, setContractLength] = useState(104) // 2 anos padrao
  const [step, setStep] = useState<"view" | "negotiate" | "success">("view")
  const [isNegotiating, setIsNegotiating] = useState(false)
  // Sem `fileKey` a foto publicada pelo canal nunca aparece (a chave la e
  // `fileKey__nome`). Renovacao e sempre com atleta do proprio elenco.
  const { team: meuClube } = useUserTeam()
  const currentSalary = player?.contract?.salary || 0

  // Reset state quando modal abre
  useEffect(() => {
    if (open && player?.contract) {
      setNewSalary(player.contract.salary)
      setContractLength(104)
      setStep("view")
    }
  }, [open, player])

  // Calcular demanda do jogador baseado no overall e moral
  const playerDemand = useMemo(() => {
    if (!player) return 0

    const baseSalary = currentSalary
    const overallFactor = player.overall / 75
    const moraleFactor = player.morale === "Feliz" ? 0.9 : 
                         player.morale === "Motivado" ? 0.95 :
                         player.morale === "Normal" ? 1.0 :
                         player.morale === "Insatisfeito" ? 1.15 : 1.3
    const ageFactor = player.age < 25 ? 1.1 : player.age > 30 ? 0.85 : 1.0
    
    return Math.round(baseSalary * overallFactor * moraleFactor * ageFactor)
  }, [player, currentSalary])

  if (!player) return null

  const contractStatus = getContractStatus(player, currentWeek)
  const weeksRemaining = player.contract ? player.contract.endDate - currentWeek : 0

  // Verificar se proposta e aceitavel
  const isProposalAcceptable = newSalary >= playerDemand * 0.9

  // Custo total do contrato
  const totalCost = newSalary * contractLength

  // Formatar salario
  // Moeda do jogador (`lib/currency`), nao R$ chumbado: quem joga em euro via
  // salario em real dentro do proprio modal de contrato.
  const formatSalary = (value: number) => formatCurrency(value)

  const handleNegotiate = () => {
    if (!isProposalAcceptable) return
    
    setIsNegotiating(true)
    
    setTimeout(() => {
      // Simular negociacao
      const acceptChance = newSalary >= playerDemand ? 0.95 : 
                          newSalary >= playerDemand * 0.95 ? 0.7 : 0.4
      
      if (Math.random() < acceptChance) {
        onRenew?.(player.id, newSalary, contractLength)
        setStep("success")
      } else {
        // Jogador rejeitou - aumentar demanda
        setNewSalary(Math.round(playerDemand * 1.1))
      }
      setIsNegotiating(false)
    }, 2000)
  }

  const handleClose = () => {
    setStep("view")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden border-white/10 bg-[var(--uf-bg-surface)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Contrato
          </DialogTitle>
          <DialogDescription className="text-white/50">
            {step === "view" ? "Detalhes do contrato de" : "Renovacao de contrato de"} {player.name}
          </DialogDescription>
          <TrilhaDePassos
            className="pt-2"
            atual={step}
            passos={[
              { id: "view", rotulo: "Contrato atual" },
              { id: "negotiate", rotulo: "Proposta" },
              { id: "success", rotulo: "Assinatura" },
            ]}
          />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
        {step === "view" && (
          <div className="space-y-6 py-4">
            {/* Player Info */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
              <PlayerAvatar name={player.name} fileKey={meuClube.file_key} position={player.position} size="md" />
              <div className="flex-1">
                <div className="font-semibold text-white">{player.name}</div>
                <div className="text-sm text-white/50">{player.position} - {player.age} anos</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#ffd700]">{player.overall}</div>
                <div className="text-xs text-white/50">Overall</div>
              </div>
            </div>

            {/* Contract Status */}
            <div className={cn(
              "p-4 rounded-lg border",
              contractStatus === "ok" ? "bg-green-500/10 border-green-500/30" :
              contractStatus === "expiring" ? "bg-[#ffd700]/10 border-[#ffd700]/30" :
              "bg-red-500/10 border-red-500/30"
            )}>
              <div className="flex items-center gap-2 mb-3">
                {contractStatus === "ok" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : contractStatus === "expiring" ? (
                  <AlertTriangle className="h-5 w-5 text-[#ffd700]" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                <span className={cn(
                  "font-semibold",
                  contractStatus === "ok" ? "text-green-500" :
                  contractStatus === "expiring" ? "text-[#ffd700]" : "text-red-500"
                )}>
                  {contractStatus === "ok" ? "Contrato Ativo" :
                   contractStatus === "expiring" ? "Contrato Expirando" : "Sem Contrato"}
                </span>
              </div>

              {player.contract && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Salario semanal:</span>
                    <span className="text-white font-semibold">{formatSalary(currentSalary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Termino:</span>
                    <span className="text-white">
                      {formatWeeksToDate(player.contract.endDate, currentSeason)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Tempo restante:</span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-white/50" />
                      <span className="text-white font-semibold">
                        {weeksRemaining > 52 
                          ? `${Math.floor(weeksRemaining / 52)} anos e ${weeksRemaining % 52} semanas`
                          : `${weeksRemaining} semanas`
                        }
                      </span>
                    </div>
                  </div>
                  {player.contract.releaseClause && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Clausula de rescisao:</span>
                      <span className="text-[#ffd700] font-semibold">
                        {formatSalary(player.contract.releaseClause)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Market Value */}
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider">Valor de Mercado</div>
                  <div className="text-xl font-bold text-[var(--brand)]">{formatSalary(player.marketValue)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/50 uppercase tracking-wider">Potencial</div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-[var(--brand)]" />
                    <span className="text-xl font-bold text-[var(--brand)]">{player.potential}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "negotiate" && (
          <div className="space-y-4 py-4">
            <GrupoDeCampos titulo="O que você oferece" nota="Salário e duração — o atleta pesa os dois juntos, não só o valor.">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Novo Salario Semanal</span>
                <span className="text-xl font-bold text-white">{formatSalary(newSalary)}</span>
              </div>
              <Slider
                value={[newSalary]}
                onValueChange={([value]) => setNewSalary(value)}
                min={Math.round(currentSalary * 0.5)}
                max={Math.round(currentSalary * 2)}
                step={5000}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-white/40">
                <span>{formatSalary(Math.round(currentSalary * 0.5))}</span>
                <span className="text-[#ffd700]">Demanda: {formatSalary(playerDemand)}</span>
                <span>{formatSalary(Math.round(currentSalary * 2))}</span>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Duracao do Contrato</span>
                <span className="text-xl font-bold text-white">
                  {contractLength >= 52 
                    ? `${Math.floor(contractLength / 52)} ${contractLength >= 104 ? 'anos' : 'ano'}`
                    : `${contractLength} semanas`
                  }
                </span>
              </div>
              <Slider
                value={[contractLength]}
                onValueChange={([value]) => setContractLength(value)}
                min={26}
                max={260}
                step={26}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-white/40">
                <span>6 meses</span>
                <span>5 anos</span>
              </div>
            </div>

            </GrupoDeCampos>

            {/* O veredito da proposta fica FORA do grupo: e a resposta, nao um campo. */}
            <div className={cn(
              "p-4 rounded-lg border",
              isProposalAcceptable ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
            )}>
              <div className="flex items-center gap-2 mb-3">
                {isProposalAcceptable ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                <span className={cn(
                  "font-semibold text-sm",
                  isProposalAcceptable ? "text-green-500" : "text-red-500"
                )}>
                  {isProposalAcceptable ? "Proposta Aceitavel" : "Proposta Muito Baixa"}
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Custo total:</span>
                  <span className="text-white font-semibold">{formatSalary(totalCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Aumento salarial:</span>
                  <span className={cn(
                    "font-semibold",
                    newSalary > currentSalary ? "text-red-500" : "text-green-500"
                  )}>
                    {newSalary > currentSalary ? "+" : ""}{((newSalary - currentSalary) / currentSalary * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="py-12 text-center">
            <div className="relative">
              <div className="h-20 w-20 mx-auto rounded-full bg-[var(--brand)]/20 flex items-center justify-center mb-6">
                <Sparkles className="h-10 w-10 text-[var(--brand)]" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Contrato Renovado!</h3>
            <p className="text-white/50 mb-4">
              {player.name} assinou um novo contrato de{" "}
              {contractLength >= 52 
                ? `${Math.floor(contractLength / 52)} ${contractLength >= 104 ? 'anos' : 'ano'}`
                : `${contractLength} semanas`
              }
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
              <DollarSign className="h-4 w-4 text-[var(--brand)]" />
              <span className="text-white font-semibold">{formatSalary(newSalary)}</span>
              <span className="text-white/50">/semana</span>
            </div>
          </div>
        )}

        </div>

        <DialogFooter>
          {step === "view" && (
            <>
              <Button 
                variant="outline" 
                onClick={handleClose} 
                className="border-white/10 text-white/70"
              >
                Fechar
              </Button>
              <Button 
                onClick={() => setStep("negotiate")}
                className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)]"
              >
                Renovar Contrato
              </Button>
            </>
          )}
          {step === "negotiate" && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setStep("view")} 
                className="border-white/10 text-white/70"
              >
                Voltar
              </Button>
              <Button 
                onClick={handleNegotiate}
                disabled={!isProposalAcceptable || isNegotiating}
                className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)] disabled:opacity-50"
              >
                {isNegotiating ? "Negociando..." : "Enviar Proposta"}
              </Button>
            </>
          )}
          {step === "success" && (
            <Button 
              onClick={handleClose}
              className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)]"
            >
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
