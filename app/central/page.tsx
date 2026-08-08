"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Heart, 
  MessageSquare, 
  Users, 
  TrendingUp, 
  TrendingDown,
  Smile,
  Meh,
  Frown,
  Mail,
  Clock,
  ChevronRight,
  Star,
  AlertCircle,
  CheckCircle2,
  FileText,
  Calendar,
  Zap,
  Shield,
  AlertTriangle,
  Crown,
  Gavel
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatarCircle } from "@/components/player-avatar"
import { Button } from "@/components/ui/button"
import { RandomEvents } from "@/components/random-events"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { aplicarPunicao, punicoesSugeridas, rotuloPunicao } from "@/lib/punicoes"
import { lerTorcida } from "@/lib/pressao-torcida"
import type { DisciplinePunishment } from "@/lib/game-engine"
import { useGameEngine } from "@/lib/game-engine"

type TabType = "vestiario" | "reunioes" | "mensagens" | "contratos" | "eventos" | "disciplina"

// Converte a moral (enum do engine) para 0-100, usado nas barras e nas cores da tela.
const MORALE_SCORE: Record<string, number> = {
  Feliz: 92, Motivado: 82, Normal: 66, Insatisfeito: 48, Infeliz: 28,
}

const meetings = [
  { type: "individual", player: "Lincoln", topic: "Renovacao de contrato", status: "pendente" },
  { type: "coletiva", topic: "Preparacao para o classico", status: "agendada", date: "Amanha, 10h" },
  { type: "individual", player: "Helinho", topic: "Moral baixa", status: "urgente" },
]

const messages = [
  { from: "Diretoria", subject: "Meta de classificacao", time: "2h atras", unread: true },
  { from: "Agente - Lincoln", subject: "Proposta de renovacao", time: "5h atras", unread: true },
  { from: "Imprensa", subject: "Solicitacao de entrevista", time: "1 dia", unread: false },
  { from: "Olheiro", subject: "Relatorio - Jovem promessa", time: "2 dias", unread: false },
]

// contracts / disciplineIssues / playerHierarchy eram listas FIXAS com nomes do RB
// Bragantino (elenco-exemplo). Por isso a central mostrava "dados do Bragantino"
// para qualquer time. Agora sao DERIVADAS do elenco real do usuario (squadPlayers)
// dentro do componente — ver os useMemo abaixo.

export default function CentralPage() {
  const router = useRouter()

  // Gamepad support
  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (btn === 'B') router.back()
    }
    window.addEventListener('gamepad:button', handler)
    return () => window.removeEventListener('gamepad:button', handler)
  }, [router])
  const { state } = useGameState()
  const { team: userTeam } = useUserTeam()
  const { squadPlayers } = useGameEngine()
  const [activeTab, setActiveTab] = useState<TabType>("vestiario")

  // Moral REAL do elenco (vem do seu save, nao mais uma lista fixa). A tendencia sai da
  // forma do jogador: em alta joga bem e sobe a moral; em baixa, cai.
  const playerMorale = useMemo(
    () =>
      (squadPlayers ?? []).map((p) => ({
        name: p.name,
        position: p.position,
        morale: MORALE_SCORE[p.morale] ?? 66,
        trend: p.form >= 70 ? "up" : p.form <= 45 ? "down" : "stable",
        label: p.morale,
      })),
    [squadPlayers],
  )

  // Semana absoluta aproximada, para estimar quanto falta de contrato. Nao precisa
  // ser exata: o que importa e usar os jogadores e salarios REAIS do elenco.
  const currentAbsWeek = ((state.season ?? 2026) - 2026) * 46 + (state.week ?? 0)

  // CONTRATOS reais: jogadores do elenco com contrato, ordenados pelo que vence
  // primeiro. Salario e overall saem do jogador de verdade.
  const contracts = useMemo(() => {
    const fmtSalary = (weekly: number) => `R$ ${Math.round((weekly || 0) * 4.33).toLocaleString("pt-BR")}`
    return (squadPlayers ?? [])
      .filter((p) => p.contract)
      .map((p) => {
        const weeksLeft = Math.max(0, (p.contract!.endDate ?? currentAbsWeek) - currentAbsWeek)
        const monthsLeft = Math.round(weeksLeft / 4.33)
        const status = monthsLeft <= 3 ? "critico" : monthsLeft <= 9 ? "expirando" : "ok"
        const endsIn = monthsLeft <= 0 ? "Expirado"
          : monthsLeft < 12 ? `${monthsLeft} ${monthsLeft === 1 ? "mes" : "meses"}`
          : `${Math.round(monthsLeft / 12)} ${monthsLeft >= 24 ? "anos" : "ano"}`
        return { name: p.name, position: p.position, overall: p.overall, salary: fmtSalary(p.contract!.salary), endsIn, status, monthsLeft }
      })
      .sort((a, b) => a.monthsLeft - b.monthsLeft)
      .slice(0, 6)
  }, [squadPlayers, currentAbsWeek])

  // HIERARQUIA real: os de maior overall lideram; idade define o papel. Influencia
  // e respeito saem do overall/idade/moral do proprio atleta.
  const playerHierarchy = useMemo(() => {
    const squad = [...(squadPlayers ?? [])].sort((a, b) => b.overall - a.overall)
    return squad.slice(0, 6).map((p, i) => ({
      name: p.name,
      role: i === 0 ? "capitao" : i === 1 ? "vice_capitao" : p.age >= 30 ? "veterano" : p.age <= 21 ? "jovem" : "referencia",
      influence: Math.max(30, Math.min(99, p.overall + (p.age >= 30 ? 6 : 0) - i * 2)),
      respect: Math.max(30, Math.min(99, p.overall + (p.morale === "Feliz" || p.morale === "Motivado" ? 5 : p.morale === "Insatisfeito" || p.morale === "Infeliz" ? -8 : 0))),
    }))
  }, [squadPlayers])

  // DISCIPLINA/vestiario: derivada dos atletas realmente insatisfeitos, em vez de
  // uma lista fixa. Elenco feliz => nenhum problema (a aba mostra o estado vazio).
  const disciplineIssues = useMemo(
    () =>
      (squadPlayers ?? [])
        .filter((p) => p.morale === "Insatisfeito" || p.morale === "Infeliz")
        .slice(0, 4)
        .map((p, i) => ({
          id: i + 1,
          player: p.name,
          type: "discussao_vestiario",
          date: "Recente",
          severity: p.morale === "Infeliz" ? "moderada" : "leve",
          resolved: false,
          punishment: undefined as string | undefined,
        })),
    [squadPlayers],
  )

  // Leitura da torcida a partir das organizadas do save. Semana entra para a
  // frase não trocar a cada render.
  const torcida = useMemo(
    () => lerTorcida(state.torcidaOrganizadas, state.week ?? 0),
    [state.torcidaOrganizadas, state.week],
  )

  // PUNIÇÃO. O botão "Punir" existia e não fazia nada; o catálogo
  // (DISCIPLINE_PUNISHMENTS) existia e ninguém aplicava. Aqui os dois se
  // encontram: escolher a punição, ver o efeito e — o que dá peso à decisão —
  // ouvir a resposta do atleta, que pode se revoltar se a pena for exagerada.
  const [punindo, setPunindo] = useState<string | null>(null)
  const [punidos, setPunidos] = useState<Record<string, { rotulo: string; resposta: string; revoltado: boolean }>>({})

  const confirmarPunicao = (nomeAtleta: string, punicao: DisciplinePunishment, gravidade: "leve" | "moderada" | "grave") => {
    const atleta = (squadPlayers ?? []).find((p) => p.name === nomeAtleta)
    const salarioSemanal = Math.max(1000, Math.round(atleta?.contract?.salary ?? 40000))
    const efeito = aplicarPunicao(punicao, gravidade, salarioSemanal)
    setPunidos((atual) => ({
      ...atual,
      [nomeAtleta]: {
        rotulo: rotuloPunicao(punicao, salarioSemanal),
        resposta: efeito.resposta,
        revoltado: efeito.revoltado,
      },
    }))
    setPunindo(null)
  }

  const tabs = [
    { id: "vestiario" as TabType, label: "Vestiario", icon: Heart, count: null },
    { id: "eventos" as TabType, label: "Eventos", icon: Zap, count: 2 },
    { id: "disciplina" as TabType, label: "Disciplina", icon: Gavel, count: disciplineIssues.filter(d => !d.resolved).length },
    { id: "reunioes" as TabType, label: "Reunioes", icon: Users, count: meetings.filter(m => m.status === "urgente").length },
    { id: "mensagens" as TabType, label: "Mensagens", icon: Mail, count: messages.filter(m => m.unread).length },
    { id: "contratos" as TabType, label: "Contratos", icon: FileText, count: contracts.filter(c => c.status === "critico").length },
  ]

  const getMoraleIcon = (morale: number) => {
    if (morale >= 80) return <Smile className="h-4 w-4 text-green-400" />
    if (morale >= 60) return <Meh className="h-4 w-4 text-yellow-400" />
    return <Frown className="h-4 w-4 text-red-400" />
  }

  const getMoraleColor = (morale: number) => {
    if (morale >= 80) return "text-green-400"
    if (morale >= 60) return "text-yellow-400"
    return "text-red-400"
  }

  const averageMorale = playerMorale.length
    ? Math.round(playerMorale.reduce((acc, p) => acc + p.morale, 0) / playerMorale.length)
    : 0

  return (
    <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameHeader team={userTeam} />
      
      <main className="flex-1 p-4 md:p-6 overflow-y-auto pb-20">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <TeamCrest team={userTeam} size="lg" />
          <div>
            <h1 className="text-2xl font-bold text-white">Central do Clube</h1>
            <p className="text-sm text-white/50">{userTeam.nome}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {/* ⚠️ ERA `{tab.count && tab.count > 0 && (...)}`. Com count = 0 a
                  expressao vale 0, e o React DESENHA o zero: a aba aparecia
                  escrita "Contratos0". Testar so o maior que zero devolve
                  `false`, que o React ignora. */}
              {(tab.count ?? 0) > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  activeTab === tab.id ? "bg-black/20 text-black" : "bg-red-500 text-white"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === "vestiario" && (
            <motion.div
              key="vestiario"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* TORCIDA. O número já era calculado (lib/torcida via
                  use-game-manager) e alimentava o quadro de sócios — mas nunca
                  aparecia em tela nenhuma. Aqui ele finalmente é visível, ao
                  lado da moral do elenco, que é o outro medidor de humor. */}
              <div className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4" style={{ color: torcida.cor }} />
                    <div>
                      <div className="text-sm font-medium text-white">
                        Torcida: <span style={{ color: torcida.cor }}>{torcida.rotulo}</span>
                      </div>
                      <div className="text-[11px] italic text-white/40">{torcida.recado}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-black" style={{ color: torcida.cor }}>{torcida.satisfacao}</div>
                      <div className="text-[10px] uppercase tracking-wider text-white/35">satisfação</div>
                    </div>
                    <div className="text-right">
                      <div className={cn("text-lg font-black", torcida.pressaoEmCasa >= 0 ? "text-[var(--brand)]" : "text-red-400")}>
                        {torcida.pressaoEmCasa >= 0 ? "+" : ""}{torcida.pressaoEmCasa}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-white/35">no estádio</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full transition-all"
                       style={{ width: `${torcida.satisfacao}%`, backgroundColor: torcida.cor }} />
                </div>
              </div>

              {/* Team Morale Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="stat-card stat-card-teal">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/50">Moral do Elenco</span>
                    {getMoraleIcon(averageMorale)}
                  </div>
                  <div className={cn("text-3xl font-black", getMoraleColor(averageMorale))}>
                    {averageMorale}%
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">Media geral do plantel</p>
                </div>
                
                <div className="stat-card stat-card-green">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/50">Jogadores Felizes</span>
                    <Smile className="h-4 w-4 text-green-400" />
                  </div>
                  <div className="text-3xl font-black text-green-400">
                    {playerMorale.filter(p => p.morale >= 80).length}
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">de {playerMorale.length} jogadores</p>
                </div>
                
                <div className="stat-card stat-card-amber">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/50">Atencao Necessaria</span>
                    <AlertCircle className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="text-3xl font-black text-orange-400">
                    {/* ⚠️ O CORTE ERA 70, e "Normal" vale 66 na escala
                        (MORAL: Feliz 92, Motivado 82, Normal 66, Insatisfeito
                        48, Infeliz 28). Um elenco inteiramente NORMAL era
                        contado como 27 atletas "com moral baixa", contradizendo
                        a propria lista logo abaixo, que os rotulava Normal. O
                        corte agora e 60 — a mesma fronteira que `getMoraleColor`
                        ja usava para pintar de amarelo. */}
                    {playerMorale.filter(p => p.morale < 60).length}
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">jogadores com moral baixa</p>
                </div>
              </div>

              {/* Player List */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/[0.04]">
                <h3 className="text-sm font-semibold text-white mb-4">Moral Individual</h3>
                <div className="space-y-2">
                  {playerMorale.length === 0 && (
                    <p className="text-xs text-white/40 py-6 text-center">Carregando elenco...</p>
                  )}
                  {playerMorale.map((player, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                      <PlayerAvatarCircle name={player.name} teamColor={userTeam.cor1} fileKey={userTeam.file_key} position={player.position} size="sm" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{player.name}</div>
                        <div className="text-[10px] text-white/40">{player.position}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {player.trend === "up" && <TrendingUp className="h-3 w-3 text-green-400" />}
                        {player.trend === "down" && <TrendingDown className="h-3 w-3 text-red-400" />}
                        <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all",
                              player.morale >= 80 ? "bg-green-500" : player.morale >= 60 ? "bg-[#ffd700]" : "bg-red-500"
                            )}
                            style={{ width: `${player.morale}%` }}
                          />
                        </div>
                        <span className={cn("text-xs font-bold text-right whitespace-nowrap", getMoraleColor(player.morale))}>
                          {player.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "reunioes" && (
            <motion.div
              key="reunioes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="p-4 rounded-xl bg-white/5 border border-white/[0.04]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Reunioes Pendentes</h3>
                  <Button size="sm" className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)] text-xs">
                    Agendar Reuniao
                  </Button>
                </div>
                <div className="space-y-2">
                  {meetings.map((meeting, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center",
                        meeting.type === "individual" ? "bg-blue-500/20" : "bg-purple-500/20"
                      )}>
                        {meeting.type === "individual" ? (
                          <MessageSquare className="h-5 w-5 text-blue-400" />
                        ) : (
                          <Users className="h-5 w-5 text-purple-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{meeting.topic}</div>
                        <div className="text-[10px] text-white/40">
                          {meeting.player ? `Com ${meeting.player}` : meeting.date}
                        </div>
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded-md text-[10px] font-semibold",
                        meeting.status === "urgente" ? "bg-red-500/20 text-red-400" :
                        meeting.status === "pendente" ? "bg-[#ffd700]/20 text-yellow-400" :
                        "bg-green-500/20 text-green-400"
                      )}>
                        {meeting.status}
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/30" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "mensagens" && (
            <motion.div
              key="mensagens"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="p-4 rounded-xl bg-white/5 border border-white/[0.04]">
                <h3 className="text-sm font-semibold text-white mb-4">Caixa de Entrada</h3>
                <div className="space-y-2">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer",
                      msg.unread ? "bg-[var(--brand)]/10 hover:bg-[var(--brand)]/15" : "bg-white/[0.03] hover:bg-white/[0.06]"
                    )}>
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center",
                        msg.unread ? "bg-[var(--brand)]/20" : "bg-white/10"
                      )}>
                        <Mail className={cn("h-5 w-5", msg.unread ? "text-[var(--brand)]" : "text-white/40")} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-medium", msg.unread ? "text-white" : "text-white/70")}>
                            {msg.from}
                          </span>
                          {msg.unread && <div className="h-2 w-2 rounded-full bg-[var(--brand)]" />}
                        </div>
                        <div className="text-[11px] text-white/50">{msg.subject}</div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/40">
                        <Clock className="h-3 w-3" />
                        {msg.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "contratos" && (
            <motion.div
              key="contratos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="p-4 rounded-xl bg-white/5 border border-white/[0.04]">
                <h3 className="text-sm font-semibold text-white mb-4">Contratos Proximos do Vencimento</h3>
                <div className="space-y-2">
                  {contracts.map((contract, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                      <PlayerAvatarCircle name={contract.name} teamColor={userTeam.cor1} fileKey={userTeam.file_key} position={contract.position} size="sm" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{contract.name}</span>
                          <span className="text-[10px] text-white/40 px-1.5 py-0.5 rounded bg-white/10">{contract.position}</span>
                          <span className="text-xs font-bold text-[var(--brand)]">{contract.overall}</span>
                        </div>
                        <div className="text-[10px] text-white/40">Salario: {contract.salary}/mes</div>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "text-xs font-semibold",
                          contract.status === "critico" ? "text-red-400" :
                          contract.status === "expirando" ? "text-yellow-400" : "text-white/60"
                        )}>
                          {contract.endsIn}
                        </div>
                        <div className="text-[10px] text-white/40">ate o fim</div>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs border-white/10 hover:bg-white/10">
                        Renovar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "eventos" && (
            <motion.div
              key="eventos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <RandomEvents />
            </motion.div>
          )}

          {activeTab === "disciplina" && (
            <motion.div
              key="disciplina"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Hierarquia do Vestiario */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/[0.04]">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-400" />
                  Hierarquia do Vestiario
                </h3>
                <div className="space-y-2">
                  {playerHierarchy.map((player, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                      <div className="relative">
                        {/* A hierarquia do vestiario nao carrega posicao — so nome,
                            papel e influencia. Sem `position` o avatar cai nas
                            iniciais, que aqui e o certo. */}
                        <PlayerAvatarCircle name={player.name} teamColor={userTeam.cor1} fileKey={userTeam.file_key} size="sm" />
                        {player.role === "capitao" && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                            <span className="text-[8px] font-black text-black">C</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{player.name}</span>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            player.role === "capitao" ? "bg-amber-400/20 text-amber-400" :
                            player.role === "vice_capitao" ? "bg-amber-400/10 text-amber-300" :
                            player.role === "veterano" ? "bg-blue-400/20 text-blue-400" :
                            player.role === "referencia" ? "bg-purple-400/20 text-purple-400" :
                            "bg-white/10 text-white/60"
                          )}>
                            {player.role === "capitao" ? "Capitao" :
                             player.role === "vice_capitao" ? "Vice-Capitao" :
                             player.role === "veterano" ? "Veterano" :
                             player.role === "referencia" ? "Referencia" : "Jovem"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="flex items-center gap-1 text-[10px] text-white/40">
                            <Users className="h-3 w-3" />
                            Influencia: <span className="text-white/70">{player.influence}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-white/40">
                            <Shield className="h-3 w-3" />
                            Respeito: <span className="text-white/70">{player.respect}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Questoes Disciplinares */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/[0.04]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    Questoes Disciplinares
                  </h3>
                </div>
                {disciplineIssues.length === 0 ? (
                  <div className="p-6 text-center">
                    <CheckCircle2 className="h-10 w-10 mx-auto text-[var(--brand)]/40 mb-2" />
                    <p className="text-sm text-white/50">Nenhum problema disciplinar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {disciplineIssues.map((issue) => (
                      <div key={issue.id} className={cn(
                        "flex items-center gap-3 p-3 rounded-lg transition-colors",
                        issue.resolved ? "bg-white/[0.02] opacity-60" : "bg-red-500/10 border border-red-500/20"
                      )}>
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center",
                          issue.severity === "grave" ? "bg-red-500/20" :
                          issue.severity === "moderada" ? "bg-amber-500/20" : "bg-[#ffd700]/20"
                        )}>
                          <AlertTriangle className={cn(
                            "h-5 w-5",
                            issue.severity === "grave" ? "text-red-400" :
                            issue.severity === "moderada" ? "text-amber-400" : "text-yellow-400"
                          )} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{issue.player}</span>
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-medium",
                              issue.severity === "grave" ? "bg-red-500/20 text-red-400" :
                              issue.severity === "moderada" ? "bg-amber-500/20 text-amber-400" :
                              "bg-[#ffd700]/20 text-yellow-400"
                            )}>
                              {issue.severity}
                            </span>
                          </div>
                          <div className="text-[10px] text-white/40">
                            {issue.type === "atraso_treino" ? "Atraso no treino" :
                             issue.type === "falta_treino" ? "Falta no treino" :
                             issue.type === "discussao_vestiario" ? "Discussao no vestiario" :
                             issue.type === "desrespeito_tecnico" ? "Desrespeito ao tecnico" :
                             "Problema extracampo"} - {issue.date}
                          </div>
                        </div>
                        {punidos[issue.player] ? (
                          <div className="flex flex-col items-end gap-1 max-w-[46%]">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-[var(--brand)]" />
                              <span className="text-xs text-white/50">{punidos[issue.player].rotulo}</span>
                            </div>
                            <p className={cn(
                              "text-[10px] leading-4 text-right italic",
                              punidos[issue.player].revoltado ? "text-red-300" : "text-white/40",
                            )}>
                              "{punidos[issue.player].resposta}"
                            </p>
                          </div>
                        ) : (
                          <Button
                            size="sm" variant="outline"
                            onClick={() => setPunindo(issue.player)}
                            className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                          >
                            <Gavel className="h-3 w-3 mr-1" />
                            Punir
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Escolha da punição. As opções variam com a gravidade — punir de leve uma
          falta grave passa fraqueza; exagerar numa leve gera revolta. */}
      {punindo && (() => {
        const caso = disciplineIssues.find((i) => i.player === punindo)
        const gravidade = (caso?.severity ?? "leve") as "leve" | "moderada" | "grave"
        const atleta = (squadPlayers ?? []).find((p) => p.name === punindo)
        const salarioSemanal = Math.max(1000, Math.round(atleta?.contract?.salary ?? 40000))
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-5 backdrop-blur-md"
               onClick={() => setPunindo(null)}>
            <section className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/25 bg-[#0b1014]"
                     onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-white/10 bg-gradient-to-r from-red-500/15 to-transparent px-6 py-5">
                <p className="text-[11px] font-black uppercase tracking-[.22em] text-red-300">Punição</p>
                <h2 className="mt-1 text-xl font-black text-white">{punindo}</h2>
                <p className="mt-1 text-sm text-white/55">
                  Infração {gravidade} · salário semanal R$ {salarioSemanal.toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="space-y-2 px-6 py-5">
                {punicoesSugeridas(gravidade).map((p) => (
                  <button
                    key={p}
                    onClick={() => confirmarPunicao(punindo, p, gravidade)}
                    className="flex w-full items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-left text-sm text-white transition-colors hover:bg-white/10"
                  >
                    <span>{rotuloPunicao(p, salarioSemanal)}</span>
                    <Gavel className="h-4 w-4 shrink-0 text-white/30" />
                  </button>
                ))}
                <p className="pt-2 text-xs leading-5 text-white/35">
                  Punição desproporcional à infração derruba a moral e faz o elenco
                  ver injustiça — o respeito cai em vez de subir.
                </p>
                <button onClick={() => setPunindo(null)}
                        className="mt-2 w-full rounded-lg bg-white/10 py-2.5 text-sm font-semibold text-white/75 hover:bg-white/15">
                  Deixar passar
                </button>
              </div>
            </section>
          </div>
        )
      })()}
    </div>
  )
}
