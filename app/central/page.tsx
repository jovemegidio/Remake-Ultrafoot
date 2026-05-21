"use client"

import { useState } from "react"
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
  Calendar
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatarCircle } from "@/components/player-avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"

type TabType = "vestiario" | "reunioes" | "mensagens" | "contratos"

// Mock data
const playerMorale = [
  { name: "Eduardo Sasha", position: "ATA", morale: 92, trend: "up" },
  { name: "Lincoln", position: "MEI", morale: 88, trend: "up" },
  { name: "Eric Ramires", position: "MEI", morale: 85, trend: "stable" },
  { name: "Helinho", position: "PE", morale: 78, trend: "down" },
  { name: "Cleiton", position: "GOL", morale: 82, trend: "stable" },
  { name: "Pedro Henrique", position: "ZAG", morale: 80, trend: "up" },
]

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

const contracts = [
  { name: "Lincoln", position: "MEI", overall: 78, endsIn: "6 meses", salary: "R$ 180.000", status: "expirando" },
  { name: "Helinho", position: "PE", overall: 75, endsIn: "1 ano", salary: "R$ 120.000", status: "ok" },
  { name: "Estevao", position: "MD", overall: 79, endsIn: "3 meses", salary: "R$ 250.000", status: "critico" },
]

export default function CentralPage() {
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const [activeTab, setActiveTab] = useState<TabType>("vestiario")

  const tabs = [
    { id: "vestiario" as TabType, label: "Vestiario", icon: Heart, count: null },
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

  const averageMorale = Math.round(playerMorale.reduce((acc, p) => acc + p.morale, 0) / playerMorale.length)

  return (
    <div className="h-screen pl-16 bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GameSidebar />
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
                  ? "bg-[#1db954] text-black"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count && tab.count > 0 && (
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
              {/* Team Morale Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/50">Moral do Elenco</span>
                    {getMoraleIcon(averageMorale)}
                  </div>
                  <div className={cn("text-3xl font-black", getMoraleColor(averageMorale))}>
                    {averageMorale}%
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">Media geral do plantel</p>
                </div>
                
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/50">Jogadores Felizes</span>
                    <Smile className="h-4 w-4 text-green-400" />
                  </div>
                  <div className="text-3xl font-black text-green-400">
                    {playerMorale.filter(p => p.morale >= 80).length}
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">de {playerMorale.length} jogadores</p>
                </div>
                
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/50">Atencao Necessaria</span>
                    <AlertCircle className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="text-3xl font-black text-orange-400">
                    {playerMorale.filter(p => p.morale < 70).length}
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">jogadores com moral baixa</p>
                </div>
              </div>

              {/* Player List */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <h3 className="text-sm font-semibold text-white mb-4">Moral Individual</h3>
                <div className="space-y-2">
                  {playerMorale.map((player, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                      <PlayerAvatarCircle name={player.name} teamColor={userTeam.cor1} size="sm" />
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
                              player.morale >= 80 ? "bg-green-500" : player.morale >= 60 ? "bg-yellow-500" : "bg-red-500"
                            )}
                            style={{ width: `${player.morale}%` }}
                          />
                        </div>
                        <span className={cn("text-xs font-bold w-8 text-right", getMoraleColor(player.morale))}>
                          {player.morale}
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
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Reunioes Pendentes</h3>
                  <Button size="sm" className="bg-[#1db954] text-black hover:bg-[#1ed760] text-xs">
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
                        meeting.status === "pendente" ? "bg-yellow-500/20 text-yellow-400" :
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
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <h3 className="text-sm font-semibold text-white mb-4">Caixa de Entrada</h3>
                <div className="space-y-2">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer",
                      msg.unread ? "bg-[#1db954]/10 hover:bg-[#1db954]/15" : "bg-white/[0.03] hover:bg-white/[0.06]"
                    )}>
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center",
                        msg.unread ? "bg-[#1db954]/20" : "bg-white/10"
                      )}>
                        <Mail className={cn("h-5 w-5", msg.unread ? "text-[#1db954]" : "text-white/40")} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-medium", msg.unread ? "text-white" : "text-white/70")}>
                            {msg.from}
                          </span>
                          {msg.unread && <div className="h-2 w-2 rounded-full bg-[#1db954]" />}
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
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <h3 className="text-sm font-semibold text-white mb-4">Contratos Proximos do Vencimento</h3>
                <div className="space-y-2">
                  {contracts.map((contract, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                      <PlayerAvatarCircle name={contract.name} teamColor={userTeam.cor1} size="sm" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{contract.name}</span>
                          <span className="text-[10px] text-white/40 px-1.5 py-0.5 rounded bg-white/10">{contract.position}</span>
                          <span className="text-xs font-bold text-[#1db954]">{contract.overall}</span>
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
        </AnimatePresence>
      </main>
    </div>
  )
}
