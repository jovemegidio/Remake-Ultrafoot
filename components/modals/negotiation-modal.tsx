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
import { TrilhaDePassos, GrupoDeCampos } from "@/components/modal-kit"
import type { Team } from "@/lib/teams-data"
import { formatCurrency } from "@/lib/currency"
import { useSalario } from "@/lib/usar-salario"
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
import {
  dificuldadeDeEmprestimo,
  exigenciasDoDono,
  avaliarPropostaDeEmprestimo,
  type ExigenciasDoDono,
  type RespostaDaMesaDeEmprestimo,
  type TermosNovoEmprestimo,
} from "@/lib/emprestimos"
import { DollarSign, Check, X, AlertCircle, Handshake, Clock, ArrowRight, Sparkles, Users, Swords, Link2, Gavel, Timer } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  JUROS_POR_PARCELA, MAX_PARCELAS, MAX_REVENDA, descontoPorRevenda, resolverNegocio,
  type TermosDoNegocio,
} from "@/lib/clausulas-do-negocio"
import { siglaExibivel } from "@/lib/club-identity"

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

/** Termos fechados de um empréstimo — o que a tela precisa para registrar o vínculo. */
export interface LoanDeal {
  /** Duração do vínculo, em semanas. */
  semanas: number
  /** Taxa paga ao clube dono pelo período. */
  taxa: number
  /** Salário SEMANAL que o seu clube passa a pagar (já com a cobertura aplicada). */
  salarioSemanal: number
  /** Fatia do salário do atleta que você assumiu (%). */
  coberturaSalarial: number
  /** Minutagem prometida ao dono (% das partidas). */
  minutosPrometidos: number
  /** Opção de compra ao fim do vínculo (0 = sem opção). */
  opcaoDeCompra: number
}

interface NegotiationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player | null
  type: "buy" | "sell" | "loan"
  team?: Team
  /**
   * Teto REAL de gasto do clube: caixa + crédito disponível. Sem ele a mesa
   * deixava propor 100 mi com 20 mi no caixa. Opcional para não quebrar quem
   * abre o modal noutro contexto (venda, por exemplo).
   */
  tetoDeGastos?: number
  /**
   * `loan` traz os termos fechados na mesa do dono — a tela precisa deles para
   * registrar o vínculo com a duração e o salário ACERTADOS. Antes o mercado
   * cravava 26 semanas e `taxa/26` de salário, ignorando qualquer negociação.
   */
  /**
   * `termos` traz as cláusulas do negócio (1.0.383): parcelamento, revenda
   * pactuada e recompra. Opcional — sem ele o negócio é à vista, exatamente
   * como toda transferência era antes desta versão.
   */
  onConfirm?: (offer: number, salaryWeekly?: number, loan?: LoanDeal, termos?: TermosDoNegocio) => void
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
  tetoDeGastos,
  onConfirm,
  onNegotiationResult,
}: NegotiationModalProps) {
  // ⚠️ Gancho de tradução: a mesa nova de cláusulas (1.0.383) nasce extraída,
  // e a catraca `qa:traducao` só desce. Um componente só neste arquivo, então
  // o lugar do gancho não tem ambiguidade.
  const t = useTranslation()
  const salario = useSalario()
  const [offer, setOffer] = useState(player?.value || 0)
  /**
   * CLÁUSULAS DO NEGÓCIO. Ver `lib/clausulas-do-negocio.ts` para o que cada uma
   * custa — a prévia aqui usa as MESMAS funções que o motor vai usar, não uma
   * conta parecida.
   */
  const [parcelas, setParcelas] = useState(0)
  const [revenda, setRevenda] = useState(0)
  // "terms"      = mesa com o AGENTE (compra).
  // "loan_terms" = mesa com o CLUBE DONO (empréstimo): duração, folha, minutagem
  //                e opção de compra. Antes o empréstimo pulava direto ao result.
  const [step, setStep] = useState<"offer" | "response" | "terms" | "loan_terms" | "result">("offer")

  // Papel prometido no elenco — pesa mais que dinheiro para um craque.
  const [role, setRole] = useState<SquadRole>("reforco")
  // EMPRÉSTIMO: quanto do salário do atleta você assume. Emprestar serve para
  // aliviar a folha do dono — quem não cobre o salário não leva ninguém.
  const [coberturaSalarial, setCoberturaSalarial] = useState(75)
  // Termos pessoais em negociacao com o agente.
  const [salary, setSalary] = useState(0)
  const [contractYears, setContractYears] = useState(4)
  const [signingBonus, setSigningBonus] = useState(0)
  const [agentDemands, setAgentDemands] = useState<AgentDemands | null>(null)
  const [agentResponse, setAgentResponse] = useState<AgentResponse | null>(null)
  const [agentRounds, setAgentRounds] = useState(0)
  // ── Mesa do EMPRÉSTIMO (com o clube dono) ────────────────────────────────
  const [loanWeeks, setLoanWeeks] = useState(26)
  const [minutosPrometidos, setMinutosPrometidos] = useState(60)
  const [opcaoDeCompra, setOpcaoDeCompra] = useState(0)
  const [ownerDemands, setOwnerDemands] = useState<ExigenciasDoDono | null>(null)
  const [ownerResponse, setOwnerResponse] = useState<RespostaDaMesaDeEmprestimo | null>(null)
  const [ownerRounds, setOwnerRounds] = useState(0)
  const [loanDeal, setLoanDeal] = useState<LoanDeal | null>(null)
  // PAGOU A MULTA: o clube perde o direito de recusar. Guardado em ref-state
  // porque o `handleSubmitOffer` roda dentro de um setTimeout e leria o valor
  // velho do slider se dependesse só dele.
  const [pagandoMulta, setPagandoMulta] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [responseProgress, setResponseProgress] = useState(0)
  // Quem barrou a negociacao e por que. O clube pode aceitar e o JOGADOR recusar.
  const [rejectedBy, setRejectedBy] = useState<"club" | "player" | null>(null)
  const [playerReason, setPlayerReason] = useState<string>("")

  // Reset state when modal opens
  useEffect(() => {
    if (open && player) {
      // A mesa abre no valor de mercado, mas nunca acima do que o clube pode
      // pagar — senão o slider já nascia fora do teto.
      setOffer(Math.min(player.value, tetoDeGastos ?? Number.POSITIVE_INFINITY))
      setStep("offer")
      setAccepted(false)
      setResponseProgress(0)
      setRejectedBy(null)
      setPlayerReason("")
      setRole("reforco")
      setCoberturaSalarial(75)
      setAgentDemands(null)
      setAgentResponse(null)
      setAgentRounds(0)
      setLoanWeeks(26)
      setMinutosPrometidos(60)
      setOpcaoDeCompra(0)
      setOwnerDemands(null)
      setOwnerResponse(null)
      setOwnerRounds(0)
      setLoanDeal(null)
      setPagandoMulta(false)
    }
  }, [open, player])

  if (!player) return null

  const isLoan = type === "loan"

  // ── EMPRÉSTIMO: a mesa mais difícil do mercado ───────────────────────────
  //
  // Era a mais FÁCIL: taxa fixa de 2% do valor por mês, nenhuma resistência do
  // dono e o atleta topando tudo. Um craque de 80 mi saía por 1,6 mi/mês —
  // emprestar rendia mais que comprar e não custava quase nada.
  // Agora a régua sai de lib/emprestimos.ts: titular em idade de auge NÃO é
  // emprestado, craque custa prêmio e o dono ainda exige o salário coberto.
  const loanDif = isLoan
    ? dificuldadeDeEmprestimo({
        overall: player.overall,
        idade: player.age ?? 26,
        valor: player.value,
        prestigioDono: player.team?.prestigio ?? 60,
        prestigioComprador: team?.prestigio ?? 60,
      })
    : null

  const minOffer = loanDif
    ? loanDif.taxaMinima
    : Math.floor(player.value * 0.5)
  // ── VOCÊ SÓ OFERECE O QUE PODE PAGAR ─────────────────────────────────────
  //
  // Relato: "tenho 20 mi em caixa e estou fazendo proposta por um jogador de
  // 100 mi". A mesa era um slider de 50% a 150% do valor do atleta, sem olhar
  // uma vez sequer para o caixa — a conta só aparecia no fim, quando a compra
  // falhava. Agora o TETO da proposta é o que o clube tem de verdade: caixa +
  // crédito que o banco cobre (`tetoDeGastos`, calculado por quem abre o modal
  // com canAffordTransfer/borrowingCapacity).
  // CLAUSULA DE RESCISAO: pagar a multa forca a venda — o clube NAO pode recusar
  // (como na vida real).
  const releaseClause = type === "buy" ? (player.releaseClause ?? null) : null
  const temClausula = releaseClause != null && releaseClause > 0

  // ── A MULTA PRECISA CABER NO SLIDER ──────────────────────────────────────
  //
  // BUG que isto corrige: o teto de mercado era 150% do valor, e a multa
  // rescisória costuma valer MAIS que isso (o motor gera cláusula de 1,6x o
  // valor para quem tem 80+, e os seeds trazem cláusulas bem acima). Com o teto
  // em 150% o slider simplesmente NÃO ALCANÇAVA a cláusula: `clausulaAtingida`
  // nunca ficava verdadeiro e o valor da multa era um número decorativo na
  // ficha do atleta. Pagar a multa era impossível.
  const tetoDeMercado = loanDif
    ? loanDif.taxaMaxima
    : Math.max(Math.floor(player.value * 1.5), temClausula ? releaseClause! : 0)
  const tetoDoCaixa = tetoDeGastos ?? Number.POSITIVE_INFINITY
  const maxOffer = Math.max(0, Math.min(tetoDeMercado, tetoDoCaixa))
  /** A multa cabe no caixa? Sem isso o botão de pagar seria uma armadilha. */
  const multaNoAlcance = temClausula && releaseClause! <= tetoDoCaixa
  /** O caixa (e o crédito) não alcançam nem o mínimo que o clube vendedor ouviria. */
  const semDinheiro = maxOffer < minOffer
  // ── CRAQUE CUSTA CARO E CUSTA A SAIR ─────────────────────────────────────
  //
  // Antes o overall nao pesava na negociacao: um centroavante 90 e um reserva 70
  // saiam pelo mesmo percentual do valor de mercado e com a MESMA chance de
  // aceite. Na vida real ninguem entrega o craque por 100% da avaliacao — o
  // clube pede premio e ainda pensa duas vezes.
  const reputacao: "top_mundial" | "estrela" | "normal" =
    player.overall >= 85 ? "top_mundial" : player.overall >= 79 ? "estrela" : "normal"
  // Premio de craque sobre o valor de mercado (o clube pede acima da avaliacao).
  const premioCraque = reputacao === "top_mundial" ? 1.45 : reputacao === "estrela" ? 1.2 : 1
  // E o clube resiste: derruba a chance de aceite em qualquer patamar de oferta.
  const resistenciaCraque = reputacao === "top_mundial" ? 0.5 : reputacao === "estrela" ? 0.72 : 1

  const fairValue = loanDif
    ? loanDif.taxaJusta
    : Math.floor(player.value * premioCraque)
  const offerPercentage = Math.round((offer / fairValue) * 100)

  const clausulaAtingida = temClausula && offer >= releaseClause!

  const getOfferStatus = () => {
    if (clausulaAtingida) return { label: "Cláusula paga", color: "text-[var(--brand)]", bgColor: "bg-[var(--brand)]", chance: 100 }
    if (offerPercentage >= 110) return { label: "Excelente", color: "text-[var(--brand)]", bgColor: "bg-[var(--brand)]", chance: 95 }
    if (offerPercentage >= 100) return { label: "Justa", color: "text-[var(--brand)]", bgColor: "bg-[var(--brand)]", chance: 75 }
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
  // Clausula paga vence tudo (inclusive a resistencia do craque) — e o preco de
  // mercado dele; por isso a multa existe.
  // No empréstimo entram DOIS fatores a mais: a resistência do dono em soltar o
  // atleta (chanceMult) e o quanto do salário você assumiu — cobrir menos do que
  // o dono exige derruba a conversa, mesmo pagando a taxa cheia.
  const coberturaEmFalta = loanDif ? Math.max(0, loanDif.coberturaMinima - coberturaSalarial) : 0
  const clubChance = clausulaAtingida ? 100 : loanDif?.recusaDireta ? 0 : Math.max(
    1,
    Math.min(99, Math.round(
      status.chance * relEffect.chanceMult * resistenciaCraque * (loanDif?.chanceMult ?? 1) -
      (relEffect.hardBlock && offerPercentage < 130 ? 55 : 0) -
      coberturaEmFalta * 1.2,
    )),
  )

  /**
   * PAGAR A MULTA RESCISÓRIA.
   *
   * Quitar a cláusula tira o clube vendedor da mesa: ele não avalia, não recusa
   * e o relacionamento (nem sendo rival) segura o negócio. O que continua
   * valendo é o resto — o ATLETA ainda decide se quer o projeto e o AGENTE
   * ainda negocia salário, luvas e papel. É por isso que a multa entra ANTES
   * da conversa salarial, e não no lugar dela.
   */
  const pagarMulta = () => {
    if (!temClausula || !multaNoAlcance) return
    setOffer(releaseClause!)
    setPagandoMulta(true)
    handleSubmitOffer(releaseClause!, true)
  }

  const handleSubmitOffer = (valorForcado?: number, multaPaga = false) => {
    const valorDaProposta = valorForcado ?? offer
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
      // Multa quitada pula esta etapa: não há avaliação a fazer, o clube é
      // obrigado a liberar. É esse o sentido da cláusula.
      const clubAccepts = multaPaga || Math.random() * 100 <= clubChance

      if (!clubAccepts) {
        setRejectedBy("club")
        setPlayerReason("")
        setAccepted(false)
        onNegotiationResult?.({ player, type, offer: valorDaProposta, accepted: false, rejectedBy: "club" })
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
      const wageRatio = fairValue > 0 ? valorDaProposta / fairValue : 1

      const decision = evaluatePlayerDecision({
        playerOverall: player.overall,
        playerAge: player.age ?? 26,
        playerPotential: player.potential ?? player.overall,
        currentClubPrestige: currentPrestige,
        buyingClubPrestige: buyingPrestige,
        wageRatio,
        // Proxy da forca do 11 titular do comprador. No EMPRÉSTIMO isto era 0 —
        // ou seja, o atleta nunca pensava em quanto ia jogar, e emprestado todo
        // mundo aceitava tudo. Quem vai emprestado quer MINUTOS: elenco forte
        // significa banco, e isso pesa contra.
        buyingClubSquadStrength: buyingPrestige,
      })

      // O jogador nem quis ouvir a proposta: acaba aqui (e gera a carencia de 30 dias).
      if (!decision.accepted) {
        setAccepted(false)
        setRejectedBy("player")
        setPlayerReason(decision.reason)
        onNegotiationResult?.({ player, type, offer: valorDaProposta, accepted: false, rejectedBy: "player" })
        setStep("result")
        return
      }

      // ── EMPRÉSTIMO: agora TEM mesa de termos ────────────────────────────
      // O atleta topou vir; falta acertar com o dono do passe o que sempre
      // ficou de fora — duração, quanto da folha você assume, quanto ele vai
      // jogar e se existe opção de compra no fim.
      if (isLoan && loanDif) {
        const exigencias = exigenciasDoDono({
          overall: player.overall,
          idade: player.age ?? 26,
          valor: player.value,
          prestigioDono: currentPrestige,
          prestigioComprador: buyingPrestige,
        })
        setOwnerDemands(exigencias)
        setLoanWeeks(exigencias.semanasIdeais)
        setMinutosPrometidos(exigencias.minutosMinimos)
        setCoberturaSalarial(prev => Math.max(prev, exigencias.coberturaMinima))
        setOpcaoDeCompra(0)
        setOwnerResponse(null)
        setOwnerRounds(0)
        setPlayerReason(decision.reason)
        setStep("loan_terms")
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

  // ── SALÁRIO DO ATLETA NO EMPRÉSTIMO ──────────────────────────────────────
  //
  // O mercado registrava o vínculo com salário = `taxa / 26`, o que não tem
  // relação nenhuma com o que o atleta ganha: um craque emprestado por uma taxa
  // simbólica entrava na folha ganhando quase nada. O salário é do ATLETA (sai
  // do patamar dele, como na compra); o que você negocia é QUANTO DELE você
  // assume — é isso que a cobertura significa.
  const salarioSemanalDoAtleta = Math.round(
    (player.value * 0.0045 * (1 + Math.max(0, player.overall - 70) * 0.06)) / 4.33,
  )
  const custoSemanalDoEmprestimo = Math.round(salarioSemanalDoAtleta * (coberturaSalarial / 100))

  /** Mesa do empréstimo: o dono aceita, contrapropõe ou encerra. */
  const handleSubmitLoanTerms = () => {
    if (!ownerDemands || !loanDif || !player) return
    const termos: TermosNovoEmprestimo = {
      semanas: loanWeeks,
      taxa: offer,
      coberturaSalarial,
      minutosPrometidos,
      opcaoDeCompra,
    }
    const res = avaliarPropostaDeEmprestimo(termos, ownerDemands, loanDif, ownerRounds, player.name)
    setOwnerResponse(res)
    setOwnerRounds(r => r + 1)

    if (res.veredito === "aceito") {
      setLoanDeal({
        semanas: loanWeeks,
        taxa: offer,
        salarioSemanal: custoSemanalDoEmprestimo,
        coberturaSalarial,
        minutosPrometidos,
        opcaoDeCompra,
      })
      setAccepted(true)
      setRejectedBy(null)
      onNegotiationResult?.({ player, type, offer, accepted: true, rejectedBy: null })
      setStep("result")
    } else if (res.veredito === "recusado") {
      setAccepted(false)
      setRejectedBy("club")
      setPlayerReason(res.recado)
      onNegotiationResult?.({ player, type, offer, accepted: false, rejectedBy: "club" })
      setStep("result")
    }
    // "contraproposta": segue na mesa.
  }

  /** Aceita exatamente o que o dono do passe exigiu. */
  const aceitarContrapropostaDoDono = () => {
    const c = ownerResponse?.contraproposta
    if (!c) return
    setLoanWeeks(c.semanas)
    setOffer(c.taxa)
    setCoberturaSalarial(c.coberturaSalarial)
    setMinutosPrometidos(c.minutosPrometidos)
    setOpcaoDeCompra(c.opcaoDeCompra)
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
    setParcelas(0)
    setRevenda(0)
    setResponseProgress(0)
    onOpenChange(false)
  }

  const handleConfirm = () => {
    // Passa TAMBEM o salario negociado (mensal -> semanal) para valer de verdade
    // no contrato. Antes so a taxa (offer) ia; a mesa do agente era cosmetica.
    // No empréstimo vão os termos fechados com o dono — duração e folha reais.
    if (loanDeal) {
      onConfirm?.(loanDeal.taxa, loanDeal.salarioSemanal, loanDeal)
    } else {
      // ⚠️ O VALOR QUE VAI É O JÁ DESCONTADO pela revenda pactuada. Mandar o
      // cheio e descontar depois faria a tela mostrar um preço e o caixa sofrer
      // outro — o tipo de divergência que só aparece semanas depois.
      onConfirm?.(
        offer - descontoPorRevenda(offer, revenda),
        salary > 0 ? Math.round(salary / 4.33) : undefined,
        undefined,
        { parcelas, revendaAoVendedor: revenda },
      )
    }
    handleClose()
  }

  const title = type === "buy" ? "Negociar Compra" : type === "sell" ? "Negociar Venda" : "Negociar Emprestimo"
  const actionIcon = type === "loan" ? <Clock className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {/* max-h + rolagem: em tela de 768px de altura a mesa do emprestimo
          (duracao, folha, minutagem, opcao de compra) passava do rodape e o botao
          de fechar negocio ficava inalcancavel. `overflow-hidden` sozinho CORTAVA
          o conteudo em vez de deixar rolar. */}
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden border-white/10 bg-[var(--uf-bg-surface)] sm:max-w-lg">
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
          {/* Onde a negociacao esta. Cada passo trocava o modal inteiro sem dizer
              se ainda dava para ajustar algo ou se o negocio ja estava fechado. */}
          <TrilhaDePassos
            className="pt-2"
            /* "response" e a espera pela resposta — ele nao merece um passo proprio,
               mas sumir com a trilha durante a espera daria a impressao de que o
               modal trocou de assunto. Os dois pintam o ultimo passo. */
            atual={step === "response" ? "result" : step}
            passos={isLoan
              ? [
                  { id: "offer", rotulo: "Proposta" },
                  { id: "loan_terms", rotulo: "Termos" },
                  { id: "result", rotulo: "Resposta" },
                ]
              : [
                  { id: "offer", rotulo: "Proposta" },
                  { id: "terms", rotulo: "Agente" },
                  { id: "result", rotulo: "Resposta" },
                ]}
          />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
        {step === "offer" && (
          <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Player Info */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/10">
              <div className="relative">
                <PlayerAvatar
                  name={player.name}
                  teamColor={player.team?.cor1}
                  fileKey={player.team?.file_key}
                  position={player.position}
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
                      <span>{siglaExibivel(player.team.curto, player.team.nome)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Os numeros da mesa, num bloco so. */}
            <GrupoDeCampos titulo="Os números" nota={isLoan ? "O que o dono pede e o que você oferece pela cessão." : "O que ele vale e o que você está disposto a pagar."}>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full" />
                <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                  {isLoan ? "Taxa pedida pelo dono" : "Valor de Mercado"}
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

            <div className="mt-3 space-y-4 rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">{t.negociacao.valor_da_proposta}</span>
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
              {/* Por que o slider para aqui. Sem esta linha o teto parecia
                  arbitrário — e era justamente a dúvida do relato. */}
              {tetoDeGastos != null && tetoDeMercado > tetoDoCaixa && (
                <p className="text-[11px] text-amber-300/80">
                  Teto de {formatCurrency(tetoDoCaixa)}: é o que o clube tem em caixa mais o crédito
                  que o banco cobre. {player.name.split(" ").slice(-1)[0]} vale {formatCurrency(player.value)}.
                </p>
              )}
            </div>

            {/* CLÁUSULAS DO NEGÓCIO (1.0.383).

                ⚠️ Até a 1.0.382 toda transferência era à vista, e o campo
                `resaleClause` do contrato — que `lib/repartir-venda.ts` já
                descontava — era SEMPRE zero, porque nada no jogo o escrevia.
                Aqui estão as duas portas que faltavam. */}
            {type === "buy" && (
              <div className="mt-3 space-y-4 rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                <p className="text-sm font-semibold text-white/70">{t.negociacao.clausulas_do_negocio}</p>

                <div>
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>{t.negociacao.parcelamento_anual}</span>
                    <span className="text-white/80">{parcelas === 0 ? "À vista" : `${parcelas + 1}x`}</span>
                  </div>
                  <Slider
                    value={[parcelas]}
                    onValueChange={([v]) => setParcelas(v)}
                    min={0}
                    max={MAX_PARCELAS}
                    step={1}
                    className="py-3"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>{t.negociacao.revenda_que_fica_com_o_vendedor}</span>
                    <span className="text-white/80">{revenda}%</span>
                  </div>
                  <Slider
                    value={[revenda]}
                    onValueChange={([v]) => setRevenda(v)}
                    min={0}
                    max={MAX_REVENDA}
                    step={5}
                    className="py-3"
                  />
                </div>

                {/* A PRÉVIA É O CÁLCULO DE VERDADE: mesmas funções que o motor
                    executa ao fechar. */}
                <div className="space-y-1 rounded-lg bg-black/25 p-3 text-xs text-white/60">
                  {revenda > 0 && (
                    <p>
                      Preço cai para <b className="text-emerald-300">{formatCurrency(offer - descontoPorRevenda(offer, revenda))}</b>,
                      e {revenda}% de uma futura venda dele será do {player.team?.nome ?? "clube vendedor"}.
                    </p>
                  )}
                  {parcelas > 0 ? (
                    resolverNegocio(offer - descontoPorRevenda(offer, revenda), { parcelas }, {
                      atleta: player.name, clube: player.team?.nome ?? "", semanaAtual: 0, tipo: "pagar",
                    }).descricao.map(linha => <p key={linha}>{linha}</p>)
                  ) : (
                    <p>Pagamento integral no ato. Parcelar custa {Math.round(JUROS_POR_PARCELA * 100)}% a mais por parcela, mas exige menos caixa hoje.</p>
                  )}
                </div>
              </div>
            )}

            </GrupoDeCampos>

            {/* Nem o mínimo o caixa alcança: a mesa nem abre. Antes dava para
                montar a proposta inteira e só descobrir na hora de fechar. */}
            {semDinheiro && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">{t.negociacao.fora_do_alcance_do_clube}</p>
                  <p className="mt-1 text-xs text-red-200/75">
                    O {player.team?.nome ?? "clube"} não ouviria menos de {formatCurrency(minOffer)}, e o
                    seu teto hoje é {formatCurrency(tetoDoCaixa)}. Venda alguém, quite dívida ou espere
                    a receita entrar.
                  </p>
                </div>
              </div>
            )}

            {/* ── MULTA RESCISÓRIA ────────────────────────────────────────
                Pedido do jogador: poder QUITAR a cláusula na mesa com o clube,
                antes de sentar com o atleta. Quem paga a multa não negocia com
                o clube — ele é obrigado a liberar. O slider continua ali para
                quem prefere tentar um acordo mais barato. */}
            {temClausula && (
              <div className={cn(
                "space-y-3 rounded-xl border p-4",
                clausulaAtingida
                  ? "border-[var(--brand)]/40 bg-[var(--brand)]/10"
                  : multaNoAlcance
                    ? "border-[#ffd700]/30 bg-[#ffd700]/[0.06]"
                    : "border-white/10 bg-white/[0.02]",
              )}>
                <div className="flex items-start gap-3">
                  <Gavel className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    clausulaAtingida ? "text-[var(--brand)]" : "text-[#ffd700]",
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/70">
                        Multa rescisória
                      </span>
                      <span className="text-sm font-black tabular-nums text-white">
                        {formatCurrency(releaseClause!)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-white/45">
                      {clausulaAtingida
                        ? `Sua proposta cobre a cláusula: o ${player.team?.nome ?? "clube"} não pode recusar. Falta convencer o atleta e o agente.`
                        : multaNoAlcance
                          ? `Pagando a multa, o ${player.team?.nome ?? "clube"} é obrigado a liberar — sem avaliação, sem rivalidade. Depois disso você ainda negocia salário e papel com o atleta.`
                          : `A multa custa ${formatCurrency(releaseClause!)} e o seu teto hoje é ${formatCurrency(tetoDoCaixa)}. Sem caixa para quitar, resta negociar com o clube.`}
                    </p>
                  </div>
                </div>
                {!clausulaAtingida && (
                  <button
                    type="button"
                    onClick={pagarMulta}
                    disabled={!multaNoAlcance}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 text-xs font-black transition-opacity",
                      multaNoAlcance
                        ? "bg-[#ffd700] text-black hover:opacity-90"
                        : "cursor-not-allowed bg-white/5 text-white/30",
                    )}
                  >
                    {multaNoAlcance
                      ? `Pagar a multa · ${formatCurrency(releaseClause!)}`
                      : "Caixa insuficiente para a multa"}
                  </button>
                )}
              </div>
            )}

            {/* Offer Status */}
            <div className={cn(
              "flex items-center gap-3 p-4 rounded-xl border transition-all",
              status.chance >= 75 ? "bg-[var(--brand)]/10 border-[var(--brand)]/30" :
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
                  : "bg-[var(--brand)]/10 border-[var(--brand)]/30 text-[var(--brand)]",
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

            {/* EMPRÉSTIMO — o que o dono exige além da taxa. */}
            {loanDif && (
              <div className={cn(
                "space-y-3 rounded-xl border p-4",
                loanDif.recusaDireta
                  ? "border-red-500/30 bg-red-500/10"
                  : "border-white/[0.06] bg-white/[0.02]",
              )}>
                <div className="flex items-start gap-3">
                  <Clock className={cn("mt-0.5 h-4 w-4 shrink-0", loanDif.recusaDireta ? "text-red-300" : "text-white/40")} />
                  <p className={cn("text-xs leading-relaxed", loanDif.recusaDireta ? "text-red-200" : "text-white/55")}>
                    {loanDif.motivo}
                  </p>
                </div>

                {!loanDif.recusaDireta && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">{t.negociacao.salario_que_voce_assume}</span>
                      <span className={cn(
                        "font-semibold tabular-nums",
                        coberturaSalarial >= loanDif.coberturaMinima ? "text-[var(--brand)]" : "text-orange-400",
                      )}>
                        {coberturaSalarial}%
                      </span>
                    </div>
                    <Slider
                      value={[coberturaSalarial]}
                      onValueChange={([value]) => setCoberturaSalarial(value)}
                      min={0}
                      max={100}
                      step={5}
                      className="py-2"
                    />
                    <p className={cn(
                      "text-[11px] leading-snug",
                      coberturaSalarial >= loanDif.coberturaMinima ? "text-white/35" : "text-orange-300/85",
                    )}>
                      {coberturaSalarial >= loanDif.coberturaMinima
                        ? `O clube dono exige pelo menos ${loanDif.coberturaMinima}% — sua cobertura atende.`
                        : `O clube dono exige ${loanDif.coberturaMinima}% do salário coberto. Abaixo disso a chance despenca.`}
                    </p>
                  </>
                )}
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
                          ? "border-[var(--brand)] bg-[var(--brand)]/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25"
                      )}
                    >
                      <div className={cn(
                        "text-xs font-bold",
                        role === r ? "text-[var(--brand)]" : "text-white/80"
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/15">
                <Handshake className="h-5 w-5 text-[var(--brand)]" />
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
                  <div>Salario: <b>{formatCurrency(salario.valor(agentResponse.counter.salary))}</b>{salario.sufixo}</div>
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

            {/* Salário no período que o jogador escolheu na criação da carreira.
                O slider continua operando na unidade SEMANAL do motor: só o
                número mostrado muda, nunca o valor enviado à negociação. */}
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-white/50">{salario.sistema === "mensal" ? "Salario mensal" : "Salario semanal"}</span>
                <span className="font-bold text-white">{formatCurrency(salario.valor(salary))}</span>
              </div>
              <Slider
                value={[salary]}
                min={Math.round(agentDemands.salary * 0.4)}
                max={Math.round(agentDemands.salary * 2)}
                step={Math.max(1000, Math.round(agentDemands.salary * 0.02))}
                onValueChange={(v) => setSalary(v[0])}
              />
              <div className="mt-1 text-[10px] text-white/35">
                Ele pede {salario.formatar(agentDemands.salary)}
              </div>
            </div>

            {/* Luvas */}
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-white/50">{t.negociacao.luvas_bonus_de_assinatura}</span>
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
              <div className="mb-2 text-xs text-white/50">{t.negociacao.tempo_de_contrato}</div>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setContractYears(y)}
                    className={cn(
                      "rounded-lg border py-2 text-xs font-bold transition-all",
                      contractYears === y
                        ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
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
              <div className="mb-2 text-xs text-white/50">{t.negociacao.papel_no_elenco}</div>
              <div className="grid grid-cols-3 gap-2">
                {(["primordial", "reforco", "banco"] as SquadRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-[11px] font-bold transition-all",
                      role === r
                        ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
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
              <div className="rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-3 py-2 text-center text-[11px] text-[var(--brand)]/80">
                Sua contraproposta · rodada {agentRounds + 1}. Ajuste salário, luvas,
                duração ou papel e envie novamente ao agente.
              </div>
            )}
          </div>
        )}

        {/* ── MESA DO EMPRÉSTIMO (com o CLUBE DONO) ─────────────────────────
            O atleta topou vir. Falta o que o empréstimo nunca teve: duração,
            folha, minutagem e opção de compra. O dono contrapropõe como o
            agente faz na compra — em duas rodadas; na terceira ele encerra. */}
        {step === "loan_terms" && ownerDemands && loanDif && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/15">
                <Handshake className="h-5 w-5 text-[var(--brand)]" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">
                  Direção do {player.team?.nome ?? "clube dono"}
                </div>
                <div className="text-xs text-white/45">
                  {ownerResponse?.recado ?? `${player.name} topou vir. Agora acerte os termos do vínculo.`}
                </div>
              </div>
            </div>

            {ownerResponse?.veredito === "contraproposta" && ownerResponse.contraproposta && (
              <div className="rounded-xl border border-[#ffd700]/30 bg-[#ffd700]/10 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#ffd700]">
                  Eles exigem
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
                  <div>Duração: <b>{ownerResponse.contraproposta.semanas} semanas</b></div>
                  <div>Taxa: <b>{formatCurrency(ownerResponse.contraproposta.taxa)}</b></div>
                  <div>Folha: <b>{ownerResponse.contraproposta.coberturaSalarial}%</b></div>
                  <div>Minutagem: <b>{ownerResponse.contraproposta.minutosPrometidos}%</b></div>
                </div>
                <button
                  type="button"
                  onClick={aceitarContrapropostaDoDono}
                  className="mt-3 w-full rounded-lg bg-[#ffd700] px-3 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90"
                >
                  Usar a contraproposta do clube
                </button>
              </div>
            )}

            {/* Duração */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-white/50">
                <Timer className="h-3.5 w-3.5" /> Duração do empréstimo
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[13, 26, 39, 52].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setLoanWeeks(w)}
                    className={cn(
                      "rounded-lg border py-2 text-[11px] font-bold transition-all",
                      loanWeeks === w
                        ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                        : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25",
                    )}
                  >
                    {w === 52 ? "1 ano" : `${w} sem`}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[10px] text-white/35">
                Eles querem {ownerDemands.semanasIdeais} semanas
              </div>
            </div>

            {/* Folha assumida — e o que isso custa POR SEMANA */}
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-white/50">{t.negociacao.salario_que_voce_assume_2}</span>
                <span className={cn(
                  "font-bold tabular-nums",
                  coberturaSalarial >= ownerDemands.coberturaMinima ? "text-[var(--brand)]" : "text-orange-400",
                )}>
                  {coberturaSalarial}%
                </span>
              </div>
              <Slider
                value={[coberturaSalarial]}
                min={0}
                max={100}
                step={5}
                onValueChange={(v) => setCoberturaSalarial(v[0])}
              />
              <div className="mt-1 text-[10px] text-white/35">
                Mínimo {ownerDemands.coberturaMinima}% · custa {formatCurrency(custoSemanalDoEmprestimo)}/semana
                {" "}({formatCurrency(custoSemanalDoEmprestimo * loanWeeks)} no período)
              </div>
            </div>

            {/* Minutagem prometida — a exigência que dinheiro não compra */}
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-white/50">{t.negociacao.minutagem_prometida}</span>
                <span className={cn(
                  "font-bold tabular-nums",
                  minutosPrometidos >= ownerDemands.minutosMinimos ? "text-[var(--brand)]" : "text-red-400",
                )}>
                  {minutosPrometidos}%
                </span>
              </div>
              <Slider
                value={[minutosPrometidos]}
                min={0}
                max={100}
                step={5}
                onValueChange={(v) => setMinutosPrometidos(v[0])}
              />
              <div className={cn(
                "mt-1 text-[10px] leading-snug",
                minutosPrometidos >= ownerDemands.minutosMinimos ? "text-white/35" : "text-red-300/80",
              )}>
                {minutosPrometidos >= ownerDemands.minutosMinimos
                  ? `Eles exigem ${ownerDemands.minutosMinimos}% das partidas — sua promessa atende.`
                  : `Eles exigem ${ownerDemands.minutosMinimos}%. Emprestar é para o atleta JOGAR: abaixo disso não há dinheiro que resolva.`}
              </div>
            </div>

            {/* Opção de compra */}
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-white/50">{t.negociacao.opcao_de_compra_ao_fim}</span>
                <span className="font-bold text-white">
                  {opcaoDeCompra > 0 ? formatCurrency(opcaoDeCompra) : "Sem opção"}
                </span>
              </div>
              <Slider
                value={[opcaoDeCompra]}
                min={0}
                max={Math.round(player.value * 2)}
                step={Math.max(100_000, Math.round(player.value * 0.05))}
                onValueChange={(v) => setOpcaoDeCompra(v[0])}
              />
              <div className="mt-1 text-[10px] text-white/35">
                {ownerDemands.aceitaOpcaoDeCompra
                  ? `Eles aceitam opção a partir de ${formatCurrency(ownerDemands.opcaoDeCompraMinima)}.`
                  : "Eles NÃO aceitam opção de compra: é projeto da casa. Deixe em zero."}
              </div>
            </div>

            {ownerRounds > 0 && (
              <div className="rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-3 py-2 text-center text-[11px] text-[var(--brand)]/80">
                Sua contraproposta · rodada {ownerRounds + 1} de 3. Na terceira sem
                acordo o clube encerra a conversa.
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
                <span>{t.negociacao.o_clube_esta_analisando_sua_proposta}</span>
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
                    <Sparkles className="absolute -top-4 -left-4 h-6 w-6 text-[var(--brand)] animate-pulse" />
                    <Sparkles className="absolute -top-2 right-0 h-4 w-4 text-[#ffd700] animate-pulse" style={{ animationDelay: "200ms" }} />
                    <Sparkles className="absolute bottom-0 -left-2 h-5 w-5 text-[var(--brand)] animate-pulse" style={{ animationDelay: "400ms" }} />
                  </div>
                  
                  <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand)]/60 flex items-center justify-center shadow-lg shadow-[var(--brand)]/30 animate-in zoom-in-50 duration-500">
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
              accepted ? "text-[var(--brand)]" : "text-red-500"
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
              <div className="mx-4 mt-4 rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-3 py-2 text-xs text-[var(--brand)]/80">
                O {player.team?.nome ?? "clube"} <strong>aceitou</strong> os {formatCurrency(offer)} — mas o acordo pessoal falhou.
              </div>
            )}

            <div className="text-sm text-white/50 mt-3 max-w-xs mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "300ms" }}>
              {accepted
                ? isLoan && loanDeal
                  ? `${player.name} chega por ${loanDeal.semanas} semanas: ${formatCurrency(loanDeal.taxa)} de taxa, ` +
                    `${loanDeal.coberturaSalarial}% do salário por sua conta` +
                    (loanDeal.opcaoDeCompra > 0 ? ` e opção de compra de ${formatCurrency(loanDeal.opcaoDeCompra)}` : "") + "."
                  : pagandoMulta
                    ? `Multa rescisória de ${formatCurrency(offer)} quitada. ${player.name} é seu.`
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
                    <PlayerAvatar name={player.name} teamColor={player.team?.cor1} fileKey={player.team?.file_key} position={player.position} size="sm" />
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">{player.name}</div>
                      <div className="text-[10px] text-white/40">{player.team?.nome}</div>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-[var(--brand)]" />
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[var(--brand)]">{t.negociacao.seu_clube}</div>
                    <div className="text-[10px] text-white/40">{isLoan ? "Emprestimo" : "Contratado"}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        </div>

        <DialogFooter className="gap-2">
          {step === "offer" && (
            <>
              <Button variant="outline" onClick={handleClose} className="border-white/10 text-white/70 hover:bg-white/5">
                Cancelar
              </Button>
              <Button
                onClick={() => handleSubmitOffer()}
                disabled={semDinheiro || loanDif?.recusaDireta}
                className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)] font-semibold gap-2 disabled:opacity-40"
              >
                <Handshake className="h-4 w-4" />
                {loanDif?.recusaDireta ? "Empréstimo recusado" : "Enviar Proposta"}
              </Button>
            </>
          )}
          {step === "loan_terms" && (
            <>
              <Button variant="outline" onClick={handleClose} className="border-white/10 text-white/70 hover:bg-white/5">
                Desistir
              </Button>
              <Button onClick={handleSubmitLoanTerms} className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)] font-semibold gap-2">
                <Handshake className="h-4 w-4" />
                {ownerResponse?.veredito === "contraproposta" ? "Enviar contraproposta" : "Propor ao clube"}
              </Button>
            </>
          )}
          {step === "terms" && (
            <>
              <Button variant="outline" onClick={handleClose} className="border-white/10 text-white/70 hover:bg-white/5">
                Desistir
              </Button>
              <Button onClick={handleSubmitTerms} className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)] font-semibold gap-2">
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
                  ? "bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)]" 
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
