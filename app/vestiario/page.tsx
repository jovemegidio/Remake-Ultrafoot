"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { usePaginacao, Paginador } from "@/components/lista-paginada"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users,
  Heart,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Star,
  Smile,
  Frown,
  Meh,
  Shield,
  Trophy,
  UserPlus,
  UserMinus,
  Siren,
  Handshake,
  ChevronRight,
  Clock,
  Calendar
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useUserTeam } from "@/lib/time-da-carreira"
import { useGameEngine } from "@/lib/game-engine"
import { buildConversation, resolveChoice, type ConvTone } from "@/lib/player-conversation"
import { analyseSquadDynamics, roleLabel } from "@/lib/squad-dynamics"

// Acoes de grupo
const GROUP_ACTIONS = [
  {
    id: "team_meeting",
    icon: Users,
    label: "Reuniao de Equipe",
    description: "Conversar com todo o grupo sobre objetivos",
    cooldown: 4,
    impact: 5
  },
  {
    id: "team_dinner",
    icon: Handshake,
    label: "Jantar em Grupo",
    description: "Atividade social para unir o elenco",
    cooldown: 8,
    impact: 8
  },
  {
    id: "captain_talk",
    icon: Shield,
    label: "Conversa com Capitao",
    description: "Pedir ao capitao para liderar o vestiario",
    cooldown: 2,
    impact: 3
  },
  {
    id: "day_off",
    icon: Calendar,
    label: "Folga Extra",
    description: "Dar um dia de descanso ao grupo",
    cooldown: 6,
    impact: 6
  }
]

const getMoralIcon = (moral: string) => {
  switch (moral) {
    case "Feliz": return Smile
    case "Motivado": return TrendingUp
    case "Normal": return Meh
    case "Insatisfeito": return Frown
    case "Infeliz": return Frown
    default: return Meh
  }
}

const getMoralColor = (moral: string) => {
  switch (moral) {
    case "Feliz": return "text-green-400"
    case "Motivado": return "text-lime-400"
    case "Normal": return "text-yellow-400"
    case "Insatisfeito": return "text-orange-400"
    case "Infeliz": return "text-red-400"
    default: return "text-white/50"
  }
}

const getEventIcon = (type: string) => {
  switch (type) {
    case "vitoria": return Trophy
    case "derrota": return TrendingDown
    case "empate": return Meh
    case "titulo": return Trophy
    case "contratacao": return UserPlus
    case "venda": return UserMinus
    case "lesao": return Siren
    case "conflito": return AlertTriangle
    case "elogio": return Star
    default: return MessageCircle
  }
}

export default function VestiarioPage() {
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
  const { team: userTeam } = useUserTeam()
  const gameEngine = useGameEngine()
  
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [showConversation, setShowConversation] = useState(false)
  const [conversationResult, setConversationResult] = useState<{ success: boolean; message: string } | null>(null)
  const { squadPlayers, squadMorale, addMoraleEvent, currentWeek, groupActionCooldowns, performGroupAction } = gameEngine

  // ⚠️ SAVE ANTIGO NAO TEM ESTE CAMPO, E A TELA INTEIRA CAI.
  //
  // `squadMorale.recentEvents` nasceu depois de muita carreira ja existir. Em
  // quem salvou antes dele, isto e `undefined`, e o `events.length` la embaixo
  // derruba a tela com "Cannot read properties of undefined" — sem mensagem que
  // ajude, so o vestiario em branco. O `migrate` do save NAO alcanca objeto
  // aninhado, entao a defesa mora no ponto de leitura. Achado pela auditoria de
  // telas (qa:audit), que injeta justamente um save sem o campo.
  const events = squadMorale?.recentEvents ?? []
  // 6 por pagina: caixa de ~560px dividida pelo item de ~95px desta lista.
  const paginaDeEventos = usePaginacao(events, 6)
  const dynamics = useMemo(() => analyseSquadDynamics(squadPlayers), [squadPlayers])
  const dynamicsByPlayer = useMemo(
    () => new Map(dynamics.players.map(item => [item.playerId, item])),
    [dynamics],
  )

  // Agrupar jogadores por moral
  const playersByMorale = useMemo(() => {
    const groups: Record<string, typeof squadPlayers> = {
      Feliz: [],
      Motivado: [],
      Normal: [],
      Insatisfeito: [],
      Infeliz: []
    }
    
    squadPlayers.forEach(player => {
      const moral = player.morale || "Normal"
      if (groups[moral]) {
        groups[moral].push(player)
      }
    })
    
    return groups
  }, [squadPlayers])

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null
    return squadPlayers.find(p => p.id === selectedPlayerId)
  }, [selectedPlayerId, squadPlayers])

  // CONVERSA CONTEXTUAL: o tema e a abertura do jogador saem da situação dele
  // (tempo de jogo, forma, moral, idade). Ver lib/player-conversation.
  const conversation = useMemo(() => {
    if (!selectedPlayer) return null
    return buildConversation({
      name: selectedPlayer.name,
      age: selectedPlayer.age,
      morale: selectedPlayer.morale,
      form: selectedPlayer.form,
      isStarter: selectedPlayer.isStarter,
      lastRating: selectedPlayer.lastMatchRating,
      persona: selectedPlayer.persona?.rotulo,
    })
  }, [selectedPlayer])

  // Executar conversa com jogador — resolve o desfecho pelo TOM escolhido e
  // aplica a variação de moral (mapeando o delta em "degraus" da escala de moral).
  const handleConversation = (tone: ConvTone) => {
    if (!selectedPlayer || !conversation) return
    const outcome = resolveChoice(
      {
        name: selectedPlayer.name, age: selectedPlayer.age, morale: selectedPlayer.morale,
        form: selectedPlayer.form, isStarter: selectedPlayer.isStarter,
        lastRating: selectedPlayer.lastMatchRating, persona: selectedPlayer.persona?.rotulo,
      },
      conversation,
      tone,
    )
    // delta (~-8..+8) -> degraus (-2..+2) na escala Infeliz..Feliz.
    const degraus = outcome.moraleChange >= 5 ? 2 : outcome.moraleChange > 0 ? 1
      : outcome.moraleChange <= -5 ? -2 : outcome.moraleChange < 0 ? -1 : 0
    if (degraus !== 0) gameEngine.ajustarMoralJogador(selectedPlayer.id, degraus)

    addMoraleEvent({
      type: outcome.positive ? "elogio" : "conflito",
      description: `Conversa com ${selectedPlayer.name} (${conversation.topicLabel})`,
      impact: outcome.moraleChange,
    })

    setConversationResult({ success: outcome.positive, message: outcome.reaction })
    setTimeout(() => {
      setConversationResult(null)
      setShowConversation(false)
      setSelectedPlayerId(null)
    }, 2600)
  }

  // Executar acao de grupo
  const handleGroupAction = (actionId: string) => {
    const action = GROUP_ACTIONS.find(a => a.id === actionId)
    if (!action) return
    
    performGroupAction(action)
  }

  const canUseAction = (actionId: string) => {
    const action = GROUP_ACTIONS.find(a => a.id === actionId)
    if (!action) return false
    const lastUsed = groupActionCooldowns?.[actionId]
    if (lastUsed == null) return true
    return currentWeek - lastUsed >= action.cooldown
  }

  return (
    <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameHeader team={userTeam} />
      
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 scrollbar-premium">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Dinamica do Vestiario</h1>
            <p className="text-sm text-white/50">Gerencie a moral e o relacionamento com os jogadores</p>
          </div>
        </div>

        {/* Visao Geral da Moral */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white/70">Moral Geral</span>
              <Heart className="h-5 w-5 text-red-500" />
            </div>
            <div className="text-3xl font-bold text-white mb-2">{squadMorale.overall}%</div>
            <Progress value={squadMorale.overall} className="h-2" />
          </div>
          
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white/70">Uniao do Grupo</span>
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-white mb-2">{squadMorale.unity}%</div>
            <Progress value={squadMorale.unity} className="h-2" />
          </div>
          
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white/70">Confianca</span>
              <Shield className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-white mb-2">{squadMorale.confidence}%</div>
            <Progress value={squadMorale.confidence} className="h-2" />
          </div>
          
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white/70">Jogadores Felizes</span>
              <Smile className="h-5 w-5 text-[#ffd700]" />
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              {playersByMorale.Feliz.length + playersByMorale.Motivado.length}
              <span className="text-lg text-white/50">/{squadPlayers.length}</span>
            </div>
            <div className="mt-2 text-xs text-white/45">Satisfação com papéis: {dynamics.satisfaction}%</div>
          </div>
        </div>

        {dynamics.concerns > 0 && (
          <div className="mb-6 rounded-xl border border-orange-400/20 bg-orange-400/[0.06] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-orange-300">
              <AlertTriangle className="h-4 w-4" />
              {dynamics.concerns} atleta{dynamics.concerns === 1 ? "" : "s"} questionando seu papel
            </div>
            <p className="mt-1 text-xs text-white/55">
              {dynamics.unsettledLeaders > 0
                ? `${dynamics.unsettledLeaders} liderança${dynamics.unsettledLeaders === 1 ? " está" : "s estão"} recebendo menos minutos do que o status no elenco exige.`
                : "As reclamações estão concentradas em jogadores de rotação e reservas."}
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Eventos Recentes */}
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Eventos Recentes
            </h2>
            
            <div className="space-y-3 overflow-hidden">
              {events.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-white/40">
                  Nenhum evento real registrado nesta carreira.
                </div>
              )}
              {paginaDeEventos.fatia.map((event, i) => {
                const Icon = getEventIcon(event.type)
                return (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      event.impact > 0 ? "bg-green-500/20" : "bg-red-500/20"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4",
                        event.impact > 0 ? "text-green-400" : "text-red-400"
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-white">{event.description}</div>
                      <div className="text-xs text-white/50 mt-1">Semana {event.week}</div>
                    </div>
                    <div className={cn(
                      "text-sm font-bold",
                      event.impact > 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {event.impact > 0 ? "+" : ""}{event.impact}
                    </div>
                  </div>
                )
              })}
            </div>
            <Paginador lista={paginaDeEventos} rotulo="eventos" />
          </div>

          {/* Jogadores por Moral */}
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Estado do Elenco
            </h2>
            
            <div className="space-y-4 max-h-[620px] overflow-y-auto scrollbar-thin">
              {Object.entries(playersByMorale).map(([moral, players]) => {
                if (players.length === 0) return null
                const Icon = getMoralIcon(moral)
                return (
                  <div key={moral}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={cn("h-4 w-4", getMoralColor(moral))} />
                      <span className={cn("text-sm font-medium", getMoralColor(moral))}>{moral}</span>
                      <span className="text-xs text-white/50">({players.length})</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {players.map(player => {
                        const profile = dynamicsByPlayer.get(player.id)
                        return (
                        <button
                          key={player.id}
                          onClick={() => {
                            setSelectedPlayerId(player.id)
                            setShowConversation(true)
                          }}
                          className="flex items-center gap-2 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                            {player.position}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-white truncate">{player.name}</div>
                            {profile && (
                              <div className={cn("text-[10px]", profile.concern ? "text-orange-300" : "text-white/35")}>
                                {roleLabel(profile.role)} · {profile.satisfaction}%
                              </div>
                            )}
                          </div>
                          {profile?.concern
                            ? <AlertTriangle className="h-3 w-3 text-orange-300" />
                            : <MessageCircle className="h-3 w-3 text-white/30" />}
                        </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Acoes de Grupo */}
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Handshake className="h-5 w-5 text-primary" />
              Acoes de Grupo
            </h2>
            
            <div className="space-y-3">
              {GROUP_ACTIONS.map(action => {
                const canUse = canUseAction(action.id)
                const lastUsed = groupActionCooldowns?.[action.id]
                const cooldownRemaining = lastUsed == null ? 0 : Math.max(0, action.cooldown - (currentWeek - lastUsed))
                
                return (
                  <button
                    key={action.id}
                    onClick={() => handleGroupAction(action.id)}
                    disabled={!canUse}
                    className={cn(
                      "w-full p-4 rounded-lg text-left transition-all flex items-center gap-3",
                      canUse
                        ? "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20"
                        : "bg-white/[0.02] border border-white/[0.04] opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      canUse ? "bg-primary/20" : "bg-white/5"
                    )}>
                      <action.icon className={cn(
                        "h-5 w-5",
                        canUse ? "text-primary" : "text-white/30"
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white">{action.label}</div>
                      <div className="text-xs text-white/50">{action.description}</div>
                      {!canUse && (
                        <div className="text-xs text-orange-400 mt-1">
                          Disponivel em {cooldownRemaining} semana{cooldownRemaining > 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                    {canUse && (
                      <div className="text-sm font-bold text-green-400">+{action.impact}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Modal de Conversa */}
        <AnimatePresence>
          {showConversation && selectedPlayer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => {
                if (!conversationResult) {
                  setShowConversation(false)
                  setSelectedPlayerId(null)
                }
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#050508] border border-white/10 rounded-xl p-6 max-w-md w-full"
              >
                {conversationResult ? (
                  <div className="text-center py-8">
                    {conversationResult.success ? (
                      <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    ) : (
                      <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    )}
                    <p className="text-lg text-white">{conversationResult.message}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xl font-bold text-white">
                        {selectedPlayer.position}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{selectedPlayer.name}</h3>
                        <div className={cn("flex items-center gap-1", getMoralColor(selectedPlayer.morale))}>
                          {(() => {
                            const Icon = getMoralIcon(selectedPlayer.morale)
                            return <Icon className="h-4 w-4" />
                          })()}
                          <span className="text-sm">{selectedPlayer.morale}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tema + fala de abertura do jogador (a postura dele). */}
                    {conversation && (
                      <>
                        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
                          <MessageCircle className="h-3 w-3" /> {conversation.topicLabel}
                        </div>
                        <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-sm italic leading-relaxed text-white/85">"{conversation.opening}"</p>
                          <p className="mt-1 text-right text-[11px] text-white/40">— {selectedPlayer.name.split(" ")[0]}</p>
                        </div>

                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Como você responde?</p>
                        <div className="space-y-2">
                          {conversation.choices.map(choice => (
                            <button
                              key={choice.id}
                              onClick={() => handleConversation(choice.id)}
                              className="group flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-[var(--brand)]/40 hover:bg-white/[0.08]"
                            >
                              <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-colors group-hover:text-[var(--brand)]" />
                              <span className="text-sm text-white/90">{choice.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowConversation(false)
                        setSelectedPlayerId(null)
                      }}
                      className="w-full mt-4"
                    >
                      Cancelar
                    </Button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
