"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { GameHeader } from "@/components/game-header"
import { useGameState, useUserTeam } from "@/lib/save-system"
import { useNotifications, type Notification } from "@/components/notifications-system"
import { calcSeasonObjective, generateBoardEvaluation, generateBoardObjectiveMessage } from "@/lib/board-engine"
import { detectEvents, respondToEvent, type DressingRoomEvent } from "@/lib/dressing-room-engine"
import { useGameManager } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"
import { Bell, Building2, CheckCheck, MessageCircle, MessagesSquare, Trash2, Users } from "lucide-react"
import { ConversaDiretoria } from "@/components/conversa-diretoria"
import { clearJobOffers } from "@/lib/career-moves"
import { hardNavigate } from "@/lib/hard-navigation"
import { computeBoardConfidence } from "@/lib/board-engine"
import { useGameEngine } from "@/lib/game-engine"

type Aba = "notificacoes" | "diretoria" | "atletas"

/**
 * Central de Notificações — página, não mais painel lateral.
 *
 * O sino do cabeçalho abria um drawer que sumia a cada navegação e passava
 * despercebido: mensagens da diretoria e propostas ficavam sem resposta. Agora
 * é uma tela do menu, e o escritório redireciona para cá enquanto houver algo
 * não lido (ver components/pending-inbox-gate.tsx).
 */
export default function NotificacoesPage() {
  const router = useRouter()
  const { team: userTeam } = useUserTeam()
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotifications()
  const [selecionada, setSelecionada] = useState<Notification | null>(null)
  const [aba, setAba] = useState<Aba>("notificacoes")
  // Reuniao com a diretoria (lib/conversa-diretoria.ts).
  const [reuniaoAberta, setReuniaoAberta] = useState(false)
  const engineBalance = useGameEngine(s => s.balance)
  const engineAddRevenue = useGameEngine(s => s.addClubRevenue)
  const { state: saveState, replaceState } = useGameState()
  const { standings, currentWeek } = useGameManager()

  /**
   * Conversas com a DIRETORIA e com os ATLETAS.
   *
   * Nao inventei um sistema de mensagens: board-engine e dressing-room-engine ja
   * geravam esse conteudo a partir do estado real da carreira e nada os exibia.
   * A pagina /mensagens que existia mostra uma lista FIXA, escrita a mao, igual
   * para todo mundo — por isso nao a reaproveitei aqui.
   */
  const mensagensDiretoria = useMemo(() => {
    if (!saveState.selectedTeamShort) return []
    // board-engine trabalha com SavedTeam (tem fileKey/estadio); useUserTeam
    // devolve Team, que usa file_key/estadio_nome. Adaptamos aqui em vez de
    // afrouxar o tipo do motor.
    const time = {
      ...userTeam,
      fileKey: userTeam.file_key ?? userTeam.curto,
      estadio: userTeam.estadio_nome ?? "",
      pais: userTeam.pais ?? "Brasil",
    }
    const objetivo = calcSeasonObjective(time)
    const posicao = Math.max(1, standings.findIndex(s => s.teamShort === userTeam.curto) + 1)
    const rodada = Math.max(1, currentWeek)
    return [
      generateBoardObjectiveMessage(time, saveState.managerName || "Tecnico", saveState.season, objetivo),
      // A avaliacao so existe nas rodadas 10/20/30 — fora delas o motor devolve null.
      generateBoardEvaluation(
        time, saveState.managerName || "Tecnico", saveState.season,
        rodada, posicao, standings.length || 20, objetivo,
      ),
    ].filter(Boolean)
  }, [userTeam, saveState.selectedTeamShort, saveState.managerName, saveState.season, standings, currentWeek])

  const eventosVestiario = useMemo<DressingRoomEvent[]>(() => {
    if (!saveState.selectedTeamShort) return []
    return detectEvents(saveState, currentWeek)
  }, [saveState, currentWeek])

  const responderVestiario = (eventId: string, responseId: string) => {
    replaceState(respondToEvent(saveState, eventId, responseId))
  }

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.button === "B") {
        if (selecionada) setSelecionada(null)
        else router.back()
      }
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router, selecionada])

  /** O que a diretoria SABE ao sentar com você — nada disso é inventado na hora. */
  const estadoDaDiretoria = useMemo(() => {
    // calcSeasonObjective lê `divisao` (e faz .toLowerCase() nela). Passar só
    // curto/nome/prestígio derrubava o prerender do build com "Cannot read
    // properties of undefined" — o objeto precisa vir completo.
    const objetivo = calcSeasonObjective({
      curto: userTeam.curto,
      nome: userTeam.nome,
      prestigio: userTeam.prestigio ?? 60,
      divisao: String(saveState.divisionOverride ?? userTeam.divisao ?? "serie_a"),
    } as Parameters<typeof calcSeasonObjective>[0])
    const posicao = Math.max(0, standings.findIndex(s => s.teamShort === userTeam.curto) + 1)
    const totalUser = standings.length || 20
    const confianca = computeBoardConfidence({
      currentPosition: posicao > 0 ? posicao : objetivo.targetPosition,
      objective: objetivo,
      recentForm: [],
      seasonProgress: Math.min(1, Math.max(0, currentWeek / 38)),
    })
    return {
      confianca,
      posicao: posicao > 0 ? posicao : objetivo.targetPosition,
      metaPosicao: objetivo.targetPosition,
      caixa: engineBalance,
      prestigio: userTeam.prestigio ?? 60,
      // Cada pedido atendido nesta temporada cansa a diretoria — o save guarda.
      pedidosNaTemporada: saveState.pedidosADiretoria ?? 0,
    }
  }, [userTeam, standings, currentWeek, engineBalance, saveState.pedidosADiretoria])

  /** Aplica no save o que a reunião decidiu. */
  const aplicarDesfechoDaReuniao = (d: { confiancaDelta: number; verbaLiberada?: number; novaMeta?: number }) => {
    if (d.verbaLiberada && d.verbaLiberada > 0) engineAddRevenue(d.verbaLiberada)
    replaceState({
      ...saveState,
      pedidosADiretoria: (saveState.pedidosADiretoria ?? 0) + 1,
      boardConfidenceBonus: (saveState.boardConfidenceBonus ?? 0) + d.confiancaDelta,
      ...(d.novaMeta ? { metaDaDiretoria: d.novaMeta } : {}),
      updatedAt: Date.now(),
    })
  }

  const formatarTempo = (data: Date) => {
    const mins = Math.floor((Date.now() - data.getTime()) / 60000)
    if (mins < 1) return "Agora"
    if (mins < 60) return `${mins}min atrás`
    const horas = Math.floor(mins / 60)
    if (horas < 24) return `${horas}h atrás`
    return `${Math.floor(horas / 24)}d atrás`
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#050508] pb-20 md:pb-0">
      <GameHeader team={userTeam} />

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-white/[0.04] bg-[#0d0d0d] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold text-white">
                <Bell className="h-5 w-5 text-[var(--brand)]" />
                Central de Notificações
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-black text-[var(--brand-ink)]">
                    {unreadCount}
                  </span>
                )}
              </h1>
              <p className="mt-0.5 text-xs text-white/50">
                Diretoria, comissão técnica, mercado e departamento médico.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 hover:text-white"
                >
                  <CheckCheck className="h-3.5 w-3.5" />Marcar todas como lidas
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1.5 rounded-lg border border-red-400/25 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-400/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Abas: a Central so mostrava avisos do sistema (autosave, partida
            simulada). Diretoria e atletas ja tinham conteudo gerado pelos motores
            e nenhuma tela os exibia. */}
        <div className="flex gap-1 border-b border-white/[0.04] bg-[#0d0d0d] px-4 pb-2">
          {([
            { id: "notificacoes", rotulo: "Avisos", icone: Bell, contagem: notifications.length },
            { id: "diretoria", rotulo: "Diretoria", icone: Building2, contagem: mensagensDiretoria.length },
            { id: "atletas", rotulo: "Atletas", icone: Users, contagem: eventosVestiario.length },
          ] as const).map(({ id, rotulo, icone: Icone, contagem }) => (
            <button
              key={id}
              onClick={() => { setAba(id); setSelecionada(null) }}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                aba === id ? "bg-[var(--brand)]/10 text-[var(--brand)]" : "text-white/45 hover:bg-white/5 hover:text-white/70",
              )}
            >
              <Icone className="h-3.5 w-3.5" />
              {rotulo}
              {contagem > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 text-[10px] font-black",
                  aba === id ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/10 text-white/60",
                )}>
                  {contagem}
                </span>
              )}
            </button>
          ))}
        </div>

        {aba === "diretoria" && (
          <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-game">
            {mensagensDiretoria.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white/35">
                <Building2 className="h-12 w-12" />
                <p className="text-sm">A diretoria ainda não se manifestou nesta temporada.</p>
              </div>
            ) : mensagensDiretoria.map(msg => msg && (
              <article key={msg.id} className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-5">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
                  <Building2 className="h-3.5 w-3.5" />
                  {msg.from}
                </div>
                <h3 className="mt-1.5 text-base font-bold text-white">{msg.subject}</h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/65">{msg.fullContent}</p>
              </article>
            ))}
          </div>
        )}

        {aba === "atletas" && (
          <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-game">
            {eventosVestiario.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white/35">
                <Users className="h-12 w-12" />
                <p className="text-sm">Vestiário tranquilo. Ninguém pediu conversa.</p>
              </div>
            ) : eventosVestiario.map(ev => (
              <article key={ev.id} className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-5">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand)]/80">
                  <MessagesSquare className="h-3.5 w-3.5" />
                  Vestiário
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/80">{ev.description}</p>
                {/* As respostas mexem de verdade na moral do elenco (respondToEvent). */}
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {ev.options.map(op => (
                    <button
                      key={op.id}
                      onClick={() => responderVestiario(ev.id, op.id)}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-xs text-white/75 transition-colors hover:border-[var(--brand)]/40 hover:text-white"
                    >
                      <span className="block font-semibold">{op.text}</span>
                      <span className={cn(
                        "mt-0.5 block text-[10px]",
                        op.effects.moralDelta >= 0 ? "text-emerald-400/70" : "text-red-400/70",
                      )}>
                        {op.effects.moralDelta >= 0 ? "+" : ""}{op.effects.moralDelta} moral
                      </span>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}

        {aba === "notificacoes" && (
        <div className="grid flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* Lista */}
          <div className="overflow-y-auto pr-1 scrollbar-game">
            {notifications.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white/35">
                <Bell className="h-12 w-12" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {notifications.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { markAsRead(item.id); setSelecionada(item) }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                      selecionada?.id === item.id
                        ? "border-[var(--brand)]/50 bg-[var(--brand)]/[0.07]"
                        : item.read
                          ? "border-white/[0.05] bg-[#0c0c10] hover:border-white/15"
                          : "border-white/15 bg-[#101018] hover:border-white/25",
                    )}
                  >
                    <span className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      item.read ? "bg-white/15" : "bg-[var(--brand)]",
                    )} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", item.read ? "text-white/70" : "font-semibold text-white")}>
                        {item.title}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-white/45">{item.message}</span>
                      <span className="mt-1 block text-[10px] text-white/30">{formatarTempo(item.timestamp)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detalhe */}
          <div className="overflow-y-auto scrollbar-game">
            {selecionada ? (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand)]">Central do clube</p>
                <h2 className="mt-2 text-xl font-bold text-white">{selecionada.title}</h2>
                <p className="mt-1 text-xs text-white/40">{formatarTempo(selecionada.timestamp)}</p>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/75">{selecionada.message}</p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {selecionada.conversation?.kind === "bench" && (
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent("ultrafoot:bench-talk", {
                        detail: { playerId: selecionada.conversation?.playerId },
                      }))}
                      className="flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2.5 text-xs font-black text-[var(--brand-ink)] transition hover:brightness-110"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Conversar com o atleta
                    </button>
                  )}
                  {selecionada.action && (
                    <button
                      onClick={selecionada.action.onClick}
                      className="rounded-lg bg-[var(--brand)] px-4 py-2 text-xs font-bold text-[var(--brand-ink)]"
                    >
                      {selecionada.action.label}
                    </button>
                  )}
                  <button
                    onClick={() => { removeNotification(selecionada.id); setSelecionada(null) }}
                    className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/60 hover:text-white"
                  >
                    Arquivar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-white/[0.05] bg-[#0c0c10] p-8 text-center">
                <Bell className="h-10 w-10 text-white/15" />
                <p className="text-sm text-white/40">Selecione um aviso para ler</p>
                {/* Os botoes daqui mandavam para /mensagens, uma lista escrita a
                    mao e igual para todo mundo. Diretoria e atletas agora sao
                    abas desta propria tela, com conteudo da sua carreira. */}
                <div className="flex flex-wrap justify-center gap-2">
                  {/* Antes só trocava de aba (lista de recados). Agora ABRE a
                      reunião: assunto, tom da resposta e consequência real. */}
                  <button
                    onClick={() => setReuniaoAberta(true)}
                    className="flex items-center gap-2 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-3 py-2 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/20"
                  >
                    <Building2 className="h-3.5 w-3.5" />Falar com a diretoria
                  </button>
                  <button
                    onClick={() => setAba("diretoria")}
                    className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:text-white"
                  >
                    <Building2 className="h-3.5 w-3.5" />Recados da diretoria
                  </button>
                  <button
                    onClick={() => setAba("atletas")}
                    className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:text-white"
                  >
                    <MessagesSquare className="h-3.5 w-3.5" />Conversas com atletas
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </main>

      {/* REUNIÃO COM A DIRETORIA. O desfecho vale de verdade: confiança do
          conselho, verba extra no caixa e meta renegociada ficam no save. */}
      <ConversaDiretoria
        aberto={reuniaoAberta}
        onFechar={() => setReuniaoAberta(false)}
        clube={userTeam.nome}
        estado={estadoDaDiretoria}
        onDesfecho={aplicarDesfechoDaReuniao}
        onPedirDemissao={() => {
          // Mesma saída do menu [W]: limpa as propostas, solta o clube e leva à
          // Área do Treinador. O progresso já é salvo sozinho.
          clearJobOffers()
          replaceState({ ...saveState, selectedTeamShort: null, updatedAt: Date.now() })
          hardNavigate("/treinador")
        }}
      />
    </div>
  )
}
