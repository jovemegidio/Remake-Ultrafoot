"use client"

import { useState, useMemo, useEffect } from "react"
import {
  FileText,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Calendar,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Handshake,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Progress } from "@/components/ui/progress"
import { useRouter } from "next/navigation"
import { useGameState } from "@/lib/save-system"
import { useSalario } from "@/lib/usar-salario"
import { useUserTeam } from "@/lib/time-da-carreira"
import { aplicarResposta, RELACAO_INICIAL, type RespostaDoClube } from "@/lib/pressao-do-agente"
import { ConversaAgente } from "@/components/conversa-agente"
import { type EstadoDoAgente, type DesfechoDoAgente, type PerfilDoAgente } from "@/lib/conversa-agente"
import { useGameEngine, type Player, getContractStatus, formatWeeksToDate, absoluteWeek } from "@/lib/game-engine"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"

export default function ContratosPage() {
  const { team: userTeam } = useUserTeam()
  const router = useRouter()
  const { squadPlayers, renewContract, currentWeek, currentSeason, balance, wageBudget } = useGameEngine()
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [showRenewalModal, setShowRenewalModal] = useState(false)
  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all")
  const [gpPlayerIdx, setGpPlayerIdx] = useState(0)
  
  // ── RESPOSTA AO EMPRESÁRIO ────────────────────────────────────────────────
  //
  // Aceitar tem CUSTO REAL: renova de fato pelo que ele pediu (renovação) ou
  // sobe o salário (aumento). Sem isso o "aceitar" seria um botão que só faz o
  // agente calar a boca, e a negociação não valeria nada.
  const { state: saveState, setState: setSaveState } = useGameState()
  const salario = useSalario()
  const pedidoDeAgente = saveState.pedidoDeAgente ?? null

  // ── CONVERSA COM O EMPRESARIO ───────────────────────────────────────────
  //
  // Aceitar/Recusar sao os dois extremos. A conversa e o meio: contrapropor,
  // prometer minutos, perguntar o que ele quer. Ver lib/conversa-agente.
  const [conversaAberta, setConversaAberta] = useState(false)

  /** Perfil ESTAVEL por atleta: derivado do id, nao sorteado a cada render. */
  const perfilDoAgente = (id: number): PerfilDoAgente =>
    (["duro", "razoavel", "conciliador"] as const)[id % 3]

  const estadoDoAgente = useMemo<EstadoDoAgente | null>(() => {
    if (!pedidoDeAgente) return null
    const p = squadPlayers.find(x => x.id === pedidoDeAgente.playerId)
    if (!p) return null
    const relacao = saveState.relacoesComAgentes?.[String(p.id)] ?? RELACAO_INICIAL
    const fimAbsoluto = p.contract?.endDate ?? 0
    return {
      nome: `Empresário de ${p.name.split(" ")[0]}`,
      perfil: perfilDoAgente(p.id),
      desgaste: relacao.desgaste,
      pedidosRecusados: relacao.pedidosRecusados,
      pedido: {
        tipo: pedidoDeAgente.tipo,
        salarioPedido: pedidoDeAgente.salarioPedido,
        anosPedidos: pedidoDeAgente.anosPedidos,
      },
      atleta: {
        id: p.id, nome: p.name, overall: p.overall, idade: p.age,
        salarioMensal: (p.contract?.salary ?? 0) * 4,
        valorDeMercado: p.marketValue ?? 0,
        semanasDeContrato: Math.max(0, fimAbsoluto - absoluteWeek(currentSeason, currentWeek)),
        minutosNaTemporada: 0,
        jogosDoClube: currentWeek,
        titular: Boolean(p.isStarter),
        moral: 60,
      },
      caixaDoClube: balance,
    }
  }, [pedidoDeAgente, squadPlayers, saveState.relacoesComAgentes, currentSeason, currentWeek, balance])

  /** Aplica no save o que a conversa decidiu. */
  const aplicarDesfechoDaConversa = (d: DesfechoDoAgente) => {
    if (!pedidoDeAgente) return
    const chave = String(pedidoDeAgente.playerId)
    const relacao = saveState.relacoesComAgentes?.[chave] ?? RELACAO_INICIAL
    const novoDesgaste = Math.max(0, Math.min(100, relacao.desgaste + d.desgasteDelta))
    setSaveState({
      relacoesComAgentes: {
        ...(saveState.relacoesComAgentes ?? {}),
        [chave]: { ...relacao, desgaste: novoDesgaste },
      },
      // Acordo fechado ou saida combinada tiram o pedido da mesa; uma conversa
      // que so troca farpas mantem o pedido pendente, como deve ser.
      ...(d.acordoFechado || d.vaiOferecerNoMercado ? { pedidoDeAgente: null } : {}),
    })
    if (d.acordoFechado && d.valorAcordado) {
      renewContract(pedidoDeAgente.playerId, Math.round(d.valorAcordado / 4), pedidoDeAgente.anosPedidos ?? 2)
    }
  }

  const responderAoAgente = (resposta: RespostaDoClube) => {
    if (!pedidoDeAgente) return
    const chave = String(pedidoDeAgente.playerId)
    const relacao = saveState.relacoesComAgentes?.[chave] ?? RELACAO_INICIAL

    if (resposta === "aceito") {
      const atleta = squadPlayers.find(p => p.id === pedidoDeAgente.playerId)
      const salario = pedidoDeAgente.salarioPedido ?? atleta?.contract?.salary ?? 0
      if (atleta) {
        if (pedidoDeAgente.tipo === "renovacao") {
          renewContract(atleta.id, salario, (pedidoDeAgente.anosPedidos ?? 2) * 52)
        } else if (pedidoDeAgente.tipo === "salario") {
          // Mantém o prazo que ele já tinha e mexe só no valor.
          const semanasRestantes = Math.max(
            26, (atleta.contract?.endDate ?? 0) - absoluteWeek(currentSeason, currentWeek),
          )
          renewContract(atleta.id, salario, semanasRestantes)
        }
        // Minutagem não tem contrapartida contratual: o compromisso é escalar,
        // e quem cobra isso é o próprio agente na próxima ligação.
      }
    }

    setSaveState({
      relacoesComAgentes: {
        ...(saveState.relacoesComAgentes ?? {}),
        [chave]: aplicarResposta(relacao, pedidoDeAgente, resposta, currentWeek),
      },
      pedidoDeAgente: null,
    })
  }

  // Estado da negociacao
  const [proposedSalary, setProposedSalary] = useState(0)
  const [proposedYears, setProposedYears] = useState(2)
  const [negotiationStatus, setNegotiationStatus] = useState<"idle" | "negotiating" | "accepted" | "rejected">("idle")

  // Calcula folha salarial atual
  const currentWages = useMemo(() => {
    return squadPlayers.reduce((total, p) => total + (p.contract?.salary || 0), 0)
  }, [squadPlayers])

  // Filtra jogadores por status de contrato
  const filteredPlayers = useMemo(() => {
    return squadPlayers
      .map(p => ({
        ...p,
        contractStatus: getContractStatus(p, currentWeek, currentSeason),
        weeksRemaining: p.contract ? p.contract.endDate - absoluteWeek(currentSeason, currentWeek) : 0
      }))
      .filter(p => {
        if (filter === "expiring") return p.contractStatus === "expiring"
        if (filter === "expired") return p.contractStatus === "expired"
        return true
      })
      .sort((a, b) => {
        // Ordena por urgencia do contrato
        const statusOrder = { expired: 0, expiring: 1, ok: 2 }
        return statusOrder[a.contractStatus] - statusOrder[b.contractStatus]
      })
  }, [squadPlayers, currentWeek, currentSeason, filter])

  // Contagem por status
  const statusCounts = useMemo(() => {
    const counts = { expiring: 0, expired: 0, ok: 0 }
    squadPlayers.forEach(p => {
      counts[getContractStatus(p, currentWeek, currentSeason)]++
    })
    return counts
  }, [squadPlayers, currentWeek, currentSeason])

  useEffect(() => {
    const filterOrder: ("all" | "expiring" | "expired")[] = ["all", "expiring", "expired"]
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (!btn) return
      if (showRenewalModal) {
        if (btn === "B") setShowRenewalModal(false)
        return
      }
      if (btn === "B") { router.back(); return }
      if (btn === "LB") setFilter(f => filterOrder[Math.max(0, filterOrder.indexOf(f) - 1)])
      if (btn === "RB") setFilter(f => filterOrder[Math.min(filterOrder.length - 1, filterOrder.indexOf(f) + 1)])
      if (btn === "DPAD_DOWN") {
        setGpPlayerIdx(prev => {
          const next = Math.min(prev + 1, filteredPlayers.length - 1)
          setSelectedPlayer(filteredPlayers[next] ?? null)
          return next
        })
      }
      if (btn === "DPAD_UP") {
        setGpPlayerIdx(prev => {
          const next = Math.max(prev - 1, 0)
          setSelectedPlayer(filteredPlayers[next] ?? null)
          return next
        })
      }
      if (btn === "A" && selectedPlayer) setShowRenewalModal(true)
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router, showRenewalModal, selectedPlayer, filteredPlayers])

  // Abre modal de renovacao
  const handleOpenRenewal = (player: Player) => {
    setSelectedPlayer(player)
    setProposedSalary(Math.round((player.contract?.salary || 50000) * 1.1)) // +10% inicial
    setProposedYears(2)
    setNegotiationStatus("idle")
    setShowRenewalModal(true)
  }

  // Calcula chance de aceitar proposta
  const calculateAcceptChance = () => {
    if (!selectedPlayer) return 0
    
    const currentSalary = selectedPlayer.contract?.salary || 50000
    const salaryRatio = proposedSalary / currentSalary
    const yearsBonus = proposedYears >= 3 ? 10 : proposedYears >= 2 ? 5 : 0
    
    // Base 50% + bonus por aumento salarial + bonus por anos
    let chance = 50
    if (salaryRatio >= 1.3) chance += 30
    else if (salaryRatio >= 1.2) chance += 20
    else if (salaryRatio >= 1.1) chance += 10
    else if (salaryRatio < 1) chance -= 30
    
    chance += yearsBonus
    
    // Moral do jogador afeta
    if (selectedPlayer.morale === "Feliz") chance += 10
    else if (selectedPlayer.morale === "Infeliz") chance -= 20
    
    return Math.max(0, Math.min(100, chance))
  }

  // Submete proposta
  const handleSubmitProposal = () => {
    if (!selectedPlayer) return
    
    setNegotiationStatus("negotiating")
    
    setTimeout(() => {
      const chance = calculateAcceptChance()
      const roll = Math.random() * 100
      
      if (roll < chance) {
        // Aceito!
        renewContract(selectedPlayer.id, proposedSalary, proposedYears * 52)
        setNegotiationStatus("accepted")
      } else {
        setNegotiationStatus("rejected")
      }
    }, 1500)
  }

  return (
    <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Gestao de Contratos</h1>
            <p className="text-sm text-white/50 mt-1">Renove e gerencie os contratos do elenco</p>
          </div>
        </div>

        {/* O EMPRESÁRIO ESTÁ ESPERANDO RESPOSTA.
            Fica no topo desta tela porque é aqui que o técnico resolve contrato —
            e porque ignorar tem preço: o silêncio desgasta MAIS que o "não". */}
        {pedidoDeAgente && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-5">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              {pedidoDeAgente.tipo === "renovacao" ? "Renovação"
                : pedidoDeAgente.tipo === "salario" ? "Pedido de aumento" : "Reclamação por minutagem"}
            </div>
            <p className="text-white">{pedidoDeAgente.fala}</p>
            {pedidoDeAgente.salarioPedido != null && (
              <p className="mt-2 text-sm text-white/60">
                Pede {formatCurrency(pedidoDeAgente.salarioPedido)}/mês
                {pedidoDeAgente.anosPedidos ? ` por ${pedidoDeAgente.anosPedidos} ano(s)` : ""}.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => responderAoAgente("aceito")}
                className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-bold text-[var(--brand-ink)] hover:opacity-90"
              >
                Aceitar
              </button>
              <button
                onClick={() => setConversaAberta(true)}
                className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/20"
              >
                Negociar
              </button>
              <button
                onClick={() => responderAoAgente("recusado")}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Recusar
              </button>
              <span className="self-center text-xs text-white/40">
                Sair da tela sem responder conta como silêncio — e desgasta mais que recusar.
              </span>
            </div>
          </div>
        )}

        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
              <Users className="h-4 w-4" />
              Elenco Total
            </div>
            <div className="text-2xl font-bold text-white">{squadPlayers.length}</div>
            <div className="text-xs text-white/40 mt-1">jogadores</div>
          </div>
          
          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-xs text-[#ffd700] mb-2">
              <AlertTriangle className="h-4 w-4" />
              Expirando
            </div>
            <div className="text-2xl font-bold text-[#ffd700]">{statusCounts.expiring}</div>
            <div className="text-xs text-white/40 mt-1">nos proximos 6 meses</div>
          </div>
          
          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-xs text-red-500 mb-2">
              <XCircle className="h-4 w-4" />
              Expirados
            </div>
            <div className="text-2xl font-bold text-red-500">{statusCounts.expired}</div>
            <div className="text-xs text-white/40 mt-1">livre no mercado</div>
          </div>
          
          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
              <DollarSign className="h-4 w-4" />
              Folha Salarial
            </div>
            <div className="text-2xl font-bold text-white">{formatCurrency(currentWages)}</div>
            <div className="text-xs text-white/40 mt-1">/ semana</div>
          </div>
        </div>

        {/* Lista de Contratos */}
        <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
          {/* Filtros */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2 text-xs font-medium text-white/60">
              <FileText className="h-4 w-4 text-[var(--brand)]" />
              CONTRATOS DO ELENCO
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter("all")}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  filter === "all" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
                )}
              >
                Todos ({squadPlayers.length})
              </button>
              <button
                onClick={() => setFilter("expiring")}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  filter === "expiring" ? "bg-[#ffd700]/20 text-[#ffd700]" : "text-white/50 hover:text-white/70"
                )}
              >
                Expirando ({statusCounts.expiring})
              </button>
              <button
                onClick={() => setFilter("expired")}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  filter === "expired" ? "bg-red-500/20 text-red-500" : "text-white/50 hover:text-white/70"
                )}
              >
                Expirados ({statusCounts.expired})
              </button>
            </div>
          </div>

          {/* Header da tabela */}
          <div className="grid grid-cols-[1fr_100px_120px_120px_100px_100px] gap-4 px-5 py-3 text-[10px] font-medium tracking-widest text-white/40 uppercase border-b border-white/[0.04] bg-white/[0.02]">
            <span>Jogador</span>
            <span>Posição</span>
            <span>Salario</span>
            <span>Expira em</span>
            <span>Status</span>
            <span>Acao</span>
          </div>

          {/* Lista */}
          <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
            {filteredPlayers.map(player => {
              const status = player.contractStatus
              
              return (
                <div
                  key={player.id}
                  className={cn(
                    "grid grid-cols-[1fr_100px_120px_120px_100px_100px] gap-4 px-5 py-4 items-center transition-colors hover:bg-white/[0.02]",
                    status === "expired" && "bg-red-500/5",
                    status === "expiring" && "bg-[#ffd700]/5"
                  )}
                >
                  {/* Jogador */}
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-sm font-bold text-white">
                      {player.overall}
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm">{player.name}</div>
                      <div className="text-xs text-white/50">{player.age} anos</div>
                    </div>
                  </div>

                  {/* Posicao */}
                  <div className="text-sm text-white/70">{player.position}</div>

                  {/* Salario */}
                  <div className="text-sm text-white/70">
                    {player.contract ? formatCurrency(salario.valor(player.contract.salary)) : "-"}
                    <span className="text-[10px] text-white/40">{salario.sufixo}</span>
                  </div>

                  {/* Expira em */}
                  <div className="text-sm">
                    {player.contract ? (
                      <div className="flex items-center gap-1">
                        <Clock className={cn(
                          "h-3 w-3",
                          status === "expired" ? "text-red-500" :
                          status === "expiring" ? "text-[#ffd700]" : "text-white/40"
                        )} />
                        <span className={cn(
                          status === "expired" ? "text-red-500" :
                          status === "expiring" ? "text-[#ffd700]" : "text-white/70"
                        )}>
                          {player.weeksRemaining <= 0 
                            ? "Expirado" 
                            : `${player.weeksRemaining} sem`
                          }
                        </span>
                      </div>
                    ) : "-"}
                  </div>

                  {/* Status */}
                  <div>
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-medium",
                      status === "ok" && "bg-[var(--brand)]/20 text-[var(--brand)]",
                      status === "expiring" && "bg-[#ffd700]/20 text-[#ffd700]",
                      status === "expired" && "bg-red-500/20 text-red-500"
                    )}>
                      {status === "ok" ? "Ativo" : status === "expiring" ? "Expirando" : "Expirado"}
                    </span>
                  </div>

                  {/* Acao */}
                  <div>
                    <button
                      onClick={() => handleOpenRenewal(player)}
                      className="px-3 py-1.5 rounded bg-[var(--brand)] text-[var(--brand-ink)] text-xs font-medium hover:bg-[var(--brand-2)] transition-colors"
                    >
                      Renovar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>


      {/* Modal de Renovacao */}
      {showRenewalModal && selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-[#0c0c10] border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
              <div className="flex items-center gap-3">
                <Handshake className="h-5 w-5 text-[var(--brand)]" />
                <span className="font-semibold text-white">Renovacao de Contrato</span>
              </div>
              <button
                onClick={() => setShowRenewalModal(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Conteudo */}
            <div className="p-6 space-y-6">
              {/* Info do jogador */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 flex items-center justify-center text-xl font-bold text-[var(--brand)]">
                  {selectedPlayer.overall}
                </div>
                <div>
                  <div className="font-semibold text-white text-lg">{selectedPlayer.name}</div>
                  <div className="text-sm text-white/50">{selectedPlayer.position} · {selectedPlayer.age} anos</div>
                  <div className="text-xs text-white/40 mt-1">
                    Salario atual: {salario.formatar(selectedPlayer.contract?.salary || 0)}
                  </div>
                </div>
              </div>

              {negotiationStatus === "idle" && (
                <>
                  {/* Proposta salarial */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-white/70">Proposta Salarial (por semana)</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={(selectedPlayer.contract?.salary || 50000) * 0.8}
                        max={(selectedPlayer.contract?.salary || 50000) * 2}
                        step={5000}
                        value={proposedSalary}
                        onChange={(e) => setProposedSalary(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-lg font-bold text-[var(--brand)] min-w-[120px] text-right">
                        {formatCurrency(proposedSalary)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/40">
                      <span>-20%</span>
                      <span className={cn(
                        "flex items-center gap-1",
                        proposedSalary > (selectedPlayer.contract?.salary || 0) ? "text-red-400" : "text-green-400"
                      )}>
                        {proposedSalary > (selectedPlayer.contract?.salary || 0) ? (
                          <><ArrowUpRight className="h-3 w-3" /> Aumento</>
                        ) : (
                          <><ArrowDownRight className="h-3 w-3" /> Reducao</>
                        )}
                      </span>
                      <span>+100%</span>
                    </div>
                  </div>

                  {/* Duracao */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-white/70">Duracao do Contrato</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map(years => (
                        <button
                          key={years}
                          onClick={() => setProposedYears(years)}
                          className={cn(
                            "py-3 rounded-lg text-sm font-medium transition-colors",
                            proposedYears === years
                              ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                              : "bg-white/5 text-white/70 hover:bg-white/10"
                          )}
                        >
                          {years} {years === 1 ? "ano" : "anos"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chance de aceitar */}
                  <div className="p-4 rounded-xl bg-white/5 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Chance de aceitar</span>
                      <span className={cn(
                        "font-bold",
                        calculateAcceptChance() >= 70 ? "text-[var(--brand)]" :
                        calculateAcceptChance() >= 40 ? "text-[#ffd700]" : "text-red-500"
                      )}>
                        {calculateAcceptChance()}%
                      </span>
                    </div>
                    <Progress value={calculateAcceptChance()} className="h-2" />
                  </div>
                </>
              )}

              {negotiationStatus === "negotiating" && (
                <div className="text-center py-8">
                  <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-white/5 animate-pulse flex items-center justify-center">
                    <Handshake className="h-6 w-6 text-white/40" />
                  </div>
                  <div className="text-white/70">Negociando com o jogador...</div>
                </div>
              )}

              {negotiationStatus === "accepted" && (
                <div className="text-center py-8">
                  <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-[var(--brand)]/20 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-[var(--brand)]" />
                  </div>
                  <div className="text-[var(--brand)] font-semibold text-lg">Contrato Renovado!</div>
                  <div className="text-white/50 text-sm mt-2">
                    {selectedPlayer.name} assinou por mais {proposedYears} {proposedYears === 1 ? "ano" : "anos"}
                  </div>
                </div>
              )}

              {negotiationStatus === "rejected" && (
                <div className="text-center py-8">
                  <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="text-red-500 font-semibold text-lg">Proposta Recusada</div>
                  <div className="text-white/50 text-sm mt-2">
                    O jogador nao ficou satisfeito com a proposta. Tente novamente com valores melhores.
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.04]">
              {negotiationStatus === "idle" && (
                <>
                  <button
                    onClick={() => setShowRenewalModal(false)}
                    className="px-4 py-2 rounded-lg text-white/60 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmitProposal}
                    className="px-6 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-ink)] font-semibold hover:bg-[var(--brand-2)] transition-colors"
                  >
                    Enviar Proposta
                  </button>
                </>
              )}
              {(negotiationStatus === "accepted" || negotiationStatus === "rejected") && (
                <button
                  onClick={() => setShowRenewalModal(false)}
                  className="px-6 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* A conversa com o empresario — o meio entre aceitar e recusar. */}
      {estadoDoAgente && (
        <ConversaAgente
          aberto={conversaAberta}
          onFechar={() => setConversaAberta(false)}
          estado={estadoDoAgente}
          onDesfecho={aplicarDesfechoDaConversa}
        />
      )}
    </div>
  )
}
