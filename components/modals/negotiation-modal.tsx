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
import {
  evaluatePlayerDecision,
  computeAgentDemands,
  evaluateAgentOffer,
  ROLE_LABEL,
  ROLE_DESCRIPTION,
  type SquadRole,
  type AgentDemands,
  type AgentResponse,
  type PersonalTerms,
} from "@/lib/negotiation-engine"
import { getClubRelationship, getRelationshipEffect } from "@/lib/club-relationships"
import { DollarSign, Check, X, AlertCircle, Handshake, Clock, ArrowRight, Sparkles, Users, Swords, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Player {
  id: number
  name: string
  position: string
  overall: number
  value: number
  team?: Team
  age?: number
  potential?: number
  releaseClause?: number | null
}

interface NegotiationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player | null
  type: "buy" | "sell" | "loan"
  team?: Team
  onConfirm?: (offer: number, salaryWeekly?: number) => void
  onNegotiationResult?: (result: {
    player: Player
    type: "buy" | "sell" | "loan"
    offer: number
    accepted: boolean
    /** Quem barrou: o clube (dinheiro) ou o proprio jogador (projeto). */
    rejectedBy?: "club" | "player" | null
  }) => void
}

export function NegotiationModal({
  open,
  onOpenChange,
  player,
  type,
  team,
  onConfirm,
  onNegotiationResult,
}: NegotiationModalProps) {
  const [offer, setOffer] = useState(player?.value || 0)
  // "terms" = mesa com o AGENTE. Fechar com o clube nao fecha a contratacao.
  const [step, setStep] = useState<"offer" | "response" | "terms" | "result">("offer")

  // Papel prometido no elenco — pesa mais que dinheiro para um craque.
  const [role, setRole] = useState<SquadRole>("reforco")
  // Termos pessoais em negociacao com o agente.
  const [salary, setSalary] = useState(0)
  const [contractYears, setContractYears] = useState(4)
  const [signingBonus, setSigningBonus] = useState(0)
  const [agentDemands, setAgentDemands] = useState<AgentDemands | null>(null)
  const [agentResponse, setAgentResponse] = useState<AgentResponse | null>(null)
  const [agentRounds, setAgentRounds] = useState(0)
  const [accepted, setAccepted] = useState(false)
  const [responseProgress, setResponseProgress] = useState(0)
  // Quem barrou a negociacao e por que. O clube pode aceitar e o JOGADOR recusar.
  const [rejectedBy, setRejectedBy] = useState<"club" | "player" | null>(null)
  const [playerReason, setPlayerReason] = useState<string>("")

  // Reset state when modal opens
  useEffect(() => {
    if (open && player) {
      setOffer(player.value)
      setStep("offer")
      setAccepted(false)
      setResponseProgress(0)
      setRejectedBy(null)
      setPlayerReason("")
      setRole("reforco")
      setAgentDemands(null)
      setAgentResponse(null)
      setAgentRounds(0)
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

  // CLAUSULA DE RESCISAO: pagar a multa forca a venda — o clube NAO pode recusar
  // (como na vida real). Antes o valor da clausula so aparecia, sem efeito.
  const releaseClause = type === "buy" ? (player.releaseClause ?? null) : null
  const clausulaAtingida = releaseClause != null && releaseClause > 0 && offer >= releaseClause

  const getOfferStatus = () => {
    if (clausulaAtingida) return { label: "Cláusula paga", color: "text-[#00ffc8]", bgColor: "bg-[#00ffc8]", chance: 100 }
    if (offerPercentage >= 110) return { label: "Excelente", color: "text-[#00ffc8]", bgColor: "bg-[#00ffc8]", chance: 95 }
    if (offerPercentage >= 100) return { label: "Justa", color: "text-[#00ffc8]", bgColor: "bg-[#00ffc8]", chance: 75 }
    if (offerPercentage >= 90) return { label: "Razoavel", color: "text-[#ffd700]", bgColor: "bg-[#ffd700]", chance: 50 }
    if (offerPercentage >= 80) return { label: "Baixa", color: "text-orange-500", bgColor: "bg-orange-500", chance: 25 }
    return { label: "Insultuosa", color: "text-red-500", bgColor: "bg-red-500", chance: 5 }
  }

  const status = getOfferStatus()

  // Relacionamento entre o SEU clube e o clube VENDEDOR. Rival dificulta e encarece;
  // mesmo grupo / clube parceiro facilita. Afeta a chance do CLUBE (nao a do jogador).
  const relationship = getClubRelationship(team?.nome ?? "", player.team?.nome ?? "")
  const relEffect = getRelationshipEffect(team?.nome ?? "", player.team?.nome ?? "", type)
  // Chance efetiva do clube aceitar, ja com o relacionamento. Rival com oferta abaixo de
  // 130% do valor: praticamente barrado (so cede por muito dinheiro).
  // Clausula paga => 100% garantido, o relacionamento nao barra (nem rival pode
  // segurar quem tem multa quitada).
  const clubChance = clausulaAtingida ? 100 : Math.max(
    1,
    Math.min(99, Math.round(
      status.chance * relEffect.chanceMult -
      (relEffect.hardBlock && offerPercentage < 130 ? 55 : 0),
    )),
  )

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
      // ETAPA 1 — o CLUBE avalia o dinheiro E o RELACIONAMENTO (rival dificulta a venda).
      const clubAccepts = Math.random() * 100 <= clubChance

      if (!clubAccepts) {
        setRejectedBy("club")
        setPlayerReason("")
        setAccepted(false)
        onNegotiationResult?.({ player, type, offer, accepted: false, rejectedBy: "club" })
        setStep("result")
        return
      }

      // ETAPA 2 — o JOGADOR avalia o PROJETO. Dinheiro nao compra tudo:
      // ele pode recusar mesmo com o clube tendo aceitado uma oferta enorme.
      // Emprestimo pesa menos no lado do jogador (e temporario).
      const buyingPrestige = team?.prestigio ?? 60
      const currentPrestige = player.team?.prestigio ?? 60
      // Salario oferecido cresce junto com a proposta: pagar acima do valor de
      // mercado sinaliza salario maior. wageRatio ~ proporcional a oferta/valor.
      const wageRatio = fairValue > 0 ? offer / fairValue : 1

      const decision = evaluatePlayerDecision({
        playerOverall: player.overall,
        playerAge: player.age ?? 26,
        playerPotential: player.potential ?? player.overall,
        currentClubPrestige: currentPrestige,
        buyingClubPrestige: buyingPrestige,
        wageRatio,
        // Proxy da forca do 11 titular do comprador.
        buyingClubSquadStrength: isLoan ? 0 : buyingPrestige,
      })

      // O jogador nem quis ouvir a proposta: acaba aqui (e gera a carencia de 30 dias).
      if (!decision.accepted) {
        setAccepted(false)
        setRejectedBy("player")
        setPlayerReason(decision.reason)
        onNegotiationResult?.({ player, type, offer, accepted: false, rejectedBy: "player" })
        setStep("result")
        return
      }

      // Emprestimo nao tem mesa de termos pessoais — fecha direto.
      if (isLoan) {
        setAccepted(true)
        setRejectedBy(null)
        setPlayerReason(decision.reason)
        onNegotiationResult?.({ player, type, offer, accepted: true, rejectedBy: null })
        setStep("result")
        return
      }

      // ETAPA 3 — o jogador topou o PROJETO. Agora senta o AGENTE, e ele vem espremer.
      const demands = computeAgentDemands({
        playerOverall: player.overall,
        playerAge: player.age ?? 26,
        playerPotential: player.potential ?? player.overall,
        marketValue: player.value,
        currentClubPrestige: currentPrestige,
        buyingClubPrestige: buyingPrestige,
      })
      setAgentDemands(demands)
      // Abre a mesa com uma proposta conservadora: ~85% do pedido. O usuario ajusta.
      setSalary(Math.round(demands.salary * 0.85))
      setSigningBonus(Math.round(demands.signingBonus * 0.85))
      setContractYears(demands.contractYears)
      setAgentResponse(null)
      setAgentRounds(0)
      setPlayerReason(decision.reason)
      setStep("terms")
    }, 1800)
  }

  // Mesa com o agente: ele aceita, contrapropoe (o caso comum) ou rompe.
  const handleSubmitTerms = () => {
    if (!agentDemands || !player) return
    const terms: PersonalTerms = { salary, contractYears, signingBonus, role }
    const res = evaluateAgentOffer(terms, agentDemands, player.name)
    setAgentResponse(res)
    setAgentRounds(r => r + 1)

    if (res.verdict === "accepted") {
      setAccepted(true)
      setRejectedBy(null)
      onNegotiationResult?.({ player, type, offer, accepted: true, rejectedBy: null })
      setStep("result")
    } else if (res.verdict === "rejected") {
      setAccepted(false)
      setRejectedBy("player")
      setPlayerReason(res.message)
      onNegotiationResult?.({ player, type, offer, accepted: false, rejectedBy: "player" })
      setStep("result")
    }
    // "counter": segue na mesa; o usuario ajusta ou aceita a contraproposta.
  }

  /** Aceita exatamente o que o agente exigiu. */
  const acceptCounter = () => {
    const c = agentResponse?.counter
    if (!c) return
    setSalary(c.salary)
    setSigningBonus(c.signingBonus)
    setContractYears(c.contractYears)
    setRole(c.role)
  }

  const handleClose = () => {
    setStep("offer")
    setOffer(player.value)
    setResponseProgress(0)
    onOpenChange(false)
  }

  const handleConfirm = () => {
    // Passa TAMBEM o salario negociado (mensal -> semanal) para valer de verdade
    // no contrato. Antes so a taxa (offer) ia; a mesa do agente era cosmetica.
    onConfirm?.(offer, salary > 0 ? Math.round(salary / 4.33) : undefined)
    handleClose()
  }

  const title = type === "buy" ? "Negociar Compra" : type === "sell" ? "Negociar Venda" : "Negociar Emprestimo"
  const actionIcon = type === "loan" ? <Clock className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-[#0c0c10] border-white/10 overflow-hidden">
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
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#ffd700] flex items-center justify-center border-2 border-[#141414]">
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
            <div className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
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
              status.chance >= 75 ? "bg-[#00ffc8]/10 border-[#00ffc8]/30" :
              status.chance >= 50 ? "bg-[#ffd700]/10 border-[#ffd700]/30" :
              status.chance >= 25 ? "bg-orange-500/10 border-orange-500/30" :
              "bg-red-500/10 border-red-500/30"
            )}>
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", status.bgColor + "/20")}>
                <AlertCircle className={cn("h-5 w-5", status.color)} />
              </div>
              <div className="flex-1">
                <div className={cn("text-sm font-semibold", status.color)}>Proposta {status.label}</div>
                <div className="text-xs text-white/50">{clubChance}% de chance do clube aceitar</div>
              </div>
              <div className="text-right">
                <div className={cn("text-2xl font-bold", status.color)}>{clubChance}%</div>
              </div>
            </div>

            {/* Relacionamento entre clubes: rival dificulta, grupo/parceiro/afinidade facilita. */}
            {relEffect.note && (
              <div className={cn(
                "flex items-start gap-3 p-3 rounded-xl border text-xs",
                relationship.kind === "rival"
                  ? "bg-red-500/10 border-red-500/30 text-red-300"
                  : "bg-[#00ffc8]/10 border-[#00ffc8]/30 text-[#00ffc8]",
              )}>
                <div className="mt-0.5 shrink-0">
                  {relationship.kind === "rival"
                    ? <Swords className="h-4 w-4" />
                    : relationship.kind === "group"
                      ? <Users className="h-4 w-4" />
                      : <Link2 className="h-4 w-4" />}
                </div>
                <div>
                  {relationship.kind !== "neutral" && (
                    <div className="font-semibold">
                      {relationship.label}{relationship.detail ? ` — ${relationship.detail}` : ""}
                    </div>
                  )}
                  <div className="opacity-80">{relEffect.note}</div>
                </div>
              </div>
            )}

            {/* Papel no elenco — pesa mais que dinheiro para um craque.
                Prometer banco a um jogador de 80+ derruba a negociacao sozinho. */}
            {!isLoan && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                  Papel prometido no elenco
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["primordial", "reforco", "banco"] as SquadRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all",
                        role === r
                          ? "border-[#00ffc8] bg-[#00ffc8]/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25"
                      )}
                    >
                      <div className={cn(
                        "text-xs font-bold",
                        role === r ? "text-[#00ffc8]" : "text-white/80"
                      )}>
                        {ROLE_LABEL[r]}
                      </div>
                      <div className="mt-1 text-[10px] leading-snug text-white/40">
                        {ROLE_DESCRIPTION[r]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MESA COM O AGENTE ─────────────────────────────────────────────
            O clube aceitou e o jogador topou o projeto. Falta o mais dificil:
            convencer o agente. Ele contrapropoe e endurece. */}
        {step === "terms" && agentDemands && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00ffc8]/15">
                <Handshake className="h-5 w-5 text-[#00ffc8]" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">Agente de {player.name}</div>
                <div className="text-xs text-white/45">
                  {agentResponse?.message ??
                    `O ${player.team?.nome ?? "clube"} aceitou. Agora acerte os termos pessoais.`}
                </div>
              </div>
            </div>

            {/* Contraproposta do agente */}
            {agentResponse?.verdict === "counter" && agentResponse.counter && (
              <div className="rounded-xl border border-[#ffd700]/30 bg-[#ffd700]/10 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#ffd700]">
                  Ele exige
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
                  <div>Salario: <b>{formatCurrency(agentResponse.counter.salary)}</b>/mes</div>
                  <div>Luvas: <b>{formatCurrency(agentResponse.counter.signingBonus)}</b></div>
                  <div>Contrato: <b>{agentResponse.counter.contractYears} anos</b></div>
                  <div>Papel: <b>{ROLE_LABEL[agentResponse.counter.role]}</b></div>
                </div>
                <button
                  type="button"
                  onClick={acceptCounter}
                  className="mt-3 w-full rounded-lg bg-[#ffd700] px-3 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90"
                >
                  Usar a contraproposta do agente
                </button>
              </div>
            )}

            {/* Salario mensal */}
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-white/50">Salario mensal</span>
                <span className="font-bold text-white">{formatCurrency(salary)}</span>
              </div>
              <Slider
                value={[salary]}
                min={Math.round(agentDemands.salary * 0.4)}
                max={Math.round(agentDemands.salary * 2)}
                step={Math.max(1000, Math.round(agentDemands.salary * 0.02))}
                onValueChange={(v) => setSalary(v[0])}
              />
              <div className="mt-1 text-[10px] text-white/35">
                Ele pede {formatCurrency(agentDemands.salary)}/mes
              </div>
            </div>

            {/* Luvas */}
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-white/50">Luvas (bonus de assinatura)</span>
                <span className="font-bold text-white">{formatCurrency(signingBonus)}</span>
              </div>
              <Slider
                value={[signingBonus]}
                min={0}
                max={Math.round(agentDemands.signingBonus * 2)}
                step={Math.max(1000, Math.round(agentDemands.signingBonus * 0.02))}
                onValueChange={(v) => setSigningBonus(v[0])}
              />
              <div className="mt-1 text-[10px] text-white/35">
                Ele pede {formatCurrency(agentDemands.signingBonus)}
              </div>
            </div>

            {/* Tempo de contrato */}
            <div>
              <div className="mb-2 text-xs text-white/50">Tempo de contrato</div>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setContractYears(y)}
                    className={cn(
                      "rounded-lg border py-2 text-xs font-bold transition-all",
                      contractYears === y
                        ? "border-[#00ffc8] bg-[#00ffc8]/10 text-[#00ffc8]"
                        : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25"
                    )}
                  >
                    {y} ano{y > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[10px] text-white/35">
                Ele quer {agentDemands.contractYears} anos
              </div>
            </div>

            {/* Papel */}
            <div>
              <div className="mb-2 text-xs text-white/50">Papel no elenco</div>
              <div className="grid grid-cols-3 gap-2">
                {(["primordial", "reforco", "banco"] as SquadRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-[11px] font-bold transition-all",
                      role === r
                        ? "border-[#00ffc8] bg-[#00ffc8]/10 text-[#00ffc8]"
                        : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25"
                    )}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[10px] text-white/35">
                Papel minimo aceito: {ROLE_LABEL[agentDemands.minRole]}
              </div>
            </div>

            {agentRounds > 0 && (
              <div className="rounded-lg border border-[#00ffc8]/20 bg-[#00ffc8]/5 px-3 py-2 text-center text-[11px] text-[#00ffc8]/80">
                Sua contraproposta · rodada {agentRounds + 1}. Ajuste salário, luvas,
                duração ou papel e envie novamente ao agente.
              </div>
            )}
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
                    <Sparkles className="absolute -top-4 -left-4 h-6 w-6 text-[#00ffc8] animate-pulse" />
                    <Sparkles className="absolute -top-2 right-0 h-4 w-4 text-[#ffd700] animate-pulse" style={{ animationDelay: "200ms" }} />
                    <Sparkles className="absolute bottom-0 -left-2 h-5 w-5 text-[#00ffc8] animate-pulse" style={{ animationDelay: "400ms" }} />
                  </div>
                  
                  <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-[#00ffc8] to-[#00ffc8]/60 flex items-center justify-center shadow-lg shadow-[#00ffc8]/30 animate-in zoom-in-50 duration-500">
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
              accepted ? "text-[#00ffc8]" : "text-red-500"
            )} style={{ animationDelay: "200ms" }}>
              {accepted
                ? "Proposta Aceita!"
                : rejectedBy === "player"
                  ? "O Jogador Recusou"
                  : "O Clube Recusou"}
            </div>

            {/* Quando o CLUBE aceita mas o JOGADOR recusa, deixamos isso explicito:
                dinheiro resolveu a parte do clube, mas nao convenceu o atleta. */}
            {rejectedBy === "player" && (
              <div className="mx-4 mt-4 rounded-lg border border-[#00ffc8]/20 bg-[#00ffc8]/5 px-3 py-2 text-xs text-[#00ffc8]/80">
                O {player.team?.nome ?? "clube"} <strong>aceitou</strong> os {formatCurrency(offer)} — mas o acordo pessoal falhou.
              </div>
            )}

            <div className="text-sm text-white/50 mt-3 max-w-xs mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "300ms" }}>
              {accepted
                ? isLoan
                  ? `O emprestimo de ${player.name} foi acordado por ${formatCurrency(offer)} (12 meses)`
                  : `A transferencia de ${player.name} foi concluida por ${formatCurrency(offer)}`
                : rejectedBy === "player"
                  ? playerReason
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
                  <ArrowRight className="h-5 w-5 text-[#00ffc8]" />
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[#00ffc8]">Seu Clube</div>
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
              <Button onClick={handleSubmitOffer} className="bg-[#00ffc8] text-black hover:bg-[#00c8ff] font-semibold gap-2">
                <Handshake className="h-4 w-4" />
                Enviar Proposta
              </Button>
            </>
          )}
          {step === "terms" && (
            <>
              <Button variant="outline" onClick={handleClose} className="border-white/10 text-white/70 hover:bg-white/5">
                Desistir
              </Button>
              <Button onClick={handleSubmitTerms} className="bg-[#00ffc8] text-black hover:bg-[#00c8ff] font-semibold gap-2">
                <Handshake className="h-4 w-4" />
                {agentResponse?.verdict === "counter" ? "Enviar contraproposta" : "Propor ao agente"}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button
              onClick={accepted ? handleConfirm : handleClose}
              className={cn(
                "w-full font-semibold",
                accepted 
                  ? "bg-[#00ffc8] text-black hover:bg-[#00c8ff]" 
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
